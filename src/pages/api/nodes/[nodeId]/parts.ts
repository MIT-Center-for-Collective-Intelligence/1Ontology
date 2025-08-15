/**
 * @openapi
 * /api/nodes/{nodeId}/parts:
 *   get:
 *     tags:
 *       - Node Parts
 *     summary: Get node parts
 *     description: Retrieves all parts of a node, organized by collections
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
 *         description: Parts retrieved successfully
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
 *                     parts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Collection'
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '404':
 *         $ref: '#/components/responses/NodeNotFound'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *   
 *   post:
 *     tags:
 *       - Node Parts
 *     summary: Add parts to a node
 *     description: Adds one or more nodes as parts of the given node
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
 *               - nodes
 *               - reasoning
 *             properties:
 *               nodes:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/NodeReference'
 *                 minItems: 1
 *                 maxItems: 100
 *                 description: Array of nodes to add as parts
 *               collectionName:
 *                 type: string
 *                 pattern: '^[a-zA-Z0-9-_]+$'
 *                 maxLength: 50
 *                 description: Optional name of the collection to add the nodes to (defaults to 'main')
 *               reasoning:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *                 description: Reason for adding the parts
 *     responses:
 *       '200':
 *         description: Parts added successfully
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
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '404':
 *         $ref: '#/components/responses/NodeNotFound'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *   
 *   delete:
 *     tags:
 *       - Node Parts
 *     summary: Remove parts from a node
 *     description: Removes one or more nodes from the parts of the given node
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
 *               - nodes
 *               - reasoning
 *             properties:
 *               nodes:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/NodeReference'
 *                 minItems: 1
 *                 maxItems: 100
 *                 description: Array of nodes to remove from parts
 *               reasoning:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *                 description: Reason for removing the parts
 *     responses:
 *       '200':
 *         description: Parts removed successfully
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
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '404':
 *         $ref: '#/components/responses/NodeNotFound'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *   
 *   put:
 *     tags:
 *       - Node Parts
 *     summary: Move parts between collections
 *     description: Moves nodes from one collection to another within the node's parts
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
 *               - nodes
 *               - sourceCollection
 *               - targetCollection
 *               - reasoning
 *             properties:
 *               nodes:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/NodeReference'
 *                 minItems: 1
 *                 maxItems: 100
 *                 description: Array of nodes to move between collections
 *               sourceCollection:
 *                 type: string
 *                 pattern: '^[a-zA-Z0-9-_]+$'
 *                 maxLength: 50
 *                 description: Name of the source collection
 *               targetCollection:
 *                 type: string
 *                 pattern: '^[a-zA-Z0-9-_]+$'
 *                 maxLength: 50
 *                 description: Name of the target collection
 *               reasoning:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *                 description: Reason for moving the parts
 *     responses:
 *       '200':
 *         description: Parts moved successfully
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
 *     NodeReference:
 *       type: object
 *       required:
 *         - id
 *       properties:
 *         id:
 *           type: string
 *           description: ID of the referenced node
 *     
 *     Collection:
 *       type: object
 *       properties:
 *         collectionName:
 *           type: string
 *           description: Name of the collection
 *         nodes:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/NodeReference'
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
 *           properties:
 *             parts:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Collection'
 *             isPartOf:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Collection'
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
import { INode, ICollection } from ' @components/types/INode';
import { NodeService } from ' @components/services/nodeService';
import { NodePartsService } from ' @components/services/nodePartsService';

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

interface PartsRequest {
  nodes: NodeReference[];
  collectionName?: string;
  reasoning: string;
}

interface MoveNodesRequest {
  nodes: NodeReference[];
  sourceCollection: string;
  targetCollection: string;
  reasoning: string;
}

type PartsApiResponse = ApiResponse<{
  node?: INode;
  parts?: ICollection[];
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
 * Validates parts request data
 */
