import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChipsProperty from '../../../src/components/StructuredProperty/ChipsProperty';
import '@testing-library/jest-dom';
import { INode } from ' @components/types/INode';

// Mock dependencies
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'nodes-collection'),
  doc: jest.fn(() => 'node-doc-ref'),
  getFirestore: jest.fn(() => ({})),
  updateDoc: jest.fn(() => Promise.resolve()),
}));

// Mock ChipInput component
jest.mock('../../../src/components/ChipInput/ChipInput', () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="mock-chip-input">
      {props.tags.map((tag: any, index: any) => (
        <div key={index} data-testid="mock-chip">
          {tag}
        </div>
      ))}
      <input
        data-testid="mock-chip-input-field"
        placeholder={props.placeholder}
        disabled={props.readOnly}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.target as HTMLInputElement).value) {
            const inputElement = e.target as HTMLInputElement;
            props.updateTags(
              [...props.tags, inputElement.value], 
              [inputElement.value], 
              []
            );
            inputElement.value = '';
          }
        }}
      />
    </div>
  ),
}));

// Mock SelectInheritance component
jest.mock('../../../src/components/SelectInheritance/SelectInheritance', () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="mock-select-inheritance">
      Select Inheritance
    </div>
  ),
}));

// Mock PropertyContributors component
jest.mock('../../../src/components/StructuredProperty/PropertyContributors', () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="mock-property-contributors">
      Property Contributors
    </div>
  ),
}));

// Mock helper functions
jest.mock('../../../src/lib/utils/string.utils', () => ({
  capitalizeFirstLetter: jest.fn((text) => text.charAt(0).toUpperCase() + text.slice(1)),
  getPropertyValue: jest.fn((nodes, ref, property) => {
    if (ref && nodes[ref] && nodes[ref].properties && nodes[ref].properties[property]) {
      return nodes[ref].properties[property];
    }
    return [];
  }),
  getTooltipHelper: jest.fn((property) => `Tooltip for ${property}`),
}));

jest.mock('../../../src/lib/utils/helpers', () => ({
  saveNewChangeLog: jest.fn(),
  updateInheritance: jest.fn(() => Promise.resolve()),
}));

// Mock constants
jest.mock('../../../src/lib/CONSTANTS', () => ({
  DISPLAY: {
    category: 'Category',
    tags: 'Tags',
  },
}));

jest.mock('../../../src/lib/firestoreClient/collections', () => ({
  NODES: 'nodes',
}));

