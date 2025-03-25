import { getNewAddedProperties } from ' @components/lib/utils/helpers';
import { INode, IInheritance, ICollection } from ' @components/types/INode';

describe('getNewAddedProperties', () => {
  test('should return empty object when no links are provided', () => {
    const addedLinks: { id: string }[] = [];
    const specializationData: INode = {
      id: 'spec1',
      properties: {},
      inheritance: {},
    } as INode;
    const nodes: { [nodeId: string]: INode } = {};

    const result = getNewAddedProperties(addedLinks, specializationData, nodes);

    expect(result).toEqual({});
  });

  test('should return empty object when specializationData is null', () => {
    const addedLinks = [{ id: 'gen1' }];
    const specializationData = null as unknown as INode;
    const nodes: { [nodeId: string]: INode } = {};

    const result = getNewAddedProperties(addedLinks, specializationData, nodes);

    expect(result).toEqual({});
  });

  test('should identify properties that need to be added from generalizations', () => {
    const addedLinks = [{ id: 'gen1' }];
    const specializationData: INode = {
      id: 'spec1',
      properties: {
        existingProp: 'value'
      },
      inheritance: {},
    } as unknown as INode;
    const nodes: { [nodeId: string]: INode } = {
      'gen1': {
        id: 'gen1',
        properties: {
          existingProp: 'should not be added',
          newProp1: 'value1',
          newProp2: 'value2'
        },
        propertyType: {
          existingProp: 'text',
          newProp1: 'text',
          newProp2: 'number'
        },
        inheritance: {}
      } as unknown as INode
    };

    const result = getNewAddedProperties(addedLinks, specializationData, nodes);

    expect(result).toEqual({
      'gen1': [
        {
          propertyName: 'newProp1',
          propertyType: 'text',
          propertyValue: 'value1'
        },
        {
          propertyName: 'newProp2',
          propertyType: 'number',
          propertyValue: 'value2'
        }
      ]
    });
  });

  test('should handle multiple generalizations', () => {
    const addedLinks = [{ id: 'gen1' }, { id: 'gen2' }];
    const specializationData: INode = {
      id: 'spec1',
      properties: {
        existingProp: 'value'
      },
      inheritance: {},
    } as unknown as INode;
    const nodes: { [nodeId: string]: INode } = {
      'gen1': {
        id: 'gen1',
        properties: {
          newProp1: 'value1'
        },
        propertyType: {
          newProp1: 'text'
        },
        inheritance: {}
      } as unknown as INode,
      'gen2': {
        id: 'gen2',
        properties: {
          newProp2: 'value2'
        },
        propertyType: {
          newProp2: 'number'
        },
        inheritance: {}
      } as unknown as INode
    };

    const result = getNewAddedProperties(addedLinks, specializationData, nodes);

    expect(result).toEqual({
      'gen1': [
        {
          propertyName: 'newProp1',
          propertyType: 'text',
          propertyValue: 'value1'
        }
      ],
      'gen2': [
        {
          propertyName: 'newProp2',
          propertyType: 'number',
          propertyValue: 'value2'
        }
      ]
    });
  });

  test('should respect inheritance references when determining property source', () => {
    const addedLinks = [{ id: 'gen1' }];
    const specializationData: INode = {
      id: 'spec1',
      properties: {},
      inheritance: {},
    } as INode;
    const nodes: { [nodeId: string]: INode } = {
      'gen1': {
        id: 'gen1',
        properties: {
          prop1: 'value1',
          prop2: 'value2'
        },
        propertyType: {
          prop1: 'text',
          prop2: 'text'
        },
        inheritance: {
          prop1: { inheritanceType: 'alwaysInherit', ref: 'gen1' },
          prop2: { inheritanceType: 'alwaysInherit', ref: 'original-source' }
        }
      } as unknown as INode,
      'original-source': {
        id: 'original-source',
        properties: {},
        inheritance: {}
      } as INode
    };

    const result = getNewAddedProperties(addedLinks, specializationData, nodes);

    expect(result).toEqual({
      'gen1': [
        {
          propertyName: 'prop1',
          propertyType: 'text',
          propertyValue: 'value1'
        }
      ],
      'original-source': [
        {
          propertyName: 'prop2',
          propertyType: 'text',
          propertyValue: 'value2'
        }
      ]
    });
  });

  test('should handle missing nodes gracefully', () => {
    const addedLinks = [{ id: 'gen1' }, { id: 'missing' }];
    const specializationData: INode = {
      id: 'spec1',
      properties: {},
      inheritance: {},
    } as INode;
    const nodes: { [nodeId: string]: INode } = {
      'gen1': {
        id: 'gen1',
        properties: {
          prop1: 'value1'
        },
        propertyType: {
          prop1: 'text'
        },
        inheritance: {}
      } as unknown as INode
    };

    const result = getNewAddedProperties(addedLinks, specializationData, nodes);

    expect(result).toEqual({
      'gen1': [
        {
          propertyName: 'prop1',
          propertyType: 'text',
          propertyValue: 'value1'
        }
      ]
    });
  });

  test('should handle complex property values', () => {
    const collectionValue: ICollection[] = [
      { collectionName: 'main', nodes: [{ id: 'node1' }] }
    ];
    
    const addedLinks = [{ id: 'gen1' }];
    const specializationData: INode = {
      id: 'spec1',
      properties: {},
      inheritance: {},
    } as INode;
    const nodes: { [nodeId: string]: INode } = {
      'gen1': {
        id: 'gen1',
        properties: {
          simpleValue: 'string',
          numberValue: 42,
          booleanValue: true,
          arrayValue: ['a', 'b', 'c'],
          objectValue: { key: 'value' },
          collectionValue
        },
        propertyType: {
          simpleValue: 'text',
          numberValue: 'number',
          booleanValue: 'boolean',
          arrayValue: 'array',
          objectValue: 'object',
          collectionValue: 'collection'
        },
        inheritance: {}
      } as unknown as INode
    };

    const result = getNewAddedProperties(addedLinks, specializationData, nodes);

    expect(result['gen1']).toHaveLength(6);
    expect(result['gen1'].find((p: { propertyName: string; }) => p.propertyName === 'collectionValue')?.propertyValue).toBe(collectionValue);
    expect(result['gen1'].find((p: { propertyName: string; }) => p.propertyName === 'objectValue')?.propertyValue).toEqual({ key: 'value' });
    expect(result['gen1'].find((p: { propertyName: string; }) => p.propertyName === 'arrayValue')?.propertyValue).toEqual(['a', 'b', 'c']);
  });

  test('should handle error gracefully', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const mockRecordLogs = jest.fn();
    jest.mock(' @components/lib/utils/helpers', () => ({
      ...jest.requireActual(' @components/lib/utils/helpers'),
      recordLogs: mockRecordLogs
    }));

    const addedLinks = [{ id: 'gen1' }];
    const badSpecializationData = {} as INode;
    const nodes = null as unknown as { [nodeId: string]: INode };

    const result = getNewAddedProperties(addedLinks, badSpecializationData, nodes);

    expect(result).toEqual({});
    consoleSpy.mockRestore();
  });
});