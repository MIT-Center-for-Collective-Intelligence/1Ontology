/**
 * @openapi
 * /api/nodes/{nodeId}:
 *   get:
 *     tags:
 *       - Nodes
 *     summary: Retrieve a node
 *     description: Gets a node by its ID
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the node to retrieve
 *     responses:
 *       '200':
 *         description: Node retrieved successfully
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
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         title:
 *                           type: string
 *                         nodeType:
 *                           type: string
 *                           enum:
 *                             - activity
 *                             - actor
 *                             - evaluationDimension
 *                             - role
 *                             - incentive
 *                             - reward
 *                             - group
 *                             - context
 *                         properties:
 *                           type: object
 *                           properties:
 *                             parts:
 *                               type: array
 *                               items:
 *                                 type: string
 *                             isPartOf:
 *                               type: array
 *                               items:
 *                                 type: string
 *                         deleted:
 *                           type: boolean
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     clientId:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                     version:
 *                       type: string
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
 *                   example: Node not found
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *   
 *   patch:
 *     tags:
 *       - Nodes
 *     summary: Update a node
 *     description: Updates an existing node with new properties and reasoning
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the node to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - node
 *               - reasoning
 *             properties:
 *               node:
 *                 type: object
 *                 properties:
 *                   title:
 *                     type: string
 *                     description: Updated title of the node
 *                   nodeType:
 *                     type: string
 *                     enum:
 *                       - activity
 *                       - actor
 *                       - evaluationDimension
 *                       - role
 *                       - incentive
 *                       - reward
 *                       - group
 *                       - context
 *                   properties:
 *                     type: object
 *                     properties:
 *                       parts:
 *                         type: array
 *                         items:
 *                           type: string
 *                       isPartOf:
 *                         type: array
 *                         items:
 *                           type: string
 *                   generalizations:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         nodes:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *               reasoning:
 *                 type: string
 *                 description: Reasoning for the update
 *     responses:
 *       '200':
 *         description: Node updated successfully
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
 *                     node:
 *                       $ref: '#/components/schemas/Node'
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *   
 *   delete:
 *     tags:
 *       - Nodes
 *     summary: Delete a node
 *     description: Marks a node as deleted with reasoning
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the node to delete
 *       - in: query
 *         name: reasoning
 *         required: true
 *         schema:
 *           type: string
 *         description: Reasoning for node deletion
 *     responses:
 *       '200':
 *         description: Node deleted successfully
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
 *                     node:
 *                       $ref: '#/components/schemas/Node'
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '409':
 *         description: Node is already deleted
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
 *                   example: Node is already deleted
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
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
 *         nodeType:
 *           type: string
 *           enum:
 *             - activity
 *             - actor
 *             - evaluationDimension
 *             - role
 *             - incentive
 *             - reward
 *             - group
 *             - context
 *         properties:
 *           type: object
 *           properties:
 *             parts:
 *               type: array
 *               items:
 *                 type: string
 *             isPartOf:
 *               type: array
 *               items:
 *                 type: string
 *         deleted:
 *           type: boolean
 *     
 *     Metadata:
 *       type: object
 *       properties:
 *         clientId:
 *           type: string
 *         timestamp:
 *           type: string
 *         version:
 *           type: string
 *   
 *   responses:
 *     BadRequest:
 *       description: Bad request - missing or invalid fields
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
 *               metadata:
 *                 $ref: '#/components/schemas/Metadata'
 *     
 *     NotFound:
 *       description: Resource not found
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
 *               metadata:
 *                 $ref: '#/components/schemas/Metadata'
 */

import { withApiLogger } from " @components/middlewares/apiLogger";
import { validateApiKey } from " @components/middlewares/validateApiKey";
import { NodeService } from " @components/services/nodeService";
import { ApiResponse, ApiKeyValidationError, NextApiRequestWithAuth } from " @components/types/api";
import { INode } from " @components/types/INode";
import { NextApiResponse, NextApiRequest } from "next";


const VALID_NODE_TYPES = [
  "activity",
  "actor",
  "evaluationDimension",
  "role",
  "incentive",
  "reward",
  "group",
  "context"
] as const;

// Response type for all node operations
type NodeResponse = ApiResponse<{
  node: INode;
  nodeId?: string;
}>;

