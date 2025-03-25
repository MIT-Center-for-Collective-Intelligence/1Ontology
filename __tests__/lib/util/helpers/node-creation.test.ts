import { createNewNode, generateInheritance, checkIfCanDeleteANode } from ' @components/lib/utils/helpers';
import { IInheritance, INode, INodeTypes } from ' @components/types/INode';

const mockParentNode: INode = {
  id: 'parent-node-id',
  title: 'Parent Node',
  deleted: false,
  inheritance: {
    property1: { inheritanceType: 'alwaysInherit', ref: null },
    property2: { inheritanceType: 'inheritUnlessAlreadyOverRidden', ref: 'some-ref' },
    isPartOf: { inheritanceType: 'neverInherit', ref: null }
  },
  specializations: [
    { collectionName: 'main', nodes: [] }
  ],
  generalizations: [
    { collectionName: 'main', nodes: [{ id: 'grand-parent-id' }] }
  ],
  properties: {
    property1: 'value1',
    property2: 'value2',
    isPartOf: [{ collectionName: 'main', nodes: [] }],
    parts: [{ collectionName: 'main', nodes: [] }]
  },
  propertyType: {
    property1: 'string',
    property2: 'number'
  },
  nodeType: 'activity',
  textValue: {
    specializations: 'should be removed',
    generalizations: 'should be removed',
    property3: 'should remain'
  },
  root: 'root-node-id',
  numberOfGeneralizations: 1,
  propertyOf: {},
  locked: false,
  createdBy: 'original-creator'
};

describe('createNewNode', () => {
  test('should create a node with basic properties from parent', () => {
    // Arrange
    const newNodeId = 'new-node-id';
    const newTitle = 'New Node Title';
    const inheritance: IInheritance = { ...mockParentNode.inheritance };
    const generalizationId = 'parent-node-id';
    const username = 'test-user';

    // Act
    const result = createNewNode(
      mockParentNode,
      newNodeId,
      newTitle,
      inheritance,
      generalizationId,
      username
    );

    // Assert
    expect(result).toMatchObject({
      id: newNodeId,
      title: newTitle,
      createdBy: username,
      nodeType: mockParentNode.nodeType,
      inheritance
    });
  });

  test('should set up correct generalization relationship', () => {
    // Arrange
    const newNodeId = 'new-node-id';
    const generalizationId = 'parent-id';

    // Act
    const result = createNewNode(
      mockParentNode,
      newNodeId,
      'New Node',
      {},
      generalizationId,
      'user'
    );

    // Assert
    expect(result.generalizations).toEqual([
      {
        collectionName: 'main',
        nodes: [{ id: generalizationId }]
      }
    ]);
  });

  test('should initialize empty specializations', () => {
    // Act
    const result = createNewNode(
      mockParentNode,
      'new-id',
      'New Node',
      {} as IInheritance,
      'parent-id',
      'user'
    );

    // Assert
    expect(result.specializations).toEqual([
      {
        collectionName: 'main',
        nodes: []
      }
    ]);
  });

  test('should remove textValue.specializations and textValue.generalizations', () => {
    // Act
    const result = createNewNode(
      mockParentNode,
      'new-id',
      'New Node',
      {},
      'parent-id',
      'user'
    );

    // Assert
    expect(result.textValue?.specializations).toBeUndefined();
    expect(result.textValue?.generalizations).toBeUndefined();
    expect(result.textValue?.property3).toBe('should remain');
  });

  test('should remove ONetID if present', () => {
    // Arrange
    const parentWithONetID: INode = {
      ...mockParentNode,
      properties: {
        ...mockParentNode.properties,
        ONetID: '12.3456'
      },
      propertyType: {
        ...mockParentNode.propertyType,
        ONetID: 'string'
      }
    };

    // Act
    const result = createNewNode(
      parentWithONetID,
      'new-id',
      'New Node',
      {} as IInheritance,
      'parent-id',
      'user'
    );

    // Assert
    expect(result.properties.ONetID).toBeUndefined();
    expect(result.propertyType.ONetID).toBeUndefined();
  });
  
  test('should increment numberOfGeneralizations from parent', () => {
    // Act
    const result = createNewNode(
      mockParentNode,
      'new-id',
      'New Node',
      {},
      'parent-id',
      'user'
    );

    // Assert
    expect(result.numberOfGeneralizations).toBe((mockParentNode.numberOfGeneralizations ?? 0) + 1);
  });

  test('should handle parent with undefined values', () => {
    // Arrange
    const incompleteParent = {
      ...mockParentNode,
      root: undefined,
      numberOfGeneralizations: undefined
    } as unknown as INode;

    // Act
    const result = createNewNode(
      incompleteParent,
      'new-id',
      'New Node',
      {},
      'parent-id',
      'user'
    );

    // Assert
    expect(result.root).toBe('');
    expect(result.numberOfGeneralizations).toBe(1); // 0 + 1
  });
});

