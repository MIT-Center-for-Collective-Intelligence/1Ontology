/**
 * @openapi
 * /api/nodes/{nodeId}/properties/{propertyName}:
 *   get:
 *     tags:
 *       - Node Properties
 *     summary: Get a specific property of a node
 *     description: Retrieves a specific property of a node by name, including its value, type and inheritance information
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - name: nodeId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the node
 *       - name: propertyName
 *         in: path
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
 *                       description: Name of the retrieved property
 *                     value:
 *                       description: Value of the property (can be any type)
 *                     type:
 *                       type: string
 *                       description: Type of the property
 *                       enum: [string, string-array, object, evaluationDimension, context, actor, preConditions, postConditions]
 *                     inheritance:
 *                       type: object
 *                       properties:
 *                         ref:
 *                           type: string
 *                           nullable: true
 *                           description: Reference to the node from which this property is inherited
 *                         inheritanceType:
 *                           type: string
 *                           description: Type of inheritance rule applied to this property
 *                           enum: [neverInherit, alwaysInherit, inheritUnlessAlreadyOverRidden, inheritAfterReview]
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
 *   delete:
 *     tags:
 *       - Node Properties
 *     summary: Delete a specific property from a node
 *     description: Deletes a specific property from a node by name
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - name: nodeId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the node
 *       - name: propertyName
 *         in: path
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
 *                       description: Name of the deleted property
 *                     value:
 *                       description: Value of the deleted property (can be any type)
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     clientId:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *       '400':
 *         description: Bad request - missing reasoning or core property
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
import { NextApiResponse, NextApiRequest } from "next";

// Response type for property operations
type PropertyResponse = ApiResponse<{
  nodeId: string;
  property: string;
  value: any;
  type?: string;
  inheritance?: {
    ref: string | null;
    inheritanceType: string;
  };
}>;

// Metadata generation helper
const createMetadata = (clientId: string) => ({
  clientId,
  timestamp: new Date().toISOString(),
});

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
        type: node.propertyType[propertyName] || 'string',
        inheritance: node.inheritance[propertyName] || {
          ref: null,
          inheritanceType: 'inheritUnlessAlreadyOverRidden'
        }
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
 * Handles DELETE requests to remove a specific property
 */
async function handleDelete(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<PropertyResponse>
): Promise<void> {
  const nodeId = req.query.nodeId as string;
  const propertyName = req.query.propertyName as string;
  const clientId = req.apiKeyInfo?.clientId || 'unknown';

  // Get reasoning from request body
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

    // Save the current property value for the response
    const currentValue = node.properties[propertyName];

    // Handle property deletion through updateNodeProperties
    await NodeService.updateNodeProperties(
      nodeId,
      {}, // No properties to update
      req.apiKeyInfo.uname,
      reasoning,
      undefined, // No inheritance rules
      [propertyName] // Property to delete
    );

    return res.status(200).json({
      success: true,
      data: {
        nodeId,
        property: propertyName,
        value: currentValue // Return the value that was deleted
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
    res.setHeader('Allow', ['GET', 'DELETE']);
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
    case 'DELETE':
      return handleDelete(authReq, res);
    default:
      res.setHeader('Allow', ['GET', 'DELETE']);
      return res.status(405).json({
        success: false,
        error: `Method ${req.method} Not Allowed`,
        metadata: createMetadata(authReq.apiKeyInfo?.clientId || 'unknown')
      });
  }
}

// Export the handler with middleware applied
export default validateApiKey(withApiLogger(methodHandler));