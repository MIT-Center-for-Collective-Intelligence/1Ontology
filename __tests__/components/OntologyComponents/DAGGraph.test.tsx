import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DAGGraph from '../../../src/components/OntologyComponents/DAGGraph';

interface D3Selection {
  attr: (name: string, value?: any) => D3Selection;
  on: (event: string, callback?: any) => D3Selection;
  call: (fn: any) => D3Selection;
  remove: () => D3Selection;
  selectAll: (selector: string) => D3Selection;
  append: (name: string) => D3Selection;
  select: (selector: string) => D3Selection;
  empty: () => boolean;
  transition: () => {
    duration: (ms: number) => D3Selection;
  };
  node: () => {
    getBBox: () => { width: number; height: number };
  };
}

const mockD3Selection: D3Selection = {
  attr: jest.fn(() => mockD3Selection),
  on: jest.fn(() => mockD3Selection),
  call: jest.fn(() => mockD3Selection),
  remove: jest.fn(() => mockD3Selection),
  selectAll: jest.fn(() => mockD3Selection),
  append: jest.fn(() => mockD3Selection),
  select: jest.fn(() => mockD3Selection),
  empty: jest.fn(() => false),
  transition: jest.fn(() => ({
    duration: jest.fn(() => mockD3Selection),
  })),
  node: jest.fn(() => ({
    getBBox: jest.fn(() => ({ width: 100, height: 50 })),
  })),
};

jest.mock('d3', () => ({
  select: jest.fn(() => mockD3Selection),
  curveBasis: 'curveBasis',
  zoomIdentity: {
    translate: jest.fn(() => ({
      scale: jest.fn(),
    })),
  },
  zoom: jest.fn(() => ({
    on: jest.fn(() => 'zoom'),
    transform: jest.fn(),
  })),
}));

jest.mock('dagre-d3', () => ({
  graphlib: {
    Graph: jest.fn(() => ({
      setGraph: jest.fn(() => ({
        setNode: jest.fn(),
        setEdge: jest.fn(),
        hasNode: jest.fn(() => false),
        node: jest.fn(() => ({
          dataAttr: { 'data-node-id': 'node-1' },
          x: 100,
          y: 100,
        })),
        graph: jest.fn(() => ({
          width: 500,
          height: 300,
        })),
      })),
    })),
  },
  render: jest.fn(() => jest.fn()),
}));

describe('DAGGraph Component', () => {
  const mockTreeVisualization = {
    'node-1': {
      id: 'node-1',
      title: 'Node 1',
      isCategory: false,
      path: ['node-1'],
      specializations: {
        'node-2': {
          id: 'node-2',
          title: 'Node 2',
          isCategory: false,
          path: ['node-1', 'node-2'],
          specializations: {},
        },
      },
      generalizations: [],
    },
  };

  const defaultProps = {
    treeVisualization: mockTreeVisualization,
    expandedNodes: new Set(['node-1']),
    setExpandedNodes: jest.fn(),
    onOpenNodeDagre: jest.fn(),
    currentVisibleNode: { id: 'node-1', title: 'Node 1' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock window.innerWidth and window.innerHeight
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
    
    // Mock SVG element
    global.SVGGraphicsElement = class {
      getBBox() {
        return { width: 100, height: 50, x: 0, y: 0 };
      }
    } as any;
  });

  test('renders svg element', () => {
    render(<DAGGraph {...defaultProps} />);
    
    const svgElement = document.getElementById('graphGroup');
    expect(svgElement).toBeInTheDocument();
    expect(svgElement?.tagName).toBe('svg');
  });

  test('updates graph when treeVisualization changes', () => {
    const { rerender } = render(<DAGGraph {...defaultProps} />);
    
    // Update with new tree visualization
    const updatedTreeVisualization = {
      ...mockTreeVisualization,
      'node-3': {
        id: 'node-3',
        title: 'Node 3',
        isCategory: true,
        path: ['node-3'],
        specializations: {},
        generalizations: [],
      },
    };
    
    rerender(
      <DAGGraph 
        {...defaultProps} 
        treeVisualization={updatedTreeVisualization} 
      />
    );
    
    // The d3.select should be called again for the new rendering
    expect(require('d3').select).toHaveBeenCalledTimes(12);
  });

  test('updates graph when expandedNodes changes', () => {
    const { rerender } = render(<DAGGraph {...defaultProps} />);
    
    // Update with new expanded nodes
    const newExpandedNodes = new Set(['node-1', 'node-2']);
    
    rerender(
      <DAGGraph 
        {...defaultProps} 
        expandedNodes={newExpandedNodes} 
      />
    );
    
    // The d3.select should be called again for the new rendering
    expect(require('d3').select).toHaveBeenCalledTimes(11);
  });

  test('focuses on currentVisibleNode when it changes', () => {
    const { rerender } = render(<DAGGraph {...defaultProps} />);
    
    // Update with new current visible node
    const newCurrentVisibleNode = { id: 'node-2', title: 'Node 2' };
    
    rerender(
      <DAGGraph 
        {...defaultProps} 
        currentVisibleNode={newCurrentVisibleNode} 
      />
    );
    
    // The zoom transition should be triggered
    const d3 = require('d3');
    expect(d3.select().transition).toHaveBeenCalled();
  });
});