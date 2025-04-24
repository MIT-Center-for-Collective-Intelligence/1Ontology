import { ChangelogService } from ' @components/services/changelog';
import { NODES, USERS, NODES_LOGS } from ' @components/lib/firestoreClient/collections';
import { db } from ' @components/lib/firestoreServer/admin';
import { NodeChange, INode } from ' @components/types/INode';

jest.spyOn(console, 'error').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});

jest.mock(' @components/lib/firestoreServer/admin', () => {
  return {
    db: {
      collection: jest.fn()
    }
  };
});

describe('ChangelogService', () => {

  beforeEach(() => {
    jest.clearAllMocks();

    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
  });

  describe('#updateContributors', () => {
    it('should add contributor to node if not already present', async () => {
      const nodeId = 'test-node-id';
      const username = 'new-contributor';
      const propertyName = 'description';

      const mockGet = jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          contributors: ['existing-user'],
          contributorsByProperty: {
            description: ['existing-user']
          }
        })
      });

      const mockUpdate = jest.fn().mockResolvedValue({});

      const mockDoc = jest.fn().mockReturnValue({
        get: mockGet,
        update: mockUpdate
      });

      const mockCollection = jest.fn().mockReturnValue({
        doc: mockDoc
      });

      (db.collection as jest.Mock).mockImplementation((collectionName) => {
        if (collectionName === NODES) {
          return mockCollection();
        }
        throw new Error(`Unexpected collection: ${collectionName}`);
      });

      await (ChangelogService as any)['updateContributors'](
        nodeId, 
        username, 
        propertyName
      );

      expect(db.collection).toHaveBeenCalledWith(NODES);
      expect(mockCollection).toHaveBeenCalled();
      expect(mockDoc).toHaveBeenCalledWith(nodeId);
      expect(mockGet).toHaveBeenCalled();
      
      expect(mockUpdate).toHaveBeenCalledWith({
        contributors: ['existing-user', 'new-contributor'],
        'contributorsByProperty.description': [
          'existing-user', 
          'new-contributor'
        ]
      });
    });

    it('should not add contributor if node does not exist', async () => {
      const nodeId = 'non-existent-node';
      const username = 'test-user';

      const mockGet = jest.fn().mockResolvedValue({
        exists: false
      });

      const mockUpdate = jest.fn().mockResolvedValue({});

      const mockDoc = jest.fn().mockReturnValue({
        get: mockGet,
        update: mockUpdate
      });

      const mockCollection = jest.fn().mockReturnValue({
        doc: mockDoc
      });

      (db.collection as jest.Mock).mockImplementation((collectionName) => {
        if (collectionName === NODES) {
          return mockCollection();
        }
        throw new Error(`Unexpected collection: ${collectionName}`);
      });

      await (ChangelogService as any)['updateContributors'](
        nodeId, 
        username, 
        null
      );

      expect(db.collection).toHaveBeenCalledWith(NODES);
      expect(mockCollection).toHaveBeenCalled();
      expect(mockDoc).toHaveBeenCalledWith(nodeId);
      expect(mockGet).toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
      
      expect(console.warn).toHaveBeenCalledWith(
        `Node ${nodeId} not found when updating contributors`
      );
    });
  });

  describe('#log', () => {
    it('should create a standard changelog entry', async () => {
      const mockAdd = jest.fn().mockResolvedValue({ id: 'mock-changelog-id' });

      const mockCollection = jest.fn().mockReturnValue({
        add: mockAdd
      });

      (db.collection as jest.Mock).mockImplementation((collectionName) => {
        if (collectionName === NODES_LOGS) {
          return mockCollection();
        }
        throw new Error(`Unexpected collection: ${collectionName}`);
      });

      const mockNode = { id: 'test-node' } as INode;
      
      const result = await ChangelogService.log(
        'test-node-id',
        'test-user',
        'add node',
        mockNode,
        'Test reasoning',
        'description',
        'old value',
        'new value'
      );

      expect(result).toBe('mock-changelog-id');
      
      expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
        nodeId: 'test-node-id',
        modifiedBy: 'test-user',
        changeType: 'add node',
        modifiedProperty: 'description',
        previousValue: 'old value',
        newValue: 'new value',
        reasoning: 'Test reasoning',
        fullNode: mockNode
      }));
    });
  });

  describe('#logRelationshipChange', () => {
    it('should log relationship changes', async () => {
      const mockAdd = jest.fn().mockResolvedValue({ id: 'mock-changelog-id' });

      const mockCollection = jest.fn().mockReturnValue({
        add: mockAdd
      });

      (db.collection as jest.Mock).mockImplementation((collectionName) => {
        if (collectionName === NODES_LOGS) {
          return mockCollection();
        }
        throw new Error(`Unexpected collection: ${collectionName}`);
      });

      const mockNode = { id: 'test-node' } as INode;
      
      const result = await ChangelogService.logRelationshipChange(
        'test-node-id',
        'test-user',
        'add element',
        mockNode,
        'Added relationship',
        'specializations',
        [],
        ['new-node-id'],
        { sourceCollection: 'main' }
      );

      expect(result).toBe('mock-changelog-id');
      
      expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
        nodeId: 'test-node-id',
        modifiedBy: 'test-user',
        changeType: 'add element',
        modifiedProperty: 'specializations',
        previousValue: [],
        newValue: ['new-node-id'],
        reasoning: 'Added relationship',
        fullNode: mockNode,
        changeDetails: {
          relationshipType: 'specializations',
          sourceCollection: 'main'
        }
      }));
    });
  });
});