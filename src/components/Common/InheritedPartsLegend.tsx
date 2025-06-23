import { Box, List, Typography } from "@mui/material";
import React from "react";

const InheritedPartsLegend = ({
  legendItems,
}: {
  legendItems: { symbol: string; description: string }[];
}) => {
  return (
    <Box
      sx={{
        maxWidth: 360,
        borderRadius: 3,
      }}
    >
      <List dense>
        {legendItems.map(({ symbol, description }) => (
          <Box key={symbol} sx={{ gap: "13px", display: "flex", ml: "15px" }}>
            <Typography sx={{ color: "orange" }}>{symbol}</Typography>
            <Typography>=</Typography>
            <Typography sx={{ fontSize: "15px" }}>{description}</Typography>
          </Box>
        ))}
      </List>
    </Box>
  );
};

export default InheritedPartsLegend;
