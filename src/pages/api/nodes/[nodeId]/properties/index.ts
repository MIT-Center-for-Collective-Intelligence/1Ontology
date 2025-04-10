/**
 * @openapi
 * tags:
 *   - name: Node Properties
 *     description: Management of node properties
 *     x-order: 2
 * 
 * /api/nodes/{nodeId}/properties:
 *   get:
 *     tags:
 *       - Node Properties
 *     summary: Get all properties of a node
 *     description: Retrieves all properties of a specified node with their types and inheritance information
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - name: nodeId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the node to retrieve properties from
 *     responses:
 *       '200':
 *         description: Properties retrieved successfully
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
 *                     nodeId:
 *                       type: string
 *                     properties:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             description: Name of the property
 *                           value:
 *                             type: object
 *                             description: Value of the property (can be any type)
 *                           type:
 *                             type: string
 *                             description: Type of the property
 *                             enum: [string, string-array, object, evaluationDimension, context, actor, preConditions, postConditions]
 *                           inheritance:
 *                             type: object
 *                             properties:
 *                               ref:
 *                                 type: string
 *                                 nullable: true
 *                                 description: Reference to the node from which this property is inherited
 *                               inheritanceType:
 *                                 type: string
 *                                 description: Type of inheritance rule applied to this property
 *                                 enum: [neverInherit, alwaysInherit, inheritUnlessAlreadyOverRidden, inheritAfterReview]
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     clientId:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *       '401':
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                 metadata:
 *                   type: object
 *       '404':
 *         description: Node not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                 metadata:
 *                   type: object
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                 metadata:
 *                   type: object
 *
 *   post:
 *     tags:
 *       - Node Properties
 *     summary: Create a new property for a node
 *     description: Creates a new property with the specified name, value, and optional type and inheritance rules
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - name: nodeId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the node to add property to
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - propertyName
 *               - value
 *               - reasoning
 *             properties:
 *               propertyName:
 *                 type: string
 *                 description: Name of the property to create
 *               value:
 *                 description: Value to set for the property (can be any type)
 *               reasoning:
 *                 type: string
 *                 description: Reasoning for creating the property
 *               inheritanceType:
 *                 type: string
 *                 description: Type of inheritance rule to apply to this property
 *                 enum: [neverInherit, alwaysInherit, inheritUnlessAlreadyOverRidden, inheritAfterReview]
 *               propertyType:
 *                 type: string
 *                 description: Type of the property
 *                 enum: [evaluationDimension, string-array, string, context, actor, object, preConditions, postConditions]
 *     responses:
 *       '201':
 *         description: Property created successfully
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
 *                     nodeId:
 *                       type: string
 *                     property:
 *                       type: string
 *                       description: Name of the created property
 *                     value:
 *                       description: Value set for the property
 *                     node:
 *                       type: object
 *                       description: Updated node object including the new property
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     clientId:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *       '400':
 *         description: Bad request - missing or invalid fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                 code:
 *                   type: string
 *                 metadata:
 *                   type: object
 *       '401':
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                 metadata:
 *                   type: object
 *       '404':
 *         description: Node not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                 metadata:
 *                   type: object
 *       '409':
 *         description: Property already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                 metadata:
 *                   type: object
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                 metadata:
 *                   type: object
 *
 *   patch:
 *     tags:
 *       - Node Properties
 *     summary: Update multiple properties of a node
 *     description: Updates multiple properties of a specified node in a single request
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - name: nodeId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the node to update properties for
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - updates
 *               - reasoning
 *             properties:
 *               updates:
 *                 type: array
 *                 description: List of property updates to apply
 *                 items:
 *                   type: object
 *                   required:
 *                     - propertyName
 *                     - value
 *                   properties:
 *                     propertyName:
 *                       type: string
 *                       description: Name of the property to update
 *                     value:
 *                       description: New value for the property (can be any type)
 *                     inheritanceType:
 *                       type: string
 *                       description: New inheritance type for the property
 *                       enum: [neverInherit, alwaysInherit, inheritUnlessAlreadyOverRidden, inheritAfterReview]
 *               reasoning:
 *                 type: string
 *                 description: Reasoning for updating the properties
 *     responses:
 *       '200':
 *         description: Properties updated successfully
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
 *                     nodeId:
 *                       type: string
 *                     updateResults:
 *                       type: array
 *                       description: Results for each property update
 *                       items:
 *                         type: object
 *                         properties:
 *                           propertyName:
 *                             type: string
 *                             description: Name of the updated property
 *                           success:
 *                             type: boolean
 *                             description: Whether the update was successful
 *                           value:
 *                             description: New value of the property
 *                           error:
 *                             type: string
 *                             description: Error message if the update failed
 *                     node:
 *                       type: object
 *                       description: Updated node object
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     clientId:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *       '400':
 *         description: Bad request - missing or invalid fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                 code:
 *                   type: string
 *                 metadata:
 *                   type: object
 *       '401':
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                 metadata:
 *                   type: object
 *       '404':
 *         description: Node not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                 metadata:
 *                   type: object
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                 metadata:
 *                   type: object
 */

