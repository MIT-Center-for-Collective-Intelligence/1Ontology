import { apiKeyManager } from ' @components/lib/utils/apiKeyManager';
import { ApiMetadata, ApiKey, NextApiRequestWithAuth, ApiResponse, ApiKeyUnauthorizedError, CustomApiError } from ' @components/types/api';
import { NextApiResponse } from 'next';


/**
 * Creates standard metadata for API responses
 */
const createMetadata = (clientId: string): ApiMetadata => ({
  clientId,
  timestamp: new Date().toISOString(),
});

/**
 * API Key validation middleware
 * Validates incoming requests against stored API keys
 */
export function validateApiKey<T>(handler: (
  req: NextApiRequestWithAuth,
  res: NextApiResponse<ApiResponse<T>>
) => Promise<void>) {
  return async (
    req: NextApiRequestWithAuth,
    res: NextApiResponse<ApiResponse<T>>
  ) => {
    try {
      const apiKey = req.headers['x-api-key'] as string;
      console.log('req', req.headers);
      if (!apiKey) {
        throw new ApiKeyUnauthorizedError('API key is required');
      }

      const keyData = await apiKeyManager.validateKey(
        apiKey,
        req.url
      );


      if (!keyData) {
        throw new ApiKeyUnauthorizedError('Invalid or inactive API key');
      }

      // Prepare API key info for the request
      const { key, ...apiKeyInfo } = keyData;
      req.apiKeyInfo = apiKeyInfo;

      // Add security headers
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('X-API-Version', '1.0');

      return handler(req, res);
    } catch (error) {
      console.error('API Key validation error:', error);

      if (error instanceof CustomApiError) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code,
          metadata: createMetadata(req.apiKeyInfo?.clientId || 'unknown')
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
        metadata: createMetadata(req.apiKeyInfo?.clientId || 'unknown')
      });
    }
  };
}

/**
 * Creates a configurable API key validator
 */
export function createApiKeyValidator<T>(options: {
  optional?: boolean;
  requiredEndpoints?: string[];
}) {
  return (handler: (
    req: NextApiRequestWithAuth,
    res: NextApiResponse<ApiResponse<T>>
  ) => Promise<void>) => {
    return async (
      req: NextApiRequestWithAuth,
      res: NextApiResponse<ApiResponse<T>>
    ) => {
      try {
        const apiKey = req.headers['x-api-key'] as string;

        // Handle optional API key validation
        if (!apiKey && options.optional && !options.requiredEndpoints?.includes(req.url || '')) {
          return handler(req, res);
        }

        if (!apiKey) {
          throw new ApiKeyUnauthorizedError('API key is required');
        }

        const keyData = await apiKeyManager.validateKey(
          apiKey,
          req.url
        );

        if (!keyData && !options.optional) {
          throw new ApiKeyUnauthorizedError('Invalid or inactive API key');
        }

        if (keyData) {
          const { key, ...apiKeyInfo } = keyData;
          req.apiKeyInfo = apiKeyInfo;
        }

        // Add security headers
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('X-API-Version', '1.0');

        return handler(req, res);
      } catch (error) {
        console.error('API Key validation error:', error);

        if (error instanceof CustomApiError) {
          return res.status(error.statusCode).json({
            success: false,
            error: error.message,
            code: error.code,
            metadata: createMetadata(req.apiKeyInfo?.clientId || 'unknown')
          });
        }

        return res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_SERVER_ERROR',
          metadata: createMetadata(req.apiKeyInfo?.clientId || 'unknown')
        });
      }
    };
  };
}