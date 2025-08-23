import { API_LOGS, API_METRICS } from " @components/lib/firestoreClient/collections";
import { db } from " @components/lib/firestoreServer/admin";
import { NextApiRequestWithAuth, ApiResponse, CustomApiError } from " @components/types/api";
import { NextApiResponse } from "next";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

// Constants
const MAX_REQUEST_BODY_SIZE = 1024 * 100; // 100KB limit for request body logging
const METRIC_UPDATE_BATCH_SIZE = 500;
const DEFAULT_UNKNOWN = 'unknown';

/**
 * Structured logging interfaces
 */
interface ApiLogEntry {
  readonly timestamp: Date;
  readonly endpoint: string;
  readonly method: string;
  readonly clientId: string;
  readonly userId: string;
  readonly uname: string;
  readonly statusCode: number;
  readonly responseTime: number;
  readonly userAgent?: string;
  readonly ip?: string;
  readonly error?: string;
  readonly requestBody?: unknown;
  readonly queryParams?: unknown;
  readonly version: string;
}

interface ApiMetrics {
  readonly endpoint: string;
  readonly totalRequests: number;
  readonly lastRequest: Date;
  readonly successCount: number;
  readonly errorCount: number;
  readonly averageResponseTime: number;
  readonly lastUpdated: Date;
}

class ApiLoggerError extends CustomApiError {
  constructor(message: string, statusCode = 500) {
    super(statusCode, message, 'API_LOGGER_ERROR');
    this.name = 'ApiLoggerError';
  }
}

class RequestTimer {
  private startTimeMs: number;
  private checkpoints: Map<string, number>;

  constructor() {
    this.startTimeMs = Date.now();
    this.checkpoints = new Map();
  }

  mark(name: string): void {
    const currentMs = Date.now();
    const elapsedMs = currentMs - this.startTimeMs;
    this.checkpoints.set(name, elapsedMs);
    console.log(`Checkpoint [${name}]: ${elapsedMs}ms`);
  }

  getElapsedTime(): number {
    return Date.now() - this.startTimeMs;
  }

  getCheckpoints(): Record<string, number> {
    return Object.fromEntries(this.checkpoints);
  }
}

/**
 * Sanitizes and validates endpoint path
 * @throws {ApiLoggerError} If endpoint path is invalid
 */