import { withApiLogger } from " @components/middlewares/apiLogger";
import { validateApiKey } from " @components/middlewares/validateApiKey";
import { NodeService } from " @components/services/nodeService";
import { ApiResponse, ApiKeyValidationError, NextApiRequestWithAuth } from " @components/types/api";
import { INode } from " @components/types/INode";
import { NextApiResponse, NextApiRequest } from "next";

/**
 * Type for property details response
 */
interface PropertyDetails {
  name: string;
  value: any;
  type: string;
  inheritance: {
    ref: string | null;
    inheritanceType: string;
  };
}

/**
 * Type for node properties response (without full node)
 */
type NodePropertiesResponse = ApiResponse<{
  nodeId: string;
  properties: PropertyDetails[];
}>;

// Response type for property operations
type PropertyResponse = ApiResponse<{
  nodeId: string;
  property: string;
  value: any;
  node: INode;
}>;

/**
 * Represents a request to update a single property
 */
interface PropertyUpdateItem {
  propertyName: string;
  value: any;
  inheritanceType?: string;
}

/**
 * Represents a request to batch update multiple properties
 */
interface BatchPropertyUpdateRequest {
  updates: PropertyUpdateItem[];
  reasoning: string;
}

/**
 * Represents the result of a single property update
 */
interface PropertyUpdateResult {
  propertyName: string;
  success: boolean;
  value?: any;
  error?: string;
}

// Metadata generation helper
const createMetadata = (clientId: string) => ({
  clientId,
  timestamp: new Date().toISOString(),
});

const VALID_PROPERTY_TYPES = [
  "evaluationDimension",
  "string-array",
  "string",
  "context",
  "actor",
  "object",
  "preConditions",
  "postConditions"
];

/**
 * Helper function to validate that the value matches the specified type
 */
const validatePropertyTypeMatch = (propertyType: string, value: any): void => {
  switch (propertyType) {
    case 'string':
      if (typeof value !== 'string') {
        throw new ApiKeyValidationError(
          `Type mismatch: Property type is 'string' but value is ${Array.isArray(value) ? 'an array' : typeof value}`
        );
      }
      break;

    case 'string-array':
    case 'preConditions':
    case 'postConditions':
      if (!Array.isArray(value)) {
        throw new ApiKeyValidationError(
          `Type mismatch: Property type is '${propertyType}' but value is not an array`
        );
      }
      break;

    case 'object':
    case 'Objects':
      if (typeof value !== 'object' || Array.isArray(value) || value === null) {
        throw new ApiKeyValidationError(
          `Type mismatch: Property type is '${propertyType}' but value is ${Array.isArray(value) ? 'an array' : typeof value}`
        );
      }
      break;

    case 'evaluationDimension':
    case 'context':
    case 'actor':
      // Taccepting any value type for these types
      break;

    default:
      break;
  }
};

/**
 * Validates the create property request
 * @param request - The request to validate
 * @throws ApiKeyValidationError for validation failures
 */
