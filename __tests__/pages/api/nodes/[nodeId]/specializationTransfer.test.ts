import { createMocks, RequestMethod } from 'node-mocks-http';
import transferSpecializationsHandler from ' @components/pages/api/nodes/[nodeId]/specializations/transfer';
import { NodeService } from ' @components/services/nodeService';
import { NodeRelationshipService } from ' @components/services/nodeRelationshipService';
import { ApiKeyValidationError, ApiResponse, NextApiRequestWithAuth } from ' @components/types/api';
import { INode, ILinkNode } from ' @components/types/INode';
import { NextApiResponse } from 'next';

// Mock NodeService
jest.mock('@components/services/nodeService', () => ({
  NodeService: {
    getNode: jest.fn()
  }
}));

// Mock NodeRelationshipService
jest.mock('@components/services/nodeRelationshipService', () => ({
  NodeRelationshipService: {
    transferSpecializations: jest.fn()
  }
}));

// Mock the middleware functions
jest.mock('@components/middlewares/apiLogger', () => ({
  withApiLogger: jest.fn((handler) => handler),
}));

jest.mock('@components/middlewares/validateApiKey', () => ({
  validateApiKey: jest.fn((handler) => async (
    req: NextApiRequestWithAuth,
    res: NextApiResponse
  ) => {
    // Simulate the middleware adding apiKeyInfo to the request
    req.apiKeyInfo = mockApiKeyInfo;
    return handler(req, res);
  }),
}));

// Mock API key info
const mockApiKeyInfo = {
  clientId: 'test-client-id',
  userId: 'test-user-id',
  uname: 'test-username',
  createdAt: new Date(),
  lastUsed: new Date(),
  isActive: true,
  description: 'Test API Key'
};

// Helper to create a test node
const createTestNode = (override: Partial<INode> = {}): INode => {
  return {
    id: 'test-node-id',
    title: 'Test Node',
    nodeType: 'activity',
    deleted: false,
    properties: {
      parts: [],
      isPartOf: []
    },
    inheritance: {},
    generalizations: [],
    specializations: [
      {
        collectionName: 'main',
        nodes: [
          { id: 'special-node-1', title: 'Special Node 1' } as ILinkNode,
          { id: 'special-node-2', title: 'Special Node 2' } as ILinkNode
        ]
      },
      {
        collectionName: 'secondary',
        nodes: [
          { id: 'special-node-3', title: 'Special Node 3' } as ILinkNode
        ]
      }
    ],
    root: 'test-root',
    propertyType: {},
    textValue: {},
    createdBy: 'test-user',
    ...override
  };
};

// Helper to create a target node
const createTargetNode = (override: Partial<INode> = {}): INode => {
  return {
    id: 'target-node-id',
    title: 'Target Node',
    nodeType: 'activity',
    deleted: false,
    properties: {
      parts: [],
      isPartOf: []
    },
    inheritance: {},
    generalizations: [],
    specializations: [
      {
        collectionName: 'main',
        nodes: [
          { id: 'target-special-1', title: 'Target Special 1' } as ILinkNode
        ]
      }
    ],
    root: 'test-root',
    propertyType: {},
    textValue: {},
    createdBy: 'test-user',
    ...override
  };
};

// Helper to create a request
const createRequest = (
  method: RequestMethod,
  nodeId: string | undefined,
  body: any = undefined
) => {
  return createMocks<NextApiRequestWithAuth, NextApiResponse<ApiResponse<any>>>({
    method,
    query: {
      nodeId
    },
    body
  });
};

// Helper to verify success response
const expectSuccessResponse = (
  res: any,
  expectedStatusCode = 200
): ApiResponse<any> => {
  expect(res.statusCode).toBe(expectedStatusCode);
  
  const responseData = JSON.parse(res._getData()) as ApiResponse<any>;
  expect(responseData.success).toBe(true);
  expect(responseData.metadata).toBeDefined();
  expect(responseData.metadata.clientId).toBe('test-client-id');
  
  return responseData;
};

// Helper to verify error response
const expectErrorResponse = (
  res: any,
  expectedStatusCode: number,
  expectedErrorCode: string
): ApiResponse<never> => {
  expect(res.statusCode).toBe(expectedStatusCode);
  
  const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
  expect(responseData.success).toBe(false);
  expect(responseData.error).toBeDefined();
  expect(responseData.code).toBe(expectedErrorCode);
  expect(responseData.metadata).toBeDefined();
  
  return responseData;
};

