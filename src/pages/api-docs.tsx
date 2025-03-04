// pages/api-docs.tsx
import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import type { GetStaticProps, NextPage } from 'next';
import { Box, useTheme } from '@mui/material';
import ApiAuthDashboard from ' @components/components/ApiAuthDashboard/ApiAuthDashboard';
import { OpenAPIGenerator } from ' @components/lib/utils/openApiGenerator';
import path from 'path';
import useThemeChange from ' @components/lib/hooks/useThemeChange';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'rapi-doc': {
        id?: string;
        theme?: string;
        'bg-color'?: string;
        'text-color'?: string;
        'render-style'?: string;
        'show-header'?: string;
        'primary-color'?: string;
        'nav-bg-color'?: string;
        'nav-text-color'?: string;
        'nav-hover-bg-color'?: string;
        'nav-hover-text-color'?: string;
        'nav-accent-color'?: string;
        'allow-authentication'?: string;
        'allow-server-selection'?: string;
        'allow-search'?: string;
        'regular-font'?: string;
        'mono-font'?: string;
        'schema-style'?: string;
        'schema-description-expanded'?: string;
        'default-schema-tab'?: string;
        'response-area-bg-color'?: string;
        'header-color'?: string;
        'font-size'?: string;
        children?: any;
      };
    }
  }
}

interface ApiDocsProps {
  spec: any;
}

export const getStaticProps: GetStaticProps<ApiDocsProps> = async () => {
  try {
    const generator = new OpenAPIGenerator(
      path.join(process.cwd(), 'src/pages/api')
    );

    const spec = await generator.generateSpec();

    return {
      props: {
        spec
      }
    };
  } catch (error) {
    console.error('Error in getStaticProps:', error);
    return {
      props: {
        spec: null
      }
    };
  }
};

