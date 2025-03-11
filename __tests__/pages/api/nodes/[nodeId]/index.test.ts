import { createMocks, RequestMethod } from 'node-mocks-http';
import nodeHandler from ' @components/pages/api/nodes/[nodeId]';
import { NodeService } from ' @components/services/nodeService';
import { ApiKeyValidationError, ApiResponse, NextApiRequestWithAuth } from ' @components/types/api';
import { ICollection, ILinkNode, INode, INodeTypes } from ' @components/types/INode';
import { NextApiResponse } from 'next';

// Mock the NodeService
jest.mock(' @components/services/nodeService', () => ({
  NodeService: {
    getNode: jest.fn(),
    updateNode: jest.fn(),
    deleteNode: jest.fn()
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
    req.apiKeyInfo = mockApiKeyInfo;
    return handler(req, res);
  }),
}));

export function createTestNode(override: Partial<INode> = {}): INode {
  return {
    id: 'test-node-id',
    title: 'Test Node',
    deleted: false,
    properties: {
      parts: [],
      isPartOf: []
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
export function createLinkNode(id: string, title: string): ILinkNode {
  return {
    id,
    title
  };
}

// Factory function to create a collection
export function createCollection(collectionName: string, nodes: ILinkNode[] = []): ICollection {
  return {
    collectionName,
    nodes
  };
}

// Factory function to create test node with complete relationships
export function createNodeWithRelationships(): INode {
  return {
    id: 'test-node-with-relationships',
    title: 'Node With Relationships',
    deleted: false,
    properties: {
      parts: [
        createCollection('TestParts', [
          createLinkNode('part-node-1', 'Part 1'),
          createLinkNode('part-node-2', 'Part 2')
        ])
      ],
      isPartOf: [
        createCollection('TestWholes', [
          createLinkNode('whole-node-1', 'Whole 1')
        ])
      ]
    },
    inheritance: {},
    specializations: [
      createCollection('TestSpecializations', [
        createLinkNode('special-node-1', 'Specialization 1'),
        createLinkNode('special-node-2', 'Specialization 2')
      ])
    ],
    generalizations: [
      createCollection('TestGeneralizations', [
        createLinkNode('general-node-1', 'Generalization 1')
      ])
    ],
    root: 'test-root',
    propertyType: { 'description': 'string' },
    nodeType: 'activity' as INodeTypes,
    textValue: {},
    createdBy: 'test-user'
  };
}

// Helper function to create mocked requests with auth info for node endpoints
export function createNodeRequest(
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
export function expectSuccessResponse(
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

// Helper to verify error responses
export function expectErrorResponse(
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

// Mock data for deletion tests
export const mockDeletionImpactSummary = {
  generalizations: ['general-node-1'],
  specializations: ['special-node-1', 'special-node-2'],
  parts: ['part-node-1', 'part-node-2'],
  wholes: ['whole-node-1']
};

describe('/api/nodes/[nodeId] GET endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return a node when it exists', async () => {
    const testNode = createTestNode();
    
    (NodeService.getNode as jest.Mock).mockResolvedValue(testNode);

    const { req, res } = createNodeRequest('GET', 'test-node-id');

    await nodeHandler(req, res);

    
    const responseData = expectSuccessResponse(res, 200) as ApiResponse<{ node: INode }>;
    expect(responseData.data?.node).toEqual(testNode);
    
    expect(NodeService.getNode).toHaveBeenCalledWith('test-node-id');
  });

  it('should return 404 when node is not found', async () => {
    (NodeService.getNode as jest.Mock).mockRejectedValue(new Error('Node not found'));

    const { req, res } = createNodeRequest('GET', 'non-existent-node-id');

    await nodeHandler(req, res);

    
    expectErrorResponse(res, 404, 'Node not found');
    
    expect(NodeService.getNode).toHaveBeenCalledWith('non-existent-node-id');
  });

  it('should return 500 when an unexpected error occurs', async () => {
    
    (NodeService.getNode as jest.Mock).mockRejectedValue(new Error('Database connection error'));

    const { req, res } = createNodeRequest('GET', 'test-node-id');

    await nodeHandler(req, res);

    
    expectErrorResponse(res, 500, 'Internal server error occurred while retrieving node');
    
    expect(NodeService.getNode).toHaveBeenCalled();
  });

  it('should return 405 for unsupported methods', async () => {
    const { req, res } = createNodeRequest('PUT', 'test-node-id');

    await nodeHandler(req, res);

    expectErrorResponse(res, 405, 'Method PUT Not Allowed');
    
    expect(res._getHeaders().allow).toContain('GET');
    expect(res._getHeaders().allow).toContain('PATCH');
    expect(res._getHeaders().allow).toContain('DELETE');

    expect(NodeService.getNode).not.toHaveBeenCalled();
  });

  it('should handle preflight OPTIONS requests', async () => {
    const { req, res } = createNodeRequest('OPTIONS', 'test-node-id');

    await nodeHandler(req, res);

    expect(res.statusCode).toBe(204);
    
    expect(res._getHeaders().allow).toContain('GET');
    expect(res._getHeaders().allow).toContain('PATCH');
    expect(res._getHeaders().allow).toContain('DELETE');

    expect(NodeService.getNode).not.toHaveBeenCalled();
  });

  it('should return 401 when apiKeyInfo is missing', async () => {
    const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
      method: 'GET',
      query: {
        nodeId: 'test-node-id'
      }
    });
    
    delete (req as any).apiKeyInfo;
    
    try {
      await nodeHandler(req, res);
      
      console.log('Status code:', res.statusCode);
      console.log('Response data:', JSON.parse(res._getData()));
      
      expect(res.statusCode).toBe(500); 
      const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
      expect(responseData.success).toBe(false);
      
      expect(responseData.error).toBeDefined();
    } catch (error) {
      console.error('Test error:', error);
      throw error;
    }
  });
});

describe('/api/nodes/[nodeId] DELETE endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should delete a node successfully', async () => {
    const testNode = createTestNode();
    testNode.deleted = true;
    
    
    (NodeService.deleteNode as jest.Mock).mockResolvedValue({
      node: testNode,
      impactSummary: mockDeletionImpactSummary
    });

    const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
      method: 'DELETE',
      query: {
        nodeId: 'test-node-id',
        reasoning: 'Test deletion reason'
      }
    });

    await nodeHandler(req, res);

    
    expect(res.statusCode).toBe(200);
    
    const responseData = JSON.parse(res._getData()) as ApiResponse<{
      nodeId: string;
      node: INode;
      impactSummary: typeof mockDeletionImpactSummary;
    }>;
    
    expect(responseData.success).toBe(true);
    expect(responseData.data?.nodeId).toBe('test-node-id');
    expect(responseData.data?.node).toEqual(testNode);
    expect(responseData.data?.impactSummary).toEqual(mockDeletionImpactSummary);
    
    expect(NodeService.deleteNode).toHaveBeenCalledWith(
      'test-node-id',
      'test-username',
      'Test deletion reason'
    );
  });

  it('should return 400 when reasoning is not provided', async () => {
    const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
      method: 'DELETE',
      query: {
        nodeId: 'test-node-id'
      }
    });

    await nodeHandler(req, res);

    
    expect(res.statusCode).toBe(400);
    
    const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
    expect(responseData.success).toBe(false);
    expect(responseData.error).toBe('Reasoning is required for node deletion');
    
    expect(NodeService.deleteNode).not.toHaveBeenCalled();
  });

  it('should return 404 when node is not found', async () => {
    
    (NodeService.deleteNode as jest.Mock).mockRejectedValue(new Error('Node not found'));

    const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
      method: 'DELETE',
      query: {
        nodeId: 'non-existent-node-id',
        reasoning: 'Test deletion reason'
      }
    });

    await nodeHandler(req, res);

    
    expect(res.statusCode).toBe(404);
    
    const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
    expect(responseData.success).toBe(false);
    expect(responseData.error).toBe('Node not found');
    
    expect(NodeService.deleteNode).toHaveBeenCalledWith(
      'non-existent-node-id',
      'test-username',
      'Test deletion reason'
    );
  });

  it('should return 409 when node is already deleted', async () => {
    
    (NodeService.deleteNode as jest.Mock).mockRejectedValue(new Error('Node is already deleted'));

    const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
      method: 'DELETE',
      query: {
        nodeId: 'already-deleted-node-id',
        reasoning: 'Test deletion reason'
      }
    });

    await nodeHandler(req, res);

    
    expect(res.statusCode).toBe(409);
    
    const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
    expect(responseData.success).toBe(false);
    expect(responseData.error).toBe('Node is already deleted');
    
    expect(NodeService.deleteNode).toHaveBeenCalled();
  });

  it('should return 500 when an unexpected error occurs', async () => {
    
    const originalConsoleError = console.error;
    console.error = jest.fn();

    try {
      
      (NodeService.deleteNode as jest.Mock).mockRejectedValue(new Error('Database connection error'));

      const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
        method: 'DELETE',
        query: {
          nodeId: 'test-node-id',
          reasoning: 'Test deletion reason'
        }
      });

      await nodeHandler(req, res);

      
      expect(res.statusCode).toBe(500);
      
      const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Failed to delete node');
      
      expect(NodeService.deleteNode).toHaveBeenCalled();
      
      expect(console.error).toHaveBeenCalled();
    } finally {
      console.error = originalConsoleError;
    }
  });
});

