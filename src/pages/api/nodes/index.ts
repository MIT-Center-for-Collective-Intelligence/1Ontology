/**
 * @openapi
 * /api/nodes/create:
 *   post:
 *     tags:
 *       - Nodes
 *     summary: Create a new node
 *     description: Creates a new node with the specified properties and reasoning
 *     security:
 *       - apiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *               - node
 *               - reasoning
 *             properties:
 *               id:
 *                 type: string
 *                 description: Unique identifier for the node
 *               node:
 *                 type: object
 *                 required:
 *                   - title
 *                   - properties
 *                 properties:
 *                   title:
 *                     type: string
 *                     description: Title of the node
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
 *               reasoning:
 *                 type: string
 *                 description: Reasoning for creating the node
 *     responses:
 *       '201':
 *         description: Node created successfully
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
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         title:
 *                           type: string
 *                         deleted:
 *                           type: boolean
 *                         properties:
 *                           type: object
 *                         inheritance:
 *                           type: object
 *                         specializations:
 *                           type: array
 *                         generalizations:
 *                           type: array
 *                         root:
 *                           type: string
 *                         nodeType:
 *                           type: string
 *                         createdBy:
 *                           type: string
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     clientId:
 *                       type: string
 *       '400':
 *         description: Bad request - missing or invalid fields
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
 *                   properties:
 *                     clientId:
 *                       type: string
 */

import { INode, INodeTypes } from ' @components/types/INode';
import { validateApiKey } from ' @components/middlewares/validateApiKey';
import { ApiKeyValidationError, ApiResponse, NextApiRequestWithAuth } from ' @components/types/api';
import { NextApiRequest, NextApiResponse } from 'next';
import { withApiLogger } from ' @components/middlewares/apiLogger';
import { db } from ' @components/lib/firestoreServer/admin';
import { NODES } from ' @components/lib/firestoreClient/collections';
import { CreateNodeResponse, CreateNodeRequest, NodeService } from ' @components/services/nodeService';

const createMetadata = (clientId: string) => ({
  clientId,
  timestamp: new Date().toISOString(),
  version: '1.0'
});

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

/**
 * Validates the create node request
 * @param request - The request to validate
 * @throws ApiKeyValidationError for validation failures
 */
