import { NextApiRequest, NextApiResponse } from 'next';
import { validateApiKey } from ' @components/middlewares/validateApiKey';
import { withApiLogger } from ' @components/middlewares/apiLogger';
import { ApiKeyValidationError, ApiResponse, NextApiRequestWithAuth } from ' @components/types/api';
import { INode, IInheritance, InheritanceType } from ' @components/types/INode';
import { NodeService } from ' @components/services/nodeService';
import { NodeInheritanceService } from ' @components/services/nodeInheritanceService';

// Custom error classes for specific error scenarios
class NodeNotFoundError extends Error {
  constructor(nodeId: string) {
    super(`Node with ID "${nodeId}" not found`);
    this.name = 'NodeNotFoundError';
  }
}

class NodeOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NodeOperationError';
  }
}

class PropertyNotFoundError extends Error {
  constructor(propertyName: string) {
    super(`Property "${propertyName}" not found in node`);
    this.name = 'PropertyNotFoundError';
  }
}

class InheritanceOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InheritanceOperationError';
  }
}

// Type definitions
interface SinglePropertyInheritanceRequest {
  inheritanceType: InheritanceType['inheritanceType'];
  reasoning: string;
}

type PropertyInheritanceApiResponse = ApiResponse<{
  node?: INode;
  propertyInheritance?: {
    property: string;
    inheritance: any;
  };
}>;

const createMetadata = (clientId: string, uname?: string) => ({
  uname,
  clientId,
  timestamp: new Date().toISOString(),
  version: '1.0'
});

/**
 * Validates a single property inheritance request
 */
const validateSinglePropertyInheritanceRequest = (request: any): void => {
  if (!request || typeof request !== 'object') {
    throw new ApiKeyValidationError('Invalid request format');
  }

  if (!request.inheritanceType || typeof request.inheritanceType !== 'string') {
    throw new ApiKeyValidationError('inheritanceType must be provided as a string');
  }

  const validInheritanceTypes = [
    'neverInherit',
    'alwaysInherit',
    'inheritUnlessAlreadyOverRidden',
    'inheritAfterReview'
  ];

  if (!validInheritanceTypes.includes(request.inheritanceType)) {
    throw new ApiKeyValidationError(
      `Invalid inheritanceType. Must be one of: ${validInheritanceTypes.join(', ')}`
    );
  }

  if (!request.reasoning || typeof request.reasoning !== 'string') {
    throw new ApiKeyValidationError('Reasoning must be provided as a string');
  }

  if (!request.reasoning.trim()) {
    throw new ApiKeyValidationError('Reasoning cannot be empty');
  }

  if (request.reasoning.length > 1000) {
    throw new ApiKeyValidationError('Reasoning must not exceed 1000 characters');
  }
};

/**
 * Error handler for API responses
 */
const handleApiError = (
  error: any,
  res: NextApiResponse<PropertyInheritanceApiResponse>,
  clientId: string = 'unknown'
): void => {
  console.error('API Error:', error);

  // Determine the error type based on multiple properties
  let errorType = 'UNKNOWN';
  
  if (error instanceof ApiKeyValidationError || 
      error.name === 'ApiKeyValidationError' || 
      error.code === 'VALIDATION_ERROR') {
    errorType = 'VALIDATION_ERROR';
  } 
  else if (error instanceof NodeNotFoundError || 
           error.name === 'NodeNotFoundError' || 
           error.code === 'NODE_NOT_FOUND') {
    errorType = 'NODE_NOT_FOUND';
  }
  else if (error instanceof PropertyNotFoundError || 
           error.name === 'PropertyNotFoundError' || 
           error.code === 'PROPERTY_NOT_FOUND') {
    errorType = 'PROPERTY_NOT_FOUND';
  }
  else if (error instanceof NodeOperationError || 
           error.name === 'NodeOperationError' || 
           error.code === 'NODE_OPERATION_ERROR') {
    errorType = 'NODE_OPERATION_ERROR';
  }
  else if (error instanceof InheritanceOperationError || 
           error.name === 'InheritanceOperationError' || 
           error.code === 'INHERITANCE_OPERATION_ERROR') {
    errorType = 'INHERITANCE_OPERATION_ERROR';
  }

  // Use switch statement with the determined error type
  switch (errorType) {
    case 'VALIDATION_ERROR':
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'VALIDATION_ERROR',
        metadata: createMetadata(clientId)
      });
      break;

    case 'NODE_NOT_FOUND':
      res.status(404).json({
        success: false,
        error: error.message,
        code: 'NODE_NOT_FOUND',
        metadata: createMetadata(clientId)
      });
      break;

    case 'PROPERTY_NOT_FOUND':
      res.status(404).json({
        success: false,
        error: error.message,
        code: 'PROPERTY_NOT_FOUND',
        metadata: createMetadata(clientId)
      });
      break;

    case 'NODE_OPERATION_ERROR':
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'NODE_OPERATION_ERROR',
        metadata: createMetadata(clientId)
      });
      break;

    case 'INHERITANCE_OPERATION_ERROR':
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'INHERITANCE_OPERATION_ERROR',
        metadata: createMetadata(clientId)
      });
      break;

    default:
      res.status(500).json({
        success: false,
        error: 'An unexpected error occurred. Please try again later.',
        code: 'INTERNAL_SERVER_ERROR',
        metadata: createMetadata(clientId)
      });
  }
};

