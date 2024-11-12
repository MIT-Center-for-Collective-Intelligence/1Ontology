import { Box, Tabs, Tab } from "@mui/material";
import React, { useState } from "react";

import HistoryTab from "./HistoryTab";

const NodeActivity = ({
  currentVisibleNode,
  selectedDiffNode,
  displayDiff,
  activeUsers,
  selectedUser,
}: {
  selectedDiffNode: any;
  currentVisibleNode: any;
  displayDiff: any;
  activeUsers: any;
  selectedUser: string;
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
          backgroundColor: "black",
          zIndex: 5,
        }}
        value={tabIndex}
        onChange={handleTabChange}
      >
        <Tab label="Edits" sx={{ width: "50%" }} />
        <Tab label="New Nodes" sx={{ width: "50%" }} />
      </Tabs>

      {tabIndex === 0 && (
        <HistoryTab
          currentVisibleNode={currentVisibleNode}
          selectedDiffNode={selectedDiffNode}
          displayDiff={displayDiff}
          selectedUser={selectedUser}
          activeUsers={activeUsers}
          changeType={null}
        />
      )}
      {tabIndex === 1 && (
        <HistoryTab
          currentVisibleNode={currentVisibleNode}
          selectedDiffNode={selectedDiffNode}
          displayDiff={displayDiff}
          selectedUser={selectedUser}
          activeUsers={activeUsers}
          changeType={"add-node"}
        />
      )}
    </Box>
  );
};

export default NodeActivity;