describe('/api/nodes/[nodeId] PATCH endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update a node successfully', async () => {
    const updatedNode = createTestNode();
    updatedNode.title = 'Updated Node Title';
    
    
    (NodeService.updateNode as jest.Mock).mockResolvedValue(updatedNode);

    const updatePayload = {
      node: {
        title: 'Updated Node Title',
        nodeType: 'activity'
      },
      reasoning: 'Test update reason'
    };

    const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
      method: 'PATCH',
      query: {
        nodeId: 'test-node-id'
      },
      body: updatePayload
    });

    await nodeHandler(req, res);

    
    expect(res.statusCode).toBe(200);
    
    const responseData = JSON.parse(res._getData()) as ApiResponse<{
      nodeId: string;
      node: INode;
    }>;
    
    expect(responseData.success).toBe(true);
    expect(responseData.data?.nodeId).toBe('test-node-id');
    expect(responseData.data?.node).toEqual(updatedNode);
    
    expect(NodeService.updateNode).toHaveBeenCalledWith(
      'test-node-id',
      updatePayload.node,
      'test-username',
      'Test update reason'
    );
  });

  it('should return 400 when node data is missing', async () => {
    const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
      method: 'PATCH',
      query: {
        nodeId: 'test-node-id'
      },
      body: {
        reasoning: 'Test update reason'
      }
    });

    await nodeHandler(req, res);

    
    expect(res.statusCode).toBe(400);
    
    const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
    expect(responseData.success).toBe(false);
    expect(responseData.error).toBe('Node data is required');
    
    expect(NodeService.updateNode).not.toHaveBeenCalled();
  });

  it('should return 400 when reasoning is missing', async () => {
    const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
      method: 'PATCH',
      query: {
        nodeId: 'test-node-id'
      },
      body: {
        node: {
          title: 'Updated Node Title'
        }
      }
    });

    await nodeHandler(req, res);

    
    expect(res.statusCode).toBe(400);
    
    const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
    expect(responseData.success).toBe(false);
    expect(responseData.error).toBe('Reasoning is required');
    
    expect(NodeService.updateNode).not.toHaveBeenCalled();
  });

  it('should return 400 when node title is empty', async () => {
    const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
      method: 'PATCH',
      query: {
        nodeId: 'test-node-id'
      },
      body: {
        node: {
          title: '   '
        },
        reasoning: 'Test update reason'
      }
    });

    await nodeHandler(req, res);

    
    expect(res.statusCode).toBe(400);
    
    const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
    expect(responseData.success).toBe(false);
    expect(responseData.error).toBe('Node title cannot be empty');
    
    expect(NodeService.updateNode).not.toHaveBeenCalled();
  });

  it('should return 400 when node type is invalid', async () => {
    const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
      method: 'PATCH',
      query: {
        nodeId: 'test-node-id'
      },
      body: {
        node: {
          title: 'Valid Title',
          nodeType: 'invalid-type'
        },
        reasoning: 'Test update reason'
      }
    });

    await nodeHandler(req, res);

    
    expect(res.statusCode).toBe(400);
    
    const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
    expect(responseData.success).toBe(false);
    expect(responseData.error).toContain('Invalid node type');
    
    expect(NodeService.updateNode).not.toHaveBeenCalled();
  });

  it('should return 400 when generalizations structure is invalid', async () => {
    const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
      method: 'PATCH',
      query: {
        nodeId: 'test-node-id'
      },
      body: {
        node: {
          title: 'Valid Title',
          generalizations: [
            { nodes: [{}] }
          ]
        },
        reasoning: 'Test update reason'
      }
    });

    await nodeHandler(req, res);

    
    expect(res.statusCode).toBe(400);
    
    const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
    expect(responseData.success).toBe(false);
    expect(responseData.error).toBe('Invalid generalization structure');
    
    expect(NodeService.updateNode).not.toHaveBeenCalled();
  });

  it('should return 400 when properties structure is invalid', async () => {
    const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
      method: 'PATCH',
      query: {
        nodeId: 'test-node-id'
      },
      body: {
        node: {
          title: 'Valid Title',
          properties: {
            parts: {},
            isPartOf: []
          }
        },
        reasoning: 'Test update reason'
      }
    });

    await nodeHandler(req, res);

    
    expect(res.statusCode).toBe(400);
    
    const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
    expect(responseData.success).toBe(false);
    expect(responseData.error).toBe('Properties parts must be an array');
    
    expect(NodeService.updateNode).not.toHaveBeenCalled();
  });

  it('should return 500 when NodeService.updateNode throws an unexpected error', async () => {
    
    const originalConsoleError = console.error;
    console.error = jest.fn();

    try {
      
      (NodeService.updateNode as jest.Mock).mockRejectedValue(new Error('Database error'));

      const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
        method: 'PATCH',
        query: {
          nodeId: 'test-node-id'
        },
        body: {
          node: {
            title: 'Updated Node Title'
          },
          reasoning: 'Test update reason'
        }
      });

      await nodeHandler(req, res);

      
      expect(res.statusCode).toBe(500);
      
      const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Failed to update node');
      
      expect(NodeService.updateNode).toHaveBeenCalled();
      
      expect(console.error).toHaveBeenCalled();
    } finally {
      console.error = originalConsoleError;
    }
  });

  it('should properly handle validation errors from NodeService', async () => {
    
    (NodeService.updateNode as jest.Mock).mockImplementation(() => {
      throw new ApiKeyValidationError('Custom validation error from service');
    });

    const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
      method: 'PATCH',
      query: {
        nodeId: 'test-node-id'
      },
      body: {
        node: {
          title: 'Updated Node Title'
        },
        reasoning: 'Test update reason'
      }
    });

    await nodeHandler(req, res);

    
    expect(res.statusCode).toBe(400);
    
    const responseData = JSON.parse(res._getData()) as ApiResponse<never>;
    expect(responseData.success).toBe(false);
    expect(responseData.error).toBe('Custom validation error from service');
    expect(responseData.code).toBe('VALIDATION_ERROR');
    
    expect(NodeService.updateNode).toHaveBeenCalled();
  });
});