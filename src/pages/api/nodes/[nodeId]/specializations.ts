/**
 * @openapi
 * /api/nodes/{nodeId}/specializations:
 *   get:
 *     tags:
 *       - Node Specializations
 *     summary: Get node specializations
 *     description: Retrieves all specializations for a node, organized by collections
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
 *         description: Specializations retrieved successfully
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
 *                     specializations:
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
 *       - Node Specializations
 *     summary: Add specializations to a node
 *     description: Adds one or more nodes as specializations of the given node
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
 *                 description: Array of nodes to add as specializations
 *               collectionName:
 *                 type: string
 *                 pattern: '^[a-zA-Z0-9-_]+$'
 *                 maxLength: 50
 *                 description: Optional name of the collection to add the nodes to (defaults to 'main')
 *               reasoning:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *                 description: Reason for adding the specializations
 *     responses:
 *       '200':
 *         description: Specializations added successfully
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
 *       - Node Specializations
 *     summary: Remove specializations from a node
 *     description: Removes one or more nodes from the specializations of the given node
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
 *                 description: Array of nodes to remove from specializations
 *               reasoning:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *                 description: Reason for removing the specializations
 *     responses:
 *       '200':
 *         description: Specializations removed successfully
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
 *       - Node Specializations
 *     summary: Move specializations between collections
 *     description: Moves nodes from one collection to another within the node's specializations
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
 *                 description: Reason for moving the specializations
 *     responses:
 *       '200':
 *         description: Specializations moved successfully
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
 *         specializations:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Collection'
 *         generalizations:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Collection'
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

interface SpecializationRequest {
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

type SpecializationsApiResponse = ApiResponse<{
  node?: INode;
  specializations?: ICollection[];
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
 * Validates specialization request data
 */
const validateSpecializationRequest = (request: any): void => {
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
const validateMoveNodesBetweenCollectionRequest = (request: any): void => {
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
 * Validates specializations reordering request data
 */
const validateReorderSpecializationsRequest = (request: any): void => {
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
  res: NextApiResponse<SpecializationsApiResponse>,
  clientId: string = 'unknown'
): void => {
  console.error('API Error:', error);

  switch (error.constructor) {
    case ApiKeyValidationError:
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'VALIDATION_ERROR',
        metadata: createMetadata(clientId)
      });
      break;

    case NodeNotFoundError:
      res.status(404).json({
        success: false,
        error: error.message,
        code: 'NODE_NOT_FOUND',
        metadata: createMetadata(clientId)
      });
      break;

    case NodeOperationError:
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'NODE_OPERATION_ERROR',
        metadata: createMetadata(clientId)
      });
      break;

    case CollectionOperationError:
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
 * Main handler for specializations endpoints
 */
