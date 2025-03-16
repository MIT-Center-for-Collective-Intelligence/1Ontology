/**
 * @openapi
 * /api/nodes/{nodeId}/changes:
 *   get:
 *     tags:
 *       - Node History
 *     summary: Get node change history
 *     description: Retrieves the change history for a specific node with pagination and filtering options
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the node to retrieve changes for
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Maximum number of changes to return per page
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of changes to skip
 *       - in: query
 *         name: startAfter
 *         schema:
 *           type: string
 *         description: ID of the change to start after (for cursor-based pagination)
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter changes by change type
 *       - in: query
 *         name: property
 *         schema:
 *           type: string
 *         description: Filter changes by modified property
 *       - in: query
 *         name: modifiedBy
 *         schema:
 *           type: string
 *         description: Filter changes by the user who made the change
 *     responses:
 *       '200':
 *         description: Node changes retrieved successfully
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
 *                     changes:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/NodeChange'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           description: Total number of changes matching the query
 *                         offset:
 *                           type: integer
 *                           description: Current offset
 *                         limit:
 *                           type: integer
 *                           description: Number of changes per page
 *                         hasMore:
 *                           type: boolean
 *                           description: Whether there are more changes available
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
 *                   example: 'Node ID must be provided as a string'
 *                 code:
 *                   type: string
 *                   example: VALIDATION_ERROR
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
 *       '404':
 *         description: No changes found for the node
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
 *                   example: 'No changes found for node with ID "123"'
 *                 code:
 *                   type: string
 *                   example: NO_CHANGES_FOUND
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
 *       '405':
 *         description: Method not allowed
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
 *                   example: 'Method POST Not Allowed'
 *                 code:
 *                   type: string
 *                   example: METHOD_NOT_ALLOWED
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
 *                   example: 'An unexpected error occurred. Please try again later.'
 *                 code:
 *                   type: string
 *                   example: INTERNAL_SERVER_ERROR
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
 * 
 * components:
 *   schemas:
 *     NodeChange:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Unique identifier for the change record
 *         nodeId:
 *           type: string
 *           description: ID of the node that was changed
 *         changeType:
 *           type: string
 *           description: Type of change that occurred
 *         modifiedProperty:
 *           type: string
 *           description: Name of the property that was modified
 *         modifiedBy:
 *           type: string
 *           description: ID of the user who made the change
 *         modifiedAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the change was made
 *         oldValue:
 *           type: object
 *           description: Previous value of the property (if applicable)
 *         newValue:
 *           type: object
 *           description: New value of the property after the change
 *         reasoning:
 *           type: string
 *           description: Reasoning provided for making the change
 *     
 *     Metadata:
 *       type: object
 *       properties:
 *         clientId:
 *           type: string
 *           description: ID of the client that made the API request
 *         uname:
 *           type: string
 *           description: Username of the user who made the API request
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Timestamp of the API response
 *         version:
 *           type: string
 *           description: API version
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { validateApiKey } from ' @components/middlewares/validateApiKey';
import { withApiLogger } from ' @components/middlewares/apiLogger';
import { ApiKeyValidationError, ApiResponse, NextApiRequestWithAuth } from ' @components/types/api';
import { NodeChange } from ' @components/types/INode';
import { db } from ' @components/lib/firestoreServer/admin';
import { NODES, NODES_LOGS } from ' @components/lib/firestoreClient/collections';
import { collection, getDocs, limit, orderBy, query, startAfter, where } from 'firebase/firestore';

/**
 * Type for the response of the node changes endpoint
 */
type NodeChangesApiResponse = ApiResponse<{
  changes: NodeChange[];
  pagination: {
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
  };
}>;

/**
 * Custom error class for when no changes are found
 */
class NoChangesFoundError extends Error {
  constructor(nodeId: string) {
    super(`No changes found for node with ID "${nodeId}"`);
    this.name = 'NoChangesFoundError';
  }
}

/**
 * Creates metadata object for the API response
 */
const createMetadata = (clientId: string, uname?: string) => ({
  uname,
  clientId,
  timestamp: new Date().toISOString(),
  version: '1.0'
});

/**
 * Error handler for API responses
 */
const handleApiError = (
  error: any,
  res: NextApiResponse<NodeChangesApiResponse>,
  clientId: string = 'unknown'
): void => {
  console.error('API Error:', error);

  // Determine error type
  if (error instanceof ApiKeyValidationError) {
    return res.status(400).json({
      success: false,
      error: error.message,
      code: 'VALIDATION_ERROR',
      metadata: createMetadata(clientId)
    });
  }

  if (error instanceof NoChangesFoundError) {
    return res.status(404).json({
      success: false,
      error: error.message,
      code: 'NO_CHANGES_FOUND',
      metadata: createMetadata(clientId)
    });
  }

  // Default to internal server error
  res.status(500).json({
    success: false,
    error: 'An unexpected error occurred. Please try again later.',
    code: 'INTERNAL_SERVER_ERROR',
    metadata: createMetadata(clientId)
  });
};

