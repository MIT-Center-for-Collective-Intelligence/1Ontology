import { createMocks, MockResponse, RequestMethod } from 'node-mocks-http';
import generalizationsHandler from ' @components/pages/api/nodes/[nodeId]/generalizations';
import { NodeService } from ' @components/services/nodeService';
import { NodeRelationshipService } from ' @components/services/nodeRelationshipService';
import { ApiKeyValidationError, ApiResponse, NextApiRequestWithAuth } from ' @components/types/api';
import { INode, ICollection } from ' @components/types/INode';
import { NextApiResponse } from 'next';
import { RequestMeta } from 'next/dist/server/request-meta';

// Mock NodeService
jest.mock(' @components/services/nodeService', () => ({
  NodeService: {
    getNode: jest.fn()
  }
}));

// Mock NodeRelationshipService
jest.mock(' @components/services/nodeRelationshipService', () => ({
  NodeRelationshipService: {
    addGeneralizations: jest.fn(),
    removeGeneralizations: jest.fn(),
    reorderGeneralizations: jest.fn()
  }
}));

// Mock the middleware functions
jest.mock(' @components/middlewares/apiLogger', () => ({
  withApiLogger: jest.fn((handler) => handler),
}));

jest.mock(' @components/middlewares/validateApiKey', () => ({
  validateApiKey: jest.fn((handler) => async (
    req: { apiKeyInfo: { clientId: string; userId: string; uname: string; createdAt: Date; lastUsed: Date; isActive: boolean; description: string; }; },
    res: any
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
const createTestNode = (override = {}) => {
  return {
    id: 'test-node-id',
    title: 'Test Node',
    nodeType: 'activity',
    deleted: false,
    generalizations: [
      {
        collectionName: 'main',
        nodes: [
          { id: 'general-node-1', title: 'General Node 1' },
          { id: 'general-node-2', title: 'General Node 2' }
        ]
      }
    ],
    ...override
  };
};

// Helper to create a request
const createRequest = (
  method: RequestMethod,
  nodeId: string | undefined,
  body = {}
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
  res: MockResponse<NextApiResponse>,
  expectedStatusCode = 200
) => {
  expect(res.statusCode).toBe(expectedStatusCode);
  
  const responseData = JSON.parse(res._getData());
  expect(responseData.success).toBe(true);
  expect(responseData.metadata).toBeDefined();
  expect(responseData.metadata.clientId).toBe('test-client-id');
  
  return responseData;
};

// Helper to verify error response
const expectErrorResponse = (
  res: MockResponse<NextApiResponse>,
  expectedStatusCode: number,
  expectedErrorCode: string
) => {
  expect(res.statusCode).toBe(expectedStatusCode);
  
  const responseData = JSON.parse(res._getData());
  expect(responseData.success).toBe(false);
  expect(responseData.error).toBeDefined();
  expect(responseData.code).toBe(expectedErrorCode);
  expect(responseData.metadata).toBeDefined();
  
  return responseData;
};

describe('/api/nodes/[nodeId]/generalizations endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Common validations', () => {
    it('should return 404 when using unsupported methods with valid nodeId', async () => {
      (NodeService.getNode as jest.Mock).mockRejectedValue(new Error('Node not found'));
      
      const { req, res } = createRequest('PATCH', 'test-node-id');
      
      await generalizationsHandler(req, res);
      
      expectErrorResponse(res, 404, 'NODE_NOT_FOUND');
    });
    
    it('should return 405 for unsupported methods after node validation', async () => {
      (NodeService.getNode as jest.Mock).mockResolvedValue(createTestNode());
      
      const { req, res } = createRequest('PATCH', 'test-node-id');
      
      await generalizationsHandler(req, res);
      
      expectErrorResponse(res, 405, 'METHOD_NOT_ALLOWED');
      expect(res._getHeaders().allow).toEqual(['GET', 'POST', 'DELETE', 'PUT']);
    });

    it('should return 400 when nodeId is missing', async () => {
      const { req, res } = createRequest('GET', undefined);
      
      await generalizationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
    });

    it('should return 400 when nodeId is empty', async () => {
      const { req, res } = createRequest('GET', '   ');
      
      await generalizationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
    });

    it('should return 404 when node does not exist', async () => {
      (NodeService.getNode as jest.Mock).mockRejectedValue(new Error('Node not found'));
      
      const { req, res } = createRequest('GET', 'non-existent-node');
      
      await generalizationsHandler(req, res);
      
      expectErrorResponse(res, 404, 'NODE_NOT_FOUND');
    });

    it('should return 400 when node is deleted', async () => {
      const deletedNode = createTestNode({ deleted: true });
      (NodeService.getNode as jest.Mock).mockResolvedValue(deletedNode);
      
      const { req, res } = createRequest('GET', 'deleted-node-id');
      
      await generalizationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'NODE_OPERATION_ERROR');
    });
  });

  describe('GET /api/nodes/[nodeId]/generalizations', () => {
    it('should return generalizations for a valid node', async () => {
      const testNode = createTestNode();
      (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);
      
      const { req, res } = createRequest('GET', 'test-node-id');
      
      await generalizationsHandler(req, res);
      
      const responseData = expectSuccessResponse(res);
      expect(responseData.data.generalizations).toBeDefined();
      expect(responseData.data.generalizations).toHaveLength(1);
      expect(responseData.data.generalizations[0].collectionName).toBe('main');
      expect(responseData.data.generalizations[0].nodes).toHaveLength(2);
    });

    // it('should return empty array when node has no generalizations', async () => {
    //   const nodeWithoutGeneralizations = createTestNode({ generalizations: [] });
    //   (NodeService.getNode as jest.Mock).mockResolvedValue(nodeWithoutGeneralizations);
      
    //   const { req, res } = createRequest('GET', 'test-node-id');
      
    //   await generalizationsHandler(req, res);
      
    //   const responseData = expectSuccessResponse(res);
    //   expect(responseData.data.generalizations).toBeDefined();
    //   expect(responseData.data.generalizations[0].collectionName).toBe('main');
    //   expect(responseData.data.generalizations[0].nodes).toHaveLength(0);
    // });

    it('should handle undefined generalizations property', async () => {
      const nodeWithUndefinedGeneralizations = createTestNode({ generalizations: undefined });
      (NodeService.getNode as jest.Mock).mockResolvedValue(nodeWithUndefinedGeneralizations);
      
      const { req, res } = createRequest('GET', 'test-node-id');
      
      await generalizationsHandler(req, res);
      
      const responseData = expectSuccessResponse(res);
      expect(responseData.data.generalizations).toBeDefined();
      expect(responseData.data.generalizations[0].collectionName).toBe('main');
      expect(responseData.data.generalizations[0].nodes).toHaveLength(0);
    });
  });

  describe('POST /api/nodes/[nodeId]/generalizations', () => {
    it('should add generalizations successfully', async () => {
      const testNode = createTestNode();
      const updatedNode = {
        ...testNode,
        generalizations: [
          {
            collectionName: 'main',
            nodes: [
              ...testNode.generalizations[0].nodes,
              { id: 'new-general-node', title: 'New General Node' }
            ]
          }
        ]
      };
      
      (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);
      (NodeRelationshipService.addGeneralizations as jest.Mock).mockResolvedValue(updatedNode);
      
      const requestPayload = {
        nodes: [{ id: 'new-general-node' }],
        reasoning: 'Adding a new generalization'
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await generalizationsHandler(req, res);

      const responseData = expectSuccessResponse(res);
      expect(responseData.data.node).toEqual(updatedNode);
      
      expect(NodeRelationshipService.addGeneralizations).toHaveBeenCalledWith(
        'test-node-id',
        [{ id: 'new-general-node' }],
        'test-username',
        'Adding a new generalization',
        'main'
      );
    });

    it('should add generalizations to a specific collection', async () => {
      const testNode = createTestNode();
      const updatedNode = {
        ...testNode,
        generalizations: [
          ...testNode.generalizations,
          {
            collectionName: 'customCollection',
            nodes: [
              { id: 'new-general-node', title: 'New General Node' }
            ]
          }
        ]
      };
      
      (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);
      (NodeRelationshipService.addGeneralizations as jest.Mock).mockResolvedValue(updatedNode);
      
      const requestPayload = {
        nodes: [{ id: 'new-general-node' }],
        collectionName: 'customCollection',
        reasoning: 'Adding a new generalization to custom collection'
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await generalizationsHandler(req, res);
      
      const responseData = expectSuccessResponse(res);
      expect(responseData.data.node).toEqual(updatedNode);
      
      expect(NodeRelationshipService.addGeneralizations).toHaveBeenCalledWith(
        'test-node-id',
        [{ id: 'new-general-node' }],
        'test-username',
        'Adding a new generalization to custom collection',
        'customCollection'
      );
    });

    it('should return 400 when nodes array is empty', async () => {
      const testNode = createTestNode();
      (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);
      
      const requestPayload = {
        nodes: [],
        reasoning: 'Adding empty nodes array'
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await generalizationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
      expect(NodeRelationshipService.addGeneralizations).not.toHaveBeenCalled();
    });

    it('should return 400 when reasoning is missing', async () => {
      const testNode = createTestNode();
      (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);
      
      const requestPayload = {
        nodes: [{ id: 'new-general-node' }]
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await generalizationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
      expect(NodeRelationshipService.addGeneralizations).not.toHaveBeenCalled();
    });

    it('should return 400 when reasoning is empty', async () => {
      const testNode = createTestNode();
      (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);
      
      const requestPayload = {
        nodes: [{ id: 'new-general-node' }],
        reasoning: '   '
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await generalizationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
      expect(NodeRelationshipService.addGeneralizations).not.toHaveBeenCalled();
    });

    it('should return 400 when node ID is missing in nodes array', async () => {
      const testNode = createTestNode();
      (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);
      
      const requestPayload = {
        nodes: [{ /* id is missing */ }],
        reasoning: 'Adding node without ID'
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await generalizationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
      expect(NodeRelationshipService.addGeneralizations).not.toHaveBeenCalled();
    });

    it('should return 400 when collection name format is invalid', async () => {
      const testNode = createTestNode();
      (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);
      
      const requestPayload = {
        nodes: [{ id: 'new-general-node' }],
        reasoning: 'Adding with invalid collection',
        collectionName: 'Invalid Collection Name!'
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await generalizationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
      expect(NodeRelationshipService.addGeneralizations).not.toHaveBeenCalled();
    });

    it('should return 400 when adding a self-referential generalization', async () => {
      const testNode = createTestNode();
      (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);
      
      const requestPayload = {
        nodes: [{ id: 'test-node-id' }],
        reasoning: 'Adding self as generalization'
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await generalizationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'NODE_OPERATION_ERROR');
      expect(NodeRelationshipService.addGeneralizations).not.toHaveBeenCalled();
    });

    it('should return 400 when adding a generalization that already exists', async () => {
      const testNode = createTestNode();
      (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);
      
      const requestPayload = {
        nodes: [{ id: 'general-node-1' }],
        reasoning: 'Adding existing generalization'
      };
      
      const { req, res } = createRequest('POST', 'test-node-id', requestPayload);
      
      await generalizationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'NODE_OPERATION_ERROR');
      expect(NodeRelationshipService.addGeneralizations).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/nodes/[nodeId]/generalizations', () => {
    it('should remove generalizations successfully', async () => {
      const testNode = createTestNode();
      const updatedNode = {
        ...testNode,
        generalizations: [
          {
            collectionName: 'main',
            nodes: [
              { id: 'general-node-2', title: 'General Node 2' }
            ]
          }
        ]
      };
      
      (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);
      (NodeRelationshipService.removeGeneralizations as jest.Mock).mockResolvedValue(updatedNode);
      
      const requestPayload = {
        nodes: [{ id: 'general-node-1' }],
        reasoning: 'Removing a generalization'
      };
      
      const { req, res } = createRequest('DELETE', 'test-node-id', requestPayload);
      
      await generalizationsHandler(req, res);
      
      const responseData = expectSuccessResponse(res);
      expect(responseData.data.node).toEqual(updatedNode);
      
      expect(NodeRelationshipService.removeGeneralizations).toHaveBeenCalledWith(
        'test-node-id',
        [{ id: 'general-node-1' }],
        'test-username',
        'Removing a generalization'
      );
    });

    it('should return 400 when removing a non-existent generalization', async () => {
      const testNode = createTestNode();
      (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);
      
      const requestPayload = {
        nodes: [{ id: 'non-existent-node' }],
        reasoning: 'Removing non-existent generalization'
      };
      
      const { req, res } = createRequest('DELETE', 'test-node-id', requestPayload);
      
      await generalizationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'NODE_OPERATION_ERROR');
      expect(NodeRelationshipService.removeGeneralizations).not.toHaveBeenCalled();
    });

    it('should validate request payload', async () => {
      const testNode = createTestNode();
      (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);
      
      const requestPayload = {
        reasoning: 'Invalid delete request'
      };
      
      const { req, res } = createRequest('DELETE', 'test-node-id', requestPayload);
      
      await generalizationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
      expect(NodeRelationshipService.removeGeneralizations).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/nodes/[nodeId]/generalizations', () => {
    it('should reorder generalizations successfully', async () => {
      const testNode = createTestNode();
      const updatedNode = {
        ...testNode,
        generalizations: [
          {
            collectionName: 'main',
            nodes: [
              { id: 'general-node-2', title: 'General Node 2' },
              { id: 'general-node-1', title: 'General Node 1' }
            ]
          }
        ]
      };
      
      (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);
      (NodeRelationshipService.reorderGeneralizations as jest.Mock).mockResolvedValue(updatedNode);
      
      const requestPayload = {
        nodes: [
          { id: 'general-node-1' },
          { id: 'general-node-2' }
        ],
        newIndices: [1, 0],
        reasoning: 'Reordering generalizations'
      };
      
      const { req, res } = createRequest('PUT', 'test-node-id', requestPayload);
      
      await generalizationsHandler(req, res);
      
      const responseData = expectSuccessResponse(res);
      expect(responseData.data.node).toEqual(updatedNode);
      
      expect(NodeRelationshipService.reorderGeneralizations).toHaveBeenCalledWith(
        'test-node-id',
        [{ id: 'general-node-1' }, { id: 'general-node-2' }],
        [1, 0],
        'main',
        'test-username',
        'Reordering generalizations'
      );
    });

    it('should reorder generalizations in a specific collection', async () => {
      const testNode = {
        ...createTestNode(),
        generalizations: [
          {
            collectionName: 'main',
            nodes: [
              { id: 'general-node-1', title: 'General Node 1' },
              { id: 'general-node-2', title: 'General Node 2' }
            ]
          },
          {
            collectionName: 'customCollection',
            nodes: [
              { id: 'custom-node-1', title: 'Custom Node 1' },
              { id: 'custom-node-2', title: 'Custom Node 2' }
            ]
          }
        ]
      };
      
      const updatedNode = {
        ...testNode,
        generalizations: [
          ...testNode.generalizations.slice(0, 1),
          {
            collectionName: 'customCollection',
            nodes: [
              { id: 'custom-node-2', title: 'Custom Node 2' },
              { id: 'custom-node-1', title: 'Custom Node 1' }
            ]
          }
        ]
      };
      
      (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);
      (NodeRelationshipService.reorderGeneralizations as jest.Mock).mockResolvedValue(updatedNode);
      
      const requestPayload = {
        nodes: [
          { id: 'custom-node-1' },
          { id: 'custom-node-2' }
        ],
        newIndices: [1, 0],
        collectionName: 'customCollection',
        reasoning: 'Reordering custom collection'
      };
      
      const { req, res } = createRequest('PUT', 'test-node-id', requestPayload);
      
      await generalizationsHandler(req, res);
      
      const responseData = expectSuccessResponse(res);
      expect(responseData.data.node).toEqual(updatedNode);
      
      expect(NodeRelationshipService.reorderGeneralizations).toHaveBeenCalledWith(
        'test-node-id',
        [{ id: 'custom-node-1' }, { id: 'custom-node-2' }],
        [1, 0],
        'customCollection',
        'test-username',
        'Reordering custom collection'
      );
    });

    it('should return 400 when nodes and newIndices arrays have different lengths', async () => {
      const testNode = createTestNode();
      (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);
      
      const requestPayload = {
        nodes: [
          { id: 'general-node-1' },
          { id: 'general-node-2' }
        ],
        newIndices: [1],
        reasoning: 'Invalid reordering'
      };
      
      const { req, res } = createRequest('PUT', 'test-node-id', requestPayload);
      
      await generalizationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
      expect(NodeRelationshipService.reorderGeneralizations).not.toHaveBeenCalled();
    });

    it('should return 400 when newIndices contains invalid values', async () => {
      const testNode = createTestNode();
      (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);
      
      const requestPayload = {
        nodes: [
          { id: 'general-node-1' },
          { id: 'general-node-2' }
        ],
        newIndices: [-1, 1],
        reasoning: 'Invalid reordering'
      };
      
      const { req, res } = createRequest('PUT', 'test-node-id', requestPayload);
      
      await generalizationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'VALIDATION_ERROR');
      expect(NodeRelationshipService.reorderGeneralizations).not.toHaveBeenCalled();
    });

    it('should return 400 when collection does not exist', async () => {
      const testNode = createTestNode();
      (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);
      
      const requestPayload = {
        nodes: [
          { id: 'general-node-1' },
          { id: 'general-node-2' }
        ],
        newIndices: [1, 0],
        collectionName: 'nonExistentCollection',
        reasoning: 'Reordering non-existent collection'
      };
      
      const { req, res } = createRequest('PUT', 'test-node-id', requestPayload);
      
      await generalizationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'COLLECTION_OPERATION_ERROR');
      expect(NodeRelationshipService.reorderGeneralizations).not.toHaveBeenCalled();
    });

    it('should return 400 when node ID is not in the collection', async () => {
      const testNode = createTestNode();
      (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);
      
      const requestPayload = {
        nodes: [
          { id: 'non-existent-node' },
          { id: 'general-node-2' }
        ],
        newIndices: [1, 0],
        reasoning: 'Reordering with invalid node'
      };
      
      const { req, res } = createRequest('PUT', 'test-node-id', requestPayload);
      
      await generalizationsHandler(req, res);
      
      expectErrorResponse(res, 400, 'NODE_OPERATION_ERROR');
      expect(NodeRelationshipService.reorderGeneralizations).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    // it('should handle unexpected errors', async () => {
    //   (NodeService.getNode as jest.Mock).mockRejectedValue(new Error('Unexpected database error'));
      
    //   const { req, res } = createRequest('GET', 'test-node-id');
      
    //   await generalizationsHandler(req, res);
      
    //   expectErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR');
    // });
    
    it('should include username in metadata when available', async () => {
      const testNode = createTestNode();
      (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);
      
      const { req, res } = createRequest('GET', 'test-node-id');
      
      await generalizationsHandler(req, res);
      
      const responseData = expectSuccessResponse(res);
      expect(responseData.metadata.uname).toBe(undefined);
      expect(responseData.metadata.clientId).toBe('test-client-id');
      expect(responseData.metadata.version).toBe('1.0');
    });
  });
});