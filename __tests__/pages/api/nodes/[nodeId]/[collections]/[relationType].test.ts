import { createMocks, RequestMethod } from 'node-mocks-http';
import collectionsHandler from ' @components/pages/api/nodes/[nodeId]/collections/[relationType]';
import { NodeService } from ' @components/services/nodeService';
import { NodeRelationshipService } from ' @components/services/nodeRelationshipService';
import { ApiKeyValidationError, ApiResponse, NextApiRequestWithAuth } from ' @components/types/api';
import { INode, ICollection } from ' @components/types/INode';
import { NextApiResponse } from 'next';

// Mock the NodeService
jest.mock(' @components/services/nodeService', () => ({
  NodeService: {
    getNode: jest.fn()
  }
}));

// Mock the NodeRelationshipService
jest.mock(' @components/services/nodeRelationshipService', () => ({
  NodeRelationshipService: {
    createCollection: jest.fn(),
    createMultipleCollections: jest.fn(),
    deleteCollection: jest.fn()
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

// Standard mock API key info used in tests
export const mockApiKeyInfo = {
  clientId: 'test-client-id',
  userId: 'test-user-id',
  uname: 'test-username',
  createdAt: new Date(),
  lastUsed: new Date(),
  isActive: true,
  description: 'Test API Key'
};

// Helper function to create mocked requests
function createRequest(
  method: RequestMethod = 'GET',
  body?: any,
  query?: any
) {
  return createMocks<NextApiRequestWithAuth, NextApiResponse>({
    method,
    body,
    query: {
      nodeId: 'test-node-id',
      relationType: 'specializations',
      ...query
    },
    headers: {
      'content-type': 'application/json'
    }
  });
}

// Helper to verify success responses
function expectSuccessResponse(
  res: any,
  expectedStatusCode: number
): ApiResponse<any> {
  expect(res.statusCode).toBe(expectedStatusCode);
  
  const responseData = JSON.parse(res._getData()) as ApiResponse<any>;
  expect(responseData.success).toBe(true);
  expect(responseData.metadata).toBeDefined();
  expect(responseData.metadata.clientId).toBeDefined();
  expect(responseData.metadata.timestamp).toBeDefined();
  
  return responseData;
}

// Helper to verify error responses
function expectErrorResponse(
  res: any,
  expectedStatusCode: number,
  expectedErrorMessage: string
): ApiResponse<never> {
  expect(res.statusCode).toBe(expectedStatusCode);
  
  const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
  expect(responseData.success).toBe(false);
  expect(responseData.error).toBe(expectedErrorMessage);
  expect(responseData.metadata).toBeDefined();
  
  return responseData;
}

describe('Collections API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementation for getNode
    (NodeService.getNode as jest.Mock).mockImplementation((nodeId) => {
      return Promise.resolve({
        id: nodeId,
        title: 'Test Node',
        nodeType: 'activity',
        specializations: [
          { collectionName: 'main', nodes: [{ id: 'spec-1' }, { id: 'spec-2' }] },
          { collectionName: 'custom', nodes: [{ id: 'spec-3' }] }
        ],
        generalizations: [
          { collectionName: 'main', nodes: [{ id: 'gen-1' }] }
        ],
        deleted: false,
        createdBy: 'test-creator',
        contributors: ['test-creator'],
        contributorsByProperty: {}
      });
    });
  });

  //==========================================================================
  // SECTION 1: BASIC ENDPOINT FUNCTIONALITY TESTS
  //==========================================================================
  
  describe('GET method', () => {
    it('should retrieve collections for a node successfully', async () => {
      const { req, res } = createRequest('GET');

      await collectionsHandler(req, res);

      const responseData = expectSuccessResponse(res, 200);
      expect(responseData.data?.collections).toHaveLength(2);
      expect(responseData.data?.collections?.[0].collectionName).toBe('main');
      expect(responseData.data?.collections?.[1].collectionName).toBe('custom');
      
      expect(NodeService.getNode).toHaveBeenCalledWith('test-node-id');
    });

    it('should return collections for generalizations when specified', async () => {
      const { req, res } = createRequest('GET', undefined, { relationType: 'generalizations' });

      await collectionsHandler(req, res);

      const responseData = expectSuccessResponse(res, 200);
      expect(responseData.data?.collections).toHaveLength(1);
      expect(responseData.data?.collections?.[0].collectionName).toBe('main');
      
      expect(NodeService.getNode).toHaveBeenCalledWith('test-node-id');
    });

    it('should handle errors from NodeService', async () => {
      (NodeService.getNode as jest.Mock).mockRejectedValue(new Error('Database error'));
      
      const { req, res } = createRequest('GET');

      await collectionsHandler(req, res);

      expectErrorResponse(res, 500, 'Failed to retrieve specializations collections.');
    });
  });

  //==========================================================================
  // SECTION 2: POST METHOD TESTS (CREATE COLLECTION)
  //==========================================================================
  
  describe('POST method', () => {
    it('should create a new collection successfully', async () => {
      const mockUpdatedNode: INode = {
        id: 'test-node-id',
        title: 'Test Node',
        nodeType: 'activity',
        specializations: [
          { collectionName: 'main', nodes: [{ id: 'spec-1' }, { id: 'spec-2' }] },
          { collectionName: 'custom', nodes: [{ id: 'spec-3' }] },
          { collectionName: 'new-collection', nodes: [] }
        ],
        generalizations: [
          { collectionName: 'main', nodes: [{ id: 'gen-1' }] }
        ],
        deleted: false,
        createdBy: 'test-creator',
        contributors: ['test-creator', 'test-username'],
        contributorsByProperty: {},
        properties: {
          parts: [],
          isPartOf: []
        },
        inheritance: {},
        root: '',
        propertyType: {},
        textValue: {}
      };
      
      (NodeRelationshipService.createCollection as jest.Mock).mockResolvedValue(mockUpdatedNode);
      
      const { req, res } = createRequest('POST', {
        collectionName: 'new-collection',
        reasoning: 'Testing new collection creation'
      });

      await collectionsHandler(req, res);

      const responseData = expectSuccessResponse(res, 201);
      expect(responseData.data?.node).toEqual(mockUpdatedNode);
      
      expect(NodeRelationshipService.createCollection).toHaveBeenCalledWith(
        'test-node-id',
        'specializations',
        'new-collection',
        'test-client-id',
        'Testing new collection creation'
      );
    });

    it('should return 400 when collection name is missing', async () => {
      const { req, res } = createRequest('POST', {
        reasoning: 'Testing with missing collection name'
      });

      await collectionsHandler(req, res);

      expectErrorResponse(res, 400, 'Collection name is required.');
      
      expect(NodeRelationshipService.createCollection).not.toHaveBeenCalled();
    });

    it('should return 400 when reasoning is missing', async () => {
      const { req, res } = createRequest('POST', {
        collectionName: 'new-collection'
      });

      await collectionsHandler(req, res);

      expectErrorResponse(res, 400, 'Reasoning is required.');
      
      expect(NodeRelationshipService.createCollection).not.toHaveBeenCalled();
    });

    it('should return 400 when trying to create a collection named "main"', async () => {
      const { req, res } = createRequest('POST', {
        collectionName: 'main',
        reasoning: 'Testing with reserved name'
      });

      await collectionsHandler(req, res);

      expectErrorResponse(res, 400, 'Cannot create a collection named "main" as it is reserved.');
      
      expect(NodeRelationshipService.createCollection).not.toHaveBeenCalled();
    });

    it('should handle validation errors from service', async () => {
      (NodeRelationshipService.createCollection as jest.Mock).mockRejectedValue(
        new ApiKeyValidationError('Collection "new-collection" already exists')
      );
      
      const { req, res } = createRequest('POST', {
        collectionName: 'new-collection',
        reasoning: 'Testing validation error'
      });

      await collectionsHandler(req, res);

      expect(res.statusCode).toBe(400);
      const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Collection "new-collection" already exists');
      expect(responseData.code).toBe('VALIDATION_ERROR');
    });
  });

  //==========================================================================
  // SECTION 3: PUT METHOD TESTS (CREATE MULTIPLE COLLECTIONS)
  //==========================================================================
  
  describe('PUT method', () => {
    it('should create multiple collections successfully', async () => {
      const mockUpdatedNode: INode = {
        id: 'test-node-id',
        title: 'Test Node',
        nodeType: 'activity',
        specializations: [
          { collectionName: 'main', nodes: [{ id: 'spec-1' }, { id: 'spec-2' }] },
          { collectionName: 'custom', nodes: [{ id: 'spec-3' }] },
          { collectionName: 'collection1', nodes: [] },
          { collectionName: 'collection2', nodes: [] }
        ],
        generalizations: [
          { collectionName: 'main', nodes: [{ id: 'gen-1' }] }
        ],
        deleted: false,
        createdBy: 'test-creator',
        contributors: ['test-creator', 'test-username'],
        contributorsByProperty: {},
        properties: {
          parts: [],
          isPartOf: []
        },
        inheritance: {},
        root: '',
        propertyType: {},
        textValue: {}
      };
      
      (NodeRelationshipService.createMultipleCollections as jest.Mock).mockResolvedValue(mockUpdatedNode);
      
      const { req, res } = createRequest('PUT', {
        collections: ['collection1', 'collection2'],
        reasoning: 'Testing multiple collection creation'
      });

      await collectionsHandler(req, res);

      const responseData = expectSuccessResponse(res, 201);
      expect(responseData.data?.node).toEqual(mockUpdatedNode);
      
      expect(NodeRelationshipService.createMultipleCollections).toHaveBeenCalledWith(
        'test-node-id',
        'specializations',
        ['collection1', 'collection2'],
        'test-client-id',
        'Testing multiple collection creation'
      );
    });

    it('should return 400 when collections array is missing', async () => {
      const { req, res } = createRequest('PUT', {
        reasoning: 'Testing with missing collections'
      });

      await collectionsHandler(req, res);

      expectErrorResponse(res, 400, 'Please provide at least one collection name.');
      
      expect(NodeRelationshipService.createMultipleCollections).not.toHaveBeenCalled();
    });

    it('should return 400 when collections array is empty', async () => {
      const { req, res } = createRequest('PUT', {
        collections: [],
        reasoning: 'Testing with empty collections array'
      });

      await collectionsHandler(req, res);

      expectErrorResponse(res, 400, 'Please provide at least one collection name.');
      
      expect(NodeRelationshipService.createMultipleCollections).not.toHaveBeenCalled();
    });

    it('should return 400 when reasoning is missing', async () => {
      const { req, res } = createRequest('PUT', {
        collections: ['collection1', 'collection2']
      });

      await collectionsHandler(req, res);

      expectErrorResponse(res, 400, 'Reasoning is required.');
      
      expect(NodeRelationshipService.createMultipleCollections).not.toHaveBeenCalled();
    });
  });

  //==========================================================================
  // SECTION 4: DELETE METHOD TESTS
  //==========================================================================
  
  describe('DELETE method', () => {
    it('should delete a collection successfully', async () => {
      const mockUpdatedNode: INode = {
        id: 'test-node-id',
        title: 'Test Node',
        nodeType: 'activity',
        specializations: [
          { collectionName: 'main', nodes: [{ id: 'spec-1' }, { id: 'spec-2' }] }
        ],
        generalizations: [
          { collectionName: 'main', nodes: [{ id: 'gen-1' }] }
        ],
        deleted: false,
        createdBy: 'test-creator',
        contributors: ['test-creator', 'test-username'],
        contributorsByProperty: {},
        properties: {
          parts: [],
          isPartOf: []
        },
        inheritance: {},
        root: '',
        propertyType: {},
        textValue: {}
      };
      
      (NodeRelationshipService.deleteCollection as jest.Mock).mockResolvedValue(mockUpdatedNode);
      
      const { req, res } = createRequest('DELETE', {
        collectionName: 'custom',
        reasoning: 'Testing collection deletion'
      });

      await collectionsHandler(req, res);

      const responseData = expectSuccessResponse(res, 200);
      expect(responseData.data?.node).toEqual(mockUpdatedNode);
      
      expect(NodeRelationshipService.deleteCollection).toHaveBeenCalledWith(
        'test-node-id',
        'specializations',
        'custom',
        'test-client-id',
        'Testing collection deletion'
      );
    });

    it('should return 400 when collection name is missing', async () => {
      const { req, res } = createRequest('DELETE', {
        reasoning: 'Testing with missing collection name'
      });

      await collectionsHandler(req, res);

      expectErrorResponse(res, 400, 'Collection name is required.');
      
      expect(NodeRelationshipService.deleteCollection).not.toHaveBeenCalled();
    });

    it('should return 400 when reasoning is missing', async () => {
      const { req, res } = createRequest('DELETE', {
        collectionName: 'custom'
      });

      await collectionsHandler(req, res);

      expectErrorResponse(res, 400, 'Reasoning is required.');
      
      expect(NodeRelationshipService.deleteCollection).not.toHaveBeenCalled();
    });

    it('should return 400 when trying to delete the "main" collection', async () => {
      const { req, res } = createRequest('DELETE', {
        collectionName: 'main',
        reasoning: 'Testing deletion of reserved collection'
      });

      await collectionsHandler(req, res);

      expectErrorResponse(res, 400, 'Cannot delete the "main" collection as it is required.');
      
      expect(NodeRelationshipService.deleteCollection).not.toHaveBeenCalled();
    });

    it('should handle errors when collection has nodes', async () => {
      (NodeRelationshipService.deleteCollection as jest.Mock).mockRejectedValue(
        new ApiKeyValidationError('Cannot delete collection "custom" because it contains nodes')
      );
      
      const { req, res } = createRequest('DELETE', {
        collectionName: 'custom',
        reasoning: 'Testing deletion error'
      });

      await collectionsHandler(req, res);

      expect(res.statusCode).toBe(400);
      const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Cannot delete collection "custom" because it contains nodes');
      expect(responseData.code).toBe('VALIDATION_ERROR');
    });
  });

  //==========================================================================
  // SECTION 5: VALIDATION TESTS
  //==========================================================================
  
  describe('Input validation', () => {
    it('should return 400 when node ID is missing', async () => {
      const { req, res } = createRequest('GET', undefined, { nodeId: undefined });

      await collectionsHandler(req, res);

      expectErrorResponse(res, 400, 'Invalid node ID. Please provide a valid node identifier.');
    });

    it('should return 400 when relation type is missing', async () => {
      const { req, res } = createRequest('GET', undefined, { relationType: undefined });

      await collectionsHandler(req, res);

      expectErrorResponse(res, 400, 'Relation type is required (specializations or generalizations).');
    });

    it('should return 400 for invalid relation type', async () => {
      const { req, res } = createRequest('GET', undefined, { relationType: 'invalidType' });

      await collectionsHandler(req, res);

      expectErrorResponse(res, 400, 'Invalid relation type.');
    });

    it('should return 405 for unsupported methods', async () => {
      const { req, res } = createRequest('PATCH');

      await collectionsHandler(req, res);

      expectErrorResponse(res, 405, 'Method PATCH Not Allowed');
      expect(res._getHeaders().allow).toEqual(['GET', 'POST', 'PUT', 'DELETE']);
    });
  });

  //==========================================================================
  // SECTION 6: ERROR HANDLING TESTS
  //==========================================================================
  
  describe('Error handling', () => {
    it('should return 500 when an unexpected error occurs', async () => {
      (NodeService.getNode as jest.Mock).mockImplementation(() => {
        throw new Error('Unexpected server error');
      });
      
      const { req, res } = createRequest('GET');

      await collectionsHandler(req, res);

      expectErrorResponse(res, 500, 'Failed to retrieve specializations collections.');
    });
  });
});