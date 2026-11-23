import React, { useEffect, useRef, useState } from "react";
import { IconButton, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { SxProps, Theme } from "@mui/material/styles";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";

const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API unavailable (e.g. not a secure context): hidden textarea.
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
};

type CopyTitleButtonProps = {
  /** The exact text put on the clipboard. */
  text: string;
  className?: string;
  sx?: SxProps<Theme>;
};

/**
 * Small icon button that copies `text` and briefly shows a check mark.
 * It stops pointer events from reaching the row/node underneath, so clicking
 * it never selects, opens or drags that node.
 */
const CopyTitleButton = ({ text, className, sx }: CopyTitleButtonProps) => {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number>();

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  const stop = (event: React.SyntheticEvent) => event.stopPropagation();

  const handleCopy = async (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    if (await copyText(text)) {
      setCopied(true);
      window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <Tooltip
      title={copied ? "Copied" : "Copy title"}
      placement="top"
      arrow
      disableInteractive
    >
      <IconButton
        size="small"
        aria-label="Copy title"
        className={className}
        onClick={handleCopy}
        onMouseDown={stop}
        onPointerDown={stop}
        onDoubleClick={stop}
        sx={[
          {
            p: "3px",
            color: copied ? "success.main" : "text.secondary",
            "&:hover": {
              color: copied ? "success.main" : "text.primary",
              bgcolor: (t) => alpha(t.palette.text.primary, 0.08),
            },
          },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        {copied ? (
          <CheckRoundedIcon sx={{ fontSize: 15 }} />
        ) : (
          <ContentCopyRoundedIcon sx={{ fontSize: 14 }} />
        )}
      </IconButton>
    </Tooltip>
  );
};

export default CopyTitleButton;
