/**
 * @openapi
 * tags:
 *   - name: Node Generalizations
 *     description: Management of node generalizations and hierarchy
 *     x-order: 3
 * 
 * /api/nodes/{nodeId}/generalizations:
 *   get:
 *     tags:
 *       - Node Generalizations
 *     summary: Get generalizations of a node
 *     description: Retrieves all generalizations of a specified node
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - name: nodeId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the node to retrieve generalizations for
 *     responses:
 *       '200':
 *         description: Generalizations retrieved successfully
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
 *                     generalizations:
 *                       type: array
 *                       description: Collections of generalizations
 *                       items:
 *                         type: object
 *                         properties:
 *                           collectionName:
 *                             type: string
 *                             description: Name of the collection
 *                           nodes:
 *                             type: array
 *                             description: Nodes in this collection
 *                             items:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: string
 *                                   description: ID of the generalization node
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     clientId:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                     version:
 *                       type: string
 *       '400':
 *         description: Bad request
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
 *                   enum: [VALIDATION_ERROR, NODE_OPERATION_ERROR, COLLECTION_OPERATION_ERROR]
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
 *                 code:
 *                   type: string
 *                   example: NODE_NOT_FOUND
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
 *                 code:
 *                   type: string
 *                   example: INTERNAL_SERVER_ERROR
 *                 metadata:
 *                   type: object
 *   
 *   post:
 *     tags:
 *       - Node Generalizations
 *     summary: Add generalizations to a node
 *     description: Adds new generalizations to a node in a specified collection
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - name: nodeId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the node to add generalizations to
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nodes
 *               - reasoning
 *             properties:
 *               nodes:
 *                 type: array
 *                 description: Nodes to add as generalizations
 *                 items:
 *                   type: object
 *                   required:
 *                     - id
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: ID of the node to add as a generalization
 *               collectionName:
 *                 type: string
 *                 description: Name of the collection to add the generalizations to (defaults to 'main')
 *                 pattern: ^[a-zA-Z0-9-_]+$
 *                 maxLength: 50
 *               reasoning:
 *                 type: string
 *                 description: Reasoning for adding the generalizations
 *                 maxLength: 1000
 *     responses:
 *       '200':
 *         description: Generalizations added successfully
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
 *                       description: Updated node with new generalizations
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     clientId:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                     version:
 *                       type: string
 *       '400':
 *         description: Bad request
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
 *                   enum: [VALIDATION_ERROR, NODE_OPERATION_ERROR, COLLECTION_OPERATION_ERROR]
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
 *                 code:
 *                   type: string
 *                   example: NODE_NOT_FOUND
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
 *                 code:
 *                   type: string
 *                   example: INTERNAL_SERVER_ERROR
 *                 metadata:
 *                   type: object
 *
 *   delete:
 *     tags:
 *       - Node Generalizations
 *     summary: Remove generalizations from a node
 *     description: Removes specified generalizations from a node
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - name: nodeId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the node to remove generalizations from
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nodes
 *               - reasoning
 *             properties:
 *               nodes:
 *                 type: array
 *                 description: Nodes to remove from generalizations
 *                 items:
 *                   type: object
 *                   required:
 *                     - id
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: ID of the node to remove from generalizations
 *               reasoning:
 *                 type: string
 *                 description: Reasoning for removing the generalizations
 *                 maxLength: 1000
 *     responses:
 *       '200':
 *         description: Generalizations removed successfully
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
 *                       description: Updated node with generalizations removed
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     clientId:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                     version:
 *                       type: string
 *       '400':
 *         description: Bad request
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
 *                   enum: [VALIDATION_ERROR, NODE_OPERATION_ERROR, COLLECTION_OPERATION_ERROR]
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
 *                 code:
 *                   type: string
 *                   example: NODE_NOT_FOUND
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
 *                 code:
 *                   type: string
 *                   example: INTERNAL_SERVER_ERROR
 *                 metadata:
 *                   type: object
 *
 *   put:
 *     tags:
 *       - Node Generalizations
 *     summary: Reorder generalizations within a collection
 *     description: Reorders generalizations within a specified collection of a node
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - name: nodeId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the node to reorder generalizations for
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nodes
 *               - newIndices
 *               - reasoning
 *             properties:
 *               nodes:
 *                 type: array
 *                 description: Nodes to reorder
 *                 items:
 *                   type: object
 *                   required:
 *                     - id
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: ID of the node to reorder
 *               newIndices:
 *                 type: array
 *                 description: New indices for the nodes (must match length of nodes)
 *                 items:
 *                   type: integer
 *                   minimum: 0
 *               collectionName:
 *                 type: string
 *                 description: Name of the collection to reorder (defaults to 'main')
 *               reasoning:
 *                 type: string
 *                 description: Reasoning for reordering the generalizations
 *                 maxLength: 1000
 *     responses:
 *       '200':
 *         description: Generalizations reordered successfully
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
 *                       description: Updated node with reordered generalizations
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     clientId:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                     version:
 *                       type: string
 *                     uname:
 *                       type: string
 *       '400':
 *         description: Bad request
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
 *                   enum: [VALIDATION_ERROR, NODE_OPERATION_ERROR, COLLECTION_OPERATION_ERROR]
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
 *                 code:
 *                   type: string
 *                   example: NODE_NOT_FOUND
 *                 metadata:
 *                   type: object
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
 *                 code:
 *                   type: string
 *                   example: METHOD_NOT_ALLOWED
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
 *                 code:
 *                   type: string
 *                   example: INTERNAL_SERVER_ERROR
 *                 metadata:
 *                   type: object
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { validateApiKey } from ' @components/middlewares/validateApiKey';
import { withApiLogger } from ' @components/middlewares/apiLogger';
import { ApiKeyValidationError, ApiResponse, NextApiRequestWithAuth } from ' @components/types/api';
import { INode, ICollection } from ' @components/types/INode';
import { NodeService } from ' @components/services/nodeService';
import { NodeRelationshipService } from ' @components/services/nodeRelationshipService';

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

class CollectionOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CollectionOperationError';
  }
}

// Type definitions
interface NodeReference {
  id: string;
}

interface GeneralizationRequest {
  nodes: NodeReference[];
  collectionName?: string;
  reasoning: string;
}


type GeneralizationsApiResponse = ApiResponse<{
  node?: INode;
  generalizations?: ICollection[];
}>;

const createMetadata = (clientId: string, uname?: string) => ({
  uname,
  clientId,
  timestamp: new Date().toISOString(),
  version: '1.0'
});

/**
 * Validates the basic node array structure
 */
