import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import VisualizationToggle from '../../../src/components/VisualizationToggle/VisualizationToggle';
import { ThemeProvider, createTheme } from '@mui/material';

describe('VisualizationToggle Component', () => {
  const theme = createTheme();
  const setVisualizationModeMock = jest.fn();

  beforeEach(() => {
    setVisualizationModeMock.mockClear();
  });

  it('renders with specializations/generalizations mode selected', () => {
    render(
      <ThemeProvider theme={theme}>
        <VisualizationToggle 
          visualizationMode="specializations/generalizations" 
          setVisualizationMode={setVisualizationModeMock} 
        />
      </ThemeProvider>
    );
    
    // Check that both text options are rendered
    expect(screen.getByText('Specializations/Generalizations')).toBeInTheDocument();
    expect(screen.getByText('Parts/Is Part Of')).toBeInTheDocument();
    
    // Check that the switch is not checked in specializations mode
    const switchElement = screen.getByRole('checkbox');
    expect(switchElement).not.toBeChecked();
    
    // Verify the highlighted text (orange color)
    const specText = screen.getByText('Specializations/Generalizations');
    expect(specText).toHaveStyle('color: #ff6d00');
    
    const partsText = screen.getByText('Parts/Is Part Of');
    expect(partsText).not.toHaveStyle('color: #ff6d00');
  });

  it('renders with Parts/IsPartOf mode selected', () => {
    render(
      <ThemeProvider theme={theme}>
        <VisualizationToggle 
          visualizationMode="Parts/IsPartOf" 
          setVisualizationMode={setVisualizationModeMock} 
        />
      </ThemeProvider>
    );
    
    // Check that the switch is checked in parts mode
    const switchElement = screen.getByRole('checkbox');
    expect(switchElement).toBeChecked();
    
    // Verify the highlighted text (orange color)
    const specText = screen.getByText('Specializations/Generalizations');
    expect(specText).not.toHaveStyle('color: #ff6d00');
    
    const partsText = screen.getByText('Parts/Is Part Of');
    expect(partsText).toHaveStyle('color: #ff6d00');
  });

  it('toggles from specializations to parts mode when switch is clicked', () => {
    render(
      <ThemeProvider theme={theme}>
        <VisualizationToggle 
          visualizationMode="specializations/generalizations" 
          setVisualizationMode={setVisualizationModeMock} 
        />
      </ThemeProvider>
    );
    
    const switchElement = screen.getByRole('checkbox');
    fireEvent.click(switchElement);
    
    expect(setVisualizationModeMock).toHaveBeenCalledWith('Parts/IsPartOf');
  });

  it('toggles from parts to specializations mode when switch is clicked', () => {
    render(
      <ThemeProvider theme={theme}>
        <VisualizationToggle 
          visualizationMode="Parts/IsPartOf" 
          setVisualizationMode={setVisualizationModeMock} 
        />
      </ThemeProvider>
    );
    
    const switchElement = screen.getByRole('checkbox');
    fireEvent.click(switchElement);
    
    expect(setVisualizationModeMock).toHaveBeenCalledWith('specializations/generalizations');
  });
});