describe('generateInheritance', () => {
  test('should set null references to currentNodeId', () => {
    // Arrange
    const inheritance: IInheritance = {
      property1: { inheritanceType: 'alwaysInherit', ref: null },
      property2: { inheritanceType: 'inheritUnlessAlreadyOverRidden', ref: null },
      property3: { inheritanceType: 'neverInherit', ref: null }
    };
    const currentNodeId = 'node-123';

    // Act
    const result = generateInheritance(inheritance, currentNodeId);

    // Assert
    expect(result).toEqual({
      property1: { inheritanceType: 'alwaysInherit', ref: currentNodeId },
      property2: { inheritanceType: 'inheritUnlessAlreadyOverRidden', ref: currentNodeId },
      property3: { inheritanceType: 'neverInherit', ref: currentNodeId }
    });
  });

  test('should preserve existing references', () => {
    // Arrange
    const inheritance: IInheritance = {
      property1: { inheritanceType: 'alwaysInherit', ref: 'existing-ref-1' },
      property2: { inheritanceType: 'inheritUnlessAlreadyOverRidden', ref: null },
      property3: { inheritanceType: 'neverInherit', ref: 'existing-ref-2' }
    };
    const currentNodeId = 'node-123';

    // Act
    const result = generateInheritance(inheritance, currentNodeId);

    // Assert
    expect(result).toEqual({
      property1: { inheritanceType: 'alwaysInherit', ref: 'existing-ref-1' },
      property2: { inheritanceType: 'inheritUnlessAlreadyOverRidden', ref: currentNodeId },
      property3: { inheritanceType: 'neverInherit', ref: 'existing-ref-2' }
    });
  });

  test('should not modify isPartOf references even if null', () => {
    // Arrange
    const inheritance: IInheritance = {
      property1: { inheritanceType: 'alwaysInherit', ref: null },
      isPartOf: { inheritanceType: 'neverInherit', ref: null }
    };
    const currentNodeId = 'node-123';

    // Act
    const result = generateInheritance(inheritance, currentNodeId);

    // Assert
    expect(result).toEqual({
      property1: { inheritanceType: 'alwaysInherit', ref: currentNodeId },
      isPartOf: { inheritanceType: 'neverInherit', ref: null }
    });
  });

  test('should handle empty inheritance object', () => {
    // Arrange
    const inheritance: IInheritance = {};
    const currentNodeId = 'node-123';

    // Act
    const result = generateInheritance(inheritance, currentNodeId);

    // Assert
    expect(result).toEqual({});
  });

  test('should create a new object without modifying the original', () => {
    // Arrange
    const inheritance: IInheritance = {
      property1: { inheritanceType: 'alwaysInherit', ref: null }
    };
    const currentNodeId = 'node-123';

    // Act
    const result = generateInheritance(inheritance, currentNodeId);
    
    // Assert
    expect(result).not.toBe(inheritance); // Should be a new object reference
    expect(inheritance.property1.ref).toBeNull(); // Original should be unchanged
    expect(result.property1.ref).toBe(currentNodeId);
  });

  test('should handle mixed inheritance types correctly', () => {
    // Arrange
    const inheritance: IInheritance = {
      always: { inheritanceType: 'alwaysInherit', ref: null },
      unless: { inheritanceType: 'inheritUnlessAlreadyOverRidden', ref: null },
      never: { inheritanceType: 'neverInherit', ref: null }
    };
    const currentNodeId = 'node-123';

    // Act
    const result = generateInheritance(inheritance, currentNodeId);

    // Assert
    expect(result.always.ref).toBe(currentNodeId);
    expect(result.unless.ref).toBe(currentNodeId);
    expect(result.never.ref).toBe(currentNodeId);
  });
});

