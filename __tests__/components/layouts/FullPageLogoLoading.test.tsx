import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FullPageLogoLoading from '../../../src/components/layouts/FullPageLogoLoading';

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, width, height }: any) => (
    <img 
      src={src} 
      alt={alt} 
      width={width} 
      height={height} 
      data-testid="mock-image"
    />
  ),
}));

describe('FullPageLogoLoading Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders the component', () => {
    const { container } = render(<FullPageLogoLoading />);
    expect(container).toBeInTheDocument();
  });

  test('renders the logo image', () => {
    render(<FullPageLogoLoading />);
    const logoImage = screen.getByTestId('mock-image');
    expect(logoImage).toBeInTheDocument();
    expect(logoImage).toHaveAttribute('alt', 'logo');
    expect(logoImage).toHaveAttribute('width', '250');
    expect(logoImage).toHaveAttribute('height', '250');
  });

  test('applies correct layout styles', () => {
    const { container } = render(<FullPageLogoLoading />);
    
    // Check for the main container with full viewport dimensions
    const mainContainer = container.firstChild;
    expect(mainContainer).toHaveStyle({
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    });
    
    // Check for the inner container with centered content
    const innerContainer = container.firstChild?.firstChild;
    expect(innerContainer).toHaveStyle({
      display: 'flex',
      flexDirection: 'column',
      textAlign: 'center',
      justifyContent: 'center',
      alignItems: 'center'
    });
  });
});