// Metadata generation helper
const createMetadata = (clientId: string) => ({
  clientId,
  timestamp: new Date().toISOString(),
});

/**
 * Validates the update node request
 * @param request - The request to validate
 * @throws ApiKeyValidationError for validation failures
 */
const validateUpdateNodeRequest = async (request: any): Promise<void> => {
  const { node, reasoning } = request;

  // Basic validation
  if (!node) {
    throw new ApiKeyValidationError('Node data is required');
  }
  if (!reasoning) {
    throw new ApiKeyValidationError('Reasoning is required');
  }
  if (node.title && !node.title.trim()) {
    throw new ApiKeyValidationError('Node title cannot be empty');
  }
  if (node.nodeType && !VALID_NODE_TYPES.includes(node.nodeType)) {
    throw new ApiKeyValidationError(
      `Invalid node type. Must be one of: ${VALID_NODE_TYPES.join(', ')}`
    );
  }

  // Validate generalizations if provided
  if (node.generalizations?.[0]?.nodes && !node.generalizations[0].nodes[0]?.id) {
    throw new ApiKeyValidationError('Invalid generalization structure');
  }

  // Validate properties structure if provided
  if (node.properties) {
    if (!Array.isArray(node.properties.parts)) {
      throw new ApiKeyValidationError('Properties parts must be an array');
    }
    if (!Array.isArray(node.properties.isPartOf)) {
      throw new ApiKeyValidationError('Properties isPartOf must be an array');
    }
  }
};

/**
 * Handles GET requests to retrieve a node
 */
async function handleGet(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<NodeResponse>
): Promise<void> {
  const nodeId = req.query.nodeId as string;
  const clientId = req.apiKeyInfo?.clientId || 'unknown';

  try {
    const node = await NodeService.getNode(nodeId);
    
    return res.status(200).json({
      success: true,
      data: { node },
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

    console.error('Error retrieving node:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error occurred while retrieving node',
      metadata: createMetadata(clientId)
    });
  }
}

/**
 * Handles PATCH requests to update a node
 */
async function handlePatch(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<NodeResponse>
): Promise<void> {
  const nodeId = req.query.nodeId as string;
  const clientId = req.apiKeyInfo?.clientId || 'unknown';

  try {
    // Validate request
    await validateUpdateNodeRequest(req.body);

    const { node, reasoning } = req.body;

    // Update node
    const updatedNode = await NodeService.updateNode(
      nodeId,
      node,
      req.apiKeyInfo.uname,
      reasoning
    );

    return res.status(200).json({
      success: true,
      data: {
        nodeId,
        node: updatedNode
      },
      metadata: createMetadata(clientId)
    });
  } catch (error) {
    console.error('Error updating node:', error);

    if (error instanceof ApiKeyValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code,
        metadata: createMetadata(clientId)
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to update node',
      metadata: createMetadata(clientId)
    });
  }
}

/**
 * Handles DELETE requests to remove a node
 */
async function handleDelete(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<NodeResponse>
): Promise<void> {
  const nodeId = req.query.nodeId as string;
  const reasoning = req.query.reasoning as string;
  const clientId = req.apiKeyInfo?.clientId || 'unknown';

  try {
    if (!reasoning) {
      return res.status(400).json({
        success: false,
        error: 'Reasoning is required for node deletion',
        metadata: createMetadata(clientId)
      });
    }

    const deletedNode = await NodeService.deleteNode(
      nodeId,
      req.apiKeyInfo.clientId,
      reasoning
    );

    return res.status(200).json({
      success: true,
      data: {
        nodeId,
        node: deletedNode
      },
      metadata: createMetadata(clientId)
    });
  } catch (error: any) {
    console.error('Error deleting node:', error);

    if (error.message === 'Node not found') {
      return res.status(404).json({
        success: false,
        error: 'Node not found',
        metadata: createMetadata(clientId)
      });
    }

    if (error.message === 'Node is already deleted') {
      return res.status(409).json({
        success: false,
        error: 'Node is already deleted',
        metadata: createMetadata(clientId)
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to delete node',
      metadata: createMetadata(clientId)
    });
  }
}

/**
 * Main request handler that routes to appropriate method handlers
 */
async function methodHandler(
  req: NextApiRequest,
  res: NextApiResponse<NodeResponse>
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