describe('checkIfCanDeleteANode', () => {
  test('should return true if a specialization has only one generalization', () => {
    // Arrange
    const nodes: { [nodeId: string]: INode } = {
      'node1': {
        id: 'node1',
        generalizations: [{ collectionName: 'main', nodes: [{ id: 'parent1' }] }]
      } as INode
    };
    
    const specializations = [{ id: 'node1' }];

    // Act
    const result = checkIfCanDeleteANode(nodes, specializations);

    // Assert
    expect(result).toBe(true);
  });

  test('should return false if all specializations have multiple generalizations', () => {
    // Arrange
    const nodes: { [nodeId: string]: INode } = {
      'node1': {
        id: 'node1',
        generalizations: [
          { 
            collectionName: 'main', 
            nodes: [
              { id: 'parent1' },
              { id: 'parent2' }
            ] 
          }
        ]
      } as INode
    };
    
    const specializations = [{ id: 'node1' }];

    // Act
    const result = checkIfCanDeleteANode(nodes, specializations);

    // Assert
    expect(result).toBe(false);
  });

  test('should handle multiple specializations and return true if any has a single generalization', () => {
    // Arrange
    const nodes: { [nodeId: string]: INode } = {
      'node1': {
        id: 'node1',
        generalizations: [
          { 
            collectionName: 'main', 
            nodes: [
              { id: 'parent1' },
              { id: 'parent2' }
            ] 
          }
        ]
      } as INode,
      'node2': {
        id: 'node2',
        generalizations: [
          { 
            collectionName: 'main', 
            nodes: [
              { id: 'parent1' }
            ] 
          }
        ]
      } as INode
    };
    
    const specializations = [{ id: 'node1' }, { id: 'node2' }];

    // Act
    const result = checkIfCanDeleteANode(nodes, specializations);

    // Assert
    expect(result).toBe(true);
  });

  test('should handle specializations across multiple collections', () => {
    // Arrange
    const nodes: { [nodeId: string]: INode } = {
      'node1': {
        id: 'node1',
        generalizations: [
          { 
            collectionName: 'main', 
            nodes: [
              { id: 'parent1' }
            ] 
          },
          { 
            collectionName: 'secondary', 
            nodes: [
              { id: 'parent2' }
            ] 
          }
        ]
      } as INode
    };
    
    const specializations = [{ id: 'node1' }];

    // Act
    const result = checkIfCanDeleteANode(nodes, specializations);

    // Assert
    expect(result).toBe(false); // Multiple generalizations across collections
  });

  test('should handle empty generalizations array', () => {
    // Arrange
    const nodes: { [nodeId: string]: INode } = {
      'node1': {
        id: 'node1',
        generalizations: []
      } as unknown as INode
    };
    
    const specializations = [{ id: 'node1' }];

    // Act
    const result = checkIfCanDeleteANode(nodes, specializations);

    // Assert
    expect(result).toBe(false); // No generalizations at all
  });

  test('should handle missing node in nodes dictionary', () => {
    // Arrange
    const nodes: { [nodeId: string]: INode } = {};
    
    const specializations = [{ id: 'node1' }];

    // Act
    const result = checkIfCanDeleteANode(nodes, specializations);

    // Assert
    expect(result).toBe(false); // Node not found in dictionary
  });

  test('should handle undefined generalizations property', () => {
    // Arrange
    const nodes: { [nodeId: string]: INode } = {
      'node1': {
        id: 'node1'
        // generalizations property intentionally missing
      } as INode
    };
    
    const specializations = [{ id: 'node1' }];

    // Act
    const result = checkIfCanDeleteANode(nodes, specializations);

    // Assert
    expect(result).toBe(false);
  });
});