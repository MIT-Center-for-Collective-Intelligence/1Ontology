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
      <Tabs
        sx={{
          position: "sticky",
          top: 0,
          backgroundColor: (theme) =>
            theme.palette.mode === "dark" ? "black" : "#d0d5dd",
          zIndex: 5,
          width: "100%",
        }}
        value={tabIndex}
        onChange={handleTabChange}
      >
        <Tab label="Edits" sx={{ width: "50%" }} />
        <Tab label="New Nodes" sx={{ width: "50%" }} />
      </Tabs>

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
