/* 
This is a React component that renders Markdown text. It uses several libraries and plugins to handle different aspects of Markdown rendering, including math expressions, syntax highlighting, and HTML tags.

Here's a breakdown of the code:

1. Import necessary libraries and components. These include KaTeX for rendering math expressions, `react-markdown` for rendering Markdown, `react-syntax-highlighter` for syntax highlighting, and several plugins for handling math expressions and raw HTML in Markdown.

2. Define the props for the `MarkdownRender` component. It accepts a `text` prop which is the Markdown text to render, an optional `customClass` prop for adding a custom CSS class to the rendered Markdown, and an optional `sx` prop for adding custom styles.

3. In the `MarkdownRender` component, it first checks if the `text` contains any HTML tags. If it doesn't, it uses the `remarkMath` plugin to handle math expressions in the Markdown. If it does contain HTML tags, it skips the `remarkMath` plugin.

4. It then sets up the `rehypePlugins`. If the `text` doesn't contain any HTML tags, it uses both the `rehypeKatex` and `rehypeRaw` plugins. If it does contain HTML tags, it only uses the `rehypeRaw` plugin.

5. It sets up custom renderers for different Markdown elements. For paragraphs, it uses the `Typography` component from Material-UI. For links, it uses the `Link` component from Material-UI. For code blocks, it uses the `SyntaxHighlighter` component for syntax highlighting, and a `Box` component for inline code.

6. Finally, it renders the `text` using the `ReactMarkdown` component, with the plugins and custom renderers set up earlier.

7. The `MarkdownRender` component is then exported for use in other parts of the application. */

import "katex/dist/katex.min.css";

import { Box, Link, Typography } from "@mui/material";
import { SxProps, Theme } from "@mui/system";
import React, { FC } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { darcula } from "react-syntax-highlighter/dist/cjs/styles/prism";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import remarkMath from "remark-math";
import { containsHTMLTags } from " @components/lib/utils/utils";
import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";

type Props = {
  text: string;
  customClass?: string;
  sx?: SxProps<Theme>;
};
const MarkdownRender: FC<Props> = ({
  text,
  customClass,
  sx = { fontSize: "inherit" },
}) => {
  return (
    <ReactMarkdown
      remarkPlugins={!containsHTMLTags(text) ? [remarkMath] : []}
      rehypePlugins={
        !containsHTMLTags(text)
          ? [rehypeKatex, rehypeRaw as any]
          : [rehypeRaw as any]
      }
      className={customClass}
      components={{
        p: ({ ...props }) => (
          <Typography
            lineHeight={"inherit"}
            {...props}
            sx={{
              p: "0px",
              wordBreak: "break-word",
              mb: 1,
              "&:last-child": {
                mb: 0
              },
              ...sx
            }}
          />
        ),
        a: ({ ...props }) => {
          return (
            <Link
              sx={{
                color: (theme) =>
                  theme.palette.mode === "light"
                    ? DESIGN_SYSTEM_COLORS.orange500
                    : undefined,
              }}
              href={props.href}
              target="_blank"
              rel="noopener"
            >
              {props.children}
            </Link>
          );
        },
        code({ inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          return !inline && match ? (
            <SyntaxHighlighter
              style={darcula as any}
              language={match[1]}
              PreTag="div"
              {...props}
            >
              {String(children).replace(/\n$/, "")}
            </SyntaxHighlighter>
          ) : (
            <Box
              className="scroll-styled"
              component={inline ? "span" : "div"}
              sx={{
                paddingBottom: "5px",
                overflow: "overlay",
                background: (theme) =>
                  theme.palette.mode === "dark" ? "#363636" : "#d6d6d6",
                borderRadius: "6px",
              }}
            >
              <code {...props}>{children || ""}</code>
            </Box>
          );
        },
        blockquote: ({ ...props }) => (
          <Box
            component="blockquote"
            sx={{
              position: 'relative',
              pl: 3,
              marginInlineStart: '20px',
              marginInlineEnd: '20px',
              color: (theme) => theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.7)'
                : 'rgba(0, 0, 0, 0.7)',
              '&::before': {
                content: '""',
                position: 'absolute',
                left: '4px',
                top: '-2px',
                bottom: '-2px',
                width: '4px',
                borderRadius: '4px',
                backgroundColor: (theme) => theme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.12)'
                  : 'rgba(0, 0, 0, 0.12)',
              },
              "&:last-child": {
                mb: 0
              }
            }}
            {...props}
          />
        )
      }}
    >
      {containsHTMLTags(text) ? text.replace(/\$\$|\$/g, "") : text}
    </ReactMarkdown>
  );
};

export default MarkdownRender;
