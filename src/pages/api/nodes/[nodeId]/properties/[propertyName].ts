/**
 * @openapi
 * /api/nodes/{nodeId}/properties/{propertyName}:
 *   get:
 *     tags:
 *       - Node Properties
 *     summary: Get node property
 *     description: Retrieves a specific property value from a node
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
 *         description: Name of the property to retrieve
 *     responses:
 *       '200':
 *         description: Property retrieved successfully
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
 *                     value:
 *                       type: object
 *                       description: The property value (can be any type)
 *                     node:
 *                       $ref: '#/components/schemas/Node'
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
 *       '404':
 *         description: Node or property not found
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
 *                   example: "Property 'propertyName' not found on node"
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
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
 *                   example: "Internal server error occurred while retrieving property 'propertyName'"
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
 *   
 *   patch:
 *     tags:
 *       - Node Properties
 *     summary: Update node property
 *     description: Updates a specific property on a node
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
 *         description: Name of the property to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - value
 *               - reasoning
 *             properties:
 *               value:
 *                 description: New value for the property (can be any type)
 *               reasoning:
 *                 type: string
 *                 description: Reasoning for updating the property
 *               inheritanceType:
 *                 type: string
 *                 enum: [neverInherit, alwaysInherit, inheritUnlessAlreadyOverRidden, inheritAfterReview]
 *                 description: Inheritance behavior for this property
 *               propertyType:
 *                 type: string
 *                 description: Type of the property (auto-inferred if not provided)
 *     responses:
 *       '200':
 *         description: Property updated successfully
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
 *                     value:
 *                       description: The updated property value
 *                     node:
 *                       $ref: '#/components/schemas/Node'
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
 *       '400':
 *         description: Bad request - validation error
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
 *                   example: "Invalid inheritance type"
 *                 code:
 *                   type: string
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
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
 *                   example: "Node not found"
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
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
 *                   example: "Failed to update property 'propertyName'"
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
 *
 *   delete:
 *     tags:
 *       - Node Properties
 *     summary: Delete node property
 *     description: Removes a specific property from a node
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
 *         description: Name of the property to delete
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reasoning
 *             properties:
 *               reasoning:
 *                 type: string
 *                 description: Reasoning for deleting the property
 *     responses:
 *       '200':
 *         description: Property deleted successfully
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
 *                     value:
 *                       type: null
 *                     node:
 *                       $ref: '#/components/schemas/Node'
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
 *       '400':
 *         description: Bad request - validation error or core property
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
 *                   example: "The 'parts' property cannot be deleted as it is a core property"
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
 *       '404':
 *         description: Node or property not found
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
 *                   example: "Property 'propertyName' not found on node"
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
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
 *                   example: "Failed to delete property 'propertyName'"
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
 * 
 * components:
 *   schemas:
 *     Node:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         title:
 *           type: string
 *         properties:
 *           type: object
 *           additionalProperties: true
 *           description: Map of property names to their values
 *         propertyType:
 *           type: object
 *           additionalProperties: true
 *           description: Map of property names to their types
 *     
 *     Metadata:
 *       type: object
 *       properties:
 *         clientId:
 *           type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 */

import { withApiLogger } from " @components/middlewares/apiLogger";
import { validateApiKey } from " @components/middlewares/validateApiKey";
import { NodeService } from " @components/services/nodeService";
import { ApiResponse, ApiKeyValidationError, NextApiRequestWithAuth } from " @components/types/api";
import { INode } from " @components/types/INode";
import { NextApiResponse, NextApiRequest } from "next";


// Response type for property operations
type PropertyResponse = ApiResponse<{
  nodeId: string;
  property: string;
  value: any;
  node: INode;
}>;

// Metadata generation helper
const createMetadata = (clientId: string) => ({
  clientId,
  timestamp: new Date().toISOString(),
});

/**
 * Validates the update property request
 * @param request - The request to validate
 * @param propertyName - The name of the property being updated
 * @throws ApiKeyValidationError for validation failures
 */
