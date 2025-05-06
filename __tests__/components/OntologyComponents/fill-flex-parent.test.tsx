import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FillFlexParent } from '../../../src/components/OntologyComponents/fill-flex-parent';

// Mock the useResizeObserver hook
jest.mock('use-resize-observer', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    ref: jest.fn(),
    width: 100,
    height: 200,
  })),
}));

describe('FillFlexParent Component', () => {
  test('renders children with width and height', () => {
    const childrenFn = jest.fn().mockReturnValue(<div>Test Content</div>);
    
    const { getByText } = render(
      <FillFlexParent>
        {childrenFn}
      </FillFlexParent>
    );
    
    expect(getByText('Test Content')).toBeInTheDocument();
    expect(childrenFn).toHaveBeenCalledWith({ width: 100, height: 200 });
  });

  test('applies correct style to container', () => {
    const { container } = render(
      <FillFlexParent>
        {() => <div>Test Content</div>}
      </FillFlexParent>
    );
    
    const divElement = container.firstChild as HTMLElement;
    
    expect(divElement).toHaveStyle({
      flex: 1,
      width: '100%',
      height: '100%',
      minHeight: 0,
      minWidth: 0,
    });
  });

  test('forwards ref to container element', () => {
    const ref = React.createRef<HTMLDivElement>();
    
    render(
      <FillFlexParent ref={ref}>
        {() => <div>Test Content</div>}
      </FillFlexParent>
    );
    
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe('DIV');
  });

  test('does not render children when dimensions are not available', () => {
    // Override the mock for this specific test
    const useResizeObserverMock = require('use-resize-observer').default;
    useResizeObserverMock.mockImplementationOnce(() => ({
      ref: jest.fn(),
      width: null,
      height: null,
    }));
    
    const childrenFn = jest.fn().mockReturnValue(<div>Test Content</div>);
    
    const { queryByText } = render(
      <FillFlexParent>
        {childrenFn}
      </FillFlexParent>
    );
    
    expect(queryByText('Test Content')).not.toBeInTheDocument();
    expect(childrenFn).not.toHaveBeenCalled();
  });
});