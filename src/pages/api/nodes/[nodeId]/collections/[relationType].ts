/**
 * @openapi
 * /api/nodes/{nodeId}/collections/{relationType}:
 *   get:
 *     tags:
 *       - Node Collections
 *     summary: Get node collections
 *     description: Retrieves all collections for a specific relation type (specializations or generalizations)
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the node
 *       - in: path
 *         name: relationType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [specializations, generalizations]
 *         description: Type of relationship to retrieve collections for
 *     responses:
 *       '200':
 *         description: Collections retrieved successfully
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
 *                     collections:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Collection'
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
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
 *                   example: Failed to retrieve specializations collections.
 *                 code:
 *                   type: string
 *                   example: INTERNAL_SERVER_ERROR
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
 *   
 *   post:
 *     tags:
 *       - Node Collections
 *     summary: Create a new collection
 *     description: Creates a new collection for a specific relation type (specializations or generalizations)
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the node
 *       - in: path
 *         name: relationType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [specializations, generalizations]
 *         description: Type of relationship to create the collection for
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - collectionName
 *               - reasoning
 *             properties:
 *               collectionName:
 *                 type: string
 *                 description: Name of the collection to create
 *               reasoning:
 *                 type: string
 *                 description: Reason for creating the collection
 *     responses:
 *       '201':
 *         description: Collection created successfully
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
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
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
 *                   example: Failed to create specializations collection.
 *                 code:
 *                   type: string
 *                   example: INTERNAL_SERVER_ERROR
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
 *   
 *   put:
 *     tags:
 *       - Node Collections
 *     summary: Create multiple collections
 *     description: Creates multiple collections at once for a specific relation type (specializations or generalizations)
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the node
 *       - in: path
 *         name: relationType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [specializations, generalizations]
 *         description: Type of relationship to create the collections for
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - collections
 *               - reasoning
 *             properties:
 *               collections:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of collection names to create
 *                 minItems: 1
 *               reasoning:
 *                 type: string
 *                 description: Reason for creating the collections
 *     responses:
 *       '201':
 *         description: Collections created successfully
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
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
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
 *                   example: Failed to create multiple specializations collections.
 *                 code:
 *                   type: string
 *                   example: INTERNAL_SERVER_ERROR
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
 *   
 *   delete:
 *     tags:
 *       - Node Collections
 *     summary: Delete a collection
 *     description: Deletes a collection for a specific relation type (specializations or generalizations)
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the node
 *       - in: path
 *         name: relationType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [specializations, generalizations]
 *         description: Type of relationship the collection belongs to
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - collectionName
 *               - reasoning
 *             properties:
 *               collectionName:
 *                 type: string
 *                 description: Name of the collection to delete
 *               reasoning:
 *                 type: string
 *                 description: Reason for deleting the collection
 *     responses:
 *       '200':
 *         description: Collection deleted successfully
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
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
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
 *                   example: Failed to delete specializations collection.
 *                 code:
 *                   type: string
 *                   example: INTERNAL_SERVER_ERROR
 *                 metadata:
 *                   $ref: '#/components/schemas/Metadata'
 * 
 * components:
 *   schemas:
 *     Collection:
 *       type: object
 *       properties:
 *         collectionName:
 *           type: string
 *           description: Name of the collection
 *         nodes:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               title:
 *                 type: string
 *     
 *     Node:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         title:
 *           type: string
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
 *         timestamp:
 *           type: string
 *           format: date-time
 *         version:
 *           type: string
 *   
 *   responses:
 *     BadRequest:
 *       description: Bad request - validation error
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
 *                 example: Invalid relation type. Must be either "specializations" or "generalizations".
 *               code:
 *                 type: string
 *               metadata:
 *                 $ref: '#/components/schemas/Metadata'
 *     
 *     Unauthorized:
 *       description: Authentication required
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
 *                 example: Authentication required
 *               metadata:
 *                 $ref: '#/components/schemas/Metadata'
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { validateApiKey } from ' @components/middlewares/validateApiKey';
import { withApiLogger } from ' @components/middlewares/apiLogger';
import { ApiKeyValidationError, ApiResponse, CustomApiError, NextApiRequestWithAuth } from ' @components/types/api';
import { INode, ICollection } from ' @components/types/INode';
import { NodeService } from ' @components/services/nodeService';
import { NodeRelationshipService } from ' @components/services/nodeRelationshipService';

const createMetadata = (clientId: string) => ({
  clientId,
  timestamp: new Date().toISOString(),
  version: '1.0'
});

// Define a unified response type
type CollectionsApiResponse = ApiResponse<{
  node?: INode;
  collections?: ICollection[];
}>;

// Request interfaces
interface CreateCollectionRequest {
  collectionName: string;
  reasoning: string;
}

interface CreateMultipleCollectionsRequest {
  collections: string[];
  reasoning: string;
}

interface DeleteCollectionRequest {
  collectionName: string;
  reasoning: string;
}

/**
 * Validates that relationType is either "specializations" or "generalizations"
 */