const validateNodeArray = (nodes: any[]): void => {
  if (nodes.length === 0) {
    throw new ApiKeyValidationError('At least one node must be specified');
  }

  if (nodes.length > 100) {
    throw new ApiKeyValidationError('Maximum of 100 nodes can be processed at once');
  }

  const uniqueNodeIds = new Set<string>();
  nodes.forEach((node, index) => {
    if (!node || typeof node !== 'object') {
      throw new ApiKeyValidationError(`Invalid node format at index ${index}`);
    }

    if (!node.id || typeof node.id !== 'string' || !node.id.trim()) {
      throw new ApiKeyValidationError(`Invalid or missing node ID at index ${index}`);
    }

    if (uniqueNodeIds.has(node.id)) {
      throw new ApiKeyValidationError(`Duplicate node ID found: ${node.id}`);
    }
    uniqueNodeIds.add(node.id);
  });
};

/**
 * Validates collection name format
 */
const validateCollectionName = (name: string, isOptional: boolean = false): void => {
  if (!name && !isOptional) {
    throw new ApiKeyValidationError('Collection name is required');
  }

  if (name) {
    if (name.length > 50) {
      throw new ApiKeyValidationError('Collection name must not exceed 50 characters');
    }

    if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
      throw new ApiKeyValidationError('Collection name can only contain letters, numbers, hyphens, and underscores');
    }
  }
};

/**
 * Validates generalization request data
 */
const validateGeneralizationRequest = (request: any): void => {
  if (!request || typeof request !== 'object') {
    throw new ApiKeyValidationError('Invalid request format');
  }

  if (!Array.isArray(request.nodes)) {
    throw new ApiKeyValidationError('Nodes must be provided as an array');
  }

  validateNodeArray(request.nodes);

  if (!request.reasoning || typeof request.reasoning !== 'string') {
    throw new ApiKeyValidationError('Reasoning must be provided as a string');
  }

  if (!request.reasoning.trim()) {
    throw new ApiKeyValidationError('Reasoning cannot be empty');
  }

  if (request.reasoning.length > 1000) {
    throw new ApiKeyValidationError('Reasoning must not exceed 1000 characters');
  }

  if (request.collectionName !== undefined) {
    validateCollectionName(request.collectionName, true);
  }
};


/**
 * Validates generalizations reordering request data
 */