const validatePropertyCreateRequest = async (request: any): Promise<void> => {
  const { propertyName, value, reasoning, inheritanceType, propertyType } = request;

  // Basic validation
  if (!propertyName) {
    throw new ApiKeyValidationError('Property name is required');
  }
  if (value === undefined) {
    throw new ApiKeyValidationError('Property value is required');
  }
  if (!reasoning) {
    throw new ApiKeyValidationError('Reasoning is required');
  }

  // Validate property type if provided
  if (propertyType && !VALID_PROPERTY_TYPES.includes(propertyType)) {
    throw new ApiKeyValidationError(`Invalid property type: '${propertyType}'. Must be one of: ${VALID_PROPERTY_TYPES.join(', ')}`);
  }

  // Validate inheritance type if provided
  if (inheritanceType && !['neverInherit', 'alwaysInherit', 'inheritUnlessAlreadyOverRidden', 'inheritAfterReview'].includes(inheritanceType)) {
    throw new ApiKeyValidationError('Invalid inheritance type');
  }

  // Property-specific validation
  if (['id', 'title', 'deleted', 'inheritance', 'specializations', 'generalizations', 'root', 'propertyType', 'nodeType', 'textValue', 'createdBy', 'propertyOf', 'contributors', 'contributorsByProperty', 'locked'].includes(propertyName)) {
    throw new ApiKeyValidationError(`The property name '${propertyName}' is reserved and cannot be used for custom properties`);
  }

  // Property-specific structure validation for collections
  if (propertyName === 'parts' || propertyName === 'isPartOf') {
    if (!Array.isArray(value) || !value.every(collection =>
      collection.collectionName && Array.isArray(collection.nodes))) {
      throw new ApiKeyValidationError(`Invalid ${propertyName} structure`);
    }
  }

  // Validate type match if propertyType is provided
  if (propertyType) {
    validatePropertyTypeMatch(propertyType, value);
  }
};

/**
 * Validates a batch property update request
 * @param request - The request to validate
 * @param node - The current node data for validation against existing properties
 * @throws ApiKeyValidationError for validation failures
 */
const validateBatchPropertyUpdateRequest = async (
  request: BatchPropertyUpdateRequest,
  node: INode
): Promise<void> => {
  if (!request.reasoning) {
    throw new ApiKeyValidationError('Reasoning is required');
  }

  if (!request.updates || !Array.isArray(request.updates) || request.updates.length === 0) {
    throw new ApiKeyValidationError('At least one property update is required');
  }

  // Validate each property update
  for (const update of request.updates) {
    if (!update.propertyName) {
      throw new ApiKeyValidationError('Property name is required for each update');
    }

    if (update.value === undefined) {
      throw new ApiKeyValidationError(`Value is required for property '${update.propertyName}'`);
    }

    // Validate inheritance type if provided
    if (update.inheritanceType &&
      !['neverInherit', 'alwaysInherit', 'inheritUnlessAlreadyOverRidden', 'inheritAfterReview'].includes(update.inheritanceType)) {
      throw new ApiKeyValidationError(`Invalid inheritance type for property '${update.propertyName}'`);
    }

    // Check if property exists in the node
    if (!(update.propertyName in node.properties)) {
      throw new ApiKeyValidationError(`Property '${update.propertyName}' does not exist on node`);
    }

    // Reserved properties cannot be updated
    if (['id', 'title', 'deleted', 'inheritance', 'specializations', 'generalizations', 'root', 'propertyType', 'nodeType', 'textValue', 'createdBy', 'propertyOf', 'contributors', 'contributorsByProperty', 'locked'].includes(update.propertyName)) {
      throw new ApiKeyValidationError(`The property '${update.propertyName}' is reserved and cannot be updated`);
    }

    // Property type validation - ensure new value matches existing property type
    const existingPropertyType = node.propertyType[update.propertyName];
    validateValueMatchesPropertyType(update.value, existingPropertyType, update.propertyName);
  }

  // Check for duplicate property names
  const propertyNames = request.updates.map(update => update.propertyName);
  const uniquePropertyNames = new Set(propertyNames);
  if (propertyNames.length !== uniquePropertyNames.size) {
    throw new ApiKeyValidationError('Duplicate property names found in update request');
  }
};