const validateRelationType = (relationType: any): string => {
  if (relationType !== 'specializations' && relationType !== 'generalizations') {
    throw new ApiKeyValidationError(
      'Invalid relation type.'
    );
  }
  return relationType;
};

/**
 * Main handler for collections endpoints
 */
async function methodHandler(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<CollectionsApiResponse>
) {
  const { nodeId, relationType } = req.query;
  
  try {
    if (!nodeId || typeof nodeId !== 'string') {
      throw new ApiKeyValidationError('Invalid node ID. Please provide a valid node identifier.');
    }

    if (!relationType || typeof relationType !== 'string') {
      throw new ApiKeyValidationError('Relation type is required (specializations or generalizations).');
    }

    const validRelationType = validateRelationType(relationType);

    if (!req.apiKeyInfo) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        metadata: createMetadata('unknown')
      });
    }

    switch (req.method) {
      case 'GET':
        return getCollections(req, res, nodeId, validRelationType);
      case 'POST':
        return createCollection(req, res, nodeId, validRelationType);
      case 'PUT':
        return createMultipleCollections(req, res, nodeId, validRelationType);
      case 'DELETE':
        return deleteCollection(req, res, nodeId, validRelationType);
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({
          success: false,
          error: `Method ${req.method} Not Allowed`,
          metadata: createMetadata(req.apiKeyInfo.clientId)
        });
    }
  } catch (error) {
    console.error(`Error handling collection operation:`, error);
    
    if (error instanceof CustomApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
        metadata: createMetadata(req.apiKeyInfo?.clientId || 'unknown')
      });
    }

    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred while managing collections. Please try again or contact support.',
      code: 'INTERNAL_SERVER_ERROR',
      metadata: createMetadata(req.apiKeyInfo?.clientId || 'unknown')
    });
  }
}

/**
 * GET /api/nodes/{nodeId}/collections/{relationType}
 * Gets all collections for a specific relation type
 */
async function getCollections(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<CollectionsApiResponse>,
  nodeId: string,
  relationType: string
) {
  try {
    const node = await NodeService.getNode(nodeId);
    
    return res.status(200).json({
      success: true,
      data: {
        collections: node[relationType as 'specializations' | 'generalizations'] || []
      },
      metadata: createMetadata(req.apiKeyInfo.clientId)
    });
  } catch (error) {
    console.error(`Error getting ${relationType} collections:`, error);
    
    if (error instanceof CustomApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
        metadata: createMetadata(req.apiKeyInfo.clientId)
      });
    }

    return res.status(500).json({
      success: false,
      error: `Failed to retrieve ${relationType} collections.`,
      code: 'INTERNAL_SERVER_ERROR',
      metadata: createMetadata(req.apiKeyInfo.clientId)
    });
  }
}

/**
 * POST /api/nodes/{nodeId}/collections/{relationType}
 * Creates a new collection for a specific relation type
 */
