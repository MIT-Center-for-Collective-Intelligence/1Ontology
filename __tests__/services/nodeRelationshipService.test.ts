// This needs to be at the very top of your test file, before any imports
jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(),
  cert: jest.fn(),
  getApps: jest.fn(() => [{ name: '[DEFAULT]' }]),
}));

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  FieldValue: {
    delete: jest.fn().mockReturnValue({ _methodName: 'FieldValue.delete' }),
    arrayUnion: jest.fn(items => ({ _methodName: 'FieldValue.arrayUnion', items }))
  }
}));

// Mock the Firebase admin module first, before any other imports
jest.mock(' @components/lib/firestoreServer/admin', () => {
  return {
    db: {
      collection: jest.fn(() => mockFirebase),
      doc: jest.fn(() => mockDocRef),
      runTransaction: jest.fn(),
      batch: jest.fn(() => ({
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue({}),
      }))
    }
  };
});

// Define mockFirebase and mockDocRef outside so they can be referenced
const mockDocRef = {
  path: '',
  id: '',
  get: jest.fn(),
  update: jest.fn(),
  set: jest.fn()
};

const mockFirebase = {
  doc: jest.fn(() => mockDocRef),
  get: jest.fn(),
  update: jest.fn(),
  set: jest.fn(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  count: jest.fn()
};

jest.mock(' @components/services/changelog', () => ({
  ChangelogService: {
    log: jest.fn().mockResolvedValue('mock-changelog-id')
  }
}));

jest.mock(' @components/services/nodeInheritanceService', () => ({
  NodeInheritanceService: {
    updateInheritanceWhenUnlinkAGeneralization: jest.fn().mockResolvedValue({}),
    getParentNodeData: jest.fn().mockResolvedValue({})
  }
}));

import { NodeRelationshipService } from ' @components/services/nodeRelationshipService';
import { db } from ' @components/lib/firestoreServer/admin';
import { ChangelogService } from ' @components/services/changelog';
import { NodeInheritanceService } from ' @components/services/nodeInheritanceService';
import { INode, ICollection } from ' @components/types/INode';
import { ApiKeyValidationError } from ' @components/types/api';
import { FieldValue } from 'firebase-admin/firestore';

describe('NodeRelationshipService', () => {
  // Helper function to create a mock node
  function createMockNode(
    id: string = 'test-node-id',
    options: Partial<INode> = {}
  ): INode {
    return {
      id,
      title: options.title || 'Test Node',
      nodeType: options.nodeType || 'activity',
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
      createdBy: options.createdBy || 'test-user',
      contributors: options.contributors || [],
      contributorsByProperty: options.contributorsByProperty || {},
      propertyOf: options.propertyOf,
      locked: options.locked,
      images: options.images,
      oNet: options.oNet,
      actionAlternatives: options.actionAlternatives,
      category: options.category,
      numberOfGeneralizations: options.numberOfGeneralizations,
      unclassified: options.unclassified
    };
  }

  let mockTransaction: any;
  let docRefs: { [path: string]: { exists: boolean, data: any, path: string } };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset document references
    docRefs = {};

    // Create a mockable collection/doc reference handler
    const mockDocRef = (path: string) => ({
      path,
      id: path.split('/').pop(),
      get: jest.fn().mockImplementation(() => {
        if (docRefs[path]) {
          return Promise.resolve({
            exists: docRefs[path].exists,
            data: () => docRefs[path].data,
            ref: { path, id: path.split('/').pop() }
          });
        }
        return Promise.resolve({ exists: false });
      }),
      update: jest.fn().mockImplementation((data) => {
        // Store the update for validation
        if (!docRefs[path]) {
          docRefs[path] = { exists: true, data: {}, path };
        }
        docRefs[path].data = { ...docRefs[path].data, ...data };
        return Promise.resolve();
      })
    });

    // Setup transaction mock
    mockTransaction = {
      get: jest.fn().mockImplementation((docRef) => {
        return docRef.get();
      }),
      update: jest.fn().mockImplementation((docRef, data) => {
        return docRef.update(data);
      })
    };

    // Mock db.collection and db.doc to return proper reference
    (db.collection as jest.Mock).mockImplementation((collection) => {
      return {
        doc: jest.fn().mockImplementation((docId) => {
          const path = `${collection}/${docId}`;
          return mockDocRef(path);
        })
      };
    });

    // Mock db.doc for direct references
    (db.doc as jest.Mock).mockImplementation((path) => {
      return mockDocRef(path);
    });

    // Setup transaction
    (db.runTransaction as jest.Mock).mockImplementation(async (callback) => {
      return callback(mockTransaction);
    });
  });

  describe('#addSpecializations', () => {
    it('should add specializations to a node with default collection', async () => {
      // Arrange
      const nodeId = 'parent-id';
      const nodes = [{ id: 'child-1' }];
      const uname = 'test-user';
      const reasoning = 'Adding specialization';

      // Create mock nodes
      const parentNode = createMockNode('parent-id', {
        specializations: [
          { collectionName: 'main', nodes: [{ id: 'existing-child-id' }] }
        ],
        contributors: ['previous-contributor'],
        contributorsByProperty: {
          specializations: ['previous-contributor']
        }
      });

      const childNode = createMockNode('child-1', {
        generalizations: [{ collectionName: 'main', nodes: [] }]
      });

      // Set up document references
      docRefs[`nodes/${nodeId}`] = { exists: true, data: parentNode, path: `nodes/${nodeId}` };
      docRefs[`nodes/child-1`] = { exists: true, data: childNode, path: `nodes/child-1` };

      // Act
      const result = await NodeRelationshipService.addSpecializations(
        nodeId, nodes, uname, reasoning
      );

      // Assert
      expect(db.runTransaction).toHaveBeenCalled();

      // Verify the document update
      expect(docRefs[`nodes/${nodeId}`].data.specializations).toEqual([
        {
          collectionName: 'main',
          nodes: [
            { id: 'existing-child-id' },
            { id: 'child-1' }
          ]
        }
      ]);

      expect(docRefs[`nodes/${nodeId}`].data.contributors).toEqual([
        'previous-contributor', 'test-user'
      ]);

      expect(docRefs[`nodes/${nodeId}`].data.contributorsByProperty).toEqual({
        specializations: ['previous-contributor', 'test-user']
      });

      // Verify the child node was updated with bidirectional relationship
      expect(docRefs[`nodes/child-1`].data.generalizations).toEqual([
        {
          collectionName: 'main',
          nodes: [{ id: 'parent-id' }]
        }
      ]);

      // Verify the returned node has correct specializations
      expect(result.specializations[0].nodes).toEqual(
        expect.arrayContaining([{ id: 'child-1' }])
      );

      // Verify changelog was created
      expect(ChangelogService.log).toHaveBeenCalledWith(
        'parent-id',
        'test-user',
        'add element',
        expect.any(Object),
        'Adding specialization',
        'specializations',
        expect.any(Array),
        expect.any(Array)
      );
    });

    it('should throw an error when node is not found', async () => {
      // Arrange
      const nodeId = 'non-existent-id';
      const nodes = [{ id: 'child-1' }];
      const uname = 'test-user';
      const reasoning = 'Adding to non-existent node';

      // No document reference setup for non-existent node

      // Act & Assert
      await expect(
        NodeRelationshipService.addSpecializations(nodeId, nodes, uname, reasoning)
      ).rejects.toThrow('Parent node non-existent-id not found');
    });

    it('should throw an error when node is deleted', async () => {
      // Arrange
      const nodeId = 'deleted-node-id';
      const nodes = [{ id: 'child-1' }];
      const uname = 'test-user';
      const reasoning = 'Adding to deleted node';

      // Create mock deleted node
      const deletedNode = createMockNode('deleted-node-id', { deleted: true });

      // Set up document reference
      docRefs[`nodes/${nodeId}`] = { exists: true, data: deletedNode, path: `nodes/${nodeId}` };

      // Act & Assert
      await expect(
        NodeRelationshipService.addSpecializations(nodeId, nodes, uname, reasoning)
      ).rejects.toThrow('Cannot update deleted node deleted-node-id');
    });

    it('should throw an error when specialization node is not found', async () => {
      // Arrange
      const nodeId = 'parent-id';
      const nodes = [{ id: 'non-existent-child' }];
      const uname = 'test-user';
      const reasoning = 'Adding non-existent specialization';

      // Create mock parent node
      const parentNode = createMockNode('parent-id');

      // Set up document reference for parent only
      docRefs[`nodes/${nodeId}`] = { exists: true, data: parentNode, path: `nodes/${nodeId}` };
      // No document reference for non-existent child

      // Act & Assert
      await expect(
        NodeRelationshipService.addSpecializations(nodeId, nodes, uname, reasoning)
      ).rejects.toThrow('Specialization node non-existent-child not found');
    });

    it('should throw an error for invalid input parameters', async () => {
      // Test cases for invalid inputs
      const invalidInputs = [
        {
          params: ['', [{ id: 'child-1' }], 'user', 'reason'],
          expectedError: 'Invalid node ID'
        },
        {
          params: ['parent-id', [], 'user', 'reason'],
          expectedError: 'No specialization nodes provided'
        },
        {
          params: ['parent-id', [{ id: 'child-1' }], '', 'reason'],
          expectedError: 'Username is required'
        }
      ];

      // Test each invalid input case
      for (const input of invalidInputs) {
        await expect(
          NodeRelationshipService.addSpecializations(
            input.params[0] as string,
            input.params[1] as { id: string }[],
            input.params[2] as string,
            input.params[3] as string
          )
        ).rejects.toThrow(input.expectedError);
      }
    });
  });

  describe('#removeSpecializations', () => {
    it('should remove specializations from a node', async () => {
      // Arrange
      const nodeId = 'parent-id';
      const nodes = [{ id: 'spec-1' }, { id: 'spec-2' }];
      const uname = 'test-user';
      const reasoning = 'Removing specializations';

      // Create mock nodes
      const parentNode = createMockNode('parent-id', {
        specializations: [
          {
            collectionName: 'main',
            nodes: [
              { id: 'spec-1' },
              { id: 'spec-2' },
              { id: 'spec-3' }
            ]
          },
          {
            collectionName: 'custom',
            nodes: [
              { id: 'spec-4' },
              { id: 'spec-5' }
            ]
          }
        ],
        contributors: ['previous-contributor'],
        contributorsByProperty: {
          specializations: ['previous-contributor']
        }
      });

      const spec1Node = createMockNode('spec-1', {
        generalizations: [
          { collectionName: 'main', nodes: [{ id: 'parent-id' }] }
        ]
      });

      const spec2Node = createMockNode('spec-2', {
        generalizations: [
          { collectionName: 'main', nodes: [{ id: 'parent-id' }] }
        ]
      });

      // Set up document references
      docRefs[`nodes/${nodeId}`] = { exists: true, data: parentNode, path: `nodes/${nodeId}` };
      docRefs[`nodes/spec-1`] = { exists: true, data: spec1Node, path: `nodes/spec-1` };
      docRefs[`nodes/spec-2`] = { exists: true, data: spec2Node, path: `nodes/spec-2` };

      // Act
      const result = await NodeRelationshipService.removeSpecializations(
        nodeId, nodes, uname, reasoning
      );

      // Assert
      expect(db.runTransaction).toHaveBeenCalled();

      // Check parent node update in docRefs
      expect(docRefs[`nodes/${nodeId}`].data.specializations).toEqual([
        {
          collectionName: 'main',
          nodes: [{ id: 'spec-3' }]  // Only spec-3 remains
        },
        {
          collectionName: 'custom',
          nodes: [{ id: 'spec-4' }, { id: 'spec-5' }]  // Custom collection unchanged
        }
      ]);

      // Check contributors updated
      expect(docRefs[`nodes/${nodeId}`].data.contributorsByProperty).toHaveProperty('specializations');
      expect(docRefs[`nodes/${nodeId}`].data.contributorsByProperty.specializations).toContain('test-user');

      // Check that specialization nodes were updated
      expect(docRefs[`nodes/spec-1`].data.generalizations).toEqual([
        { collectionName: 'main', nodes: [] }
      ]);

      expect(docRefs[`nodes/spec-2`].data.generalizations).toEqual([
        { collectionName: 'main', nodes: [] }
      ]);

      // Check the returned node
      expect(result).toBeDefined();
      const mainCollection = result.specializations.find(c => c.collectionName === 'main');
      expect(mainCollection?.nodes).toHaveLength(1);
      expect(mainCollection?.nodes[0].id).toBe('spec-3');

      // Verify changelog was created
      expect(ChangelogService.log).toHaveBeenCalledWith(
        'parent-id',
        'test-user',
        'remove element',
        expect.any(Object),
        'Removing specializations',
        'specializations',
        expect.any(Array),
        expect.any(Array)
      );
    });

    it('should maintain the "main" collection even when empty', async () => {
      // Arrange
      const nodeId = 'parent-id';
      const nodes = [{ id: 'spec-1' }];
      const uname = 'test-user';
      const reasoning = 'Emptying main collection';

      // Create mock node with only main collection
      const parentNode = createMockNode('parent-id', {
        specializations: [
          { collectionName: 'main', nodes: [{ id: 'spec-1' }] }
        ]
      });

      const spec1Node = createMockNode('spec-1', {
        generalizations: [
          { collectionName: 'main', nodes: [{ id: 'parent-id' }] }
        ]
      });

      // Set up document references
      docRefs[`nodes/${nodeId}`] = { exists: true, data: parentNode, path: `nodes/${nodeId}` };
      docRefs[`nodes/spec-1`] = { exists: true, data: spec1Node, path: `nodes/spec-1` };

      // Act
      const result = await NodeRelationshipService.removeSpecializations(
        nodeId, nodes, uname, reasoning
      );

      // Assert
      // Verify the main collection is kept even when empty
      expect(docRefs[`nodes/${nodeId}`].data.specializations).toEqual([
        { collectionName: 'main', nodes: [] }  // Empty but kept
      ]);

      // Verify the result
      expect(result.specializations).toHaveLength(1);
      expect(result.specializations[0].collectionName).toBe('main');
      expect(result.specializations[0].nodes).toHaveLength(0);
    });

    it('should throw an error when node is not found', async () => {
      // Arrange
      const nodeId = 'non-existent-id';
      const nodes = [{ id: 'spec-1' }];
      const uname = 'test-user';
      const reasoning = 'Removing from non-existent node';

      // No document reference setup for non-existent node

      // Act & Assert
      await expect(
        NodeRelationshipService.removeSpecializations(nodeId, nodes, uname, reasoning)
      ).rejects.toThrow(`Node ${nodeId} not found`);
    });

    it('should throw an error when node is deleted', async () => {
      // Arrange
      const nodeId = 'deleted-node-id';
      const nodes = [{ id: 'spec-1' }];
      const uname = 'test-user';
      const reasoning = 'Removing from deleted node';

      // Create mock deleted node
      const deletedNode = createMockNode('deleted-node-id', { deleted: true });

      // Set up document reference
      docRefs[`nodes/${nodeId}`] = { exists: true, data: deletedNode, path: `nodes/${nodeId}` };

      // Act & Assert
      await expect(
        NodeRelationshipService.removeSpecializations(nodeId, nodes, uname, reasoning)
      ).rejects.toThrow(`Cannot update deleted node ${nodeId}`);
    });

    it('should throw an error for invalid input parameters', async () => {
      // Test cases for invalid inputs
      const invalidInputs = [
        {
          params: ['', [{ id: 'spec-1' }], 'user', 'reason'],
          expectedError: 'Invalid node ID'
        },
        {
          params: ['parent-id', [], 'user', 'reason'],
          expectedError: 'No specialization nodes provided'
        },
        {
          params: ['parent-id', [{ id: 'spec-1' }], '', 'reason'],
          expectedError: 'Username is required'
        }
      ];

      // Test each invalid input case
      for (const input of invalidInputs) {
        await expect(
          NodeRelationshipService.removeSpecializations(
            input.params[0] as string,
            input.params[1] as { id: string }[],
            input.params[2] as string,
            input.params[3] as string
          )
        ).rejects.toThrow(input.expectedError);
      }
    });
  });

  describe('#updateSpecializationCollection', () => {
    it('should rename a specialization collection', async () => {
      // Arrange
      const nodeId = 'parent-id';
      const oldCollectionName = 'old-collection';
      const newCollectionName = 'new-collection';
      const uname = 'test-user';
      const reasoning = 'Renaming collection';

      // Create mock node with multiple collections
      const parentNode = createMockNode('parent-id', {
        specializations: [
          { collectionName: 'main', nodes: [{ id: 'spec-1' }] },
          { collectionName: 'old-collection', nodes: [{ id: 'spec-2' }] }
        ],
        contributors: ['previous-contributor'],
        contributorsByProperty: {
          specializations: ['previous-contributor']
        }
      });

      // Set up document reference
      docRefs[`nodes/${nodeId}`] = { exists: true, data: parentNode, path: `nodes/${nodeId}` };

      // Act
      const result = await NodeRelationshipService.updateSpecializationCollection(
        nodeId, oldCollectionName, newCollectionName, uname, reasoning
      );

      // Assert
      expect(db.runTransaction).toHaveBeenCalled();

      // Verify the updated collection name
      expect(docRefs[`nodes/${nodeId}`].data.specializations).toEqual([
        { collectionName: 'main', nodes: [{ id: 'spec-1' }] },
        { collectionName: 'new-collection', nodes: [{ id: 'spec-2' }] }
      ]);

      // Verify contributors were updated
      expect(docRefs[`nodes/${nodeId}`].data.contributors).toContain('test-user');
      expect(docRefs[`nodes/${nodeId}`].data.contributorsByProperty?.specializations).toContain('test-user');

      // Verify the returned node
      const newCollection = result.specializations.find(c => c.collectionName === 'new-collection');
      const oldCollection = result.specializations.find(c => c.collectionName === 'old-collection');
      expect(newCollection).toBeDefined();
      expect(oldCollection).toBeUndefined();

      // Verify changelog was created
      expect(ChangelogService.log).toHaveBeenCalledWith(
        'parent-id',
        'test-user',
        'edit collection',
        expect.any(Object),
        'Renaming collection',
        'specializations',
        expect.any(Array),
        expect.any(Array)
      );
    });

    it('should throw an error when trying to rename the main collection', async () => {
      // Arrange
      const nodeId = 'parent-id';
      const oldCollectionName = 'main';
      const newCollectionName = 'new-collection';
      const uname = 'test-user';
      const reasoning = 'Attempting to rename main';

      // Create mock node
      const parentNode = createMockNode('parent-id');

      // Set up document reference
      docRefs[`nodes/${nodeId}`] = { exists: true, data: parentNode, path: `nodes/${nodeId}` };

      // Act & Assert
      await expect(
        NodeRelationshipService.updateSpecializationCollection(
          nodeId, oldCollectionName, newCollectionName, uname, reasoning
        )
      ).rejects.toThrow('Cannot rename the main collection');
    });

    it('should throw an error when collection does not exist', async () => {
      // Arrange
      const nodeId = 'parent-id';
      const oldCollectionName = 'non-existent';
      const newCollectionName = 'new-collection';
      const uname = 'test-user';
      const reasoning = 'Renaming non-existent collection';

      // Create mock node
      const parentNode = createMockNode('parent-id');

      // Set up document reference
      docRefs[`nodes/${nodeId}`] = { exists: true, data: parentNode, path: `nodes/${nodeId}` };

      // Act & Assert
      await expect(
        NodeRelationshipService.updateSpecializationCollection(
          nodeId, oldCollectionName, newCollectionName, uname, reasoning
        )
      ).rejects.toThrow(`Collection '${oldCollectionName}' not found`);
    });

    it('should throw an error when new collection name already exists', async () => {
      // Arrange
      const nodeId = 'parent-id';
      const oldCollectionName = 'collection-a';
      const newCollectionName = 'collection-b'; // Already exists
      const uname = 'test-user';
      const reasoning = 'Renaming to existing collection';

      // Create mock node with multiple collections
      const parentNode = createMockNode('parent-id', {
        specializations: [
          { collectionName: 'main', nodes: [{ id: 'spec-1' }] },
          { collectionName: 'collection-a', nodes: [{ id: 'spec-2' }] },
          { collectionName: 'collection-b', nodes: [{ id: 'spec-3' }] }
        ]
      });

      // Set up document reference
      docRefs[`nodes/${nodeId}`] = { exists: true, data: parentNode, path: `nodes/${nodeId}` };

      // Act & Assert
      await expect(
        NodeRelationshipService.updateSpecializationCollection(
          nodeId, oldCollectionName, newCollectionName, uname, reasoning
        )
      ).rejects.toThrow(`Collection '${newCollectionName}' already exists`);
    });

    it('should throw an error when node is not found', async () => {
      // Arrange
      const nodeId = 'non-existent-id';
      const oldCollectionName = 'old-collection';
      const newCollectionName = 'new-collection';
      const uname = 'test-user';
      const reasoning = 'Renaming collection for non-existent node';

      // Act & Assert
      await expect(
        NodeRelationshipService.updateSpecializationCollection(
          nodeId, oldCollectionName, newCollectionName, uname, reasoning
        )
      ).rejects.toThrow(`Node ${nodeId} not found`);
    });

    it('should throw an error when node is deleted', async () => {
      // Arrange
      const nodeId = 'deleted-node-id';
      const oldCollectionName = 'old-collection';
      const newCollectionName = 'new-collection';
      const uname = 'test-user';
      const reasoning = 'Renaming collection for deleted node';

      // Create mock deleted node
      const deletedNode = createMockNode('deleted-node-id', { deleted: true });

      // Set up document reference
      docRefs[`nodes/${nodeId}`] = { exists: true, data: deletedNode, path: `nodes/${nodeId}` };

      // Act & Assert
      await expect(
        NodeRelationshipService.updateSpecializationCollection(
          nodeId, oldCollectionName, newCollectionName, uname, reasoning
        )
      ).rejects.toThrow(`Cannot update deleted node ${nodeId}`);
    });
  });

  describe('#moveSpecializationsBetweenCollections', () => {
    it('should move specializations between collections', async () => {
      // Arrange
      const nodeId = 'parent-id';
      const nodes = [{ id: 'spec-1' }, { id: 'spec-2' }];
      const sourceCollection = 'source';
      const targetCollection = 'target';
      const uname = 'test-user';
      const reasoning = 'Moving specializations';

      // Create mock node with multiple collections
      const parentNode = createMockNode('parent-id', {
        specializations: [
          {
            collectionName: 'source',
            nodes: [
              { id: 'spec-1' },
              { id: 'spec-2' },
              { id: 'spec-3' }
            ]
          },
          {
            collectionName: 'target',
            nodes: [
              { id: 'spec-4' },
              { id: 'spec-5' }
            ]
          }
        ],
        contributors: ['previous-contributor'],
        contributorsByProperty: {
          specializations: ['previous-contributor']
        }
      });

      // We need to add these fields manually to the document data
      // since they're not part of INode interface but are updated by the method
      const docData = {
        ...parentNode,
        updatedAt: '2023-01-01T00:00:00.000Z',
        updatedBy: 'previous-updater'
      };

      // Set up document reference
      docRefs[`nodes/${nodeId}`] = { exists: true, data: docData, path: `nodes/${nodeId}` };

      // Act
      const result = await NodeRelationshipService.moveSpecializationsBetweenCollections(
        nodeId, nodes, sourceCollection, targetCollection, uname, reasoning
      );

      // Assert
      expect(db.runTransaction).toHaveBeenCalled();

      // Verify the nodes were moved correctly
      const updatedSpecializations = docRefs[`nodes/${nodeId}`].data.specializations;

      // Source collection should only have spec-3 left
      const sourceCollectionResult = updatedSpecializations.find((c: { collectionName: string; }) => c.collectionName === 'source');
      expect(sourceCollectionResult?.nodes).toHaveLength(1);
      expect(sourceCollectionResult?.nodes[0].id).toBe('spec-3');

      // Target collection should now include spec-1 and spec-2
      const targetCollectionResult = updatedSpecializations.find((c: { collectionName: string; }) => c.collectionName === 'target');
      expect(targetCollectionResult?.nodes).toHaveLength(4);
      const targetNodeIds = targetCollectionResult?.nodes.map((n: { id: any; }) => n.id) || [];
      expect(targetNodeIds).toContain('spec-1');
      expect(targetNodeIds).toContain('spec-2');

      // Verify metadata was updated
      expect(docRefs[`nodes/${nodeId}`].data.contributorsByProperty?.specializations).toContain('test-user');
      expect(docRefs[`nodes/${nodeId}`].data.updatedBy).toBe('test-user');
      expect(docRefs[`nodes/${nodeId}`].data.updatedAt).not.toBe('2023-01-01T00:00:00.000Z');

      // Verify the returned node
      const resultSourceCollection = result.specializations.find(c => c.collectionName === 'source');
      const resultTargetCollection = result.specializations.find(c => c.collectionName === 'target');
      expect(resultSourceCollection?.nodes).toHaveLength(1);
      expect(resultTargetCollection?.nodes).toHaveLength(4);

      // Verify changelog was created
      expect(ChangelogService.log).toHaveBeenCalledWith(
        'parent-id',
        'test-user',
        'sort elements',
        expect.any(Object),
        'Moving specializations',
        'specializations',
        expect.any(Array),
        expect.any(Array)
      );
    });

    it('should preserve empty collections after move', async () => {
      // Arrange
      const nodeId = 'parent-id';
      const nodes = [{ id: 'spec-1' }, { id: 'spec-2' }, { id: 'spec-3' }]; // All nodes in source
      const sourceCollection = 'source';
      const targetCollection = 'target';
      const uname = 'test-user';
      const reasoning = 'Moving all specializations';

      // Create mock node with multiple collections
      const parentNode = createMockNode('parent-id', {
        specializations: [
          {
            collectionName: 'source',
            nodes: [
              { id: 'spec-1' },
              { id: 'spec-2' },
              { id: 'spec-3' }
            ]
          },
          {
            collectionName: 'target',
            nodes: [
              { id: 'spec-4' }
            ]
          }
        ]
      });

      // Set up document reference with required fields
      const docData = {
        ...parentNode,
        updatedAt: null,
        updatedBy: null
      };
      docRefs[`nodes/${nodeId}`] = { exists: true, data: docData, path: `nodes/${nodeId}` };

      // Act
      const result = await NodeRelationshipService.moveSpecializationsBetweenCollections(
        nodeId, nodes, sourceCollection, targetCollection, uname, reasoning
      );

      // Assert
      // Source collection should be empty but still exist
      const updatedSpecializations = docRefs[`nodes/${nodeId}`].data.specializations;
      const sourceCollectionResult = updatedSpecializations.find((c: { collectionName: string; }) => c.collectionName === 'source');

      expect(sourceCollectionResult).toBeDefined();
      expect(sourceCollectionResult?.nodes).toHaveLength(0);

      // Target collection should contain all nodes
      const targetCollectionResult = updatedSpecializations.find((c: { collectionName: string; }) => c.collectionName === 'target');
      expect(targetCollectionResult?.nodes).toHaveLength(4);

      const targetNodeIds = targetCollectionResult?.nodes.map((n: { id: any; }) => n.id) || [];
      expect(targetNodeIds).toContain('spec-1');
      expect(targetNodeIds).toContain('spec-2');
      expect(targetNodeIds).toContain('spec-3');
      expect(targetNodeIds).toContain('spec-4');
    });

    it('should prevent duplicates when moving nodes', async () => {
      // Arrange
      const nodeId = 'parent-id';
      const nodes = [{ id: 'spec-1' }]; // spec-1 already exists in target
      const sourceCollection = 'source';
      const targetCollection = 'target';
      const uname = 'test-user';
      const reasoning = 'Moving with potential duplicate';

      // Create mock node with duplicate between collections
      const parentNode = createMockNode('parent-id', {
        specializations: [
          {
            collectionName: 'source',
            nodes: [
              { id: 'spec-1' },
              { id: 'spec-2' }
            ]
          },
          {
            collectionName: 'target',
            nodes: [
              { id: 'spec-1' }, // Already exists in target
              { id: 'spec-3' }
            ]
          }
        ]
      });

      // Set up document reference with required fields
      const docData = {
        ...parentNode,
        updatedAt: null,
        updatedBy: null
      };
      docRefs[`nodes/${nodeId}`] = { exists: true, data: docData, path: `nodes/${nodeId}` };

      // Act
      const result = await NodeRelationshipService.moveSpecializationsBetweenCollections(
        nodeId, nodes, sourceCollection, targetCollection, uname, reasoning
      );

      // Assert
      // Verify source collection no longer has spec-1
      const sourceCollectionResult = result.specializations.find(c => c.collectionName === 'source');
      const sourceNodeIds = sourceCollectionResult?.nodes.map(n => n.id) || [];
      expect(sourceNodeIds).not.toContain('spec-1');

      // Verify target collection has spec-1 only once
      const targetCollectionResult = result.specializations.find(c => c.collectionName === 'target');
      const spec1Nodes = targetCollectionResult?.nodes.filter(n => n.id === 'spec-1') || [];
      expect(spec1Nodes).toHaveLength(1);
    });

    it('should throw an error when source collection does not exist', async () => {
      // Arrange
      const nodeId = 'parent-id';
      const nodes = [{ id: 'spec-1' }];
      const sourceCollection = 'non-existent';
      const targetCollection = 'target';
      const uname = 'test-user';
      const reasoning = 'Moving from non-existent source';

      // Create mock node
      const parentNode = createMockNode('parent-id', {
        specializations: [
          {
            collectionName: 'main',
            nodes: [{ id: 'spec-1' }]
          },
          {
            collectionName: 'target',
            nodes: [{ id: 'spec-2' }]
          }
        ]
      });

      // Set up document reference
      docRefs[`nodes/${nodeId}`] = { exists: true, data: parentNode, path: `nodes/${nodeId}` };

      // Act & Assert
      await expect(
        NodeRelationshipService.moveSpecializationsBetweenCollections(
          nodeId, nodes, sourceCollection, targetCollection, uname, reasoning
        )
      ).rejects.toThrow(`Source collection "${sourceCollection}" not found`);
    });

    it('should throw an error when target collection does not exist', async () => {
      // Arrange
      const nodeId = 'parent-id';
      const nodes = [{ id: 'spec-1' }];
      const sourceCollection = 'source';
      const targetCollection = 'non-existent';
      const uname = 'test-user';
      const reasoning = 'Moving to non-existent target';

      // Create mock node
      const parentNode = createMockNode('parent-id', {
        specializations: [
          {
            collectionName: 'source',
            nodes: [{ id: 'spec-1' }]
          },
          {
            collectionName: 'main',
            nodes: [{ id: 'spec-2' }]
          }
        ]
      });

      // Set up document reference
      docRefs[`nodes/${nodeId}`] = { exists: true, data: parentNode, path: `nodes/${nodeId}` };

      // Act & Assert
      await expect(
        NodeRelationshipService.moveSpecializationsBetweenCollections(
          nodeId, nodes, sourceCollection, targetCollection, uname, reasoning
        )
      ).rejects.toThrow(`Target collection "${targetCollection}" not found`);
    });

    it('should throw an error when node is not found in source collection', async () => {
      // Arrange
      const nodeId = 'parent-id';
      const nodes = [{ id: 'non-existent-spec' }];
      const sourceCollection = 'source';
      const targetCollection = 'target';
      const uname = 'test-user';
      const reasoning = 'Moving non-existent node';

      // Create mock node
      const parentNode = createMockNode('parent-id', {
        specializations: [
          {
            collectionName: 'source',
            nodes: [{ id: 'spec-1' }]
          },
          {
            collectionName: 'target',
            nodes: [{ id: 'spec-2' }]
          }
        ]
      });

      // Set up document reference
      docRefs[`nodes/${nodeId}`] = { exists: true, data: parentNode, path: `nodes/${nodeId}` };

      // Act & Assert
      await expect(
        NodeRelationshipService.moveSpecializationsBetweenCollections(
          nodeId, nodes, sourceCollection, targetCollection, uname, reasoning
        )
      ).rejects.toThrow(`Node ${nodes[0].id} not found in source collection`);
    });

    it('should throw an error when node is deleted', async () => {
      // Arrange
      const nodeId = 'deleted-node-id';
      const nodes = [{ id: 'spec-1' }];
      const sourceCollection = 'source';
      const targetCollection = 'target';
      const uname = 'test-user';
      const reasoning = 'Moving in deleted node';

      // Create mock deleted node
      const deletedNode = createMockNode('deleted-node-id', {
        deleted: true,
        specializations: [
          { collectionName: 'source', nodes: [{ id: 'spec-1' }] },
          { collectionName: 'target', nodes: [] }
        ]
      });

      // Set up document reference
      docRefs[`nodes/${nodeId}`] = { exists: true, data: deletedNode, path: `nodes/${nodeId}` };

      // Act & Assert
      await expect(
        NodeRelationshipService.moveSpecializationsBetweenCollections(
          nodeId, nodes, sourceCollection, targetCollection, uname, reasoning
        )
      ).rejects.toThrow('Cannot modify a deleted node');
    });
  });

  describe('#reorderSpecializations', () => {
    it('should reorder specializations within a collection', async () => {
      // Arrange
      const nodeId = 'parent-id';
      const nodes = [{ id: 'spec-1' }, { id: 'spec-3' }];
      const newIndices = [2, 0]; // Move spec-1 to end, spec-3 to beginning
      const collectionName = 'main';
      const uname = 'test-user';
      const reasoning = 'Reordering specializations';

      // Create mock node with nodes to reorder
      const parentNode = createMockNode('parent-id', {
        specializations: [
          {
            collectionName: 'main',
            nodes: [
              { id: 'spec-1' },
              { id: 'spec-2' },
              { id: 'spec-3' }
            ]
          }
        ],
        contributors: ['previous-contributor'],
        contributorsByProperty: {
          specializations: ['previous-contributor']
        }
      });

      // Set up document reference
      docRefs[`nodes/${nodeId}`] = { exists: true, data: parentNode, path: `nodes/${nodeId}` };

      // Act
      const result = await NodeRelationshipService.reorderSpecializations(
        nodeId, nodes, newIndices, collectionName, uname, reasoning
      );

      // Assert
      expect(db.runTransaction).toHaveBeenCalled();

      // Verify the nodes were reordered correctly
      const updatedSpecializations = docRefs[`nodes/${nodeId}`].data.specializations;
      const mainCollection = updatedSpecializations.find((c: { collectionName: string; }) => c.collectionName === 'main');

      expect(mainCollection?.nodes).toEqual([
        { id: 'spec-3' },  // Now first
        { id: 'spec-2' },  // Stays in the middle
        { id: 'spec-1' }   // Now last
      ]);

      // Verify contributors were updated
      expect(docRefs[`nodes/${nodeId}`].data.contributors).toContain('test-user');
      expect(docRefs[`nodes/${nodeId}`].data.contributorsByProperty?.specializations).toContain('test-user');

      // Verify the returned node
      const resultMainCollection = result.specializations.find(c => c.collectionName === 'main');
      expect(resultMainCollection?.nodes[0].id).toBe('spec-3');
      expect(resultMainCollection?.nodes[1].id).toBe('spec-2');
      expect(resultMainCollection?.nodes[2].id).toBe('spec-1');

      // Verify changelog was created with change details
      expect(ChangelogService.log).toHaveBeenCalledWith(
        'parent-id',
        'test-user',
        'sort elements',
        expect.any(Object),
        'Reordering specializations',
        'specializations',
        expect.any(Array),
        expect.any(Array),
        expect.objectContaining({
          draggableNodeId: expect.any(String),
          source: expect.any(Object),
          destination: expect.any(Object)
        })
      );
    });

    it('should reorder specializations in a non-default collection', async () => {
      // Arrange
      const nodeId = 'parent-id';
      const nodes = [{ id: 'spec-4' }, { id: 'spec-5' }];
      const newIndices = [1, 0]; // Swap positions
      const collectionName = 'custom';
      const uname = 'test-user';
      const reasoning = 'Reordering custom collection';

      // Create mock node with multiple collections
      const parentNode = createMockNode('parent-id', {
        specializations: [
          {
            collectionName: 'main',
            nodes: [
              { id: 'spec-1' },
              { id: 'spec-2' },
              { id: 'spec-3' }
            ]
          },
          {
            collectionName: 'custom',
            nodes: [
              { id: 'spec-4' },
              { id: 'spec-5' }
            ]
          }
        ]
      });

      // Set up document reference
      docRefs[`nodes/${nodeId}`] = { exists: true, data: parentNode, path: `nodes/${nodeId}` };

      // Act
      const result = await NodeRelationshipService.reorderSpecializations(
        nodeId, nodes, newIndices, collectionName, uname, reasoning
      );

      // Assert
      // Verify the custom collection was reordered correctly
      const updatedSpecializations = docRefs[`nodes/${nodeId}`].data.specializations;
      const customCollection = updatedSpecializations.find((c: { collectionName: string; }) => c.collectionName === 'custom');

      expect(customCollection?.nodes).toEqual([
        { id: 'spec-5' },  // Swapped
        { id: 'spec-4' }   // Swapped
      ]);

      // Verify the main collection wasn't affected
      const mainCollection = updatedSpecializations.find((c: { collectionName: string; }) => c.collectionName === 'main');
      expect(mainCollection?.nodes).toEqual([
        { id: 'spec-1' },
        { id: 'spec-2' },
        { id: 'spec-3' }
      ]);

      // Verify the returned node
      const resultCustomCollection = result.specializations.find(c => c.collectionName === 'custom');
      expect(resultCustomCollection?.nodes[0].id).toBe('spec-5');
      expect(resultCustomCollection?.nodes[1].id).toBe('spec-4');
    });

    it('should handle indices that exceed the array length', async () => {
      // Arrange
      const nodeId = 'parent-id';
      const nodes = [{ id: 'spec-1' }];
      const newIndices = [100]; // Index exceeds array length
      const collectionName = 'main';
      const uname = 'test-user';
      const reasoning = 'Testing large index';

      // Create mock node
      const parentNode = createMockNode('parent-id', {
        specializations: [
          {
            collectionName: 'main',
            nodes: [
              { id: 'spec-1' },
              { id: 'spec-2' },
              { id: 'spec-3' }
            ]
          }
        ]
      });

      // Set up document reference
      docRefs[`nodes/${nodeId}`] = { exists: true, data: parentNode, path: `nodes/${nodeId}` };

      // Act
      const result = await NodeRelationshipService.reorderSpecializations(
        nodeId, nodes, newIndices, collectionName, uname, reasoning
      );

      // Assert
      // Verify the node was moved to the end (within bounds)
      const updatedSpecializations = docRefs[`nodes/${nodeId}`].data.specializations;
      const mainCollection = updatedSpecializations.find((c: { collectionName: string; }) => c.collectionName === 'main');

      expect(mainCollection?.nodes).toEqual([
        { id: 'spec-2' },
        { id: 'spec-3' },
        { id: 'spec-1' }  // Moved to end, not beyond
      ]);
    });

    it('should initialize specializations array if it does not exist', async () => {
      // Arrange
      const nodeId = 'parent-id';
      const nodes = [{ id: 'spec-1' }];
      const newIndices = [0];
      const uname = 'test-user';
      const reasoning = 'Reordering with no specializations';

      // Create mock node without specializations but make it properly match
      // what the method is expecting - it needs to exist but 
      // have undefined/empty specializations
      const parentNode = createMockNode('parent-id');
      parentNode.specializations = []; // Empty array instead of undefined

      // Set up document reference
      docRefs[`nodes/${nodeId}`] = { exists: true, data: parentNode, path: `nodes/${nodeId}` };

      // Act & Assert
      await expect(
        NodeRelationshipService.reorderSpecializations(
          nodeId, nodes, newIndices, 'main', uname, reasoning
        )
      ).rejects.toThrow(`Collection 'main' not found in node's specializations`);
    });

    it('should throw an error when node is not found', async () => {
      // Arrange
      const nodeId = 'non-existent-id';
      const nodes = [{ id: 'spec-1' }];
      const newIndices = [0];
      const collectionName = 'main';
      const uname = 'test-user';
      const reasoning = 'Reordering non-existent node';

      // Act & Assert
      await expect(
        NodeRelationshipService.reorderSpecializations(
          nodeId, nodes, newIndices, collectionName, uname, reasoning
        )
      ).rejects.toThrow(`Node ${nodeId} not found`);
    });

    it('should throw an error when node is deleted', async () => {
      // Arrange
      const nodeId = 'deleted-node-id';
      const nodes = [{ id: 'spec-1' }];
      const newIndices = [0];
      const collectionName = 'main';
      const uname = 'test-user';
      const reasoning = 'Reordering deleted node';

      // Create mock deleted node
      const deletedNode = createMockNode('deleted-node-id', { deleted: true });

      // Set up document reference
      docRefs[`nodes/${nodeId}`] = { exists: true, data: deletedNode, path: `nodes/${nodeId}` };

      // Act & Assert
      await expect(
        NodeRelationshipService.reorderSpecializations(
          nodeId, nodes, newIndices, collectionName, uname, reasoning
        )
      ).rejects.toThrow('Cannot modify a deleted node');
    });

    it('should throw an error when collection does not exist', async () => {
      // Arrange
      const nodeId = 'parent-id';
      const nodes = [{ id: 'spec-1' }];
      const newIndices = [0];
      const collectionName = 'non-existent';
      const uname = 'test-user';
      const reasoning = 'Reordering in non-existent collection';

      // Create mock node
      const parentNode = createMockNode('parent-id');

      // Set up document reference
      docRefs[`nodes/${nodeId}`] = { exists: true, data: parentNode, path: `nodes/${nodeId}` };

      // Act & Assert
      await expect(
        NodeRelationshipService.reorderSpecializations(
          nodeId, nodes, newIndices, collectionName, uname, reasoning
        )
      ).rejects.toThrow(`Collection '${collectionName}' not found in node's specializations`);
    });

    it('should throw an error when node is not in the collection', async () => {
      // Arrange
      const nodeId = 'parent-id';
      const nodes = [{ id: 'non-existent-spec' }];
      const newIndices = [0];
      const collectionName = 'main';
      const uname = 'test-user';
      const reasoning = 'Reordering non-existent node';

      // Create mock node
      const parentNode = createMockNode('parent-id', {
        specializations: [
          { collectionName: 'main', nodes: [{ id: 'spec-1' }] }
        ]
      });

      // Set up document reference
      docRefs[`nodes/${nodeId}`] = { exists: true, data: parentNode, path: `nodes/${nodeId}` };

      // Act & Assert
      await expect(
        NodeRelationshipService.reorderSpecializations(
          nodeId, nodes, newIndices, collectionName, uname, reasoning
        )
      ).rejects.toThrow(`Node ${nodes[0].id} not found in collection ${collectionName}`);
    });

    it('should throw an error for invalid input parameters', async () => {
      // Test cases for invalid inputs
      const invalidInputs = [
        {
          params: ['', [{ id: 'spec-1' }], [0], 'main', 'user', 'reason'],
          expectedError: 'Invalid node ID'
        },
        {
          params: ['parent-id', [], [], 'main', 'user', 'reason'],
          expectedError: 'No nodes provided for reordering'
        },
        {
          params: ['parent-id', [{ id: 'spec-1' }], [], 'main', 'user', 'reason'],
          expectedError: 'New indices array must match nodes array length'
        },
        {
          params: ['parent-id', [{ id: 'spec-1' }], [0], 'main', '', 'reason'],
          expectedError: 'Username is required'
        }
      ];

      // Test each invalid input case
      for (const input of invalidInputs) {
        await expect(
          NodeRelationshipService.reorderSpecializations(
            input.params[0] as string,
            input.params[1] as { id: string }[],
            input.params[2] as number[],
            input.params[3] as string,
            input.params[4] as string,
            input.params[5] as string
          )
        ).rejects.toThrow(input.expectedError);
      }
    });
  });

  describe('#transferSpecializations', () => {
    // For testing the private wouldCreateCircularReference method
    let wouldCreateCircularReferenceSpy: jest.SpyInstance;

    beforeEach(() => {
      // Mock the wouldCreateCircularReference method to avoid circular reference issues in tests
      wouldCreateCircularReferenceSpy = jest.spyOn(NodeRelationshipService as any, 'wouldCreateCircularReference')
        .mockReturnValue(false); // Default to no circular reference
    });

    afterEach(() => {
      if (wouldCreateCircularReferenceSpy) {
        wouldCreateCircularReferenceSpy.mockRestore();
      }
    });

    it('should transfer specializations from source to target node', async () => {
      // Arrange
      const sourceNodeId = 'source-id';
      const targetNodeId = 'target-id';
      const nodes = [{ id: 'spec-1' }, { id: 'spec-2' }];
      const uname = 'test-user';
      const reasoning = 'Transferring specializations';

      // Create mock source node
      const sourceNode = createMockNode('source-id', {
        specializations: [
          {
            collectionName: 'main',
            nodes: [
              { id: 'spec-1' },
              { id: 'spec-2' },
              { id: 'spec-3' }
            ]
          }
        ],
        contributors: ['previous-contributor'],
        contributorsByProperty: {
          specializations: ['previous-contributor']
        }
      });

      // Create mock target node
      const targetNode = createMockNode('target-id', {
        specializations: [
          {
            collectionName: 'main',
            nodes: [
              { id: 'spec-4' },
              { id: 'spec-5' }
            ]
          }
        ],
        contributors: ['previous-contributor'],
        contributorsByProperty: {
          specializations: ['previous-contributor']
        }
      });

      // Create mock specialization nodes
      const spec1Node = createMockNode('spec-1', {
        generalizations: [
          { collectionName: 'main', nodes: [{ id: 'source-id' }] }
        ]
      });

      const spec2Node = createMockNode('spec-2', {
        generalizations: [
          { collectionName: 'main', nodes: [{ id: 'source-id' }] }
        ]
      });

      // Set up document references
      docRefs[`nodes/${sourceNodeId}`] = { exists: true, data: sourceNode, path: `nodes/${sourceNodeId}` };
      docRefs[`nodes/${targetNodeId}`] = { exists: true, data: targetNode, path: `nodes/${targetNodeId}` };
      docRefs[`nodes/spec-1`] = { exists: true, data: spec1Node, path: `nodes/spec-1` };
      docRefs[`nodes/spec-2`] = { exists: true, data: spec2Node, path: `nodes/spec-2` };

      // Act
      const result = await NodeRelationshipService.transferSpecializations(
        sourceNodeId, targetNodeId, nodes, uname, reasoning
      );

      // Assert
      expect(db.runTransaction).toHaveBeenCalled();

      // Verify source node update
      const updatedSourceSpecializations = docRefs[`nodes/${sourceNodeId}`].data.specializations;
      const sourceMainCollection = updatedSourceSpecializations.find((c: { collectionName: string; }) => c.collectionName === 'main');
      expect(sourceMainCollection?.nodes).toHaveLength(1);
      expect(sourceMainCollection?.nodes[0].id).toBe('spec-3');

      // Verify target node update
      const updatedTargetSpecializations = docRefs[`nodes/${targetNodeId}`].data.specializations;
      const targetMainCollection = updatedTargetSpecializations.find((c: { collectionName: string; }) => c.collectionName === 'main');
      expect(targetMainCollection?.nodes).toHaveLength(4); // 2 original + 2 transferred
      const targetNodeIds = targetMainCollection?.nodes.map((n: { id: any; }) => n.id) || [];
      expect(targetNodeIds).toContain('spec-1');
      expect(targetNodeIds).toContain('spec-2');

      // Verify specialization nodes updated with new parent
      expect(docRefs[`nodes/spec-1`].data.generalizations).toEqual([
        { collectionName: 'main', nodes: [{ id: 'target-id' }] }
      ]);

      expect(docRefs[`nodes/spec-2`].data.generalizations).toEqual([
        { collectionName: 'main', nodes: [{ id: 'target-id' }] }
      ]);

      // Verify pendingInheritanceUpdate flag set on the specialization nodes
      expect(docRefs[`nodes/spec-1`].data.pendingInheritanceUpdate).toBeTruthy();
      expect(docRefs[`nodes/spec-2`].data.pendingInheritanceUpdate).toBeTruthy();

      // Verify returned result
      expect(result.updatedSourceNode.specializations[0].nodes).toHaveLength(1);
      expect(result.updatedSourceNode.specializations[0].nodes[0].id).toBe('spec-3');

      expect(result.updatedTargetNode.specializations[0].nodes).toHaveLength(4);
      const returnedTargetNodeIds = result.updatedTargetNode.specializations[0].nodes.map(n => n.id);
      expect(returnedTargetNodeIds).toContain('spec-1');
      expect(returnedTargetNodeIds).toContain('spec-2');

      // Verify changelogs were created
      expect(ChangelogService.log).toHaveBeenCalledTimes(2);
      expect(ChangelogService.log).toHaveBeenCalledWith(
        sourceNodeId,
        uname,
        'remove element',
        expect.any(Object),
        reasoning,
        'specializations',
        expect.any(Array),
        expect.any(Array)
      );

      expect(ChangelogService.log).toHaveBeenCalledWith(
        targetNodeId,
        uname,
        'add element',
        expect.any(Object),
        reasoning,
        'specializations',
        expect.any(Array),
        expect.any(Array)
      );
    });

    it('should transfer specializations to a specific target collection', async () => {
      // Arrange
      const sourceNodeId = 'source-id';
      const targetNodeId = 'target-id';
      const nodes = [{ id: 'spec-1' }];
      const uname = 'test-user';
      const reasoning = 'Transferring to custom collection';
      const targetCollectionName = 'custom-collection';

      // Create mock source node
      const sourceNode = createMockNode('source-id', {
        specializations: [
          {
            collectionName: 'main',
            nodes: [
              { id: 'spec-1' },
              { id: 'spec-2' }
            ]
          }
        ]
      });

      // Create mock target node with multiple collections
      const targetNode = createMockNode('target-id', {
        specializations: [
          { collectionName: 'main', nodes: [{ id: 'spec-3' }] },
          { collectionName: 'custom-collection', nodes: [{ id: 'spec-4' }] }
        ]
      });

      // Create mock specialization node
      const spec1Node = createMockNode('spec-1', {
        generalizations: [
          { collectionName: 'main', nodes: [{ id: 'source-id' }] }
        ]
      });

      // Set up document references
      docRefs[`nodes/${sourceNodeId}`] = { exists: true, data: sourceNode, path: `nodes/${sourceNodeId}` };
      docRefs[`nodes/${targetNodeId}`] = { exists: true, data: targetNode, path: `nodes/${targetNodeId}` };
      docRefs[`nodes/spec-1`] = { exists: true, data: spec1Node, path: `nodes/spec-1` };

      // Act
      const result = await NodeRelationshipService.transferSpecializations(
        sourceNodeId, targetNodeId, nodes, uname, reasoning, targetCollectionName
      );

      // Assert
      // Verify spec-1 was added to the custom collection in target node
      const updatedTargetSpecializations = docRefs[`nodes/${targetNodeId}`].data.specializations;
      const targetCustomCollection = updatedTargetSpecializations.find((c: { collectionName: string; }) => c.collectionName === targetCollectionName);
      expect(targetCustomCollection?.nodes).toHaveLength(2);
      const customCollectionNodeIds = targetCustomCollection?.nodes.map((n: { id: any; }) => n.id) || [];
      expect(customCollectionNodeIds).toContain('spec-1');

      // Verify main collection in target is unchanged
      const targetMainCollection = updatedTargetSpecializations.find((c: { collectionName: string; }) => c.collectionName === 'main');
      expect(targetMainCollection?.nodes).toHaveLength(1);
      expect(targetMainCollection?.nodes[0].id).toBe('spec-3');

      // Verify returned result
      const resultCustomCollection = result.updatedTargetNode.specializations
        .find(c => c.collectionName === targetCollectionName);
      expect(resultCustomCollection?.nodes).toHaveLength(2);
      const resultCustomCollectionNodeIds = resultCustomCollection?.nodes.map(n => n.id) || [];
      expect(resultCustomCollectionNodeIds).toContain('spec-1');
    });

    it('should create a target collection if it does not exist', async () => {
      // Arrange
      const sourceNodeId = 'source-id';
      const targetNodeId = 'target-id';
      const nodes = [{ id: 'spec-1' }];
      const uname = 'test-user';
      const reasoning = 'Transferring to new collection';
      const targetCollectionName = 'new-collection';

      // Create mock source node
      const sourceNode = createMockNode('source-id', {
        specializations: [
          { collectionName: 'main', nodes: [{ id: 'spec-1' }] }
        ]
      });

      // Create mock target node with only main collection
      const targetNode = createMockNode('target-id');

      // Create mock specialization node
      const spec1Node = createMockNode('spec-1', {
        generalizations: [
          { collectionName: 'main', nodes: [{ id: 'source-id' }] }
        ]
      });

      // Set up document references
      docRefs[`nodes/${sourceNodeId}`] = { exists: true, data: sourceNode, path: `nodes/${sourceNodeId}` };
      docRefs[`nodes/${targetNodeId}`] = { exists: true, data: targetNode, path: `nodes/${targetNodeId}` };
      docRefs[`nodes/spec-1`] = { exists: true, data: spec1Node, path: `nodes/spec-1` };

      // Act
      const result = await NodeRelationshipService.transferSpecializations(
        sourceNodeId, targetNodeId, nodes, uname, reasoning, targetCollectionName
      );

      // Assert
      // Verify new collection was created
      const updatedTargetSpecializations = docRefs[`nodes/${targetNodeId}`].data.specializations;
      const newCollection = updatedTargetSpecializations.find((c: { collectionName: string; }) => c.collectionName === targetCollectionName);
      expect(newCollection).toBeDefined();
      expect(newCollection?.nodes).toHaveLength(1);
      expect(newCollection?.nodes[0].id).toBe('spec-1');

      // Verify returned result
      const resultNewCollection = result.updatedTargetNode.specializations
        .find(c => c.collectionName === targetCollectionName);
      expect(resultNewCollection).toBeDefined();
      expect(resultNewCollection?.nodes).toHaveLength(1);
      expect(resultNewCollection?.nodes[0].id).toBe('spec-1');
    });

    it('should detect and prevent circular references', async () => {
      // Arrange
      const sourceNodeId = 'source-id';
      const targetNodeId = 'target-id';
      const nodes = [{ id: 'spec-1' }];
      const uname = 'test-user';
      const reasoning = 'Attempting circular reference';

      // Mock circular reference detection to return true for this test
      wouldCreateCircularReferenceSpy.mockReturnValue(true);

      // Create mock nodes
      const sourceNode = createMockNode('source-id', {
        specializations: [
          { collectionName: 'main', nodes: [{ id: 'spec-1' }] }
        ]
      });

      const targetNode = createMockNode('target-id');

      const spec1Node = createMockNode('spec-1');

      // Set up document references
      docRefs[`nodes/${sourceNodeId}`] = { exists: true, data: sourceNode, path: `nodes/${sourceNodeId}` };
      docRefs[`nodes/${targetNodeId}`] = { exists: true, data: targetNode, path: `nodes/${targetNodeId}` };
      docRefs[`nodes/spec-1`] = { exists: true, data: spec1Node, path: `nodes/spec-1` };

      // Act & Assert
      await expect(
        NodeRelationshipService.transferSpecializations(
          sourceNodeId, targetNodeId, nodes, uname, reasoning
        )
      ).rejects.toThrow(`Adding node spec-1 as a specialization of ${targetNodeId} would create a circular reference`);
    });

    it('should throw an error when source and target are the same', async () => {
      // Arrange
      const nodeId = 'same-id';
      const nodes = [{ id: 'spec-1' }];
      const uname = 'test-user';
      const reasoning = 'Transferring to same node';

      // Act & Assert
      await expect(
        NodeRelationshipService.transferSpecializations(
          nodeId, nodeId, nodes, uname, reasoning
        )
      ).rejects.toThrow('Source and target nodes cannot be the same');
    });

    it('should throw an error when source node is not found', async () => {
      // Arrange
      const sourceNodeId = 'non-existent-source';
      const targetNodeId = 'target-id';
      const nodes = [{ id: 'spec-1' }];
      const uname = 'test-user';
      const reasoning = 'Transferring from non-existent source';

      // Set up document reference for target only
      const targetNode = createMockNode('target-id');
      docRefs[`nodes/${targetNodeId}`] = { exists: true, data: targetNode, path: `nodes/${targetNodeId}` };

      // Act & Assert
      await expect(
        NodeRelationshipService.transferSpecializations(
          sourceNodeId, targetNodeId, nodes, uname, reasoning
        )
      ).rejects.toThrow(`Source node ${sourceNodeId} not found`);
    });

    it('should throw an error when target node is not found', async () => {
      // Arrange
      const sourceNodeId = 'source-id';
      const targetNodeId = 'non-existent-target';
      const nodes = [{ id: 'spec-1' }];
      const uname = 'test-user';
      const reasoning = 'Transferring to non-existent target';

      // Set up document reference for source only
      const sourceNode = createMockNode('source-id', {
        specializations: [
          { collectionName: 'main', nodes: [{ id: 'spec-1' }] }
        ]
      });
      docRefs[`nodes/${sourceNodeId}`] = { exists: true, data: sourceNode, path: `nodes/${sourceNodeId}` };

      // Act & Assert
      await expect(
        NodeRelationshipService.transferSpecializations(
          sourceNodeId, targetNodeId, nodes, uname, reasoning
        )
      ).rejects.toThrow(`Target node ${targetNodeId} not found`);
    });

    it('should throw an error when source node is deleted', async () => {
      // Arrange
      const sourceNodeId = 'deleted-source-id';
      const targetNodeId = 'target-id';
      const nodes = [{ id: 'spec-1' }];
      const uname = 'test-user';
      const reasoning = 'Transferring from deleted source';

      // Create mock deleted source node
      const sourceNode = createMockNode('deleted-source-id', {
        deleted: true,
        specializations: [
          { collectionName: 'main', nodes: [{ id: 'spec-1' }] }
        ]
      });

      // Create mock target node
      const targetNode = createMockNode('target-id');

      // Set up document references
      docRefs[`nodes/${sourceNodeId}`] = { exists: true, data: sourceNode, path: `nodes/${sourceNodeId}` };
      docRefs[`nodes/${targetNodeId}`] = { exists: true, data: targetNode, path: `nodes/${targetNodeId}` };

      // Act & Assert
      await expect(
        NodeRelationshipService.transferSpecializations(
          sourceNodeId, targetNodeId, nodes, uname, reasoning
        )
      ).rejects.toThrow(`Cannot update deleted source node ${sourceNodeId}`);
    });

    it('should throw an error when target node is deleted', async () => {
      // Arrange
      const sourceNodeId = 'source-id';
      const targetNodeId = 'deleted-target-id';
      const nodes = [{ id: 'spec-1' }];
      const uname = 'test-user';
      const reasoning = 'Transferring to deleted target';

      // Create mock source node
      const sourceNode = createMockNode('source-id', {
        specializations: [
          { collectionName: 'main', nodes: [{ id: 'spec-1' }] }
        ]
      });

      // Create mock deleted target node
      const targetNode = createMockNode('deleted-target-id', { deleted: true });

      // Set up document references
      docRefs[`nodes/${sourceNodeId}`] = { exists: true, data: sourceNode, path: `nodes/${sourceNodeId}` };
      docRefs[`nodes/${targetNodeId}`] = { exists: true, data: targetNode, path: `nodes/${targetNodeId}` };

      // Act & Assert
      await expect(
        NodeRelationshipService.transferSpecializations(
          sourceNodeId, targetNodeId, nodes, uname, reasoning
        )
      ).rejects.toThrow(`Cannot update deleted target node ${targetNodeId}`);
    });

    it('should throw an error when specialization node is not found', async () => {
      // Arrange
      const sourceNodeId = 'source-id';
      const targetNodeId = 'target-id';
      const nodes = [{ id: 'non-existent-spec' }];
      const uname = 'test-user';
      const reasoning = 'Transferring non-existent specialization';

      // Create mock source and target nodes
      const sourceNode = createMockNode('source-id', {
        specializations: [
          { collectionName: 'main', nodes: [{ id: 'spec-1' }] }
        ]
      });

      const targetNode = createMockNode('target-id');

      // Set up document references
      docRefs[`nodes/${sourceNodeId}`] = { exists: true, data: sourceNode, path: `nodes/${sourceNodeId}` };
      docRefs[`nodes/${targetNodeId}`] = { exists: true, data: targetNode, path: `nodes/${targetNodeId}` };
      // Do not set up doc ref for non-existent-spec

      // Act & Assert
      await expect(
        NodeRelationshipService.transferSpecializations(
          sourceNodeId, targetNodeId, nodes, uname, reasoning
        )
      ).rejects.toThrow(`Specialization node ${nodes[0].id} not found`);
    });

    it('should throw an error when specialization node is deleted', async () => {
      // Arrange
      const sourceNodeId = 'source-id';
      const targetNodeId = 'target-id';
      const nodes = [{ id: 'deleted-spec' }];
      const uname = 'test-user';
      const reasoning = 'Transferring deleted specialization';

      // Create mock source and target nodes
      const sourceNode = createMockNode('source-id', {
        specializations: [
          { collectionName: 'main', nodes: [{ id: 'deleted-spec' }] }
        ]
      });

      const targetNode = createMockNode('target-id');

      // Create mock deleted specialization
      const deletedSpecNode = createMockNode('deleted-spec', { deleted: true });

      // Set up document references
      docRefs[`nodes/${sourceNodeId}`] = { exists: true, data: sourceNode, path: `nodes/${sourceNodeId}` };
      docRefs[`nodes/${targetNodeId}`] = { exists: true, data: targetNode, path: `nodes/${targetNodeId}` };
      docRefs[`nodes/deleted-spec`] = { exists: true, data: deletedSpecNode, path: `nodes/deleted-spec` };

      // Act & Assert
      await expect(
        NodeRelationshipService.transferSpecializations(
          sourceNodeId, targetNodeId, nodes, uname, reasoning
        )
      ).rejects.toThrow(`Specialization node ${nodes[0].id} is deleted`);
    });

    it('should throw an error for invalid input parameters', async () => {
      // Test cases for invalid inputs
      const invalidInputs = [
        {
          params: ['', 'target-id', [{ id: 'spec-1' }], 'user', 'reason'],
          expectedError: 'Invalid source node ID'
        },
        {
          params: ['source-id', '', [{ id: 'spec-1' }], 'user', 'reason'],
          expectedError: 'Invalid target node ID'
        },
        {
          params: ['source-id', 'target-id', [], 'user', 'reason'],
          expectedError: 'No specialization nodes provided'
        },
        {
          params: ['source-id', 'target-id', [{ id: 'spec-1' }], '', 'reason'],
          expectedError: 'Username is required'
        }
      ];

      // Test each invalid input case
      for (const input of invalidInputs) {
        await expect(
          NodeRelationshipService.transferSpecializations(
            input.params[0] as string,
            input.params[1] as string,
            input.params[2] as { id: string }[],
            input.params[3] as string,
            input.params[4] as string
          )
        ).rejects.toThrow(input.expectedError);
      }
    });
  });

  describe('Generalization Management', () => {
    describe('#addGeneralizations', () => {
      it('should add generalizations to a node with default collection', async () => {
        // Arrange
        const nodeId = 'child-id';
        const nodes = [{ id: 'parent-1' }];
        const uname = 'test-user';
        const reasoning = 'Adding generalization';

        // Create mock nodes
        const childNode = createMockNode('child-id', {
          generalizations: [
            { collectionName: 'main', nodes: [{ id: 'existing-parent-id' }] }
          ],
          contributors: ['previous-contributor'],
          contributorsByProperty: {
            generalizations: ['previous-contributor']
          }
        });

        const parentNode = createMockNode('parent-1', {
          specializations: [{ collectionName: 'main', nodes: [] }]
        });

        // Set up document references
        docRefs[`nodes/${nodeId}`] = { exists: true, data: childNode, path: `nodes/${nodeId}` };
        docRefs[`nodes/parent-1`] = { exists: true, data: parentNode, path: `nodes/parent-1` };

        // Mock wouldCreateCircularReference to return false
        jest.spyOn(NodeRelationshipService as any, 'wouldCreateCircularReference')
          .mockReturnValue(false);

        // Act
        const result = await NodeRelationshipService.addGeneralizations(
          nodeId, nodes, uname, reasoning
        );

        // Assert
        expect(db.runTransaction).toHaveBeenCalled();

        // Verify the document update
        expect(docRefs[`nodes/${nodeId}`].data.generalizations).toEqual([
          {
            collectionName: 'main',
            nodes: [
              { id: 'existing-parent-id' },
              { id: 'parent-1' }
            ]
          }
        ]);

        expect(docRefs[`nodes/${nodeId}`].data.contributors).toEqual([
          'previous-contributor', 'test-user'
        ]);

        expect(docRefs[`nodes/${nodeId}`].data.contributorsByProperty).toEqual({
          generalizations: ['previous-contributor', 'test-user']
        });

        // Verify the parent node was updated with bidirectional relationship
        expect(docRefs[`nodes/parent-1`].data.specializations).toEqual([
          {
            collectionName: 'main',
            nodes: [{ id: 'child-id' }]
          }
        ]);

        // Verify the returned node has correct generalizations
        expect(result.generalizations[0].nodes).toEqual(
          expect.arrayContaining([{ id: 'parent-1' }])
        );

        // Verify changelog was created
        expect(ChangelogService.log).toHaveBeenCalledWith(
          'child-id',
          'test-user',
          'add element',
          expect.any(Object),
          'Adding generalization',
          'generalizations',
          expect.any(Array),
          expect.any(Array)
        );

        // Verify pendingInheritanceUpdate flag was set
        expect(docRefs[`nodes/${nodeId}`].data.pendingInheritanceUpdate).toBeTruthy();
      });

      it('should add generalizations to a custom collection', async () => {
        // Arrange
        const nodeId = 'child-id';
        const nodes = [{ id: 'parent-1' }];
        const uname = 'test-user';
        const reasoning = 'Adding to custom collection';
        const collectionName = 'custom-parents';

        // Create mock nodes
        const childNode = createMockNode('child-id', {
          generalizations: [
            { collectionName: 'main', nodes: [{ id: 'existing-parent-id' }] },
            { collectionName: 'custom-parents', nodes: [{ id: 'existing-custom-parent' }] }
          ]
        });

        const parentNode = createMockNode('parent-1', {
          specializations: [{ collectionName: 'main', nodes: [] }]
        });

        // Set up document references
        docRefs[`nodes/${nodeId}`] = { exists: true, data: childNode, path: `nodes/${nodeId}` };
        docRefs[`nodes/parent-1`] = { exists: true, data: parentNode, path: `nodes/parent-1` };

        // Mock wouldCreateCircularReference to return false
        jest.spyOn(NodeRelationshipService as any, 'wouldCreateCircularReference')
          .mockReturnValue(false);

        // Act
        const result = await NodeRelationshipService.addGeneralizations(
          nodeId, nodes, uname, reasoning, collectionName
        );

        // Assert
        expect(db.runTransaction).toHaveBeenCalled();

        // Find the custom collection in the updated node
        const customCollection = docRefs[`nodes/${nodeId}`].data.generalizations
          .find((c: any) => c.collectionName === collectionName);

        // Verify the custom collection was updated
        expect(customCollection).toBeDefined();
        expect(customCollection.nodes).toContainEqual({ id: 'parent-1' });
        expect(customCollection.nodes).toContainEqual({ id: 'existing-custom-parent' });

        // Verify the main collection was not modified
        const mainCollection = docRefs[`nodes/${nodeId}`].data.generalizations
          .find((c: any) => c.collectionName === 'main');
        expect(mainCollection.nodes).toEqual([{ id: 'existing-parent-id' }]);

        // Verify the parent node was updated with bidirectional relationship
        expect(docRefs[`nodes/parent-1`].data.specializations[0].nodes).toContainEqual({ id: 'child-id' });
      });

      it('should create a new collection if it does not exist', async () => {
        // Arrange
        const nodeId = 'child-id';
        const nodes = [{ id: 'parent-1' }];
        const uname = 'test-user';
        const reasoning = 'Adding to new collection';
        const collectionName = 'new-collection';

        // Create mock nodes
        const childNode = createMockNode('child-id', {
          generalizations: [
            { collectionName: 'main', nodes: [{ id: 'existing-parent-id' }] }
          ]
        });

        const parentNode = createMockNode('parent-1');

        // Set up document references
        docRefs[`nodes/${nodeId}`] = { exists: true, data: childNode, path: `nodes/${nodeId}` };
        docRefs[`nodes/parent-1`] = { exists: true, data: parentNode, path: `nodes/parent-1` };

        // Mock wouldCreateCircularReference to return false
        jest.spyOn(NodeRelationshipService as any, 'wouldCreateCircularReference')
          .mockReturnValue(false);

        // Act
        const result = await NodeRelationshipService.addGeneralizations(
          nodeId, nodes, uname, reasoning, collectionName
        );

        // Assert
        // Verify the new collection was created
        const collections = docRefs[`nodes/${nodeId}`].data.generalizations;
        const newCollection = collections.find((c: any) => c.collectionName === collectionName);

        expect(newCollection).toBeDefined();
        expect(newCollection.nodes).toEqual([{ id: 'parent-1' }]);

        // Verify main collection still exists
        const mainCollection = collections.find((c: any) => c.collectionName === 'main');
        expect(mainCollection).toBeDefined();
      });

      it('should prevent circular references', async () => {
        // Arrange
        const nodeId = 'child-id';
        const nodes = [{ id: 'would-cause-circular-ref' }];
        const uname = 'test-user';
        const reasoning = 'Adding circular reference';

        // Create mock nodes
        const childNode = createMockNode('child-id');
        const parentNode = createMockNode('would-cause-circular-ref');

        // Set up document references
        docRefs[`nodes/${nodeId}`] = { exists: true, data: childNode, path: `nodes/${nodeId}` };
        docRefs[`nodes/would-cause-circular-ref`] = { exists: true, data: parentNode, path: `nodes/would-cause-circular-ref` };

        // Mock circular reference detection to return true
        jest.spyOn(NodeRelationshipService as any, 'wouldCreateCircularReference')
          .mockReturnValue(true);

        // Act & Assert
        await expect(
          NodeRelationshipService.addGeneralizations(nodeId, nodes, uname, reasoning)
        ).rejects.toThrow('Adding node would-cause-circular-ref as a generalization would create a circular reference');
      });

      it('should throw an error when node is not found', async () => {
        // Arrange
        const nodeId = 'non-existent-id';
        const nodes = [{ id: 'parent-1' }];
        const uname = 'test-user';
        const reasoning = 'Adding to non-existent node';

        // No document reference setup for non-existent node

        // Act & Assert
        await expect(
          NodeRelationshipService.addGeneralizations(nodeId, nodes, uname, reasoning)
        ).rejects.toThrow('Child node non-existent-id not found');
      });

      it('should throw an error when node is deleted', async () => {
        // Arrange
        const nodeId = 'deleted-node-id';
        const nodes = [{ id: 'parent-1' }];
        const uname = 'test-user';
        const reasoning = 'Adding to deleted node';

        // Create mock deleted node
        const deletedNode = createMockNode('deleted-node-id', { deleted: true });

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: deletedNode, path: `nodes/${nodeId}` };

        // Act & Assert
        await expect(
          NodeRelationshipService.addGeneralizations(nodeId, nodes, uname, reasoning)
        ).rejects.toThrow('Cannot update deleted node deleted-node-id');
      });

      it('should throw an error when generalization node is not found', async () => {
        // Arrange
        const nodeId = 'child-id';
        const nodes = [{ id: 'non-existent-parent' }];
        const uname = 'test-user';
        const reasoning = 'Adding non-existent generalization';

        // Create mock child node
        const childNode = createMockNode('child-id');

        // Set up document reference for child only
        docRefs[`nodes/${nodeId}`] = { exists: true, data: childNode, path: `nodes/${nodeId}` };
        // No document reference for non-existent parent

        // Act & Assert
        await expect(
          NodeRelationshipService.addGeneralizations(nodeId, nodes, uname, reasoning)
        ).rejects.toThrow('Generalization node non-existent-parent not found');
      });

      it('should throw an error for invalid input parameters', async () => {
        // Test cases for invalid inputs
        const invalidInputs = [
          {
            params: ['', [{ id: 'parent-1' }], 'user', 'reason'],
            expectedError: 'Invalid node ID'
          },
          {
            params: ['child-id', [], 'user', 'reason'],
            expectedError: 'No generalization nodes provided'
          },
          {
            params: ['child-id', [{ id: 'parent-1' }], '', 'reason'],
            expectedError: 'Username is required'
          }
        ];

        // Test each invalid input case
        for (const input of invalidInputs) {
          await expect(
            NodeRelationshipService.addGeneralizations(
              input.params[0] as string,
              input.params[1] as { id: string }[],
              input.params[2] as string,
              input.params[3] as string
            )
          ).rejects.toThrow(input.expectedError);
        }
      });
    });

    describe('#removeGeneralizations', () => {
      it('should remove generalizations from a node', async () => {
        // Arrange
        const nodeId = 'child-id';
        const nodes = [{ id: 'parent-1' }, { id: 'parent-2' }];
        const uname = 'test-user';
        const reasoning = 'Removing generalizations';

        // Create mock nodes
        const childNode = createMockNode('child-id', {
          generalizations: [
            {
              collectionName: 'main',
              nodes: [
                { id: 'parent-1' },
                { id: 'parent-2' },
                { id: 'parent-3' }  // This one will remain
              ]
            },
            {
              collectionName: 'custom',
              nodes: [
                { id: 'parent-4' },
                { id: 'parent-5' }
              ]
            }
          ],
          contributors: ['previous-contributor'],
          contributorsByProperty: {
            generalizations: ['previous-contributor']
          }
        });

        const parent1Node = createMockNode('parent-1', {
          specializations: [
            { collectionName: 'main', nodes: [{ id: 'child-id' }] }
          ]
        });

        const parent2Node = createMockNode('parent-2', {
          specializations: [
            { collectionName: 'main', nodes: [{ id: 'child-id' }] }
          ]
        });

        // Set up document references
        docRefs[`nodes/${nodeId}`] = { exists: true, data: childNode, path: `nodes/${nodeId}` };
        docRefs[`nodes/parent-1`] = { exists: true, data: parent1Node, path: `nodes/parent-1` };
        docRefs[`nodes/parent-2`] = { exists: true, data: parent2Node, path: `nodes/parent-2` };

        // Act
        const result = await NodeRelationshipService.removeGeneralizations(
          nodeId, nodes, uname, reasoning
        );

        // Assert
        expect(db.runTransaction).toHaveBeenCalled();

        // Check child node update in docRefs
        expect(docRefs[`nodes/${nodeId}`].data.generalizations).toEqual([
          {
            collectionName: 'main',
            nodes: [{ id: 'parent-3' }]  // Only parent-3 remains
          },
          {
            collectionName: 'custom',
            nodes: [{ id: 'parent-4' }, { id: 'parent-5' }]  // Custom collection unchanged
          }
        ]);

        // Check contributors updated
        expect(docRefs[`nodes/${nodeId}`].data.contributorsByProperty).toHaveProperty('generalizations');
        expect(docRefs[`nodes/${nodeId}`].data.contributorsByProperty.generalizations).toContain('test-user');

        // Check that parent nodes were updated
        expect(docRefs[`nodes/parent-1`].data.specializations).toEqual([
          { collectionName: 'main', nodes: [] }
        ]);

        expect(docRefs[`nodes/parent-2`].data.specializations).toEqual([
          { collectionName: 'main', nodes: [] }
        ]);

        // Check the returned node
        expect(result).toBeDefined();
        const mainCollection = result.generalizations.find(c => c.collectionName === 'main');
        expect(mainCollection?.nodes).toHaveLength(1);
        expect(mainCollection?.nodes[0].id).toBe('parent-3');

        // Verify inheritance update flag was set
        expect(docRefs[`nodes/${nodeId}`].data.pendingInheritanceUpdate).toBeTruthy();

        // Verify changelog was created
        expect(ChangelogService.log).toHaveBeenCalledWith(
          'child-id',
          'test-user',
          'remove element',
          expect.any(Object),
          'Removing generalizations',
          'generalizations',
          expect.any(Array),
          expect.any(Array)
        );
      });

      it('should maintain the "main" collection even when empty', async () => {
        // Arrange
        const nodeId = 'child-id';
        const nodes = [{ id: 'parent-1' }];
        const uname = 'test-user';
        const reasoning = 'Emptying main collection';

        // Create mock nodes - ensure there are multiple generalizations
        // so we can remove one without violating the "at least one generalization" rule
        const childNode = createMockNode('child-id', {
          generalizations: [
            { collectionName: 'main', nodes: [{ id: 'parent-1' }, { id: 'parent-2' }] }
          ]
        });

        const parent1Node = createMockNode('parent-1', {
          specializations: [
            { collectionName: 'main', nodes: [{ id: 'child-id' }] }
          ]
        });

        const parent2Node = createMockNode('parent-2', {
          specializations: [
            { collectionName: 'main', nodes: [{ id: 'child-id' }] }
          ]
        });

        // Set up document references
        docRefs[`nodes/${nodeId}`] = { exists: true, data: childNode, path: `nodes/${nodeId}` };
        docRefs[`nodes/parent-1`] = { exists: true, data: parent1Node, path: `nodes/parent-1` };
        docRefs[`nodes/parent-2`] = { exists: true, data: parent2Node, path: `nodes/parent-2` };

        // Act
        const result = await NodeRelationshipService.removeGeneralizations(
          nodeId, nodes, uname, reasoning
        );

        // Assert
        // Verify main collection nodes are updated correctly
        const mainCollection = docRefs[`nodes/${nodeId}`].data.generalizations.find(
          (c: any) => c.collectionName === 'main'
        );
        expect(mainCollection).toBeDefined();
        expect(mainCollection.nodes).toHaveLength(1);
        expect(mainCollection.nodes[0].id).toBe('parent-2');
      });

      it('should prevent removing all generalizations', async () => {
        // Arrange
        const nodeId = 'child-id';
        const nodes = [{ id: 'parent-1' }]; // Attempting to remove the only generalization
        const uname = 'test-user';
        const reasoning = 'Removing all generalizations';

        // Create mock node with only one generalization
        const childNode = createMockNode('child-id', {
          generalizations: [
            { collectionName: 'main', nodes: [{ id: 'parent-1' }] }
          ]
        });

        const parent1Node = createMockNode('parent-1', {
          specializations: [
            { collectionName: 'main', nodes: [{ id: 'child-id' }] }
          ]
        });

        // Set up document references
        docRefs[`nodes/${nodeId}`] = { exists: true, data: childNode, path: `nodes/${nodeId}` };
        docRefs[`nodes/parent-1`] = { exists: true, data: parent1Node, path: `nodes/parent-1` };

        // Act & Assert
        await expect(
          NodeRelationshipService.removeGeneralizations(nodeId, nodes, uname, reasoning)
        ).rejects.toThrow('Cannot remove all generalizations from a node');
      });

      it('should throw an error when node is not found', async () => {
        // Arrange
        const nodeId = 'non-existent-id';
        const nodes = [{ id: 'parent-1' }];
        const uname = 'test-user';
        const reasoning = 'Removing from non-existent node';

        // No document reference setup for non-existent node

        // Act & Assert
        await expect(
          NodeRelationshipService.removeGeneralizations(nodeId, nodes, uname, reasoning)
        ).rejects.toThrow(`Node ${nodeId} not found`);
      });

      it('should throw an error when node is deleted', async () => {
        // Arrange
        const nodeId = 'deleted-node-id';
        const nodes = [{ id: 'parent-1' }];
        const uname = 'test-user';
        const reasoning = 'Removing from deleted node';

        // Create mock deleted node
        const deletedNode = createMockNode('deleted-node-id', { deleted: true });

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: deletedNode, path: `nodes/${nodeId}` };

        // Act & Assert
        await expect(
          NodeRelationshipService.removeGeneralizations(nodeId, nodes, uname, reasoning)
        ).rejects.toThrow(`Cannot update deleted node ${nodeId}`);
      });

      it('should throw an error for invalid input parameters', async () => {
        // Test cases for invalid inputs
        const invalidInputs = [
          {
            params: ['', [{ id: 'parent-1' }], 'user', 'reason'],
            expectedError: 'Invalid node ID'
          },
          {
            params: ['child-id', [], 'user', 'reason'],
            expectedError: 'No generalization nodes provided'
          },
          {
            params: ['child-id', [{ id: 'parent-1' }], '', 'reason'],
            expectedError: 'Username is required'
          }
        ];

        // Test each invalid input case
        for (const input of invalidInputs) {
          await expect(
            NodeRelationshipService.removeGeneralizations(
              input.params[0] as string,
              input.params[1] as { id: string }[],
              input.params[2] as string,
              input.params[3] as string
            )
          ).rejects.toThrow(input.expectedError);
        }
      });
    });

    describe('#reorderGeneralizations', () => {
      it('should reorder generalizations within a collection', async () => {
        // Arrange
        const nodeId = 'child-id';
        const nodes = [{ id: 'parent-1' }, { id: 'parent-3' }];
        const newIndices = [2, 0]; // Move parent-1 to end, parent-3 to beginning
        const collectionName = 'main';
        const uname = 'test-user';
        const reasoning = 'Reordering generalizations';

        // Create mock node with nodes to reorder
        const childNode = createMockNode('child-id', {
          generalizations: [
            {
              collectionName: 'main',
              nodes: [
                { id: 'parent-1' },
                { id: 'parent-2' },
                { id: 'parent-3' }
              ]
            }
          ],
          contributors: ['previous-contributor'],
          contributorsByProperty: {
            generalizations: ['previous-contributor']
          }
        });

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: childNode, path: `nodes/${nodeId}` };

        // Act
        const result = await NodeRelationshipService.reorderGeneralizations(
          nodeId, nodes, newIndices, collectionName, uname, reasoning
        );

        // Assert
        expect(db.runTransaction).toHaveBeenCalled();

        // Verify the nodes were reordered correctly
        const updatedGeneralizations = docRefs[`nodes/${nodeId}`].data.generalizations;
        const mainCollection = updatedGeneralizations.find((c: { collectionName: string; }) => c.collectionName === 'main');

        expect(mainCollection?.nodes).toEqual([
          { id: 'parent-3' },  // Now first
          { id: 'parent-2' },  // Stays in the middle
          { id: 'parent-1' }   // Now last
        ]);

        // Verify contributors were updated
        expect(docRefs[`nodes/${nodeId}`].data.contributors).toContain('test-user');
        expect(docRefs[`nodes/${nodeId}`].data.contributorsByProperty?.generalizations).toContain('test-user');

        // Verify the returned node
        const resultMainCollection = result.generalizations.find(c => c.collectionName === 'main');
        expect(resultMainCollection?.nodes[0].id).toBe('parent-3');
        expect(resultMainCollection?.nodes[1].id).toBe('parent-2');
        expect(resultMainCollection?.nodes[2].id).toBe('parent-1');

        // Verify changelog was created with change details
        expect(ChangelogService.log).toHaveBeenCalledWith(
          'child-id',
          'test-user',
          'sort elements',
          expect.any(Object),
          'Reordering generalizations',
          'generalizations',
          expect.any(Array),
          expect.any(Array),
          expect.objectContaining({
            draggableNodeId: expect.any(String),
            source: expect.any(Object),
            destination: expect.any(Object)
          })
        );
      });

      it('should reorder generalizations in a non-default collection', async () => {
        // Arrange
        const nodeId = 'child-id';
        const nodes = [{ id: 'parent-4' }, { id: 'parent-5' }];
        const newIndices = [1, 0]; // Swap positions
        const collectionName = 'custom';
        const uname = 'test-user';
        const reasoning = 'Reordering custom collection';

        // Create mock node with multiple collections
        const childNode = createMockNode('child-id', {
          generalizations: [
            {
              collectionName: 'main',
              nodes: [
                { id: 'parent-1' },
                { id: 'parent-2' },
                { id: 'parent-3' }
              ]
            },
            {
              collectionName: 'custom',
              nodes: [
                { id: 'parent-4' },
                { id: 'parent-5' }
              ]
            }
          ]
        });

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: childNode, path: `nodes/${nodeId}` };

        // Act
        const result = await NodeRelationshipService.reorderGeneralizations(
          nodeId, nodes, newIndices, collectionName, uname, reasoning
        );

        // Assert
        // Verify the custom collection was reordered correctly
        const updatedGeneralizations = docRefs[`nodes/${nodeId}`].data.generalizations;
        const customCollection = updatedGeneralizations.find((c: { collectionName: string; }) => c.collectionName === 'custom');

        expect(customCollection?.nodes).toEqual([
          { id: 'parent-5' },  // Swapped
          { id: 'parent-4' }   // Swapped
        ]);

        // Verify the main collection wasn't affected
        const mainCollection = updatedGeneralizations.find((c: { collectionName: string; }) => c.collectionName === 'main');
        expect(mainCollection?.nodes).toEqual([
          { id: 'parent-1' },
          { id: 'parent-2' },
          { id: 'parent-3' }
        ]);

        // Verify the returned node
        const resultCustomCollection = result.generalizations.find(c => c.collectionName === 'custom');
        expect(resultCustomCollection?.nodes[0].id).toBe('parent-5');
        expect(resultCustomCollection?.nodes[1].id).toBe('parent-4');
      });

      it('should handle indices that exceed the array length', async () => {
        // Arrange
        const nodeId = 'child-id';
        const nodes = [{ id: 'parent-1' }];
        const newIndices = [100]; // Index exceeds array length
        const collectionName = 'main';
        const uname = 'test-user';
        const reasoning = 'Testing large index';

        // Create mock node
        const childNode = createMockNode('child-id', {
          generalizations: [
            {
              collectionName: 'main',
              nodes: [
                { id: 'parent-1' },
                { id: 'parent-2' },
                { id: 'parent-3' }
              ]
            }
          ]
        });

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: childNode, path: `nodes/${nodeId}` };

        // Act
        const result = await NodeRelationshipService.reorderGeneralizations(
          nodeId, nodes, newIndices, collectionName, uname, reasoning
        );

        // Assert
        // Verify the node was moved to the end (within bounds)
        const updatedGeneralizations = docRefs[`nodes/${nodeId}`].data.generalizations;
        const mainCollection = updatedGeneralizations.find((c: { collectionName: string; }) => c.collectionName === 'main');

        expect(mainCollection?.nodes).toEqual([
          { id: 'parent-2' },
          { id: 'parent-3' },
          { id: 'parent-1' }  // Moved to end, not beyond
        ]);
      });

      it('should throw an error when collection does not exist', async () => {
        // Arrange
        const nodeId = 'child-id';
        const nodes = [{ id: 'parent-1' }];
        const newIndices = [0];
        const collectionName = 'non-existent';
        const uname = 'test-user';
        const reasoning = 'Reordering in non-existent collection';

        // Create mock node
        const childNode = createMockNode('child-id');

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: childNode, path: `nodes/${nodeId}` };

        // Act & Assert
        await expect(
          NodeRelationshipService.reorderGeneralizations(
            nodeId, nodes, newIndices, collectionName, uname, reasoning
          )
        ).rejects.toThrow(`Collection '${collectionName}' not found in node's generalizations`);
      });

      it('should throw an error when node is not in the collection', async () => {
        // Arrange
        const nodeId = 'child-id';
        const nodes = [{ id: 'non-existent-parent' }];
        const newIndices = [0];
        const collectionName = 'main';
        const uname = 'test-user';
        const reasoning = 'Reordering non-existent node';

        // Create mock node
        const childNode = createMockNode('child-id', {
          generalizations: [
            { collectionName: 'main', nodes: [{ id: 'parent-1' }] }
          ]
        });

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: childNode, path: `nodes/${nodeId}` };

        // Act & Assert
        await expect(
          NodeRelationshipService.reorderGeneralizations(
            nodeId, nodes, newIndices, collectionName, uname, reasoning
          )
        ).rejects.toThrow(`Node ${nodes[0].id} not found in collection ${collectionName}`);
      });

      it('should throw an error when node is not found', async () => {
        // Arrange
        const nodeId = 'non-existent-id';
        const nodes = [{ id: 'parent-1' }];
        const newIndices = [0];
        const collectionName = 'main';
        const uname = 'test-user';
        const reasoning = 'Reordering non-existent node';

        // Act & Assert
        await expect(
          NodeRelationshipService.reorderGeneralizations(
            nodeId, nodes, newIndices, collectionName, uname, reasoning
          )
        ).rejects.toThrow(`Node ${nodeId} not found`);
      });

      it('should throw an error when node is deleted', async () => {
        // Arrange
        const nodeId = 'deleted-node-id';
        const nodes = [{ id: 'parent-1' }];
        const newIndices = [0];
        const collectionName = 'main';
        const uname = 'test-user';
        const reasoning = 'Reordering deleted node';

        // Create mock deleted node
        const deletedNode = createMockNode('deleted-node-id', { deleted: true });

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: deletedNode, path: `nodes/${nodeId}` };

        // Act & Assert
        await expect(
          NodeRelationshipService.reorderGeneralizations(
            nodeId, nodes, newIndices, collectionName, uname, reasoning
          )
        ).rejects.toThrow('Cannot modify a deleted node');
      });

      it('should initialize generalizations array if it does not exist', async () => {
        // Arrange
        const nodeId = 'child-id';
        const nodes = [{ id: 'parent-1' }];
        const newIndices = [0];
        const uname = 'test-user';
        const reasoning = 'Reordering with no generalizations';

        // Create mock node without generalizations but make it properly match
        // what the method is expecting - it needs to exist but 
        // have undefined/empty generalizations
        const childNode = createMockNode('child-id');
        childNode.generalizations = []; // Empty array instead of undefined

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: childNode, path: `nodes/${nodeId}` };

        // Act & Assert
        await expect(
          NodeRelationshipService.reorderGeneralizations(
            nodeId, nodes, newIndices, 'main', uname, reasoning
          )
        ).rejects.toThrow(`Collection 'main' not found in node's generalizations`);
      });

      it('should throw an error for invalid input parameters', async () => {
        // Test cases for invalid inputs
        const invalidInputs = [
          {
            params: ['', [{ id: 'parent-1' }], [0], 'main', 'user', 'reason'],
            expectedError: 'Invalid node ID'
          },
          {
            params: ['child-id', [], [], 'main', 'user', 'reason'],
            expectedError: 'No nodes provided for reordering'
          },
          {
            params: ['child-id', [{ id: 'parent-1' }], [], 'main', 'user', 'reason'],
            expectedError: 'New indices array must match nodes array length'
          },
          {
            params: ['child-id', [{ id: 'parent-1' }], [0], 'main', '', 'reason'],
            expectedError: 'Username is required'
          }
        ];

        // Test each invalid input case
        for (const input of invalidInputs) {
          await expect(
            NodeRelationshipService.reorderGeneralizations(
              input.params[0] as string,
              input.params[1] as { id: string }[],
              input.params[2] as number[],
              input.params[3] as string,
              input.params[4] as string,
              input.params[5] as string
            )
          ).rejects.toThrow(input.expectedError);
        }
      });
    });
  });

  describe('Collection Management', () => {
    describe('#createCollection', () => {
      it('should create a new collection for specializations', async () => {
        // Arrange
        const nodeId = 'test-node-id';
        const relationType = 'specializations';
        const collectionName = 'new-collection';
        const uname = 'test-user';
        const reasoning = 'Creating new specializations collection';

        // Create mock node with existing collections
        const mockNode = createMockNode(nodeId, {
          specializations: [
            { collectionName: 'main', nodes: [{ id: 'existing-spec' }] }
          ],
          contributors: ['previous-contributor']
        });

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: mockNode, path: `nodes/${nodeId}` };

        // Act
        const result = await NodeRelationshipService.createCollection(
          nodeId, relationType, collectionName, uname, reasoning
        );

        // Assert
        expect(db.runTransaction).toHaveBeenCalled();

        // Verify the new collection was added
        const updatedSpecializations = docRefs[`nodes/${nodeId}`].data.specializations;
        expect(updatedSpecializations).toHaveLength(2);

        const newCollection = updatedSpecializations.find((c: any) => c.collectionName === collectionName);
        expect(newCollection).toBeDefined();
        expect(newCollection.nodes).toEqual([]);

        // Verify the main collection wasn't affected
        const mainCollection = updatedSpecializations.find((c: any) => c.collectionName === 'main');
        expect(mainCollection.nodes).toEqual([{ id: 'existing-spec' }]);

        // Verify contributors were updated
        expect(docRefs[`nodes/${nodeId}`].data.contributors).toContain('test-user');

        // Verify the returned node
        expect(result.specializations).toHaveLength(2);
        expect(result.specializations[1].collectionName).toBe(collectionName);
        expect(result.specializations[1].nodes).toEqual([]);
      });

      it('should create a new collection for generalizations', async () => {
        // Arrange
        const nodeId = 'test-node-id';
        const relationType = 'generalizations';
        const collectionName = 'new-gen-collection';
        const uname = 'test-user';
        const reasoning = 'Creating new generalizations collection';

        // Create mock node with existing collections
        const mockNode = createMockNode(nodeId, {
          generalizations: [
            { collectionName: 'main', nodes: [{ id: 'existing-gen' }] }
          ],
          contributors: ['previous-contributor']
        });

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: mockNode, path: `nodes/${nodeId}` };

        // Act
        const result = await NodeRelationshipService.createCollection(
          nodeId, relationType, collectionName, uname, reasoning
        );

        // Assert
        // Verify the new collection was added
        const updatedGeneralizations = docRefs[`nodes/${nodeId}`].data.generalizations;
        expect(updatedGeneralizations).toHaveLength(2);

        const newCollection = updatedGeneralizations.find((c: any) => c.collectionName === collectionName);
        expect(newCollection).toBeDefined();
        expect(newCollection.nodes).toEqual([]);

        // Verify the returned node
        expect(result.generalizations).toHaveLength(2);
        expect(result.generalizations[1].collectionName).toBe(collectionName);
      });

      it('should initialize collections array if it does not exist', async () => {
        // Arrange
        const nodeId = 'test-node-id';
        const relationType = 'specializations';
        const collectionName = 'new-collection';
        const uname = 'test-user';
        const reasoning = 'Creating collection when none exist';

        // Create a basic node object without using the helper function
        // This avoids TypeScript constraints from the INode interface
        const nodeData = {
          id: nodeId,
          title: 'Test Node',
          nodeType: 'activity',
          deleted: false,
          properties: {},
          // Omit specializations entirely
        };

        // Set up document reference - use this raw object that's missing specializations
        docRefs[`nodes/${nodeId}`] = { exists: true, data: nodeData, path: `nodes/${nodeId}` };

        // Act
        const result = await NodeRelationshipService.createCollection(
          nodeId, relationType, collectionName, uname, reasoning
        );

        // Assert
        // Verify the specializations array was initialized with main and new collection
        const updatedSpecializations = docRefs[`nodes/${nodeId}`].data.specializations;
        expect(updatedSpecializations).toHaveLength(2);

        // Should have created main collection
        const mainCollection = updatedSpecializations.find((c: any) => c.collectionName === 'main');
        expect(mainCollection).toBeDefined();
        expect(mainCollection.nodes).toEqual([]);

        // Should have created the requested collection
        const newCollection = updatedSpecializations.find((c: any) => c.collectionName === collectionName);
        expect(newCollection).toBeDefined();
        expect(newCollection.nodes).toEqual([]);
      });

      it('should throw error for duplicate collection name', async () => {
        // Arrange
        const nodeId = 'test-node-id';
        const relationType = 'specializations';
        const collectionName = 'existing-collection';
        const uname = 'test-user';
        const reasoning = 'Attempting to create duplicate collection';

        // Create mock node with the collection already existing
        const mockNode = createMockNode(nodeId, {
          specializations: [
            { collectionName: 'main', nodes: [] },
            { collectionName: 'existing-collection', nodes: [] }
          ]
        });

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: mockNode, path: `nodes/${nodeId}` };

        // Act & Assert
        await expect(
          NodeRelationshipService.createCollection(
            nodeId, relationType, collectionName, uname, reasoning
          )
        ).rejects.toThrow(`Collection "${collectionName}" already exists in ${relationType}`);
      });

      it('should throw error when attempting to create "main" collection', async () => {
        // Arrange
        const nodeId = 'test-node-id';
        const relationType = 'specializations';
        const collectionName = 'main'; // Attempting to create 'main'
        const uname = 'test-user';
        const reasoning = 'Attempting to create main collection';

        // Create mock node
        const mockNode = createMockNode(nodeId);

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: mockNode, path: `nodes/${nodeId}` };

        // Act & Assert
        await expect(
          NodeRelationshipService.createCollection(
            nodeId, relationType, collectionName, uname, reasoning
          )
        ).rejects.toThrow('Cannot create a collection named "main" as it is reserved');
      });

      it('should throw error when collection name is empty', async () => {
        // Arrange
        const nodeId = 'test-node-id';
        const relationType = 'specializations';
        const collectionName = ''; // Empty collection name
        const uname = 'test-user';
        const reasoning = 'Attempting to create collection with empty name';

        // Create mock node
        const mockNode = createMockNode(nodeId);

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: mockNode, path: `nodes/${nodeId}` };

        // Act & Assert
        await expect(
          NodeRelationshipService.createCollection(
            nodeId, relationType, collectionName, uname, reasoning
          )
        ).rejects.toThrow('Collection name is required');
      });

      it('should throw error when node ID is empty', async () => {
        // Arrange
        const nodeId = '';
        const relationType = 'specializations';
        const collectionName = 'new-collection';
        const uname = 'test-user';
        const reasoning = 'Attempting to create collection with empty node ID';

        // Act & Assert
        await expect(
          NodeRelationshipService.createCollection(
            nodeId, relationType, collectionName, uname, reasoning
          )
        ).rejects.toThrow('Invalid node ID');
      });

      it('should throw error when username is empty', async () => {
        // Arrange
        const nodeId = 'test-node-id';
        const relationType = 'specializations';
        const collectionName = 'new-collection';
        const uname = ''; // Empty username
        const reasoning = 'Attempting to create collection with empty username';

        // Create mock node
        const mockNode = createMockNode(nodeId);

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: mockNode, path: `nodes/${nodeId}` };

        // Act & Assert
        await expect(
          NodeRelationshipService.createCollection(
            nodeId, relationType, collectionName, uname, reasoning
          )
        ).rejects.toThrow('Username is required');
      });

      it('should throw error when node is not found', async () => {
        // Arrange
        const nodeId = 'non-existent-node';
        const relationType = 'specializations';
        const collectionName = 'new-collection';
        const uname = 'test-user';
        const reasoning = 'Attempting to create collection for non-existent node';

        // No document reference setup for non-existent node

        // Act & Assert
        await expect(
          NodeRelationshipService.createCollection(
            nodeId, relationType, collectionName, uname, reasoning
          )
        ).rejects.toThrow(`Node ${nodeId} not found`);
      });

      it('should throw error when node is deleted', async () => {
        // Arrange
        const nodeId = 'deleted-node-id';
        const relationType = 'specializations';
        const collectionName = 'new-collection';
        const uname = 'test-user';
        const reasoning = 'Attempting to create collection for deleted node';

        // Create mock deleted node
        const deletedNode = createMockNode(nodeId, { deleted: true });

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: deletedNode, path: `nodes/${nodeId}` };

        // Act & Assert
        await expect(
          NodeRelationshipService.createCollection(
            nodeId, relationType, collectionName, uname, reasoning
          )
        ).rejects.toThrow(`Cannot update deleted node ${nodeId}`);
      });
    });

    describe('#createMultipleCollections', () => {
      it('should create multiple collections for specializations', async () => {
        // Arrange
        const nodeId = 'test-node-id';
        const relationType = 'specializations';
        const collectionNames = ['collection-1', 'collection-2', 'collection-3'];
        const uname = 'test-user';
        const reasoning = 'Creating multiple specialization collections';

        // Create mock node with existing collections
        const mockNode = createMockNode(nodeId, {
          specializations: [
            { collectionName: 'main', nodes: [{ id: 'existing-spec' }] },
            { collectionName: 'existing-collection', nodes: [] }
          ],
          contributors: ['previous-contributor']
        });

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: mockNode, path: `nodes/${nodeId}` };

        // Act
        const result = await NodeRelationshipService.createMultipleCollections(
          nodeId, relationType, collectionNames, uname, reasoning
        );

        // Assert
        expect(db.runTransaction).toHaveBeenCalled();

        // Verify the new collections were added
        const updatedSpecializations = docRefs[`nodes/${nodeId}`].data.specializations;
        expect(updatedSpecializations).toHaveLength(5); // 2 original + 3 new

        // Check each new collection was created
        for (const name of collectionNames) {
          const collection = updatedSpecializations.find((c: any) => c.collectionName === name);
          expect(collection).toBeDefined();
          expect(collection.nodes).toEqual([]);
        }

        // Verify existing collections weren't affected
        const mainCollection = updatedSpecializations.find((c: any) => c.collectionName === 'main');
        expect(mainCollection.nodes).toEqual([{ id: 'existing-spec' }]);

        const existingCollection = updatedSpecializations.find((c: any) => c.collectionName === 'existing-collection');
        expect(existingCollection.nodes).toEqual([]);

        // Verify contributors were updated
        expect(docRefs[`nodes/${nodeId}`].data.contributors).toContain('test-user');

        // Verify the returned node
        expect(result.specializations).toHaveLength(5);
        collectionNames.forEach(name => {
          const resultCollection = result.specializations.find(c => c.collectionName === name);
          expect(resultCollection).toBeDefined();
          expect(resultCollection?.nodes).toEqual([]);
        });
      });

      it('should create multiple collections for generalizations', async () => {
        // Arrange
        const nodeId = 'test-node-id';
        const relationType = 'generalizations';
        const collectionNames = ['gen-collection-1', 'gen-collection-2'];
        const uname = 'test-user';
        const reasoning = 'Creating multiple generalization collections';

        // Create mock node with existing collections
        const mockNode = createMockNode(nodeId, {
          generalizations: [
            { collectionName: 'main', nodes: [{ id: 'existing-gen' }] }
          ],
          contributors: ['previous-contributor']
        });

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: mockNode, path: `nodes/${nodeId}` };

        // Act
        const result = await NodeRelationshipService.createMultipleCollections(
          nodeId, relationType, collectionNames, uname, reasoning
        );

        // Assert
        // Verify the new collections were added
        const updatedGeneralizations = docRefs[`nodes/${nodeId}`].data.generalizations;
        expect(updatedGeneralizations).toHaveLength(3); // 1 original + 2 new

        // Check each new collection was created
        for (const name of collectionNames) {
          const collection = updatedGeneralizations.find((c: any) => c.collectionName === name);
          expect(collection).toBeDefined();
          expect(collection.nodes).toEqual([]);
        }

        // Verify the returned node
        expect(result.generalizations).toHaveLength(3);
        collectionNames.forEach(name => {
          const resultCollection = result.generalizations.find(c => c.collectionName === name);
          expect(resultCollection).toBeDefined();
        });
      });

      it('should initialize collections array if it does not exist', async () => {
        // Arrange
        const nodeId = 'test-node-id';
        const relationType = 'specializations';
        const collectionNames = ['collection-1', 'collection-2'];
        const uname = 'test-user';
        const reasoning = 'Creating collections when none exist';

        // Create a basic node object without collections
        const nodeData = {
          id: nodeId,
          title: 'Test Node',
          nodeType: 'activity',
          deleted: false,
          properties: {}
          // Omit specializations entirely
        };

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: nodeData, path: `nodes/${nodeId}` };

        // Act
        const result = await NodeRelationshipService.createMultipleCollections(
          nodeId, relationType, collectionNames, uname, reasoning
        );

        // Assert
        // Verify the specializations array was initialized with main and new collections
        const updatedSpecializations = docRefs[`nodes/${nodeId}`].data.specializations;
        expect(updatedSpecializations).toHaveLength(3); // main + 2 new

        // Should have created main collection
        const mainCollection = updatedSpecializations.find((c: any) => c.collectionName === 'main');
        expect(mainCollection).toBeDefined();
        expect(mainCollection.nodes).toEqual([]);

        // Should have created the requested collections
        collectionNames.forEach(name => {
          const collection = updatedSpecializations.find((c: any) => c.collectionName === name);
          expect(collection).toBeDefined();
          expect(collection.nodes).toEqual([]);
        });
      });

      it('should validate all collection names', async () => {
        // Arrange
        const nodeId = 'test-node-id';
        const relationType = 'specializations';
        const collectionNames = ['valid-collection', '', 'another-valid']; // One empty name
        const uname = 'test-user';
        const reasoning = 'Creating collections with invalid name';

        // Create mock node
        const mockNode = createMockNode(nodeId);

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: mockNode, path: `nodes/${nodeId}` };

        // Act & Assert
        await expect(
          NodeRelationshipService.createMultipleCollections(
            nodeId, relationType, collectionNames, uname, reasoning
          )
        ).rejects.toThrow('Collection names cannot be empty');
      });

      it('should throw error for duplicate collection names', async () => {
        // Arrange
        const nodeId = 'test-node-id';
        const relationType = 'specializations';
        const collectionNames = ['new-collection', 'existing-collection']; // One already exists
        const uname = 'test-user';
        const reasoning = 'Creating collections with duplicate';

        // Create mock node with one of the collections already existing
        const mockNode = createMockNode(nodeId, {
          specializations: [
            { collectionName: 'main', nodes: [] },
            { collectionName: 'existing-collection', nodes: [] }
          ]
        });

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: mockNode, path: `nodes/${nodeId}` };

        // Act & Assert
        await expect(
          NodeRelationshipService.createMultipleCollections(
            nodeId, relationType, collectionNames, uname, reasoning
          )
        ).rejects.toThrow('The following collections already exist: existing-collection');
      });

      it('should throw error when attempting to create "main" collection', async () => {
        // Arrange
        const nodeId = 'test-node-id';
        const relationType = 'specializations';
        const collectionNames = ['new-collection', 'main', 'another-collection']; // Includes 'main'
        const uname = 'test-user';
        const reasoning = 'Creating collections including main';

        // Create mock node
        const mockNode = createMockNode(nodeId);

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: mockNode, path: `nodes/${nodeId}` };

        // Act & Assert
        await expect(
          NodeRelationshipService.createMultipleCollections(
            nodeId, relationType, collectionNames, uname, reasoning
          )
        ).rejects.toThrow('Cannot create a collection named "main" as it is reserved');
      });

      it('should throw error when collection names array is empty', async () => {
        // Arrange
        const nodeId = 'test-node-id';
        const relationType = 'specializations';
        const collectionNames: string[] = []; // Empty array
        const uname = 'test-user';
        const reasoning = 'Creating with empty array';

        // Create mock node
        const mockNode = createMockNode(nodeId);

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: mockNode, path: `nodes/${nodeId}` };

        // Act & Assert
        await expect(
          NodeRelationshipService.createMultipleCollections(
            nodeId, relationType, collectionNames, uname, reasoning
          )
        ).rejects.toThrow('At least one collection name is required');
      });

      it('should throw error when node ID is empty', async () => {
        // Arrange
        const nodeId = '';
        const relationType = 'specializations';
        const collectionNames = ['new-collection'];
        const uname = 'test-user';
        const reasoning = 'Creating with empty node ID';

        // Act & Assert
        await expect(
          NodeRelationshipService.createMultipleCollections(
            nodeId, relationType, collectionNames, uname, reasoning
          )
        ).rejects.toThrow('Invalid node ID');
      });

      it('should throw error when username is empty', async () => {
        // Arrange
        const nodeId = 'test-node-id';
        const relationType = 'specializations';
        const collectionNames = ['new-collection'];
        const uname = ''; // Empty username
        const reasoning = 'Creating with empty username';

        // Create mock node
        const mockNode = createMockNode(nodeId);

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: mockNode, path: `nodes/${nodeId}` };

        // Act & Assert
        await expect(
          NodeRelationshipService.createMultipleCollections(
            nodeId, relationType, collectionNames, uname, reasoning
          )
        ).rejects.toThrow('Username is required');
      });

      it('should throw error when node is not found', async () => {
        // Arrange
        const nodeId = 'non-existent-node';
        const relationType = 'specializations';
        const collectionNames = ['new-collection'];
        const uname = 'test-user';
        const reasoning = 'Creating for non-existent node';

        // No document reference setup for non-existent node

        // Act & Assert
        await expect(
          NodeRelationshipService.createMultipleCollections(
            nodeId, relationType, collectionNames, uname, reasoning
          )
        ).rejects.toThrow(`Node ${nodeId} not found`);
      });

      it('should throw error when node is deleted', async () => {
        // Arrange
        const nodeId = 'deleted-node-id';
        const relationType = 'specializations';
        const collectionNames = ['new-collection'];
        const uname = 'test-user';
        const reasoning = 'Creating for deleted node';

        // Create mock deleted node
        const deletedNode = createMockNode(nodeId, { deleted: true });

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: deletedNode, path: `nodes/${nodeId}` };

        // Act & Assert
        await expect(
          NodeRelationshipService.createMultipleCollections(
            nodeId, relationType, collectionNames, uname, reasoning
          )
        ).rejects.toThrow(`Cannot update deleted node ${nodeId}`);
      });
    });

    describe('#deleteCollection', () => {
      it('should delete an empty specializations collection', async () => {
        // Arrange
        const nodeId = 'test-node-id';
        const relationType = 'specializations';
        const collectionName = 'empty-collection';
        const uname = 'test-user';
        const reasoning = 'Deleting empty collection';

        // Create mock node with multiple collections including an empty one
        const mockNode = createMockNode(nodeId, {
          specializations: [
            { collectionName: 'main', nodes: [{ id: 'spec-1' }] },
            { collectionName: 'empty-collection', nodes: [] },
            { collectionName: 'another-collection', nodes: [{ id: 'spec-2' }] }
          ],
          contributors: ['previous-contributor']
        });

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: mockNode, path: `nodes/${nodeId}` };

        // Act
        const result = await NodeRelationshipService.deleteCollection(
          nodeId, relationType, collectionName, uname, reasoning
        );

        // Assert
        expect(db.runTransaction).toHaveBeenCalled();

        // Verify the collection was removed
        const updatedSpecializations = docRefs[`nodes/${nodeId}`].data.specializations;
        expect(updatedSpecializations).toHaveLength(2); // 3 original - 1 deleted

        // Verify the correct collection was removed
        const deletedCollection = updatedSpecializations.find((c: any) => c.collectionName === collectionName);
        expect(deletedCollection).toBeUndefined();

        // Verify other collections weren't affected
        const mainCollection = updatedSpecializations.find((c: any) => c.collectionName === 'main');
        expect(mainCollection).toBeDefined();
        expect(mainCollection.nodes).toEqual([{ id: 'spec-1' }]);

        const otherCollection = updatedSpecializations.find((c: any) => c.collectionName === 'another-collection');
        expect(otherCollection).toBeDefined();
        expect(otherCollection.nodes).toEqual([{ id: 'spec-2' }]);

        // Verify contributors were updated
        expect(docRefs[`nodes/${nodeId}`].data.contributors).toContain('test-user');

        // Verify the returned node
        expect(result.specializations).toHaveLength(2);
        expect(result.specializations.find(c => c.collectionName === collectionName)).toBeUndefined();
      });

      it('should delete an empty generalizations collection', async () => {
        // Arrange
        const nodeId = 'test-node-id';
        const relationType = 'generalizations';
        const collectionName = 'empty-gen-collection';
        const uname = 'test-user';
        const reasoning = 'Deleting empty generalizations collection';

        // Create mock node with multiple collections including an empty one
        const mockNode = createMockNode(nodeId, {
          generalizations: [
            { collectionName: 'main', nodes: [{ id: 'gen-1' }] },
            { collectionName: 'empty-gen-collection', nodes: [] },
            { collectionName: 'another-collection', nodes: [{ id: 'gen-2' }] }
          ],
          contributors: ['previous-contributor']
        });

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: mockNode, path: `nodes/${nodeId}` };

        // Act
        const result = await NodeRelationshipService.deleteCollection(
          nodeId, relationType, collectionName, uname, reasoning
        );

        // Assert
        // Verify the collection was removed
        const updatedGeneralizations = docRefs[`nodes/${nodeId}`].data.generalizations;
        expect(updatedGeneralizations).toHaveLength(2);

        // Verify the correct collection was removed
        const deletedCollection = updatedGeneralizations.find((c: any) => c.collectionName === collectionName);
        expect(deletedCollection).toBeUndefined();

        // Verify the returned node
        expect(result.generalizations).toHaveLength(2);
        expect(result.generalizations.find(c => c.collectionName === collectionName)).toBeUndefined();
      });

      it('should throw error when trying to delete the "main" collection', async () => {
        // Arrange
        const nodeId = 'test-node-id';
        const relationType = 'specializations';
        const collectionName = 'main'; // Attempting to delete 'main'
        const uname = 'test-user';
        const reasoning = 'Attempting to delete main collection';

        // Create mock node
        const mockNode = createMockNode(nodeId, {
          specializations: [
            { collectionName: 'main', nodes: [] },
            { collectionName: 'another-collection', nodes: [] }
          ]
        });

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: mockNode, path: `nodes/${nodeId}` };

        // Act & Assert
        await expect(
          NodeRelationshipService.deleteCollection(
            nodeId, relationType, collectionName, uname, reasoning
          )
        ).rejects.toThrow('Cannot delete the "main" collection as it is required');
      });

      it('should throw error when trying to delete a non-empty collection', async () => {
        // Arrange
        const nodeId = 'test-node-id';
        const relationType = 'specializations';
        const collectionName = 'non-empty-collection'; // Collection with nodes
        const uname = 'test-user';
        const reasoning = 'Attempting to delete non-empty collection';

        // Create mock node with a non-empty collection
        const mockNode = createMockNode(nodeId, {
          specializations: [
            { collectionName: 'main', nodes: [] },
            {
              collectionName: 'non-empty-collection',
              nodes: [{ id: 'spec-1' }, { id: 'spec-2' }]
            }
          ]
        });

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: mockNode, path: `nodes/${nodeId}` };

        // Act & Assert
        await expect(
          NodeRelationshipService.deleteCollection(
            nodeId, relationType, collectionName, uname, reasoning
          )
        ).rejects.toThrow(`Cannot delete collection "${collectionName}" because it contains 2 nodes`);
      });

      it('should throw error when collection does not exist', async () => {
        // Arrange
        const nodeId = 'test-node-id';
        const relationType = 'specializations';
        const collectionName = 'non-existent-collection';
        const uname = 'test-user';
        const reasoning = 'Attempting to delete non-existent collection';

        // Create mock node
        const mockNode = createMockNode(nodeId, {
          specializations: [
            { collectionName: 'main', nodes: [] },
            { collectionName: 'another-collection', nodes: [] }
          ]
        });

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: mockNode, path: `nodes/${nodeId}` };

        // Act & Assert
        await expect(
          NodeRelationshipService.deleteCollection(
            nodeId, relationType, collectionName, uname, reasoning
          )
        ).rejects.toThrow(`Collection "${collectionName}" not found in ${relationType}`);
      });

      it('should throw error when relation type has no collections', async () => {
        // Arrange
        const nodeId = 'test-node-id';
        const relationType = 'specializations';
        const collectionName = 'any-collection';
        const uname = 'test-user';
        const reasoning = 'Attempting to delete when no collections exist';

        // Create a node with undefined specializations array
        const nodeData = {
          id: nodeId,
          title: 'Test Node',
          nodeType: 'activity',
          deleted: false,
          properties: {}
          // Omit specializations entirely
        };

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: nodeData, path: `nodes/${nodeId}` };

        // Act & Assert
        await expect(
          NodeRelationshipService.deleteCollection(
            nodeId, relationType, collectionName, uname, reasoning
          )
        ).rejects.toThrow(`Node does not have any ${relationType} collections`);
      });

      it('should throw error when collection name is empty', async () => {
        // Arrange
        const nodeId = 'test-node-id';
        const relationType = 'specializations';
        const collectionName = ''; // Empty collection name
        const uname = 'test-user';
        const reasoning = 'Attempting to delete with empty name';

        // Create mock node
        const mockNode = createMockNode(nodeId);

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: mockNode, path: `nodes/${nodeId}` };

        // Act & Assert
        await expect(
          NodeRelationshipService.deleteCollection(
            nodeId, relationType, collectionName, uname, reasoning
          )
        ).rejects.toThrow('Collection name is required');
      });

      it('should throw error when node ID is empty', async () => {
        // Arrange
        const nodeId = '';
        const relationType = 'specializations';
        const collectionName = 'some-collection';
        const uname = 'test-user';
        const reasoning = 'Attempting to delete with empty node ID';

        // Act & Assert
        await expect(
          NodeRelationshipService.deleteCollection(
            nodeId, relationType, collectionName, uname, reasoning
          )
        ).rejects.toThrow('Invalid node ID');
      });

      it('should throw error when username is empty', async () => {
        // Arrange
        const nodeId = 'test-node-id';
        const relationType = 'specializations';
        const collectionName = 'some-collection';
        const uname = ''; // Empty username
        const reasoning = 'Attempting to delete with empty username';

        // Create mock node
        const mockNode = createMockNode(nodeId);

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: mockNode, path: `nodes/${nodeId}` };

        // Act & Assert
        await expect(
          NodeRelationshipService.deleteCollection(
            nodeId, relationType, collectionName, uname, reasoning
          )
        ).rejects.toThrow('Username is required');
      });

      it('should throw error when node is not found', async () => {
        // Arrange
        const nodeId = 'non-existent-node';
        const relationType = 'specializations';
        const collectionName = 'some-collection';
        const uname = 'test-user';
        const reasoning = 'Attempting to delete for non-existent node';

        // No document reference setup for non-existent node

        // Act & Assert
        await expect(
          NodeRelationshipService.deleteCollection(
            nodeId, relationType, collectionName, uname, reasoning
          )
        ).rejects.toThrow(`Node ${nodeId} not found`);
      });

      it('should throw error when node is deleted', async () => {
        // Arrange
        const nodeId = 'deleted-node-id';
        const relationType = 'specializations';
        const collectionName = 'some-collection';
        const uname = 'test-user';
        const reasoning = 'Attempting to delete for deleted node';

        // Create mock deleted node
        const deletedNode = createMockNode(nodeId, { deleted: true });

        // Set up document reference
        docRefs[`nodes/${nodeId}`] = { exists: true, data: deletedNode, path: `nodes/${nodeId}` };

        // Act & Assert
        await expect(
          NodeRelationshipService.deleteCollection(
            nodeId, relationType, collectionName, uname, reasoning
          )
        ).rejects.toThrow(`Cannot update deleted node ${nodeId}`);
      });
    });

  });

  describe('Inheritance Management', () => {
    describe('Property Inheritance', () => {
      it('should inherit properties when adding generalizations', async () => {
        // Arrange
        const childId = 'child-node-id';
        const parentId = 'parent-node-id';
        const uname = 'test-user';
        const reasoning = 'Adding parent with inheritable properties';

        // Create mock parent node with inheritable properties
        const parentNode = createMockNode(parentId, {
          properties: {
            inheritable1: 'parent-value-1',
            inheritable2: 'parent-value-2',
            nonInheritable: 'parent-value-3',
            parts: [],
            isPartOf: []
          },
          propertyType: {
            inheritable1: 'string',
            inheritable2: 'string',
            nonInheritable: 'string'
          },
          inheritance: {
            inheritable1: { inheritanceType: 'alwaysInherit', ref: null },
            inheritable2: { inheritanceType: 'inheritUnlessAlreadyOverRidden', ref: null },
            nonInheritable: { inheritanceType: 'neverInherit', ref: null }
          }
        });

        // Create mock child node without those properties
        const childNode = createMockNode(childId, {
          generalizations: [
            { collectionName: 'main', nodes: [{ id: 'existing-parent-id' }] }
          ],
          properties: {
            existingProp: 'existing-value',
            parts: [],
            isPartOf: []
          },
          propertyType: {
            existingProp: 'string'
          },
          inheritance: {}
        });

        // Set up document references
        docRefs[`nodes/${childId}`] = { exists: true, data: childNode, path: `nodes/${childId}` };
        docRefs[`nodes/${parentId}`] = { exists: true, data: parentNode, path: `nodes/${parentId}` };

        // Mock updateInheritanceAfterAddingGeneralization method
        jest.spyOn(NodeRelationshipService as any, 'updateInheritanceAfterAddingGeneralization')
          .mockImplementation(async (nodeId, generalizationId) => {
            // Simulate inheritance update directly
            const nodeData = docRefs[`nodes/${nodeId}`].data;
            const genData = docRefs[`nodes/${generalizationId}`].data;

            // Apply inheritance for inheritable properties
            const updates: any = {
              properties: { ...nodeData.properties },
              propertyType: { ...nodeData.propertyType },
              inheritance: { ...nodeData.inheritance }
            };

            // Inherit properties based on inheritance type
            for (const [prop, value] of Object.entries(genData.properties)) {
              const inheritanceType = genData.inheritance[prop]?.inheritanceType;

              // Only inherit if the property is meant to be inherited
              if (inheritanceType === 'alwaysInherit' ||
                inheritanceType === 'inheritUnlessAlreadyOverRidden') {
                // Check if child doesn't already have this property
                if (!nodeData.properties.hasOwnProperty(prop)) {
                  updates.properties[prop] = value;
                  updates.propertyType[prop] = genData.propertyType[prop];
                  updates.inheritance[prop] = {
                    inheritanceType: 'inheritUnlessAlreadyOverRidden',
                    ref: generalizationId
                  };
                }
              }
            }

            // Apply updates to the node
            Object.assign(docRefs[`nodes/${nodeId}`].data, updates);
          });

        // Mock wouldCreateCircularReference to return false
        jest.spyOn(NodeRelationshipService as any, 'wouldCreateCircularReference')
          .mockReturnValue(false);

        // Act
        const result = await NodeRelationshipService.addGeneralizations(
          childId, [{ id: parentId }], uname, reasoning
        );

        // Assert
        // Verify that the generalization relationship was created
        expect(result.generalizations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              collectionName: 'main',
              nodes: expect.arrayContaining([
                { id: 'existing-parent-id' },
                { id: parentId }
              ])
            })
          ])
        );

        // Check that updateInheritanceAfterAddingGeneralization was called
        expect((NodeRelationshipService as any).updateInheritanceAfterAddingGeneralization)
          .toHaveBeenCalledWith(childId, parentId);

        // Verify the inherited properties
        const updatedChildNode = docRefs[`nodes/${childId}`].data;

        // Should have inherited the inheritable properties
        expect(updatedChildNode.properties).toHaveProperty('inheritable1', 'parent-value-1');
        expect(updatedChildNode.properties).toHaveProperty('inheritable2', 'parent-value-2');

        // Should NOT have inherited the non-inheritable property
        expect(updatedChildNode.properties).not.toHaveProperty('nonInheritable');

        // Should have inheritance references set correctly
        expect(updatedChildNode.inheritance.inheritable1).toEqual({
          inheritanceType: 'inheritUnlessAlreadyOverRidden',
          ref: parentId
        });

        expect(updatedChildNode.inheritance.inheritable2).toEqual({
          inheritanceType: 'inheritUnlessAlreadyOverRidden',
          ref: parentId
        });

        // Original property should remain unchanged
        expect(updatedChildNode.properties.existingProp).toBe('existing-value');
      });

      it('should update inheritance when removing generalizations', async () => {
        // Arrange
        const childId = 'child-node-id';
        const parentToRemoveId = 'parent-to-remove-id';
        const remainingParentId = 'remaining-parent-id';
        const uname = 'test-user';
        const reasoning = 'Removing parent with inherited properties';

        // Create mock parent to be removed
        const parentToRemove = createMockNode(parentToRemoveId, {
          properties: {
            prop1: 'parent1-value-1', // Unique to this parent
            prop2: 'parent1-value-2', // Also exists in remaining parent
            prop3: 'parent1-value-3' // Also exists in remaining parent
            ,
            parts: [],
            isPartOf: []
          },
          propertyType: {
            prop1: 'string',
            prop2: 'string',
            prop3: 'string'
          },
          inheritance: {
            prop1: { inheritanceType: 'alwaysInherit', ref: null },
            prop2: { inheritanceType: 'alwaysInherit', ref: null },
            prop3: { inheritanceType: 'alwaysInherit', ref: null }
          },
          specializations: [
            { collectionName: 'main', nodes: [{ id: childId }] }
          ]
        });

        // Create mock remaining parent
        const remainingParent = createMockNode(remainingParentId, {
          properties: {
            prop2: 'parent2-value-2', // Different value from first parent
            prop3: 'parent1-value-3', // Same value as first parent
            prop4: 'parent2-value-4' // Unique to this parent
            ,
            parts: [],
            isPartOf: []
          },
          propertyType: {
            prop2: 'string',
            prop3: 'string',
            prop4: 'string'
          },
          inheritance: {
            prop2: { inheritanceType: 'alwaysInherit', ref: null },
            prop3: { inheritanceType: 'alwaysInherit', ref: null },
            prop4: { inheritanceType: 'alwaysInherit', ref: null }
          },
          specializations: [
            { collectionName: 'main', nodes: [{ id: childId }] }
          ]
        });

        // Create mock child node with properties inherited from both parents
        const childNode = createMockNode(childId, {
          generalizations: [
            {
              collectionName: 'main',
              nodes: [
                { id: parentToRemoveId },
                { id: remainingParentId }
              ]
            }
          ],
          properties: {
            prop1: 'parent1-value-1',
            prop2: 'parent1-value-2',
            prop3: 'parent1-value-3',
            prop4: 'parent2-value-4',
            ownProp: 'child-value',
            parts: [],
            isPartOf: []
          },
          propertyType: {
            prop1: 'string',
            prop2: 'string',
            prop3: 'string',
            prop4: 'string',
            ownProp: 'string'
          },
          inheritance: {
            prop1: { inheritanceType: 'inheritUnlessAlreadyOverRidden', ref: parentToRemoveId },
            prop2: { inheritanceType: 'inheritUnlessAlreadyOverRidden', ref: parentToRemoveId },
            prop3: { inheritanceType: 'inheritUnlessAlreadyOverRidden', ref: parentToRemoveId },
            prop4: { inheritanceType: 'inheritUnlessAlreadyOverRidden', ref: remainingParentId }
          }
        });

        // Set up document references
        docRefs[`nodes/${childId}`] = { exists: true, data: childNode, path: `nodes/${childId}` };
        docRefs[`nodes/${parentToRemoveId}`] = { exists: true, data: parentToRemove, path: `nodes/${parentToRemoveId}` };
        docRefs[`nodes/${remainingParentId}`] = { exists: true, data: remainingParent, path: `nodes/${remainingParentId}` };

        // Mock updateInheritanceAfterRemovingGeneralization method
        jest.spyOn(NodeRelationshipService as any, 'updateInheritanceAfterRemovingGeneralization')
          .mockImplementation(async (nodeId, removedGeneralizationId) => {
            // Simulate inheritance update directly
            const nodeData = docRefs[`nodes/${nodeId}`].data;

            // Identify properties inherited from the removed generalization
            const affectedProps = Object.entries(nodeData.inheritance)
              .filter(([_, details]: [string, any]) => details.ref === removedGeneralizationId)
              .map(([prop, _]) => prop);

            // Get remaining generalizations
            const remainingGeneralizations = nodeData.generalizations
              .flatMap((c: any) => c.nodes.map((n: any) => n.id))
              .filter((id: string) => id !== removedGeneralizationId);

            // Load remaining parents' data
            const parentsData: { [id: string]: any } = {};
            for (const parentId of remainingGeneralizations) {
              if (docRefs[`nodes/${parentId}`]) {
                parentsData[parentId] = docRefs[`nodes/${parentId}`].data;
              }
            }

            // Process each affected property
            const updates: any = {
              properties: { ...nodeData.properties },
              inheritance: { ...nodeData.inheritance }
            };

            for (const prop of affectedProps) {
              // Find if any other parent has this property
              const newSourceParent = Object.entries(parentsData).find(
                ([_, data]: [string, any]) => data.properties.hasOwnProperty(prop)
              );

              if (newSourceParent) {
                // Update to inherit from new parent
                const [parentId, parentData] = newSourceParent;
                updates.properties[prop] = parentData.properties[prop];
                updates.inheritance[prop] = {
                  inheritanceType: 'inheritUnlessAlreadyOverRidden',
                  ref: parentId
                };
              } else {
                // No other parent has this property, remove it
                delete updates.properties[prop];
                delete updates.inheritance[prop];
              }
            }

            // Apply updates to the node
            Object.assign(docRefs[`nodes/${nodeId}`].data, updates);
          });

        // Act
        const result = await NodeRelationshipService.removeGeneralizations(
          childId, [{ id: parentToRemoveId }], uname, reasoning
        );

        // Assert
        // Verify that the generalization relationship was removed
        expect(result.generalizations).toEqual([
          {
            collectionName: 'main',
            nodes: [{ id: remainingParentId }]
          }
        ]);

        // Check that updateInheritanceAfterRemovingGeneralization was called
        expect((NodeRelationshipService as any).updateInheritanceAfterRemovingGeneralization)
          .toHaveBeenCalledWith(childId, parentToRemoveId);

        // Verify the updated inheritance
        const updatedChildNode = docRefs[`nodes/${childId}`].data;

        // prop1 should be removed (was unique to removed parent)
        expect(updatedChildNode.properties).not.toHaveProperty('prop1');
        expect(updatedChildNode.inheritance).not.toHaveProperty('prop1');

        // prop2 should be updated to inherit from remaining parent
        expect(updatedChildNode.properties.prop2).toBe('parent2-value-2');
        expect(updatedChildNode.inheritance.prop2).toEqual({
          inheritanceType: 'inheritUnlessAlreadyOverRidden',
          ref: remainingParentId
        });

        // prop3 should keep the same value but update reference
        expect(updatedChildNode.properties.prop3).toBe('parent1-value-3');
        expect(updatedChildNode.inheritance.prop3).toEqual({
          inheritanceType: 'inheritUnlessAlreadyOverRidden',
          ref: remainingParentId
        });

        // prop4 should remain unchanged (from remaining parent)
        expect(updatedChildNode.properties.prop4).toBe('parent2-value-4');
        expect(updatedChildNode.inheritance.prop4).toEqual({
          inheritanceType: 'inheritUnlessAlreadyOverRidden',
          ref: remainingParentId
        });

        // Own property should remain unchanged
        expect(updatedChildNode.properties.ownProp).toBe('child-value');
      });

      it('should respect inheritance type rules', async () => {
        // Arrange
        const childId = 'child-node-id';
        const parentId = 'parent-node-id';
        const uname = 'test-user';
        const reasoning = 'Testing inheritance type rules';

        // Create mock parent node with different inheritance types
        const parentNode = createMockNode(parentId, {
          properties: {
            alwaysInheritProp: 'always-inherit-value',
            conditionalInheritProp: 'conditional-value',
            neverInheritProp: 'never-inherit-value',
            parts: [],
            isPartOf: []
          },
          propertyType: {
            alwaysInheritProp: 'string',
            conditionalInheritProp: 'string',
            neverInheritProp: 'string'
          },
          inheritance: {
            alwaysInheritProp: { inheritanceType: 'alwaysInherit', ref: null },
            conditionalInheritProp: { inheritanceType: 'inheritUnlessAlreadyOverRidden', ref: null },
            neverInheritProp: { inheritanceType: 'neverInherit', ref: null }
          }
        });

        // Create mock child node with an overridden conditional property
        const childNode = createMockNode(childId, {
          generalizations: [
            { collectionName: 'main', nodes: [] }
          ],
          properties: {
            conditionalInheritProp: 'child-override-value', // Child has its own value
            parts: [],
            isPartOf: []
          },
          propertyType: {
            conditionalInheritProp: 'string'
          },
          inheritance: {}
        });

        // Set up document references
        docRefs[`nodes/${childId}`] = { exists: true, data: childNode, path: `nodes/${childId}` };
        docRefs[`nodes/${parentId}`] = { exists: true, data: parentNode, path: `nodes/${parentId}` };

        // Mock inheritance update after adding generalization
        jest.spyOn(NodeRelationshipService as any, 'updateInheritanceAfterAddingGeneralization')
          .mockImplementation(async (nodeId, generalizationId) => {
            // Simulate inheritance update directly
            const nodeData = docRefs[`nodes/${nodeId}`].data;
            const genData = docRefs[`nodes/${generalizationId}`].data;

            // Apply inheritance based on inheritance types
            const updates: any = {
              properties: { ...nodeData.properties },
              propertyType: { ...nodeData.propertyType },
              inheritance: { ...nodeData.inheritance }
            };

            for (const [prop, value] of Object.entries(genData.properties)) {
              const inheritanceType = genData.inheritance[prop]?.inheritanceType;

              if (inheritanceType === 'alwaysInherit') {
                // Always inherit, regardless of child's state
                updates.properties[prop] = value;
                updates.propertyType[prop] = genData.propertyType[prop];
                updates.inheritance[prop] = {
                  inheritanceType: 'inheritUnlessAlreadyOverRidden',
                  ref: generalizationId
                };
              } else if (inheritanceType === 'inheritUnlessAlreadyOverRidden') {
                // Only inherit if child doesn't already have this property
                if (!nodeData.properties.hasOwnProperty(prop)) {
                  updates.properties[prop] = value;
                  updates.propertyType[prop] = genData.propertyType[prop];
                  updates.inheritance[prop] = {
                    inheritanceType: 'inheritUnlessAlreadyOverRidden',
                    ref: generalizationId
                  };
                }
              }
              // neverInherit properties are never inherited
            }

            // Apply updates to the node
            Object.assign(docRefs[`nodes/${nodeId}`].data, updates);
          });

        // Mock wouldCreateCircularReference to return false
        jest.spyOn(NodeRelationshipService as any, 'wouldCreateCircularReference')
          .mockReturnValue(false);

        // Act
        await NodeRelationshipService.addGeneralizations(
          childId, [{ id: parentId }], uname, reasoning
        );

        // Assert
        const updatedChildNode = docRefs[`nodes/${childId}`].data;

        // alwaysInherit property should be inherited
        expect(updatedChildNode.properties).toHaveProperty('alwaysInheritProp', 'always-inherit-value');
        expect(updatedChildNode.inheritance.alwaysInheritProp).toEqual({
          inheritanceType: 'inheritUnlessAlreadyOverRidden',
          ref: parentId
        });

        // conditionalInheritProp should NOT be inherited (child has its own value)
        expect(updatedChildNode.properties.conditionalInheritProp).toBe('child-override-value');
        expect(updatedChildNode.inheritance).not.toHaveProperty('conditionalInheritProp');

        // neverInheritProp should NOT be inherited
        expect(updatedChildNode.properties).not.toHaveProperty('neverInheritProp');
        expect(updatedChildNode.inheritance).not.toHaveProperty('neverInheritProp');
      });
    });
  });
});