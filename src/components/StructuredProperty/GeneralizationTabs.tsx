import React from "react";
import { Tab, Tabs } from "@mui/material";

interface GeneralizationTabItem {
  id: string;
  title: string;
}

interface GeneralizationTabsProps {
  generalizations: GeneralizationTabItem[];
  activeTab: string | null;
  onChange: (event: React.SyntheticEvent, newValue: string) => void;
}

const GeneralizationTabs: React.FC<GeneralizationTabsProps> = ({
  generalizations,
  activeTab,
  onChange,
}) => {
  if (generalizations.length <= 1) {
    return null;
  }

  return (
    <Tabs
      value={activeTab}
      onChange={onChange}
      aria-label="Generalization selection tabs"
      variant="scrollable"
      scrollButtons="auto"
      sx={{
        mt: 2.5,
        p: "6px",
        border: (theme) =>
          theme.palette.mode === "light"
            ? "1px solid #d0d5dd"
            : "1px solid #3b3b3b",
        borderRadius: "999px",
        background: (theme) =>
          theme.palette.mode === "light"
            ? "linear-gradient(180deg, #ffffff 0%, #f3f5f8 100%)"
            : "linear-gradient(180deg, #17191f 0%, #101217 100%)",
        boxShadow: (theme) =>
          theme.palette.mode === "light"
            ? "inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 6px 16px rgba(15, 23, 42, 0.12)"
            : "inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 8px 18px rgba(0, 0, 0, 0.28)",
        minHeight: 52,
        "& .MuiTabs-indicator": {
          display: "none",
        },
        "& .MuiTabs-flexContainer": {
          gap: "6px",
        },
      }}
    >
      {generalizations.map((gen) => (
        <Tab
          key={gen.id}
          label={gen.title}
          value={gen.id}
          sx={{
            textTransform: "none",
            color: (theme) =>
              activeTab === gen.id
                ? "#f2a43a"
                : theme.palette.mode === "light"
                  ? "#111827"
                  : "#f3f4f6",
            fontWeight: activeTab === gen.id ? 700 : 600,
            px: 2.5,
            minHeight: 40,
            borderRadius: "999px",
            border:
              activeTab === gen.id
                ? "1px solid rgba(242, 164, 58, 0.55)"
                : "1px solid transparent",
            background:
              activeTab === gen.id
                ? (theme) =>
                    theme.palette.mode === "light"
                      ? "linear-gradient(180deg, #f8fafc 0%, #e8edf3 100%)"
                      : "linear-gradient(180deg, #2b2f39 0%, #1d2129 100%)"
                : "transparent",
            boxShadow:
              activeTab === gen.id
                ? (theme) =>
                    theme.palette.mode === "light"
                      ? "inset 0 0 0 1px rgba(242, 164, 58, 0.22)"
                      : "inset 0 0 0 1px rgba(255, 187, 86, 0.16)"
                : "none",
            transition: "all 0.2s ease",
            "&:hover": {
              background:
                activeTab === gen.id
                  ? (theme) =>
                      theme.palette.mode === "light"
                        ? "linear-gradient(180deg, #f8fafc 0%, #e8edf3 100%)"
                        : "linear-gradient(180deg, #2b2f39 0%, #1d2129 100%)"
                  : (theme) =>
                      theme.palette.mode === "light"
                        ? "rgba(15, 23, 42, 0.05)"
                        : "rgba(255, 255, 255, 0.06)",
            },
          }}
        />
      ))}
    </Tabs>
  );
};

export default GeneralizationTabs;
