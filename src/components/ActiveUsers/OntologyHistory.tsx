import { Box, Tabs, Tab } from "@mui/material";
import React, { useState } from "react";

import HistoryTab from "./HistoryTab";

const NodeActivity = ({
  currentVisibleNode,
  selectedDiffNode,
  displayDiff,
  activeUsers,
  selectedUser,
  skillsFuture,
  skillsFutureApp,
  nodes,
}: {
  selectedDiffNode: any;
  currentVisibleNode: any;
  displayDiff: any;
  activeUsers: any;
  selectedUser: string;
  skillsFuture: boolean;
  skillsFutureApp: string;
  nodes: { [nodeId: string]: any };
}) => {
  const [tabIndex, setTabIndex] = useState<number>(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };

  const glassBlur = "blur(22px) saturate(185%)";

  const pillTabSx = {
    minHeight: 36,
    py: 1.15,
    borderRadius: 999,
    fontWeight: 700,
    fontSize: "0.875rem",
    textTransform: "none" as const,
    color: (theme: { palette: { mode: string } }) =>
      theme.palette.mode === "dark"
        ? "rgba(255, 255, 255, 0.88)"
        : "rgba(30, 30, 34, 0.82)",
    textShadow: (theme: { palette: { mode: string } }) =>
      theme.palette.mode === "dark"
        ? "0 1px 2px rgba(0, 0, 0, 0.45)"
        : "0 1px 1px rgba(255, 255, 255, 0.8)",
    zIndex: 1,
    transition: "color 0.22s ease",
    "&.Mui-selected": {
      color: (theme: { palette: { mode: string } }) =>
        theme.palette.mode === "dark" ? "#ffb366" : "#b45309",
      textShadow: (theme: { palette: { mode: string } }) =>
        theme.palette.mode === "dark"
          ? "0 0 16px rgba(255, 160, 90, 0.55), 0 1px 2px rgba(0, 0, 0, 0.5)"
          : "0 0 12px rgba(232, 120, 40, 0.35)",
    },
  };

  return (
    <Box
      sx={{
        height: "90vh",
        overflow: "auto",
        "&::-webkit-scrollbar": {
          display: "none",
        },
      }}
    >
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          width: "100%",
          py: 1,
          px: 1.5,
          backgroundColor: (theme) =>
            theme.palette.mode === "dark"
              ? "rgba(8, 8, 10, 0.55)"
              : "rgba(208, 213, 221, 0.65)",
          backdropFilter: glassBlur,
          WebkitBackdropFilter: glassBlur,
          borderBottom: (theme) =>
            theme.palette.mode === "dark"
              ? "1px solid rgba(255, 255, 255, 0.06)"
              : "1px solid rgba(255, 255, 255, 0.5)",
          boxShadow: (theme) =>
            theme.palette.mode === "dark"
              ? "inset 0 1px 0 rgba(255, 255, 255, 0.04)"
              : "inset 0 1px 0 rgba(255, 255, 255, 0.7)",
        }}
      >
        <Tabs
          value={tabIndex}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            position: "relative",
            minHeight: 44,
            px: 0.5,
            py: 0.5,
            borderRadius: 999,
            isolation: "isolate",
            overflow: "visible",
            background: (theme) =>
              theme.palette.mode === "dark"
                ? "linear-gradient(155deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0.05) 42%, rgba(255, 255, 255, 0.09) 100%)"
                : "linear-gradient(155deg, rgba(255, 255, 255, 0.72) 0%, rgba(255, 255, 255, 0.38) 45%, rgba(255, 255, 255, 0.55) 100%)",
            backdropFilter: glassBlur,
            WebkitBackdropFilter: glassBlur,
            border: (theme) =>
              theme.palette.mode === "dark"
                ? "1px solid rgba(255, 255, 255, 0.22)"
                : "1px solid rgba(255, 255, 255, 0.65)",
            boxShadow: (theme) =>
              theme.palette.mode === "dark"
                ? `
                  0 10px 40px rgba(0, 0, 0, 0.45),
                  0 2px 12px rgba(0, 0, 0, 0.25),
                  inset 0 1px 0 rgba(255, 255, 255, 0.18),
                  inset 0 -1px 0 rgba(0, 0, 0, 0.2)
                `
                : `
                  0 8px 28px rgba(15, 23, 42, 0.12),
                  inset 0 1px 0 rgba(255, 255, 255, 0.95),
                  inset 0 -1px 0 rgba(15, 23, 42, 0.06)
                `,
            "&::before": {
              content: '""',
              position: "absolute",
              inset: 0,
              borderRadius: "inherit",
              padding: "1px",
              background: (theme) =>
                theme.palette.mode === "dark"
                  ? "linear-gradient(130deg, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0) 45%, rgba(255, 255, 255, 0.12) 100%)"
                  : "linear-gradient(130deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.2) 50%, rgba(255, 255, 255, 0.5) 100%)",
              WebkitMask:
                "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
              mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              maskComposite: "exclude",
              pointerEvents: "none",
            },
            "& .MuiTabs-flexContainer": {
              gap: 0.5,
            },
            "& .MuiTabs-indicator": {
              height: "auto",
              borderRadius: 999,
              top: "2px",
              bottom: "2px",
              background: (theme) =>
                theme.palette.mode === "dark"
                  ? "linear-gradient(140deg, rgba(255, 175, 110, 0.42) 0%, rgba(255, 115, 55, 0.28) 48%, rgba(255, 140, 75, 0.36) 100%)"
                  : "linear-gradient(140deg, rgba(255, 200, 140, 0.65) 0%, rgba(255, 150, 80, 0.45) 50%, rgba(255, 170, 100, 0.55) 100%)",
              backdropFilter: "blur(14px) saturate(200%)",
              WebkitBackdropFilter: "blur(14px) saturate(200%)",
              border: (theme) =>
                theme.palette.mode === "dark"
                  ? "1px solid rgba(255, 190, 140, 0.45)"
                  : "1px solid rgba(220, 100, 40, 0.4)",
              boxShadow: (theme) =>
                theme.palette.mode === "dark"
                  ? `
                    0 0 24px rgba(255, 130, 70, 0.35),
                    0 4px 16px rgba(255, 100, 50, 0.15),
                    inset 0 1px 0 rgba(255, 235, 210, 0.45),
                    inset 0 -1px 0 rgba(160, 60, 20, 0.25)
                  `
                  : `
                    0 0 18px rgba(230, 120, 50, 0.28),
                    inset 0 1px 0 rgba(255, 255, 255, 0.75),
                    inset 0 -1px 0 rgba(180, 80, 30, 0.12)
                  `,
            },
          }}
        >
          <Tab disableRipple label="Edits" sx={pillTabSx} />
          <Tab disableRipple label="New Nodes" sx={pillTabSx} />
        </Tabs>
      </Box>

      {tabIndex === 0 && (
        <HistoryTab
          selectedDiffNode={selectedDiffNode}
          displayDiff={displayDiff}
          selectedUser={selectedUser}
          activeUsers={activeUsers}
          changeType={null}
          skillsFuture={skillsFuture}
          skillsFutureApp={skillsFutureApp}
          nodes={nodes}
        />
      )}
      {tabIndex === 1 && (
        <HistoryTab
          selectedDiffNode={selectedDiffNode}
          displayDiff={displayDiff}
          selectedUser={selectedUser}
          activeUsers={activeUsers}
          changeType={"add-node"}
          skillsFuture={skillsFuture}
          skillsFutureApp={skillsFutureApp}
          nodes={nodes}
        />
      )}
    </Box>
  );
};

export default NodeActivity;
