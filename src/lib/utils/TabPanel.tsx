import React from "react";

import Box from "@mui/material/Box";

// A functional component representing a tab panel for a tab-based UI
export const TabPanel = (props: any) => {
  // Destructure props to extract relevant values
  const { children, value, index, ...other } = props;

  return (
    // Box component serving as the container for the tab panel
    <Box
      role="tabpanel"
      // Hide the panel if its index does not match the active tab index
      hidden={value !== index}
      // Unique ID and ARIA attributes for accessibility
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {/* Render children only if the current tab is active */}
      {value === index && <Box>{children}</Box>}
    </Box>
  );
};

// A utility function to generate ARIA attributes for a tab
export const a11yProps = (index: any) => {
  return {
    id: `simple-tab-${index}`,
    "aria-controls": `simple-tabpanel-${index}`,
  };
};