const validateReorderGeneralizationsRequest = (request: any): void => {
  if (!request || typeof request !== 'object') {
    throw new ApiKeyValidationError('Invalid request format');
  }

  if (!Array.isArray(request.nodes)) {
    throw new ApiKeyValidationError('Nodes must be provided as an array');
  }

  validateNodeArray(request.nodes);

  if (!request.reasoning || typeof request.reasoning !== 'string') {
    throw new ApiKeyValidationError('Reasoning must be provided as a string');
  }

  if (!request.reasoning.trim()) {
    throw new ApiKeyValidationError('Reasoning cannot be empty');
  }

  if (request.reasoning.length > 1000) {
    throw new ApiKeyValidationError('Reasoning must not exceed 1000 characters');
  }

  // Ensure indices are provided for reordering
  if (!Array.isArray(request.newIndices) || request.newIndices.length !== request.nodes.length) {
    throw new ApiKeyValidationError('newIndices must be an array with the same length as nodes');
  }

  request.newIndices.forEach((index: any, i: number) => {
    if (typeof index !== 'number' || index < 0 || !Number.isInteger(index)) {
      throw new ApiKeyValidationError(`Invalid index at position ${i}: must be a non-negative integer`);
    }
  });

  if (request.collectionName && typeof request.collectionName !== 'string') {
    throw new ApiKeyValidationError('Collection name must be a string if provided');
  }
}

/**
 * Error handler for API responses
 */
