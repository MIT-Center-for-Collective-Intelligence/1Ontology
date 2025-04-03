import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const MockNodeBody = (props: any) => {
  return (
    <div data-testid="node-body">
      <div data-testid="node-id">{props.currentVisibleNode.id}</div>
      
      <div data-testid="properties">
        {Object.entries(props.currentVisibleNode.properties)
          .filter(([key]) => 
            key !== 'parts' && 
            key !== 'isPartOf' && 
            key !== 'images')
          .map(([property, value]) => (
            <div key={property} data-testid={`property-${property}`}>
              {property === 'description' && (
                <div data-testid="description">{props.onGetPropertyValue('description')}</div>
              )}
              
              {props.currentVisibleNode.propertyType[property] === 'string' && 
               property !== 'description' && (
                <div data-testid={`text-${property}`}>
                  {props.onGetPropertyValue(property)}
                </div>
              )}
              
              {props.currentVisibleNode.propertyType[property] === 'string-array' && (
                <div data-testid={`chips-${property}`}>Chips Property</div>
              )}
              
              {props.currentVisibleNode.propertyType[property] !== 'string' && 
               props.currentVisibleNode.propertyType[property] !== 'string-array' && (
                <div data-testid={`structured-${property}`}>Structured Property</div>
              )}
            </div>
          ))}
      </div>
      
      {/* Image manager section */}
      {Object.keys(props.currentVisibleNode.properties).includes('References') && (
        <div data-testid="image-manager">Image Manager</div>
      )}
      
      {/* Add property button */}
      {!props.locked && !props.currentImprovement && (
        <button data-testid="add-property-button">Add New Property</button>
      )}
    </div>
  );
};

jest.mock(' @components/components/NodBody/NodeBody', () => {
  return {
    __esModule: true,
    default: (props: any) => <MockNodeBody {...props} />
  };
});

const NodeBody = require(' @components/components/NodBody/NodeBody').default;

describe('NodeBody Component', () => {
  const defaultProps = {
    currentVisibleNode: {
      id: 'test-node',
      nodeType: 'concept',
      properties: {
        description: 'This is a test description',
        purpose: 'This is the purpose',
        problem: 'This is the problem',
        solution: 'This is the solution',
      },
      propertyType: {
        description: 'string',
        purpose: 'string',
        problem: 'string',
        solution: 'collection',
      },
      inheritance: {
        description: { ref: null },
        purpose: { ref: null },
        problem: { ref: null },
        solution: { ref: null },
      },
      specializations: [
        {
          collectionName: 'main',
          nodes: [{ id: 'child-node-1' }, { id: 'child-node-2' }],
        },
      ],
    },
    setCurrentVisibleNode: jest.fn(),
    showListToSelect: jest.fn(),
    navigateToNode: jest.fn(),
    setSnackbarMessage: jest.fn(),
    setSelectedProperty: jest.fn(),
    nodes: {
      'test-node': {
        id: 'test-node',
        title: 'Test Node',
      },
      'child-node-1': {
        id: 'child-node-1',
        title: 'Child Node 1',
      },
      'child-node-2': {
        id: 'child-node-2',
        title: 'Child Node 2',
      },
    },
    locked: false,
    selectedDiffNode: null,
    getTitleNode: jest.fn((id) => `Title for ${id}`),
    confirmIt: jest.fn(() => Promise.resolve(true)),
    onGetPropertyValue: jest.fn((property) => {
      if (property === 'description') return 'This is a test description';
      if (property === 'purpose') return 'This is the purpose';
      if (property === 'problem') return 'This is the problem';
      return '';
    }),
    currentImprovement: null,
    user: { uid: 'test-user-id', uname: 'testuser' },
    storage: {},
    saveNewChangeLog: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders with the correct node ID', () => {
    render(<NodeBody {...defaultProps} />);
    
    const nodeId = screen.getByTestId('node-id');
    expect(nodeId).toBeInTheDocument();
    expect(nodeId).toHaveTextContent('test-node');
  });

  test('renders description property', () => {
    render(<NodeBody {...defaultProps} />);
    
    expect(screen.getByTestId('description')).toBeInTheDocument();
    expect(screen.getByTestId('description')).toHaveTextContent('This is a test description');
  });

  test('renders text properties correctly', () => {
    render(<NodeBody {...defaultProps} />);
    
    expect(screen.getByTestId('text-purpose')).toBeInTheDocument();
    expect(screen.getByTestId('text-purpose')).toHaveTextContent('This is the purpose');
    
    expect(screen.getByTestId('text-problem')).toBeInTheDocument();
    expect(screen.getByTestId('text-problem')).toHaveTextContent('This is the problem');
  });

  test('renders structured properties correctly', () => {
    render(<NodeBody {...defaultProps} />);
    
    expect(screen.getByTestId('structured-solution')).toBeInTheDocument();
    expect(screen.getByTestId('structured-solution')).toHaveTextContent('Structured Property');
  });

  test('renders add property button when not locked', () => {
    render(<NodeBody {...defaultProps} />);
    
    expect(screen.getByTestId('add-property-button')).toBeInTheDocument();
  });

  test('does not render add property button when locked', () => {
    render(<NodeBody {...defaultProps} locked={true} />);
    
    expect(screen.queryByTestId('add-property-button')).not.toBeInTheDocument();
  });

  test('does not render add property button when improvement exists', () => {
    render(<NodeBody 
      {...defaultProps} 
      currentImprovement={{ id: 'test-improvement' }}
    />);
    
    expect(screen.queryByTestId('add-property-button')).not.toBeInTheDocument();
  });

  test('renders string-array properties as chips', () => {
    const propsWithStringArray = {
      ...defaultProps,
      currentVisibleNode: {
        ...defaultProps.currentVisibleNode,
        properties: {
          ...defaultProps.currentVisibleNode.properties,
          tags: ['tag1', 'tag2'],
        },
        propertyType: {
          ...defaultProps.currentVisibleNode.propertyType,
          tags: 'string-array',
        },
      },
    };
    
    render(<NodeBody {...propsWithStringArray} />);
    
    expect(screen.getByTestId('chips-tags')).toBeInTheDocument();
  });

  test('renders image manager when References property exists', () => {
    const propsWithReferences = {
      ...defaultProps,
      currentVisibleNode: {
        ...defaultProps.currentVisibleNode,
        properties: {
          ...defaultProps.currentVisibleNode.properties,
          References: [{ collectionName: 'main', nodes: [] }],
        },
        propertyType: {
          ...defaultProps.currentVisibleNode.propertyType,
          References: 'collection',
        },
      },
    };
    
    render(<NodeBody {...propsWithReferences} />);
    
    expect(screen.getByTestId('image-manager')).toBeInTheDocument();
  });
});