const validatePartsRequest = (request: any): void => {
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
 * Validates move nodes request data
 */
const validateMoveNodesRequest = (request: any): void => {
  if (!request || typeof request !== 'object') {
    throw new ApiKeyValidationError('Invalid request format');
  }

  if (!Array.isArray(request.nodes)) {
    throw new ApiKeyValidationError('Nodes must be provided as an array');
  }

  validateNodeArray(request.nodes);

  if (!request.sourceCollection || typeof request.sourceCollection !== 'string') {
    throw new ApiKeyValidationError('Source collection name is required');
  }

  if (!request.targetCollection || typeof request.targetCollection !== 'string') {
    throw new ApiKeyValidationError('Target collection name is required');
  }

  validateCollectionName(request.sourceCollection);
  validateCollectionName(request.targetCollection);

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
  res: NextApiResponse<PartsApiResponse>,
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
  // Check for specific error messages
  else if (error.message && error.message.includes('circular reference')) {
    errorType = 'VALIDATION_ERROR';
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

    case 'NODE_OPERATION_ERROR':
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'NODE_OPERATION_ERROR',
        metadata: createMetadata(clientId)
      });
      break;

    case 'COLLECTION_OPERATION_ERROR':
      res.status(400).json({
        success: false,
        error: error.message,
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
 * Verifies that multiple nodes exist and are not deleted
 */
const verifyNodesExist = async (nodeIds: string[]): Promise<Map<string, INode>> => {
  try {
    const nodes = new Map<string, INode>();
    const nodePromises = nodeIds.map(id => verifyNodeExists(id));
    const nodeResults = await Promise.all(nodePromises);

    nodeResults.forEach((node, index) => {
      nodes.set(nodeIds[index], node);
    });

    return nodes;
  } catch (error) {
    throw error;
  }
};

/**
 * Checks if adding parts would create a circular reference
 */
const wouldCreateCircularReference = (
  containerId: string,
  partId: string,
  nodes: Map<string, INode>
): boolean => {
  // If container and part are the same, it's a circular reference
  if (containerId === partId) {
    return true;
  }

  const containerNode = nodes.get(containerId);
  if (!containerNode) return false;

  // Check if the container is already a part of the part (recursive)
  let currentNode = containerNode;
  const visited = new Set<string>();

  // Helper function to check container's parts recursively
  const checkPartsRecursively = (nodeId: string): boolean => {
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);

    const node = nodes.get(nodeId);
    if (!node) return false;

    // Check if this node is a part of the part
    const isPartOf = node.properties.isPartOf || [];
    for (const collection of isPartOf) {
      for (const partContainer of collection.nodes) {
        if (partContainer.id === partId) {
          return true;
        }

        // Recursively check if any of this node's containers are parts of the part
        if (checkPartsRecursively(partContainer.id)) {
          return true;
        }
      }
    }

    return false;
  };

  return checkPartsRecursively(containerId);
};

/**
 * Main handler for parts endpoints
 */
async function methodHandler(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<PartsApiResponse>
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
        return getParts(req, res, nodeId);
      case 'POST':
        return addParts(req, res, nodeId);
      case 'DELETE':
        return removeParts(req, res, nodeId);
      case 'PUT':
        return moveParts(req, res, nodeId);
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
 * GET /api/nodes/{nodeId}/parts
 * Retrieves all parts of a node
 */
async function getParts(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<PartsApiResponse>,
  nodeId: string
) {
  try {
    if (!req.apiKeyInfo) {
      throw new ApiKeyValidationError('Authentication required');
    }

    const node = await NodeService.getNode(nodeId);

    // Ensure parts is always an array with at least the main collection
    const parts = node.properties.parts || [{
      collectionName: 'main',
      nodes: []
    }];

    return res.status(200).json({
      success: true,
      data: {
        parts
      },
      metadata: createMetadata(req.apiKeyInfo.clientId)
    });
  } catch (error) {
    handleApiError(error, res, req.apiKeyInfo?.clientId);
  }
}

/**
 * POST /api/nodes/{nodeId}/parts
 * Adds nodes as parts to the specified node
 */
async function addParts(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<PartsApiResponse>,
  nodeId: string
) {
  try {
    if (!req.apiKeyInfo) {
      throw new ApiKeyValidationError('Authentication required');
    }

    const request: PartsRequest = req.body;
    validatePartsRequest(request);

    // Check for self-referential part
    if (request.nodes.some(node => node.id === nodeId)) {
      throw new NodeOperationError('A node cannot be its own part');
    }

    // Get current node state to check existing parts
    const currentNode = await NodeService.getNode(nodeId);
    const existingNodes = new Map<string, string>(); // Map<nodeId, collectionName>

    // Build map of existing nodes and their collections
    currentNode.properties.parts?.forEach(collection => {
      collection.nodes.forEach(node => {
        existingNodes.set(node.id, collection.collectionName);
      });
    });

    // Check if any requested nodes already exist in parts
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
        `The following nodes are already parts of this node: ${nodeDetails}. ` +
        `To move nodes between collections, use PUT /api/nodes/${nodeId}/parts ` +
        `with sourceCollection and targetCollection specified.`
      );
    }

    // Verify all nodes exist and aren't deleted
    const nodeMap = await verifyNodesExist(request.nodes.map(node => node.id));

    // Check for circular references
    for (const node of request.nodes) {
      if (wouldCreateCircularReference(nodeId, node.id, nodeMap)) {
        throw new NodeOperationError(
          `Adding node ${node.id} as a part would create a circular reference. ` +
          `A node cannot be a part of itself directly or indirectly.`
        );
      }
    }

    // If no collection name is provided, use 'main' as default
    const collectionName = request.collectionName || 'main';

    // For this implementation, we'll use a new method in NodeService for adding parts
    const updatedNode = await NodePartsService.addParts(
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
 * DELETE /api/nodes/{nodeId}/parts
 * Removes parts from a node
 */
async function removeParts(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<PartsApiResponse>,
  nodeId: string
) {
  try {
    if (!req.apiKeyInfo) {
      throw new ApiKeyValidationError('Authentication required');
    }

    const request: PartsRequest = req.body;
    validatePartsRequest(request);

    // Check if nodes exist in the parts
    const currentNode = await NodeService.getNode(nodeId);
    const existingParts = new Set(
      currentNode.properties.parts
        ?.flatMap(collection => collection.nodes)
        .map(node => node.id) || []
    );

    const nonExistingNodes = request.nodes.filter(node => !existingParts.has(node.id));
    if (nonExistingNodes.length > 0) {
      throw new NodeOperationError(
        `The following nodes are not parts of this node: ${nonExistingNodes.map(n => n.id).join(', ')}`
      );
    }

    const updatedNode = await NodePartsService.removeParts(
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
 * Validates parts reordering request data
 */
const validateReorderPartsRequest = (request: any): void => {
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
};

/**
 * PUT /api/nodes/{nodeId}/parts
 * Reorders parts within a collection
 */
async function reorderParts(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<PartsApiResponse>,
  nodeId: string
) {
  try {
    if (!req.apiKeyInfo) {
      throw new ApiKeyValidationError('Authentication required');
    }

    const request = req.body;
    validateReorderPartsRequest(request);

    // Get current node state
    const currentNode = await NodeService.getNode(nodeId);

    if (currentNode.deleted) {
      throw new NodeOperationError('Cannot modify a deleted node');
    }

    const collectionName = request.collectionName || 'main';

    const collection = currentNode.properties.parts?.find(c => c.collectionName === collectionName);
    if (!collection) {
      throw new CollectionOperationError(`Collection "${collectionName}" not found in node's parts`);
    }

    // Verify all nodes exist in the collection
    const existingNodeMap = new Map(collection.nodes.map((node, index) => [node.id, index]));

    for (const node of request.nodes) {
      if (!existingNodeMap.has(node.id)) {
        throw new NodeOperationError(`Node ${node.id} not found in parts collection "${collectionName}"`);
      }
    }

    // Reorder the parts
    const updatedNode = await NodePartsService.reorderParts(
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

/**
 * PUT /api/nodes/{nodeId}/parts
 * Reorders parts within the main collection
 */
async function moveParts(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<PartsApiResponse>,
  nodeId: string
) {
  // Now this is a wrapper for reorderParts
  return reorderParts(req, res, nodeId);
}

export default validateApiKey(withApiLogger(methodHandler));