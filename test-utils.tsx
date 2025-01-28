import React from 'react';
import { render } from '@testing-library/react';
import { ThemeProvider } from ' @components/components/context/ThemeContext';
import { AuthProvider } from ' @components/components/context/AuthContext';
import { SnackbarProvider } from 'notistack';

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <SnackbarProvider>
      <ThemeProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </ThemeProvider>
    </SnackbarProvider>
  );
};

const customRender = (ui: React.ReactElement, options = {}) =>
  render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';

export { customRender as render };