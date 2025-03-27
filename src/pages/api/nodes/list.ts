/**
 * @openapi
 * /api/nodes/list:
 *   get:
 *     tags:
 *       - Nodes
 *     summary: List nodes
 *     description: Retrieves a paginated list of nodes with optional filtering
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: query
 *         name: nodeType
 *         schema:
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
 *         description: Filter nodes by type
 *       - in: query
 *         name: root
 *         schema:
 *           type: string
 *         description: Filter nodes by root ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of nodes to return per page
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of nodes to skip
 *       - in: query
 *         name: deleted
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include deleted nodes in the response
 *     responses:
 *       '200':
 *         description: Nodes retrieved successfully
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
 *                     nodes:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Node'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           description: Total number of nodes matching the query
 *                         offset:
 *                           type: integer
 *                           description: Current offset
 *                         limit:
 *                           type: integer
 *                           description: Current page size
 *                         hasMore:
 *                           type: boolean
 *                           description: Whether there are more nodes to fetch
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
 *       '400':
 *         description: Bad request - invalid query parameters
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
 *                   example: 'Invalid node type. Must be one of: activity, actor, evaluationDimension, role, incentive, reward, group, context'
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
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
 *                   example: 'Authentication required'
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
 *                   example: 'Failed to list nodes'
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
 *         root:
 *           type: string
 *         createdBy:
 *           type: string
 *     
 *     Metadata:
 *       type: object
 *       properties:
 *         clientId:
 *           type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 *         version:
 *           type: string
 */

import { withApiLogger } from " @components/middlewares/apiLogger";
import { validateApiKey } from " @components/middlewares/validateApiKey";
import { NodeService } from " @components/services/nodeService";
import { ApiResponse, ApiKeyValidationError, NextApiRequestWithAuth } from " @components/types/api";
import { INode, INodeTypes } from " @components/types/INode";
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

// Response type for list operation
type ListNodesResponse = ApiResponse<{
  nodes: INode[];
  pagination: {
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
  };
}>;

// Metadata generation helper
const createMetadata = (clientId: string) => ({
  clientId,
  timestamp: new Date().toISOString(),
  version: '1.0'
});

/**
 * Validates and processes query parameters
 * @param query - Request query parameters
 * @throws ApiKeyValidationError for validation failures
 */
const validateAndProcessQuery = (query: any): {
  nodeType?: INodeTypes;
  root?: string;
  limit: number;
  offset: number;
  deleted: boolean;
} => {
  // Process node type
  let nodeType: INodeTypes | undefined;
  if (query.nodeType) {
    if (!VALID_NODE_TYPES.includes(query.nodeType)) {
      throw new ApiKeyValidationError(
        `Invalid node type. Must be one of: ${VALID_NODE_TYPES.join(', ')}`
      );
    }
    nodeType = query.nodeType as INodeTypes;
  }

  // Process pagination parameters
  const limit = query.limit ? parseInt(query.limit as string, 10) : 10;
  const offset = query.offset ? parseInt(query.offset as string, 10) : 0;

  // Validate pagination parameters
  if (isNaN(limit) || limit < 1 || limit > 100) {
    throw new ApiKeyValidationError('Limit must be between 1 and 100');
  }
  if (isNaN(offset) || offset < 0) {
    throw new ApiKeyValidationError('Offset must be a non-negative number');
  }

  // Process other filters
  const root = query.root as string | undefined;
  const deleted = query.deleted === 'true';

  return {
    nodeType,
    root,
    limit,
    offset,
    deleted
  };
};

/**
 * Handles GET requests to list nodes
 */
async function handleGet(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<ListNodesResponse>
): Promise<void> {
  const clientId = req.apiKeyInfo?.clientId || 'unknown';

  try {
    // Validate and process query parameters
    const {
      nodeType,
      root,
      limit,
      offset,
      deleted
    } = validateAndProcessQuery(req.query);

    // Get nodes using service
    const nodes = await NodeService.listNodes({
      nodeType,
      root,
      limit,
      offset,
      deleted
    });

    // Extract pagination metadata from the last node
    let pagination = {
      total: 0,
      offset,
      limit,
      hasMore: false
    };

    if (nodes.length > 0) {
      const lastNode = nodes[nodes.length - 1];
      const metadata = (lastNode as any)._metadata;
      if (metadata) {
        pagination = {
          total: metadata.total,
          offset: metadata.offset,
          limit: metadata.limit,
          hasMore: metadata.hasMore
        };
      }
      // Remove metadata from the node
      delete (lastNode as any)._metadata;
    }

    res.status(200).json({
      success: true,
      data: {
        nodes,
        pagination
      },
      metadata: createMetadata(clientId)
    });
  } catch (error) {
    console.error('Error listing nodes:', error);

    if (error instanceof ApiKeyValidationError) {
      res.status(400).json({
        success: false,
        error: error.message,
        metadata: createMetadata(clientId)
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to list nodes',
      metadata: createMetadata(clientId)
    });
  }
}

/**
 * Main request handler that routes to appropriate method handlers
 */
async function methodHandler(
  req: NextApiRequest,
  res: NextApiResponse<ListNodesResponse>
): Promise<void> {
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', ['GET']);
    res.status(204).end();
    return;
  }

  // Ensure authentication
  const authReq = req as NextApiRequestWithAuth;
  if (!authReq.apiKeyInfo) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      metadata: createMetadata('unknown')
    });
    return;
  }

  // Route to appropriate handler based on HTTP method
  switch (req.method) {
    case 'GET':
      return handleGet(authReq, res);
    default:
      res.setHeader('Allow', ['GET']);
      res.status(405).json({
        success: false,
        error: `Method ${req.method} Not Allowed`,
        metadata: createMetadata(authReq.apiKeyInfo?.clientId || 'unknown')
      });
  }
}

// Export the handler with middleware applied
export default validateApiKey(withApiLogger(methodHandler));