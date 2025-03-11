import { createMocks, RequestMethod } from 'node-mocks-http';
import nodePropertiesHandler from ' @components/pages/api/nodes/[nodeId]/properties';
import { NodeService } from ' @components/services/nodeService';
import { ApiKeyValidationError, ApiResponse, NextApiRequestWithAuth } from ' @components/types/api';
import { INode, INodeTypes } from ' @components/types/INode';
import { NextApiResponse } from 'next';

jest.mock(' @components/services/nodeService', () => ({
  NodeService: {
    getNode: jest.fn(),
    addNodeProperty: jest.fn(),
    updateNodeProperties: jest.fn()
  }
}));

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

// Helper function to create mocked requests for properties endpoints
function createPropertiesRequest(
  nodeId: string,
  method: RequestMethod = 'GET',
  body?: any
) {
  return createMocks<NextApiRequestWithAuth, NextApiResponse>({
    method,
    query: {
      nodeId
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
    category: 'test-category',
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
    'category': 'string',
    'tags': 'string-array'
  },
  nodeType: 'activity' as INodeTypes,
  textValue: {},
  createdBy: 'test-user',
  contributors: ['test-user']
};

describe('Node Properties API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    (NodeService.getNode as jest.Mock).mockResolvedValue(mockNode);
  });

  //==========================================================================
  // SECTION 1: BASIC FUNCTIONALITY TESTS
  //==========================================================================
  
  describe('Basic functionality', () => {
    it('should get all node properties', async () => {
      const { req, res } = createPropertiesRequest('test-node-id', 'GET');

      await nodePropertiesHandler(req, res);

      const responseData = expectSuccessResponse(res, 200) as ApiResponse<{
        nodeId: string;
        properties: Array<{
          name: string;
          value: any;
          type: string;
          inheritance: {
            ref: string | null;
            inheritanceType: string;
          };
        }>;
      }>;
      
      expect(responseData.data?.nodeId).toBe('test-node-id');
      expect(responseData.data?.properties).toHaveLength(6); // parts, isPartOf, description, status, category, tags
      
      const descriptionProp = responseData.data?.properties.find((p: { name: string; }) => p.name === 'description');
      expect(descriptionProp).toBeDefined();
      expect(descriptionProp?.value).toBe('Test description');
      expect(descriptionProp?.type).toBe('string');
      expect(descriptionProp?.inheritance.inheritanceType).toBe('inheritUnlessAlreadyOverRidden');
      
      expect(NodeService.getNode).toHaveBeenCalledWith('test-node-id');
    });

    it('should create a new property', async () => {
      const updatedNode = {
        ...mockNode,
        properties: {
          ...mockNode.properties,
          priority: 'high'
        },
        propertyType: {
          ...mockNode.propertyType,
          priority: 'string'
        }
      };
      
      (NodeService.addNodeProperty as jest.Mock).mockResolvedValue(updatedNode);
      
      const propertyRequest = {
        propertyName: 'priority',
        value: 'high',
        propertyType: 'string',
        reasoning: 'Added priority for tracking'
      };
      
      const { req, res } = createPropertiesRequest('test-node-id', 'POST', propertyRequest);

      await nodePropertiesHandler(req, res);

      const responseData = expectSuccessResponse(res, 201) as ApiResponse<{
        nodeId: string;
        property: string;
        value: any;
        node: INode;
      }>;
      
      expect(responseData.data?.nodeId).toBe('test-node-id');
      expect(responseData.data?.property).toBe('priority');
      expect(responseData.data?.value).toBe('high');
      expect(responseData.data?.node).toEqual(updatedNode);
      
      expect(NodeService.addNodeProperty).toHaveBeenCalledWith(
        'test-node-id',
        'priority',
        'high',
        'test-username',
        'Added priority for tracking',
        undefined, // inheritanceType not specified
        'string'
      );
    });

    it('should update multiple properties', async () => {
      const updatedNode = {
        ...mockNode,
        properties: {
          ...mockNode.properties,
          description: 'Updated description',
          status: 'completed'
        }
      };
      
      (NodeService.updateNodeProperties as jest.Mock).mockResolvedValue({
        node: updatedNode,
        updatedProperties: ['description', 'status']
      });
      
      const batchUpdateRequest = {
        updates: [
          { propertyName: 'description', value: 'Updated description' },
          { propertyName: 'status', value: 'completed' }
        ],
        reasoning: 'Updating properties for completion'
      };
      
      const { req, res } = createPropertiesRequest('test-node-id', 'PATCH', batchUpdateRequest);

      await nodePropertiesHandler(req, res);

      const responseData = expectSuccessResponse(res, 200) as ApiResponse<{
        nodeId: string;
        updateResults: Array<{
          propertyName: string;
          success: boolean;
          value: any;
        }>;
        node: INode;
      }>;
      
      expect(responseData.data?.nodeId).toBe('test-node-id');
      expect(responseData.data?.updateResults).toHaveLength(2);
      expect(responseData.data?.updateResults[0].propertyName).toBe('description');
      expect(responseData.data?.updateResults[0].success).toBe(true);
      expect(responseData.data?.updateResults[0].value).toBe('Updated description');
      expect(responseData.data?.updateResults[1].propertyName).toBe('status');
      expect(responseData.data?.updateResults[1].success).toBe(true);
      expect(responseData.data?.updateResults[1].value).toBe('completed');
      expect(responseData.data?.node).toEqual(updatedNode);
      
      expect(NodeService.updateNodeProperties).toHaveBeenCalledWith(
        'test-node-id',
        {
          description: 'Updated description',
          status: 'completed'
        },
        'test-username',
        'Updating properties for completion',
        {}, // No inheritance updates
        undefined, // No properties to delete
        undefined // No property type updates
      );
    });

    it('should return 405 for unsupported methods', async () => {
      const { req, res } = createPropertiesRequest('test-node-id', 'DELETE');

      await nodePropertiesHandler(req, res);

      expectErrorResponse(res, 405, 'Method DELETE Not Allowed');
      
      expect(res._getHeaders().allow).toContain('GET');
      expect(res._getHeaders().allow).toContain('POST');
      expect(res._getHeaders().allow).toContain('PATCH');
    });
  });

  //==========================================================================
  // SECTION 2: VALIDATION TESTS
  //==========================================================================
  
  describe('Input validation', () => {
    it('should return 404 when node does not exist', async () => {
      (NodeService.getNode as jest.Mock).mockRejectedValue(new Error('Node not found'));

      const { req, res } = createPropertiesRequest('non-existent-id', 'GET');

      await nodePropertiesHandler(req, res);

      expectErrorResponse(res, 404, 'Node not found');
    });

    // it('should return 401 when apiKeyInfo is missing', async () => {
    //   const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
    //     method: 'GET',
    //     query: {
    //       nodeId: 'test-node-id'
    //     }
    //   });
      
    //   // Explicitly remove apiKeyInfo
    //   delete (req as any).apiKeyInfo;
      
    //   await nodePropertiesHandler(req, res);
      
    //   expectErrorResponse(res, 401, 'Authentication required');
    // });

    it('should validate property name when creating property', async () => {
      const invalidRequest = {
        value: 'test value',
        reasoning: 'Testing validation'
      };
      
      const { req, res } = createPropertiesRequest('test-node-id', 'POST', invalidRequest);

      await nodePropertiesHandler(req, res);

      expectErrorResponse(res, 400, 'Property name is required');
    });

    it('should validate property value when creating property', async () => {
      const invalidRequest = {
        propertyName: 'testProperty',
        reasoning: 'Testing validation'
      };
      
      const { req, res } = createPropertiesRequest('test-node-id', 'POST', invalidRequest);

      await nodePropertiesHandler(req, res);

      expectErrorResponse(res, 400, 'Property value is required');
    });

    it('should validate reasoning when creating property', async () => {
      const invalidRequest = {
        propertyName: 'testProperty',
        value: 'test value'
      };
      
      const { req, res } = createPropertiesRequest('test-node-id', 'POST', invalidRequest);

      await nodePropertiesHandler(req, res);

      expectErrorResponse(res, 400, 'Reasoning is required');
    });

    it('should validate property type when creating property', async () => {
      const invalidRequest = {
        propertyName: 'testProperty',
        value: 'test value',
        propertyType: 'invalid-type',
        reasoning: 'Testing validation'
      };
      
      const { req, res } = createPropertiesRequest('test-node-id', 'POST', invalidRequest);

      await nodePropertiesHandler(req, res);

      expect(res.statusCode).toBe(400);
      const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('Invalid property type');
    });

    it('should validate inheritance type when creating property', async () => {
      const invalidRequest = {
        propertyName: 'testProperty',
        value: 'test value',
        inheritanceType: 'invalid-inheritance',
        reasoning: 'Testing validation'
      };
      
      const { req, res } = createPropertiesRequest('test-node-id', 'POST', invalidRequest);

      await nodePropertiesHandler(req, res);

      expectErrorResponse(res, 400, 'Invalid inheritance type');
    });

    it('should prevent creating reserved properties', async () => {
      const invalidRequest = {
        propertyName: 'id',
        value: 'custom-id',
        reasoning: 'Testing validation'
      };
      
      const { req, res } = createPropertiesRequest('test-node-id', 'POST', invalidRequest);

      await nodePropertiesHandler(req, res);

      expect(res.statusCode).toBe(400);
      const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain("reserved and cannot be used");
    });

    it('should validate type matching when creating property', async () => {
      const invalidRequest = {
        propertyName: 'priorities',
        value: 'not an array',
        propertyType: 'string-array',
        reasoning: 'Testing validation'
      };
      
      const { req, res } = createPropertiesRequest('test-node-id', 'POST', invalidRequest);

      await nodePropertiesHandler(req, res);

      expect(res.statusCode).toBe(400);
      const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('Type mismatch');
    });

    it('should validate batch update request structure', async () => {
      const invalidRequest = {
        reasoning: 'Testing validation'
      };
      
      const { req, res } = createPropertiesRequest('test-node-id', 'PATCH', invalidRequest);

      await nodePropertiesHandler(req, res);

      expect(res.statusCode).toBe(400);
      const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('At least one property update is required');
    });

    it('should validate property existence in batch updates', async () => {
      const invalidRequest = {
        updates: [
          { propertyName: 'nonExistentProperty', value: 'test value' }
        ],
        reasoning: 'Testing validation'
      };
      
      const { req, res } = createPropertiesRequest('test-node-id', 'PATCH', invalidRequest);

      await nodePropertiesHandler(req, res);

      expect(res.statusCode).toBe(400);
      const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('does not exist on node');
    });

    it('should validate for duplicate property names in batch updates', async () => {
      const invalidRequest = {
        updates: [
          { propertyName: 'description', value: 'First value' },
          { propertyName: 'description', value: 'Second value' }
        ],
        reasoning: 'Testing validation'
      };
      
      const { req, res } = createPropertiesRequest('test-node-id', 'PATCH', invalidRequest);

      await nodePropertiesHandler(req, res);

      expect(res.statusCode).toBe(400);
      const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('Duplicate property names');
    });
  });

  //==========================================================================
  // SECTION 3: COMPLEX CASES
  //==========================================================================
  
  describe('Complex cases', () => {
    it('should create property with inheritance type', async () => {
      const updatedNode = {
        ...mockNode,
        properties: {
          ...mockNode.properties,
          priority: 'high'
        },
        propertyType: {
          ...mockNode.propertyType,
          priority: 'string'
        },
        inheritance: {
          ...mockNode.inheritance,
          priority: {
            ref: null,
            inheritanceType: 'neverInherit'
          }
        }
      };
      
      (NodeService.addNodeProperty as jest.Mock).mockResolvedValue(updatedNode);
      
      const propertyRequest = {
        propertyName: 'priority',
        value: 'high',
        propertyType: 'string',
        inheritanceType: 'neverInherit',
        reasoning: 'Added priority with inheritance rule'
      };
      
      const { req, res } = createPropertiesRequest('test-node-id', 'POST', propertyRequest);

      await nodePropertiesHandler(req, res);
      
      expect(NodeService.addNodeProperty).toHaveBeenCalledWith(
        'test-node-id',
        'priority',
        'high',
        'test-username',
        'Added priority with inheritance rule',
        'neverInherit',
        'string'
      );
    });

    it('should update properties with inheritance rules', async () => {
      const updatedNode = {
        ...mockNode,
        properties: {
          ...mockNode.properties,
          description: 'Updated description',
          status: 'completed'
        },
        inheritance: {
          ...mockNode.inheritance,
          status: {
            ref: null,
            inheritanceType: 'alwaysInherit'
          }
        }
      };
      
      (NodeService.updateNodeProperties as jest.Mock).mockResolvedValue({
        node: updatedNode,
        updatedProperties: ['description', 'status']
      });
      
      const batchUpdateRequest = {
        updates: [
          { propertyName: 'description', value: 'Updated description' },
          { 
            propertyName: 'status', 
            value: 'completed',
            inheritanceType: 'alwaysInherit'
          }
        ],
        reasoning: 'Updating properties with inheritance'
      };
      
      const { req, res } = createPropertiesRequest('test-node-id', 'PATCH', batchUpdateRequest);

      await nodePropertiesHandler(req, res);

      const responseData = expectSuccessResponse(res, 200);
      
      expect(NodeService.updateNodeProperties).toHaveBeenCalledWith(
        'test-node-id',
        {
          description: 'Updated description',
          status: 'completed'
        },
        'test-username',
        'Updating properties with inheritance',
        {
          status: 'alwaysInherit'
        },
        undefined,
        undefined
      );
    });

    it('should handle creating array properties', async () => {
      const updatedNode = {
        ...mockNode,
        properties: {
          ...mockNode.properties,
          priorities: ['high', 'medium', 'low']
        },
        propertyType: {
          ...mockNode.propertyType,
          priorities: 'string-array'
        }
      };
      
      (NodeService.addNodeProperty as jest.Mock).mockResolvedValue(updatedNode);
      
      const propertyRequest = {
        propertyName: 'priorities',
        value: ['high', 'medium', 'low'],
        propertyType: 'string-array',
        reasoning: 'Added priorities list'
      };
      
      const { req, res } = createPropertiesRequest('test-node-id', 'POST', propertyRequest);

      await nodePropertiesHandler(req, res);

      const responseData = expectSuccessResponse(res, 201);
      expect(responseData.data.value).toEqual(['high', 'medium', 'low']);
      
      expect(NodeService.addNodeProperty).toHaveBeenCalledWith(
        'test-node-id',
        'priorities',
        ['high', 'medium', 'low'],
        'test-username',
        'Added priorities list',
        undefined,
        'string-array'
      );
    });

    it('should handle creating object properties', async () => {
      const metadata = { author: 'Test Author', version: '1.0' };
      const updatedNode = {
        ...mockNode,
        properties: {
          ...mockNode.properties,
          metadata
        },
        propertyType: {
          ...mockNode.propertyType,
          metadata: 'object'
        }
      };
      
      (NodeService.addNodeProperty as jest.Mock).mockResolvedValue(updatedNode);
      
      const propertyRequest = {
        propertyName: 'metadata',
        value: metadata,
        propertyType: 'object',
        reasoning: 'Added metadata object'
      };
      
      const { req, res } = createPropertiesRequest('test-node-id', 'POST', propertyRequest);

      await nodePropertiesHandler(req, res);

      const responseData = expectSuccessResponse(res, 201);
      expect(responseData.data.value).toEqual(metadata);
      
      expect(NodeService.addNodeProperty).toHaveBeenCalledWith(
        'test-node-id',
        'metadata',
        metadata,
        'test-username',
        'Added metadata object',
        undefined,
        'object'
      );
    });
  });

  //==========================================================================
  // SECTION 4: ERROR HANDLING TESTS
  //==========================================================================
  
  describe('Error handling', () => {
    it('should handle property creation conflict', async () => {
      (NodeService.addNodeProperty as jest.Mock).mockRejectedValue(
        new Error("Property 'priority' already exists on node")
      );
      
      const propertyRequest = {
        propertyName: 'priority',
        value: 'high',
        reasoning: 'Testing conflict handling'
      };
      
      const { req, res } = createPropertiesRequest('test-node-id', 'POST', propertyRequest);

      await nodePropertiesHandler(req, res);

      expect(res.statusCode).toBe(409);
      const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('already exists');
    });

    it('should handle validation errors from NodeService', async () => {
      (NodeService.addNodeProperty as jest.Mock).mockRejectedValue(
        new ApiKeyValidationError('Invalid property format')
      );
      
      const propertyRequest = {
        propertyName: 'testProperty',
        value: 'test value',
        reasoning: 'Testing error handling'
      };
      
      const { req, res } = createPropertiesRequest('test-node-id', 'POST', propertyRequest);

      await nodePropertiesHandler(req, res);

      expect(res.statusCode).toBe(400);
      const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Invalid property format');
      expect(responseData.code).toBe('VALIDATION_ERROR');
    });

    it('should handle unexpected errors during property creation', async () => {
      (NodeService.addNodeProperty as jest.Mock).mockRejectedValue(
        new Error('Database connection error')
      );
      
      const propertyRequest = {
        propertyName: 'testProperty',
        value: 'test value',
        reasoning: 'Testing error handling'
      };
      
      const { req, res } = createPropertiesRequest('test-node-id', 'POST', propertyRequest);

      await nodePropertiesHandler(req, res);

      expect(res.statusCode).toBe(500);
      const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Failed to create property');
    });

    it('should handle unexpected errors during batch update', async () => {
      (NodeService.updateNodeProperties as jest.Mock).mockRejectedValue(
        new Error('Database error during update')
      );
      
      const batchUpdateRequest = {
        updates: [
          { propertyName: 'description', value: 'Updated description' }
        ],
        reasoning: 'Testing error handling'
      };
      
      const { req, res } = createPropertiesRequest('test-node-id', 'PATCH', batchUpdateRequest);

      await nodePropertiesHandler(req, res);

      expect(res.statusCode).toBe(500);
      const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Failed to update properties');
    });
  });
});