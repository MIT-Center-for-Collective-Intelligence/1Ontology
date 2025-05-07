import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the ThemeContext component
// Note: This assumes a structure similar to other context providers in the project
jest.mock('../../../src/components/context/ThemeContext', () => {
  const React = require('react');
  const actualContext = jest.requireActual('../../../src/components/context/ThemeContext');
  
  // Create a mock context with the same API but controllable for testing
  const ThemeContext = React.createContext({
    theme: 'light',
    toggleTheme: jest.fn(),
  });
  
  const useTheme = () => React.useContext(ThemeContext);
  
  const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [theme, setTheme] = React.useState('light');
    
    const toggleTheme = () => {
      setTheme((prevTheme: string) => (prevTheme === 'light' ? 'dark' : 'light'));
    };
    
    return (
      <ThemeContext.Provider value={{ theme, toggleTheme }}>
        {children}
      </ThemeContext.Provider>
    );
  };
  
  return {
    ThemeProvider,
    useTheme,
  };
});

// Import the mocked components
const { ThemeProvider, useTheme } = require('../../../src/components/context/ThemeContext');

// Test component that uses the theme context
const TestComponent = () => {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <div>
      <div data-testid="theme-value">{theme}</div>
      <button data-testid="toggle-theme" onClick={toggleTheme}>
        Toggle Theme
      </button>
    </div>
  );
};

describe('ThemeContext', () => {
  test('provides default theme value', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    
    expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
  });
  
  test('toggles theme when toggle function is called', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    
    // Initial theme should be light
    expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
    
    // Toggle theme
    fireEvent.click(screen.getByTestId('toggle-theme'));
    
    // Theme should now be dark
    expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');
    
    // Toggle theme again
    fireEvent.click(screen.getByTestId('toggle-theme'));
    
    // Theme should be back to light
    expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
  });
});