const ApiDocs = ({ spec }: ApiDocsProps) => {
  const theme = useTheme();
  const [handleThemeSwitch] = useThemeChange();

  // Custom themes to match your app
  const themes = {
    dark: {
      bgColor: '#1E1E1E',
      textColor: '#E4E4E4',
      primaryColor: '#F97316',
      navBgColor: '#252525',
      navTextColor: '#D1D1D1',
      navHoverBgColor: '#333333',
      navHoverTextColor: '#FFFFFF',
      navAccentColor: '#F97316',
      headerColor: '#F97316',
      responseAreaBgColor: '#252525',
      borderColor: '#333333',
    },
    light: {
      bgColor: '#F9FAFB',
      textColor: '#1F2937',
      primaryColor: '#F97316',
      navBgColor: '#FFFFFF',
      navTextColor: '#4B5563',
      navHoverBgColor: '#F9FAFB',
      navHoverTextColor: '#111827',
      navAccentColor: '#F97316',
      headerColor: '#F97316',
      responseAreaBgColor: '#FFFFFF',
      borderColor: '#E5E7EB',
    }
  };

  const currentTheme = theme.palette.mode === "dark" ? themes.dark : themes.light;

  useEffect(() => {
    const rapidocElement = document.getElementById('rapidoc-element');
    if (rapidocElement) {
      // @ts-ignore
      rapidocElement.loadSpec(spec);
    }
  }, [spec]);

  // if (error) {
  //   return (
  //     <Box sx={{ p: 4, color: 'error.main' }}>
  //       <h1>Error Loading API Documentation</h1>
  //       <p>{error}</p>
  //     </Box>
  //   );
  // }

  return (
    <>
      <Head>
        <title>API Documentation</title>
        <script src="https://unpkg.com/rapidoc/dist/rapidoc-min.js"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Fira+Code&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
      </Head>

      <div className="docs-container">
        <button
          onClick={handleThemeSwitch}
          className="theme-toggle"
          aria-label="Toggle theme"
        >
          <span className="material-icons">
            {theme.palette.mode === "dark" ? 'light_mode' : 'dark_mode'}
          </span>
        </button>

        <Box sx={{ 
          p: 3, 
          bgcolor: theme.palette.background.default,
          borderBottom: 1,
          borderColor: 'divider'
        }}>
          <ApiAuthDashboard />
        </Box>

        <rapi-doc
          id="rapidoc-element"
          theme={theme.palette.mode === "dark" ? 'dark' : 'light'}
          bg-color={currentTheme.bgColor}
          text-color={currentTheme.textColor}
          primary-color={currentTheme.primaryColor}
          render-style="focused"
          show-header="false"
          nav-bg-color={currentTheme.navBgColor}
          nav-text-color={currentTheme.navTextColor}
          nav-hover-bg-color={currentTheme.navHoverBgColor}
          nav-hover-text-color={currentTheme.navHoverTextColor}
          nav-accent-color={currentTheme.navAccentColor}
          nav-item-spacing="compact"
          header-color={currentTheme.headerColor}
          allow-authentication="true"
          allow-server-selection="true"
          allow-search="true"
          regular-font="Inter"
          mono-font="Fira Code"
          schema-style="table"
          schema-description-expanded="true"
          default-schema-tab="example"
          response-area-bg-color={currentTheme.responseAreaBgColor}
          font-size="large"
        >
          <div slot='footer'
            style={{
              padding: theme.spacing(3),
              borderTop: `1px solid ${theme.palette.divider}`
            }}>
            {/* <ApiAuthDashboard /> */}
          </div>
        </rapi-doc>
      </div>

      <style jsx global>{`
        body {
          margin: 0;
          padding: 0;
          background-color: ${currentTheme.bgColor};
          font-family: 'Inter', sans-serif;
        }

        .docs-container {
          width: 100%;
          height: 100vh;
          position: relative;
        }

        .theme-toggle {
          position: fixed;
          top: 1rem;
          right: 1rem;
          z-index: 1000;
          background-color: ${theme.palette.mode === "dark" ? '#333333' : '#FFFFFF'};
          border: 1px solid ${currentTheme.borderColor};
          border-radius: 8px;
          padding: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .theme-toggle:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .theme-toggle .material-icons {
          color: ${theme.palette.mode === "dark" ? '#F97316' : '#F97316'};
          font-size: 24px;
        }

        rapi-doc {
          width: 100%;
          height: 100vh;
        }

        /* Override RapiDoc default styles */
        rapi-doc::part(section-endpoint) {
          border-radius: 8px;
          margin: 1rem 0;
          border: 1px solid ${currentTheme.borderColor};
          background-color: ${currentTheme.navBgColor};
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        rapi-doc::part(section-navbar) {
          border-right: 1px solid ${currentTheme.borderColor};
        }

        // rapi-doc::part(section-operation-tag) {
        //   padding: 1rem;
        //   margin: 1rem 0;
        //   border-radius: 8px;
        //   background-color: ${currentTheme.navBgColor};
        //   box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        // }

        rapi-doc::part(section-operation) {
          padding: 1rem;
          margin: 0.5rem 0;
          border-radius: 8px;
        }

        rapi-doc::part(api-server) {
          border-radius: 8px;
          border: 1px solid ${currentTheme.borderColor};
          background-color: ${currentTheme.navBgColor};
        }

        rapi-doc::part(button) {
          background-color: ${currentTheme.primaryColor};
          border-radius: 6px;
          border: none;
          padding: 8px 16px;
          transition: opacity 0.2s ease;
        }

        rapi-doc::part(button):hover {
          opacity: 0.9;
        }

        rapi-doc::part(textarea) {
          background-color: ${currentTheme.navBgColor};
          border: 1px solid ${currentTheme.borderColor};
          border-radius: 6px;
          color: ${currentTheme.textColor};
        }

        rapi-doc::part(input) {
          background-color: ${currentTheme.navBgColor};
          border: 1px solid ${currentTheme.borderColor};
          border-radius: 6px;
          color: ${currentTheme.textColor};
        }

        rapi-doc::part(monaco-editor) {
          font-family: 'Fira Code', monospace !important;
          border-radius: 6px;
          border: 1px solid ${currentTheme.borderColor};
        }

        rapi-doc::part(operation-tag) {
          border-radius: 4px;
          font-weight: 500;
        }

        rapi-doc::part(response-container) {
          border-radius: 8px;
          border: 1px solid ${currentTheme.borderColor};
          background-color: ${currentTheme.navBgColor};
        }

        rapi-doc::part(authentication-container) {
          border-radius: 8px;
          border: 1px solid ${currentTheme.borderColor};
          background-color: ${currentTheme.navBgColor};
        }
      `}</style>
    </>
  );
};

export default ApiDocs;