/**
 * @openapi
 * /api/nodes/{nodeId}/inheritance:
 *   get:
 *     tags:
 *       - Node Inheritance
 *     summary: Get node inheritance rules
 *     description: Retrieves the inheritance structure for a node's properties
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the node
 *     responses:
 *       '200':
 *         description: Inheritance rules retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     inheritance:
 *                       $ref: '#/components/schemas/Inheritance'
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '404':
 *         $ref: '#/components/responses/NodeNotFound'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *   
 *   patch:
 *     tags:
 *       - Node Inheritance
 *     summary: Update inheritance rules
 *     description: Updates inheritance rules for multiple properties of a node
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the node
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - properties
 *               - reasoning
 *             properties:
 *               properties:
 *                 type: object
 *                 additionalProperties:
 *                   $ref: '#/components/schemas/InheritanceRule'
 *                 minProperties: 1
 *                 description: Map of property names to inheritance rules
 *               reasoning:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *                 description: Reason for updating the inheritance rules
 *     responses:
 *       '200':
 *         description: Inheritance rules updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     node:
 *                       $ref: '#/components/schemas/Node'
 *                     inheritance:
 *                       $ref: '#/components/schemas/Inheritance'
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '404':
 *         $ref: '#/components/responses/NodeNotFound'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 * 
 * /api/nodes/{nodeId}/inheritance/{propertyName}:
 *   patch:
 *     tags:
 *       - Node Inheritance
 *     summary: Update single property inheritance
 *     description: Updates inheritance rule for a specific property of a node
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the node
 *       - in: path
 *         name: propertyName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the property to update inheritance for
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - inheritanceType
 *               - reasoning
 *             properties:
 *               inheritanceType:
 *                 type: string
 *                 enum: [neverInherit, alwaysInherit, inheritUnlessAlreadyOverRidden, inheritAfterReview]
 *                 description: Type of inheritance to apply to the property
 *               reasoning:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *                 description: Reason for updating the inheritance rule
 *     responses:
 *       '200':
 *         description: Inheritance rule updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     node:
 *                       $ref: '#/components/schemas/Node'
 *                     inheritance:
 *                       $ref: '#/components/schemas/Inheritance'
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '404':
 *         $ref: '#/components/responses/NodeNotFound'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 * 
 * components:
 *   schemas:
 *     InheritanceRule:
 *       type: object
 *       required:
 *         - inheritanceType
 *       properties:
 *         inheritanceType:
 *           type: string
 *           enum: [neverInherit, alwaysInherit, inheritUnlessAlreadyOverRidden, inheritAfterReview]
 *           description: Type of inheritance to apply to the property
 *     
 *     Inheritance:
 *       type: object
 *       additionalProperties:
 *         $ref: '#/components/schemas/InheritanceRule'
 *       description: Map of property names to their inheritance rules
 *     
 *     Node:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         title:
 *           type: string
 *         deleted:
 *           type: boolean
 *         properties:
 *           type: object
 *         inheritance:
 *           $ref: '#/components/schemas/Inheritance'
 *     
 *     Metadata:
 *       type: object
 *       properties:
 *         clientId:
 *           type: string
 *         uname:
 *           type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 *         version:
 *           type: string
 *   
 *   responses:
 *     ValidationError:
 *       description: Validation error
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: false
 *               error:
 *                 type: string
 *               code:
 *                 type: string
 *                 example: VALIDATION_ERROR
 *               metadata:
 *                 $ref: '#/components/schemas/Metadata'
 *     
 *     NodeNotFound:
 *       description: Node not found
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: false
 *               error:
 *                 type: string
 *                 example: 'Node with ID "123" not found'
 *               code:
 *                 type: string
 *                 example: NODE_NOT_FOUND
 *               metadata:
 *                 $ref: '#/components/schemas/Metadata'
 *     
 *     InternalServerError:
 *       description: Internal server error
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: false
 *               error:
 *                 type: string
 *                 example: 'An unexpected error occurred. Please try again later.'
 *               code:
 *                 type: string
 *                 example: INTERNAL_SERVER_ERROR
 *               metadata:
 *                 $ref: '#/components/schemas/Metadata'
 */

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

class PropertyNotFoundError extends Error {
  constructor(propertyName: string) {
    super(`Property "${propertyName}" not found in node`);
    this.name = 'PropertyNotFoundError';
  }
}

class NodeOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NodeOperationError';
  }
}

class InheritanceOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InheritanceOperationError';
  }
}

// Type definitions
interface InheritanceRule {
  inheritanceType: InheritanceType['inheritanceType'];
}

interface InheritanceRequest {
  properties: {
    [propertyName: string]: InheritanceRule;
  };
  reasoning: string;
}

interface SinglePropertyInheritanceRequest {
  inheritanceType: InheritanceType['inheritanceType'];
  reasoning: string;
}

type InheritanceApiResponse = ApiResponse<{
  node?: INode;
  inheritance?: IInheritance;
}>;

const createMetadata = (clientId: string, uname?: string) => ({
  uname,
  clientId,
  timestamp: new Date().toISOString(),
  version: '1.0'
});

/**
 * Validates inheritance request data
 */
const validateInheritanceRequest = (request: any): void => {
  if (!request || typeof request !== 'object') {
    throw new ApiKeyValidationError('Invalid request format');
  }

  if (!request.properties || typeof request.properties !== 'object') {
    throw new ApiKeyValidationError('Properties must be provided as an object');
  }

  if (Object.keys(request.properties).length === 0) {
    throw new ApiKeyValidationError('At least one property must be specified');
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

  // Validate each property's inheritance type
  const validInheritanceTypes = [
    'neverInherit',
    'alwaysInherit',
    'inheritUnlessAlreadyOverRidden',
    'inheritAfterReview'
  ];

  for (const [property, rule] of Object.entries(request.properties)) {
    // Type check - make sure rule is an object
    if (!rule || typeof rule !== 'object') {
      throw new ApiKeyValidationError(`Invalid rule format for property "${property}"`);
    }
    
    // Cast rule to any to safely access properties for validation
    const ruleObj = rule as any;
    
    // Check if inheritanceType exists and is a string
    if (!ruleObj.inheritanceType || typeof ruleObj.inheritanceType !== 'string') {
      throw new ApiKeyValidationError(`Invalid or missing inheritanceType for property "${property}"`);
    }

    // Check if inheritanceType has a valid value
    if (!validInheritanceTypes.includes(ruleObj.inheritanceType)) {
      throw new ApiKeyValidationError(
        `Invalid inheritanceType for property "${property}". ` +
        `Must be one of: ${validInheritanceTypes.join(', ')}`
      );
    }
  }
};

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
/**
 * Error handler for API responses
 */
const handleApiError = (
  error: any,
  res: NextApiResponse<InheritanceApiResponse>,
  clientId: string = 'unknown'
): void => {
  console.error('API Error:', error);

  // Extract the original error message if it's wrapped
  const errorMessage = error.message || 'Unknown error';
  
  // Check for specific error message patterns to categorize the error
  if (errorMessage.includes('Property') && errorMessage.includes('not found in node')) {
    // This is a property not found error
    return res.status(400).json({
      success: false,
      error: errorMessage,
      code: 'PROPERTY_NOT_FOUND',
      metadata: createMetadata(clientId)
    });
  }
  
  // Determine the error type based on multiple properties
  let errorType = 'UNKNOWN';
  
  if (error instanceof ApiKeyValidationError || 
      error.name === 'ApiKeyValidationError' || 
      error.code === 'VALIDATION_ERROR' ||
      errorMessage.includes('Invalid') || 
      errorMessage.includes('required') ||
      errorMessage.includes('must be')) {
    errorType = 'VALIDATION_ERROR';
  } 
  else if (error instanceof NodeNotFoundError || 
           error.name === 'NodeNotFoundError' || 
           error.code === 'NODE_NOT_FOUND' ||
           errorMessage.includes('Node') && errorMessage.includes('not found')) {
    errorType = 'NODE_NOT_FOUND';
  }
  else if (error instanceof PropertyNotFoundError || 
           error.name === 'PropertyNotFoundError' || 
           error.code === 'PROPERTY_NOT_FOUND' ||
           errorMessage.includes('Property') && errorMessage.includes('not found')) {
    errorType = 'PROPERTY_NOT_FOUND';
  }
  else if (error instanceof NodeOperationError || 
           error.name === 'NodeOperationError' || 
           error.code === 'NODE_OPERATION_ERROR' ||
           errorMessage.includes('Cannot') && errorMessage.includes('node')) {
    errorType = 'NODE_OPERATION_ERROR';
  }
  else if (error instanceof InheritanceOperationError || 
           error.name === 'InheritanceOperationError' || 
           error.code === 'INHERITANCE_OPERATION_ERROR' ||
           errorMessage.includes('inheritance')) {
    errorType = 'INHERITANCE_OPERATION_ERROR';
  }

  // Use switch statement with the determined error type
  switch (errorType) {
    case 'VALIDATION_ERROR':
      res.status(400).json({
        success: false,
        error: errorMessage,
        code: 'VALIDATION_ERROR',
        metadata: createMetadata(clientId)
      });
      break;

    case 'NODE_NOT_FOUND':
      res.status(404).json({
        success: false,
        error: errorMessage,
        code: 'NODE_NOT_FOUND',
        metadata: createMetadata(clientId)
      });
      break;

    case 'PROPERTY_NOT_FOUND':
      res.status(400).json({
        success: false,
        error: errorMessage,
        code: 'PROPERTY_NOT_FOUND',
        metadata: createMetadata(clientId)
      });
      break;

    case 'NODE_OPERATION_ERROR':
      res.status(400).json({
        success: false,
        error: errorMessage,
        code: 'NODE_OPERATION_ERROR',
        metadata: createMetadata(clientId)
      });
      break;

    case 'INHERITANCE_OPERATION_ERROR':
      res.status(400).json({
        success: false,
        error: errorMessage,
        code: 'INHERITANCE_OPERATION_ERROR',
        metadata: createMetadata(clientId)
      });
      break;

    default:
      // Check if the error is wrapped (common pattern with "Failed to...")
      const wrappedErrorMatch = errorMessage.match(/Failed to .*?: (.*)/);
      if (wrappedErrorMatch && wrappedErrorMatch[1]) {
        // Use the inner error message for better clarity
        res.status(400).json({
          success: false,
          error: wrappedErrorMatch[1],
          code: 'OPERATION_ERROR',
          metadata: createMetadata(clientId)
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'An unexpected error occurred. Please try again later.',
          code: 'INTERNAL_SERVER_ERROR',
          metadata: createMetadata(clientId)
        });
      }
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
 * Main handler for inheritance endpoints
 */
async function methodHandler(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<InheritanceApiResponse>
) {
  try {
    const { nodeId } = req.query;
    
    if (!nodeId || typeof nodeId !== 'string') {
      throw new ApiKeyValidationError('Node ID must be provided as a string');
    }

    if (!nodeId.trim()) {
      throw new ApiKeyValidationError('Node ID cannot be empty');
    }

    // Verify node exists and is not deleted
    await verifyNodeExists(nodeId);

    switch (req.method) {
      case 'GET':
        return getInheritance(req, res, nodeId);
      case 'PATCH':
        return updateInheritance(req, res, nodeId);
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
 * GET /api/nodes/{nodeId}/inheritance
 * Retrieves the inheritance structure for a node
 */
async function getInheritance(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<InheritanceApiResponse>,
  nodeId: string
) {
  try {
    if (!req.apiKeyInfo) {
      throw new ApiKeyValidationError('Authentication required');
    }

    const node = await NodeService.getNode(nodeId);
    
    return res.status(200).json({
      success: true,
      data: {
        inheritance: node.inheritance
      },
      metadata: createMetadata(req.apiKeyInfo.clientId, req.apiKeyInfo.uname)
    });
  } catch (error) {
    handleApiError(error, res, req.apiKeyInfo?.clientId);
  }
}

/**
 * PATCH /api/nodes/{nodeId}/inheritance
 * Updates inheritance rules for multiple properties
 */
async function updateInheritance(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<InheritanceApiResponse>,
  nodeId: string
) {
  try {
    if (!req.apiKeyInfo) {
      throw new ApiKeyValidationError('Authentication required');
    }

    const request: InheritanceRequest = req.body;
    validateInheritanceRequest(request);

    // Call the NodeService to update the inheritance
    const updatedNode = await NodeInheritanceService.updateInheritance(
      nodeId,
      request.properties,
      req.apiKeyInfo.uname,
      request.reasoning
    );

    return res.status(200).json({
      success: true,
      data: {
        node: updatedNode,
        inheritance: updatedNode.inheritance
      },
      metadata: createMetadata(req.apiKeyInfo.clientId, req.apiKeyInfo.uname)
    });
  } catch (error) {
    handleApiError(error, res, req.apiKeyInfo?.clientId);
  }
}

export default validateApiKey(withApiLogger(methodHandler));