function sanitizeEndpointPath(endpoint: string): string {
  if (!endpoint) {
    throw new ApiLoggerError('Invalid endpoint path');
  }

  const sanitized = endpoint
    .replace(/^\/+|\/+$/g, '')
    .replace(/\//g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 255); // Firestore document ID length limit

  if (!sanitized) {
    throw new ApiLoggerError('Invalid endpoint path after sanitization');
  }

  return sanitized;
}

/**
 * Safely stringifies and truncates request body
 */
function sanitizeRequestBody(body: unknown): unknown {
  if (!body) return undefined;
  
  try {
    const stringified = JSON.stringify(body);
    if (stringified.length > MAX_REQUEST_BODY_SIZE) {
      return {
        truncated: true,
        size: stringified.length,
        preview: stringified.slice(0, 100) + '...'
      };
    }
    return body;
  } catch (error) {
    return { error: 'Unable to serialize request body' };
  }
}

/**
 * API Logger middleware with enhanced error handling and validation
 */
export function withApiLogger<T>(handler: (
  req: NextApiRequestWithAuth,
  res: NextApiResponse<ApiResponse<T>>
) => Promise<void>) {
  return async (
    req: NextApiRequestWithAuth,
    res: NextApiResponse<ApiResponse<T>>
  ) => {
    const requestStartTime = (req as any)._startTime || Date.now();
    const startTime = Date.now();
    let statusCode = 200;
    let error: string | undefined;

    // Validate request
    if (!req?.url) {
      throw new ApiLoggerError('Invalid request object');
    }

    // Create a custom response object to intercept the status code
    const customRes = Object.create(res);
    customRes.status = (code: number) => {
      statusCode = code;
      return res.status(code);
    };

    try {
      await handler(req, customRes);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
      throw e;
    } finally {
      try {
        const responseTime = Date.now() - requestStartTime;
        console.log('requestStartTime', requestStartTime);
        console.log('responsetime', responseTime);

        const logEntry: ApiLogEntry = {
          timestamp: new Date(),
          endpoint: req.url,
          method: req.method?.toUpperCase() || 'UNKNOWN',
          clientId: req.apiKeyInfo?.clientId || DEFAULT_UNKNOWN,
          userId: req.apiKeyInfo?.userId || DEFAULT_UNKNOWN,
          uname: req.apiKeyInfo?.uname || DEFAULT_UNKNOWN,
          statusCode,
          responseTime,
          userAgent: req.headers['user-agent'],
          ip: (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress) ?? DEFAULT_UNKNOWN,
          error,
          requestBody: sanitizeRequestBody(req.body),
          queryParams: req.query,
          version: '1.0'  // API version
        };

        const [logResult, metricsResult] = await Promise.allSettled([
          saveApiLog(logEntry),
          updateApiMetrics(logEntry)
        ]);

        if (logResult.status === 'rejected') {
          console.error('Failed to save API log:', logResult.reason);
        }
        if (metricsResult.status === 'rejected') {
          console.error('Failed to update metrics:', metricsResult.reason);
        }
      } catch (loggingError) {
        console.error('Critical logging error:', loggingError);
      }
    }
  };
}

/**
 * Saves API log entry with batching support
 */
async function saveApiLog(logEntry: ApiLogEntry): Promise<void> {
  try {
    const logRef = db.collection(API_LOGS).doc();
    
    // Convert Date to Firestore Timestamp
    const firestoreEntry = {
      ...logEntry,
      timestamp: Timestamp.fromDate(logEntry.timestamp)
    };

    await logRef.set(firestoreEntry);
  } catch (error) {
    throw new ApiLoggerError(
      `Failed to save API log: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Updates API metrics with proper error handling and atomic operations
 */
async function updateApiMetrics(logEntry: ApiLogEntry): Promise<void> {
  try {
    const sanitizedEndpoint = sanitizeEndpointPath(logEntry.endpoint);
    const metricsRef = db.collection(API_METRICS).doc(sanitizedEndpoint);
    
    const doc = await metricsRef.get();
    
    if (!doc.exists) {
      await metricsRef.set({
        endpoint: logEntry.endpoint,
        totalRequests: 1,
        lastRequest: Timestamp.fromDate(new Date()),
        successCount: logEntry.statusCode < 400 ? 1 : 0,
        errorCount: logEntry.statusCode >= 400 ? 1 : 0,
        averageResponseTime: logEntry.responseTime,
        lastUpdated: Timestamp.fromDate(new Date())
      });
    } else {
      const currentMetrics = doc.data() as ApiMetrics;
      const totalRequests = currentMetrics.totalRequests + 1;
      
      // Calculate new average response time
      const newAverageTime = (
        (currentMetrics.averageResponseTime * currentMetrics.totalRequests) + 
        logEntry.responseTime
      ) / totalRequests;

      await metricsRef.update({
        totalRequests: FieldValue.increment(1),
        lastRequest: Timestamp.fromDate(new Date()),
        successCount: FieldValue.increment(logEntry.statusCode < 400 ? 1 : 0),
        errorCount: FieldValue.increment(logEntry.statusCode >= 400 ? 1 : 0),
        averageResponseTime: newAverageTime,
        lastUpdated: Timestamp.fromDate(new Date())
      });
    }
  } catch (error) {
    throw new ApiLoggerError(
      `Failed to update API metrics: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Retrieves API metrics with proper error handling
 */
export async function getApiMetrics(endpoint: string): Promise<ApiMetrics | null> {
  try {
    if (!endpoint) {
      throw new ApiLoggerError('Endpoint is required', 400);
    }

    const sanitizedEndpoint = sanitizeEndpointPath(endpoint);
    const metricsRef = db.collection(API_METRICS).doc(sanitizedEndpoint);
    const metricsDoc = await metricsRef.get();
    
    if (!metricsDoc.exists) {
      return null;
    }

    const data = metricsDoc.data() as ApiMetrics;
    return {
      ...data,
      // Ensure dates are properly converted
      lastRequest: data.lastRequest instanceof Timestamp ? 
        data.lastRequest.toDate() : data.lastRequest,
      lastUpdated: data.lastUpdated instanceof Timestamp ? 
        data.lastUpdated.toDate() : data.lastUpdated
    };
  } catch (error) {
    if (error instanceof ApiLoggerError) {
      throw error;
    }
    throw new ApiLoggerError(
      `Failed to get API metrics: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}