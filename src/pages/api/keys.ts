/**
* @openapi
* /api/keys:
*   get:
*     tags:
*       - API Keys
*     summary: List API keys for a user
*     description: Retrieves all API keys associated with the specified user ID
*     parameters:
*       - in: query
*         name: userId
*         required: true
*         schema:
*           type: string
*         description: ID of the user whose API keys to retrieve
*     responses:
*       '200':
*         description: API keys retrieved successfully
*         content:
*           application/json:
*             schema:
*               type: object
*               properties:
*                 success:
*                   type: boolean
*                   example: true
*                 data:
*                   type: array
*                   items:
*                     type: object
*                     properties:
*                       clientId:
*                         type: string
*                       userId:
*                         type: string
*                       uname:
*                         type: string
*                       description:
*                         type: string
*                       createdAt:
*                         type: string
*                         format: date-time
*                 metadata:
*                   type: object
*                   properties:
*                     clientId:
*                       type: string
*                       example: system
*       '400':
*         description: Missing user ID
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/ErrorResponse'
*       '500':
*         description: Server error
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/ErrorResponse'
*             
*   post:
*     tags:
*       - API Keys
*     summary: Generate new API key
*     description: Creates a new API key for the specified user
*     requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             type: object
*             required:
*               - userId
*               - uname
*             properties:
*               userId:
*                 type: string
*                 description: ID of the user requesting the API key
*               uname:
*                 type: string
*                 description: Username or identifier for the API key
*               description:
*                 type: string
*                 description: Optional description for the API key
*     responses:
*       '201':
*         description: API key generated successfully
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
*                     apiKey:
*                       type: string
*                       description: The generated API key
*                     keyData:
*                       type: object
*                       properties:
*                         clientId:
*                           type: string
*                         userId:
*                           type: string
*                         uname:
*                           type: string
*                         description:
*                           type: string
*                         createdAt:
*                           type: string
*                           format: date-time
*                 metadata:
*                   type: object
*                   properties:
*                     clientId:
*                       type: string
*                       example: system
*       '400':
*         description: Missing required fields
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/ErrorResponse'
*       '500':
*         description: Server error
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/ErrorResponse'
*
*   delete:
*     tags:
*       - API Keys
*     summary: Deactivate API key
*     description: Deactivates an existing API key for the specified user
*     parameters:
*       - in: query
*         name: clientId
*         required: true
*         schema:
*           type: string
*         description: Client ID of the API key to deactivate
*       - in: query
*         name: userId
*         required: true
*         schema:
*           type: string
*         description: ID of the user who owns the API key
*     responses:
*       '200':
*         description: API key deactivated successfully
*         content:
*           application/json:
*             schema:
*               type: object
*               properties:
*                 success:
*                   type: boolean
*                   example: true
*                 metadata:
*                   type: object
*                   properties:
*                     clientId:
*                       type: string
*                       example: system
*       '400':
*         description: Missing required parameters
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/ErrorResponse'
*       '404':
*         description: API key not found or already deactivated
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/ErrorResponse'
*       '500':
*         description: Server error
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/ErrorResponse'
*
* components:
*   schemas:
*     ErrorResponse:
*       type: object
*       properties:
*         success:
*           type: boolean
*           example: false
*         error:
*           type: string
*         metadata:
*           type: object
*           properties:
*             clientId:
*               type: string
*               example: system
*/

import { NextApiRequest, NextApiResponse } from 'next';
import { Timestamp } from 'firebase-admin/firestore';
import { apiKeyManager } from ' @components/lib/utils/apiKeyManager';
import { ApiResponse } from ' @components/types/api';


async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  const { method } = req;

  switch (method) {
    case 'GET': {
      try {
        const { userId } = req.query;
        if (!userId) {
          return res.status(400).json({
            success: false,
            error: 'User ID is required',
            metadata: { clientId: 'system' }
          });
        }

        const keys = await apiKeyManager.listKeys(userId as string);
        return res.status(200).json({
          success: true,
          data: keys,
          metadata: { clientId: 'system' }
        });
      } catch (error) {
        console.error('Error fetching API keys:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch API keys',
          metadata: { clientId: 'system' }
        });
      }
    }

    case 'POST': {
      try {
        const { userId, uname, description } = req.body;
        
        if (!userId || !uname) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields',
            metadata: { clientId: 'system' }
          });
        }

        const { apiKey, keyData } = await apiKeyManager.generateKey({
          userId,
          uname,
          clientId: `client_${Date.now()}`,
          description: description || `API Key generated on ${new Date().toLocaleDateString()}`
        });

        return res.status(201).json({
          success: true,
          data: { apiKey, keyData },
          metadata: { clientId: 'system' }
        });
      } catch (error) {
        console.error('Error generating API key:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to generate API key',
          metadata: { clientId: 'system' }
        });
      }
    }

    case 'DELETE': {
      try {
        const { clientId, userId } = req.query;
        
        if (!clientId || !userId) {
          return res.status(400).json({
            success: false,
            error: 'Client ID and User ID are required',
            metadata: { clientId: 'system' }
          });
        }

        const success = await apiKeyManager.deactivateKey(clientId as string, userId as string);
        
        if (!success) {
          return res.status(404).json({
            success: false,
            error: 'API key not found or already deactivated',
            metadata: { clientId: 'system' }
          });
        }

        return res.status(200).json({
          success: true,
          metadata: { clientId: 'system' }
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to deactivate API key',
          metadata: { clientId: 'system' }
        });
      }
    }

    default:
      res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
      return res.status(405).json({
        success: false,
        error: `Method ${method} Not Allowed`,
        metadata: { clientId: 'system' }
      });
  }
}

export default handler;