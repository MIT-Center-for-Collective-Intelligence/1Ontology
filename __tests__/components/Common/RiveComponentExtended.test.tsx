import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RiveComponentMemoized, RiveProps } from '../../../src/components/Common/RiveComponentExtended';

// Mock the useRive hook
jest.mock('rive-react', () => ({
  useRive: jest.fn(({ src, animations, autoplay }) => ({
    RiveComponent: () => (
      <div data-testid="mock-rive-component" data-src={src}>
        {animations && <span data-testid="animations">{Array.isArray(animations) ? animations.join(',') : animations}</span>}
        <span data-testid="autoplay">{autoplay ? 'autoplay' : 'no-autoplay'}</span>
      </div>
    ),
    rive: null
  }))
}));

// Mock the Box component
jest.mock('@mui/material', () => ({
  Box: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IconButton: () => null,
  Tooltip: () => null
}));

describe('RiveComponentMemoized', () => {
  const defaultProps = {
    src: 'test-animation.riv',
    animations: ['test-animation'],
    autoplay: true,
    artboard: 'default'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders with default props', () => {
    render(<RiveComponentMemoized {...defaultProps} />);
    
    const riveComponent = screen.getByTestId('mock-rive-component');
    expect(riveComponent).toBeInTheDocument();
    expect(riveComponent).toHaveAttribute('data-src', 'test-animation.riv');
    
    const animations = screen.getByTestId('animations');
    expect(animations).toHaveTextContent('test-animation');
    
    const autoplay = screen.getByTestId('autoplay');
    expect(autoplay).toHaveTextContent('autoplay');
  });

  test('renders with multiple animations', () => {
    const multipleAnimations = {
      ...defaultProps,
      animations: ['animation1', 'animation2', 'animation3']
    };
    
    render(<RiveComponentMemoized {...multipleAnimations} />);
    
    const animations = screen.getByTestId('animations');
    expect(animations).toHaveTextContent('animation1,animation2,animation3');
  });

  test('renders with autoplay disabled', () => {
    const noAutoplay = {
      ...defaultProps,
      autoplay: false
    };
    
    render(<RiveComponentMemoized {...noAutoplay} />);
    
    const autoplay = screen.getByTestId('autoplay');
    expect(autoplay).toHaveTextContent('no-autoplay');
  });
});