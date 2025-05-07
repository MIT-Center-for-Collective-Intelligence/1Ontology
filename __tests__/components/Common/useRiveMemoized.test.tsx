import { renderHook } from '@testing-library/react-hooks';
import { useRiveMemoized } from '../../../src/components/Common/useRiveMemoized';
import React from 'react';

// Mock the Rive library
jest.mock('rive-react', () => {
  return {
    useRive: jest.fn(() => ({
      RiveComponent: jest.fn(),
      rive: {
        play: jest.fn(),
        pause: jest.fn(),
        stop: jest.fn()
      }
    }))
  };
});

describe('useRiveMemoized Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns RiveComponent from useRive', () => {
    const { result } = renderHook(() => useRiveMemoized({
      src: 'test.riv',
      artboard: 'test',
      animations: 'test',
      autoplay: true
    }));
    
    expect(result.current).toHaveProperty('riveComponentMemoized');
    expect(typeof result.current.riveComponentMemoized).toBe('object');
  });

  test('memoizes the result', () => {
    const { result, rerender } = renderHook(() => useRiveMemoized({
      src: 'test.riv',
      artboard: 'test',
      animations: 'test',
      autoplay: true
    }));
    
    const firstResult = result.current;
    
    // Rerender the hook
    rerender();
    
    // Check component type and className
    expect(result.current.riveComponentMemoized.type).toBe('div');
    expect(result.current.riveComponentMemoized.props.children.props.className).toBe('rive-canvas ');
  });
});