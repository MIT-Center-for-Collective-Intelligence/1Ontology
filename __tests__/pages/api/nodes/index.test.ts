import { createMocks, RequestMethod } from 'node-mocks-http';
import nodeCreationHandler from ' @components/pages/api/nodes';
import { NodeService } from ' @components/services/nodeService';
import { ApiKeyValidationError, ApiResponse, NextApiRequestWithAuth } from ' @components/types/api';
import { INode, INodeTypes, ICollection } from ' @components/types/INode';
import { NextApiResponse } from 'next';

// Mock the NodeService
jest.mock(' @components/services/nodeService', () => ({
  NodeService: {
    createNode: jest.fn(),
    detectCircularReferences: jest.fn(),
    validateNoDuplicateNodeIds: jest.fn()
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

// Mock Firebase Admin
jest.mock(' @components/lib/firestoreServer/admin', () => ({
  db: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ exists: true, data: () => ({}) })
      }))
    }))
  }
}));

// Mock the ChangelogService
jest.mock(' @components/services/changelog', () => ({
  ChangelogService: {
    log: jest.fn().mockResolvedValue('mock-changelog-id')
  }
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

// Helper function to create test collections
function createTestCollection(
  collectionName: string, 
  nodeIds: string[] = []
): ICollection {
  return {
    collectionName,
    nodes: nodeIds.map(id => ({ id }))
  };
}

// Helper function to create mocked requests for node creation
function createNodeCreationRequest(
  body?: any,
  method: RequestMethod = 'POST'
) {
  return createMocks<NextApiRequestWithAuth, NextApiResponse>({
    method,
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

// Example valid node creation request
const validNodeRequest = {
  node: {
    title: "Test Node",
    nodeType: "activity" as INodeTypes,
    properties: {
      parts: [],
      isPartOf: []
    },
    inheritance: {},
    specializations: [],
    generalizations: [
      {
        collectionName: "main",
        nodes: [
          { id: "parent-node-id" }
        ]
      }
    ],
    root: "test-root",
    propertyType: {},
    textValue: {}
  },
  reasoning: "Test node creation"
};

describe('Node Creation API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    (NodeService.detectCircularReferences as jest.Mock).mockReturnValue([]);
    (NodeService.validateNoDuplicateNodeIds as jest.Mock).mockReturnValue({
      valid: true,
      generalizations: new Map(),
      specializations: new Map(),
      parts: new Map(),
      isPartOf: new Map()
    });
    
    (NodeService.createNode as jest.Mock).mockImplementation(request => {
      return Promise.resolve({
        ...request.node,
        id: 'new-node-id',
        deleted: false,
        createdBy: 'test-username',
        contributors: ['test-username'],
        contributorsByProperty: {}
      });
    });
  });

  //==========================================================================
  // SECTION 1: BASIC ENDPOINT FUNCTIONALITY TESTS
  //==========================================================================
  
  describe('Basic functionality', () => {
    it('should create a node successfully', async () => {
      const mockCreatedNode: INode = {
        ...validNodeRequest.node,
        id: 'new-node-id',
        deleted: false,
        createdBy: 'test-username',
        contributors: ['test-username'],
        contributorsByProperty: {}
      };
      
      (NodeService.createNode as jest.Mock).mockResolvedValue(mockCreatedNode);

      const { req, res } = createNodeCreationRequest(validNodeRequest);

      await nodeCreationHandler(req, res);

      const responseData = expectSuccessResponse(res, 201) as ApiResponse<{ nodeId: string; node: INode }>;
      expect(responseData.data?.nodeId).toBe('new-node-id');
      expect(responseData.data?.node).toEqual(mockCreatedNode);
      
      expect(NodeService.createNode).toHaveBeenCalledWith(
        validNodeRequest,
        'test-username'
      );
    });

    it('should return 405 for unsupported methods', async () => {
      const { req, res } = createNodeCreationRequest(validNodeRequest, 'GET');

      await nodeCreationHandler(req, res);

      expectErrorResponse(res, 405, 'Method GET Not Allowed');
      
      expect(NodeService.createNode).not.toHaveBeenCalled();
      
      expect(res._getHeaders().allow).toContain('POST');
    });
  });

  //==========================================================================
  // SECTION 2: VALIDATION TESTS
  //==========================================================================
  
  describe('Input validation', () => {
    it('should return 400 when node data is missing', async () => {
      const { req, res } = createNodeCreationRequest({
        reasoning: "Test node creation"
      });

      await nodeCreationHandler(req, res);

      expectErrorResponse(res, 400, 'Node data is required');
      
      expect(NodeService.createNode).not.toHaveBeenCalled();
    });

    it('should return 400 when reasoning is missing', async () => {
      const { req, res } = createNodeCreationRequest({
        node: validNodeRequest.node
      });

      await nodeCreationHandler(req, res);

      expectErrorResponse(res, 400, 'Reasoning is required');
      
      expect(NodeService.createNode).not.toHaveBeenCalled();
    });

    it('should return 400 when node title is missing', async () => {
      const invalidRequest = {
        ...validNodeRequest,
        node: {
          ...validNodeRequest.node,
          title: "" 
        }
      };
      
      const { req, res } = createNodeCreationRequest(invalidRequest);

      await nodeCreationHandler(req, res);

      expectErrorResponse(res, 400, 'Node title is required');
      
      expect(NodeService.createNode).not.toHaveBeenCalled();
    });

    it('should return 400 when node type is missing', async () => {
      const invalidRequest = {
        ...validNodeRequest,
        node: {
          ...validNodeRequest.node,
          nodeType: undefined 
        }
      };
      
      const { req, res } = createNodeCreationRequest(invalidRequest);

      await nodeCreationHandler(req, res);

      expectErrorResponse(res, 400, 'Node type is required');
      
      expect(NodeService.createNode).not.toHaveBeenCalled();
    });

    it('should return 400 when node type is invalid', async () => {
      const invalidRequest = {
        ...validNodeRequest,
        node: {
          ...validNodeRequest.node,
          nodeType: 'invalid-type' 
        }
      };
      
      const { req, res } = createNodeCreationRequest(invalidRequest);

      await nodeCreationHandler(req, res);

      const expectedErrorMessage = 'Invalid node type. Must be one of: activity, actor, evaluationDimension, role, incentive, reward, group, context';
      expectErrorResponse(res, 400, expectedErrorMessage);
      
      expect(NodeService.createNode).not.toHaveBeenCalled();
    });

    it('should return 400 when generalizations are missing', async () => {
      const invalidRequest = {
        ...validNodeRequest,
        node: {
          ...validNodeRequest.node,
          generalizations: []
        }
      };
      
      const { req, res } = createNodeCreationRequest(invalidRequest);

      await nodeCreationHandler(req, res);

      expectErrorResponse(res, 400, 'At least one generalization is required');
      
      expect(NodeService.createNode).not.toHaveBeenCalled();
    });

    it('should return 400 when circular references are detected', async () => {
      (NodeService.detectCircularReferences as jest.Mock).mockReturnValue(['circular-node-id']);
      
      const { req, res } = createNodeCreationRequest(validNodeRequest);

      await nodeCreationHandler(req, res);

      const expectedErrorMessage = 'Circular reference detected: Node(s) circular-node-id cannot be both a generalization and specialization of the same node';
      expectErrorResponse(res, 400, expectedErrorMessage);
      
      expect(NodeService.createNode).not.toHaveBeenCalled();
    });

    it('should return 400 when duplicate node IDs are detected', async () => {
      const mockDuplicatesResult = {
        valid: false,
        generalizations: new Map([['main', ['duplicate-node-id']]]),
        specializations: new Map(),
        parts: new Map(),
        isPartOf: new Map()
      };
      
      (NodeService.validateNoDuplicateNodeIds as jest.Mock).mockReturnValue(mockDuplicatesResult);
      
      const { req, res } = createNodeCreationRequest(validNodeRequest);

      await nodeCreationHandler(req, res);

      expect(res.statusCode).toBe(400);
      const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('Duplicate node IDs detected:');
      expect(responseData.error).toContain('Generalizations (main): duplicate-node-id');
      
      expect(NodeService.createNode).not.toHaveBeenCalled();
    });
  });
  
  //==========================================================================
  // SECTION 3: COMPLEX RELATIONSHIP TESTS
  //==========================================================================
  
  describe('Complex relationships', () => {
    it('should create a node with complex relationships', async () => {
      const complexNodeRequest = {
        node: {
          title: "Complex Test Node",
          nodeType: "activity" as INodeTypes,
          properties: {
            parts: [
              createTestCollection("TestParts", ["part-1", "part-2"])
            ],
            isPartOf: [
              createTestCollection("TestWholes", ["whole-1"])
            ]
          },
          inheritance: {},
          specializations: [
            createTestCollection("TestSpecializations", ["spec-1", "spec-2"])
          ],
          generalizations: [
            createTestCollection("TestGeneralizations", ["gen-1"])
          ],
          root: "test-root",
          propertyType: { 'description': 'string' },
          textValue: {}
        },
        reasoning: "Creating a complex test node"
      };
      
      const mockCreatedNode: INode = {
        ...complexNodeRequest.node,
        id: 'complex-node-id',
        deleted: false,
        createdBy: 'test-username',
        contributors: ['test-username'],
        contributorsByProperty: {}
      };
      
      (NodeService.createNode as jest.Mock).mockResolvedValue(mockCreatedNode);
      
      const { req, res } = createNodeCreationRequest(complexNodeRequest);
      
      await nodeCreationHandler(req, res);
      
      expect(res.statusCode).toBe(201);
      
      const responseData = JSON.parse(res._getData()) as ApiResponse<{ nodeId: string; node: INode }>;
      expect(responseData.success).toBe(true);
      expect(responseData.data?.nodeId).toBe('complex-node-id');
      expect(responseData.data?.node).toEqual(mockCreatedNode);
      
      expect(NodeService.createNode).toHaveBeenCalledWith(
        complexNodeRequest,
        'test-username'
      );
    });
    
    it('should handle empty collections gracefully', async () => {
      const requestWithEmptyCollections = {
        node: {
          title: "Node With Empty Collections",
          nodeType: "activity" as INodeTypes,
          properties: {
            parts: [{ collectionName: "EmptyParts", nodes: [] }],
            isPartOf: [{ collectionName: "EmptyWholes", nodes: [] }]
          },
          inheritance: {},
          specializations: [{ collectionName: "EmptySpecs", nodes: [] }],
          generalizations: [
            { 
              collectionName: "main", 
              nodes: [{ id: "parent-node-id" }]
            }
          ],
          root: "test-root",
          propertyType: {},
          textValue: {}
        },
        reasoning: "Testing empty collections"
      };
      
      const mockCreatedNode: INode = {
        ...requestWithEmptyCollections.node,
        id: 'empty-collections-node-id',
        deleted: false,
        createdBy: 'test-username',
        contributors: ['test-username'],
        contributorsByProperty: {}
      };
      
      (NodeService.createNode as jest.Mock).mockResolvedValue(mockCreatedNode);
      
      const { req, res } = createNodeCreationRequest(requestWithEmptyCollections);
      
      await nodeCreationHandler(req, res);
      
      expect(res.statusCode).toBe(201);
      
      expect(NodeService.createNode).toHaveBeenCalledWith(
        requestWithEmptyCollections,
        'test-username'
      );
    });
  });
  
  //==========================================================================
  // SECTION 4: ERROR HANDLING TESTS
  //==========================================================================
  
  describe('Error handling', () => {
    it('should return 500 when NodeService.createNode throws an unexpected error', async () => {
      (NodeService.createNode as jest.Mock).mockRejectedValue(new Error('Database error'));
      
      const { req, res } = createNodeCreationRequest(validNodeRequest);

      await nodeCreationHandler(req, res);

      expectErrorResponse(res, 500, 'Failed to create node');
      
      expect(NodeService.createNode).toHaveBeenCalledWith(
        validNodeRequest,
        'test-username'
      );
    });
    
    it('should handle validation errors gracefully from NodeService', async () => {
      (NodeService.createNode as jest.Mock).mockRejectedValue(
        new ApiKeyValidationError('The following specialization nodes do not exist: spec-1')
      );
      
      const invalidRequest = {
        ...validNodeRequest,
        node: {
          ...validNodeRequest.node,
          specializations: [
            { 
              collectionName: "TestSpecs", 
              nodes: [{ id: "spec-1" }]
            }
          ]
        }
      };
      
      const { req, res } = createNodeCreationRequest(invalidRequest);
      
      await nodeCreationHandler(req, res);
      
      expect(res.statusCode).toBe(400);
      
      const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('specialization nodes do not exist');
      expect(responseData.code).toBe('VALIDATION_ERROR');
    });
    
    it('should handle malformed request body', async () => {
      const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
        method: 'POST',
        body: {}
      });
      
      req.apiKeyInfo = mockApiKeyInfo;
      
      await nodeCreationHandler(req, res);
      
      expect(res.statusCode).toBe(400);
      
      const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Node data is required');
    });
  });
});