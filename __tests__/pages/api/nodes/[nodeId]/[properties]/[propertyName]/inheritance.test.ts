import { createMocks, RequestMethod } from 'node-mocks-http';
import propertyInheritanceHandler from ' @components/pages/api/nodes/[nodeId]/properties/[propertyName]/inheritance';
import { NodeService } from ' @components/services/nodeService';
import { NodeInheritanceService } from ' @components/services/nodeInheritanceService';
import { ApiResponse, NextApiRequestWithAuth } from ' @components/types/api';
import { INode, INodeTypes, InheritanceType } from ' @components/types/INode';
import { NextApiResponse } from 'next';

// Mock NodeService
jest.mock(' @components/services/nodeService', () => ({
  NodeService: {
    getNode: jest.fn()
  }
}));

// Mock the NodeInheritanceService
jest.mock(' @components/services/nodeInheritanceService', () => ({
  NodeInheritanceService: {
    updatePropertyInheritance: jest.fn()
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

// Helper function to create mocked requests for property inheritance endpoints
function createPropertyInheritanceRequest(
  nodeId: string,
  propertyName: string,
  method: RequestMethod = 'GET',
  body?: any
) {
  return createMocks<NextApiRequestWithAuth, NextApiResponse>({
    method,
    query: {
      nodeId,
      propertyName
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
  expect(responseData.metadata.clientId).toBeDefined();
  expect(responseData.metadata.timestamp).toBeDefined();
  
  return responseData;
}

// Helper to verify error responses
function expectErrorResponse(
  res: any,
  expectedStatusCode: number,
  expectedErrorMessage: string,
  expectedErrorCode?: string
): ApiResponse<never> {
  expect(res.statusCode).toBe(expectedStatusCode);
  
  const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
  expect(responseData.success).toBe(false);
  expect(responseData.error).toBe(expectedErrorMessage);
  expect(responseData.metadata).toBeDefined();
  
  if (expectedErrorCode) {
    expect(responseData.code).toBe(expectedErrorCode);
  }
  
  return responseData;
}

// Example mock node data
const mockNode: INode = {
  id: 'test-node-id',
  title: 'Test Node',
  deleted: false,
  properties: {
    parts: [],
    isPartOf: [],
    description: 'Test description',
    status: 'active',
    category: 'test-category',
    tags: ['tag1', 'tag2']
  },
  inheritance: {
    description: {
      ref: 'parent-node-id',
      inheritanceType: 'inheritUnlessAlreadyOverRidden'
    },
    status: {
      ref: null,
      inheritanceType: 'alwaysInherit'
    }
  },
  specializations: [],
  generalizations: [],
  root: 'test-root',
  propertyType: { 
    'description': 'string',
    'status': 'string',
    'category': 'string',
    'tags': 'string-array'
  },
  nodeType: 'activity' as INodeTypes,
  textValue: {},
  createdBy: 'test-user',
  contributors: ['test-user']
};

describe('Property Inheritance API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementation
    (NodeService.getNode as jest.Mock).mockResolvedValue(mockNode);
  });

  //==========================================================================
  // SECTION 1: BASIC FUNCTIONALITY TESTS
  //==========================================================================
  
  describe('Basic functionality', () => {
    it('should get property inheritance information', async () => {
      const { req, res } = createPropertyInheritanceRequest('test-node-id', 'description', 'GET');

      await propertyInheritanceHandler(req, res);

      const responseData = expectSuccessResponse(res, 200) as ApiResponse<{
        propertyInheritance: {
          property: string;
          inheritance: {
            ref: string | null;
            inheritanceType: string;
          };
        }
      }>;
      
      expect(responseData.data?.propertyInheritance?.property).toBe('description');
      expect(responseData.data?.propertyInheritance?.inheritance).toEqual({
        ref: 'parent-node-id',
        inheritanceType: 'inheritUnlessAlreadyOverRidden'
      });
      
      expect(NodeService.getNode).toHaveBeenCalledWith('test-node-id');
    });

    it('should update property inheritance', async () => {
      const updatedNode = {
        ...mockNode,
        inheritance: {
          ...mockNode.inheritance,
          description: {
            ref: 'parent-node-id',
            inheritanceType: 'neverInherit'  // Changed to neverInherit
          }
        }
      };
      
      (NodeInheritanceService.updatePropertyInheritance as jest.Mock).mockResolvedValue(updatedNode);
      
      const updateRequest = {
        inheritanceType: 'neverInherit',
        reasoning: 'Testing inheritance update'
      };
      
      const { req, res } = createPropertyInheritanceRequest('test-node-id', 'description', 'PATCH', updateRequest);

      await propertyInheritanceHandler(req, res);

      const responseData = expectSuccessResponse(res, 200) as ApiResponse<{
        node: INode;
        propertyInheritance: {
          property: string;
          inheritance: any;
        }
      }>;
      
      expect(responseData.data?.node).toEqual(updatedNode);
      expect(responseData.data?.propertyInheritance?.property).toBe('description');
      expect(responseData.data?.propertyInheritance?.inheritance).toEqual({
        ref: 'parent-node-id',
        inheritanceType: 'neverInherit'
      });
      
      expect(NodeInheritanceService.updatePropertyInheritance).toHaveBeenCalledWith(
        'test-node-id',
        'description',
        'neverInherit',
        'test-username',
        'Testing inheritance update'
      );
    });

    it('should return default inheritance for property without explicit inheritance rule', async () => {
      const { req, res } = createPropertyInheritanceRequest('test-node-id', 'category', 'GET');

      await propertyInheritanceHandler(req, res);

      const responseData = expectSuccessResponse(res, 200);
      expect(responseData.data?.propertyInheritance?.property).toBe('category');
      expect(responseData.data?.propertyInheritance?.inheritance).toEqual({
        ref: null,
        inheritanceType: 'inheritUnlessAlreadyOverRidden'  // Default
      });
    });

    it('should return 405 for unsupported methods', async () => {
      const { req, res } = createPropertyInheritanceRequest('test-node-id', 'description', 'DELETE');

      await propertyInheritanceHandler(req, res);

      expectErrorResponse(res, 405, 'Method DELETE Not Allowed', 'METHOD_NOT_ALLOWED');
      
      expect(res._getHeaders().allow).toContain('GET');
      expect(res._getHeaders().allow).toContain('PATCH');
    });
  });

  //==========================================================================
  // SECTION 2: VALIDATION TESTS
  //==========================================================================
  
  describe('Input validation', () => {
    it('should return 404 when node does not exist', async () => {
      (NodeService.getNode as jest.Mock).mockRejectedValue(new Error('Node not found'));

      const { req, res } = createPropertyInheritanceRequest('non-existent-id', 'description', 'GET');

      await propertyInheritanceHandler(req, res);

      expectErrorResponse(
        res, 
        404, 
        'Node with ID "non-existent-id" not found',
        'NODE_NOT_FOUND'
      );
    });

    it('should return 404 when property does not exist', async () => {
      const { req, res } = createPropertyInheritanceRequest('test-node-id', 'non-existent-property', 'GET');

      await propertyInheritanceHandler(req, res);

      expectErrorResponse(
        res, 
        404, 
        'Property "non-existent-property" not found in node',
        'PROPERTY_NOT_FOUND'
      );
    });

    it('should return 400 when node is deleted', async () => {
      const deletedNode = {
        ...mockNode,
        deleted: true
      };
      
      (NodeService.getNode as jest.Mock).mockResolvedValue(deletedNode);
      
      const { req, res } = createPropertyInheritanceRequest('deleted-node-id', 'description', 'GET');

      await propertyInheritanceHandler(req, res);

      expectErrorResponse(
        res, 
        400, 
        'Cannot modify a deleted node',
        'NODE_OPERATION_ERROR'
      );
    });

    it('should validate nodeId parameter', async () => {
      const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
        method: 'GET',
        query: {
          nodeId: '   ',  // Empty after trimming
          propertyName: 'description'
        }
      });
      
      req.apiKeyInfo = mockApiKeyInfo;
      
      await propertyInheritanceHandler(req, res);
      
      expectErrorResponse(
        res, 
        400, 
        'Node ID cannot be empty',
        'VALIDATION_ERROR'
      );
    });

    it('should validate propertyName parameter', async () => {
      const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
        method: 'GET',
        query: {
          nodeId: 'test-node-id',
          propertyName: '   '
        }
      });
      
      req.apiKeyInfo = mockApiKeyInfo;
      
      await propertyInheritanceHandler(req, res);
      
      expectErrorResponse(
        res, 
        400, 
        'Property name cannot be empty',
        'VALIDATION_ERROR'
      );
    });
  });

  //==========================================================================
  // SECTION 3: UPDATE VALIDATION TESTS
  //==========================================================================
  
  describe('Update validation', () => {
    it('should validate inheritance type when updating', async () => {
      const invalidRequest = {
        inheritanceType: 'invalidType',
        reasoning: 'Testing validation'
      };
      
      const { req, res } = createPropertyInheritanceRequest('test-node-id', 'description', 'PATCH', invalidRequest);

      await propertyInheritanceHandler(req, res);

      expect(res.statusCode).toBe(400);
      const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('Invalid inheritanceType');
      expect(responseData.code).toBe('VALIDATION_ERROR');
    });

    it('should validate reasoning when updating', async () => {
      const invalidRequest = {
        inheritanceType: 'alwaysInherit'
        // reasoning missing
      };
      
      const { req, res } = createPropertyInheritanceRequest('test-node-id', 'description', 'PATCH', invalidRequest);

      await propertyInheritanceHandler(req, res);

      expectErrorResponse(
        res, 
        400, 
        'Reasoning must be provided as a string',
        'VALIDATION_ERROR'
      );
    });

    it('should validate empty reasoning when updating', async () => {
      const invalidRequest = {
        inheritanceType: 'alwaysInherit',
        reasoning: '   '  // Empty after trimming
      };
      
      const { req, res } = createPropertyInheritanceRequest('test-node-id', 'description', 'PATCH', invalidRequest);

      await propertyInheritanceHandler(req, res);

      expectErrorResponse(
        res, 
        400, 
        'Reasoning cannot be empty',
        'VALIDATION_ERROR'
      );
    });

    it('should validate reasoning length when updating', async () => {
      const longReasoning = 'a'.repeat(1001);  // 1001 characters (exceeds 1000 limit)
      
      const invalidRequest = {
        inheritanceType: 'alwaysInherit',
        reasoning: longReasoning
      };
      
      const { req, res } = createPropertyInheritanceRequest('test-node-id', 'description', 'PATCH', invalidRequest);

      await propertyInheritanceHandler(req, res);

      expectErrorResponse(
        res, 
        400, 
        'Reasoning must not exceed 1000 characters',
        'VALIDATION_ERROR'
      );
    });

    it('should validate request structure when updating', async () => {
      const invalidRequest = "not an object";  // String instead of object
      
      const { req, res } = createPropertyInheritanceRequest('test-node-id', 'description', 'PATCH', invalidRequest);

      await propertyInheritanceHandler(req, res);

      expectErrorResponse(
        res, 
        400, 
        'Invalid request format',
        'VALIDATION_ERROR'
      );
    });
  });

  //==========================================================================
  // SECTION 4: ERROR HANDLING TESTS
  //==========================================================================
  
  describe('Error handling', () => {
    it('should handle inheritance service errors', async () => {
      (NodeInheritanceService.updatePropertyInheritance as jest.Mock).mockRejectedValue(
        new Error('Failed to update inheritance: Property is locked')
      );
      
      const updateRequest = {
        inheritanceType: 'neverInherit',
        reasoning: 'Testing error handling'
      };
      
      const { req, res } = createPropertyInheritanceRequest('test-node-id', 'description', 'PATCH', updateRequest);

      await propertyInheritanceHandler(req, res);

      expect(res.statusCode).toBe(500);
      const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('An unexpected error occurred. Please try again later.');
      expect(responseData.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should handle inheritance operation errors properly', async () => {
      (NodeInheritanceService.updatePropertyInheritance as jest.Mock).mockImplementation(() => {
        const error = new Error('Cannot change inheritance type for this property');
        error.name = 'InheritanceOperationError';
        throw error;
      });
      
      const updateRequest = {
        inheritanceType: 'neverInherit',
        reasoning: 'Testing error handling'
      };
      
      const { req, res } = createPropertyInheritanceRequest('test-node-id', 'description', 'PATCH', updateRequest);

      await propertyInheritanceHandler(req, res);

      expect(res.statusCode).toBe(400);
      const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Cannot change inheritance type for this property');
      expect(responseData.code).toBe('INHERITANCE_OPERATION_ERROR');
    });
  });
});