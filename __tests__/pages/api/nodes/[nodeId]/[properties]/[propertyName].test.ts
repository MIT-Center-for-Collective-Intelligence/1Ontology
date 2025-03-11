import { createMocks, RequestMethod } from 'node-mocks-http';
import specificPropertyHandler from ' @components/pages/api/nodes/[nodeId]/properties/[propertyName]';
import { NodeService } from ' @components/services/nodeService';
import { ApiResponse, NextApiRequestWithAuth } from ' @components/types/api';
import { INode, INodeTypes } from ' @components/types/INode';
import { NextApiResponse } from 'next';

// Mock the NodeService
jest.mock(' @components/services/nodeService', () => ({
  NodeService: {
    getNode: jest.fn(),
    updateNodeProperties: jest.fn()
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

// Helper function to create mocked requests for specific property endpoints
function createSpecificPropertyRequest(
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
  expectedErrorMessage: string
): ApiResponse<never> {
  expect(res.statusCode).toBe(expectedStatusCode);
  
  const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
  expect(responseData.success).toBe(false);
  expect(responseData.error).toBe(expectedErrorMessage);
  expect(responseData.metadata).toBeDefined();
  
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
    tags: ['tag1', 'tag2']
  },
  inheritance: {
    description: {
      ref: 'parent-node-id',
      inheritanceType: 'inheritUnlessAlreadyOverRidden'
    }
  },
  specializations: [],
  generalizations: [],
  root: 'test-root',
  propertyType: { 
    'description': 'string',
    'status': 'string',
    'tags': 'string-array'
  },
  nodeType: 'activity' as INodeTypes,
  textValue: {},
  createdBy: 'test-user',
  contributors: ['test-user']
};

describe('Node Specific Property API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    (NodeService.getNode as jest.Mock).mockResolvedValue(mockNode);
    (NodeService.updateNodeProperties as jest.Mock).mockResolvedValue({
      node: mockNode,
      updatedProperties: []
    });
  });

  //==========================================================================
  // SECTION 1: BASIC FUNCTIONALITY TESTS
  //==========================================================================
  
  describe('Basic functionality', () => {
    it('should get a specific property', async () => {
      const { req, res } = createSpecificPropertyRequest('test-node-id', 'description', 'GET');

      await specificPropertyHandler(req, res);

      const responseData = expectSuccessResponse(res, 200) as ApiResponse<{
        nodeId: string;
        property: string;
        value: any;
        type: string;
        inheritance: {
          ref: string | null;
          inheritanceType: string;
        };
      }>;
      
      expect(responseData.data?.nodeId).toBe('test-node-id');
      expect(responseData.data?.property).toBe('description');
      expect(responseData.data?.value).toBe('Test description');
      expect(responseData.data?.type).toBe('string');
      expect(responseData.data?.inheritance).toEqual({
        ref: 'parent-node-id',
        inheritanceType: 'inheritUnlessAlreadyOverRidden'
      });
      
      expect(NodeService.getNode).toHaveBeenCalledWith('test-node-id');
    });

    it('should delete a property', async () => {
      const nodeWithoutProperty = {
        ...mockNode,
        properties: {
          ...mockNode.properties
        }
      };
      delete nodeWithoutProperty.properties.status;
      
      (NodeService.updateNodeProperties as jest.Mock).mockResolvedValue({
        node: nodeWithoutProperty,
        updatedProperties: []
      });

      const { req, res } = createSpecificPropertyRequest('test-node-id', 'status', 'DELETE', {
        reasoning: 'Status property is no longer needed'
      });

      await specificPropertyHandler(req, res);

      const responseData = expectSuccessResponse(res, 200) as ApiResponse<{
        nodeId: string;
        property: string;
        value: any;
      }>;
      
      expect(responseData.data?.nodeId).toBe('test-node-id');
      expect(responseData.data?.property).toBe('status');
      expect(responseData.data?.value).toBe('active');
      
      expect(NodeService.updateNodeProperties).toHaveBeenCalledWith(
        'test-node-id',
        {},
        'test-username',
        'Status property is no longer needed',
        undefined,
        ['status']
      );
    });

    it('should return 405 for unsupported methods', async () => {
      const { req, res } = createSpecificPropertyRequest('test-node-id', 'description', 'PATCH');

      await specificPropertyHandler(req, res);

      expectErrorResponse(res, 405, 'Method PATCH Not Allowed');
      
      expect(res._getHeaders().allow).toContain('GET');
      expect(res._getHeaders().allow).toContain('DELETE');
    });
  });

  //==========================================================================
  // SECTION 2: VALIDATION TESTS
  //==========================================================================
  
  describe('Input validation', () => {
    it('should return 404 when node does not exist', async () => {
      (NodeService.getNode as jest.Mock).mockRejectedValue(new Error('Node not found'));

      const { req, res } = createSpecificPropertyRequest('non-existent-id', 'description', 'GET');

      await specificPropertyHandler(req, res);

      expectErrorResponse(res, 404, 'Node not found');
    });

    it('should return 404 when property does not exist', async () => {
      const { req, res } = createSpecificPropertyRequest('test-node-id', 'non-existent-property', 'GET');

      await specificPropertyHandler(req, res);

      expectErrorResponse(res, 404, "Property 'non-existent-property' not found on node");
    });

    // it('should return 401 when apiKeyInfo is missing', async () => {
    //   // Create mock request without apiKeyInfo
    //   const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
    //     method: 'GET',
    //     query: {
    //       nodeId: 'test-node-id',
    //       propertyName: 'description'
    //     }
    //   });
      
    //   // Explicitly remove apiKeyInfo
    //   delete (req as any).apiKeyInfo;
      
    //   // Call the handler
    //   await specificPropertyHandler(req, res);
      
    //   expectErrorResponse(res, 401, 'Authentication required');
    // });

    it('should require reasoning for property deletion', async () => {
      const { req, res } = createSpecificPropertyRequest('test-node-id', 'status', 'DELETE', {});

      await specificPropertyHandler(req, res);

      expectErrorResponse(res, 400, 'Reasoning is required for property deletion');
    });

    it('should prevent deletion of core properties', async () => {
      const { req, res } = createSpecificPropertyRequest('test-node-id', 'parts', 'DELETE', {
        reasoning: 'Testing core property deletion'
      });

      await specificPropertyHandler(req, res);

      expectErrorResponse(res, 400, "The 'parts' property cannot be deleted as it is a core property");
    });
  });

  //==========================================================================
  // SECTION 3: EDGE CASES
  //==========================================================================
  
  describe('Edge cases', () => {
    it('should handle getting an array property correctly', async () => {
      const { req, res } = createSpecificPropertyRequest('test-node-id', 'tags', 'GET');

      await specificPropertyHandler(req, res);

      const responseData = expectSuccessResponse(res, 200);
      expect(responseData.data.value).toEqual(['tag1', 'tag2']);
      expect(responseData.data.type).toBe('string-array');
    });

    it('should handle property with no explicit type', async () => {
      const propertyWithoutExplicitType = 'status';
      
      const modifiedNode = {
        ...mockNode,
        propertyType: {
          'description': 'string',
          'tags': 'string-array'
        }
      };
      
      (NodeService.getNode as jest.Mock).mockResolvedValue(modifiedNode);
      
      const { req, res } = createSpecificPropertyRequest('test-node-id', propertyWithoutExplicitType, 'GET');

      await specificPropertyHandler(req, res);

      const responseData = expectSuccessResponse(res, 200);
      expect(responseData.data.type).toBe('string');
    });

    it('should handle property with no explicit inheritance', async () => {
      const propertyWithoutExplicitInheritance = 'status';
      
      const { req, res } = createSpecificPropertyRequest('test-node-id', propertyWithoutExplicitInheritance, 'GET');

      await specificPropertyHandler(req, res);

      const responseData = expectSuccessResponse(res, 200);
      expect(responseData.data.inheritance).toEqual({
        ref: null,
        inheritanceType: 'inheritUnlessAlreadyOverRidden'
      });
    });

    it('should work with empty string properties', async () => {
      const nodeWithEmptyProperty = {
        ...mockNode,
        properties: {
          ...mockNode.properties,
          emptyProp: ''
        }
      };
      
      (NodeService.getNode as jest.Mock).mockResolvedValue(nodeWithEmptyProperty);
      
      const { req, res } = createSpecificPropertyRequest('test-node-id', 'emptyProp', 'GET');

      await specificPropertyHandler(req, res);

      const responseData = expectSuccessResponse(res, 200);
      expect(responseData.data.value).toBe('');
    });
  });

  //==========================================================================
  // SECTION 4: ERROR HANDLING TESTS
  //==========================================================================
  
  describe('Error handling', () => {
    it('should handle unexpected errors during property retrieval', async () => {
      (NodeService.getNode as jest.Mock).mockRejectedValue(new Error('Database connection error'));

      const { req, res } = createSpecificPropertyRequest('test-node-id', 'description', 'GET');

      await specificPropertyHandler(req, res);

      expect(res.statusCode).toBe(500);
      const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('Internal server error occurred while retrieving property');
    });

    it('should handle unexpected errors during property deletion', async () => {
      (NodeService.updateNodeProperties as jest.Mock).mockRejectedValue(new Error('Database error during deletion'));

      const { req, res } = createSpecificPropertyRequest('test-node-id', 'status', 'DELETE', {
        reasoning: 'Testing error handling'
      });

      await specificPropertyHandler(req, res);

      expect(res.statusCode).toBe(500);
      const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('Failed to delete property');
    });

    it('should handle property not found during deletion', async () => {
      const { req, res } = createSpecificPropertyRequest('test-node-id', 'non-existent-property', 'DELETE', {
        reasoning: 'Testing error handling'
      });

      await specificPropertyHandler(req, res);

      expectErrorResponse(res, 404, "Property 'non-existent-property' not found on node");
    });
  });
});