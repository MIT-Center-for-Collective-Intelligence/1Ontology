import { createMocks, RequestMethod } from 'node-mocks-http';
import apiKeysHandler from ' @components/pages/api/keys';
import { ApiResponse } from ' @components/types/api';
import { NextApiRequest, NextApiResponse } from 'next';
import { apiKeyManager } from ' @components/lib/utils/apiKeyManager';

// Mock the apiKeyManager
jest.mock(' @components/lib/utils/apiKeyManager', () => ({
  apiKeyManager: {
    listKeys: jest.fn(),
    generateKey: jest.fn(),
    deactivateKey: jest.fn(),
    getKeyByClientId: jest.fn()
  }
}));

// Helper function to create mocked requests
function createRequest(
  method: RequestMethod = 'GET',
  body?: any,
  query?: any
) {
  return createMocks<NextApiRequest, NextApiResponse>({
    method,
    body,
    query,
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
  expect(responseData.metadata.clientId).toBe('system');
  
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
  expect(responseData.metadata.clientId).toBe('system');
  
  return responseData;
}

// Mock API key data
const mockApiKeys = [
  {
    clientId: 'client_123',
    userId: 'user_123',
    uname: 'test-user',
    createdAt: new Date().toISOString(),
    lastUsed: new Date().toISOString(),
    isActive: true,
    description: 'Test API Key 1'
  },
  {
    clientId: 'client_456',
    userId: 'user_123',
    uname: 'test-user',
    createdAt: new Date().toISOString(),
    lastUsed: new Date().toISOString(),
    isActive: false,
    description: 'Test API Key 2'
  }
];

describe('API Keys Endpoint Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    (apiKeyManager.listKeys as jest.Mock).mockResolvedValue(mockApiKeys);
    
    (apiKeyManager.generateKey as jest.Mock).mockResolvedValue({
      apiKey: 'test-api-key-string',
      keyData: {
        clientId: 'client_789',
        userId: 'user_123',
        uname: 'test-user',
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
        isActive: true,
        description: 'New Test API Key'
      }
    });
    
    (apiKeyManager.deactivateKey as jest.Mock).mockResolvedValue(true);
    
    (apiKeyManager.getKeyByClientId as jest.Mock).mockResolvedValue(mockApiKeys[0]);
  });

  //==========================================================================
  // SECTION 1: BASIC ENDPOINT FUNCTIONALITY TESTS
  //==========================================================================
  
  describe('Basic functionality', () => {
    it('should return 405 for unsupported methods', async () => {
      const { req, res } = createRequest('PATCH');

      await apiKeysHandler(req, res);

      expectErrorResponse(res, 405, 'Method PATCH Not Allowed');
      
      expect(res._getHeaders().allow).toEqual(['GET', 'POST', 'DELETE']);
    });
  });

  //==========================================================================
  // SECTION 2: GET ENDPOINT - LIST KEYS TESTS
  //==========================================================================
  
  describe('GET Endpoint - List Keys', () => {
    it('should list API keys for a user', async () => {
      const { req, res } = createRequest('GET', undefined, { userId: 'user_123' });

      await apiKeysHandler(req, res);

      const responseData = expectSuccessResponse(res, 200);
      expect(responseData.data).toBeDefined();
      expect(responseData.data.length).toBe(mockApiKeys.length);
      expect(responseData.data[0].clientId).toBe(mockApiKeys[0].clientId);
      expect(responseData.data[0].userId).toBe(mockApiKeys[0].userId);
      expect(responseData.data[0].isActive).toBe(mockApiKeys[0].isActive);
      
      expect(apiKeyManager.listKeys).toHaveBeenCalledWith('user_123');
    });

    it('should return 400 when userId is missing', async () => {
      const { req, res } = createRequest('GET');

      await apiKeysHandler(req, res);

      expectErrorResponse(res, 400, 'User ID is required');
      
      expect(apiKeyManager.listKeys).not.toHaveBeenCalled();
    });

    it('should handle errors from apiKeyManager', async () => {
      (apiKeyManager.listKeys as jest.Mock).mockRejectedValue(new Error('Database error'));
      
      const { req, res } = createRequest('GET', undefined, { userId: 'user_123' });

      await apiKeysHandler(req, res);

      expectErrorResponse(res, 500, 'Failed to fetch API keys');
    });
  });

  //==========================================================================
  // SECTION 3: GET ENDPOINT - GET KEY BY CLIENT ID TESTS
  //==========================================================================
  
  describe('GET Endpoint - Get Key by ClientId', () => {
    it('should retrieve a specific API key', async () => {
      const { req, res } = createRequest('GET', undefined, { 
        clientId: 'client_123',
        userId: 'user_123'
      });

      await apiKeysHandler(req, res);

      const responseData = expectSuccessResponse(res, 200);
      expect(responseData.data.apiKey).toBeDefined();
      expect(responseData.data.apiKey.clientId).toBe(mockApiKeys[0].clientId);
      expect(responseData.data.apiKey.userId).toBe(mockApiKeys[0].userId);
      expect(responseData.data.apiKey.isActive).toBe(mockApiKeys[0].isActive);
      
      expect(apiKeyManager.getKeyByClientId).toHaveBeenCalledWith('client_123', 'user_123');
    });

    it('should return 400 when clientId or userId is missing', async () => {
      const { req, res } = createRequest('GET', undefined, { clientId: 'client_123' });

      await apiKeysHandler(req, res);

      expectErrorResponse(res, 400, 'User ID is required');
      
      expect(apiKeyManager.getKeyByClientId).not.toHaveBeenCalled();
    });

    it('should return 404 when API key is not found', async () => {
      (apiKeyManager.getKeyByClientId as jest.Mock).mockResolvedValue(null);
      
      const { req, res } = createRequest('GET', undefined, { 
        clientId: 'non-existent',
        userId: 'user_123'
      });

      await apiKeysHandler(req, res);

      expectErrorResponse(res, 404, 'API key not found or inactive');
    });
  });

  //==========================================================================
  // SECTION 4: POST ENDPOINT TESTS
  //==========================================================================
  
  describe('POST Endpoint', () => {
    it('should generate a new API key', async () => {
      const { req, res } = createRequest('POST', {
        userId: 'user_123',
        uname: 'test-user',
        description: 'Test API Key'
      });

      await apiKeysHandler(req, res);

      const responseData = expectSuccessResponse(res, 201);
      expect(responseData.data.apiKey).toBe('test-api-key-string');
      expect(responseData.data.keyData).toBeDefined();
      
      expect(apiKeyManager.generateKey).toHaveBeenCalledWith({
        userId: 'user_123',
        uname: 'test-user',
        clientId: expect.stringContaining('client_'),
        description: 'Test API Key'
      });
    });

    it('should generate a default description when not provided', async () => {
      const { req, res } = createRequest('POST', {
        userId: 'user_123',
        uname: 'test-user'
      });

      await apiKeysHandler(req, res);

      const responseData = expectSuccessResponse(res, 201);
      
      const generateKeyCall = (apiKeyManager.generateKey as jest.Mock).mock.calls[0][0];
      expect(generateKeyCall.description).toContain('API Key generated on');
    });

    it('should return 400 when required fields are missing', async () => {
      const { req, res } = createRequest('POST', {
        userId: 'user_123'
      });

      await apiKeysHandler(req, res);

      expectErrorResponse(res, 400, 'Missing required fields');
      
      expect(apiKeyManager.generateKey).not.toHaveBeenCalled();
    });

    it('should handle errors from apiKeyManager', async () => {
      (apiKeyManager.generateKey as jest.Mock).mockRejectedValue(new Error('Database error'));
      
      const { req, res } = createRequest('POST', {
        userId: 'user_123',
        uname: 'test-user'
      });

      await apiKeysHandler(req, res);

      expectErrorResponse(res, 500, 'Failed to generate API key');
    });
  });

  //==========================================================================
  // SECTION 5: DELETE ENDPOINT TESTS
  //==========================================================================
  
  describe('DELETE Endpoint', () => {
    it('should deactivate an API key', async () => {
      const { req, res } = createRequest('DELETE', undefined, {
        clientId: 'client_123',
        userId: 'user_123'
      });

      await apiKeysHandler(req, res);

      expectSuccessResponse(res, 200);
      
      expect(apiKeyManager.deactivateKey).toHaveBeenCalledWith('client_123', 'user_123');
    });

    it('should return 400 when clientId or userId is missing', async () => {
      const { req, res } = createRequest('DELETE', undefined, { clientId: 'client_123' });

      await apiKeysHandler(req, res);

      expectErrorResponse(res, 400, 'Client ID and User ID are required');
      
      expect(apiKeyManager.deactivateKey).not.toHaveBeenCalled();
    });

    it('should return 404 when API key is not found', async () => {
      (apiKeyManager.deactivateKey as jest.Mock).mockResolvedValue(false);
      
      const { req, res } = createRequest('DELETE', undefined, {
        clientId: 'non-existent',
        userId: 'user_123'
      });

      await apiKeysHandler(req, res);

      expectErrorResponse(res, 404, 'API key not found or already deactivated');
    });

    it('should handle errors from apiKeyManager', async () => {
      (apiKeyManager.deactivateKey as jest.Mock).mockRejectedValue(new Error('Database error'));
      
      const { req, res } = createRequest('DELETE', undefined, {
        clientId: 'client_123',
        userId: 'user_123'
      });

      await apiKeysHandler(req, res);

      expectErrorResponse(res, 500, 'Failed to deactivate API key');
    });
  });
});