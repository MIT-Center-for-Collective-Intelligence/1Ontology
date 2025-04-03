import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SelectInheritance from ' @components/components/SelectInheritance/SelectInheritance';
import '@testing-library/jest-dom';

const mockUpdateDoc = jest.fn(() => Promise.resolve());
const mockBatch = {
  _mutations: [],
  _committed: false,
  update: jest.fn(),
  commit: jest.fn(() => Promise.resolve()),
};

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => 'mocked-doc-ref'),
  collection: jest.fn(() => 'mocked-collection'),
  updateDoc: (...args: any) => mockUpdateDoc(...args),
  getFirestore: jest.fn(() => ({ collection: jest.fn() })),
  writeBatch: jest.fn(() => mockBatch),
}));

jest.mock('@mui/material', () => ({
  TextField: ({ value, onChange, select, label, children }: any) => (
    <div data-testid="mock-text-field">
      <label>{label}</label>
      <select
        data-testid="inheritance-select"
        value={value}
        onChange={(e) => onChange(e)}
      >
        {children}
      </select>
    </div>
  ),
  MenuItem: ({ value, disabled, children }: any) => (
    <option value={value || ''} disabled={disabled} data-testid={`option-${value}`}>
      {children}
    </option>
  ),
  Box: ({ children }: any) => <div data-testid="mock-box">{children}</div>,
}));

jest.mock(' @components/lib/firestoreClient/collections', () => ({
  NODES: 'nodes',
}));

jest.mock(' @components/lib/utils/helpers', () => ({
  recordLogs: jest.fn(),
}));

jest.mock(' @components/lib/utils/string.utils', () => ({
  getTitle: jest.fn((nodes, id) => {
    if (id === 'node-1') return 'Node 1';
    if (id === 'node-2') return 'Node 2';
    if (id === 'node-3') return 'Node 3';
    if (id === 'inheritance-overridden') return 'Inheritance Overridden';
    return `Title for ${id}`;
  }),
}));

const originalConsoleError = console.error;

describe('SelectInheritance Component', () => {
  const mockNodes = {
    'current-node': {
      id: 'current-node',
      inheritance: {
        'test-property': { ref: 'node-1' },
      },
      generalizations: [
        {
          nodes: [
            { id: 'node-1' },
            { id: 'node-2' },
          ],
        },
      ],
      specializations: [
        {
          nodes: [
            { id: 'spec-1' },
            { id: 'spec-2' },
          ],
        },
      ],
    },
    'node-1': {
      id: 'node-1',
      inheritance: {
        'test-property': { ref: 'node-3' },
      },
      specializations: [],
      generalizations: [],
    },
    'node-2': {
      id: 'node-2',
      inheritance: {
        'test-property': { ref: 'inheritance-overridden' },
      },
      specializations: [],
      generalizations: [],
    },
    'node-3': {
      id: 'node-3',
      inheritance: {
        'test-property': { ref: '' },
      },
      specializations: [],
      generalizations: [],
    },
    'spec-1': {
      id: 'spec-1',
      inheritance: {
        'test-property': { ref: 'current-node' },
      },
      specializations: [],
      generalizations: [],
    },
    'spec-2': {
      id: 'spec-2',
      inheritance: {
        'test-property': { ref: 'node-2' },
      },
      specializations: [],
      generalizations: [],
    },
    'inheritance-overridden': {
      id: 'inheritance-overridden',
      inheritance: {
        'test-property': { ref: '' },
      },
      specializations: [],
      generalizations: [],
    },
  };

  const mockCurrentNode = mockNodes['current-node'];
  const mockProperty = 'test-property';

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateDoc.mockClear();
    mockBatch.update.mockClear();
    mockBatch.commit.mockClear();
    console.error = jest.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  test('renders with correct inheritance reference value', () => {
    render(
      <SelectInheritance
        currentVisibleNode={mockCurrentNode}
        property={mockProperty}
        nodes={mockNodes}
      />
    );
    
    const selectElement = screen.getByTestId('inheritance-select');
    expect(selectElement).toHaveValue('node-1');
  });

  test('changes inheritance when new option is selected', async () => {
    const modifiedNodes = {
      ...mockNodes,
      'node-2': {
        ...mockNodes['node-2'],
        inheritance: {
          'test-property': { ref: '' },
        },
      },
    };
    
    render(
      <SelectInheritance
        currentVisibleNode={mockCurrentNode}
        property={mockProperty}
        nodes={modifiedNodes}
      />
    );
    
    const selectElement = screen.getByTestId('inheritance-select');
    
    fireEvent.change(selectElement, { target: { value: 'node-2' } });
    
    await waitFor(() => {
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'mocked-doc-ref', 
        { 'inheritance.test-property.ref': 'node-2' }
      );
    });
    
    await waitFor(() => {
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  test('follows inheritance chain when needed', async () => {
    const nodesWithChain = {
      ...mockNodes,
      'node-2': {
        ...mockNodes['node-2'],
        inheritance: {
          'test-property': { ref: 'node-3' },
        },
      },
    };
    
    render(
      <SelectInheritance
        currentVisibleNode={mockCurrentNode}
        property={mockProperty}
        nodes={nodesWithChain}
      />
    );
    
    const selectElement = screen.getByTestId('inheritance-select');
    
    fireEvent.change(selectElement, { target: { value: 'node-2' } });
    
    await waitFor(() => {
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'mocked-doc-ref', 
        { 'inheritance.test-property.ref': 'node-3' }
      );
    });
  });

  test('handles errors during inheritance update', async () => {
    const modifiedNodes = {
      ...mockNodes,
      'node-2': {
        ...mockNodes['node-2'],
        inheritance: {
          'test-property': { ref: '' },
        },
      },
    };
    
    mockUpdateDoc.mockRejectedValueOnce(new Error('Update failed'));
    
    render(
      <SelectInheritance
        currentVisibleNode={mockCurrentNode}
        property={mockProperty}
        nodes={modifiedNodes}
      />
    );
    
    const selectElement = screen.getByTestId('inheritance-select');
    
    fireEvent.change(selectElement, { target: { value: 'node-2' } });
    
    await waitFor(() => {
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'mocked-doc-ref', 
        { 'inheritance.test-property.ref': 'node-2' }
      );
    });
    
    await waitFor(() => {
      expect(console.error).toHaveBeenCalled();
    });
  });

  test('handles exceptions during update', async () => {
    const { recordLogs } = require(' @components/lib/utils/helpers');
    
    const mockedUpdateDoc = jest.fn(() => {
      throw new Error('Test error');
    });
    
    const originalUpdateDoc = mockUpdateDoc;
    mockUpdateDoc.mockImplementationOnce(mockedUpdateDoc);
    
    render(
      <SelectInheritance
        currentVisibleNode={mockCurrentNode}
        property={mockProperty}
        nodes={mockNodes}
      />
    );
    
    const selectElement = screen.getByTestId('inheritance-select');
    
    fireEvent.change(selectElement, { target: { value: 'node-2' } });
    
    await waitFor(() => {
      expect(recordLogs).toHaveBeenCalled();
    });
    
    mockUpdateDoc.mockImplementation(originalUpdateDoc);
  });
});