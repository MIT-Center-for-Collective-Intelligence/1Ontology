import { validateApiKey, createApiKeyValidator } from ' @components/middlewares/validateApiKey';
import { apiKeyManager } from ' @components/lib/utils/apiKeyManager';
import { NextApiRequestWithAuth, ApiResponse, ApiKeyUnauthorizedError } from ' @components/types/api';
import { NextApiResponse } from 'next';
import { createMocks } from 'node-mocks-http';

jest.mock(' @components/lib/utils/apiKeyManager', () => ({
  apiKeyManager: {
    validateKey: jest.fn()
  }
}));

const mockHandler = jest.fn(async (
  req: NextApiRequestWithAuth,
  res: NextApiResponse<ApiResponse<any>>
) => {
  return res.status(200).json({
    success: true,
    data: { message: 'Success' },
    metadata: { clientId: req.apiKeyInfo?.clientId || 'unknown' }
  });
});

const mockApiKeyData = {
  key: 'hashed-api-key',
  clientId: 'test-client-id',
  userId: 'test-user-id',
  uname: 'test-username',
  createdAt: new Date().toISOString(),
  lastUsed: new Date().toISOString(),
  isActive: true,
  description: 'Test API Key'
};

describe('API Key Validation Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiKeyManager.validateKey as jest.Mock).mockResolvedValue(mockApiKeyData);
  });

  describe('validateApiKey middleware', () => {
    it('should pass validation with valid API key', async () => {
      const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
        headers: {
          'x-api-key': 'valid-api-key'
        },
        url: '/api/test'
      });

      const handler = validateApiKey(mockHandler);
      await handler(req, res);

      expect(mockHandler).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(apiKeyManager.validateKey).toHaveBeenCalledWith('valid-api-key', '/api/test');
      expect(req.apiKeyInfo).toBeDefined();
      expect(req.apiKeyInfo?.clientId).toBe('test-client-id');
    });

    it('should return 401 when API key is missing', async () => {
      const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
        url: '/api/test'
      });

      const handler = validateApiKey(mockHandler);
      await handler(req, res);

      expect(res.statusCode).toBe(401);
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('API key is required');
      expect(responseData.code).toBe('UNAUTHORIZED');
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should return 401 when API key is invalid', async () => {
      (apiKeyManager.validateKey as jest.Mock).mockResolvedValue(null);
      
      const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
        headers: {
          'x-api-key': 'invalid-api-key'
        },
        url: '/api/test'
      });

      const handler = validateApiKey(mockHandler);
      await handler(req, res);

      expect(res.statusCode).toBe(401);
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Invalid or inactive API key');
      expect(responseData.code).toBe('UNAUTHORIZED');
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should add security headers to the response', async () => {
      const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
        headers: {
          'x-api-key': 'valid-api-key'
        },
        url: '/api/test'
      });

      const handler = validateApiKey(mockHandler);
      await handler(req, res);

      expect(res._getHeaders()['x-frame-options']).toBe('DENY');
      expect(res._getHeaders()['x-content-type-options']).toBe('nosniff');
      expect(res._getHeaders()['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(res._getHeaders()['x-api-version']).toBe('1.0');
    });

    it('should handle unexpected errors and return 500', async () => {
      (apiKeyManager.validateKey as jest.Mock).mockRejectedValue(new Error('Unexpected error'));
      
      const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
        headers: {
          'x-api-key': 'valid-api-key'
        },
        url: '/api/test'
      });

      const handler = validateApiKey(mockHandler);
      await handler(req, res);

      expect(res.statusCode).toBe(500);
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Internal server error');
      expect(responseData.code).toBe('INTERNAL_SERVER_ERROR');
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('createApiKeyValidator middleware', () => {
    it('should allow requests without API key when optional is true', async () => {
      const validator = createApiKeyValidator<any>({ optional: true });
      const handler = validator(mockHandler);
      
      const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
        url: '/api/test'
      });

      await handler(req, res);

      expect(mockHandler).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });

    it('should require API key for specific endpoints when requiredEndpoints is provided', async () => {
      const validator = createApiKeyValidator<any>({ 
        optional: true,
        requiredEndpoints: ['/api/protected']
      });
      const handler = validator(mockHandler);
      
      const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
        url: '/api/protected'
      });

      await handler(req, res);

      expect(res.statusCode).toBe(401);
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('API key is required');
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should add apiKeyInfo to request when valid key is provided with optional=true', async () => {
      const validator = createApiKeyValidator<any>({ optional: true });
      const handler = validator(mockHandler);
      
      const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
        headers: {
          'x-api-key': 'valid-api-key'
        },
        url: '/api/test'
      });

      await handler(req, res);

      expect(req.apiKeyInfo).toBeDefined();
      expect(req.apiKeyInfo?.clientId).toBe('test-client-id');
      expect(mockHandler).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });

    it('should allow requests with invalid API key when optional=true', async () => {
      (apiKeyManager.validateKey as jest.Mock).mockResolvedValue(null);
      
      const validator = createApiKeyValidator<any>({ optional: true });
      const handler = validator(mockHandler);
      
      const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
        headers: {
          'x-api-key': 'invalid-api-key'
        },
        url: '/api/test'
      });

      await handler(req, res);

      expect(mockHandler).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(req.apiKeyInfo).toBeUndefined();
    });

    it('should reject requests with invalid API key when optional=false', async () => {
      (apiKeyManager.validateKey as jest.Mock).mockResolvedValue(null);
      
      const validator = createApiKeyValidator<any>({ optional: false });
      const handler = validator(mockHandler);
      
      const { req, res } = createMocks<NextApiRequestWithAuth, NextApiResponse>({
        headers: {
          'x-api-key': 'invalid-api-key'
        },
        url: '/api/test'
      });

      await handler(req, res);

      expect(res.statusCode).toBe(401);
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Invalid or inactive API key');
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });
});