const handleApiError = (
  error: any,
  res: NextApiResponse<GeneralizationsApiResponse>,
  clientId: string = 'unknown'
): void => {
  console.error('API Error:', error);

  // Determine the error type based on multiple properties
  let errorType = 'UNKNOWN';
  let errorMessage = error.message || 'An unexpected error occurred';

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
  else if (error instanceof NodeOperationError ||
    error.name === 'NodeOperationError' ||
    error.code === 'NODE_OPERATION_ERROR') {
    errorType = 'NODE_OPERATION_ERROR';
  }
  else if (error instanceof CollectionOperationError ||
    error.name === 'CollectionOperationError' ||
    error.code === 'COLLECTION_OPERATION_ERROR') {
    errorType = 'COLLECTION_OPERATION_ERROR';
  }
  // Check for error messages related to removing all generalizations
  else if (error.message && (
    error.message.includes('Cannot remove all generalizations') ||
    error.message.includes('must have at least one generalization')
  )) {
    errorType = 'VALIDATION_ERROR';
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

    case 'NODE_OPERATION_ERROR':
      res.status(400).json({
        success: false,
        error: errorMessage,
        code: 'NODE_OPERATION_ERROR',
        metadata: createMetadata(clientId)
      });
      break;

    case 'COLLECTION_OPERATION_ERROR':
      res.status(400).json({
        success: false,
        error: errorMessage,
        code: 'COLLECTION_OPERATION_ERROR',
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
 * Main handler for generalizations endpoints
 */
async function methodHandler(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<GeneralizationsApiResponse>
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
        return getGeneralizations(req, res, nodeId);
      case 'POST':
        return addGeneralizations(req, res, nodeId);
      case 'DELETE':
        return removeGeneralizations(req, res, nodeId);
      case 'PUT':
        return reorderGeneralizations(req, res, nodeId);
      default:
        res.setHeader('Allow', ['GET', 'POST', 'DELETE', 'PUT']);
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
 * GET /api/nodes/{nodeId}/generalizations
 */
async function getGeneralizations(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<GeneralizationsApiResponse>,
  nodeId: string
) {
  try {
    if (!req.apiKeyInfo) {
      throw new ApiKeyValidationError('Authentication required');
    }

    const node = await NodeService.getNode(nodeId);

    // Ensure generalizations is always an array with at least the main collection
    const generalizations = node.generalizations || [{
      collectionName: 'main',
      nodes: []
    }];

    return res.status(200).json({
      success: true,
      data: {
        generalizations
      },
      metadata: createMetadata(req.apiKeyInfo.clientId)
    });
  } catch (error) {
    handleApiError(error, res, req.apiKeyInfo?.clientId);
  }
}

/**
 * POST /api/nodes/{nodeId}/generalizations
 */
async function addGeneralizations(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<GeneralizationsApiResponse>,
  nodeId: string
) {
  try {
    if (!req.apiKeyInfo) {
      throw new ApiKeyValidationError('Authentication required');
    }

    const request: GeneralizationRequest = req.body;
    validateGeneralizationRequest(request);

    // Check for self-referential generalization
    if (request.nodes.some(node => node.id === nodeId)) {
      throw new NodeOperationError('A node cannot be its own generalization');
    }

    // Get current node state to check existing generalizations
    const currentNode = await NodeService.getNode(nodeId);
    const existingNodes = new Map<string, string>(); // Map<nodeId, collectionName>

    // Build map of existing nodes and their collections
    currentNode.generalizations?.forEach(collection => {
      collection.nodes.forEach(node => {
        existingNodes.set(node.id, collection.collectionName);
      });
    });

    // Check if any requested nodes already exist in generalizations
    const alreadyExistingNodes = request.nodes
      .filter(node => existingNodes.has(node.id))
      .map(node => ({
        id: node.id,
        collection: existingNodes.get(node.id)
      }));

    if (alreadyExistingNodes.length > 0) {
      const nodeDetails = alreadyExistingNodes
        .map(node => `${node.id} (in ${node.collection} collection)`)
        .join(', ');

      throw new NodeOperationError(
        `The following nodes are already generalizations of this node: ${nodeDetails}. ` +
        `To move nodes between collections, use PUT /api/nodes/${nodeId}/generalizations ` +
        `with sourceCollection and targetCollection specified.`
      );
    }

    // Verify all nodes exist and aren't deleted
    await Promise.all(
      request.nodes.map(node => verifyNodeExists(node.id))
    );

    // If no collection name is provided, use 'main' as default
    const collectionName = request.collectionName || 'main';

    const updatedNode = await NodeRelationshipService.addGeneralizations(
      nodeId,
      request.nodes,
      req.apiKeyInfo.uname,
      request.reasoning,
      collectionName
    );

    return res.status(200).json({
      success: true,
      data: {
        node: updatedNode
      },
      metadata: createMetadata(req.apiKeyInfo.clientId)
    });
  } catch (error) {
    handleApiError(error, res, req.apiKeyInfo?.clientId);
  }
}

/**
 * DELETE /api/nodes/{nodeId}/generalizations
 */
async function removeGeneralizations(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<GeneralizationsApiResponse>,
  nodeId: string
) {
  try {
    if (!req.apiKeyInfo) {
      throw new ApiKeyValidationError('Authentication required');
    }

    const request: GeneralizationRequest = req.body;
    validateGeneralizationRequest(request);

    // Check if nodes exist in the generalizations
    const currentNode = await NodeService.getNode(nodeId);
    const existingGeneralizations = new Set(
      currentNode.generalizations
        ?.flatMap(collection => collection.nodes)
        .map(node => node.id) || []
    );

    const nonExistingNodes = request.nodes.filter(node => !existingGeneralizations.has(node.id));
    if (nonExistingNodes.length > 0) {
      throw new NodeOperationError(
        `The following nodes are not generalizations of this node: ${nonExistingNodes.map(n => n.id).join(', ')}`
      );
    }

    const updatedNode = await NodeRelationshipService.removeGeneralizations(
      nodeId,
      request.nodes,
      req.apiKeyInfo.uname,
      request.reasoning
    );

    return res.status(200).json({
      success: true,
      data: {
        node: updatedNode
      },
      metadata: createMetadata(req.apiKeyInfo.clientId)
    });
  } catch (error) {
    handleApiError(error, res, req.apiKeyInfo?.clientId);
  }
}

/**
 * PUT /api/nodes/{nodeId}/generalizations
 * Reorders generalizations within a collection
 */
async function reorderGeneralizations(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<GeneralizationsApiResponse>,
  nodeId: string
) {
  try {
    if (!req.apiKeyInfo) {
      throw new ApiKeyValidationError('Authentication required');
    }

    const request = req.body;
    validateReorderGeneralizationsRequest(request);

    // Get current node state
    const currentNode = await NodeService.getNode(nodeId);

    if (currentNode.deleted) {
      throw new NodeOperationError('Cannot modify a deleted node');
    }

    // Ensure the generalizations property exists
    if (!Array.isArray(currentNode.generalizations)) {
      currentNode.generalizations = [{ collectionName: 'main', nodes: [] }];
    }

    // Use default 'main' collection if not specified
    const collectionName = request.collectionName || 'main';

    // Find the collection
    const collection = currentNode.generalizations.find(c => c.collectionName === collectionName);
    if (!collection) {
      throw new CollectionOperationError(`Collection "${collectionName}" not found in node's generalizations`);
    }

    // Verify all nodes exist in the collection
    const existingNodeMap = new Map(collection.nodes.map((node, index) => [node.id, index]));

    for (const node of request.nodes) {
      if (!existingNodeMap.has(node.id)) {
        throw new NodeOperationError(`Node ${node.id} not found in generalizations collection "${collectionName}"`);
      }
    }

    // Reorder the generalizations
    const updatedNode = await NodeRelationshipService.reorderGeneralizations(
      nodeId,
      request.nodes,
      request.newIndices,
      collectionName,
      req.apiKeyInfo.uname,
      request.reasoning
    );

    return res.status(200).json({
      success: true,
      data: {
        node: updatedNode
      },
      metadata: createMetadata(req.apiKeyInfo.clientId, req.apiKeyInfo.uname)
    });
  } catch (error) {
    handleApiError(error, res, req.apiKeyInfo?.clientId);
  }
}

export default validateApiKey(withApiLogger(methodHandler));