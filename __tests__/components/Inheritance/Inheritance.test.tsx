import React from 'react';
import { render, screen } from '@testing-library/react';
import Inheritance from ' @components/components/Inheritance/Inheritance';
import '@testing-library/jest-dom';

const mockUpdateDoc = jest.fn((docRef: any, data: any) => Promise.resolve());
const mockBatch = {
  _mutations: [],
  _committed: false,
  update: jest.fn(),
  commit: jest.fn(() => Promise.resolve()),
};

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => 'mocked-doc-ref'),
  collection: jest.fn(() => 'mocked-collection'),
  updateDoc: (docRef: any, data: any) => mockUpdateDoc(docRef, data),
  getFirestore: jest.fn(() => ({ collection: jest.fn() })),
  writeBatch: jest.fn(() => mockBatch),
}));

jest.mock('@mui/material', () => ({
  FormControl: ({ children, component, disabled }: any) => (
    <div data-testid="mock-form-control" data-disabled={disabled ? "true" : "false"}>
      {children}
    </div>
  ),
  FormLabel: ({ children }: any) => <label>{children}</label>,
  RadioGroup: ({ children, value, onChange }: any) => (
    <div data-testid="mock-radio-group" data-value={value}>
      {children}
    </div>
  ),
  FormControlLabel: ({ control, label, value }: any) => (
    <label data-testid={`radio-option-${value}`} data-value={value}>
      {control}
      <span>{label}</span>
    </label>
  ),
  Radio: ({ onChange }: any) => <input type="radio" data-testid="mock-radio" />,
  Box: ({ children, sx }: any) => <div data-testid="mock-box">{children}</div>,
  Typography: ({ children, sx }: any) => <span data-testid="mock-typography">{children}</span>,
  Paper: ({ children, sx }: any) => <div data-testid="mock-paper">{children}</div>,
}));

jest.mock(' @components/lib/firestoreClient/collections', () => ({
  NODES: 'nodes',
}));

jest.mock(' @components/lib/CONSTANTS', () => ({
  DISPLAY: {
    'test-property': 'Test Property',
    'another-property': 'Another Property'
  },
  SCROLL_BAR_STYLE: {}
}));

jest.mock(' @components/lib/utils/string.utils', () => ({
  capitalizeFirstLetter: jest.fn((str) => str.charAt(0).toUpperCase() + str.slice(1)),
}));

jest.mock(' @components/components/context/AuthContext', () => ({
  useAuth: jest.fn(() => [{
    user: { manageLock: true }
  }])
}));