const validatePropertyUpdateRequest = async (request: any, propertyName: string): Promise<void> => {
  const { value, reasoning, inheritanceType } = request;

  // Basic validation
  if (value === undefined) {
    throw new ApiKeyValidationError('Property value is required');
  }
  if (!reasoning) {
    throw new ApiKeyValidationError('Reasoning is required');
  }

  // Validate inheritance type if provided
  if (inheritanceType && !['neverInherit', 'alwaysInherit', 'inheritUnlessAlreadyOverRidden', 'inheritAfterReview'].includes(inheritanceType)) {
    throw new ApiKeyValidationError('Invalid inheritance type');
  }

  // Property-specific validation could be added here
  // For example, validating parts or isPartOf structure
  if (propertyName === 'parts' || propertyName === 'isPartOf') {
    if (!Array.isArray(value) || !value.every(collection =>
      collection.collectionName && Array.isArray(collection.nodes))) {
      throw new ApiKeyValidationError(`Invalid ${propertyName} structure`);
    }
  }
};

/**
 * Handles GET requests to retrieve a specific property
 */
async function handleGet(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<PropertyResponse>
): Promise<void> {
  const nodeId = req.query.nodeId as string;
  const propertyName = req.query.propertyName as string;
  const clientId = req.apiKeyInfo?.clientId || 'unknown';

  try {
    const node = await NodeService.getNode(nodeId);

    // Check if property exists
    if (!(propertyName in node.properties)) {
      return res.status(404).json({
        success: false,
        error: `Property '${propertyName}' not found on node`,
        metadata: createMetadata(clientId)
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        nodeId,
        property: propertyName,
        value: node.properties[propertyName],
        node
      },
      metadata: createMetadata(clientId)
    });
  } catch (error: any) {
    if (error.message === 'Node not found') {
      return res.status(404).json({
        success: false,
        error: 'Node not found',
        metadata: createMetadata(clientId)
      });
    }

    console.error(`Error retrieving property '${propertyName}':`, error);
    return res.status(500).json({
      success: false,
      error: `Internal server error occurred while retrieving property '${propertyName}'`,
      metadata: createMetadata(clientId)
    });
  }
}

/**
 * Handles PATCH requests to update a specific property
 */
async function handlePatch(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<PropertyResponse>
): Promise<void> {
  const nodeId = req.query.nodeId as string;
  const propertyName = req.query.propertyName as string;
  const clientId = req.apiKeyInfo?.clientId || 'unknown';

  try {
    // Get the current node first
    const node = await NodeService.getNode(nodeId);

    // Validate request
    await validatePropertyUpdateRequest(req.body, propertyName);

    const { value, reasoning, inheritanceType, propertyType } = req.body;

    // Prepare property update
    const propertyUpdate = { [propertyName]: value };

    // Prepare inheritance rules if provided
    const inheritanceRules = inheritanceType ? { [propertyName]: inheritanceType } : undefined;

    // Determine property type if not explicitly provided
    let propertyTypeUpdate = {};
    if (propertyType) {
      // If property type is explicitly provided, use it
      propertyTypeUpdate = { [`propertyType.${propertyName}`]: propertyType };
    } else if (!(propertyName in node.propertyType)) {
      // If this is a new property and type is not provided, infer it
      let inferredType = 'string'; // Default type

      if (Array.isArray(value)) {
        // Check if it's a collection of nodes
        if (value.length > 0 && value[0]?.collectionName === 'main' && value[0]?.nodes) {
          // For collection-based properties, we typically use a specific type or default to string-array
          inferredType = 'string-array';

          // Try to find nodes with type information, but don't rely on it for the final type
          const nodeIds = value[0].nodes
            .filter((n: { id: any; }) => n.id)
            .map((n: { id: any; }) => n.id);

          if (nodeIds.length > 0) {
            // Use the first node's type if we can determine it (default to string-array if not)
            const potentialType = node.propertyType[nodeIds[0]];
            if (typeof potentialType === 'string' && potentialType) {
              inferredType = potentialType;
            }
          }
        } else {
          // Regular array
          inferredType = 'string-array';
        }
      } else if (typeof value === 'object' && value !== null) {
        inferredType = 'object';
      }

      propertyTypeUpdate = { [`propertyType.${propertyName}`]: inferredType };
    }

    // Merge updates
    const updates = {
      ...propertyUpdate,
      ...propertyTypeUpdate
    };

    // Update node property
    const { node: updatedNode, updatedProperties } = await NodeService.updateNodeProperties(
      nodeId,
      propertyUpdate,
      req.apiKeyInfo.uname,
      reasoning,
      inheritanceRules,
      undefined, // No properties to delete
      propertyTypeUpdate // Pass property type updates separately
    );

    return res.status(200).json({
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
    console.error(`Error updating property '${propertyName}':`, error);

    if (error instanceof ApiKeyValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code,
        metadata: createMetadata(clientId)
      });
    }

    if (typeof error === 'object' && error !== null && 'message' in error) {
      if (error.message === 'Node not found') {
        return res.status(404).json({
          success: false,
          error: 'Node not found',
          metadata: createMetadata(clientId)
        });
      }
    }

    return res.status(500).json({
      success: false,
      error: `Failed to update property '${propertyName}'`,
      metadata: createMetadata(clientId)
    });
  }
}