describe('ChipsProperty Component', () => {
  const mockUser = { uname: 'testuser' };
  
  const mockNode = {
    id: 'node-1',
    properties: {
      category: ['Science', 'Technology'],
      tags: ['AI', 'Machine Learning'],
    },
    inheritance: {
      category: { ref: null },
      tags: { ref: null },
    },
    unclassified: false,
  } as unknown as INode;
  
  const mockNodes: { [id: string]: INode }  = {
    'node-1': mockNode,
    'node-2': {
      id: 'node-2',
      properties: {
        category: ['Math', 'Science'],
        tags: ['Education', 'Learning'],
      },
      inheritance: {},
    } as unknown as INode,
  };
  
  const defaultProps = {
    currentVisibleNode: mockNode,
    property: 'category',
    nodes: mockNodes,
    selectedDiffNode: null,
    locked: false,
    currentImprovement: null,
    user: mockUser,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders with correct property name and values', () => {
    render(<ChipsProperty {...defaultProps} />);
    
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Science')).toBeInTheDocument();
    expect(screen.getByText('Technology')).toBeInTheDocument();
  });

  test('renders SelectInheritance when not in improvement or unclassified mode', () => {
    render(<ChipsProperty {...defaultProps} />);
    
    expect(screen.getByTestId('mock-select-inheritance')).toBeInTheDocument();
  });

  test('does not render SelectInheritance in improvement mode', () => {
    render(
      <ChipsProperty 
        {...defaultProps} 
        currentImprovement={{ 
          modifiedProperty: 'category',
          detailsOfChange: { 
            newValue: ['Science', 'Technology'], 
            removedElements: [] 
          } 
        }} 
      />
    );
    
    expect(screen.queryByTestId('mock-select-inheritance')).not.toBeInTheDocument();
  });

  test('does not render SelectInheritance for unclassified node', () => {
    render(
      <ChipsProperty 
        {...defaultProps} 
        currentVisibleNode={{ ...mockNode, unclassified: true }}
      />
    );
    
    expect(screen.queryByTestId('mock-select-inheritance')).not.toBeInTheDocument();
  });

  test('renders PropertyContributors component', () => {
    render(<ChipsProperty {...defaultProps} />);
    
    expect(screen.getByTestId('mock-property-contributors')).toBeInTheDocument();
  });

  test('renders chips with correct readonly state in normal mode', () => {
    render(<ChipsProperty {...defaultProps} />);
    
    expect(screen.getByTestId('mock-chip-input-field')).not.toBeDisabled();
  });

  test('renders chips in readonly mode when viewing diff', () => {
    render(
      <ChipsProperty 
        {...defaultProps} 
        selectedDiffNode={{ 
          modifiedProperty: 'category',
          newValue: ['Science', 'Technology', 'Math'],
          previousValue: ['Science', 'Technology'],
          changeDetails: { 
            addedElements: ['Math'], 
            removedElements: [] 
          }
        }} 
      />
    );
    
    expect(screen.getByTestId('mock-chip-input-field')).toBeDisabled();
  });

  test('handles adding a new tag when allowed', async () => {
    const { updateDoc } = require('firebase/firestore');
    const { saveNewChangeLog } = require('../../../src/lib/utils/helpers');
    
    render(<ChipsProperty {...defaultProps} />);
    
    const input = screen.getByTestId('mock-chip-input-field');
    fireEvent.change(input, { target: { value: 'Engineering' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    await waitFor(() => {
      expect(updateDoc).toHaveBeenCalled();
      expect(saveNewChangeLog).toHaveBeenCalled();
    });
  });

  test('does not update when in improvement mode', async () => {
    const { updateDoc } = require('firebase/firestore');
    const { saveNewChangeLog } = require('../../../src/lib/utils/helpers');
    
    render(
      <ChipsProperty 
        {...defaultProps} 
        currentImprovement={{ 
          modifiedProperty: 'category',
          detailsOfChange: { 
            newValue: ['Science', 'Technology'], 
            removedElements: [] 
          } 
        }} 
      />
    );
    
    const input = screen.getByTestId('mock-chip-input-field');
    fireEvent.change(input, { target: { value: 'Engineering' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    await waitFor(() => {
      expect(updateDoc).not.toHaveBeenCalled();
      expect(saveNewChangeLog).not.toHaveBeenCalled();
    });
  });

  test('uses property values from inheritance when ref is present', () => {
    const { getPropertyValue } = require('../../../src/lib/utils/string.utils');
    
    render(
      <ChipsProperty 
        {...defaultProps} 
        currentVisibleNode={{
          ...mockNode,
          properties: {
            ...mockNode.properties,
            category: [],
          },
          inheritance: {
            ...mockNode.inheritance,
            category: {
              ref: 'node-2',
              inheritanceType: 'neverInherit'
            },
          },
        }} 
      />
    );
    
    expect(getPropertyValue).toHaveBeenCalledWith(
      mockNodes,
      'node-2',
      'category'
    );
  });

  test('handles selected diff node correctly', () => {
    render(
      <ChipsProperty 
        {...defaultProps} 
        selectedDiffNode={{ 
          modifiedProperty: 'category',
          newValue: ['Science', 'Technology', 'Math'],
          previousValue: ['Science', 'Technology'],
          changeDetails: { 
            addedElements: ['Math'], 
            removedElements: [] 
          },
          changeType: 'modify property' 
        }} 
      />
    );
    
    // When viewing the diff with addedElements, it should show the new value
    expect(screen.getByText('Math')).toBeInTheDocument();
  });

  test('handles selected diff node with removedElements correctly', () => {
    render(
      <ChipsProperty 
        {...defaultProps} 
        selectedDiffNode={{ 
          modifiedProperty: 'category',
          newValue: ['Technology'],
          previousValue: ['Science', 'Technology'],
          changeDetails: { 
            addedElements: [], 
            removedElements: ['Science'] 
          },
          changeType: 'modify property' 
        }} 
      />
    );
    
    // When viewing the diff with removedElements, it should show the previous value
    expect(screen.getByText('Science')).toBeInTheDocument();
    expect(screen.getByText('Technology')).toBeInTheDocument();
  });
});