/**
 * Validates that a value matches the expected property type
 * @param value - The value to validate
 * @param propertyType - The expected property type
 * @param propertyName - The name of the property (for error messages)
 * @throws ApiKeyValidationError if validation fails
 */
const validateValueMatchesPropertyType = (
  value: any,
  propertyType: string,
  propertyName: string
): void => {
  switch (propertyType) {
    case 'string':
      if (typeof value !== 'string') {
        throw new ApiKeyValidationError(
          `Type mismatch for property '${propertyName}': Expected type 'string' but got ${Array.isArray(value) ? 'array' : typeof value}`
        );
      }
      break;

    case 'string-array':
    case 'preConditions':
    case 'postConditions':
      if (!Array.isArray(value)) {
        throw new ApiKeyValidationError(
          `Type mismatch for property '${propertyName}': Expected type '${propertyType}' but got ${typeof value}`
        );
      }
      break;

    case 'object':
    case 'Objects':
      if (typeof value !== 'object' || Array.isArray(value) || value === null) {
        throw new ApiKeyValidationError(
          `Type mismatch for property '${propertyName}': Expected type '${propertyType}' but got ${Array.isArray(value) ? 'array' : typeof value}`
        );
      }
      break;

    case 'evaluationDimension':
    case 'context':
    case 'actor':
      // Domain-specific types with custom validation if needed
      break;

    default:
      // For any other property types
      break;
  }

  // Special validation for parts and isPartOf properties
  if ((propertyName === 'parts' || propertyName === 'isPartOf') &&
    (!Array.isArray(value) || !value.every(collection =>
      collection.collectionName && Array.isArray(collection.nodes)))) {
    throw new ApiKeyValidationError(`Invalid structure for '${propertyName}' property`);
  }
};


/**
 * Handles GET requests to retrieve all properties of a node
 */
async function handleGet(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<NodePropertiesResponse>
): Promise<void> {
  const nodeId = req.query.nodeId as string;
  const clientId = req.apiKeyInfo?.clientId || 'unknown';

  try {
    // Get the node
    const node = await NodeService.getNode(nodeId);

    // Format properties into the desired structure
    const properties: PropertyDetails[] = Object.keys(node.properties).map(propertyName => ({
      name: propertyName,
      value: node.properties[propertyName],
      type: node.propertyType[propertyName] || 'string', // Default to string if not specified
      inheritance: node.inheritance[propertyName] || {
        ref: null,
        inheritanceType: 'inheritUnlessAlreadyOverRidden'
      }
    }));

    return res.status(200).json({
      success: true,
      data: {
        nodeId,
        properties
      },
      metadata: createMetadata(clientId)
    });
  } catch (error) {
    console.error(`Error retrieving node properties:`, error);

    if (typeof error === 'object' && error !== null && 'message' in error) {
      const errorMessage = (error as Error).message;

      if (errorMessage === 'Node not found') {
        return res.status(404).json({
          success: false,
          error: 'Node not found',
          metadata: createMetadata(clientId)
        });
      }
    }

    return res.status(500).json({
      success: false,
      error: `Failed to retrieve node properties`,
      metadata: createMetadata(clientId)
    });
  }
}

/**
 * Handles POST requests to create a new property
 */
async function handlePost(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<PropertyResponse>
): Promise<void> {
  const nodeId = req.query.nodeId as string;
  const clientId = req.apiKeyInfo?.clientId || 'unknown';

  try {
    // Validate request
    await validatePropertyCreateRequest(req.body);

    const { propertyName, value, reasoning, inheritanceType, propertyType } = req.body;

    // Use the optimized addNodeProperty method
    const updatedNode = await NodeService.addNodeProperty(
      nodeId,
      propertyName,
      value,
      req.apiKeyInfo.uname,
      reasoning,
      inheritanceType, // This will default to "inheritUnlessAlreadyOverRidden" in the service
      propertyType
    );

    return res.status(201).json({
      success: true,
      data: {
        nodeId,
        property: propertyName,
        value: updatedNode.properties[propertyName],
        node: updatedNode
      },
      metadata: createMetadata(clientId)
    });
  } catch (error) {
    console.error(`Error creating property:`, error);

    if (error instanceof ApiKeyValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code,
        metadata: createMetadata(clientId)
      });
    }

    if (typeof error === 'object' && error !== null && 'message' in error) {
      const errorMessage = (error as Error).message;

      if (errorMessage === 'Node not found') {
        return res.status(404).json({
          success: false,
          error: 'Node not found',
          metadata: createMetadata(clientId)
        });
      }

      if (errorMessage.includes('already exists')) {
        return res.status(409).json({
          success: false,
          error: errorMessage,
          metadata: createMetadata(clientId)
        });
      }
    }

    return res.status(500).json({
      success: false,
      error: `Failed to create property`,
      metadata: createMetadata(clientId)
    });
  }
}

