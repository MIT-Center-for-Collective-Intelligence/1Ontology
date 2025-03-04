import { NextApiRequest } from 'next';

export interface ApiMetadata {
  clientId: string;
  timestamp?: string;
  endpoint?: string;
  [key: string]: any;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  metadata: ApiMetadata;
}

export interface ApiKey {
  key: string;         
  userId: string;    
  uname: string;     
  clientId: string;       
  createdAt: Date;        
  lastUsed: Date;         
  isActive: boolean;      
  description: string;    
  allowedEndpoints?: string[];  
}

export interface ApiKeyCreateParams {
  userId: string;
  uname: string;
  clientId: string;
  description: string;
  allowedEndpoints?: string[];
}

export interface ApiKeyInfo {
  userId: string;
  uname: string;
  clientId: string;
  createdAt: Date;
  lastUsed: Date;
  isActive: boolean;
  description: string;
  allowedEndpoints?: string[];
}

export interface NextApiRequestWithAuth extends NextApiRequest {
  apiKeyInfo: ApiKeyInfo;
}

export class CustomApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'CustomApiError';
  }
}

export class ApiKeyUnauthorizedError extends CustomApiError {
  constructor(message = 'Unauthorized') {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class ApiKeyForbiddenError extends CustomApiError {
  constructor(message = 'Forbidden') {
    super(403, message, 'FORBIDDEN');
  }
}

export class ApiKeyValidationError extends CustomApiError {
  constructor(message = 'Validation Error') {
    super(400, message, 'VALIDATION_ERROR');
  }
}