const validateCreateNodeRequest = async (request: any): Promise<void> => {
  const { node, reasoning } = request;
  // Basic validation
  if (!node) {
    throw new ApiKeyValidationError('Node data is required');
  }
  if (!reasoning) {
    throw new ApiKeyValidationError('Reasoning is required');
  }
  if (!node.title?.trim()) {
    throw new ApiKeyValidationError('Node title is required');
  }
  if (!node.nodeType) {
    throw new ApiKeyValidationError('Node type is required');
  }
  if (!VALID_NODE_TYPES.includes(node.nodeType)) {
    throw new ApiKeyValidationError(
      `Invalid node type. Must be one of: ${VALID_NODE_TYPES.join(', ')}`
    );
  }

  // Validate generalizations
  if (!node.generalizations?.[0]?.nodes?.[0]?.id) {
    throw new ApiKeyValidationError('At least one generalization is required');
  }

  // Check for circular references
  const circularIds = NodeService.detectCircularReferences(node.generalizations, node.specializations);
  if (circularIds.length > 0) {
    throw new ApiKeyValidationError(
      `Circular reference detected: Node(s) ${circularIds.join(', ')} cannot be both a generalization and specialization of the same node`
    );
  }

  // Check for duplicate node IDs in relationships
  const duplicatesValidation = NodeService.validateNoDuplicateNodeIds(node);
  if (!duplicatesValidation.valid) {
    let errorMessage = 'Duplicate node IDs detected:';

    duplicatesValidation.generalizations.forEach((duplicates, collection) => {
      errorMessage += ` Generalizations (${collection}): ${duplicates.join(', ')}.`;
    });

    duplicatesValidation.specializations.forEach((duplicates, collection) => {
      errorMessage += ` Specializations (${collection}): ${duplicates.join(', ')}.`;
    });

    duplicatesValidation.parts.forEach((duplicates, collection) => {
      errorMessage += ` Parts (${collection}): ${duplicates.join(', ')}.`;
    });

    duplicatesValidation.isPartOf.forEach((duplicates, collection) => {
      errorMessage += ` IsPartOf (${collection}): ${duplicates.join(', ')}.`;
    });

    throw new ApiKeyValidationError(errorMessage);
  }

  // Validate specializations - check if all specified specialization nodes exist in DB
  if (node.specializations && node.specializations.length > 0) {
    const specializationNodeIds = node.specializations
      .flatMap((collection: { nodes: any; }) => collection.nodes || [])
      .filter((node: { id: any; }) => node && node.id)
      .map((node: { id: any; }) => node.id);

    if (specializationNodeIds.length > 0) {
      // Verify all specialization nodes exist in the database
      const specializationNodesRefs = specializationNodeIds.map((id: string) =>
        db.collection(NODES).doc(id)
      );

      const specializationDocs = await Promise.all(
        specializationNodesRefs.map((ref: { get: () => any; }) => ref.get())
      );

      const nonExistentNodes = specializationDocs
        .filter(doc => !doc.exists)
        .map((_, index) => specializationNodeIds[index]);

      if (nonExistentNodes.length > 0) {
        throw new ApiKeyValidationError(
          `The following specialization nodes do not exist: ${nonExistentNodes.join(', ')}`
        );
      }
    }
  }

  // Validate parts - check if all specified part nodes exist in DB
  if (node.properties?.parts && node.properties.parts.length > 0) {
    const partNodeIds = node.properties.parts
      .flatMap((collection: { nodes: any; }) => collection.nodes || [])
      .filter((node: { id: any; }) => node && node.id)
      .map((node: { id: any; }) => node.id);

    if (partNodeIds.length > 0) {
      // Verify all part nodes exist in the database
      const partNodesRefs = partNodeIds.map((id: string) =>
        db.collection(NODES).doc(id)
      );

      const partDocs = await Promise.all(
        partNodesRefs.map((ref: { get: () => any; }) => ref.get())
      );

      const nonExistentNodes = partDocs
        .filter(doc => !doc.exists)
        .map((_, index) => partNodeIds[index]);

      if (nonExistentNodes.length > 0) {
        throw new ApiKeyValidationError(
          `The following part nodes do not exist: ${nonExistentNodes.join(', ')}`
        );
      }
    }
  }

  // Validate isPartOf - check if all specified parent nodes exist in DB
  if (node.properties?.isPartOf && node.properties.isPartOf.length > 0) {
    const isPartOfNodeIds = node.properties.isPartOf
      .flatMap((collection: { nodes: any; }) => collection.nodes || [])
      .filter((node: { id: any; }) => node && node.id)
      .map((node: { id: any; }) => node.id);

    if (isPartOfNodeIds.length > 0) {
      // Verify all isPartOf nodes exist in the database
      const isPartOfNodesRefs = isPartOfNodeIds.map((id: string) =>
        db.collection(NODES).doc(id)
      );

      const isPartOfDocs = await Promise.all(
        isPartOfNodesRefs.map((ref: { get: () => any; }) => ref.get())
      );

      const nonExistentNodes = isPartOfDocs
        .filter(doc => !doc.exists)
        .map((_, index) => isPartOfNodeIds[index]);

      if (nonExistentNodes.length > 0) {
        throw new ApiKeyValidationError(
          `The following isPartOf nodes do not exist: ${nonExistentNodes.join(', ')}`
        );
      }
    }
  }

  // Validate properties structure
  if (!node.properties) {
    throw new ApiKeyValidationError('Node properties are required');
  }
};

async function methodHandler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<{ nodeId: string; node: INode }>>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`,
      metadata: createMetadata('unknown')
    });
  }
  return authenticatedHandler(req as NextApiRequestWithAuth, res);
}

async function authenticatedHandler(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<ApiResponse<{ nodeId: string; node: INode }>>
) {
  try {
    if (!req.apiKeyInfo) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        metadata: createMetadata('unknown')
      });
    }

    const request = req.body;

    // Validate request
    await validateCreateNodeRequest(request);

    // Create node using service
    const createdNode = await NodeService.createNode(
      request,
      req.apiKeyInfo.uname
    );

    return res.status(201).json({
      success: true,
      data: {
        nodeId: createdNode.id,
        node: createdNode
      },
      metadata: createMetadata(req.apiKeyInfo.uname)
    });
  } catch (error) {
    console.error('Error creating node:', error);

    if (error instanceof ApiKeyValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code,
        metadata: createMetadata(req.apiKeyInfo?.uname || 'unknown')
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to create node',
      metadata: createMetadata(req.apiKeyInfo?.uname || 'unknown')
    });
  }
}

export default validateApiKey(withApiLogger(methodHandler));