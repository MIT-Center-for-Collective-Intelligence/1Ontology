// changelog.service.ts
import { NODES, USERS, NODES_LOGS } from " @components/lib/firestoreClient/collections";
import { db } from " @components/lib/firestoreServer/admin";
import { INode, NodeChange } from " @components/types/INode";
import { arrayUnion, increment } from "firebase/firestore";
import { FieldValue } from "firebase-admin/firestore"; // Use Admin SDK field values

/**
 * Unified changelog service for creating and managing node change logs
 */
export class ChangelogService {
  /**
   * Creates a changelog entry and updates related data
   * 
   * This single method handles all changelog creation needs including:
   * - Creating the changelog entry
   * - Updating node contributors
   * - Updating user reputation
   * 
   * @param params - Complete NodeChange parameters
   * @returns Promise<string> - ID of the created changelog entry
   */
  static async createChangeLog(params: NodeChange): Promise<string> {
    try {
      if (!params.modifiedBy || params.modifiedBy === "ouhrac") {
        return "";
      }

      const changelogEntry = {
        ...params,
        modifiedAt: params.modifiedAt || new Date()
      };
      
      const docRef = await db.collection(NODES_LOGS).add(changelogEntry);
      
      await this.updateContributors(params.nodeId, params.modifiedBy, params.modifiedProperty);
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating changelog:', error);
      return "";
    }
  }

  /**
   * Updates node contributors and user reputation
   * 
   * @param nodeId - ID of the modified node
   * @param username - Username of the contributor
   * @param propertyName - Optional property being modified
   */
  private static async updateContributors(
    nodeId: string, 
    username: string, 
    propertyName: string | null
  ): Promise<void> {
    try {
      if (!username || username === "ouhrac") return;

      // First retrieve the current node to check if the contributor already exists
      const nodeDoc = await db.collection(NODES).doc(nodeId).get();
      if (!nodeDoc.exists) {
        console.warn(`Node ${nodeId} not found when updating contributors`);
        return;
      }
      
      const nodeData = nodeDoc.data();
      const contributors = nodeData?.contributors || [];
      const contributorsByProperty = nodeData?.contributorsByProperty || {};
      
      // Only add the contributor if they don't already exist
      const updates: Record<string, any> = {};
      if (!contributors.includes(username)) {
        updates.contributors = [...contributors, username];
      }
      
      // Add property-specific contributor if applicable
      if (propertyName) {
        const propertyContributors = contributorsByProperty[propertyName] || [];
        if (!propertyContributors.includes(username)) {
          updates[`contributorsByProperty.${propertyName}`] = [...propertyContributors, username];
        }
      }
      
      // Only update if there are changes to make
      if (Object.keys(updates).length > 0) {
        await db.collection(NODES).doc(nodeId).update(updates);
      }
      
      // Update user reputation - using document retrieval approach instead of field values
      // Omitted user reputation update functionality for all api endpoints
      // const userRef = db.collection(USERS).doc(username);
      // const userDoc = await userRef.get();
      
      // if (userDoc.exists) {
      //   const userData = userDoc.data();
      //   const currentReputation = userData?.reputations || 0;
        
      //   await userRef.update({
      //     reputations: currentReputation + 1,
      //     lastChangeMadeAt: new Date()
      //   });
      // } else {
      //   // Create user record if it doesn't exist
      //   await userRef.set({
      //     username,
      //     reputations: 1,
      //     lastChangeMadeAt: new Date(),
      //     createdAt: new Date()
      //   });
      // }
    } catch (error) {
      console.error('Error updating contributors:', error);
    }
  }

  /**
   * Helper method to create a changelog with standard parameters
   * 
   * @param nodeId - Node being modified
   * @param username - User making the change
   * @param changeType - Type of change
   * @param node - Current node state
   * @param reasoning - Reason for the change
   * @param property - Optional property being modified
   * @param previousValue - Optional previous value
   * @param newValue - Optional new value
   * @param details - Optional additional details
   * @returns Promise<string> - ID of the created changelog
   */
  static async log(
    nodeId: string,
    username: string,
    changeType: NodeChange['changeType'],
    node: INode,
    reasoning: string,
    property: string | null = null,
    previousValue: any = null,
    newValue: any = null,
    changeDetails?: any,
  ): Promise<string> {
    return this.createChangeLog({
      nodeId,
      modifiedBy: username,
      modifiedProperty: property,
      previousValue,
      newValue,
      modifiedAt: new Date(),
      changeType,
      fullNode: node,
      reasoning,
      changeDetails,
    });
  }

  static async logRelationshipChange(
    nodeId: string,
    username: string,
    changeType: 'add element' | 'remove element' | 'sort elements' | 'edit collection',
    node: INode,
    reasoning: string,
    relationshipType: 'specializations' | 'generalizations' | 'parts' | 'isPartOf',
    previousValue: any,
    newValue: any,
    details: Record<string, any> = {}
  ): Promise<string> {
    return this.createChangeLog({
      nodeId,
      modifiedBy: username,
      modifiedProperty: relationshipType,
      previousValue: previousValue,
      newValue: newValue,
      modifiedAt: new Date(),
      changeType,
      fullNode: node,
      reasoning,
      changeDetails: {
        relationshipType,
        ...details
      }
    });
  }

  /**
   * Retrieves changelog entries for a node
   * 
   * @param nodeId - ID of the node
   * @param limit - Maximum number of entries to retrieve
   * @param offset - Number of entries to skip
   * @returns Promise<NodeChange[]> - Changelog entries
   */
  static async getNodeChangeLogs(
    nodeId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<NodeChange[]> {
    try {
      const query = db.collection(NODES_LOGS)
        .where('nodeId', '==', nodeId)
        .orderBy('modifiedAt', 'desc')
        .limit(limit)
        .offset(offset);
      
      const snapshot = await query.get();
      
      const changes: NodeChange[] = [];
      snapshot.forEach(doc => {
        changes.push(doc.data() as NodeChange);
      });
      
      return changes;
    } catch (error) {
      console.error('Error retrieving node change logs:', error);
      return [];
    }
  }
}