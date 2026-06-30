import { Box } from "@mui/material";
import { keyframes } from "@mui/system";
import { useRef } from "react";

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const SPIN_MS = 1000;

/**
 * A spinner whose rotation is tied to the clock, so every spinner on the page
 * turns together and a new one starts in sync with the rest.
 */
export const SyncedSpinner = ({
  size = 20,
  color = "orange",
  thickness = 2,
}: {
  size?: number;
  color?: string;
  thickness?: number;
}) => {
  const delay = useRef(`-${Date.now() % SPIN_MS}ms`);
  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        boxSizing: "border-box",
        width: size,
        height: size,
        border: `${thickness}px solid`,
        borderColor: "rgba(125,125,125,0.25)",
        borderTopColor: color,
        borderRadius: "50%",
        animation: `${spin} ${SPIN_MS}ms linear infinite`,
        animationDelay: delay.current,
      }}
    />
  );
};

export default SyncedSpinner;
