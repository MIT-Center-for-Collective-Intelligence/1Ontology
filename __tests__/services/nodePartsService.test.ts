jest.mock(' @components/lib/firestoreServer/admin', () => {
  const firebaseMock = {
    collection: jest.fn(),
    runTransaction: jest.fn(),
    doc: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    set: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    offset: jest.fn(),
    limit: jest.fn(),
    count: jest.fn(),
  };

  return {
    db: {
      collection: jest.fn(() => firebaseMock),
      runTransaction: jest.fn(async (callback) => {
        return callback(firebaseMock);
      }),
      doc: jest.fn(() => ({ path: 'nodes/mock-id' }))
    }
  };
});

jest.mock(' @components/services/changelog', () => ({
  ChangelogService: {
    log: jest.fn().mockResolvedValue('mock-changelog-id')
  }
}));

import { NodePartsService } from ' @components/services/nodePartsService';
import { ChangelogService } from ' @components/services/changelog';
import { db } from ' @components/lib/firestoreServer/admin';
import { ApiKeyValidationError } from ' @components/types/api';
import { NODES } from ' @components/lib/firestoreClient/collections';
import { INode, ICollection, INodeTypes } from ' @components/types/INode';

// Define the type for document snapshot
interface DocSnap {
  exists: boolean;
  id: string;
  data: jest.Mock<any, any>;
  ref: {
    id: string;
    path: string;
  };
}

