import { createMocks, RequestMethod } from 'node-mocks-http';
import inheritanceHandler from ' @components/pages/api/nodes/[nodeId]/inheritance';
import { NodeService } from ' @components/services/nodeService';
import { NodeInheritanceService } from ' @components/services/nodeInheritanceService';
import { ApiKeyValidationError, ApiResponse, NextApiRequestWithAuth } from ' @components/types/api';
import { INode, IInheritance, InheritanceType, INodeTypes } from ' @components/types/INode';
import { NextApiResponse } from 'next';
import { ChangelogService } from ' @components/services/changelog';

// Mock the NodeService
jest.mock(' @components/services/nodeService', () => ({
  NodeService: {
    getNode: jest.fn()
  }
}));

// Mock the NodeInheritanceService
jest.mock(' @components/services/nodeInheritanceService', () => ({
  NodeInheritanceService: {
    updateInheritance: jest.fn(),
    updatePropertyInheritance: jest.fn()
  }
}));

// Mock the ChangelogService
jest.mock(' @components/services/changelog', () => ({
  ChangelogService: {
    log: jest.fn().mockResolvedValue('mock-changelog-id')
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

// Helper function to create mocked requests for inheritance endpoints
function createInheritanceRequest(
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

// Example test node and inheritance data
const mockNode: INode = {
  id: 'test-node-id',
  title: 'Test Node',
  deleted: false,
  properties: {
    parts: [],
    isPartOf: [],
    description: 'Test description'
  },
  inheritance: {
    description: {
      ref: 'parent-node-id',
      inheritanceType: 'inheritUnlessAlreadyOverRidden'
    } as InheritanceType
  },
  specializations: [],
  generalizations: [
    {
      collectionName: 'main',
      nodes: [{ id: 'parent-node-id' }]
    }
  ],
  root: 'test-root',
  propertyType: { 'description': 'string' },
  nodeType: 'activity' as INodeTypes,
  textValue: {},
  createdBy: 'test-user',
  contributors: ['test-user']
};

describe('Node Inheritance API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default implementations
    (NodeService.getNode as jest.Mock).mockResolvedValue(mockNode);
  });

  //==========================================================================
  // SECTION 1: BASIC FUNCTIONALITY TESTS
  //==========================================================================
  
  describe('Basic functionality', () => {
    it('should get node inheritance information', async () => {
      const { req, res } = createInheritanceRequest('test-node-id', 'GET');

      await inheritanceHandler(req, res);

      const responseData = expectSuccessResponse(res, 200) as ApiResponse<{ inheritance: IInheritance }>;
      expect(responseData.data?.inheritance).toEqual(mockNode.inheritance);
      
      expect(NodeService.getNode).toHaveBeenCalledWith('test-node-id');
    });

    it('should update node inheritance rules', async () => {
      const updatedNode = {
        ...mockNode,
        inheritance: {
          ...mockNode.inheritance,
          description: {
            ref: 'parent-node-id',
            inheritanceType: 'alwaysInherit'
          }
        }
      };
      
      (NodeInheritanceService.updateInheritance as jest.Mock).mockResolvedValue(updatedNode);
      
      const updateRequest = {
        properties: {
          description: { inheritanceType: 'alwaysInherit' }
        },
        reasoning: 'Updating inheritance rules for testing'
      };
      
      const { req, res } = createInheritanceRequest('test-node-id', 'PATCH', updateRequest);

      await inheritanceHandler(req, res);

      const responseData = expectSuccessResponse(res, 200) as ApiResponse<{ 
        node: INode; 
        inheritance: IInheritance; 
      }>;
      
      expect(responseData.data?.node).toEqual(updatedNode);
      expect(responseData.data?.inheritance).toEqual(updatedNode.inheritance);
      
      expect(NodeInheritanceService.updateInheritance).toHaveBeenCalledWith(
        'test-node-id',
        updateRequest.properties,
        'test-username',
        updateRequest.reasoning
      );
    });

    it('should return 405 for unsupported methods', async () => {
      const { req, res } = createInheritanceRequest('test-node-id', 'DELETE');

      await inheritanceHandler(req, res);

      expectErrorResponse(res, 405, 'Method DELETE Not Allowed');
      
      expect(res._getHeaders().allow).toContain('GET');
      expect(res._getHeaders().allow).toContain('PATCH');
    });
  });

  //==========================================================================
  // SECTION 2: VALIDATION TESTS
  //==========================================================================
  
  describe('Input validation', () => {
    it('should return 400 when nodeId is missing', async () => {
      const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
        method: 'GET',
        query: {},
      });
      req.apiKeyInfo = mockApiKeyInfo;
      
      await inheritanceHandler(req, res);

      expectErrorResponse(res, 400, 'Node ID must be provided as a string');
    });

    it('should return 400 when nodeId is empty', async () => {
      const { req, res } = createInheritanceRequest('   ', 'GET');

      await inheritanceHandler(req, res);

      expectErrorResponse(res, 400, 'Node ID cannot be empty');
    });

    it('should return 404 when node does not exist', async () => {
      (NodeService.getNode as jest.Mock).mockRejectedValue(new Error('Node not found'));

      const { req, res } = createInheritanceRequest('non-existent-id', 'GET');

      await inheritanceHandler(req, res);

      expectErrorResponse(res, 404, 'Node with ID \"non-existent-id\" not found');
    });

    it('should return 400 when update request is missing properties', async () => {
      const invalidRequest = {
        reasoning: 'Updating inheritance rules for testing'
      };
      
      const { req, res } = createInheritanceRequest('test-node-id', 'PATCH', invalidRequest);

      await inheritanceHandler(req, res);

      expectErrorResponse(res, 400, 'Properties must be provided as an object');
    });

    it('should return 400 when update request has empty properties', async () => {
      const invalidRequest = {
        properties: {},
        reasoning: 'Updating inheritance rules for testing'
      };
      
      const { req, res } = createInheritanceRequest('test-node-id', 'PATCH', invalidRequest);

      await inheritanceHandler(req, res);

      expectErrorResponse(res, 400, 'At least one property must be specified');
    });

    it('should return 400 when update request is missing reasoning', async () => {
      const invalidRequest = {
        properties: {
          description: { inheritanceType: 'alwaysInherit' }
        }
      };
      
      const { req, res } = createInheritanceRequest('test-node-id', 'PATCH', invalidRequest);

      await inheritanceHandler(req, res);

      expectErrorResponse(res, 400, 'Reasoning must be provided as a string');
    });

    it('should return 400 when update request has empty reasoning', async () => {
      const invalidRequest = {
        properties: {
          description: { inheritanceType: 'alwaysInherit' }
        },
        reasoning: '   '
      };
      
      const { req, res } = createInheritanceRequest('test-node-id', 'PATCH', invalidRequest);

      await inheritanceHandler(req, res);

      expectErrorResponse(res, 400, 'Reasoning cannot be empty');
    });

    it('should return 400 when update request has invalid inheritance type', async () => {
      const invalidRequest = {
        properties: {
          description: { inheritanceType: 'invalidType' }
        },
        reasoning: 'Updating inheritance rules for testing'
      };
      
      const { req, res } = createInheritanceRequest('test-node-id', 'PATCH', invalidRequest);

      await inheritanceHandler(req, res);

      const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
      expect(res.statusCode).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('Invalid inheritanceType for property "description"');
      expect(responseData.error).toContain('neverInherit');
      expect(responseData.error).toContain('alwaysInherit');
      expect(responseData.error).toContain('inheritUnlessAlreadyOverRidden');
      expect(responseData.error).toContain('inheritAfterReview');
    });

    it('should return 400 when property is not found in node', async () => {
      (NodeInheritanceService.updateInheritance as jest.Mock).mockRejectedValue(
        new Error('Property "nonExistentProp" not found in node')
      );
      
      const updateRequest = {
        properties: {
          nonExistentProp: { inheritanceType: 'alwaysInherit' }
        },
        reasoning: 'Updating inheritance rules for testing'
      };
      
      const { req, res } = createInheritanceRequest('test-node-id', 'PATCH', updateRequest);

      await inheritanceHandler(req, res);

      expectErrorResponse(res, 400, 'Property "nonExistentProp" not found in node');
      expect(JSON.parse(res._getData()).code).toBe('PROPERTY_NOT_FOUND');
    });
  });

  //==========================================================================
  // SECTION 3: COMPLEX CASES
  //==========================================================================
  
  describe('Complex cases', () => {
    it('should update multiple property inheritance rules at once', async () => {
      const nodeWithMultipleProps: INode = {
        ...mockNode,
        properties: {
          ...mockNode.properties,
          title: 'Test Title',
          category: 'Test Category'
        },
        inheritance: {
          ...mockNode.inheritance,
          title: {
            ref: 'parent-node-id',
            inheritanceType: 'inheritUnlessAlreadyOverRidden'
          } as InheritanceType,
          category: {
            ref: 'parent-node-id',
            inheritanceType: 'neverInherit'
          } as InheritanceType
        }
      };
      
      (NodeService.getNode as jest.Mock).mockResolvedValue(nodeWithMultipleProps);
      
      const updatedNode = {
        ...nodeWithMultipleProps,
        inheritance: {
          ...nodeWithMultipleProps.inheritance,
          title: {
            ref: 'parent-node-id',
            inheritanceType: 'alwaysInherit'
          },
          category: {
            ref: 'parent-node-id',
            inheritanceType: 'inheritAfterReview'
          }
        }
      };
      
      (NodeInheritanceService.updateInheritance as jest.Mock).mockResolvedValue(updatedNode);
      
      const updateRequest = {
        properties: {
          title: { inheritanceType: 'alwaysInherit' },
          category: { inheritanceType: 'inheritAfterReview' }
        },
        reasoning: 'Updating multiple inheritance rules for testing'
      };
      
      const { req, res } = createInheritanceRequest('test-node-id', 'PATCH', updateRequest);

      await inheritanceHandler(req, res);

      const responseData = expectSuccessResponse(res, 200) as ApiResponse<{ 
        node: INode; 
        inheritance: IInheritance; 
      }>;
      
      expect(responseData.data?.inheritance?.title?.inheritanceType).toBe('alwaysInherit');
      expect(responseData.data?.inheritance?.category?.inheritanceType).toBe('inheritAfterReview');
      
      expect(NodeInheritanceService.updateInheritance).toHaveBeenCalledWith(
        'test-node-id',
        updateRequest.properties,
        'test-username',
        updateRequest.reasoning
      );
    });

    it('should handle updating inheritance on nested object properties', async () => {
      const nodeWithNestedProps: INode = {
        ...mockNode,
        properties: {
          ...mockNode.properties,
          metadata: {
            author: 'Test Author',
            version: '1.0'
          }
        },
        inheritance: {
          ...mockNode.inheritance,
          metadata: {
            ref: 'parent-node-id',
            inheritanceType: 'inheritUnlessAlreadyOverRidden'
          } as InheritanceType
        }
      };
      
      (NodeService.getNode as jest.Mock).mockResolvedValue(nodeWithNestedProps);
      
      const updatedNode = {
        ...nodeWithNestedProps,
        inheritance: {
          ...nodeWithNestedProps.inheritance,
          metadata: {
            ref: 'parent-node-id',
            inheritanceType: 'alwaysInherit'
          }
        }
      };
      
      (NodeInheritanceService.updateInheritance as jest.Mock).mockResolvedValue(updatedNode);
      
      const updateRequest = {
        properties: {
          metadata: { inheritanceType: 'alwaysInherit' }
        },
        reasoning: 'Updating nested property inheritance rule for testing'
      };
      
      const { req, res } = createInheritanceRequest('test-node-id', 'PATCH', updateRequest);

      await inheritanceHandler(req, res);

      const responseData = expectSuccessResponse(res, 200) as ApiResponse<{ 
        node: INode; 
        inheritance: IInheritance; 
      }>;
      
      expect(responseData.data?.inheritance?.metadata?.inheritanceType).toBe('alwaysInherit');
      
      expect(NodeInheritanceService.updateInheritance).toHaveBeenCalledWith(
        'test-node-id',
        updateRequest.properties,
        'test-username',
        updateRequest.reasoning
      );
    });
  });

  //==========================================================================
  // SECTION 4: ERROR HANDLING TESTS
  //==========================================================================
  
  describe('Error handling', () => {
    // it('should return 401 when apiKeyInfo is missing', async () => {
    //   const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
    //     method: 'GET',
    //     query: {
    //       nodeId: 'test-node-id'
    //     }
    //   });
      
    //   // Explicitly remove apiKeyInfo
    //   delete (req as any).apiKeyInfo;
      
    //   await inheritanceHandler(req, res);
      
    //   expectErrorResponse(res, 401, 'Authentication required');
    // });

    it('should return 400 when node is deleted', async () => {
      const deletedNode = {
        ...mockNode,
        deleted: true
      };
      
      (NodeService.getNode as jest.Mock).mockResolvedValue(deletedNode);
      
      const { req, res } = createInheritanceRequest('deleted-node-id', 'GET');

      await inheritanceHandler(req, res);

      expectErrorResponse(res, 400, 'Cannot modify a deleted node');
      expect(JSON.parse(res._getData()).code).toBe('NODE_OPERATION_ERROR');
    });

    // it('should return 500 when an unexpected error occurs', async () => {
    //   (NodeService.getNode as jest.Mock).mockRejectedValue(new Error('Database connection error'));

    //   const { req, res } = createInheritanceRequest('test-node-id', 'GET');

    //   await inheritanceHandler(req, res);

    //   expect(res.statusCode).toBe(500);
    //   const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
    //   expect(responseData.success).toBe(false);
    //   expect(responseData.error).toBe('An unexpected error occurred. Please try again later.');
    //   expect(responseData.code).toBe('INTERNAL_SERVER_ERROR');
    // });

    it('should return 400 when NodeInheritanceService throws a validation error', async () => {
      (NodeInheritanceService.updateInheritance as jest.Mock).mockRejectedValue(
        new ApiKeyValidationError('Invalid inheritance rule')
      );
      
      const updateRequest = {
        properties: {
          description: { inheritanceType: 'alwaysInherit' }
        },
        reasoning: 'Updating inheritance rules for testing'
      };
      
      const { req, res } = createInheritanceRequest('test-node-id', 'PATCH', updateRequest);

      await inheritanceHandler(req, res);

      expectErrorResponse(res, 400, 'Invalid inheritance rule');
      expect(JSON.parse(res._getData()).code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when NodeInheritanceService throws an inheritance operation error', async () => {
      (NodeInheritanceService.updateInheritance as jest.Mock).mockRejectedValue(
        new Error('Failed to update inheritance: Cannot update inheritance for this node type')
      );
      
      const updateRequest = {
        properties: {
          description: { inheritanceType: 'alwaysInherit' }
        },
        reasoning: 'Updating inheritance rules for testing'
      };
      
      const { req, res } = createInheritanceRequest('test-node-id', 'PATCH', updateRequest);

      await inheritanceHandler(req, res);

      expect(res.statusCode).toBe(400);
      const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Failed to update inheritance: Cannot update inheritance for this node type');
      expect(responseData.code).toBe('NODE_OPERATION_ERROR');
    });
  });
});