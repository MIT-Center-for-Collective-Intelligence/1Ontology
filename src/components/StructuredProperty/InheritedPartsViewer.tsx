import React, { useState } from "react";
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Checkbox,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";

interface GeneralizationNode {
  id: string;
  title: string;
}

interface PartNode {
  id: string;
  title: string;
  isInherited: boolean;
}

interface InheritedPartsViewerProps {
  selectedProperty: string;
  getAllGeneralizations: () => GeneralizationNode[];
  getGeneralizationParts: (generalizationId: string) => PartNode[];
  getTitle: (nodes: { [id: string]: any }, nodeId: string) => string;
  nodes: { [id: string]: any };
  checkedItems: Set<string>;
  markItemAsChecked: (
    checkedId: string,
    radioSelection?: boolean,
    fromGeneralizationDropdown?: { generalizationId: string; generalizationTitle: string }
  ) => void;
  isSaving: boolean;
  readOnly?: boolean;
}

const InheritedPartsViewer: React.FC<InheritedPartsViewerProps> = ({
  selectedProperty,
  getAllGeneralizations,
  getGeneralizationParts,
  getTitle,
  nodes,
  checkedItems,
  markItemAsChecked,
  isSaving,
  readOnly = false
}) => {
  const [selectedTab, setSelectedTab] = useState(0);
  
  if (selectedProperty !== "parts") return null;

  const generalizations = getAllGeneralizations();
  
  if (generalizations.length === 0) {
    return null;
  }

  // Reset to first tab if current selection is invalid
  React.useEffect(() => {
    if (selectedTab >= generalizations.length) {
      setSelectedTab(0);
    }
  }, [generalizations.length, selectedTab]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number): void => {
    setSelectedTab(newValue);
  };

  const getTabContent = (generalizationId: string): JSX.Element => {
    const parts = getGeneralizationParts(generalizationId);
    const displayedParts = parts.slice(0, 10);
    
    if (displayedParts.length === 0) {
      return (
        <Typography 
          variant="body2" 
          sx={{ 
            color: (theme) => theme.palette.mode === "light" ? "#95a5a6" : "#7f8c8d", 
            fontStyle: "italic",
            textAlign: "center",
            py: 2,
            fontSize: "0.75rem"
          }}
        >
          No parts available
        </Typography>
      );
    }

    const getPartGeneralization = (partId: string): string | null => {
      const partNode = nodes[partId];
      if (!partNode?.generalizations?.[0]?.nodes?.[0]?.id) {
        return null;
      }
      const firstGeneralizationId = partNode.generalizations[0].nodes[0].id;
      return getTitle(nodes, firstGeneralizationId);
    };

    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, py: 1 }}>
        {displayedParts.map((part) => {
          const partGeneralization = getPartGeneralization(part.id);
          
          return (
            <Box
              key={part.id}
              sx={{ 
                display: "flex",
                alignItems: "center",
                gap: 1.5
              }}
            >
              {readOnly ? (
                checkedItems.has(part.id) ? (
                  <CheckIcon
                    sx={{
                      color: "#4caf50",
                      fontSize: "20px"
                    }}
                  />
                ) : (
                  <CloseIcon
                    sx={{
                      color: "#f44336",
                      fontSize: "20px"
                    }}
                  />
                )
              ) : (
                <Checkbox
                  checked={checkedItems.has(part.id)}
                  onChange={() => markItemAsChecked(
                    part.id, 
                    false, 
                    { 
                      generalizationId: generalizationId, 
                      generalizationTitle: getTitle(nodes, generalizationId)
                    }
                  )}
                  disabled={isSaving}
                  size="small"
                  sx={{
                    color: (theme) => theme.palette.mode === "light" ? "#bdc3c7" : "#7f8c8d",
                    "&.Mui-checked": {
                      color: (theme) => theme.palette.mode === "light" ? "#3498db" : "#4a90e2"
                    },
                    "& .MuiSvgIcon-root": {
                      fontSize: "16px"
                    }
                  }}
                />
              )}
              <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
                {partGeneralization && (
                  <Typography
                    variant="body2"
                    sx={{
                      color: (theme) => theme.palette.mode === "light" ? "#666" : "#999",
                      fontSize: "0.9rem"
                    }}
                  >
                    <span style={{ fontStyle: "italic" }}>{partGeneralization}</span> → {part.title}
                  </Typography>
                )}
                {!partGeneralization && (
                  <Typography
                    variant="body2"
                    sx={{
                      color: (theme) => theme.palette.mode === "light" ? "#2c3e50" : "#e0e0e0",
                      fontWeight: 400,
                      fontSize: "1rem"
                    }}
                  >
                    {part.title}
                  </Typography>
                )}
              </Box>
              {/* {part.isInherited && (
                <Typography
                  variant="caption"
                  sx={{
                    color: (theme) => theme.palette.mode === "light" ? "#f39c12" : "#e67e22",
                    fontSize: "0.7rem",
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}
                >
                  inherited
                </Typography>
              )} */}
            </Box>
          );
        })}
      </Box>
    );
  };

  return (
    <Box sx={{ 
      px: "15px", 
      py: "10px", 
      pb: "20px",
      mb: "20px",
      backgroundColor: (theme) => theme.palette.mode === "light" ? "#fafbfc" : "#1e1e1f",
      borderBottom: (theme) => `1px solid ${theme.palette.mode === "light" ? "#e1e5e9" : "#404040"}`
    }}>
      <Typography 
        variant="subtitle2" 
        sx={{ 
          mb: 2, 
          fontWeight: 600,
          fontSize: "0.85rem",
          color: (theme) => theme.palette.mode === "light" ? "#2c3e50" : "#e0e0e0"
        }}
      >
        {readOnly ? "Parts Inherited from Generalizations:" : "Inherit Parts from Generalizations:"}
      </Typography>
      
      <Tabs
        value={selectedTab}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          mb: 2,
          "& .MuiTabs-scrollButtons": {
            "&.Mui-disabled": { opacity: 0.3 }
          },
          "& .MuiTabs-indicator": {
            backgroundColor: readOnly ? "#ff9500" : "#ff9500"
          }
        }}
      >
        {generalizations.map((generalization, index) => {
          const parts = getGeneralizationParts(generalization.id);
          const selectedPartsFromThisGen = parts.filter((part) => checkedItems.has(part.id));
          
          return (
            <Tab
              key={generalization.id}
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, maxWidth: "160px" }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 500,
                      fontSize: "0.85rem",
                      textTransform: "none",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1
                    }}
                  >
                    {generalization.title}
                  </Typography>
                  {selectedPartsFromThisGen.length > 0 && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#ff9500",
                        fontWeight: 600,
                        fontSize: "0.75rem"
                      }}
                    >
                      ({selectedPartsFromThisGen.length})
                    </Typography>
                  )}
                </Box>
              }
              sx={{
                minWidth: "auto",
                maxWidth: "180px",
                px: 2,
                py: 1,
                textTransform: "none",
                "&.Mui-selected": {
                  color: "#ff9500"
                }
              }}
            />
          );
        })}
      </Tabs>

      {selectedTab < generalizations.length && (
        <Box sx={{ mt: 1.5 }}>
          {getTabContent(generalizations[selectedTab].id)}
        </Box>
      )}
    </Box>
  );
};

export default InheritedPartsViewer;