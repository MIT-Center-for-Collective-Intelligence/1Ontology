import React, { useState } from "react";
import { alpha, Box, Tooltip, useTheme } from "@mui/material";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import PartInheritanceModeButton, {
  InheritanceMode,
} from "./PartInheritanceModeButton";

/** Reserved right-edge width for the order-inheritance icon (0 since icons are centered on the dotted line). */
export const ORDER_INHERITANCE_ICON_GUTTER = 0;

const orderDashLine = (color: string) => ({
  height: "1px",
  backgroundImage: `repeating-linear-gradient(to right, ${color} 0px, ${color} 4px, transparent 4px, transparent 8px)`,
  backgroundRepeat: "repeat-x",
  backgroundSize: "100% 1px",
});

/** Full-width gap row between two part rows. */
const PartOrderSeparator = ({
  inheritsOrder,
  orderMode,
  onChangeOrderMode,
  disabled = false,
  forceShowIcons = false,
  noGeneralizations = false,
}: {
  inheritsOrder: boolean;
  orderMode?: InheritanceMode;
  onChangeOrderMode?: (mode: InheritanceMode) => void;
  disabled?: boolean;
  forceShowIcons?: boolean;
  /** When true the node is a root with no generalizations — use neutral gray
   *  for the non-order line instead of the warning red. */
  noGeneralizations?: boolean;
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const orderGreen = isDark ? "#52d68a" : "#22a558";
  const orderRed = isDark ? "#ff6b6b" : "#e04848";
  const orderGray = isDark ? "#6b7280" : "#9ca3af";
  const orderLine = alpha(orderGreen, isDark ? 0.65 : 0.6);
  const nonOrderLine = noGeneralizations
    ? alpha(orderGray, isDark ? 0.65 : 0.6)
    : alpha(orderRed, isDark ? 0.65 : 0.6);
  const badgeBg = isDark
    ? alpha(theme.palette.background.paper, 1)
    : theme.palette.background.paper;

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const hasIcons = inheritsOrder || Boolean(onChangeOrderMode && orderMode);

  return (
    <Box
      sx={{
        width: "100%",
        boxSizing: "border-box",
        minHeight: 12,
        my: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "visible",
        position: "relative",
        zIndex: isMenuOpen ? 10 : 1,
        "&:hover .part-order-separator-icons, &:focus-within .part-order-separator-icons": {
          opacity: 1,
          pointerEvents: "auto",
        },
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          ...orderDashLine(inheritsOrder ? orderLine : nonOrderLine),
        }}
      />
      {hasIcons && (
        <Box
          className={`part-order-separator-icons ${isMenuOpen ? "menu-open" : ""}`}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 0.75,
            px: 0.75,
            py: 0.25,
            borderRadius: "999px",
            backgroundColor: badgeBg,
            position: "relative",
            zIndex: 2,
            opacity: isMenuOpen || forceShowIcons ? 1 : 0,
            pointerEvents: isMenuOpen || forceShowIcons ? "auto" : "none",
            transition: "opacity 0.2s ease-in-out",
            "&.menu-open, &:hover, &:focus-within": {
              opacity: 1,
              pointerEvents: "auto",
            },
          }}
        >
          {inheritsOrder && (
            <Tooltip
              title="Order inherited between these two parts"
              placement="top"
            >
              <Box
                sx={{
                  flexShrink: 0,
                  width: 28,
                  height: 28,
                  borderRadius: "999px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: orderGreen,
                  backgroundColor: badgeBg,
                  border: `1.5px solid ${alpha(orderGreen, isDark ? 0.55 : 0.45)}`,
                  boxShadow: `0 0 0 2px ${alpha(orderGreen, isDark ? 0.1 : 0.06)}`,
                  cursor: "default",
                }}
              >
                <UnfoldMoreIcon sx={{ fontSize: 18, display: "block" }} />
              </Box>
            </Tooltip>
          )}
          {onChangeOrderMode && orderMode && (
            <PartInheritanceModeButton
              value={orderMode}
              onChange={onChangeOrderMode}
              disabled={disabled}
              onOpenChange={setIsMenuOpen}
            />
          )}
        </Box>
      )}
    </Box>
  );
};

export default PartOrderSeparator;