async function createCollection(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<CollectionsApiResponse>,
  nodeId: string,
  relationType: string
) {
  try {
    const { collectionName, reasoning } = req.body as CreateCollectionRequest;

    if (!collectionName?.trim()) {
      throw new ApiKeyValidationError('Collection name is required.');
    }
    
    if (!reasoning?.trim()) {
      throw new ApiKeyValidationError('Reasoning is required.');
    }

    if (collectionName.toLowerCase() === 'main') {
      throw new ApiKeyValidationError('Cannot create a collection named "main" as it is reserved.');
    }

    const updatedNode = await NodeRelationshipService.createCollection(
      nodeId,
      relationType as 'specializations' | 'generalizations',
      collectionName,
      req.apiKeyInfo.clientId,
      reasoning
    );

    return res.status(201).json({
      success: true,
      data: {
        node: updatedNode
      },
      metadata: createMetadata(req.apiKeyInfo.clientId)
    });
  } catch (error) {
    console.error(`Error creating ${relationType} collection:`, error);
    
    if (error instanceof CustomApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
        metadata: createMetadata(req.apiKeyInfo.clientId)
      });
    }

    return res.status(500).json({
      success: false,
      error: `Failed to create ${relationType} collection.`,
      code: 'INTERNAL_SERVER_ERROR',
      metadata: createMetadata(req.apiKeyInfo.clientId)
    });
  }
}

/**
 * PUT /api/nodes/{nodeId}/collections/{relationType}
 * Creates multiple collections at once for a specific relation type
 */
async function createMultipleCollections(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<CollectionsApiResponse>,
  nodeId: string,
  relationType: string
) {
  try {
    const { collections, reasoning } = req.body as CreateMultipleCollectionsRequest;

    if (!Array.isArray(collections) || collections.length === 0) {
      throw new ApiKeyValidationError('Please provide at least one collection name.');
    }
    
    if (!reasoning?.trim()) {
      throw new ApiKeyValidationError('Reasoning is required.');
    }

    // Validate collection names
    for (const name of collections) {
      if (!name?.trim()) {
        throw new ApiKeyValidationError('Collection names cannot be empty.');
      }
      if (name.toLowerCase() === 'main') {
        throw new ApiKeyValidationError('Cannot create a collection named "main" as it is reserved.');
      }
    }

    const updatedNode = await NodeRelationshipService.createMultipleCollections(
      nodeId,
      relationType as 'specializations' | 'generalizations',
      collections,
      req.apiKeyInfo.clientId,
      reasoning
    );

    return res.status(201).json({
      success: true,
      data: {
        node: updatedNode
      },
      metadata: createMetadata(req.apiKeyInfo.clientId)
    });
  } catch (error) {
    console.error(`Error creating multiple ${relationType} collections:`, error);
    
    if (error instanceof CustomApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
        metadata: createMetadata(req.apiKeyInfo.clientId)
      });
    }

    return res.status(500).json({
      success: false,
      error: `Failed to create multiple ${relationType} collections.`,
      code: 'INTERNAL_SERVER_ERROR',
      metadata: createMetadata(req.apiKeyInfo.clientId)
    });
  }
}

/**
 * DELETE /api/nodes/{nodeId}/collections/{relationType}
 * Deletes a collection for a specific relation type
 */
async function deleteCollection(
  req: NextApiRequestWithAuth,
  res: NextApiResponse<CollectionsApiResponse>,
  nodeId: string,
  relationType: string
) {
  try {
    const { collectionName, reasoning } = req.body as DeleteCollectionRequest;

    if (!collectionName?.trim()) {
      throw new ApiKeyValidationError('Collection name is required.');
    }
    
    if (!reasoning?.trim()) {
      throw new ApiKeyValidationError('Reasoning is required.');
    }

    if (collectionName.toLowerCase() === 'main') {
      throw new ApiKeyValidationError('Cannot delete the "main" collection as it is required.');
    }

    const updatedNode = await NodeRelationshipService.deleteCollection(
      nodeId,
      relationType as 'specializations' | 'generalizations',
      collectionName,
      req.apiKeyInfo.clientId,
      reasoning
    );

    return res.status(200).json({
      success: true,
      data: {
        node: updatedNode
      },
      metadata: createMetadata(req.apiKeyInfo.clientId)
    });
  } catch (error) {
    console.error(`Error deleting ${relationType} collection:`, error);
    
    if (error instanceof CustomApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
        metadata: createMetadata(req.apiKeyInfo.clientId)
      });
    }

    return res.status(500).json({
      success: false,
      error: `Failed to delete ${relationType} collection.`,
      code: 'INTERNAL_SERVER_ERROR',
      metadata: createMetadata(req.apiKeyInfo.clientId)
    });
  }
}

export default validateApiKey(withApiLogger(methodHandler));