/**
 * Verifies that a node exists and is not deleted
 */
const verifyNodeExists = async (nodeId: string): Promise<INode> => {
  try {
    const node = await NodeService.getNode(nodeId);
    if (node.deleted) {
      throw new NodeOperationError('Cannot modify a deleted node');
    }
    return node;
  } catch (error) {
    if (error instanceof NodeOperationError) {
      throw error;
    }
    throw new NodeNotFoundError(nodeId);
  }
};

/**
 * Verifies that a property exists in a node
 */
const verifyPropertyExists = (node: INode, propertyName: string): void => {
  if (!propertyName || typeof propertyName !== 'string') {
    throw new ApiKeyValidationError('Property name must be provided as a string');
  }

  if (!propertyName.trim()) {
    throw new ApiKeyValidationError('Property name cannot be empty');
  }

  if (!(propertyName in node.properties)) {
    throw new PropertyNotFoundError(propertyName);
  }
};

/**
 * Main handler for property inheritance endpoints
 */
async function methodHandler(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<PropertyInheritanceApiResponse>
) {
  try {
    const { nodeId, propertyName } = req.query;
    
    if (!nodeId || typeof nodeId !== 'string') {
      throw new ApiKeyValidationError('Node ID must be provided as a string');
    }

    if (!nodeId.trim()) {
      throw new ApiKeyValidationError('Node ID cannot be empty');
    }

    if (!propertyName || typeof propertyName !== 'string') {
      throw new ApiKeyValidationError('Property name must be provided as a string');
    }

    if (!propertyName.trim()) {
      throw new ApiKeyValidationError('Property name cannot be empty');
    }

    // Verify node exists and is not deleted
    const node = await verifyNodeExists(nodeId);

    // Verify property exists in the node
    verifyPropertyExists(node, propertyName);

    switch (req.method) {
      case 'GET':
        return getPropertyInheritance(req, res, node, propertyName);
      case 'PATCH':
        return updatePropertyInheritance(req, res, nodeId, propertyName);
      default:
        res.setHeader('Allow', ['GET', 'PATCH']);
        return res.status(405).json({
          success: false,
          error: `Method ${req.method} Not Allowed`,
          code: 'METHOD_NOT_ALLOWED',
          metadata: createMetadata(req.apiKeyInfo?.clientId || 'unknown')
        });
    }
  } catch (error) {
    handleApiError(error, res, req.apiKeyInfo?.clientId);
  }
}

/**
 * GET /api/nodes/{nodeId}/properties/{propertyName}/inheritance
 * Retrieves the inheritance rule for a specific property
 */
async function getPropertyInheritance(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<PropertyInheritanceApiResponse>,
  node: INode,
  propertyName: string
) {
  try {
    if (!req.apiKeyInfo) {
      throw new ApiKeyValidationError('Authentication required');
    }

    const propertyInheritance = node.inheritance[propertyName] || {
      ref: null,
      inheritanceType: 'inheritUnlessAlreadyOverRidden' // Default inheritance type
    };
    
    return res.status(200).json({
      success: true,
      data: {
        propertyInheritance: {
          property: propertyName,
          inheritance: propertyInheritance
        }
      },
      metadata: createMetadata(req.apiKeyInfo.clientId, req.apiKeyInfo.uname)
    });
  } catch (error) {
    handleApiError(error, res, req.apiKeyInfo?.clientId);
  }
}

/**
 * PATCH /api/nodes/{nodeId}/properties/{propertyName}/inheritance
 * Updates the inheritance rule for a specific property
 */
async function updatePropertyInheritance(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<PropertyInheritanceApiResponse>,
  nodeId: string,
  propertyName: string
) {
  try {
    if (!req.apiKeyInfo) {
      throw new ApiKeyValidationError('Authentication required');
    }

    const request: SinglePropertyInheritanceRequest = req.body;
    validateSinglePropertyInheritanceRequest(request);

    // Call the NodeService to update the property inheritance
    const updatedNode = await NodeInheritanceService.updatePropertyInheritance(
      nodeId,
      propertyName,
      request.inheritanceType,
      req.apiKeyInfo.uname,
      request.reasoning
    );

    return res.status(200).json({
      success: true,
      data: {
        node: updatedNode,
        propertyInheritance: {
          property: propertyName,
          inheritance: updatedNode.inheritance[propertyName]
        }
      },
      metadata: createMetadata(req.apiKeyInfo.clientId, req.apiKeyInfo.uname)
    });
  } catch (error) {
    handleApiError(error, res, req.apiKeyInfo?.clientId);
  }
}

export default validateApiKey(withApiLogger(methodHandler));