import { alpha, Box, Stack, Typography, useTheme } from "@mui/material";
import React from "react";
import DragHandleIcon from "@mui/icons-material/DragHandle";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import SyncIcon from "@mui/icons-material/Sync";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import BlockIcon from "@mui/icons-material/Block";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";

export interface LegendItem {
  symbol?: string;
  icon?: React.ReactNode;
  description: string;
  type?: "symbol" | "dotted-line" | "icon" | "order-rail";
  lineColor?: "green" | "orange" | string;
  color?: "green" | "orange" | "red" | string;
}

export const getDefaultInheritedPartsLegendItems = (): LegendItem[] => [
  { symbol: "?", description: "Optional" },
  {
    icon: <DragHandleIcon sx={{ fontSize: 20 }} />,
    symbol: "=",
    color: "orange",
    description: "No Change",
  },
  {
    icon: <ArrowForwardIosIcon sx={{ fontSize: 18 }} />,
    symbol: ">",
    color: "orange",
    description: "Specialized Part",
  },
  {
    icon: <CloseIcon sx={{ fontSize: 20 }} />,
    symbol: "x",
    color: "orange",
    description: "Part not Inherited",
  },
  {
    icon: <AddIcon sx={{ fontSize: 20 }} />,
    symbol: "+",
    color: "orange",
    description: "Part Added",
  },
  {
    type: "order-rail",
    color: "green",
    description: "Inherited Order",
  },
  {
    icon: <SyncIcon sx={{ fontSize: 20 }} />,
    color: "green",
    description: "Always Inherit",
  },
  {
    icon: <AccountTreeOutlinedIcon sx={{ fontSize: 20 }} />,
    color: "orange",
    description: "Inherit Unless Overridden",
  },
  {
    icon: <BlockIcon sx={{ fontSize: 20 }} />,
    color: "red",
    description: "Never Inherit",
  },
];

const RIGHT_COLUMN_DESCRIPTIONS = new Set([
  "Inherited Order",
  "Always Inherit",
  "Inherit Unless Overridden",
  "Never Inherit",
]);

/** Wide enough for `(o)`; all symbol chips share this width so the column lines up. */
const SYMBOL_COL = "2.75rem";

const InheritedPartsLegend = ({
  legendItems,
  sx,
}: {
  legendItems?: LegendItem[];
  sx?: any;
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const items = legendItems ?? getDefaultInheritedPartsLegendItems();

  const resolveColor = (color?: string) => {
    if (color === "green") return isDark ? "#52d68a" : "#22a558";
    if (color === "orange") return isDark ? "#f2a43a" : "#e68a19";
    if (color === "red") return isDark ? "#ff6b6b" : "#e04848";
    return color || theme.palette.primary.main;
  };

  const leftItems = items.filter(
    (item) => !RIGHT_COLUMN_DESCRIPTIONS.has(item.description),
  );
  const rightItems = items.filter((item) =>
    RIGHT_COLUMN_DESCRIPTIONS.has(item.description),
  );
  const hasTwoColumns = rightItems.length > 0 && leftItems.length > 0;

  const renderItem = (item: LegendItem, index: number) => {
    const itemKey = item.description || item.symbol || `${item.type}-${index}`;
    const isDottedLine = item.type === "dotted-line";
    const isOrderRail = item.type === "order-rail";
    const itemColor = resolveColor(
      item.color || (isDottedLine ? item.lineColor : undefined),
    );

    return (
      <Box
        component="li"
        key={itemKey}
        sx={{
          display: "grid",
          gridTemplateColumns: `${SYMBOL_COL} minmax(0, 1fr)`,
          columnGap: 1.5,
          alignItems: "center",
          py: 0.5,
          px: 1,
          mx: -1,
          borderRadius: 2,
        }}
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
          {isOrderRail ? (
            <Box
              component="span"
              sx={{
                boxSizing: "border-box",
                height: theme.spacing(3),
                minHeight: theme.spacing(3),
                width: "12px",
                borderLeft: `2px solid ${itemColor}`,
                borderTop: `2px solid ${itemColor}`,
                borderBottom: `2px solid ${itemColor}`,
                borderTopLeftRadius: "7px",
                borderBottomLeftRadius: "7px",
              }}
            />
          ) : isDottedLine ? (
            <Box
              component="span"
              sx={{
                boxSizing: "border-box",
                width: "100%",
                height: theme.spacing(3),
                minHeight: theme.spacing(3),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                px: 0.75,
                borderRadius: "6px",
                bgcolor: alpha(itemColor, 0.08),
              }}
            >
              <Box
                sx={{
                  width: "100%",
                  height: "2px",
                  backgroundImage: `repeating-linear-gradient(to right, ${itemColor} 0px, ${itemColor} 4px, transparent 4px, transparent 7px)`,
                  backgroundRepeat: "repeat-x",
                  backgroundSize: "100% 2px",
                }}
              />
            </Box>
          ) : item.icon ? (
            <Box
              component="span"
              sx={{
                boxSizing: "border-box",
                width: "100%",
                height: theme.spacing(3),
                minHeight: theme.spacing(3),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                px: 0.5,
                borderRadius: "6px",
                color: alpha(itemColor, 0.7),
                bgcolor: alpha(itemColor, 0.08),
              }}
            >
              {item.icon}
            </Box>
          ) : (
            <Box
              component="span"
              sx={{
                boxSizing: "border-box",
                width: "100%",
                height: theme.spacing(3),
                minHeight: theme.spacing(3),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                px: 0.5,
                borderRadius: "6px",
                fontWeight: 600,
                fontSize: "0.75rem",
                lineHeight: 1,
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                letterSpacing: "-0.03em",
                color: alpha(itemColor, 0.7),
                bgcolor: alpha(itemColor, 0.08),
              }}
            >
              {item.symbol}
            </Box>
          )}
        </Box>
        <Typography
          variant="body2"
          sx={{
            color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.38)",
            fontSize: "0.8rem",
            lineHeight: 1.35,
            fontWeight: 400,
            letterSpacing: "0.01em",
            margin: 0,
            whiteSpace: "nowrap",
          }}
        >
          {item.description}
        </Typography>
      </Box>
    );
  };

  if (!hasTwoColumns) {
    return (
      <Box
        sx={{
          maxWidth: 440,
          mt: 2,
          pt: 2,
          pb: 2,
          ...(sx || {}),
          borderRadius: 3,
        }}
      >
        <Stack
          component="ul"
          spacing={0.5}
          sx={{ m: 0, p: 0, listStyle: "none" }}
        >
          {items.map(renderItem)}
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: "100%",
        boxSizing: "border-box",
        mt: 2,
        pt: 2,
        pb: 2,
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: { xs: 1, sm: 4 },
        borderRadius: 3,
        ...(sx || {}),
      }}
    >
      <Stack
        component="ul"
        spacing={0.5}
        sx={{ m: 0, p: 0, listStyle: "none", minWidth: 220 }}
      >
        {leftItems.map(renderItem)}
      </Stack>
      <Stack
        component="ul"
        spacing={0.5}
        sx={{
          m: 0,
          p: 0,
          listStyle: "none",
          minWidth: 320,
          ml: { sm: "auto" },
        }}
      >
        {rightItems.map(renderItem)}
      </Stack>
    </Box>
  );
};

export default InheritedPartsLegend;
