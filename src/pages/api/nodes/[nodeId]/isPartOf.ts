/**
 * @openapi
 * /api/nodes/{nodeId}/isPartOf:
 *   get:
 *     tags:
 *       - Node Relationships
 *     summary: Get container nodes
 *     description: Retrieves all nodes that the specified node is a part of (containers)
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
 *         description: Container nodes retrieved successfully
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
 *                     containers:
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
 *       - Node Relationships
 *     summary: Add node to containers
 *     description: Adds the node as a part to specified container nodes
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the node to add as a part
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
 *                 description: Array of container nodes to add this node as a part of
 *               collectionName:
 *                 type: string
 *                 pattern: '^[a-zA-Z0-9-_]+$'
 *                 maxLength: 50
 *                 description: Optional name of the collection to add the containers to (defaults to 'main')
 *               reasoning:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *                 description: Reason for adding the node to these containers
 *     responses:
 *       '200':
 *         description: Node added to containers successfully
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
 *       - Node Relationships
 *     summary: Remove node from containers
 *     description: Removes this node as a part from specified container nodes
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the node to remove from containers
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
 *                 description: Array of container nodes to remove this node from
 *               reasoning:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *                 description: Reason for removing the node from these containers
 *     responses:
 *       '200':
 *         description: Node removed from containers successfully
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
 *       - Node Relationships
 *     summary: Move container references between collections
 *     description: Moves container references from one collection to another within the node's isPartOf property
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the node whose container references will be moved
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
 *                 description: Array of container nodes to move between collections
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
 *                 description: Reason for moving the container references
 *     responses:
 *       '200':
 *         description: Container references moved successfully
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

interface IsPartOfRequest {
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

type IsPartOfApiResponse = ApiResponse<{
  node?: INode;
  containers?: ICollection[];
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
 * Validates isPartOf request data
 */
const validateIsPartOfRequest = (request: any): void => {
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
  res: NextApiResponse<IsPartOfApiResponse>,
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
 * Main handler for isPartOf endpoints
 */
async function methodHandler(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<IsPartOfApiResponse>
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
        return getIsPartOf(req, res, nodeId);
      case 'POST':
        return addIsPartOf(req, res, nodeId);
      case 'DELETE':
        return removeIsPartOf(req, res, nodeId);
      case 'PUT':
        return moveIsPartOf(req, res, nodeId);
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
 * GET /api/nodes/{nodeId}/isPartOf
 * Retrieves all containers that this node is a part of
 */
async function getIsPartOf(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<IsPartOfApiResponse>,
  nodeId: string
) {
  try {
    if (!req.apiKeyInfo) {
      throw new ApiKeyValidationError('Authentication required');
    }

    const node = await NodeService.getNode(nodeId);

    // Ensure isPartOf is always an array with at least the main collection
    const isPartOf = node.properties.isPartOf || [{
      collectionName: 'main',
      nodes: []
    }];

    return res.status(200).json({
      success: true,
      data: {
        containers: isPartOf
      },
      metadata: createMetadata(req.apiKeyInfo.clientId, req.apiKeyInfo.uname)
    });
  } catch (error) {
    handleApiError(error, res, req.apiKeyInfo?.clientId);
  }
}

/**
 * POST /api/nodes/{nodeId}/isPartOf
 * Adds this node as a part to the specified container nodes
 */
async function addIsPartOf(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<IsPartOfApiResponse>,
  nodeId: string
) {
  try {
    if (!req.apiKeyInfo) {
      throw new ApiKeyValidationError('Authentication required');
    }

    const request: IsPartOfRequest = req.body;
    validateIsPartOfRequest(request);

    // Check for self-reference
    if (request.nodes.some(node => node.id === nodeId)) {
      throw new NodeOperationError('A node cannot be a part of itself');
    }

    // Get current node state to check existing containers
    const currentNode = await NodeService.getNode(nodeId);
    const existingNodes = new Map<string, string>(); // Map<nodeId, collectionName>

    // Build map of existing nodes and their collections
    currentNode.properties.isPartOf?.forEach(collection => {
      collection.nodes.forEach(node => {
        existingNodes.set(node.id, collection.collectionName);
      });
    });

    // Check if any requested nodes already exist in isPartOf
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
        `This node is already a part of the following nodes: ${nodeDetails}. ` +
        `To move nodes between collections, use PUT /api/nodes/${nodeId}/isPartOf ` +
        `with sourceCollection and targetCollection specified.`
      );
    }

    // Verify all nodes exist and aren't deleted
    const nodeMap = await verifyNodesExist(request.nodes.map(node => node.id));

    // Check for circular references
    for (const node of request.nodes) {
      // For isPartOf, we need to check if this would create a circular reference
      // by checking if any of the containers are already parts of this node
      const containerNode = nodeMap.get(node.id);
      if (containerNode) {
        const partsFlat = containerNode.properties.parts
          ?.flatMap(collection => collection.nodes.map(n => n.id)) || [];

        if (partsFlat.includes(nodeId)) {
          throw new NodeOperationError(
            `Adding node as part of ${node.id} would create a circular reference. ` +
            `The node ${node.id} already has this node as a part.`
          );
        }
      }
    }

    // If no collection name is provided, use 'main' as default
    const collectionName = request.collectionName || 'main';

    const updatedNode = await NodePartsService.addIsPartOf(
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
      metadata: createMetadata(req.apiKeyInfo.clientId, req.apiKeyInfo.uname)
    });
  } catch (error) {
    handleApiError(error, res, req.apiKeyInfo?.clientId);
  }
}