describe('Transfer Specializations API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (NodeService.getNode as jest.Mock).mockImplementation((nodeId: string) => {
      if (nodeId === 'test-node-id') {
        return Promise.resolve(createTestNode());
      } else if (nodeId === 'target-node-id') {
        return Promise.resolve(createTargetNode());
      } else if (nodeId === 'deleted-node-id') {
        return Promise.resolve(createTestNode({ deleted: true }));
      } else if (nodeId === 'special-node-1' || nodeId === 'special-node-2' || nodeId === 'special-node-3') {
        return Promise.resolve(createTestNode({ id: nodeId }));
      } else {
        return Promise.reject(new Error('Node not found'));
      }
    });
  });

  //==========================================================================
  // SECTION 1: BASIC ENDPOINT FUNCTIONALITY TESTS
  //==========================================================================
  
  describe('Basic functionality', () => {
    it('should return 405 for unsupported methods', async () => {
      const { req, res } = createRequest('GET', 'test-node-id');
      
      await transferSpecializationsHandler(req, res);
      
      expectErrorResponse(res, 405, 'METHOD_NOT_ALLOWED');
      expect(res._getHeaders().allow).toEqual(['POST']);
    });

    it('should return 400 when nodeId is missing', async () => {
      const { req, res } = createRequest('POST', undefined);
      
      await transferSpecializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
    });

    it('should return 400 when nodeId is empty', async () => {
      const { req, res } = createRequest('POST', '   ');
      
      await transferSpecializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
    });

    it('should return 404 when source node does not exist', async () => {
      const { req, res } = createRequest('POST', 'non-existent-node');
      
      await transferSpecializationsHandler(req, res);
      
      expectErrorResponse(res, 404, 'NODE_NOT_FOUND');
    });

    it('should return 400 when source node is deleted', async () => {
      const { req, res } = createRequest('POST', 'deleted-node-id');
      
      await transferSpecializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'NODE_OPERATION_ERROR');
    });
    
    it('should include metadata in the response', async () => {
      const requestPayload = {
        nodes: [{ id: 'special-node-1' }],
        targetNodeId: 'target-node-id',
        reasoning: 'Transfer for testing'
      };
      
      (NodeRelationshipService.transferSpecializations as jest.Mock).mockResolvedValueOnce({
        updatedSourceNode: createTestNode(),
        updatedTargetNode: createTargetNode()
      });
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await transferSpecializationsHandler(req, res);
      
      const responseData = expectSuccessResponse(res);
      expect(responseData.metadata.clientId).toBe('test-client-id');
      expect(responseData.metadata.version).toBe('1.0');
    });
  });

  //==========================================================================
  // SECTION 2: REQUEST VALIDATION TESTS
  //==========================================================================
  
  describe('Request Validation', () => {
    it('should return 400 when nodes array is empty', async () => {
      const requestPayload = {
        nodes: [],
        targetNodeId: 'target-node-id',
        reasoning: 'Invalid request with empty nodes'
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await transferSpecializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
      expect(NodeRelationshipService.transferSpecializations).not.toHaveBeenCalled();
    });

    it('should return 400 when nodes array exceeds 100 items', async () => {
      const nodes = Array.from({ length: 101 }, (_, i) => ({ id: `node-${i}` }));
      const requestPayload = {
        nodes,
        targetNodeId: 'target-node-id',
        reasoning: 'Too many nodes'
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await transferSpecializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
      expect(NodeRelationshipService.transferSpecializations).not.toHaveBeenCalled();
    });

    it('should return 400 when target node ID is missing', async () => {
      const requestPayload = {
        nodes: [{ id: 'special-node-1' }],
        reasoning: 'Missing target node'
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await transferSpecializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
      expect(NodeRelationshipService.transferSpecializations).not.toHaveBeenCalled();
    });

    it('should return 400 when reasoning is missing', async () => {
      const requestPayload = {
        nodes: [{ id: 'special-node-1' }],
        targetNodeId: 'target-node-id'
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await transferSpecializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
      expect(NodeRelationshipService.transferSpecializations).not.toHaveBeenCalled();
    });

    it('should return 400 when reasoning is empty', async () => {
      const requestPayload = {
        nodes: [{ id: 'special-node-1' }],
        targetNodeId: 'target-node-id',
        reasoning: '   '
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await transferSpecializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
      expect(NodeRelationshipService.transferSpecializations).not.toHaveBeenCalled();
    });

    it('should return 400 when reasoning exceeds 1000 characters', async () => {
      const requestPayload = {
        nodes: [{ id: 'special-node-1' }],
        targetNodeId: 'target-node-id',
        reasoning: 'a'.repeat(1001)
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await transferSpecializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
      expect(NodeRelationshipService.transferSpecializations).not.toHaveBeenCalled();
    });

    it('should return 400 when targetCollectionName format is invalid', async () => {
      const requestPayload = {
        nodes: [{ id: 'special-node-1' }],
        targetNodeId: 'target-node-id',
        targetCollectionName: 'Invalid Collection Name!',
        reasoning: 'Invalid collection name'
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await transferSpecializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
      expect(NodeRelationshipService.transferSpecializations).not.toHaveBeenCalled();
    });
  });

  //==========================================================================
  // SECTION 3: NODE VALIDATION TESTS
  //==========================================================================
  
  describe('Node Validation', () => {
    it('should return 400 when source and target are the same node', async () => {
      const requestPayload = {
        nodes: [{ id: 'special-node-1' }],
        targetNodeId: 'test-node-id',
        reasoning: 'Same source and target'
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await transferSpecializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'NODE_OPERATION_ERROR');
      expect(NodeRelationshipService.transferSpecializations).not.toHaveBeenCalled();
    });

    it('should return 400 when target node does not exist', async () => {
      const requestPayload = {
        nodes: [{ id: 'special-node-1' }],
        targetNodeId: 'non-existent-node',
        reasoning: 'Non-existent target'
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await transferSpecializationsHandler(req, res);
      
      expectErrorResponse(res, 404, 'NODE_NOT_FOUND');
      expect(NodeRelationshipService.transferSpecializations).not.toHaveBeenCalled();
    });

    it('should return 400 when attempting self-reference', async () => {
      const requestPayload = {
        nodes: [{ id: 'target-node-id' }],
        targetNodeId: 'target-node-id',
        reasoning: 'Self-reference attempt'
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await transferSpecializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'NODE_OPERATION_ERROR');
      expect(NodeRelationshipService.transferSpecializations).not.toHaveBeenCalled();
    });

    it('should return 400 when nodes are not in source specializations', async () => {
      const requestPayload = {
        nodes: [{ id: 'non-existent-special' }],
        targetNodeId: 'target-node-id',
        reasoning: 'Non-existent specialization'
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await transferSpecializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'NODE_OPERATION_ERROR');
      expect(NodeRelationshipService.transferSpecializations).not.toHaveBeenCalled();
    });

    it('should return 400 when nodes already exist in target specializations', async () => {
      // Update target node mock to include special-node-1
      (NodeService.getNode as jest.Mock).mockImplementationOnce(() => {
        return Promise.resolve(createTestNode());
      }).mockImplementationOnce(() => {
        return Promise.resolve(createTargetNode({
          specializations: [
            {
              collectionName: 'main',
              nodes: [
                { id: 'target-special-1', title: 'Target Special 1' },
                { id: 'special-node-1', title: 'Special Node 1' }
              ]
            }
          ]
        }));
      });
      
      const requestPayload = {
        nodes: [{ id: 'special-node-1' }],
        targetNodeId: 'target-node-id',
        reasoning: 'Already exists in target'
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await transferSpecializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'NODE_OPERATION_ERROR');
      expect(NodeRelationshipService.transferSpecializations).not.toHaveBeenCalled();
    });
  });

  //==========================================================================
  // SECTION 4: SUCCESSFUL OPERATION TESTS
  //==========================================================================
  
  describe('Successful Operations', () => {
    it('should transfer specializations successfully', async () => {
      const updatedSourceNode = createTestNode({
        specializations: [
          {
            collectionName: 'main',
            nodes: [
              { id: 'special-node-2', title: 'Special Node 2' } as ILinkNode
            ]
          },
          {
            collectionName: 'secondary',
            nodes: [
              { id: 'special-node-3', title: 'Special Node 3' } as ILinkNode
            ]
          }
        ]
      });
      
      const updatedTargetNode = createTargetNode({
        specializations: [
          {
            collectionName: 'main',
            nodes: [
              { id: 'target-special-1', title: 'Target Special 1' } as ILinkNode,
              { id: 'special-node-1', title: 'Special Node 1' } as ILinkNode
            ]
          }
        ]
      });
      
      (NodeRelationshipService.transferSpecializations as jest.Mock).mockResolvedValueOnce({
        updatedSourceNode,
        updatedTargetNode
      });
      
      const requestPayload = {
        nodes: [{ id: 'special-node-1' }],
        targetNodeId: 'target-node-id',
        reasoning: 'Transferring specialization'
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await transferSpecializationsHandler(req, res);
      
      const responseData = expectSuccessResponse(res);
      expect(responseData.data?.sourceNode).toEqual(updatedSourceNode);
      expect(responseData.data?.targetNode).toEqual(updatedTargetNode);
      
      expect(NodeRelationshipService.transferSpecializations).toHaveBeenCalledWith(
        'test-node-id',
        'target-node-id',
        [{ id: 'special-node-1' }],
        'test-username',
        'Transferring specialization',
        'main'
      );
    });

    it('should transfer specializations to a specific collection', async () => {
      const updatedSourceNode = createTestNode({
        specializations: [
          {
            collectionName: 'main',
            nodes: [
              { id: 'special-node-2', title: 'Special Node 2' } as ILinkNode
            ]
          },
          {
            collectionName: 'secondary',
            nodes: [
              { id: 'special-node-3', title: 'Special Node 3' } as ILinkNode
            ]
          }
        ]
      });
      
      const updatedTargetNode = createTargetNode({
        specializations: [
          {
            collectionName: 'main',
            nodes: [
              { id: 'target-special-1', title: 'Target Special 1' } as ILinkNode
            ]
          },
          {
            collectionName: 'custom',
            nodes: [
              { id: 'special-node-1', title: 'Special Node 1' } as ILinkNode
            ]
          }
        ]
      });
      
      (NodeRelationshipService.transferSpecializations as jest.Mock).mockResolvedValueOnce({
        updatedSourceNode,
        updatedTargetNode
      });
      
      const requestPayload = {
        nodes: [{ id: 'special-node-1' }],
        targetNodeId: 'target-node-id',
        targetCollectionName: 'custom',
        reasoning: 'Transferring to custom collection'
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await transferSpecializationsHandler(req, res);
      
      const responseData = expectSuccessResponse(res);
      expect(responseData.data?.sourceNode).toEqual(updatedSourceNode);
      expect(responseData.data?.targetNode).toEqual(updatedTargetNode);
      
      expect(NodeRelationshipService.transferSpecializations).toHaveBeenCalledWith(
        'test-node-id',
        'target-node-id',
        [{ id: 'special-node-1' }],
        'test-username',
        'Transferring to custom collection',
        'custom'
      );
    });

    it('should transfer multiple specializations at once', async () => {
      const updatedSourceNode = createTestNode({
        specializations: [
          {
            collectionName: 'secondary',
            nodes: [
              { id: 'special-node-3', title: 'Special Node 3' } as ILinkNode
            ]
          }
        ]
      });
      
      const updatedTargetNode = createTargetNode({
        specializations: [
          {
            collectionName: 'main',
            nodes: [
              { id: 'target-special-1', title: 'Target Special 1' } as ILinkNode,
              { id: 'special-node-1', title: 'Special Node 1' } as ILinkNode,
              { id: 'special-node-2', title: 'Special Node 2' } as ILinkNode
            ]
          }
        ]
      });
      
      (NodeRelationshipService.transferSpecializations as jest.Mock).mockResolvedValueOnce({
        updatedSourceNode,
        updatedTargetNode
      });
      
      const requestPayload = {
        nodes: [
          { id: 'special-node-1' },
          { id: 'special-node-2' }
        ],
        targetNodeId: 'target-node-id',
        reasoning: 'Transferring multiple specializations'
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await transferSpecializationsHandler(req, res);
      
      const responseData = expectSuccessResponse(res);
      expect(responseData.data?.sourceNode).toEqual(updatedSourceNode);
      expect(responseData.data?.targetNode).toEqual(updatedTargetNode);
      
      expect(NodeRelationshipService.transferSpecializations).toHaveBeenCalledWith(
        'test-node-id',
        'target-node-id',
        [{ id: 'special-node-1' }, { id: 'special-node-2' }],
        'test-username',
        'Transferring multiple specializations',
        'main'
      );
    });
  });

  //==========================================================================
  // SECTION 5: ERROR HANDLING TESTS
  //==========================================================================
  
  describe('Error Handling', () => {
    it('should handle service errors properly', async () => {
      (NodeRelationshipService.transferSpecializations as jest.Mock).mockRejectedValueOnce(
        new ApiKeyValidationError('Service validation error')
      );
      
      const requestPayload = {
        nodes: [{ id: 'special-node-1' }],
        targetNodeId: 'target-node-id',
        reasoning: 'Will cause service error'
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await transferSpecializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
    });

    it('should handle unexpected errors', async () => {
      (NodeRelationshipService.transferSpecializations as jest.Mock).mockRejectedValueOnce(
        new Error('Unexpected service error')
      );
      
      const requestPayload = {
        nodes: [{ id: 'special-node-1' }],
        targetNodeId: 'target-node-id',
        reasoning: 'Will cause unexpected error'
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await transferSpecializationsHandler(req, res);
      
      expectErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR');
    });
  });
});