/**
 * Handles PATCH requests to update multiple properties
 */
async function handlePatch(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<ApiResponse<{
    nodeId: string;
    updateResults: PropertyUpdateResult[];
    node: INode;
  }>>
): Promise<void> {
  const nodeId = req.query.nodeId as string;
  const clientId = req.apiKeyInfo?.clientId || 'unknown';

  try {
    // Get the current node to validate against
    const node = await NodeService.getNode(nodeId);

    // Validate request
    const batchRequest = req.body as BatchPropertyUpdateRequest;
    await validateBatchPropertyUpdateRequest(batchRequest, node);

    // Prepare updates
    const propertyUpdates: { [key: string]: any } = {};
    const inheritanceUpdates: { [key: string]: string } = {};

    for (const update of batchRequest.updates) {
      propertyUpdates[update.propertyName] = update.value;
      if (update.inheritanceType) {
        inheritanceUpdates[update.propertyName] = update.inheritanceType;
      }
    }

    // Update properties
    const { node: updatedNode, updatedProperties } = await NodeService.updateNodeProperties(
      nodeId,
      propertyUpdates,
      req.apiKeyInfo.uname,
      batchRequest.reasoning,
      inheritanceUpdates,
      undefined, // No properties to delete
      undefined  // No property type updates
    );

    // Prepare response with results for each property
    const updateResults: PropertyUpdateResult[] = batchRequest.updates.map(update => ({
      propertyName: update.propertyName,
      success: updatedProperties.includes(update.propertyName),
      value: updatedNode.properties[update.propertyName]
    }));

    return res.status(200).json({
      success: true,
      data: {
        nodeId,
        updateResults,
        node: updatedNode
      },
      metadata: createMetadata(clientId)
    });
  } catch (error) {
    console.error(`Error updating properties:`, error);

    if (error instanceof ApiKeyValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code,
        metadata: createMetadata(clientId)
      });
    }

    if (typeof error === 'object' && error !== null && 'message' in error) {
      const errorMessage = (error as Error).message;

      if (errorMessage === 'Node not found') {
        return res.status(404).json({
          success: false,
          error: 'Node not found',
          metadata: createMetadata(clientId)
        });
      }
    }

    return res.status(500).json({
      success: false,
      error: `Failed to update properties`,
      metadata: createMetadata(clientId)
    });
  }
}

/**
 * Main request handler that routes to appropriate method handlers
 */
async function methodHandler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', ['GET', 'POST', 'PATCH']);
    res.status(204).end();
    return;
  }

  // Ensure authentication
  const authReq = req as NextApiRequestWithAuth;
  if (!authReq.apiKeyInfo) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      metadata: createMetadata('unknown')
    });
  }

  // Route to appropriate handler based on HTTP method
  switch (req.method) {
    case 'GET':
      return handleGet(authReq, res);
    case 'POST':
      return handlePost(authReq, res);
    case 'PATCH':
      return handlePatch(authReq, res);
    default:
      res.setHeader('Allow', ['GET', 'POST', 'PATCH']);
      return res.status(405).json({
        success: false,
        error: `Method ${req.method} Not Allowed`,
        metadata: createMetadata(authReq.apiKeyInfo?.clientId || 'unknown')
      });
  }
}

// Export the handler with middleware applied
export default validateApiKey(withApiLogger(methodHandler));