describe('Inheritance Component', () => {
  const mockSelectedNode = {
    id: 'node-1',
    title: 'Test Node',
    deleted: false,
    inheritance: {
      'test-property': { 
        inheritanceType: 'alwaysInherit' as const,
        ref: 'parent-node'
      },
      'another-property': {
        inheritanceType: 'neverInherit' as const,
        ref: null
      }
    },
    specializations: [
      {
        collectionName: 'main',
        nodes: [
          { id: 'child-node-1' },
          { id: 'child-node-2' }
        ]
      }
    ],
    generalizations: [
      {
        collectionName: 'main',
        nodes: []
      }
    ],
    properties: {
      'test-property': 'test value',
      'another-property': 'another value',
      parts: [],
      isPartOf: []
    },
    root: 'root-node',
    propertyType: {},
    nodeType: 'activity' as const,
    textValue: {},
    createdBy: 'test-user'
  };

  const mockNodes = {
    'node-1': mockSelectedNode,
    'child-node-1': {
      id: 'child-node-1',
      title: 'Child Node 1',
      deleted: false,
      inheritance: {
        'test-property': { 
          inheritanceType: 'alwaysInherit' as const,
          ref: 'node-1'
        },
        'another-property': {
          inheritanceType: 'neverInherit' as const,
          ref: null
        }
      },
      specializations: [
        {
          collectionName: 'main',
          nodes: [
            { id: 'grandchild-node-1' }
          ]
        }
      ],
      generalizations: [
        {
          collectionName: 'main',
          nodes: [
            { id: 'node-1' }
          ]
        }
      ],
      properties: {
        'test-property': 'inherited value',
        'another-property': 'child value',
        parts: [],
        isPartOf: []
      },
      root: 'root-node',
      propertyType: {},
      nodeType: 'activity' as const,
      textValue: {},
      createdBy: 'test-user'
    },
    'child-node-2': {
      id: 'child-node-2',
      title: 'Child Node 2',
      deleted: false,
      inheritance: {
        'test-property': { 
          inheritanceType: 'alwaysInherit' as const,
          ref: 'node-1'
        },
        'another-property': {
          inheritanceType: 'inheritUnlessAlreadyOverRidden' as const,
          ref: 'node-1'
        }
      },
      specializations: [],
      generalizations: [
        {
          collectionName: 'main',
          nodes: [
            { id: 'node-1' }
          ]
        }
      ],
      properties: {
        'test-property': 'inherited value 2',
        'another-property': 'child value 2',
        parts: [],
        isPartOf: []
      },
      root: 'root-node',
      propertyType: {},
      nodeType: 'activity' as const,
      textValue: {},
      createdBy: 'test-user'
    },
    'grandchild-node-1': {
      id: 'grandchild-node-1',
      title: 'Grandchild Node 1',
      deleted: false,
      inheritance: {
        'test-property': { 
          inheritanceType: 'alwaysInherit' as const,
          ref: 'child-node-1'
        },
        'another-property': {
          inheritanceType: 'neverInherit' as const,
          ref: null
        }
      },
      specializations: [],
      generalizations: [
        {
          collectionName: 'main',
          nodes: [
            { id: 'child-node-1' }
          ]
        }
      ],
      properties: {
        'test-property': 'grandchild value',
        'another-property': 'grandchild another value',
        parts: [],
        isPartOf: []
      },
      root: 'root-node',
      propertyType: {},
      nodeType: 'activity' as const,
      textValue: {},
      createdBy: 'test-user'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateDoc.mockClear();
    mockBatch.update.mockClear();
    mockBatch.commit.mockClear();
  });

  test('renders with correct inheritance types', async () => {
    render(
      <Inheritance
        selectedNode={mockSelectedNode}
        nodes={mockNodes}
      />
    );
    
    const propertyNames = screen.getAllByTestId('mock-typography');
    
    expect(propertyNames.some(element => element.textContent === 'Test Property')).toBe(true);
    expect(propertyNames.some(element => element.textContent === 'Another Property')).toBe(true);
    
    expect(screen.getAllByTestId('radio-option-neverInherit').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('radio-option-alwaysInherit').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('radio-option-inheritUnlessAlreadyOverRidden').length).toBeGreaterThan(0);
  });

  test('disables form controls when user does not have manage lock permission', () => {
    const { useAuth } = require(' @components/components/context/AuthContext');
    useAuth.mockReturnValue([{ user: { manageLock: false } }]);
    
    render(
      <Inheritance
        selectedNode={mockSelectedNode}
        nodes={mockNodes}
      />
    );
    
    const formControls = screen.getAllByTestId('mock-form-control');
    formControls.forEach(control => {
      expect(control).toHaveAttribute('data-disabled', 'true');
    });
  });

  test('renders multiple properties from inheritance', () => {
    render(
      <Inheritance
        selectedNode={mockSelectedNode}
        nodes={mockNodes}
      />
    );
    
    const papers = screen.getAllByTestId('mock-paper');
    expect(papers.length).toBe(Object.keys(mockSelectedNode.inheritance).length);
    
    const radioGroups = screen.getAllByTestId('mock-radio-group');
    
    const testPropertyGroup = radioGroups.find(group => {
      const parent = group.parentElement;
      const grandparent = parent?.parentElement;
      const greatGrandparent = grandparent?.parentElement;
      return greatGrandparent?.textContent?.includes('Test Property');
    });
    expect(testPropertyGroup).toHaveAttribute('data-value', 'alwaysInherit');
    
    const anotherPropertyGroup = radioGroups.find(group => {
      const parent = group.parentElement;
      const grandparent = parent?.parentElement;
      const greatGrandparent = grandparent?.parentElement;
      return greatGrandparent?.textContent?.includes('Another Property');
    });
    expect(anotherPropertyGroup).toHaveAttribute('data-value', 'neverInherit');
  });
  
  test('updates display when selected node changes', () => {
    const { rerender } = render(
      <Inheritance
        selectedNode={mockSelectedNode}
        nodes={mockNodes}
      />
    );
    
    const newSelectedNode = {
      ...mockSelectedNode,
      inheritance: {
        'test-property': { 
          inheritanceType: 'inheritUnlessAlreadyOverRidden' as const,
          ref: 'parent-node'
        },
        'another-property': {
          inheritanceType: 'alwaysInherit' as const,
          ref: 'parent-node'
        }
      }
    };
    
    rerender(
      <Inheritance
        selectedNode={newSelectedNode}
        nodes={mockNodes}
      />
    );
    
    const radioGroups = screen.getAllByTestId('mock-radio-group');
    
    const values = radioGroups.map(group => group.getAttribute('data-value'));
    expect(values).toContain('inheritUnlessAlreadyOverRidden');
    expect(values).toContain('alwaysInherit');
    
    const testPropertyGroup = radioGroups.find(group => {
      const parent = group.parentElement;
      const grandparent = parent?.parentElement;
      const greatGrandparent = grandparent?.parentElement;
      return greatGrandparent?.textContent?.includes('Test Property');
    });
    expect(testPropertyGroup).toHaveAttribute('data-value', 'inheritUnlessAlreadyOverRidden');
    
    const anotherPropertyGroup = radioGroups.find(group => {
      const parent = group.parentElement;
      const grandparent = parent?.parentElement;
      const greatGrandparent = grandparent?.parentElement;
      return greatGrandparent?.textContent?.includes('Another Property');
    });
    expect(anotherPropertyGroup).toHaveAttribute('data-value', 'alwaysInherit');
  });
});