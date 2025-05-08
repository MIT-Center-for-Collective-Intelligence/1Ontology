import { createMocks, RequestMethod } from 'node-mocks-http';
import isPartOfHandler from ' @components/pages/api/nodes/[nodeId]/isPartOf';
import { NodeService } from ' @components/services/nodeService';
import { NodePartsService } from ' @components/services/nodePartsService';
import { ApiKeyValidationError, ApiResponse, NextApiRequestWithAuth } from ' @components/types/api';
import { ICollection, ILinkNode, INode, INodeTypes } from ' @components/types/INode';
import { NextApiResponse } from 'next';

// Mock the NodeService
jest.mock(' @components/services/nodeService', () => ({
  NodeService: {
    getNode: jest.fn()
  }
}));

// Mock the NodePartsService
jest.mock(' @components/services/nodePartsService', () => ({
  NodePartsService: {
    addIsPartOf: jest.fn(),
    removeIsPartOf: jest.fn(),
    reorderIsPartOf: jest.fn()
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

// Get access to the inner method handler for testing without middleware
const methodHandler = (isPartOfHandler as any).__wrapped || isPartOfHandler;

// Standard mock API key info used in tests
const mockApiKeyInfo = {
  clientId: 'test-client-id',
  userId: 'test-user-id',
  uname: 'test-username',
  createdAt: new Date(),
  lastUsed: new Date(),
  isActive: true,
  description: 'Test API Key'
};

// Factory function to create a test node with customizable properties
function createTestNode(override: Partial<INode> = {}): INode {
  return {
    id: 'test-node-id',
    title: 'Test Node',
    deleted: false,
    properties: {
      parts: [{ collectionName: 'main', nodes: [] }],
      isPartOf: [{ collectionName: 'main', nodes: [] }]
    },
    inheritance: {},
    specializations: [],
    generalizations: [],
    root: 'test-root',
    propertyType: { 'description': 'string' },
    nodeType: 'activity' as INodeTypes,
    textValue: {},
    createdBy: 'test-user',
    ...override
  };
}

// Factory function to create a link node
function createLinkNode(id: string, title: string = 'Link Node'): ILinkNode {
  return { id, title };
}

// Factory function to create a collection
function createCollection(collectionName: string, nodes: ILinkNode[] = []): ICollection {
  return { collectionName, nodes };
}

// Helper function to create mocked requests with auth info for isPartOf endpoints
function createIsPartOfRequest(
  method: RequestMethod,
  nodeId: string,
  body?: any,
  query?: Record<string, string>
) {
  return createMocks<NextApiRequestWithAuth, NextApiResponse>({
    method,
    query: {
      nodeId,
      ...query
    },
    body,
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
  expect(responseData.metadata.clientId).toBe('test-client-id');
  expect(responseData.metadata.timestamp).toBeDefined();
  
  return responseData;
}

// Helper to verify error responses with option for partial message matching
function expectErrorResponse(
  res: any,
  expectedStatusCode: number,
  expectedErrorMessage: string,
  expectedErrorCode?: string,
  exactMatch: boolean = true
): ApiResponse<never> {
  expect(res.statusCode).toBe(expectedStatusCode);
  
  const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
  expect(responseData.success).toBe(false);
  
  if (exactMatch) {
    expect(responseData.error).toBe(expectedErrorMessage);
  } else {
    expect(responseData.error).toContain(expectedErrorMessage);
  }
  
  if (expectedErrorCode) {
    expect(responseData.code).toBe(expectedErrorCode);
  }
  
  expect(responseData.metadata).toBeDefined();
  
  return responseData;
}

describe('Node "isPartOf" API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mocks that can be overridden in specific tests
    (NodeService.getNode as jest.Mock).mockResolvedValue(createTestNode());
  });

  //==========================================================================
  // SECTION 1: BASIC ENDPOINT FUNCTIONALITY TESTS
  //==========================================================================
  
  describe('Basic functionality', () => {
    it('should reject unsupported HTTP methods', async () => {
      const { req, res } = createIsPartOfRequest('PATCH', 'test-node-id');
      
      await isPartOfHandler(req, res);
      
      expectErrorResponse(
        res, 
        405, 
        'Method PATCH Not Allowed',
        'METHOD_NOT_ALLOWED'
      );
      
      const allowHeader = res._getHeaders().allow;
      expect(Array.isArray(allowHeader) ? allowHeader : [allowHeader]).toContain('GET');
      expect(Array.isArray(allowHeader) ? allowHeader : [allowHeader]).toContain('POST');
      expect(Array.isArray(allowHeader) ? allowHeader : [allowHeader]).toContain('DELETE');
      expect(Array.isArray(allowHeader) ? allowHeader : [allowHeader]).toContain('PUT');
    });
    
    it('should handle preflight OPTIONS requests', async () => {
      const { req, res } = createIsPartOfRequest('OPTIONS', 'test-node-id');
      
      await isPartOfHandler(req, res);
      
      expect(res.statusCode).toBe(405);
      
      const allowHeader = res._getHeaders().allow;
      expect(Array.isArray(allowHeader) ? allowHeader : [allowHeader]).toContain('GET');
      expect(Array.isArray(allowHeader) ? allowHeader : [allowHeader]).toContain('POST');
      expect(Array.isArray(allowHeader) ? allowHeader : [allowHeader]).toContain('DELETE');
      expect(Array.isArray(allowHeader) ? allowHeader : [allowHeader]).toContain('PUT');
    });
    
    it('should reject requests with empty nodeId', async () => {
      const { req, res } = createIsPartOfRequest('GET', '');
      
      await isPartOfHandler(req, res);
      
      expectErrorResponse(
        res, 
        400, 
        'Node ID must be provided as a string',
        'VALIDATION_ERROR'
      );
    });
    
    it('should handle case where node is deleted', async () => {
      (NodeService.getNode as jest.Mock).mockResolvedValue(createTestNode({
        deleted: true
      }));
      
      const { req, res } = createIsPartOfRequest('GET', 'deleted-node-id');
      
      await isPartOfHandler(req, res);
      
      expectErrorResponse(
        res, 
        400, 
        'Cannot modify a deleted node',
        'NODE_OPERATION_ERROR'
      );
    });
  });

  //==========================================================================
  // SECTION 2: GET ENDPOINT TESTS
  //==========================================================================
  
  describe('GET Endpoint', () => {
    it('should return the isPartOf collections when node exists', async () => {
      const isPartOfCollections = [
        createCollection('main', [
          createLinkNode('container-1', 'Container 1'),
          createLinkNode('container-2', 'Container 2')
        ]),
        createCollection('custom', [
          createLinkNode('container-3', 'Container 3')
        ])
      ];
      
      const testNode = createTestNode({
        properties: {
          parts: [{ collectionName: 'main', nodes: [] }],
          isPartOf: isPartOfCollections
        }
      });
      
      (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);
  
      const { req, res } = createIsPartOfRequest('GET', 'test-node-id');
  
      await isPartOfHandler(req, res);
  
      const responseData = expectSuccessResponse(res, 200) as ApiResponse<{ containers: ICollection[] }>;
      expect(responseData.data?.containers).toEqual(isPartOfCollections);
      
      expect(NodeService.getNode).toHaveBeenCalledWith('test-node-id');
    });
  
    it('should handle node not found error', async () => {
      (NodeService.getNode as jest.Mock).mockRejectedValue(new Error('Node not found'));
  
      const { req, res } = createIsPartOfRequest('GET', 'non-existent-node-id');
  
      await isPartOfHandler(req, res);
  
      expectErrorResponse(res, 404, 'Node with ID "non-existent-node-id" not found', 'NODE_NOT_FOUND');
    });
  
    it('should handle server error during retrieval', async () => {
      (NodeService.getNode as jest.Mock).mockRejectedValue(new Error('Database connection error'));
  
      const { req, res } = createIsPartOfRequest('GET', 'test-node-id');
  
      await isPartOfHandler(req, res);
  
      expectErrorResponse(
        res, 
        404,
        'Node with ID \"test-node-id\" not found',
        'NODE_NOT_FOUND'
      );
    });
  });

  //==========================================================================
  // SECTION 3: POST ENDPOINT TESTS
  //==========================================================================
  
  describe('POST Endpoint', () => {
    it('should add node to container nodes', async () => {
      const testNode = createTestNode();
      
      (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);
      
      const containersToAdd = [
        createLinkNode('container-1'),
        createLinkNode('container-2')
      ];
      
      const updatedNode = createTestNode({
        properties: {
          parts: [{ collectionName: 'main', nodes: [] }],
          isPartOf: [{
            collectionName: 'main',
            nodes: containersToAdd
          }]
        }
      });
      
      (NodePartsService.addIsPartOf as jest.Mock).mockResolvedValue(updatedNode);
      
      const { req, res } = createIsPartOfRequest('POST', 'test-node-id', {
        nodes: containersToAdd,
        reasoning: 'Adding test containers'
      });
      
      await isPartOfHandler(req, res);
      
      const responseData = expectSuccessResponse(res, 200) as ApiResponse<{ node: INode }>;
      expect(responseData.data?.node).toEqual(updatedNode);
      
      expect(NodePartsService.addIsPartOf).toHaveBeenCalledWith(
        'test-node-id',
        containersToAdd,
        'test-username',
        'Adding test containers',
        'main'
      );
    });
  
    it('should add node to a specific collection', async () => {
      const testNode = createTestNode();
      
      (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);
      
      const containersToAdd = [
        createLinkNode('container-1')
      ];
      
      const updatedNode = createTestNode({
        properties: {
          parts: [{ collectionName: 'main', nodes: [] }],
          isPartOf: [{
            collectionName: 'custom',
            nodes: containersToAdd
          }]
        }
      });
      
      (NodePartsService.addIsPartOf as jest.Mock).mockResolvedValue(updatedNode);
      
      const { req, res } = createIsPartOfRequest('POST', 'test-node-id', {
        nodes: containersToAdd,
        collectionName: 'custom',
        reasoning: 'Adding to custom collection'
      });
      
      await isPartOfHandler(req, res);
      
      const responseData = expectSuccessResponse(res, 200) as ApiResponse<{ node: INode }>;
      expect(responseData.data?.node).toEqual(updatedNode);
      
      expect(NodePartsService.addIsPartOf).toHaveBeenCalledWith(
        'test-node-id',
        containersToAdd,
        'test-username',
        'Adding to custom collection',
        'custom'
      );
    });

    it('should reject invalid request format', async () => {
      const { req, res } = createIsPartOfRequest('POST', 'test-node-id', {
        reasoning: 'Invalid request'
      });
      
      await isPartOfHandler(req, res);
      
      expectErrorResponse(res, 400, 'Nodes must be provided as an array', 'VALIDATION_ERROR');
      
      expect(NodePartsService.addIsPartOf).not.toHaveBeenCalled();
    });
  
    it('should reject self-reference', async () => {
      const { req, res } = createIsPartOfRequest('POST', 'test-node-id', {
        nodes: [{ id: 'test-node-id' }],
        reasoning: 'Invalid self-reference'
      });
      
      await isPartOfHandler(req, res);
      
      expectErrorResponse(res, 400, 'A node cannot be a part of itself', 'NODE_OPERATION_ERROR');
      
      expect(NodePartsService.addIsPartOf).not.toHaveBeenCalled();
    });
  
    it('should reject adding to already existing container', async () => {
      const existingContainers = [
        createLinkNode('existing-container', 'Existing Container')
      ];
      
      const testNode = createTestNode({
        properties: {
          parts: [{ collectionName: 'main', nodes: [] }],
          isPartOf: [{
            collectionName: 'main',
            nodes: existingContainers
          }]
        }
      });
      
      (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);
      
      const { req, res } = createIsPartOfRequest('POST', 'test-node-id', {
        nodes: [{ id: 'existing-container' }],
        reasoning: 'Adding duplicate container'
      });
      
      await isPartOfHandler(req, res);
      
      expectErrorResponse(
        res, 
        400, 
        'This node is already a part of the following nodes: existing-container',
        'NODE_OPERATION_ERROR',
        false
      );
      
      expect(NodePartsService.addIsPartOf).not.toHaveBeenCalled();
    });
  
    it('should handle node not found error during verification', async () => {
      (NodeService.getNode as jest.Mock).mockRejectedValue(new Error('Node not found'));
      
      const { req, res } = createIsPartOfRequest('POST', 'non-existent-node-id', {
        nodes: [{ id: 'container-1' }],
        reasoning: 'Adding to non-existent node'
      });
      
      await isPartOfHandler(req, res);
      
      expectErrorResponse(res, 404, 'Node with ID "non-existent-node-id" not found', 'NODE_NOT_FOUND');
      
      expect(NodePartsService.addIsPartOf).not.toHaveBeenCalled();
    });
  });

  //==========================================================================
  // SECTION 4: DELETE ENDPOINT TESTS
  //==========================================================================
  
  describe('DELETE Endpoint', () => {
    it('should remove node from container nodes', async () => {
      const existingContainers = [
        createLinkNode('container-1', 'Container 1'),
        createLinkNode('container-2', 'Container 2')
      ];
      
      const testNode = createTestNode({
        properties: {
          parts: [{ collectionName: 'main', nodes: [] }],
          isPartOf: [{
            collectionName: 'main',
            nodes: existingContainers
          }]
        }
      });
      
      (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);
      
      const containersToRemove = [
        { id: 'container-1' }
      ];
      
      const updatedNode = createTestNode({
        properties: {
          parts: [{ collectionName: 'main', nodes: [] }],
          isPartOf: [{
            collectionName: 'main',
            nodes: [createLinkNode('container-2', 'Container 2')]
          }]
        }
      });
      
      (NodePartsService.removeIsPartOf as jest.Mock).mockResolvedValue(updatedNode);
      
      const { req, res } = createIsPartOfRequest('DELETE', 'test-node-id', {
        nodes: containersToRemove,
        reasoning: 'Removing container relationship'
      });
      
      await isPartOfHandler(req, res);
      
      const responseData = expectSuccessResponse(res, 200) as ApiResponse<{ node: INode }>;
      expect(responseData.data?.node).toEqual(updatedNode);
      
      expect(NodePartsService.removeIsPartOf).toHaveBeenCalledWith(
        'test-node-id',
        containersToRemove,
        'test-username',
        'Removing container relationship'
      );
    });
  
    it('should reject removing from non-existing container', async () => {
      const existingContainers = [
        createLinkNode('container-1', 'Container 1')
      ];
      
      const testNode = createTestNode({
        properties: {
          parts: [{ collectionName: 'main', nodes: [] }],
          isPartOf: [{
            collectionName: 'main',
            nodes: existingContainers
          }]
        }
      });
      
      (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);
      
      const { req, res } = createIsPartOfRequest('DELETE', 'test-node-id', {
        nodes: [{ id: 'non-existing-container' }],
        reasoning: 'Removing non-existing container'
      });
      
      await isPartOfHandler(req, res);
      
      expectErrorResponse(
        res, 
        400, 
        'This node is not a part of the following nodes: non-existing-container',
        'NODE_OPERATION_ERROR'
      );
      
      expect(NodePartsService.removeIsPartOf).not.toHaveBeenCalled();
    });
  
    it('should handle validation errors in request data', async () => {
      const { req, res } = createIsPartOfRequest('DELETE', 'test-node-id', {
        nodes: [{ id: 'container-1' }]
      });
      
      await isPartOfHandler(req, res);
      
      expectErrorResponse(res, 400, 'Reasoning must be provided as a string', 'VALIDATION_ERROR');
      
      expect(NodePartsService.removeIsPartOf).not.toHaveBeenCalled();
    });
  });

  //==========================================================================
  // SECTION 5: PUT ENDPOINT TESTS
  //==========================================================================
  
  describe('PUT Endpoint', () => {
    it('should reorder isPartOf container nodes', async () => {
      const existingContainers = [
        createLinkNode('container-1', 'Container 1'),
        createLinkNode('container-2', 'Container 2'),
        createLinkNode('container-3', 'Container 3')
      ];
      
      const testNode = createTestNode({
        properties: {
          parts: [{ collectionName: 'main', nodes: [] }],
          isPartOf: [{
            collectionName: 'main',
            nodes: existingContainers
          }]
        }
      });
      
      (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);
      
      const nodesToReorder = [
        { id: 'container-3' }
      ];
      const newIndices = [0];
      
      const reorderedContainers = [
        createLinkNode('container-3', 'Container 3'),
        createLinkNode('container-1', 'Container 1'),
        createLinkNode('container-2', 'Container 2')
      ];
      
      const updatedNode = createTestNode({
        properties: {
          parts: [{ collectionName: 'main', nodes: [] }],
          isPartOf: [{
            collectionName: 'main',
            nodes: reorderedContainers
          }]
        }
      });
      
      (NodePartsService.reorderIsPartOf as jest.Mock).mockResolvedValue(updatedNode);
      
      const { req, res } = createIsPartOfRequest('PUT', 'test-node-id', {
        nodes: nodesToReorder,
        newIndices: newIndices,
        reasoning: 'Reordering container relationships'
      });
      
      await isPartOfHandler(req, res);
      
      const responseData = expectSuccessResponse(res, 200) as ApiResponse<{ node: INode }>;
      expect(responseData.data?.node).toEqual(updatedNode);
      
      expect(NodePartsService.reorderIsPartOf).toHaveBeenCalledWith(
        'test-node-id',
        nodesToReorder,
        newIndices,
        'main',
        'test-username',
        'Reordering container relationships'
      );
    });
  
    it('should reorder isPartOf in a specific collection', async () => {
      const mainContainers = [createLinkNode('container-1'), createLinkNode('container-2')];
      const customContainers = [createLinkNode('container-3'), createLinkNode('container-4')];
      
      const testNode = createTestNode({
        properties: {
          parts: [{ collectionName: 'main', nodes: [] }],
          isPartOf: [
            { collectionName: 'main', nodes: mainContainers },
            { collectionName: 'custom', nodes: customContainers }
          ]
        }
      });
      
      (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);
      
      const nodesToReorder = [
        { id: 'container-4' }
      ];
      const newIndices = [0];
      
      const reorderedCustomContainers = [
        createLinkNode('container-4'),
        createLinkNode('container-3')
      ];
      
      const updatedNode = createTestNode({
        properties: {
          parts: [{ collectionName: 'main', nodes: [] }],
          isPartOf: [
            { collectionName: 'main', nodes: mainContainers },
            { collectionName: 'custom', nodes: reorderedCustomContainers }
          ]
        }
      });
      
      (NodePartsService.reorderIsPartOf as jest.Mock).mockResolvedValue(updatedNode);
      
      const { req, res } = createIsPartOfRequest('PUT', 'test-node-id', {
        nodes: nodesToReorder,
        newIndices: newIndices,
        collectionName: 'custom',
        reasoning: 'Reordering custom collection'
      });
      
      await isPartOfHandler(req, res);
      
      const responseData = expectSuccessResponse(res, 200) as ApiResponse<{ node: INode }>;
      expect(responseData.data?.node).toEqual(updatedNode);
      
      expect(NodePartsService.reorderIsPartOf).toHaveBeenCalledWith(
        'test-node-id',
        nodesToReorder,
        newIndices,
        'custom',
        'test-username',
        'Reordering custom collection'
      );
    });
  
    it('should reject reordering with mismatched nodes and indices arrays', async () => {
      const { req, res } = createIsPartOfRequest('PUT', 'test-node-id', {
        nodes: [{ id: 'container-1' }, { id: 'container-2' }],
        newIndices: [0],
        reasoning: 'Invalid reordering request'
      });
      
      await isPartOfHandler(req, res);
      
      expectErrorResponse(
        res, 
        400, 
        'newIndices must be an array with the same length as nodes',
        'VALIDATION_ERROR'
      );
      
      expect(NodePartsService.reorderIsPartOf).not.toHaveBeenCalled();
    });
  
    it('should reject reordering non-existent nodes', async () => {
      const existingContainers = [
        createLinkNode('container-1', 'Container 1'),
        createLinkNode('container-2', 'Container 2')
      ];
      
      const testNode = createTestNode({
        properties: {
          parts: [{ collectionName: 'main', nodes: [] }],
          isPartOf: [{
            collectionName: 'main',
            nodes: existingContainers
          }]
        }
      });
      
      (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);
      
      (NodePartsService.reorderIsPartOf as jest.Mock).mockRejectedValue(
        new Error('Node non-existent-container not found in collection main')
      );
      
      const { req, res } = createIsPartOfRequest('PUT', 'test-node-id', {
        nodes: [{ id: 'non-existent-container' }],
        newIndices: [0],
        reasoning: 'Reordering non-existent container'
      });
      
      await isPartOfHandler(req, res);
      
      expectErrorResponse(
        res, 
        400,
        'Node non-existent-container not found in isPartOf collection \"main\"',
        'NODE_OPERATION_ERROR'
      );
    });
  });

  //==========================================================================
  // SECTION 6: COMPLEX ERROR HANDLING TESTS
  //==========================================================================
  
  describe('Complex Error Handling', () => {
    it('should handle circular reference detection', async () => {
      (NodeService.getNode as jest.Mock).mockImplementation(async (id) => {
        if (id === 'test-node-id') {
          return createTestNode();
        } else if (id === 'container-id') {
          return createTestNode({
            id: 'container-id',
            properties: {
              parts: [{
                collectionName: 'main',
                nodes: [{ id: 'test-node-id', title: 'Test Node' }]
              }],
              isPartOf: []
            }
          });
        }
        throw new Error('Node with ID "' + id + '" not found');
      });
      
      const { req, res } = createIsPartOfRequest('POST', 'test-node-id', {
        nodes: [{ id: 'container-id' }],
        reasoning: 'Creating circular reference'
      });
      
      await isPartOfHandler(req, res);
      
      expectErrorResponse(
        res, 
        400, 
        'circular reference',
        'NODE_OPERATION_ERROR',
        false
      );
      
      expect(NodePartsService.addIsPartOf).not.toHaveBeenCalled();
    });
    
    it('should handle node validation errors properly', async () => {
      (NodePartsService.addIsPartOf as jest.Mock).mockRejectedValue(
        new ApiKeyValidationError('Validation error from service')
      );
      
      const { req, res } = createIsPartOfRequest('POST', 'test-node-id', {
        nodes: [{ id: 'container-1' }],
        reasoning: 'Test reasoning'
      });
      
      await isPartOfHandler(req, res);
      
      expectErrorResponse(
        res, 
        400, 
        'Validation error from service',
        'VALIDATION_ERROR'
      );
    });
  });
});