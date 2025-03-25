import { getDoerCreate, extractJSON, removeNodeFromLinks, randomProminentColor } from ' @components/lib/utils/helpers';
import { INode } from ' @components/types/INode'; jest.mock('firebase/firestore', () => ({
  getDoc: jest.fn(),
  doc: jest.fn(),
  collection: jest.fn(),
  writeBatch: jest.fn(),
  updateDoc: jest.fn(),
  setDoc: jest.fn(),
  increment: jest.fn(),
  arrayUnion: jest.fn(),
  deleteField: jest.fn()
})); jest.mock(' @components/lib/utils/helpers', () => {
  const originalModule = jest.requireActual(' @components/lib/utils/helpers'); const { removeNodeFromLinks, randomProminentColor, getDoerCreate, extractJSON, ...rest } = originalModule; return {
    ...rest,
    removeNodeFromLinks,
    randomProminentColor,
    getDoerCreate,
    extractJSON, saveNewChangeLog: jest.fn()
  };
}); describe('Utility Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  }); describe('getDoerCreate', () => {
    test('should format timestamp with username correctly', () => {
      const mockDate = new Date(2023, 0, 15, 10, 30, 45);
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any); const result = getDoerCreate('testUser'); expect(result).toBe('testUser-2023-01-15-10-30-45');
    }); test('should handle empty username', () => {
      const mockDate = new Date(2023, 0, 15, 10, 30, 45);
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any); const result = getDoerCreate(''); expect(result).toBe('-2023-01-15-10-30-45');
    });
  }); describe('extractJSON', () => {
    test('should extract valid JSON from text', () => {
      const text = 'Some text before {"key": "value", "number": 123} and after'; const result = extractJSON(text); expect(result).toEqual({
        jsonObject: { key: 'value', number: 123 },
        isJSON: true
      });
    }); test('should return empty object when no JSON is found', () => {
      const text = 'Text with no valid JSON'; const result = extractJSON(text); expect(result).toEqual({
        jsonObject: {},
        isJSON: false
      });
    }); test('should handle invalid JSON', () => {
      const text = 'Text with invalid JSON {key: value}'; const result = extractJSON(text); expect(result).toEqual({
        jsonObject: {},
        isJSON: false
      });
    }); test('should extract nested JSON correctly', () => {
      const text = 'Nested JSON {"outer": {"inner": "value"}}'; const result = extractJSON(text); expect(result).toEqual({
        jsonObject: { outer: { inner: 'value' } },
        isJSON: true
      });
    });
  }); describe('removeNodeFromLinks', () => {
    test('should remove node from specializations', () => {
      const linkNodeData: Partial<INode> = {
        specializations: [
          {
            collectionName: 'main',
            nodes: [{ id: 'node-to-remove' }, { id: 'other-node' }]
          }
        ]
      } as INode; const result = removeNodeFromLinks(linkNodeData as INode, 'node-to-remove', 'specializations'); expect(result.specializations[0].nodes.length).toBe(1);
      expect(result.specializations[0].nodes[0].id).toBe('other-node');
    }); test('should remove node from generalizations', () => {
      const linkNodeData: Partial<INode> = {
        generalizations: [
          {
            collectionName: 'main',
            nodes: [{ id: 'node-to-remove' }, { id: 'other-node' }]
          }
        ]
      } as INode; const result = removeNodeFromLinks(linkNodeData as INode, 'node-to-remove', 'generalizations'); expect(result.generalizations[0].nodes.length).toBe(1);
      expect(result.generalizations[0].nodes[0].id).toBe('other-node');
    }); test('should remove node from property in properties object', () => {
      const linkNodeData: Partial<INode> = {
        properties: {
          parts: [
            {
              collectionName: 'main',
              nodes: [{ id: 'node-to-remove' }, { id: 'other-node' }]
            }
          ]
        }
      } as INode; const result = removeNodeFromLinks(linkNodeData as INode, 'node-to-remove', 'parts'); expect(result.properties.parts[0].nodes.length).toBe(1);
      expect(result.properties.parts[0].nodes[0].id).toBe('other-node');
    }); test('should handle node not found in collection', () => {
      const linkNodeData: Partial<INode> = {
        specializations: [
          {
            collectionName: 'main',
            nodes: [{ id: 'existing-node' }]
          }
        ]
      } as INode; const result = removeNodeFromLinks(linkNodeData as INode, 'non-existent-node', 'specializations'); expect(result.specializations[0].nodes.length).toBe(1);
      expect(result.specializations[0].nodes[0].id).toBe('existing-node');
    }); test('should process all collections in the property', () => {
      const linkNodeData: Partial<INode> = {
        specializations: [
          {
            collectionName: 'main',
            nodes: [{ id: 'node-to-remove' }, { id: 'other-node-1' }]
          },
          {
            collectionName: 'secondary',
            nodes: [{ id: 'node-to-remove' }, { id: 'other-node-2' }]
          }
        ]
      } as INode; const result = removeNodeFromLinks(linkNodeData as INode, 'node-to-remove', 'specializations'); expect(result.specializations[0].nodes.length).toBe(1);
      expect(result.specializations[0].nodes[0].id).toBe('other-node-1');
      expect(result.specializations[1].nodes.length).toBe(1);
      expect(result.specializations[1].nodes[0].id).toBe('other-node-2');
    });
  }); describe('randomProminentColor', () => {
    beforeEach(() => {
      jest.spyOn(Math, 'random').mockReturnValue(0.3);
    }); test('should return a color from the predefined list', () => {
      const result = randomProminentColor();
      expect(result).toBe("#33DBFF");
      expect(result).toMatch(/^#[0-9A-F]{6}$/i);
    }); test('should return different colors based on random values', () => {
      const firstColor = randomProminentColor();
      (Math.random as jest.Mock).mockReturnValue(0.7);
      const secondColor = randomProminentColor(); expect(firstColor).not.toBe(secondColor);
      expect(secondColor).toBe("#FF33BD");
    });
  }); describe('fetchAndUpdateNode', () => {
    const {
      getDoc,
      doc,
      collection,
      writeBatch,
      setDoc,
      updateDoc,
      increment,
      arrayUnion
    } = require('firebase/firestore');
    const {
      fetchAndUpdateNode,
      saveNewChangeLog,
      removeNodeFromLinks
    } = require(' @components/lib/utils/helpers'); let mockDb: any;
    let mockBatch: any; beforeEach(() => {
      jest.clearAllMocks();
      mockBatch = {
        update: jest.fn().mockReturnThis(),
        commit: jest.fn().mockResolvedValue(undefined),
        _mutations: [],
        _committed: false
      };
      mockDb = {};
      collection.mockReturnValue('nodes-collection');
      doc.mockReturnValue({ id: 'mock-doc-ref', ref: 'mock-doc-ref' });
      writeBatch.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        commit: jest.fn().mockResolvedValue(undefined),
        _mutations: [],
        _committed: false
      });
      setDoc.mockResolvedValue(undefined);
      updateDoc.mockResolvedValue(undefined);
      increment.mockReturnValue(1);
      arrayUnion.mockImplementation((value: any) => [`arrayUnion:${value}`]);
    }); test('should update a node by removing a link when node exists', async () => {
      const linkId = 'link-id';
      const nodeId = 'node-to-remove';
      const removeFromProperty = 'specializations';
      const username = 'testUser';
      const mockNodeData = {
        id: linkId,
        specializations: [
          {
            collectionName: 'main',
            nodes: [{ id: nodeId }, { id: 'other-node' }]
          }
        ]
      };
      jest.spyOn(require(' @components/lib/utils/helpers'), 'removeNodeFromLinks');
      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockNodeData,
        ref: { id: linkId }
      });
      const result = await fetchAndUpdateNode(
        mockDb,
        linkId,
        nodeId,
        removeFromProperty,
        username,
        mockBatch
      );
      expect(doc).toHaveBeenCalled();
      expect(collection).toHaveBeenCalled();
      expect(getDoc).toHaveBeenCalled();
      expect(mockBatch.update).toHaveBeenCalled();
      expect(result).toBe(mockBatch);
    }); test('should handle when node does not exist', async () => {
      const linkId = 'non-existent-link';
      const nodeId = 'node-to-remove';
      const removeFromProperty = 'specializations';
      const username = 'testUser';
      getDoc.mockResolvedValue({
        exists: () => false
      });
      const result = await fetchAndUpdateNode(
        mockDb,
        linkId,
        nodeId,
        removeFromProperty,
        username,
        mockBatch
      );
      expect(doc).toHaveBeenCalled();
      expect(collection).toHaveBeenCalled();
      expect(getDoc).toHaveBeenCalled();
      expect(mockBatch.update).not.toHaveBeenCalled();
      expect(saveNewChangeLog).not.toHaveBeenCalled();
      expect(result).toBe(mockBatch);
    }); test('should create a new batch if the current one is committed', async () => {
      const linkId = 'link-id';
      const nodeId = 'node-to-remove';
      const removeFromProperty = 'specializations';
      const username = 'testUser';
      mockBatch._committed = true;
      const mockNodeData = {
        id: linkId,
        specializations: [
          {
            collectionName: 'main',
            nodes: [{ id: nodeId }, { id: 'other-node' }]
          }
        ]
      };
      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockNodeData,
        ref: { id: linkId }
      });
      const result = await fetchAndUpdateNode(
        mockDb,
        linkId,
        nodeId,
        removeFromProperty,
        username,
        mockBatch
      );
      expect(writeBatch).toHaveBeenCalled();
      expect(result).not.toBe(mockBatch);
    }); test('should commit batch and create a new one if mutations exceed 400', async () => {
      const linkId = 'link-id';
      const nodeId = 'node-to-remove';
      const removeFromProperty = 'specializations';
      const username = 'testUser';
      mockBatch._mutations = new Array(401).fill('mutation');
      const mockNodeData = {
        id: linkId,
        specializations: [
          {
            collectionName: 'main',
            nodes: [{ id: nodeId }, { id: 'other-node' }]
          }
        ]
      }; getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockNodeData,
        ref: { id: linkId }
      });
      await fetchAndUpdateNode(
        mockDb,
        linkId,
        nodeId,
        removeFromProperty,
        username,
        mockBatch
      );
      expect(mockBatch.commit).toHaveBeenCalled();
      expect(writeBatch).toHaveBeenCalled();
    }); test('should handle properties in node.properties object', async () => {
      const linkId = 'link-id';
      const nodeId = 'node-to-remove';
      const removeFromProperty = 'parts';
      const username = 'testUser';
      const mockNodeData = {
        id: linkId,
        properties: {
          parts: [
            {
              collectionName: 'main',
              nodes: [{ id: nodeId }, { id: 'other-node' }]
            }
          ]
        }
      };
      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockNodeData,
        ref: { id: linkId }
      });
      const result = await fetchAndUpdateNode(
        mockDb,
        linkId,
        nodeId,
        removeFromProperty,
        username,
        mockBatch
      );
      expect(result).toBe(mockBatch);
    });
  });
});