import React from "react";
import { Paper, Typography, Switch, Box } from "@mui/material";

const VisualizationToggle = ({
  visualizationMode,
  setVisualizationMode,
}: {
  visualizationMode: "specializations/generalizations" | "Parts/IsPartOf";
  setVisualizationMode: (
    mode: "specializations/generalizations" | "Parts/IsPartOf"
  ) => void;
}) => {
  const isPartsMode = visualizationMode === "Parts/IsPartOf";

  return (
    <Paper
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "sticky",
        top: 0,
        zIndex: 90,
        padding: 2,
        mt: 0,
        boxShadow: 3,
        borderRadius: 2,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 500,
            color: !isPartsMode ? "#ff6d00" : "text.primary",
            transition: "color 0.3s",
          }}
        >
          Specializations/Generalizations
        </Typography>
        <Switch
          checked={isPartsMode}
          onChange={() =>
            setVisualizationMode(
              isPartsMode ? "specializations/generalizations" : "Parts/IsPartOf"
            )
          }
          color="primary"
        />
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 500,
            color: isPartsMode ? "#ff6d00" : "text.primary",
            transition: "color 0.3s",
          }}
        >
          Parts/Is Part Of
        </Typography>
      </Box>
    </Paper>
  );
};

export default VisualizationToggle;
