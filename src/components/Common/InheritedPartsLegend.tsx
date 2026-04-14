import { alpha, Box, Stack, Typography } from "@mui/material";
import React from "react";

/** Wide enough for `(o)`; all symbol chips share this width so the column lines up. */
const SYMBOL_COL = "2.75rem";

const InheritedPartsLegend = ({
  legendItems,
  sx,
}: {
  legendItems: { symbol: string; description: string }[];
  sx?: any;
}) => {
  return (
    <Box
      sx={(theme) => ({
        maxWidth: 420,
        mt: 2,
        pt: 2,
        px: 2.25,
        pb: 2,
        mb: 2,
        ...(sx || {}),
        borderRadius: 3,
      })}
    >
      <Stack
        component="ul"
        spacing={0.5}
        sx={{ m: 0, p: 0, listStyle: "none" }}
      >
        {legendItems.map(({ symbol, description }) => (
          <Box
            component="li"
            key={symbol}
            sx={(theme) => ({
              display: "grid",
              gridTemplateColumns: `${SYMBOL_COL} minmax(0, 1fr)`,
              columnGap: 2.25,
              alignItems: "center",
              py: 0.85,
              px: 1,
              mx: -1,
              borderRadius: 2,
            })}
          >
            <Box
              sx={{
                minWidth: 0,
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Box
                component="span"
                sx={(theme) => ({
                  boxSizing: "border-box",
                  width: "100%",
                  height: theme.spacing(3.75),
                  minHeight: theme.spacing(3.75),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  px: 0.5,
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "0.8125rem",
                  lineHeight: 1,
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                  letterSpacing: "-0.03em",
                  color: "primary.main",
                  bgcolor: alpha(theme.palette.primary.main, 0.16),
                  boxShadow: `0 1px 2px ${alpha(theme.palette.common.black, 0.12)}`,
                })}
              >
                {symbol}
              </Box>
            </Box>
            <Typography
              variant="body2"
              sx={(theme) => ({
                color: "text.primary",
                fontSize: "0.875rem",
                lineHeight: 1.35,
                fontWeight: 500,
                letterSpacing: "0.01em",
                opacity: theme.palette.mode === "dark" ? 0.88 : 0.92,
                margin: 0,
              })}
            >
              {description}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
};

export default InheritedPartsLegend;
