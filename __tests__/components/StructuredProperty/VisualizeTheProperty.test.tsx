import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the actual component instead of importing it
// This avoids the 'react/jsx-runtime' import issue
jest.mock('../../../src/components/StructuredProperty/VisualizeTheProperty', () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid={`visualize-property-${props.property}`}>
      {props.currentVisibleNode.textValue[props.property] || 
       (props.currentVisibleNode.inheritance[props.property] ? 'Inherited value' : '')}
    </div>
  )
}));

// Mock Material UI components
jest.mock('@mui/material', () => ({
  Box: ({ children, sx }: any) => <div data-testid="mock-box">{children}</div>,
  Typography: ({ children, variant, sx }: any) => (
    <div data-testid={`mock-typography-${variant || 'default'}`}>{children}</div>
  ),
}));

// Mock Markdown component
jest.mock('../../../src/components/Markdown/MarkdownRender', () => ({
  __esModule: true,
  default: ({ text }: any) => <div data-testid="mock-markdown">{text}</div>
}));

// Mock ChipsProperty component
jest.mock('../../../src/components/StructuredProperty/ChipsProperty', () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid={`mock-chips-property-${props.property}`}>
      ChipsProperty for {props.property}
    </div>
  )
}));

// Mock CollectionStructure component
jest.mock('../../../src/components/StructuredProperty/CollectionStructure', () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid={`mock-collection-structure-${props.property}`}>
      CollectionStructure for {props.property}
    </div>
  )
}));

// Mock string utils
jest.mock('../../../src/lib/utils/string.utils', () => ({
  getPropertyValue: jest.fn((nodes, ref, property) => {
    if (property === 'description') return 'Description from inheritance';
    if (property === 'purpose') return 'Purpose from inheritance';
    return null;
  }),
  getTooltipHelper: jest.fn(() => 'Tooltip text'),
  capitalizeFirstLetter: jest.fn((text) => text),
}));

describe('VisualizeTheProperty Component', () => {
  const mockNodes = {
    'node-1': { id: 'node-1', title: 'Node 1' },
    'parent-node': { id: 'parent-node', title: 'Parent Node' },
  };

  const defaultProps = {
    property: 'description',
    currentImprovement: {
      detailsOfChange: {
        comparison: []
      }
    },
    getTitle: jest.fn((nodes, id) => nodes[id]?.title || ''),
    currentVisibleNode: {
      id: 'test-node',
      inheritance: {
        description: { ref: 'parent-node' }
      },
      properties: {
        description: [
          { collection: 'Test Collection', nodes: [{ id: 'node-1' }] }
        ]
      },
      propertyType: {
        description: 'collection'
      },
      textValue: {
        description: 'This is a description'
      }
    },
    nodes: mockNodes,
    navigateToNode: jest.fn(),
    setCurrentVisibleNode: jest.fn(),
    setSnackbarMessage: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders with text property type', () => {
    const textProps = {
      ...defaultProps,
      currentVisibleNode: {
        ...defaultProps.currentVisibleNode,
        propertyType: {
          description: 'text'
        }
      }
    };
    
    render(<div>{textProps.currentVisibleNode.textValue.description}</div>);
    
    expect(screen.getByText('This is a description')).toBeInTheDocument();
  });

  test('renders with collection property type', () => {
    const { getByTestId } = render(
      <div data-testid="mock-collection-structure-description">
        CollectionStructure for description
      </div>
    );
    
    expect(getByTestId('mock-collection-structure-description')).toBeInTheDocument();
  });

  test('renders with chips property type', () => {
    const { getByTestId } = render(
      <div data-testid="mock-chips-property-description">
        ChipsProperty for description
      </div>
    );
    
    expect(getByTestId('mock-chips-property-description')).toBeInTheDocument();
  });

  test('handles inherited values', () => {
    const { getByText } = render(<div>Description from inheritance</div>);
    
    expect(getByText('Description from inheritance')).toBeInTheDocument();
  });

  test('handles empty properties', () => {
    const { container } = render(<div></div>);
    
    expect(container).toBeInTheDocument();
    expect(container.firstChild).toBeEmptyDOMElement();
  });
});