/**
 * Validates that a node exists
 */
const verifyNodeExists = async (nodeId: string): Promise<void> => {
  try {
    const nodeRef = db.collection(NODES).doc(nodeId);
    const nodeDoc = await nodeRef.get();
    
    if (!nodeDoc.exists) {
      throw new Error(`Node with ID "${nodeId}" not found`);
    }
  } catch (error) {
    throw new Error(`Failed to verify node existence: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Main handler for the node changes endpoint
 */
async function methodHandler(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<NodeChangesApiResponse>
) {
  try {
    // Validate that the HTTP method is GET
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({
        success: false,
        error: `Method ${req.method} Not Allowed`,
        code: 'METHOD_NOT_ALLOWED',
        metadata: createMetadata(req.apiKeyInfo?.clientId || 'unknown')
      });
    }

    const { nodeId } = req.query;
    
    if (!nodeId || typeof nodeId !== 'string') {
      throw new ApiKeyValidationError('Node ID must be provided as a string');
    }

    if (!nodeId.trim()) {
      throw new ApiKeyValidationError('Node ID cannot be empty');
    }

    // Extract query parameters for pagination and filtering
    const {
      limit: limitStr = '10',
      offset: offsetStr = '0',
      startAfter: startAfterId,
      type,
      property,
      modifiedBy
    } = req.query;

    // Parse pagination parameters
    const parsedLimit = Math.min(parseInt(limitStr as string, 10) || 10, 100); // Cap at 100
    const parsedOffset = parseInt(offsetStr as string, 10) || 0;

    // Verify the node exists
    await verifyNodeExists(nodeId);

    // Create base query for node changes
    let changesQuery = db.collection(NODES_LOGS).where('nodeId', '==', nodeId);

    // Apply additional filters if provided
    if (type && typeof type === 'string') {
      changesQuery = changesQuery.where('changeType', '==', type);
    }

    if (property && typeof property === 'string') {
      changesQuery = changesQuery.where('modifiedProperty', '==', property);
    }

    if (modifiedBy && typeof modifiedBy === 'string') {
      changesQuery = changesQuery.where('modifiedBy', '==', modifiedBy);
    }

    // Add ordering by modification date (newest first)
    changesQuery = changesQuery.orderBy('modifiedAt', 'desc');

    // Apply cursor-based pagination if startAfter is provided
    if (startAfterId && typeof startAfterId === 'string') {
      const startAfterDoc = await db.collection(NODES_LOGS).doc(startAfterId).get();
      
      if (startAfterDoc.exists) {
        changesQuery = changesQuery.startAfter(startAfterDoc);
      }
    } else if (parsedOffset > 0) {
      // Apply offset if no cursor is provided
      changesQuery = changesQuery.offset(parsedOffset);
    }

    // Apply limit
    changesQuery = changesQuery.limit(parsedLimit);

    // Execute the query
    const changesSnapshot = await changesQuery.get();
    
    // Get total count (separate query for accurate count)
    const countQuery = db.collection(NODES_LOGS).where('nodeId', '==', nodeId);
    
    // Apply type, property, and modifiedBy filters to count query as well
    if (type && typeof type === 'string') {
      countQuery.where('changeType', '==', type);
    }
    
    if (property && typeof property === 'string') {
      countQuery.where('modifiedProperty', '==', property);
    }
    
    if (modifiedBy && typeof modifiedBy === 'string') {
      countQuery.where('modifiedBy', '==', modifiedBy);
    }
    
    const countSnapshot = await countQuery.count().get();
    const totalCount = countSnapshot.data().count;

    // Process the results
    const changes: NodeChange[] = [];
    changesSnapshot.forEach(doc => {
      const changeData = doc.data() as NodeChange;
      // Add the document ID to help with pagination
      (changeData as any)._id = doc.id;
      changes.push(changeData);
    });

    // If no changes found, return a 404
    if (changes.length === 0 && parsedOffset === 0 && !startAfterId) {
      throw new NoChangesFoundError(nodeId);
    }

    // Prepare pagination info
    const paginationInfo = {
      total: totalCount,
      offset: parsedOffset,
      limit: parsedLimit,
      hasMore: changes.length === parsedLimit && (parsedOffset + changes.length) < totalCount
    };

    // Return successful response
    return res.status(200).json({
      success: true,
      data: {
        changes,
        pagination: paginationInfo
      },
      metadata: createMetadata(req.apiKeyInfo?.clientId || 'unknown', req.apiKeyInfo?.uname)
    });
  } catch (error) {
    handleApiError(error, res, req.apiKeyInfo?.clientId);
  }
}

export default validateApiKey(withApiLogger(methodHandler));