describe('NodePartsService', () => {
  // Mock document snapshot creation helper
  function createMockDocSnap(exists: boolean, data: INode | null = null): DocSnap {
    return {
      exists,
      id: data?.id || 'mock-id',
      data: jest.fn().mockReturnValue(data),
      ref: {
        id: data?.id || 'mock-id',
        path: `nodes/${data?.id || 'mock-id'}`
      }
    };
  }

  // Helper function to create a mock node
  function createMockNode(
    id: string = 'test-node-id',
    options: Partial<INode> = {}
  ): INode {
    return {
      id,
      title: options.title || 'Test Node',
      nodeType: options.nodeType as INodeTypes || 'container',
      deleted: options.deleted || false,
      properties: {
        parts: options.properties?.parts || [{ collectionName: 'main', nodes: [] }],
        isPartOf: options.properties?.isPartOf || [{ collectionName: 'main', nodes: [] }],
        ...(options.properties || {})
      },
      inheritance: options.inheritance || {},
      generalizations: options.generalizations || [{ collectionName: 'main', nodes: [] }],
      specializations: options.specializations || [{ collectionName: 'main', nodes: [] }],
      root: options.root || 'test-root',
      propertyType: options.propertyType || {},
      textValue: options.textValue || {},
      contributors: options.contributors || ['user1'],
      contributorsByProperty: options.contributorsByProperty || {},
      propertyOf: options.propertyOf || {},
      createdBy: options.createdBy || 'test-user',
      locked: options.locked || false
    };
  }

  // Helper function to create test collections
  function createTestCollection(
    collectionName: string = 'main',
    nodeIds: string[] = []
  ): ICollection {
    return {
      collectionName,
      nodes: nodeIds.map(id => ({ id }))
    };
  }

  // Mock Firebase and dependent services
  let mockFirebase: any;
  let mockDoc: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Firebase mock
    mockFirebase = {
      collection: jest.fn(),
      runTransaction: jest.fn(),
      doc: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      set: jest.fn(),
      where: jest.fn(),
      orderBy: jest.fn(),
      offset: jest.fn(),
      limit: jest.fn(),
      count: jest.fn(),
    };

    mockDoc = {
      id: 'mock-id',
      path: 'nodes/mock-id',
      get: jest.fn(),
      update: jest.fn(),
      set: jest.fn()
    };

    (db.collection as jest.Mock).mockReturnValue(mockFirebase);
    (db.runTransaction as jest.Mock).mockImplementation(async (callback: any) => {
      return callback(mockFirebase);
    });
    (db.doc as jest.Mock).mockReturnValue(mockDoc);

    mockFirebase.doc = jest.fn().mockReturnValue(mockDoc);

    // Reset any mocked methods that need restore
    if ((NodePartsService as any).wouldCreateCircularPartReference?.mockRestore) {
      (NodePartsService as any).wouldCreateCircularPartReference.mockRestore();
    }
  });

  describe('#addParts', () => {
    const containerNodeId = 'container-id';
    const partNodes = [{ id: 'part-id-1' }, { id: 'part-id-2' }];
    const username = 'test-user';
    const reasoning = 'Adding test parts';

    it('should add parts to a node with default collection', async () => {
      // Arrange
      const containerNode = createMockNode(containerNodeId);
      const partNode1 = createMockNode('part-id-1');
      const partNode2 = createMockNode('part-id-2');

      const containerSnapshot = createMockDocSnap(true, containerNode);
      const partSnapshot1 = createMockDocSnap(true, partNode1);
      const partSnapshot2 = createMockDocSnap(true, partNode2);

      mockFirebase.get
        .mockResolvedValueOnce(containerSnapshot)
        .mockResolvedValueOnce(partSnapshot1)
        .mockResolvedValueOnce(partSnapshot2);

      // Mock the private method for circular reference check
      // We'll spy on the function instead of mocking it directly
      const spy = jest.spyOn(NodePartsService as any, 'wouldCreateCircularPartReference')
        .mockReturnValue(false);

      // Act
      const result = await NodePartsService.addParts(
        containerNodeId,
        partNodes,
        username,
        reasoning
      );

      // Assert
      expect(db.collection).toHaveBeenCalledWith(NODES);
      expect(mockFirebase.get).toHaveBeenCalledTimes(3); // Container + 2 parts

      // Check the updated parts structure
      const expectedParts = [
        {
          collectionName: 'main',
          nodes: [
            { id: 'part-id-1' },
            { id: 'part-id-2' }
          ]
        }
      ];

      // Verify node was updated with new parts
      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.parts': expectedParts,
          contributors: ['user1', 'test-user']
        })
      );

      // Verify part nodes were updated with isPartOf relationships
      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.isPartOf': expect.arrayContaining([
            expect.objectContaining({
              collectionName: 'main',
              nodes: expect.arrayContaining([{ id: 'container-id' }])
            })
          ])
        })
      );

      // Verify changelog was created
      expect(ChangelogService.log).toHaveBeenCalledWith(
        containerNodeId,
        username,
        'add element',
        expect.anything(),
        reasoning,
        'parts',
        expect.anything(),
        expect.anything()
      );

      // Verify the function returned the updated node
      expect(result).toBeDefined();
      expect(result.properties.parts).toEqual(expectedParts);

      // Clean up spy
      spy.mockRestore();
    });

    it('should add parts to a specific collection when provided', async () => {
      // Arrange
      const containerNode = createMockNode(containerNodeId, {
        properties: {
          parts: [
            { collectionName: 'main', nodes: [] },
            { collectionName: 'custom', nodes: [] }
          ],
          isPartOf: []
        }
      });
      const partNode1 = createMockNode('part-id-1');
      const partNode2 = createMockNode('part-id-2');

      const containerSnapshot = createMockDocSnap(true, containerNode);
      const partSnapshot1 = createMockDocSnap(true, partNode1);
      const partSnapshot2 = createMockDocSnap(true, partNode2);

      mockFirebase.get
        .mockResolvedValueOnce(containerSnapshot)
        .mockResolvedValueOnce(partSnapshot1)
        .mockResolvedValueOnce(partSnapshot2);

      // Mock the private method for circular reference check
      const spy = jest.spyOn(NodePartsService as any, 'wouldCreateCircularPartReference')
        .mockReturnValue(false);

      // Act
      const result = await NodePartsService.addParts(
        containerNodeId,
        partNodes,
        username,
        reasoning,
        'custom'
      );

      // Assert
      // Check the updated parts structure
      const expectedParts = [
        { collectionName: 'main', nodes: [] },
        {
          collectionName: 'custom',
          nodes: [
            { id: 'part-id-1' },
            { id: 'part-id-2' }
          ]
        }
      ];

      // Verify node was updated with parts in the custom collection
      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.parts': expectedParts
        })
      );

      expect(result.properties.parts).toEqual(expectedParts);

      // Clean up spy
      spy.mockRestore();
    });

    it('should create a new collection if the specified collection does not exist', async () => {
      // Arrange
      const containerNode = createMockNode(containerNodeId);
      const partNode1 = createMockNode('part-id-1');

      const containerSnapshot = createMockDocSnap(true, containerNode);
      const partSnapshot1 = createMockDocSnap(true, partNode1);

      mockFirebase.get
        .mockResolvedValueOnce(containerSnapshot)
        .mockResolvedValueOnce(partSnapshot1);

      // Mock the private method for circular reference check
      const spy = jest.spyOn(NodePartsService as any, 'wouldCreateCircularPartReference')
        .mockReturnValue(false);

      // Act
      const result = await NodePartsService.addParts(
        containerNodeId,
        [{ id: 'part-id-1' }],
        username,
        reasoning,
        'newCollection'
      );

      // Assert
      // Check the updated parts structure
      const expectedParts = [
        { collectionName: 'main', nodes: [] },
        {
          collectionName: 'newCollection',
          nodes: [{ id: 'part-id-1' }]
        }
      ];

      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.parts': expectedParts
        })
      );

      expect(result.properties.parts).toEqual(expectedParts);

      // Clean up spy
      spy.mockRestore();
    });

    it('should not add parts that are already in the collection', async () => {
      // Arrange
      const containerNode = createMockNode(containerNodeId, {
        properties: {
          parts: [
            {
              collectionName: 'main',
              nodes: [{ id: 'part-id-1' }]
            }
          ],
          isPartOf: []
        }
      });
      const partNode1 = createMockNode('part-id-1');
      const partNode2 = createMockNode('part-id-2');

      const containerSnapshot = createMockDocSnap(true, containerNode);
      const partSnapshot1 = createMockDocSnap(true, partNode1);
      const partSnapshot2 = createMockDocSnap(true, partNode2);

      mockFirebase.get
        .mockResolvedValueOnce(containerSnapshot)
        .mockResolvedValueOnce(partSnapshot1)
        .mockResolvedValueOnce(partSnapshot2);

      // Mock the private method for circular reference check
      const spy = jest.spyOn(NodePartsService as any, 'wouldCreateCircularPartReference')
        .mockReturnValue(false);

      // Act
      const result = await NodePartsService.addParts(
        containerNodeId,
        partNodes,
        username,
        reasoning
      );

      // Assert
      // Should only add part-id-2 since part-id-1 already exists
      const expectedParts = [
        {
          collectionName: 'main',
          nodes: [
            { id: 'part-id-1' },
            { id: 'part-id-2' }
          ]
        }
      ];

      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.parts': expectedParts
        })
      );

      expect(result.properties.parts).toEqual(expectedParts);

      // Clean up spy
      spy.mockRestore();
    });

    it('should throw error when trying to add parts that would create circular references', async () => {
      // Arrange
      const containerNode = createMockNode(containerNodeId);
      const partNode1 = createMockNode('part-id-1');

      const containerSnapshot = createMockDocSnap(true, containerNode);
      const partSnapshot1 = createMockDocSnap(true, partNode1);

      mockFirebase.get
        .mockResolvedValueOnce(containerSnapshot)
        .mockResolvedValueOnce(partSnapshot1);

      // Mock the private method to simulate circular reference detection
      const spy = jest.spyOn(NodePartsService as any, 'wouldCreateCircularPartReference')
        .mockReturnValue(true);

      // Act & Assert
      await expect(NodePartsService.addParts(
        containerNodeId,
        [{ id: 'part-id-1' }],
        username,
        reasoning
      )).rejects.toThrow(/circular reference/);

      // Clean up spy
      spy.mockRestore();
    });

    it('should throw error when container node is not found', async () => {
      // Arrange
      const containerSnapshot = createMockDocSnap(false);

      mockFirebase.get.mockResolvedValueOnce(containerSnapshot);

      // Act & Assert
      await expect(NodePartsService.addParts(
        containerNodeId,
        partNodes,
        username,
        reasoning
      )).rejects.toThrow(`Container node ${containerNodeId} not found`);
    });

    it('should throw error when container node is deleted', async () => {
      // Arrange
      const containerNode = createMockNode(containerNodeId, { deleted: true });
      const containerSnapshot = createMockDocSnap(true, containerNode);

      mockFirebase.get.mockResolvedValueOnce(containerSnapshot);

      // Act & Assert
      await expect(NodePartsService.addParts(
        containerNodeId,
        partNodes,
        username,
        reasoning
      )).rejects.toThrow(`Cannot update deleted node ${containerNodeId}`);
    });

    it('should throw error when part node is not found', async () => {
      // Arrange
      const containerNode = createMockNode(containerNodeId);
      const containerSnapshot = createMockDocSnap(true, containerNode);
      const partSnapshot1 = createMockDocSnap(false);

      mockFirebase.get
        .mockResolvedValueOnce(containerSnapshot)
        .mockResolvedValueOnce(partSnapshot1);

      // Act & Assert
      await expect(NodePartsService.addParts(
        containerNodeId,
        [{ id: 'part-id-1' }],
        username,
        reasoning
      )).rejects.toThrow('Part node part-id-1 not found');
    });

    it('should throw error when part node is deleted', async () => {
      // Arrange
      const containerNode = createMockNode(containerNodeId);
      const partNode1 = createMockNode('part-id-1', { deleted: true });

      const containerSnapshot = createMockDocSnap(true, containerNode);
      const partSnapshot1 = createMockDocSnap(true, partNode1);

      mockFirebase.get
        .mockResolvedValueOnce(containerSnapshot)
        .mockResolvedValueOnce(partSnapshot1);

      // Act & Assert
      await expect(NodePartsService.addParts(
        containerNodeId,
        [{ id: 'part-id-1' }],
        username,
        reasoning
      )).rejects.toThrow('Part node part-id-1 is deleted and cannot be added as a part');
    });

    it('should throw error for invalid inputs', async () => {
      // Empty nodeId
      await expect(NodePartsService.addParts(
        '',
        partNodes,
        username,
        reasoning
      )).rejects.toThrow('Invalid node ID');

      // Empty nodes array
      await expect(NodePartsService.addParts(
        containerNodeId,
        [],
        username,
        reasoning
      )).rejects.toThrow('No part nodes provided');

      // Empty username
      await expect(NodePartsService.addParts(
        containerNodeId,
        partNodes,
        '',
        reasoning
      )).rejects.toThrow('Username is required');
    });

    it('should properly update bidirectional relationships', async () => {
      // Arrange
      const containerNode = createMockNode(containerNodeId);
      const partNode1 = createMockNode('part-id-1');

      const containerSnapshot = createMockDocSnap(true, containerNode);
      const partSnapshot1 = createMockDocSnap(true, partNode1);

      mockFirebase.get
        .mockResolvedValueOnce(containerSnapshot)
        .mockResolvedValueOnce(partSnapshot1);

      // Mock the private method for circular reference check
      const spy = jest.spyOn(NodePartsService as any, 'wouldCreateCircularPartReference')
        .mockReturnValue(false);

      // Track update calls
      const updateCalls: any[] = [];
      mockFirebase.update.mockImplementation((path: any, data: any) => {
        updateCalls.push({ path, data });
        return Promise.resolve();
      });

      // Act
      await NodePartsService.addParts(
        containerNodeId,
        [{ id: 'part-id-1' }],
        username,
        reasoning
      );

      // Assert
      // Verify both container and part updates were made
      expect(updateCalls.length).toBeGreaterThanOrEqual(2);

      // Check that container has the part
      const containerUpdates = updateCalls.find(call =>
        call.data['properties.parts'] &&
        call.data['properties.parts'][0].nodes.some((n: any) => n.id === 'part-id-1')
      );
      expect(containerUpdates).toBeDefined();

      // Check that part has the container in isPartOf
      const partUpdates = updateCalls.find(call =>
        call.data['properties.isPartOf'] &&
        call.data['properties.isPartOf'][0].nodes.some((n: any) => n.id === containerNodeId)
      );
      expect(partUpdates).toBeDefined();

      // Clean up spy
      spy.mockRestore();
    });

    it('should handle transaction errors gracefully', async () => {
      // Arrange
      (db.runTransaction as jest.Mock).mockRejectedValueOnce(new Error('Transaction failed'));

      // Act & Assert
      await expect(NodePartsService.addParts(
        containerNodeId,
        partNodes,
        username,
        reasoning
      )).rejects.toThrow('Failed to add parts: Transaction failed');
    });
  });

  // Tests for removeParts
  describe('#removeParts', () => {
    const containerNodeId = 'container-id';
    const partNodes = [{ id: 'part-id-1' }, { id: 'part-id-2' }];
    const username = 'test-user';
    const reasoning = 'Removing test parts';

    it('should remove parts from a node', async () => {
      // Arrange
      const containerNode = createMockNode(containerNodeId, {
        properties: {
          parts: [
            {
              collectionName: 'main',
              nodes: [
                { id: 'part-id-1' },
                { id: 'part-id-2' },
                { id: 'part-id-3' }
              ]
            }
          ],
          isPartOf: []
        }
      });

      const partNode1 = createMockNode('part-id-1');
      const partNode2 = createMockNode('part-id-2');

      const containerSnapshot = createMockDocSnap(true, containerNode);
      const partSnapshot1 = createMockDocSnap(true, partNode1);
      const partSnapshot2 = createMockDocSnap(true, partNode2);

      mockFirebase.get
        .mockResolvedValueOnce(containerSnapshot)
        .mockResolvedValueOnce(partSnapshot1)
        .mockResolvedValueOnce(partSnapshot2);

      // Act
      const result = await NodePartsService.removeParts(
        containerNodeId,
        partNodes,
        username,
        reasoning
      );

      // Assert
      // Check the updated parts structure
      const expectedParts = [
        {
          collectionName: 'main',
          nodes: [
            { id: 'part-id-3' }
          ]
        }
      ];

      // Verify node was updated with removed parts
      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.parts': expectedParts
        })
      );

      // Verify part nodes were updated to remove isPartOf relationships
      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.isPartOf': expect.arrayContaining([
            expect.objectContaining({
              collectionName: 'main',
              nodes: expect.not.arrayContaining([{ id: containerNodeId }])
            })
          ])
        })
      );

      // Verify changelog was created
      expect(ChangelogService.log).toHaveBeenCalledWith(
        containerNodeId,
        username,
        'remove element',
        expect.anything(),
        reasoning,
        'parts',
        expect.anything(),
        expect.anything()
      );

      // Verify the function returned the updated node
      expect(result).toBeDefined();
      expect(result.properties.parts).toEqual(expectedParts);
    });

    it('should keep the main collection even if it becomes empty', async () => {
      // Arrange
      const containerNode = createMockNode(containerNodeId, {
        properties: {
          parts: [
            {
              collectionName: 'main',
              nodes: [
                { id: 'part-id-1' },
                { id: 'part-id-2' }
              ]
            }
          ],
          isPartOf: []
        }
      });

      const partNode1 = createMockNode('part-id-1');
      const partNode2 = createMockNode('part-id-2');

      const containerSnapshot = createMockDocSnap(true, containerNode);
      const partSnapshot1 = createMockDocSnap(true, partNode1);
      const partSnapshot2 = createMockDocSnap(true, partNode2);

      mockFirebase.get
        .mockResolvedValueOnce(containerSnapshot)
        .mockResolvedValueOnce(partSnapshot1)
        .mockResolvedValueOnce(partSnapshot2);

      // Act
      const result = await NodePartsService.removeParts(
        containerNodeId,
        partNodes,
        username,
        reasoning
      );

      // Assert
      // Check the updated parts structure - main collection should remain with empty nodes
      const expectedParts = [
        {
          collectionName: 'main',
          nodes: []
        }
      ];

      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.parts': expectedParts
        })
      );

      expect(result.properties.parts).toEqual(expectedParts);
    });

    it('should remove parts from non-main collections', async () => {
      // Arrange
      const containerNode = createMockNode(containerNodeId, {
        properties: {
          parts: [
            { collectionName: 'main', nodes: [] },
            {
              collectionName: 'custom',
              nodes: [
                { id: 'part-id-1' },
                { id: 'part-id-2' },
                { id: 'part-id-3' }
              ]
            }
          ],
          isPartOf: []
        }
      });

      const partNode1 = createMockNode('part-id-1');
      const partNode2 = createMockNode('part-id-2');

      const containerSnapshot = createMockDocSnap(true, containerNode);
      const partSnapshot1 = createMockDocSnap(true, partNode1);
      const partSnapshot2 = createMockDocSnap(true, partNode2);

      mockFirebase.get
        .mockResolvedValueOnce(containerSnapshot)
        .mockResolvedValueOnce(partSnapshot1)
        .mockResolvedValueOnce(partSnapshot2);

      // Act
      const result = await NodePartsService.removeParts(
        containerNodeId,
        partNodes,
        username,
        reasoning
      );

      // Assert
      // Check the updated parts structure
      const expectedParts = [
        { collectionName: 'main', nodes: [] },
        {
          collectionName: 'custom',
          nodes: [
            { id: 'part-id-3' }
          ]
        }
      ];

      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.parts': expectedParts
        })
      );

      expect(result.properties.parts).toEqual(expectedParts);
    });

    it('should remove empty non-main collections', async () => {
      // Arrange
      const containerNode = createMockNode(containerNodeId, {
        properties: {
          parts: [
            { collectionName: 'main', nodes: [] },
            {
              collectionName: 'custom',
              nodes: [
                { id: 'part-id-1' }
              ]
            }
          ],
          isPartOf: []
        }
      });

      const partNode1 = createMockNode('part-id-1');

      const containerSnapshot = createMockDocSnap(true, containerNode);
      const partSnapshot1 = createMockDocSnap(true, partNode1);

      mockFirebase.get
        .mockResolvedValueOnce(containerSnapshot)
        .mockResolvedValueOnce(partSnapshot1);

      // Act
      const result = await NodePartsService.removeParts(
        containerNodeId,
        [{ id: 'part-id-1' }],
        username,
        reasoning
      );

      // Assert
      // Check the updated parts structure - custom collection should be removed
      const expectedParts = [
        { collectionName: 'main', nodes: [] }
      ];

      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.parts': expectedParts
        })
      );

      expect(result.properties.parts).toEqual(expectedParts);
    });

    it('should throw error when container node is not found', async () => {
      // Arrange
      const containerSnapshot = createMockDocSnap(false);

      mockFirebase.get.mockResolvedValueOnce(containerSnapshot);

      // Act & Assert
      await expect(NodePartsService.removeParts(
        containerNodeId,
        partNodes,
        username,
        reasoning
      )).rejects.toThrow(`Node ${containerNodeId} not found`);
    });

    it('should throw error when container node is deleted', async () => {
      // Arrange
      const containerNode = createMockNode(containerNodeId, { deleted: true });
      const containerSnapshot = createMockDocSnap(true, containerNode);

      mockFirebase.get.mockResolvedValueOnce(containerSnapshot);

      // Act & Assert
      await expect(NodePartsService.removeParts(
        containerNodeId,
        partNodes,
        username,
        reasoning
      )).rejects.toThrow(`Cannot update deleted node ${containerNodeId}`);
    });

    it('should handle non-existent part nodes gracefully', async () => {
      // Arrange
      const containerNode = createMockNode(containerNodeId, {
        properties: {
          parts: [
            {
              collectionName: 'main',
              nodes: [
                { id: 'part-id-1' },
                { id: 'part-id-3' }
              ]
            }
          ],
          isPartOf: []
        }
      });

      const partSnapshot1 = createMockDocSnap(false); // Part node doesn't exist
      const partSnapshot2 = createMockDocSnap(false); // Part node doesn't exist

      const containerSnapshot = createMockDocSnap(true, containerNode);

      mockFirebase.get
        .mockResolvedValueOnce(containerSnapshot)
        .mockResolvedValueOnce(partSnapshot1)
        .mockResolvedValueOnce(partSnapshot2);

      // Act
      const result = await NodePartsService.removeParts(
        containerNodeId,
        partNodes,
        username,
        reasoning
      );

      // Assert
      // Should still remove the parts from the container, even if they don't exist
      const expectedParts = [
        {
          collectionName: 'main',
          nodes: [
            { id: 'part-id-3' }
          ]
        }
      ];

      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.parts': expectedParts
        })
      );

      expect(result.properties.parts).toEqual(expectedParts);
    });

    it('should throw error for invalid inputs', async () => {
      // Empty nodeId
      await expect(NodePartsService.removeParts(
        '',
        partNodes,
        username,
        reasoning
      )).rejects.toThrow('Invalid node ID');

      // Empty nodes array
      await expect(NodePartsService.removeParts(
        containerNodeId,
        [],
        username,
        reasoning
      )).rejects.toThrow('No part nodes provided');

      // Empty username
      await expect(NodePartsService.removeParts(
        containerNodeId,
        partNodes,
        '',
        reasoning
      )).rejects.toThrow('Username is required');
    });

    it('should handle transaction errors gracefully', async () => {
      // Arrange
      (db.runTransaction as jest.Mock).mockRejectedValueOnce(new Error('Transaction failed'));

      // Act & Assert
      await expect(NodePartsService.removeParts(
        containerNodeId,
        partNodes,
        username,
        reasoning
      )).rejects.toThrow('Failed to remove parts: Transaction failed');
    });
  });

  // Tests for createPartsCollection
  describe('#createPartsCollection', () => {
    const nodeId = 'test-node-id';
    const collectionName = 'new-collection';
    const username = 'test-user';
    const reasoning = 'Creating new collection';

    it('should create a new collection within a node\'s parts', async () => {
      // Arrange
      const node = createMockNode(nodeId);
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act
      const result = await NodePartsService.createPartsCollection(
        nodeId,
        collectionName,
        username,
        reasoning
      );

      // Assert
      // Check the updated parts structure
      const expectedParts = [
        { collectionName: 'main', nodes: [] },
        { collectionName: collectionName, nodes: [] }
      ];

      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.parts': expectedParts,
          contributors: ['user1', username]
        })
      );

      // Verify changelog was created
      expect(ChangelogService.log).toHaveBeenCalledWith(
        nodeId,
        username,
        'add collection',
        expect.anything(),
        reasoning,
        'parts',
        expect.anything(),
        expectedParts
      );

      // Verify the function returned the updated node
      expect(result).toBeDefined();
      expect(result.properties.parts).toEqual(expectedParts);
    });

    it('should throw error when node is not found', async () => {
      // Arrange
      const nodeSnapshot = createMockDocSnap(false);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act & Assert
      await expect(NodePartsService.createPartsCollection(
        nodeId,
        collectionName,
        username,
        reasoning
      )).rejects.toThrow(`Node ${nodeId} not found`);
    });

    it('should throw error when node is deleted', async () => {
      // Arrange
      const node = createMockNode(nodeId, { deleted: true });
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act & Assert
      await expect(NodePartsService.createPartsCollection(
        nodeId,
        collectionName,
        username,
        reasoning
      )).rejects.toThrow(`Cannot update deleted node ${nodeId}`);
    });

    it('should throw error when collection already exists', async () => {
      // Arrange
      const node = createMockNode(nodeId, {
        properties: {
          parts: [
            { collectionName: 'main', nodes: [] },
            { collectionName: collectionName, nodes: [] }
          ],
          isPartOf: []
        }
      });
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act & Assert
      await expect(NodePartsService.createPartsCollection(
        nodeId,
        collectionName,
        username,
        reasoning
      )).rejects.toThrow(`Collection "${collectionName}" already exists in parts`);
    });

    it('should throw error when trying to create a collection named "main"', async () => {
      // Arrange
      const node = createMockNode(nodeId);
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act & Assert
      await expect(NodePartsService.createPartsCollection(
        nodeId,
        'main',
        username,
        reasoning
      )).rejects.toThrow('Cannot create a collection named "main" as it is reserved');
    });

    it('should throw error for invalid inputs', async () => {
      // Empty nodeId
      await expect(NodePartsService.createPartsCollection(
        '',
        collectionName,
        username,
        reasoning
      )).rejects.toThrow('Invalid node ID');

      // Empty collection name
      await expect(NodePartsService.createPartsCollection(
        nodeId,
        '',
        username,
        reasoning
      )).rejects.toThrow('Collection name is required');

      // Empty username
      await expect(NodePartsService.createPartsCollection(
        nodeId,
        collectionName,
        '',
        reasoning
      )).rejects.toThrow('Username is required');
    });

    it('should handle transaction errors gracefully', async () => {
      // Arrange
      (db.runTransaction as jest.Mock).mockRejectedValueOnce(new Error('Transaction failed'));

      // Act & Assert
      await expect(NodePartsService.createPartsCollection(
        nodeId,
        collectionName,
        username,
        reasoning
      )).rejects.toThrow(/Failed to create collection/);
    });
  });

  // Tests for deletePartsCollection
  describe('#deletePartsCollection', () => {
    const nodeId = 'test-node-id';
    const collectionName = 'custom-collection';
    const username = 'test-user';
    const reasoning = 'Deleting collection';

    it('should delete an empty collection from a node\'s parts', async () => {
      // Arrange
      const node = createMockNode(nodeId, {
        properties: {
          parts: [
            { collectionName: 'main', nodes: [] },
            { collectionName: collectionName, nodes: [] }
          ],
          isPartOf: []
        }
      });
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act
      const result = await NodePartsService.deletePartsCollection(
        nodeId,
        collectionName,
        username,
        reasoning
      );

      // Assert
      // Check the updated parts structure - only main collection should remain
      const expectedParts = [
        { collectionName: 'main', nodes: [] }
      ];

      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.parts': expectedParts,
          contributors: ['user1', username]
        })
      );

      // Verify changelog was created
      expect(ChangelogService.log).toHaveBeenCalledWith(
        nodeId,
        username,
        'delete collection',
        expect.anything(),
        reasoning,
        'parts',
        expect.anything(),
        expectedParts
      );

      // Verify the function returned the updated node
      expect(result).toBeDefined();
      expect(result.properties.parts).toEqual(expectedParts);
    });

    it('should throw error when node is not found', async () => {
      // Arrange
      const nodeSnapshot = createMockDocSnap(false);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act & Assert
      await expect(NodePartsService.deletePartsCollection(
        nodeId,
        collectionName,
        username,
        reasoning
      )).rejects.toThrow(`Node ${nodeId} not found`);
    });

    it('should throw error when node is deleted', async () => {
      // Arrange
      const node = createMockNode(nodeId, { deleted: true });
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act & Assert
      await expect(NodePartsService.deletePartsCollection(
        nodeId,
        collectionName,
        username,
        reasoning
      )).rejects.toThrow(`Cannot update deleted node ${nodeId}`);
    });

    it('should throw error when collection does not exist', async () => {
      // Arrange
      const node = createMockNode(nodeId);
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act & Assert
      await expect(NodePartsService.deletePartsCollection(
        nodeId,
        collectionName,
        username,
        reasoning
      )).rejects.toThrow(`Collection "${collectionName}" not found in parts`);
    });

    it('should throw error when trying to delete the "main" collection', async () => {
      // Arrange
      const node = createMockNode(nodeId);
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act & Assert
      await expect(NodePartsService.deletePartsCollection(
        nodeId,
        'main',
        username,
        reasoning
      )).rejects.toThrow('Cannot delete the "main" collection as it is required');
    });

    it('should throw error when collection is not empty', async () => {
      // Arrange
      const node = createMockNode(nodeId, {
        properties: {
          parts: [
            { collectionName: 'main', nodes: [] },
            {
              collectionName: collectionName,
              nodes: [{ id: 'part-id-1' }]
            }
          ],
          isPartOf: []
        }
      });
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act & Assert
      await expect(NodePartsService.deletePartsCollection(
        nodeId,
        collectionName,
        username,
        reasoning
      )).rejects.toThrow(`Cannot delete collection "${collectionName}" because it contains 1 nodes`);
    });

    it('should throw error for invalid inputs', async () => {
      // Empty nodeId
      await expect(NodePartsService.deletePartsCollection(
        '',
        collectionName,
        username,
        reasoning
      )).rejects.toThrow('Invalid node ID');

      // Empty collection name
      await expect(NodePartsService.deletePartsCollection(
        nodeId,
        '',
        username,
        reasoning
      )).rejects.toThrow('Collection name is required');

      // Empty username
      await expect(NodePartsService.deletePartsCollection(
        nodeId,
        collectionName,
        '',
        reasoning
      )).rejects.toThrow('Username is required');
    });

    it('should handle transaction errors gracefully', async () => {
      // Arrange
      (db.runTransaction as jest.Mock).mockRejectedValueOnce(new Error('Transaction failed'));

      // Act & Assert
      await expect(NodePartsService.deletePartsCollection(
        nodeId,
        collectionName,
        username,
        reasoning
      )).rejects.toThrow(/Failed to delete collection/);
    });
  });

  // Tests for reorderParts
  describe('#reorderParts', () => {
    const nodeId = 'test-node-id';
    const nodes = [
      { id: 'part-id-1' },
      { id: 'part-id-2' },
      { id: 'part-id-3' }
    ];
    const username = 'test-user';
    const reasoning = 'Reordering parts';

    it('should reorder parts within the main collection', async () => {
      // Arrange
      const node = createMockNode(nodeId, {
        properties: {
          parts: [
            {
              collectionName: 'main',
              nodes: [
                { id: 'part-id-1' },
                { id: 'part-id-2' },
                { id: 'part-id-3' }
              ]
            }
          ],
          isPartOf: []
        }
      });
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // New order: move part-id-2 to the beginning
      const nodesToMove = [{ id: 'part-id-2' }];
      const newIndices = [0];

      // Act
      const result = await NodePartsService.reorderParts(
        nodeId,
        nodesToMove,
        newIndices,
        'main',
        username,
        reasoning
      );

      // Assert
      // Check the updated parts structure
      const expectedParts = [
        {
          collectionName: 'main',
          nodes: [
            { id: 'part-id-2' },
            { id: 'part-id-1' },
            { id: 'part-id-3' }
          ]
        }
      ];

      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.parts': expectedParts
        })
      );

      // Verify changelog was created
      expect(ChangelogService.log).toHaveBeenCalledWith(
        nodeId,
        username,
        'sort elements',
        expect.anything(),
        reasoning,
        'parts',
        expect.anything(),
        expectedParts,
        expect.anything()
      );

      // Verify the function returned the updated node
      expect(result).toBeDefined();
      expect(result.properties.parts).toEqual(expectedParts);
    });

    it('should reorder parts within a custom collection', async () => {
      // Arrange
      const node = createMockNode(nodeId, {
        properties: {
          parts: [
            { collectionName: 'main', nodes: [] },
            {
              collectionName: 'custom',
              nodes: [
                { id: 'part-id-1' },
                { id: 'part-id-2' },
                { id: 'part-id-3' }
              ]
            }
          ],
          isPartOf: []
        }
      });
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // New order: move part-id-3 to the middle
      const nodesToMove = [{ id: 'part-id-3' }];
      const newIndices = [1];

      // Act
      const result = await NodePartsService.reorderParts(
        nodeId,
        nodesToMove,
        newIndices,
        'custom',
        username,
        reasoning
      );

      // Assert
      // Check the updated parts structure
      const expectedParts = [
        { collectionName: 'main', nodes: [] },
        {
          collectionName: 'custom',
          nodes: [
            { id: 'part-id-1' },
            { id: 'part-id-3' },
            { id: 'part-id-2' }
          ]
        }
      ];

      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.parts': expectedParts
        })
      );

      expect(result.properties.parts).toEqual(expectedParts);
    });

    it('should reorder multiple parts at once', async () => {
      // Arrange
      const node = createMockNode(nodeId, {
        properties: {
          parts: [
            {
              collectionName: 'main',
              nodes: [
                { id: 'part-id-1' },
                { id: 'part-id-2' },
                { id: 'part-id-3' },
                { id: 'part-id-4' }
              ]
            }
          ],
          isPartOf: []
        }
      });
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // New order: move part-id-3 to index 0 and part-id-1 to index 3
      const nodesToMove = [
        { id: 'part-id-3' },
        { id: 'part-id-1' }
      ];
      const newIndices = [0, 3];

      // Act
      const result = await NodePartsService.reorderParts(
        nodeId,
        nodesToMove,
        newIndices,
        'main',
        username,
        reasoning
      );

      // Assert
      // Check the updated parts structure
      const expectedParts = [
        {
          collectionName: 'main',
          nodes: [
            { id: 'part-id-3' },
            { id: 'part-id-2' },
            { id: 'part-id-4' },
            { id: 'part-id-1' }
          ]
        }
      ];

      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.parts': expectedParts
        })
      );

      expect(result.properties.parts).toEqual(expectedParts);
    });

    it('should throw error when node is not found', async () => {
      // Arrange
      const nodeSnapshot = createMockDocSnap(false);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act & Assert
      await expect(NodePartsService.reorderParts(
        nodeId,
        [{ id: 'part-id-1' }],
        [0],
        'main',
        username,
        reasoning
      )).rejects.toThrow(`Node ${nodeId} not found`);
    });

    it('should throw error when node is deleted', async () => {
      // Arrange
      const node = createMockNode(nodeId, { deleted: true });
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act & Assert
      await expect(NodePartsService.reorderParts(
        nodeId,
        [{ id: 'part-id-1' }],
        [0],
        'main',
        username,
        reasoning
      )).rejects.toThrow('Cannot modify a deleted node');
    });

    it('should throw error when collection does not exist', async () => {
      // Arrange
      const node = createMockNode(nodeId);
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act & Assert
      await expect(NodePartsService.reorderParts(
        nodeId,
        [{ id: 'part-id-1' }],
        [0],
        'non-existent',
        username,
        reasoning
      )).rejects.toThrow(`Collection 'non-existent' not found in node's parts`);
    });

    it('should throw error when node to reorder is not found in collection', async () => {
      // Arrange
      const node = createMockNode(nodeId, {
        properties: {
          parts: [
            {
              collectionName: 'main',
              nodes: [
                { id: 'part-id-1' },
                { id: 'part-id-2' }
              ]
            }
          ],
          isPartOf: []
        }
      });
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act & Assert
      await expect(NodePartsService.reorderParts(
        nodeId,
        [{ id: 'not-found-id' }],
        [0],
        'main',
        username,
        reasoning
      )).rejects.toThrow(`Node not-found-id not found in collection main`);
    });

    it('should throw error for invalid inputs', async () => {
      // Empty nodeId
      await expect(NodePartsService.reorderParts(
        '',
        nodes,
        [0, 1, 2],
        'main',
        username,
        reasoning
      )).rejects.toThrow('Invalid node ID');

      // Empty nodes array
      await expect(NodePartsService.reorderParts(
        nodeId,
        [],
        [],
        'main',
        username,
        reasoning
      )).rejects.toThrow('No nodes provided for reordering');

      // Mismatched nodes and indices arrays
      await expect(NodePartsService.reorderParts(
        nodeId,
        nodes,
        [0, 1], // One index missing
        'main',
        username,
        reasoning
      )).rejects.toThrow('New indices array must match nodes array length');

      // Empty username
      await expect(NodePartsService.reorderParts(
        nodeId,
        nodes,
        [0, 1, 2],
        'main',
        '',
        reasoning
      )).rejects.toThrow('Username is required');
    });

    it('should handle transaction errors gracefully', async () => {
      // Arrange
      (db.runTransaction as jest.Mock).mockRejectedValueOnce(new Error('Transaction failed'));

      // Act & Assert
      await expect(NodePartsService.reorderParts(
        nodeId,
        nodes,
        [0, 1, 2],
        'main',
        username,
        reasoning
      )).rejects.toThrow('Failed to reorder parts: Transaction failed');
    });

    it('should not make any changes when current and new indices are the same', async () => {
      // Arrange
      const node = createMockNode(nodeId, {
        properties: {
          parts: [
            {
              collectionName: 'main',
              nodes: [
                { id: 'part-id-1' },
                { id: 'part-id-2' },
                { id: 'part-id-3' }
              ]
            }
          ],
          isPartOf: []
        }
      });
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Same order as current (node at index 1 stays at index 1)
      const nodesToMove = [{ id: 'part-id-2' }];
      const newIndices = [1];

      // Act
      const result = await NodePartsService.reorderParts(
        nodeId,
        nodesToMove,
        newIndices,
        'main',
        username,
        reasoning
      );

      // Assert
      // Parts structure should remain unchanged
      const expectedParts = [
        {
          collectionName: 'main',
          nodes: [
            { id: 'part-id-1' },
            { id: 'part-id-2' },
            { id: 'part-id-3' }
          ]
        }
      ];

      // The update should still be called even if no changes are made
      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.parts': expectedParts
        })
      );

      expect(result.properties.parts).toEqual(expectedParts);
    });
  });

  // Tests for addIsPartOf
  describe('#addIsPartOf', () => {
    const partNodeId = 'part-id';
    const containerNodes = [{ id: 'container-id-1' }, { id: 'container-id-2' }];
    const username = 'test-user';
    const reasoning = 'Adding isPartOf relationships';

    it('should add isPartOf relationships to a node with default collection', async () => {
      // Arrange
      const partNode = createMockNode(partNodeId);
      const containerNode1 = createMockNode('container-id-1');
      const containerNode2 = createMockNode('container-id-2');

      const partSnapshot = createMockDocSnap(true, partNode);
      const containerSnapshot1 = createMockDocSnap(true, containerNode1);
      const containerSnapshot2 = createMockDocSnap(true, containerNode2);

      mockFirebase.get
        .mockResolvedValueOnce(partSnapshot)
        .mockResolvedValueOnce(containerSnapshot1)
        .mockResolvedValueOnce(containerSnapshot2);

      // Act
      const result = await NodePartsService.addIsPartOf(
        partNodeId,
        containerNodes,
        username,
        reasoning
      );

      // Assert
      // Check the updated isPartOf structure
      const expectedIsPartOf = [
        {
          collectionName: 'main',
          nodes: [
            { id: 'container-id-1' },
            { id: 'container-id-2' }
          ]
        }
      ];

      // Verify part node was updated with new isPartOf relationships
      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.isPartOf': expectedIsPartOf,
          contributors: ['user1', 'test-user']
        })
      );

      // Verify container nodes were updated with parts relationships
      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.parts': expect.arrayContaining([
            expect.objectContaining({
              collectionName: 'main',
              nodes: expect.arrayContaining([{ id: partNodeId }])
            })
          ])
        })
      );

      // Verify the function returned the updated node
      expect(result).toBeDefined();
      expect(result.properties.isPartOf).toEqual(expectedIsPartOf);
    });

    it('should add isPartOf relationships to a specific collection when provided', async () => {
      // Arrange
      const partNode = createMockNode(partNodeId, {
        properties: {
          isPartOf: [
            { collectionName: 'main', nodes: [] },
            { collectionName: 'custom', nodes: [] }
          ],
          parts: []
        }
      });
      const containerNode1 = createMockNode('container-id-1');

      const partSnapshot = createMockDocSnap(true, partNode);
      const containerSnapshot1 = createMockDocSnap(true, containerNode1);

      mockFirebase.get
        .mockResolvedValueOnce(partSnapshot)
        .mockResolvedValueOnce(containerSnapshot1);

      // Act
      const result = await NodePartsService.addIsPartOf(
        partNodeId,
        [{ id: 'container-id-1' }],
        username,
        reasoning,
        'custom'
      );

      // Assert
      // Check the updated isPartOf structure
      const expectedIsPartOf = [
        { collectionName: 'main', nodes: [] },
        {
          collectionName: 'custom',
          nodes: [
            { id: 'container-id-1' }
          ]
        }
      ];

      // Verify node was updated with isPartOf in the custom collection
      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.isPartOf': expectedIsPartOf
        })
      );

      expect(result.properties.isPartOf).toEqual(expectedIsPartOf);
    });

    it('should create a new collection if the specified collection does not exist', async () => {
      // Arrange
      const partNode = createMockNode(partNodeId);
      const containerNode1 = createMockNode('container-id-1');

      const partSnapshot = createMockDocSnap(true, partNode);
      const containerSnapshot1 = createMockDocSnap(true, containerNode1);

      mockFirebase.get
        .mockResolvedValueOnce(partSnapshot)
        .mockResolvedValueOnce(containerSnapshot1);

      // Act
      const result = await NodePartsService.addIsPartOf(
        partNodeId,
        [{ id: 'container-id-1' }],
        username,
        reasoning,
        'newCollection'
      );

      // Assert
      // Check the updated isPartOf structure
      const expectedIsPartOf = [
        { collectionName: 'main', nodes: [] },
        {
          collectionName: 'newCollection',
          nodes: [
            { id: 'container-id-1' }
          ]
        }
      ];

      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.isPartOf': expectedIsPartOf
        })
      );

      expect(result.properties.isPartOf).toEqual(expectedIsPartOf);
    });

    it('should not add containers that are already in the collection', async () => {
      // Arrange
      const partNode = createMockNode(partNodeId, {
        properties: {
          isPartOf: [
            {
              collectionName: 'main',
              nodes: [{ id: 'container-id-1' }]
            }
          ],
          parts: []
        }
      });
      const containerNode1 = createMockNode('container-id-1');
      const containerNode2 = createMockNode('container-id-2');

      const partSnapshot = createMockDocSnap(true, partNode);
      const containerSnapshot1 = createMockDocSnap(true, containerNode1);
      const containerSnapshot2 = createMockDocSnap(true, containerNode2);

      mockFirebase.get
        .mockResolvedValueOnce(partSnapshot)
        .mockResolvedValueOnce(containerSnapshot1)
        .mockResolvedValueOnce(containerSnapshot2);

      // Act
      const result = await NodePartsService.addIsPartOf(
        partNodeId,
        containerNodes,
        username,
        reasoning
      );

      // Assert
      // Should only add container-id-2 since container-id-1 already exists
      const expectedIsPartOf = [
        {
          collectionName: 'main',
          nodes: [
            { id: 'container-id-1' },
            { id: 'container-id-2' }
          ]
        }
      ];

      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.isPartOf': expectedIsPartOf
        })
      );

      expect(result.properties.isPartOf).toEqual(expectedIsPartOf);
    });

    it('should throw error when part node is not found', async () => {
      // Arrange
      const partSnapshot = createMockDocSnap(false);

      mockFirebase.get.mockResolvedValueOnce(partSnapshot);

      // Act & Assert
      await expect(NodePartsService.addIsPartOf(
        partNodeId,
        containerNodes,
        username,
        reasoning
      )).rejects.toThrow(`Part node ${partNodeId} not found`);
    });

    it('should throw error when part node is deleted', async () => {
      // Arrange
      const partNode = createMockNode(partNodeId, { deleted: true });
      const partSnapshot = createMockDocSnap(true, partNode);

      mockFirebase.get.mockResolvedValueOnce(partSnapshot);

      // Act & Assert
      await expect(NodePartsService.addIsPartOf(
        partNodeId,
        containerNodes,
        username,
        reasoning
      )).rejects.toThrow(`Cannot update deleted node ${partNodeId}`);
    });

    it('should throw error when container node is not found', async () => {
      // Arrange
      const partNode = createMockNode(partNodeId);
      const partSnapshot = createMockDocSnap(true, partNode);
      const containerSnapshot = createMockDocSnap(false);

      mockFirebase.get
        .mockResolvedValueOnce(partSnapshot)
        .mockResolvedValueOnce(containerSnapshot);

      // Act & Assert
      await expect(NodePartsService.addIsPartOf(
        partNodeId,
        [{ id: 'container-id-1' }],
        username,
        reasoning
      )).rejects.toThrow('Container node container-id-1 not found');
    });

    it('should throw error when container node is deleted', async () => {
      // Arrange
      const partNode = createMockNode(partNodeId);
      const containerNode = createMockNode('container-id-1', { deleted: true });

      const partSnapshot = createMockDocSnap(true, partNode);
      const containerSnapshot = createMockDocSnap(true, containerNode);

      mockFirebase.get
        .mockResolvedValueOnce(partSnapshot)
        .mockResolvedValueOnce(containerSnapshot);

      // Act & Assert
      await expect(NodePartsService.addIsPartOf(
        partNodeId,
        [{ id: 'container-id-1' }],
        username,
        reasoning
      )).rejects.toThrow('Container node container-id-1 is deleted and cannot be used as a container');
    });

    it('should throw error for invalid inputs', async () => {
      // Empty nodeId
      await expect(NodePartsService.addIsPartOf(
        '',
        containerNodes,
        username,
        reasoning
      )).rejects.toThrow('Invalid node ID');

      // Empty nodes array
      await expect(NodePartsService.addIsPartOf(
        partNodeId,
        [],
        username,
        reasoning
      )).rejects.toThrow('No container nodes provided');

      // Empty username
      await expect(NodePartsService.addIsPartOf(
        partNodeId,
        containerNodes,
        '',
        reasoning
      )).rejects.toThrow('Username is required');
    });

    it('should properly update bidirectional relationships', async () => {
      // Arrange
      const partNode = createMockNode(partNodeId);
      const containerNode = createMockNode('container-id-1');

      const partSnapshot = createMockDocSnap(true, partNode);
      const containerSnapshot = createMockDocSnap(true, containerNode);

      mockFirebase.get
        .mockResolvedValueOnce(partSnapshot)
        .mockResolvedValueOnce(containerSnapshot);

      // Track update calls
      const updateCalls: any[] = [];
      mockFirebase.update.mockImplementation((path: any, data: any) => {
        updateCalls.push({ path, data });
        return Promise.resolve();
      });

      // Act
      await NodePartsService.addIsPartOf(
        partNodeId,
        [{ id: 'container-id-1' }],
        username,
        reasoning
      );

      // Assert
      // Verify both part and container updates were made
      expect(updateCalls.length).toBeGreaterThanOrEqual(2);

      // Check that part has the container in isPartOf
      const partUpdates = updateCalls.find(call =>
        call.data['properties.isPartOf'] &&
        call.data['properties.isPartOf'][0].nodes.some((n: any) => n.id === 'container-id-1')
      );
      expect(partUpdates).toBeDefined();

      // Check that container has the part
      const containerUpdates = updateCalls.find(call =>
        call.data['properties.parts'] &&
        call.data['properties.parts'][0].nodes.some((n: any) => n.id === partNodeId)
      );
      expect(containerUpdates).toBeDefined();
    });

    it('should handle transaction errors gracefully', async () => {
      // Arrange
      (db.runTransaction as jest.Mock).mockRejectedValueOnce(new Error('Transaction failed'));

      // Act & Assert
      await expect(NodePartsService.addIsPartOf(
        partNodeId,
        containerNodes,
        username,
        reasoning
      )).rejects.toThrow('Failed to add isPartOf relationships: Transaction failed');
    });
  });

  // Tests for removeIsPartOf
  describe('#removeIsPartOf', () => {
    const partNodeId = 'part-id';
    const containerNodes = [{ id: 'container-id-1' }, { id: 'container-id-2' }];
    const username = 'test-user';
    const reasoning = 'Removing isPartOf relationships';

    it('should remove isPartOf relationships from a node', async () => {
      // Arrange
      const partNode = createMockNode(partNodeId, {
        properties: {
          isPartOf: [
            {
              collectionName: 'main',
              nodes: [
                { id: 'container-id-1' },
                { id: 'container-id-2' },
                { id: 'container-id-3' }
              ]
            }
          ],
          parts: []
        }
      });

      const containerNode1 = createMockNode('container-id-1');
      const containerNode2 = createMockNode('container-id-2');

      const partSnapshot = createMockDocSnap(true, partNode);
      const containerSnapshot1 = createMockDocSnap(true, containerNode1);
      const containerSnapshot2 = createMockDocSnap(true, containerNode2);

      mockFirebase.get
        .mockResolvedValueOnce(partSnapshot)
        .mockResolvedValueOnce(containerSnapshot1)
        .mockResolvedValueOnce(containerSnapshot2);

      // Act
      const result = await NodePartsService.removeIsPartOf(
        partNodeId,
        containerNodes,
        username,
        reasoning
      );

      // Assert
      // Check the updated isPartOf structure
      const expectedIsPartOf = [
        {
          collectionName: 'main',
          nodes: [
            { id: 'container-id-3' }
          ]
        }
      ];

      // Verify node was updated with removed isPartOf relationships
      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.isPartOf': expectedIsPartOf
        })
      );

      // Verify container nodes were updated to remove parts relationships
      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.parts': expect.arrayContaining([
            expect.objectContaining({
              collectionName: 'main',
              nodes: expect.not.arrayContaining([{ id: partNodeId }])
            })
          ])
        })
      );

      // Verify the function returned the updated node
      expect(result).toBeDefined();
      expect(result.properties.isPartOf).toEqual(expectedIsPartOf);
    });

    it('should keep the main collection even if it becomes empty', async () => {
      // Arrange
      const partNode = createMockNode(partNodeId, {
        properties: {
          isPartOf: [
            {
              collectionName: 'main',
              nodes: [
                { id: 'container-id-1' },
                { id: 'container-id-2' }
              ]
            }
          ],
          parts: []
        }
      });

      const containerNode1 = createMockNode('container-id-1');
      const containerNode2 = createMockNode('container-id-2');

      const partSnapshot = createMockDocSnap(true, partNode);
      const containerSnapshot1 = createMockDocSnap(true, containerNode1);
      const containerSnapshot2 = createMockDocSnap(true, containerNode2);

      mockFirebase.get
        .mockResolvedValueOnce(partSnapshot)
        .mockResolvedValueOnce(containerSnapshot1)
        .mockResolvedValueOnce(containerSnapshot2);

      // Act
      const result = await NodePartsService.removeIsPartOf(
        partNodeId,
        containerNodes,
        username,
        reasoning
      );

      // Assert
      // Check the updated isPartOf structure - main collection should remain with empty nodes
      const expectedIsPartOf = [
        {
          collectionName: 'main',
          nodes: []
        }
      ];

      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.isPartOf': expectedIsPartOf
        })
      );

      expect(result.properties.isPartOf).toEqual(expectedIsPartOf);
    });

    it('should remove isPartOf from non-main collections', async () => {
      // Arrange
      const partNode = createMockNode(partNodeId, {
        properties: {
          isPartOf: [
            { collectionName: 'main', nodes: [] },
            {
              collectionName: 'custom',
              nodes: [
                { id: 'container-id-1' },
                { id: 'container-id-2' },
                { id: 'container-id-3' }
              ]
            }
          ],
          parts: []
        }
      });

      const containerNode1 = createMockNode('container-id-1');
      const containerNode2 = createMockNode('container-id-2');

      const partSnapshot = createMockDocSnap(true, partNode);
      const containerSnapshot1 = createMockDocSnap(true, containerNode1);
      const containerSnapshot2 = createMockDocSnap(true, containerNode2);

      mockFirebase.get
        .mockResolvedValueOnce(partSnapshot)
        .mockResolvedValueOnce(containerSnapshot1)
        .mockResolvedValueOnce(containerSnapshot2);

      // Act
      const result = await NodePartsService.removeIsPartOf(
        partNodeId,
        containerNodes,
        username,
        reasoning
      );

      // Assert
      // Check the updated isPartOf structure
      const expectedIsPartOf = [
        { collectionName: 'main', nodes: [] },
        {
          collectionName: 'custom',
          nodes: [
            { id: 'container-id-3' }
          ]
        }
      ];

      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.isPartOf': expectedIsPartOf
        })
      );

      expect(result.properties.isPartOf).toEqual(expectedIsPartOf);
    });

    it('should remove empty non-main collections', async () => {
      // Arrange
      const partNode = createMockNode(partNodeId, {
        properties: {
          isPartOf: [
            { collectionName: 'main', nodes: [] },
            {
              collectionName: 'custom',
              nodes: [
                { id: 'container-id-1' }
              ]
            }
          ],
          parts: []
        }
      });

      const containerNode1 = createMockNode('container-id-1');

      const partSnapshot = createMockDocSnap(true, partNode);
      const containerSnapshot1 = createMockDocSnap(true, containerNode1);

      mockFirebase.get
        .mockResolvedValueOnce(partSnapshot)
        .mockResolvedValueOnce(containerSnapshot1);

      // Act
      const result = await NodePartsService.removeIsPartOf(
        partNodeId,
        [{ id: 'container-id-1' }],
        username,
        reasoning
      );

      // Assert
      // Check the updated isPartOf structure - custom collection should be removed
      const expectedIsPartOf = [
        { collectionName: 'main', nodes: [] }
      ];

      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.isPartOf': expectedIsPartOf
        })
      );

      expect(result.properties.isPartOf).toEqual(expectedIsPartOf);
    });

    it('should throw error when part node is not found', async () => {
      // Arrange
      const partSnapshot = createMockDocSnap(false);

      mockFirebase.get.mockResolvedValueOnce(partSnapshot);

      // Act & Assert
      await expect(NodePartsService.removeIsPartOf(
        partNodeId,
        containerNodes,
        username,
        reasoning
      )).rejects.toThrow(`Node ${partNodeId} not found`);
    });

    it('should throw error when part node is deleted', async () => {
      // Arrange
      const partNode = createMockNode(partNodeId, { deleted: true });
      const partSnapshot = createMockDocSnap(true, partNode);

      mockFirebase.get.mockResolvedValueOnce(partSnapshot);

      // Act & Assert
      await expect(NodePartsService.removeIsPartOf(
        partNodeId,
        containerNodes,
        username,
        reasoning
      )).rejects.toThrow(`Cannot update deleted node ${partNodeId}`);
    });

    it('should handle non-existent container nodes gracefully', async () => {
      // Arrange
      const partNode = createMockNode(partNodeId, {
        properties: {
          isPartOf: [
            {
              collectionName: 'main',
              nodes: [
                { id: 'container-id-1' },
                { id: 'container-id-3' }
              ]
            }
          ],
          parts: []
        }
      });

      const partSnapshot = createMockDocSnap(true, partNode);
      const containerSnapshot1 = createMockDocSnap(false); // Container node doesn't exist
      const containerSnapshot2 = createMockDocSnap(false); // Container node doesn't exist

      mockFirebase.get
        .mockResolvedValueOnce(partSnapshot)
        .mockResolvedValueOnce(containerSnapshot1)
        .mockResolvedValueOnce(containerSnapshot2);

      // Act
      const result = await NodePartsService.removeIsPartOf(
        partNodeId,
        containerNodes,
        username,
        reasoning
      );

      // Assert
      // Should still remove the isPartOf relationships from the part node, even if container nodes don't exist
      const expectedIsPartOf = [
        {
          collectionName: 'main',
          nodes: [
            { id: 'container-id-3' }
          ]
        }
      ];

      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.isPartOf': expectedIsPartOf
        })
      );

      expect(result.properties.isPartOf).toEqual(expectedIsPartOf);
    });

    it('should throw error for invalid inputs', async () => {
      // Empty nodeId
      await expect(NodePartsService.removeIsPartOf(
        '',
        containerNodes,
        username,
        reasoning
      )).rejects.toThrow('Invalid node ID');

      // Empty nodes array
      await expect(NodePartsService.removeIsPartOf(
        partNodeId,
        [],
        username,
        reasoning
      )).rejects.toThrow('No container nodes provided');

      // Empty username
      await expect(NodePartsService.removeIsPartOf(
        partNodeId,
        containerNodes,
        '',
        reasoning
      )).rejects.toThrow('Username is required');
    });

    it('should handle transaction errors gracefully', async () => {
      // Arrange
      (db.runTransaction as jest.Mock).mockRejectedValueOnce(new Error('Transaction failed'));

      // Act & Assert
      await expect(NodePartsService.removeIsPartOf(
        partNodeId,
        containerNodes,
        username,
        reasoning
      )).rejects.toThrow('Failed to remove isPartOf relationships: Transaction failed');
    });
  });
  // Tests for createIsPartOfCollection
  describe('#createIsPartOfCollection', () => {
    const nodeId = 'test-node-id';
    const collectionName = 'new-collection';
    const username = 'test-user';
    const reasoning = 'Creating new isPartOf collection';

    it('should create a new collection within a node\'s isPartOf', async () => {
      // Arrange
      const node = createMockNode(nodeId);
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act
      const result = await NodePartsService.createIsPartOfCollection(
        nodeId,
        collectionName,
        username,
        reasoning
      );

      // Assert
      // Check the updated isPartOf structure
      const expectedIsPartOf = [
        { collectionName: 'main', nodes: [] },
        { collectionName: collectionName, nodes: [] }
      ];

      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.isPartOf': expectedIsPartOf,
          contributors: ['user1', username]
        })
      );

      // Verify changelog was created
      expect(ChangelogService.log).toHaveBeenCalledWith(
        nodeId,
        username,
        'add collection',
        expect.anything(),
        reasoning,
        'isPartOf',
        expect.anything(),
        expectedIsPartOf
      );

      // Verify the function returned the updated node
      expect(result).toBeDefined();
      expect(result.properties.isPartOf).toEqual(expectedIsPartOf);
    });

    it('should throw error when node is not found', async () => {
      // Arrange
      const nodeSnapshot = createMockDocSnap(false);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act & Assert
      await expect(NodePartsService.createIsPartOfCollection(
        nodeId,
        collectionName,
        username,
        reasoning
      )).rejects.toThrow(`Node ${nodeId} not found`);
    });

    it('should throw error when node is deleted', async () => {
      // Arrange
      const node = createMockNode(nodeId, { deleted: true });
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act & Assert
      await expect(NodePartsService.createIsPartOfCollection(
        nodeId,
        collectionName,
        username,
        reasoning
      )).rejects.toThrow(`Cannot update deleted node ${nodeId}`);
    });

    it('should throw error when collection already exists', async () => {
      // Arrange
      const node = createMockNode(nodeId, {
        properties: {
          isPartOf: [
            { collectionName: 'main', nodes: [] },
            { collectionName: collectionName, nodes: [] }
          ],
          parts: []
        }
      });
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act & Assert
      await expect(NodePartsService.createIsPartOfCollection(
        nodeId,
        collectionName,
        username,
        reasoning
      )).rejects.toThrow(`Collection "${collectionName}" already exists in isPartOf`);
    });

    it('should throw error when trying to create a collection named "main"', async () => {
      // Arrange
      const node = createMockNode(nodeId);
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act & Assert
      await expect(NodePartsService.createIsPartOfCollection(
        nodeId,
        'main',
        username,
        reasoning
      )).rejects.toThrow('Cannot create a collection named "main" as it is reserved');
    });

    it('should throw error for invalid inputs', async () => {
      // Empty nodeId
      await expect(NodePartsService.createIsPartOfCollection(
        '',
        collectionName,
        username,
        reasoning
      )).rejects.toThrow('Invalid node ID');

      // Empty collection name
      await expect(NodePartsService.createIsPartOfCollection(
        nodeId,
        '',
        username,
        reasoning
      )).rejects.toThrow('Collection name is required');

      // Empty username
      await expect(NodePartsService.createIsPartOfCollection(
        nodeId,
        collectionName,
        '',
        reasoning
      )).rejects.toThrow('Username is required');
    });

    it('should handle transaction errors gracefully', async () => {
      // Arrange
      (db.runTransaction as jest.Mock).mockRejectedValueOnce(new Error('Transaction failed'));

      // Act & Assert
      await expect(NodePartsService.createIsPartOfCollection(
        nodeId,
        collectionName,
        username,
        reasoning
      )).rejects.toThrow(/Failed to create collection/);
    });
  });

  // Tests for deleteIsPartOfCollection
  describe('#deleteIsPartOfCollection', () => {
    const nodeId = 'test-node-id';
    const collectionName = 'custom-collection';
    const username = 'test-user';
    const reasoning = 'Deleting isPartOf collection';

    it('should delete an empty collection from a node\'s isPartOf', async () => {
      // Arrange
      const node = createMockNode(nodeId, {
        properties: {
          isPartOf: [
            { collectionName: 'main', nodes: [] },
            { collectionName: collectionName, nodes: [] }
          ],
          parts: []
        }
      });
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act
      const result = await NodePartsService.deleteIsPartOfCollection(
        nodeId,
        collectionName,
        username,
        reasoning
      );

      // Assert
      // Check the updated isPartOf structure - only main collection should remain
      const expectedIsPartOf = [
        { collectionName: 'main', nodes: [] }
      ];

      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.isPartOf': expectedIsPartOf,
          contributors: ['user1', username]
        })
      );

      // Verify changelog was created
      expect(ChangelogService.log).toHaveBeenCalledWith(
        nodeId,
        username,
        'delete collection',
        expect.anything(),
        reasoning,
        'isPartOf',
        expect.anything(),
        expectedIsPartOf
      );

      // Verify the function returned the updated node
      expect(result).toBeDefined();
      expect(result.properties.isPartOf).toEqual(expectedIsPartOf);
    });

    it('should throw error when node is not found', async () => {
      // Arrange
      const nodeSnapshot = createMockDocSnap(false);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act & Assert
      await expect(NodePartsService.deleteIsPartOfCollection(
        nodeId,
        collectionName,
        username,
        reasoning
      )).rejects.toThrow(`Node ${nodeId} not found`);
    });

    it('should throw error when node is deleted', async () => {
      // Arrange
      const node = createMockNode(nodeId, { deleted: true });
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act & Assert
      await expect(NodePartsService.deleteIsPartOfCollection(
        nodeId,
        collectionName,
        username,
        reasoning
      )).rejects.toThrow(`Cannot update deleted node ${nodeId}`);
    });

    it('should throw error when collection does not exist', async () => {
      // Arrange
      const node = createMockNode(nodeId);
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act & Assert
      await expect(NodePartsService.deleteIsPartOfCollection(
        nodeId,
        collectionName,
        username,
        reasoning
      )).rejects.toThrow(`Collection "${collectionName}" not found in isPartOf`);
    });

    it('should throw error when trying to delete the "main" collection', async () => {
      // Arrange
      const node = createMockNode(nodeId);
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act & Assert
      await expect(NodePartsService.deleteIsPartOfCollection(
        nodeId,
        'main',
        username,
        reasoning
      )).rejects.toThrow('Cannot delete the "main" collection as it is required');
    });

    it('should throw error when collection is not empty', async () => {
      // Arrange
      const node = createMockNode(nodeId, {
        properties: {
          isPartOf: [
            { collectionName: 'main', nodes: [] },
            {
              collectionName: collectionName,
              nodes: [{ id: 'container-id-1' }]
            }
          ],
          parts: []
        }
      });
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act & Assert
      await expect(NodePartsService.deleteIsPartOfCollection(
        nodeId,
        collectionName,
        username,
        reasoning
      )).rejects.toThrow(`Cannot delete collection "${collectionName}" because it contains 1 nodes`);
    });

    it('should throw error for invalid inputs', async () => {
      // Empty nodeId
      await expect(NodePartsService.deleteIsPartOfCollection(
        '',
        collectionName,
        username,
        reasoning
      )).rejects.toThrow('Invalid node ID');

      // Empty collection name
      await expect(NodePartsService.deleteIsPartOfCollection(
        nodeId,
        '',
        username,
        reasoning
      )).rejects.toThrow('Collection name is required');

      // Empty username
      await expect(NodePartsService.deleteIsPartOfCollection(
        nodeId,
        collectionName,
        '',
        reasoning
      )).rejects.toThrow('Username is required');
    });

    it('should handle transaction errors gracefully', async () => {
      // Arrange
      (db.runTransaction as jest.Mock).mockRejectedValueOnce(new Error('Transaction failed'));

      // Act & Assert
      await expect(NodePartsService.deleteIsPartOfCollection(
        nodeId,
        collectionName,
        username,
        reasoning
      )).rejects.toThrow(/Failed to delete collection/);
    });
  });

  // Tests for reorderIsPartOf
  describe('#reorderIsPartOf', () => {
    const nodeId = 'test-node-id';
    const nodes = [
      { id: 'container-id-1' },
      { id: 'container-id-2' },
      { id: 'container-id-3' }
    ];
    const username = 'test-user';
    const reasoning = 'Reordering isPartOf relationships';

    it('should reorder isPartOf relationships within the main collection', async () => {
      // Arrange
      const node = createMockNode(nodeId, {
        properties: {
          isPartOf: [
            {
              collectionName: 'main',
              nodes: [
                { id: 'container-id-1' },
                { id: 'container-id-2' },
                { id: 'container-id-3' }
              ]
            }
          ],
          parts: []
        }
      });
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // New order: move container-id-2 to the beginning
      const nodesToMove = [{ id: 'container-id-2' }];
      const newIndices = [0];

      // Act
      const result = await NodePartsService.reorderIsPartOf(
        nodeId,
        nodesToMove,
        newIndices,
        'main',
        username,
        reasoning
      );

      // Assert
      // Check the updated isPartOf structure
      const expectedIsPartOf = [
        {
          collectionName: 'main',
          nodes: [
            { id: 'container-id-2' },
            { id: 'container-id-1' },
            { id: 'container-id-3' }
          ]
        }
      ];

      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.isPartOf': expectedIsPartOf
        })
      );

      // Verify changelog was created
      expect(ChangelogService.log).toHaveBeenCalledWith(
        nodeId,
        username,
        'sort elements',
        expect.anything(),
        reasoning,
        'isPartOf',
        expect.anything(),
        expectedIsPartOf,
        expect.anything()
      );

      // Verify the function returned the updated node
      expect(result).toBeDefined();
      expect(result.properties.isPartOf).toEqual(expectedIsPartOf);
    });

    it('should reorder isPartOf relationships within a custom collection', async () => {
      // Arrange
      const node = createMockNode(nodeId, {
        properties: {
          isPartOf: [
            { collectionName: 'main', nodes: [] },
            {
              collectionName: 'custom',
              nodes: [
                { id: 'container-id-1' },
                { id: 'container-id-2' },
                { id: 'container-id-3' }
              ]
            }
          ],
          parts: []
        }
      });
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // New order: move container-id-3 to the middle
      const nodesToMove = [{ id: 'container-id-3' }];
      const newIndices = [1];

      // Act
      const result = await NodePartsService.reorderIsPartOf(
        nodeId,
        nodesToMove,
        newIndices,
        'custom',
        username,
        reasoning
      );

      // Assert
      // Check the updated isPartOf structure
      const expectedIsPartOf = [
        { collectionName: 'main', nodes: [] },
        {
          collectionName: 'custom',
          nodes: [
            { id: 'container-id-1' },
            { id: 'container-id-3' },
            { id: 'container-id-2' }
          ]
        }
      ];

      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.isPartOf': expectedIsPartOf
        })
      );

      expect(result.properties.isPartOf).toEqual(expectedIsPartOf);
    });

    it('should reorder multiple isPartOf relationships at once', async () => {
      // Arrange
      const node = createMockNode(nodeId, {
        properties: {
          isPartOf: [
            {
              collectionName: 'main',
              nodes: [
                { id: 'container-id-1' },
                { id: 'container-id-2' },
                { id: 'container-id-3' },
                { id: 'container-id-4' }
              ]
            }
          ],
          parts: []
        }
      });
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // New order: move container-id-3 to index 0 and container-id-1 to index 3
      const nodesToMove = [
        { id: 'container-id-3' },
        { id: 'container-id-1' }
      ];
      const newIndices = [0, 3];

      // Act
      const result = await NodePartsService.reorderIsPartOf(
        nodeId,
        nodesToMove,
        newIndices,
        'main',
        username,
        reasoning
      );

      // Assert
      // Check the updated isPartOf structure
      const expectedIsPartOf = [
        {
          collectionName: 'main',
          nodes: [
            { id: 'container-id-3' },
            { id: 'container-id-2' },
            { id: 'container-id-4' },
            { id: 'container-id-1' }
          ]
        }
      ];

      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.isPartOf': expectedIsPartOf
        })
      );

      expect(result.properties.isPartOf).toEqual(expectedIsPartOf);
    });

    it('should throw error when node is not found', async () => {
      // Arrange
      const nodeSnapshot = createMockDocSnap(false);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act & Assert
      await expect(NodePartsService.reorderIsPartOf(
        nodeId,
        [{ id: 'container-id-1' }],
        [0],
        'main',
        username,
        reasoning
      )).rejects.toThrow(`Node ${nodeId} not found`);
    });

    it('should throw error when node is deleted', async () => {
      // Arrange
      const node = createMockNode(nodeId, { deleted: true });
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act & Assert
      await expect(NodePartsService.reorderIsPartOf(
        nodeId,
        [{ id: 'container-id-1' }],
        [0],
        'main',
        username,
        reasoning
      )).rejects.toThrow('Cannot modify a deleted node');
    });

    it('should throw error when collection does not exist', async () => {
      // Arrange
      const node = createMockNode(nodeId);
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act & Assert
      await expect(NodePartsService.reorderIsPartOf(
        nodeId,
        [{ id: 'container-id-1' }],
        [0],
        'non-existent',
        username,
        reasoning
      )).rejects.toThrow(`Collection 'non-existent' not found in node's isPartOf`);
    });

    it('should throw error when node to reorder is not found in collection', async () => {
      // Arrange
      const node = createMockNode(nodeId, {
        properties: {
          isPartOf: [
            {
              collectionName: 'main',
              nodes: [
                { id: 'container-id-1' },
                { id: 'container-id-2' }
              ]
            }
          ],
          parts: []
        }
      });
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Act & Assert
      await expect(NodePartsService.reorderIsPartOf(
        nodeId,
        [{ id: 'not-found-id' }],
        [0],
        'main',
        username,
        reasoning
      )).rejects.toThrow(`Node not-found-id not found in collection main`);
    });

    it('should throw error for invalid inputs', async () => {
      // Empty nodeId
      await expect(NodePartsService.reorderIsPartOf(
        '',
        nodes,
        [0, 1, 2],
        'main',
        username,
        reasoning
      )).rejects.toThrow('Invalid node ID');

      // Empty nodes array
      await expect(NodePartsService.reorderIsPartOf(
        nodeId,
        [],
        [],
        'main',
        username,
        reasoning
      )).rejects.toThrow('No nodes provided for reordering');

      // Mismatched nodes and indices arrays
      await expect(NodePartsService.reorderIsPartOf(
        nodeId,
        nodes,
        [0, 1], // One index missing
        'main',
        username,
        reasoning
      )).rejects.toThrow('New indices array must match nodes array length');

      // Empty username
      await expect(NodePartsService.reorderIsPartOf(
        nodeId,
        nodes,
        [0, 1, 2],
        'main',
        '',
        reasoning
      )).rejects.toThrow('Username is required');
    });

    it('should handle transaction errors gracefully', async () => {
      // Arrange
      (db.runTransaction as jest.Mock).mockRejectedValueOnce(new Error('Transaction failed'));

      // Act & Assert
      await expect(NodePartsService.reorderIsPartOf(
        nodeId,
        nodes,
        [0, 1, 2],
        'main',
        username,
        reasoning
      )).rejects.toThrow('Failed to reorder isPartOf relationships: Transaction failed');
    });

    it('should not make any changes when current and new indices are the same', async () => {
      // Arrange
      const node = createMockNode(nodeId, {
        properties: {
          isPartOf: [
            {
              collectionName: 'main',
              nodes: [
                { id: 'container-id-1' },
                { id: 'container-id-2' },
                { id: 'container-id-3' }
              ]
            }
          ],
          parts: []
        }
      });
      const nodeSnapshot = createMockDocSnap(true, node);

      mockFirebase.get.mockResolvedValue(nodeSnapshot);

      // Same order as current (node at index 1 stays at index 1)
      const nodesToMove = [{ id: 'container-id-2' }];
      const newIndices = [1];

      // Act
      const result = await NodePartsService.reorderIsPartOf(
        nodeId,
        nodesToMove,
        newIndices,
        'main',
        username,
        reasoning
      );

      // Assert
      // isPartOf structure should remain unchanged
      const expectedIsPartOf = [
        {
          collectionName: 'main',
          nodes: [
            { id: 'container-id-1' },
            { id: 'container-id-2' },
            { id: 'container-id-3' }
          ]
        }
      ];

      // The update should still be called even if no changes are made
      expect(mockFirebase.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'properties.isPartOf': expectedIsPartOf
        })
      );

      expect(result.properties.isPartOf).toEqual(expectedIsPartOf);
    });
  });
});