/**
 * Handles DELETE requests to remove a specific property
 */
/**
 * Handles DELETE requests to remove a specific property
 */
async function handleDelete(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<PropertyResponse>
): Promise<void> {
  const nodeId = req.query.nodeId as string;
  const propertyName = req.query.propertyName as string;
  const clientId = req.apiKeyInfo?.clientId || 'unknown';

  // Get reasoning from request body instead of query parameters
  const { reasoning } = req.body || {};

  try {
    // Validate reasoning
    if (!reasoning) {
      return res.status(400).json({
        success: false,
        error: 'Reasoning is required for property deletion',
        metadata: createMetadata(clientId)
      });
    }

    // Certain properties cannot be deleted
    if (['parts', 'isPartOf'].includes(propertyName)) {
      return res.status(400).json({
        success: false,
        error: `The '${propertyName}' property cannot be deleted as it is a core property`,
        metadata: createMetadata(clientId)
      });
    }

    // Get the current node to check if property exists
    const node = await NodeService.getNode(nodeId);

    if (!(propertyName in node.properties)) {
      return res.status(404).json({
        success: false,
        error: `Property '${propertyName}' not found on node`,
        metadata: createMetadata(clientId)
      });
    }

    // Handle property deletion through updateNodeProperties
    const result = await NodeService.updateNodeProperties(
      nodeId,
      {}, // No properties to update
      req.apiKeyInfo.clientId,
      reasoning,
      undefined, // No inheritance rules
      [propertyName] // Property to delete
    );

    return res.status(200).json({
      success: true,
      data: {
        nodeId,
        property: propertyName,
        value: null,
        node: result.node
      },
      metadata: createMetadata(clientId)
    });
  } catch (error: any) {
    console.error(`Error deleting property '${propertyName}':`, error);

    if (error.message === 'Node not found') {
      return res.status(404).json({
        success: false,
        error: 'Node not found',
        metadata: createMetadata(clientId)
      });
    }

    return res.status(500).json({
      success: false,
      error: `Failed to delete property '${propertyName}'`,
      metadata: createMetadata(clientId)
    });
  }
}

/**
 * Main request handler that routes to appropriate method handlers
 */
async function methodHandler(
  req: NextApiRequest,
  res: NextApiResponse<PropertyResponse>
): Promise<void> {
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
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
    case 'PATCH':
      return handlePatch(authReq, res);
    case 'DELETE':
      return handleDelete(authReq, res);
    default:
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
      return res.status(405).json({
        success: false,
        error: `Method ${req.method} Not Allowed`,
        metadata: createMetadata(authReq.apiKeyInfo?.clientId || 'unknown')
      });
  }
}

// Export the handler with middleware applied
export default validateApiKey(withApiLogger(methodHandler));