/**
 * DELETE /api/nodes/{nodeId}/isPartOf
 * Removes this node as a part from the specified containers
 */
async function removeIsPartOf(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<IsPartOfApiResponse>,
  nodeId: string
) {
  try {
    if (!req.apiKeyInfo) {
      throw new ApiKeyValidationError('Authentication required');
    }

    const request: IsPartOfRequest = req.body;
    validateIsPartOfRequest(request);

    // Check if nodes exist in the isPartOf
    const currentNode = await NodeService.getNode(nodeId);
    const existingContainers = new Set(
      currentNode.properties.isPartOf
        ?.flatMap(collection => collection.nodes)
        .map(node => node.id) || []
    );

    const nonExistingNodes = request.nodes.filter(node => !existingContainers.has(node.id));
    if (nonExistingNodes.length > 0) {
      throw new NodeOperationError(
        `This node is not a part of the following nodes: ${nonExistingNodes.map(n => n.id).join(', ')}`
      );
    }

    const updatedNode = await NodePartsService.removeIsPartOf(
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
      metadata: createMetadata(req.apiKeyInfo.clientId, req.apiKeyInfo.uname)
    });
  } catch (error) {
    handleApiError(error, res, req.apiKeyInfo?.clientId);
  }
}

/**
 * Validates isPartOf reordering request data
 */
const validateReorderIsPartOfRequest = (request: any): void => {
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
 * PUT /api/nodes/{nodeId}/isPartOf
 * Reorders isPartOf relationships within a collection
 */
async function reorderIsPartOf(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<IsPartOfApiResponse>,
  nodeId: string
) {
  try {
    if (!req.apiKeyInfo) {
      throw new ApiKeyValidationError('Authentication required');
    }

    const request = req.body;
    validateReorderIsPartOfRequest(request);

    // Get current node state
    const currentNode = await NodeService.getNode(nodeId);

    if (currentNode.deleted) {
      throw new NodeOperationError('Cannot modify a deleted node');
    }

    // Use default 'main' collection if not specified
    const collectionName = request.collectionName || 'main';

    // Find the collection
    const collection = currentNode.properties.isPartOf?.find(c => c.collectionName === collectionName);
    if (!collection) {
      throw new CollectionOperationError(`Collection "${collectionName}" not found in node's isPartOf`);
    }

    // Verify all nodes exist in the collection
    const existingNodeMap = new Map(collection.nodes.map((node, index) => [node.id, index]));

    for (const node of request.nodes) {
      if (!existingNodeMap.has(node.id)) {
        throw new NodeOperationError(`Node ${node.id} not found in isPartOf collection "${collectionName}"`);
      }
    }

    // Reorder the isPartOf relationships
    const updatedNode = await NodePartsService.reorderIsPartOf(
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
 * PUT /api/nodes/{nodeId}/isPartOf
 * Reorders isPartOf relationships within the main collection
 */
async function moveIsPartOf(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<IsPartOfApiResponse>,
  nodeId: string
) {
  return reorderIsPartOf(req, res, nodeId);
}

export default validateApiKey(withApiLogger(methodHandler));