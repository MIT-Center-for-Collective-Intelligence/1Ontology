import { createMocks, RequestMethod } from 'node-mocks-http';
import specializationsHandler from ' @components/pages/api/nodes/[nodeId]/specializations';
import { NodeService } from ' @components/services/nodeService';
import { NodeRelationshipService } from ' @components/services/nodeRelationshipService';
import { ApiKeyValidationError, ApiResponse, NextApiRequestWithAuth } from ' @components/types/api';
import { INode, ICollection, ILinkNode } from ' @components/types/INode';
import { NextApiResponse } from 'next';

// Mock NodeService
jest.mock(' @components/services/nodeService', () => ({
  NodeService: {
    getNode: jest.fn()
  }
}));

// Mock NodeRelationshipService
jest.mock(' @components/services/nodeRelationshipService', () => ({
  NodeRelationshipService: {
    addSpecializations: jest.fn(),
    removeSpecializations: jest.fn(),
    moveSpecializations: jest.fn(),
    reorderSpecializations: jest.fn()
  }
}));

// Mock the middleware functions
jest.mock(' @components/middlewares/apiLogger', () => ({
  withApiLogger: jest.fn((handler) => handler),
}));

jest.mock(' @components/middlewares/validateApiKey', () => ({
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
          { id: 'special-node-1', title: 'Special Node 1' },
          { id: 'special-node-2', title: 'Special Node 2' }
        ]
      },
      {
        collectionName: 'secondary',
        nodes: [
          { id: 'special-node-3', title: 'Special Node 3' }
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
  return createMocks<NextApiRequestWithAuth, NextApiResponse>({
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

describe('/api/nodes/[nodeId]/specializations endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (NodeService.getNode as jest.Mock).mockResolvedValue(createTestNode());
  });

  describe('Common validations', () => {
    it('should return 400 when nodeId is missing', async () => {
      const { req, res } = createRequest('GET', undefined);
      
      await specializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
    });

    it('should return 400 when nodeId is empty', async () => {
      const { req, res } = createRequest('GET', '   ');
      
      await specializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
    });

    it('should return 404 when node does not exist', async () => {
      (NodeService.getNode as jest.Mock).mockRejectedValueOnce(new Error('Node not found'));
      
      const { req, res } = createRequest('GET', 'non-existent-node');
      
      await specializationsHandler(req, res);
      
      expectErrorResponse(res, 404, 'NODE_NOT_FOUND');
    });

    it('should return 400 when node is deleted', async () => {
      (NodeService.getNode as jest.Mock).mockResolvedValueOnce(createTestNode({ deleted: true }));
      
      const { req, res } = createRequest('GET', 'deleted-node-id');
      
      await specializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'NODE_OPERATION_ERROR');
    });

    it('should return 405 for unsupported methods', async () => {
      const { req, res } = createRequest('PATCH', 'test-node-id');
      
      await specializationsHandler(req, res);
      
      expectErrorResponse(res, 405, 'METHOD_NOT_ALLOWED');
      expect(res._getHeaders().allow).toEqual(['GET', 'POST', 'DELETE', 'PUT']);
    });
  });

  describe('GET /api/nodes/[nodeId]/specializations', () => {
    it('should return specializations for a valid node', async () => {
      const { req, res } = createRequest('GET', 'test-node-id');
      
      await specializationsHandler(req, res);
      
      const responseData = expectSuccessResponse(res);
      expect(responseData.data?.specializations).toBeDefined();
      expect(responseData.data?.specializations).toHaveLength(2);
      expect(responseData.data?.specializations?.[0].collectionName).toBe('main');
      expect(responseData.data?.specializations?.[0].nodes).toHaveLength(2);
      expect(responseData.data?.specializations?.[1].collectionName).toBe('secondary');
      expect(responseData.data?.specializations?.[1].nodes).toHaveLength(1);
    });

    // it('should handle undefined specializations property', async () => {
    //   // Create a node with undefined specializations and override the mock
    //   const nodeWithUndefinedSpecs = createTestNode({ specializations: undefined });
    //   (NodeService.getNode as jest.Mock).mockResolvedValueOnce(nodeWithUndefinedSpecs);
      
    //   const { req, res } = createRequest('GET', 'test-node-id');
      
    //   await specializationsHandler(req, res);
      
    //   const responseData = expectSuccessResponse(res);
    //   expect(responseData.data?.specializations).toBeDefined();
    //   expect(responseData.data?.specializations?.[0].collectionName).toBe('main');
    //   expect(responseData.data?.specializations?.[0].nodes).toHaveLength(0);
    // });
  });

  describe('POST /api/nodes/[nodeId]/specializations', () => {
    it('should add specializations successfully', async () => {
      const testNode = createTestNode();
      const updatedNode: INode = {
        ...testNode,
        specializations: [
          ...testNode.specializations,
          {
            collectionName: 'main',
            nodes: [
              ...testNode.specializations[0].nodes,
              { id: 'new-special-node', title: 'New Special Node' }
            ]
          }
        ]
      };
      
      (NodeRelationshipService.addSpecializations as jest.Mock).mockResolvedValueOnce(updatedNode);
      
      const requestPayload = {
        nodes: [{ id: 'new-special-node' }],
        reasoning: 'Adding a new specialization'
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await specializationsHandler(req, res);
      
      const responseData = expectSuccessResponse(res);
      expect(responseData.data?.node).toEqual(updatedNode);
      
      expect(NodeRelationshipService.addSpecializations).toHaveBeenCalledWith(
        'test-node-id',
        [{ id: 'new-special-node' }],
        'test-username',
        'Adding a new specialization',
        'main'
      );
    });

    it('should add specializations to a specific collection', async () => {
      jest.clearAllMocks();
      (NodeService.getNode as jest.Mock).mockResolvedValue(createTestNode());
      
      const testNode = createTestNode();
      const updatedNode: INode = {
        ...testNode,
        specializations: [
          ...testNode.specializations,
          {
            collectionName: 'customCollection',
            nodes: [
              { id: 'new-special-node', title: 'New Special Node' }
            ]
          }
        ]
      };
      
      (NodeRelationshipService.addSpecializations as jest.Mock).mockResolvedValueOnce(updatedNode);
      
      const requestPayload = {
        nodes: [{ id: 'new-special-node' }],
        collectionName: 'customCollection',
        reasoning: 'Adding a new specialization to custom collection'
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await specializationsHandler(req, res);
      
      const responseData = expectSuccessResponse(res);
      expect(responseData.data?.node).toEqual(updatedNode);
      
      expect(NodeRelationshipService.addSpecializations).toHaveBeenCalledWith(
        'test-node-id',
        [{ id: 'new-special-node' }],
        'test-username',
        'Adding a new specialization to custom collection',
        'customCollection'
      );
    });

    it('should return 400 when nodes array is empty', async () => {
      jest.clearAllMocks();
      (NodeService.getNode as jest.Mock).mockResolvedValue(createTestNode());
      
      const requestPayload = {
        nodes: [],
        reasoning: 'Adding empty nodes array'
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await specializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
      expect(NodeRelationshipService.addSpecializations).not.toHaveBeenCalled();
    });

    it('should return 400 when reasoning is missing', async () => {
      jest.clearAllMocks();
      (NodeService.getNode as jest.Mock).mockResolvedValue(createTestNode());
      
      const requestPayload = {
        nodes: [{ id: 'new-special-node' }]
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await specializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
      expect(NodeRelationshipService.addSpecializations).not.toHaveBeenCalled();
    });

    it('should return 400 when collection name format is invalid', async () => {
      jest.clearAllMocks();
      (NodeService.getNode as jest.Mock).mockResolvedValue(createTestNode());
      
      const requestPayload = {
        nodes: [{ id: 'new-special-node' }],
        reasoning: 'Adding with invalid collection',
        collectionName: 'Invalid Collection Name!'
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await specializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
      expect(NodeRelationshipService.addSpecializations).not.toHaveBeenCalled();
    });

    it('should return 400 when adding a self-referential specialization', async () => {
      jest.clearAllMocks();
      (NodeService.getNode as jest.Mock).mockResolvedValue(createTestNode());
      
      const requestPayload = {
        nodes: [{ id: 'test-node-id' }],
        reasoning: 'Adding self as specialization'
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await specializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'NODE_OPERATION_ERROR');
      expect(NodeRelationshipService.addSpecializations).not.toHaveBeenCalled();
    });

    it('should return 400 when adding a specialization that already exists', async () => {
      jest.clearAllMocks();
      (NodeService.getNode as jest.Mock).mockResolvedValue(createTestNode());
      
      const requestPayload = {
        nodes: [{ id: 'special-node-1' }],
        reasoning: 'Adding existing specialization'
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await specializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'NODE_OPERATION_ERROR');
      expect(NodeRelationshipService.addSpecializations).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/nodes/[nodeId]/specializations', () => {
    it('should remove specializations successfully', async () => {
      jest.clearAllMocks();
      (NodeService.getNode as jest.Mock).mockResolvedValue(createTestNode());
      
      const testNode = createTestNode();
      const updatedNode: INode = {
        ...testNode,
        specializations: [
          {
            collectionName: 'main',
            nodes: [
              { id: 'special-node-2', title: 'Special Node 2' }
            ]
          },
          ...testNode.specializations.slice(1)
        ]
      };
      
      (NodeRelationshipService.removeSpecializations as jest.Mock).mockResolvedValueOnce(updatedNode);
      
      const requestPayload = {
        nodes: [{ id: 'special-node-1' }],
        reasoning: 'Removing a specialization'
      };
      
      const { req, res } = createRequest('DELETE', 'test-node-id', requestPayload);
      
      await specializationsHandler(req, res);

      const responseData = expectSuccessResponse(res);
      expect(responseData.data?.node).toEqual(updatedNode);
      
      expect(NodeRelationshipService.removeSpecializations).toHaveBeenCalledWith(
        'test-node-id',
        [{ id: 'special-node-1' }],
        'test-username',
        'Removing a specialization'
      );
    });

    it('should return 400 when removing a non-existent specialization', async () => {
      jest.clearAllMocks();
      (NodeService.getNode as jest.Mock).mockResolvedValue(createTestNode());
      
      const requestPayload = {
        nodes: [{ id: 'non-existent-node' }],
        reasoning: 'Removing non-existent specialization'
      };
      
      const { req, res } = createRequest('DELETE', 'test-node-id', requestPayload);
      
      await specializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'NODE_OPERATION_ERROR');
      expect(NodeRelationshipService.removeSpecializations).not.toHaveBeenCalled();
    });

    it('should validate request payload', async () => {
      jest.clearAllMocks();
      (NodeService.getNode as jest.Mock).mockResolvedValue(createTestNode());
      
      const requestPayload = {
        reasoning: 'Invalid delete request'
      };
      
      const { req, res } = createRequest('DELETE', 'test-node-id', requestPayload);
      
      await specializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
      expect(NodeRelationshipService.removeSpecializations).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/nodes/[nodeId]/specializations - Move nodes', () => {
    it('should move specializations between collections successfully', async () => {
      jest.clearAllMocks();
      (NodeService.getNode as jest.Mock).mockResolvedValue(createTestNode());
      
      const testNode = createTestNode();
      const updatedNode: INode = {
        ...testNode,
        specializations: [
          {
            collectionName: 'main',
            nodes: [
              { id: 'special-node-2', title: 'Special Node 2' }
            ]
          },
          {
            collectionName: 'secondary',
            nodes: [
              { id: 'special-node-3', title: 'Special Node 3' },
              { id: 'special-node-1', title: 'Special Node 1' }
            ]
          }
        ]
      };
      
      (NodeRelationshipService.moveSpecializations as jest.Mock).mockResolvedValueOnce(updatedNode);
      
      const requestPayload = {
        nodes: [{ id: 'special-node-1' }],
        sourceCollection: 'main',
        targetCollection: 'secondary',
        reasoning: 'Moving specialization between collections'
      };
      
      const { req, res } = createRequest('PUT', 'test-node-id', requestPayload);
      
      await specializationsHandler(req, res);
      
      const responseData = expectSuccessResponse(res);
      expect(responseData.data?.node).toEqual(updatedNode);
      
      expect(NodeRelationshipService.moveSpecializations).toHaveBeenCalledWith(
        'test-node-id',
        [{ id: 'special-node-1' }],
        'main',
        'secondary',
        'test-username',
        'Moving specialization between collections'
      );
    });

    it('should return 400 when source collection does not exist', async () => {
      jest.clearAllMocks();
      (NodeService.getNode as jest.Mock).mockResolvedValue(createTestNode());
      
      const requestPayload = {
        nodes: [{ id: 'special-node-1' }],
        sourceCollection: 'nonExistentCollection',
        targetCollection: 'secondary',
        reasoning: 'Moving from non-existent collection'
      };
      
      const { req, res } = createRequest('PUT', 'test-node-id', requestPayload);
      
      await specializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'COLLECTION_OPERATION_ERROR');
      expect(NodeRelationshipService.moveSpecializations).not.toHaveBeenCalled();
    });

    it('should return 400 when target collection does not exist', async () => {
      jest.clearAllMocks();
      (NodeService.getNode as jest.Mock).mockResolvedValue(createTestNode());
      
      const requestPayload = {
        nodes: [{ id: 'special-node-1' }],
        sourceCollection: 'main',
        targetCollection: 'nonExistentCollection',
        reasoning: 'Moving to non-existent collection'
      };
      
      const { req, res } = createRequest('PUT', 'test-node-id', requestPayload);
      
      await specializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'COLLECTION_OPERATION_ERROR');
      expect(NodeRelationshipService.moveSpecializations).not.toHaveBeenCalled();
    });

    it('should return 400 when nodes do not exist in source collection', async () => {
      jest.clearAllMocks();
      (NodeService.getNode as jest.Mock).mockResolvedValue(createTestNode());
      
      const requestPayload = {
        nodes: [{ id: 'special-node-3' }],
        sourceCollection: 'main',
        targetCollection: 'secondary',
        reasoning: 'Moving node not in source collection'
      };
      
      const { req, res } = createRequest('PUT', 'test-node-id', requestPayload);
      
      await specializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'NODE_OPERATION_ERROR');
      expect(NodeRelationshipService.moveSpecializations).not.toHaveBeenCalled();
    });

    it('should validate collection name format', async () => {
      jest.clearAllMocks();
      (NodeService.getNode as jest.Mock).mockResolvedValue(createTestNode());
      
      const requestPayload = {
        nodes: [{ id: 'special-node-1' }],
        sourceCollection: 'main',
        targetCollection: 'Invalid Collection!',
        reasoning: 'Moving with invalid collection name'
      };
      
      const { req, res } = createRequest('PUT', 'test-node-id', requestPayload);
      
      await specializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
      expect(NodeRelationshipService.moveSpecializations).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/nodes/[nodeId]/specializations - Reorder nodes', () => {
    it('should reorder specializations within a collection successfully', async () => {
      jest.clearAllMocks();
      (NodeService.getNode as jest.Mock).mockResolvedValue(createTestNode());
      
      const testNode = createTestNode();
      const updatedNode: INode = {
        ...testNode,
        specializations: [
          {
            collectionName: 'main',
            nodes: [
              { id: 'special-node-2', title: 'Special Node 2' },
              { id: 'special-node-1', title: 'Special Node 1' }
            ]
          },
          testNode.specializations[1]
        ]
      };
      
      (NodeRelationshipService.reorderSpecializations as jest.Mock).mockResolvedValueOnce(updatedNode);
      
      const requestPayload = {
        nodes: [
          { id: 'special-node-1' },
          { id: 'special-node-2' }
        ],
        newIndices: [1, 0],
        reasoning: 'Reordering specializations'
      };
      
      const { req, res } = createRequest('PUT', 'test-node-id', requestPayload);
      
      await specializationsHandler(req, res);
      
      const responseData = expectSuccessResponse(res);
      expect(responseData.data?.node).toEqual(updatedNode);
      
      expect(NodeRelationshipService.reorderSpecializations).toHaveBeenCalledWith(
        'test-node-id',
        [{ id: 'special-node-1' }, { id: 'special-node-2' }],
        [1, 0],
        'main',
        'test-username',
        'Reordering specializations'
      );
    });

    it('should reorder specializations in a specific collection', async () => {
      jest.clearAllMocks();
      
      const nodeWithExtraNodes: INode = {
        ...createTestNode(),
        specializations: [
          {
            collectionName: 'main',
            nodes: [
              { id: 'special-node-1', title: 'Special Node 1' },
              { id: 'special-node-2', title: 'Special Node 2' }
            ]
          },
          {
            collectionName: 'secondary',
            nodes: [
              { id: 'special-node-3', title: 'Special Node 3' },
              { id: 'special-node-4', title: 'Special Node 4' }
            ]
          }
        ]
      };
      
      (NodeService.getNode as jest.Mock).mockResolvedValue(nodeWithExtraNodes);
      
      const updatedNode: INode = {
        ...nodeWithExtraNodes,
        specializations: [
          nodeWithExtraNodes.specializations[0],
          {
            collectionName: 'secondary',
            nodes: [
              { id: 'special-node-4', title: 'Special Node 4' },
              { id: 'special-node-3', title: 'Special Node 3' }
            ]
          }
        ]
      };
      
      (NodeRelationshipService.reorderSpecializations as jest.Mock).mockResolvedValueOnce(updatedNode);
      
      const requestPayload = {
        nodes: [
          { id: 'special-node-3' },
          { id: 'special-node-4' }
        ],
        newIndices: [1, 0],
        collectionName: 'secondary',
        reasoning: 'Reordering secondary specializations'
      };
      
      const { req, res } = createRequest('PUT', 'test-node-id', requestPayload);
      
      await specializationsHandler(req, res);
      
      const responseData = expectSuccessResponse(res);
      expect(responseData.data?.node).toEqual(updatedNode);
      
      expect(NodeRelationshipService.reorderSpecializations).toHaveBeenCalledWith(
        'test-node-id',
        [{ id: 'special-node-3' }, { id: 'special-node-4' }],
        [1, 0],
        'secondary',
        'test-username',
        'Reordering secondary specializations'
      );
    });

    it('should return 400 when collection does not exist for reordering', async () => {
      jest.clearAllMocks();
      (NodeService.getNode as jest.Mock).mockResolvedValue(createTestNode());
      
      const requestPayload = {
        nodes: [
          { id: 'special-node-1' },
          { id: 'special-node-2' }
        ],
        newIndices: [1, 0],
        collectionName: 'nonExistentCollection',
        reasoning: 'Reordering in non-existent collection'
      };
      
      const { req, res } = createRequest('PUT', 'test-node-id', requestPayload);
      
      await specializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'COLLECTION_OPERATION_ERROR');
      expect(NodeRelationshipService.reorderSpecializations).not.toHaveBeenCalled();
    });

    it('should return 400 when nodes do not exist in the collection for reordering', async () => {
      jest.clearAllMocks();
      (NodeService.getNode as jest.Mock).mockResolvedValue(createTestNode());
      
      const requestPayload = {
        nodes: [
          { id: 'special-node-1' },
          { id: 'special-node-3' } 
        ],
        newIndices: [1, 0],
        collectionName: 'main',
        reasoning: 'Reordering with node from wrong collection'
      };
      
      const { req, res } = createRequest('PUT', 'test-node-id', requestPayload);
      
      await specializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'NODE_OPERATION_ERROR');
      expect(NodeRelationshipService.reorderSpecializations).not.toHaveBeenCalled();
    });

    it('should return 400 when nodes and newIndices arrays have different lengths', async () => {
      jest.clearAllMocks();
      (NodeService.getNode as jest.Mock).mockResolvedValue(createTestNode());
      
      const requestPayload = {
        nodes: [
          { id: 'special-node-1' },
          { id: 'special-node-2' }
        ],
        newIndices: [1],
        reasoning: 'Invalid reordering'
      };
      
      const { req, res } = createRequest('PUT', 'test-node-id', requestPayload);
      
      await specializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
      expect(NodeRelationshipService.reorderSpecializations).not.toHaveBeenCalled();
    });

    it('should return 400 when newIndices contains invalid values', async () => {
      jest.clearAllMocks();
      (NodeService.getNode as jest.Mock).mockResolvedValue(createTestNode());
      
      const requestPayload = {
        nodes: [
          { id: 'special-node-1' },
          { id: 'special-node-2' }
        ],
        newIndices: [-1, 1],
        reasoning: 'Invalid reordering'
      };
      
      const { req, res } = createRequest('PUT', 'test-node-id', requestPayload);
      
      await specializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
      expect(NodeRelationshipService.reorderSpecializations).not.toHaveBeenCalled();
    });

    it('should return 400 when neither sourceCollection/targetCollection nor newIndices is provided', async () => {
      jest.clearAllMocks();
      (NodeService.getNode as jest.Mock).mockResolvedValue(createTestNode());
      
      const requestPayload = {
        nodes: [{ id: 'special-node-1' }],
        reasoning: 'Invalid PUT request'
      };
      
      const { req, res } = createRequest('PUT', 'test-node-id', requestPayload);
      
      await specializationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
      expect(NodeRelationshipService.moveSpecializations).not.toHaveBeenCalled();
      expect(NodeRelationshipService.reorderSpecializations).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle unexpected errors', async () => {
      jest.clearAllMocks();
      
      (NodeService.getNode as jest.Mock).mockImplementationOnce(() => {
        const error = new Error('Unexpected database error');
        error.name = 'NodeNotFoundError';
        throw error;
      });
      
      const { req, res } = createRequest('GET', 'test-node-id');
      
      await specializationsHandler(req, res);
      
      expectErrorResponse(res, 404, 'NODE_NOT_FOUND');
    });
    
    it('should include metadata in the response', async () => {
      const { req, res } = createRequest('GET', 'test-node-id');
      
      await specializationsHandler(req, res);
      
      const responseData = expectSuccessResponse(res);
      expect(responseData.metadata.clientId).toBe('test-client-id');
      expect(responseData.metadata.version).toBe('1.0');
    });
  });
});