async function methodHandler(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<SpecializationsApiResponse>
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
        return getSpecializations(req, res, nodeId);
      case 'POST':
        return addSpecializations(req, res, nodeId);
      case 'DELETE':
        return removeSpecializations(req, res, nodeId);
      case 'PUT':
        return putSpecializations(req, res, nodeId);
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
 * GET /api/nodes/{nodeId}/specializations
 */
async function getSpecializations(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<SpecializationsApiResponse>,
  nodeId: string
) {
  try {
    if (!req.apiKeyInfo) {
      throw new ApiKeyValidationError('Authentication required');
    }

    const node = await NodeService.getNode(nodeId);

    // Ensure specializations is always an array with at least the main collection
    const specializations = node.specializations || [{
      collectionName: 'main',
      nodes: []
    }];

    return res.status(200).json({
      success: true,
      data: {
        specializations
      },
      metadata: createMetadata(req.apiKeyInfo.clientId)
    });
  } catch (error) {
    handleApiError(error, res, req.apiKeyInfo?.clientId);
  }
}

/**
 * POST /api/nodes/{nodeId}/specializations
 */
async function addSpecializations(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<SpecializationsApiResponse>,
  nodeId: string
) {
  try {
    if (!req.apiKeyInfo) {
      throw new ApiKeyValidationError('Authentication required');
    }

    const request: SpecializationRequest = req.body;
    validateSpecializationRequest(request);

    // Check for self-referential specialization
    if (request.nodes.some(node => node.id === nodeId)) {
      throw new NodeOperationError('A node cannot be its own specialization');
    }

    // Get current node state to check existing specializations
    const currentNode = await NodeService.getNode(nodeId);
    const existingNodes = new Map<string, string>(); // Map<nodeId, collectionName>

    // Build map of existing nodes and their collections
    currentNode.specializations?.forEach(collection => {
      collection.nodes.forEach(node => {
        existingNodes.set(node.id, collection.collectionName);
      });
    });

    // Check if any requested nodes already exist in specializations
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
        `The following nodes are already specializations of this node: ${nodeDetails}. ` +
        `To move nodes between collections, use PUT /api/nodes/${nodeId}/specializations ` +
        `with sourceCollection and targetCollection specified.`
      );
    }

    // Verify all nodes exist and aren't deleted
    await Promise.all(
      request.nodes.map(node => verifyNodeExists(node.id))
    );

    // If no collection name is provided, use 'main' as default
    const collectionName = request.collectionName || 'main';

    const updatedNode = await NodeRelationshipService.addSpecializations(
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
 * DELETE /api/nodes/{nodeId}/specializations
 */
async function removeSpecializations(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<SpecializationsApiResponse>,
  nodeId: string
) {
  try {
    if (!req.apiKeyInfo) {
      throw new ApiKeyValidationError('Authentication required');
    }

    const request: SpecializationRequest = req.body;
    validateSpecializationRequest(request);

    // Check if nodes exist in the specified collection
    const currentNode = await NodeService.getNode(nodeId);
    const existingSpecializations = new Set(
      currentNode.specializations
        ?.flatMap(collection => collection.nodes)
        .map(node => node.id) || []
    );

    const nonExistingNodes = request.nodes.filter(node => !existingSpecializations.has(node.id));
    if (nonExistingNodes.length > 0) {
      throw new NodeOperationError(
        `The following nodes are not specializations of this node: ${nonExistingNodes.map(n => n.id).join(', ')}`
      );
    }

    const updatedNode = await NodeRelationshipService.removeSpecializations(
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
 * PUT /api/nodes/{nodeId}/specializations
 * Moves nodes between collections
 */
async function moveSpecializationsBetweenCollections(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<SpecializationsApiResponse>,
  nodeId: string
) {
  try {
    if (!req.apiKeyInfo) {
      throw new ApiKeyValidationError('Authentication required');
    }

    const request: MoveNodesRequest = req.body;
    validateMoveNodesBetweenCollectionRequest(request);

    // Get current node state
    const currentNode = await NodeService.getNode(nodeId);

    // Verify source collection exists
    const sourceCollection = currentNode.specializations?.find(
      c => c.collectionName === request.sourceCollection
    );
    if (!sourceCollection) {
      throw new CollectionOperationError(`Source collection "${request.sourceCollection}" not found`);
    }

    // Verify target collection exists
    const targetCollection = currentNode.specializations?.find(
      c => c.collectionName === request.targetCollection
    );
    if (!targetCollection) {
      throw new CollectionOperationError(`Target collection "${request.targetCollection}" not found`);
    }

    // Verify all nodes exist in source collection
    const sourceNodes = new Set(sourceCollection.nodes.map(n => n.id));
    const nonExistingNodes = request.nodes.filter(node => !sourceNodes.has(node.id));
    if (nonExistingNodes.length > 0) {
      throw new NodeOperationError(
        `The following nodes are not in the source collection: ${nonExistingNodes.map(n => n.id).join(', ')}`
      );
    }

    // Move the nodes
    const updatedNode = await NodeRelationshipService.moveSpecializationsBetweenCollections(
      nodeId,
      request.nodes,
      request.sourceCollection,
      request.targetCollection,
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
 * PUT /api/nodes/{nodeId}/specializations
 * Handles both moving nodes between collections and reordering nodes within a collection
 */
async function putSpecializations(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<SpecializationsApiResponse>,
  nodeId: string
) {
  try {
    if (!req.apiKeyInfo) {
      throw new ApiKeyValidationError('Authentication required');
    }

    const request = req.body;

    // Determine if this is a move between collections or a reordering request
    if (request.sourceCollection && request.targetCollection) {
      // This is a move between collections - handle with existing method
      return moveSpecializationsBetweenCollections(req, res, nodeId);
    } else if (request.newIndices) {
      // This is a reordering request
      validateReorderSpecializationsRequest(request);

      // Get current node state
      const currentNode = await NodeService.getNode(nodeId);

      if (currentNode.deleted) {
        throw new NodeOperationError('Cannot modify a deleted node');
      }

      // Use default 'main' collection if not specified
      const collectionName = request.collectionName || 'main';

      // Find the collection
      const collection = currentNode.specializations?.find(c => c.collectionName === collectionName);
      if (!collection) {
        throw new CollectionOperationError(`Collection "${collectionName}" not found in node's specializations`);
      }

      // Verify all nodes exist in the collection
      const existingNodeMap = new Map(collection.nodes.map((node, index) => [node.id, index]));

      for (const node of request.nodes) {
        if (!existingNodeMap.has(node.id)) {
          throw new NodeOperationError(`Node ${node.id} not found in specializations collection "${collectionName}"`);
        }
      }

      // Reorder the specializations
      const updatedNode = await NodeRelationshipService.reorderSpecializations(
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
    } else {
      throw new ApiKeyValidationError('Invalid request: must include either sourceCollection/targetCollection for moving nodes or newIndices for reordering');
    }
  } catch (error) {
    handleApiError(error, res, req.apiKeyInfo?.clientId);
  }
}


export default validateApiKey(withApiLogger(methodHandler));
