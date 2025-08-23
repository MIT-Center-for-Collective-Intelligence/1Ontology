import { NextApiRequest, NextApiResponse } from 'next';
import { validateApiKey } from ' @components/middlewares/validateApiKey';
import { withApiLogger } from ' @components/middlewares/apiLogger';
import { ApiKeyValidationError, ApiResponse, NextApiRequestWithAuth } from ' @components/types/api';
import { INode } from ' @components/types/INode';
import { NodeService } from ' @components/services/nodeService';
import { NodeRelationshipService } from ' @components/services/nodeRelationshipService';

// Custom error classes
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

interface TransferSpecializationRequest {
  nodes: NodeReference[];
  targetNodeId: string;
  targetCollectionName?: string;
  reasoning: string;
}

type TransferSpecializationsResponse = ApiResponse<{
  sourceNode?: INode;
  targetNode?: INode;
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
 * Validates transfer specialization request data
 */
const validateTransferSpecializationRequest = (request: any): void => {
  if (!request || typeof request !== 'object') {
    throw new ApiKeyValidationError('Invalid request format');
  }

  if (!Array.isArray(request.nodes)) {
    throw new ApiKeyValidationError('Nodes must be provided as an array');
  }

  validateNodeArray(request.nodes);

  if (!request.targetNodeId || typeof request.targetNodeId !== 'string' || !request.targetNodeId.trim()) {
    throw new ApiKeyValidationError('Target node ID is required');
  }

  if (!request.reasoning || typeof request.reasoning !== 'string') {
    throw new ApiKeyValidationError('Reasoning must be provided as a string');
  }

  if (!request.reasoning.trim()) {
    throw new ApiKeyValidationError('Reasoning cannot be empty');
  }

  if (request.reasoning.length > 1000) {
    throw new ApiKeyValidationError('Reasoning must not exceed 1000 characters');
  }

  if (request.targetCollectionName !== undefined) {
    validateCollectionName(request.targetCollectionName, true);
  }
};

/**
 * Error handler for API responses
 */
const handleApiError = (
  error: any,
  res: NextApiResponse<TransferSpecializationsResponse>,
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
 * Handler for transferring specializations from one node to another
 */
async function transferSpecializations(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<TransferSpecializationsResponse>
) {
  try {
    // Only allow POST method
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({
        success: false,
        error: `Method ${req.method} Not Allowed`,
        code: 'METHOD_NOT_ALLOWED',
        metadata: createMetadata(req.apiKeyInfo?.clientId || 'unknown')
      });
    }

    if (!req.apiKeyInfo) {
      throw new ApiKeyValidationError('Authentication required');
    }

    const { nodeId } = req.query;

    if (!nodeId || typeof nodeId !== 'string') {
      throw new ApiKeyValidationError('Node ID must be provided as a string');
    }

    if (!nodeId.trim()) {
      throw new ApiKeyValidationError('Node ID cannot be empty');
    }

    const request: TransferSpecializationRequest = req.body;
    validateTransferSpecializationRequest(request);

    // Verify source node exists
    const sourceNode = await verifyNodeExists(nodeId);

    // Verify target node exists
    if (nodeId === request.targetNodeId) {
      throw new NodeOperationError('Source and target nodes cannot be the same');
    }
    const targetNode = await verifyNodeExists(request.targetNodeId);

    // Check for self-references in specializations to be transferred
    if (request.nodes.some(node => node.id === request.targetNodeId)) {
      throw new NodeOperationError('Cannot transfer a node to be a specialization of itself');
    }

    // Verify all nodes exist in the source node's specializations
    const existingSpecializations = new Set(
      sourceNode.specializations
        ?.flatMap(collection => collection.nodes)
        .map(node => node.id) || []
    );

    const nonExistingNodes = request.nodes.filter(node => !existingSpecializations.has(node.id));
    if (nonExistingNodes.length > 0) {
      throw new NodeOperationError(
        `The following nodes are not specializations of the source node: ${nonExistingNodes.map(n => n.id).join(', ')}`
      );
    }

    // Check if any of the nodes already exist in the target node's specializations
    const targetSpecializations = new Set(
      targetNode.specializations
        ?.flatMap(collection => collection.nodes)
        .map(node => node.id) || []
    );

    const alreadyExistingNodes = request.nodes.filter(node => targetSpecializations.has(node.id));
    if (alreadyExistingNodes.length > 0) {
      throw new NodeOperationError(
        `The following nodes are already specializations of the target node: ${alreadyExistingNodes.map(n => n.id).join(', ')}`
      );
    }

    // Verify all specialization nodes exist
    await Promise.all(
      request.nodes.map(node => verifyNodeExists(node.id))
    );

    // Use default 'main' collection if not specified
    const targetCollectionName = request.targetCollectionName || 'main';

    // Transfer the specializations
    const { updatedSourceNode, updatedTargetNode } = await NodeRelationshipService.transferSpecializations(
      nodeId,
      request.targetNodeId,
      request.nodes,
      req.apiKeyInfo.uname,
      request.reasoning,
      targetCollectionName
    );

    return res.status(200).json({
      success: true,
      data: {
        sourceNode: updatedSourceNode,
        targetNode: updatedTargetNode
      },
      metadata: createMetadata(req.apiKeyInfo.clientId, req.apiKeyInfo.uname)
    });
  } catch (error) {
    handleApiError(error, res, req.apiKeyInfo?.clientId);
  }
}

export default validateApiKey(withApiLogger(transferSpecializations));