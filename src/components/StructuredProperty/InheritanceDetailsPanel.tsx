import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  Box,
  Button,
  Collapse,
  Tabs,
  Tab,
  Typography,
  useTheme,
  Chip,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { capitalizeFirstLetter } from "@components/lib/utils/string.utils";
import { DISPLAY } from "@components/lib/CONSTANTS";

export interface NumericValue {
  value: number | string;
  unit: string;
}

export interface InheritanceSource {
  nodeId: string;
  nodeTitle: string;
  value: any;
  isInherited: boolean;
  inheritedFrom?: string;
}

export interface InheritanceDetailsData {
  hasMultipleGeneralizations: boolean;
  inheritanceSources: InheritanceSource[];
  aggregatedValue?: any;
  propertyType?: "string" | "string-array" | "collection" | "numeric";
  isNumeric?: boolean;
  isMultiLine?: boolean;
}

interface InheritanceDetailsPanelProps {
  property: string;
  currentVisibleNode: any;
  relatedNodes: { [id: string]: any };
  fetchNode: (nodeId: string) => Promise<any | null>;
  className?: string;
  sx?: any;
}

const InheritanceDetailsPanel: React.FC<InheritanceDetailsPanelProps> = ({
  property,
  currentVisibleNode,
  relatedNodes,
  fetchNode,
  className,
  sx,
}) => {
  const theme = useTheme();
  const [showInheritanceDetails, setShowInheritanceDetails] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);

  const parseNumericValue = useCallback((val: any): NumericValue => {
    if (typeof val === "object" && val !== null && "value" in val) {
      return {
        value: val.value || "",
        unit: val.unit || "",
      };
    }
    return {
      value: val || "",
      unit: "",
    };
  }, []);

  const inheritanceData = useMemo((): InheritanceDetailsData => {
    const generalizationNodes =
      currentVisibleNode.generalizations?.flatMap(
        (collection: { nodes: any[] }) =>
          collection.nodes.map((node: { id: any }) => node.id),
      ) || [];

    // Check if relatedNodes exists
    if (!relatedNodes || Object.keys(relatedNodes).length === 0) {
      return {
        hasMultipleGeneralizations: false,
        inheritanceSources: [],
        aggregatedValue: currentVisibleNode.properties[property],
      };
    }

    if (generalizationNodes.length === 0) {
      return {
        hasMultipleGeneralizations: false,
        inheritanceSources: [],
        aggregatedValue: currentVisibleNode.properties[property],
      };
    }

    const resolvePropertyValue = (
      nodeId: string,
      propertyName: string,
    ): any => {
      const node = relatedNodes[nodeId];
      if (!node) return getDefaultValue();

      if (
        node.properties[propertyName] !== undefined &&
        node.properties[propertyName] !== null &&
        node.properties[propertyName] !== ""
      ) {
        return node.properties[propertyName];
      }

      const inheritanceRef = node.inheritance[propertyName]?.ref;
      if (inheritanceRef && relatedNodes[inheritanceRef]) {
        return resolvePropertyValue(inheritanceRef, propertyName);
      }

      return getDefaultValue();
    };

    const getDefaultValue = () => {
      const propertyType = currentVisibleNode.propertyType[property];
      if (propertyType === "numeric") return { value: 0, unit: "" };
      if (propertyType === "string-array") return [];
      if (Array.isArray(currentVisibleNode.properties[property])) return [];
      return "";
    };

    const inheritanceSources = generalizationNodes
      .map((nodeId: string) => {
        const node = relatedNodes[nodeId];
        if (!node) return null;

        let actualValue = resolvePropertyValue(nodeId, property);
        let inheritedFromTitle = undefined;

        if (node.inheritance[property]?.ref) {
          inheritedFromTitle = relatedNodes[node.inheritance[property].ref]?.title;
          actualValue = resolvePropertyValue(
            node.inheritance[property].ref,
            property,
          );
        }

        return {
          nodeId,
          nodeTitle: node.title || "Unknown",
          value: actualValue,
          isInherited: !!node.inheritance[property]?.ref,
          inheritedFrom: inheritedFromTitle,
        };
      })
      .filter((source: any) => source !== null && relatedNodes[source.nodeId]);

    if (inheritanceSources.length === 0) {
      return {
        hasMultipleGeneralizations: false,
        inheritanceSources: [],
        aggregatedValue: currentVisibleNode.properties[property],
      };
    }

    const propertyType = currentVisibleNode.propertyType[property];
    const firstValue = inheritanceSources[0]?.value;

    const isNumeric =
      propertyType === "numeric" ||
      typeof firstValue === "number" ||
      (typeof firstValue === "object" &&
        firstValue !== null &&
        "value" in firstValue) ||
      (!isNaN(Number(firstValue)) &&
        firstValue !== "" &&
        typeof firstValue === "string");

    const isMultiLine =
      propertyType === "text" ||
      property === "description" ||
      (typeof firstValue === "string" &&
        (firstValue.includes("\n") || firstValue.length > 100));

    let aggregatedValue = currentVisibleNode.properties[property];

    if (
      currentVisibleNode.inheritance[property]?.ref &&
      inheritanceSources.length > 0
    ) {
      if (isNumeric) {
        if (propertyType === "numeric") {
          const firstSource = inheritanceSources[0];
          const parsedValue = parseNumericValue(firstSource.value);

          for (let i = 1; i < inheritanceSources.length; i++) {
            const otherValue = parseNumericValue(inheritanceSources[i].value);
            if (otherValue.unit && !parsedValue.unit) {
              parsedValue.unit = otherValue.unit;
            }
          }

          aggregatedValue = parsedValue;
        } else {
          aggregatedValue = inheritanceSources[0].value;
        }
      } else if (propertyType === "string-array") {
        const allItems = inheritanceSources.flatMap((source: { value: any }) =>
          Array.isArray(source.value) ? source.value : [],
        );
        aggregatedValue = [...new Set(allItems)];
      } else if (isMultiLine) {
        const textValues = inheritanceSources
          .map((source: { value: any }) => String(source.value))
          .filter((val: string) => val && val.trim());
        aggregatedValue = textValues.join("\n##########\n");
      } else {
        const textValues = inheritanceSources
          .map((source: { value: any }) => String(source.value))
          .filter((val: string) => val && val.trim());
        aggregatedValue = textValues.join(" ########## ");
      }
    }

    return {
      hasMultipleGeneralizations: inheritanceSources.length > 1,
      aggregatedValue,
      inheritanceSources,
      propertyType,
      isNumeric,
      isMultiLine,
    };
  }, [currentVisibleNode, relatedNodes, property, parseNumericValue]);

  useEffect(() => {
    setSelectedTab(0);
  }, [showInheritanceDetails]);

  const handleTabChange = useCallback(
    (event: React.SyntheticEvent, newValue: number) => {
      setSelectedTab(newValue);
    },
    [],
  );

  const detectPropertyType = useCallback(() => {
    const { propertyType, isNumeric } = inheritanceData;
    if (propertyType) return propertyType;
    if (isNumeric) return "numeric";
    if (Array.isArray(inheritanceData.inheritanceSources[0]?.value))
      return "string-array";
    return "string";
  }, [inheritanceData]);

  const renderValueContent = useCallback(
    (source: InheritanceSource, index: number) => {
      const propType = detectPropertyType();

      switch (propType) {
        case "numeric":
          const numericValue = parseNumericValue(source.value);
          return (
            <Typography
              sx={{
                fontSize: "18px",
                fontWeight: 500,
                color: theme.palette.mode === "dark" ? "#ffffff" : "#000000",
              }}
            >
              {numericValue.value !== "" ? numericValue.value : "0"}
              {numericValue.unit && ` ${numericValue.unit}`}
            </Typography>
          );

        case "string-array":
          if (Array.isArray(source.value) && source.value.length > 0) {
            return (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {source.value.map((item: string, itemIndex: number) => (
                  <Chip
                    key={`${item}-${itemIndex}`}
                    label={item}
                    size="small"
                    sx={{
                      fontSize: "12px",
                      height: "24px",
                      backgroundColor:
                        theme.palette.mode === "dark"
                          ? "rgba(255, 152, 0, 0.1)"
                          : "rgba(25, 118, 210, 0.1)",
                      color:
                        theme.palette.mode === "dark" ? "#ff9800" : "#1976d2",
                      "&:hover": {
                        backgroundColor:
                          theme.palette.mode === "dark"
                            ? "rgba(255, 152, 0, 0.2)"
                            : "rgba(25, 118, 210, 0.2)",
                      },
                    }}
                  />
                ))}
              </Box>
            );
          }
          return (
            <Typography
              sx={{
                fontSize: "14px",
                color:
                  theme.palette.mode === "dark"
                    ? "rgba(255, 255, 255, 0.5)"
                    : "rgba(0, 0, 0, 0.5)",
                fontStyle: "italic",
              }}
            >
              No items
            </Typography>
          );

        case "collection":
          const itemCount = Array.isArray(source.value)
            ? source.value.reduce(
                (count, collection) => count + (collection.nodes?.length || 0),
                0,
              )
            : 0;
          return (
            <Typography
              sx={{
                fontSize: "14px",
                color: theme.palette.mode === "dark" ? "#ffffff" : "#000000",
              }}
            >
              {itemCount} items in collections
            </Typography>
          );

        default:
          return (
            <Typography
              sx={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                lineHeight: 1.4,
                fontSize: "14px",
                color: theme.palette.mode === "dark" ? "#ffffff" : "#000000",
              }}
            >
              {source.value || "No value"}
            </Typography>
          );
      }
    },
    [detectPropertyType, theme, parseNumericValue],
  );

  // const getHelpText = useCallback(() => {
  //   const propType = detectPropertyType();

  //   switch (propType) {
  //     case 'numeric':
  //       return "Note: For numeric values, the first generalization's value is used. You can edit this field to choose a different value or create a custom one.";
  //     case 'string-array':
  //       return "Items from all generalizations are automatically combined and deduplicated. You can edit this field to add, remove, or modify items.";
  //     default:
  //       return undefined;
  //   }
  // }, [detectPropertyType]);

  if (
    !inheritanceData.hasMultipleGeneralizations ||
    !currentVisibleNode.inheritance[property]?.ref
  ) {
    return null;
  }

  const { inheritanceSources } = inheritanceData;

  return (
    <Box
      className={className}
      sx={{
        mt: 2,
        borderTop: `1px solid ${theme.palette.mode === "dark" ? "#404040" : "#e0e0e0"}`,
        borderBottomLeftRadius: "18px",
        borderBottomRightRadius: "18px",
        ...sx,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          mb: showInheritanceDetails ? 2 : 0,
          pt: 2,
          px: 3,
          pb: showInheritanceDetails ? 0 : 1,
        }}
      >
        <Typography
          variant="body2"
          sx={{
            fontWeight: 400,
            fontSize: "15px",
            color: theme.palette.mode === "dark" ? "#ffffff" : "#000000",
          }}
        >
          {capitalizeFirstLetter(DISPLAY[property] || property)} from multiple
          generalizations
        </Typography>
        <Button
          size="small"
          onClick={() => setShowInheritanceDetails(!showInheritanceDetails)}
          sx={{
            ml: "auto",
            minWidth: "auto",
            px: 1,
            py: 0.5,
            color: theme.palette.mode === "dark" ? "#ffffff" : "#000000",
            fontSize: "13px",
            textTransform: "none",
            "&:hover": {
              backgroundColor:
                theme.palette.mode === "dark"
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(0, 0, 0, 0.08)",
            },
          }}
          endIcon={
            showInheritanceDetails ? (
              <ExpandLessIcon fontSize="small" />
            ) : (
              <ExpandMoreIcon fontSize="small" />
            )
          }
        >
          {showInheritanceDetails ? "Hide" : "Show"}
        </Button>
      </Box>

      <Collapse in={showInheritanceDetails}>
        <Box
          sx={{
            width: "100%",
            px: 3,
            pb: 3,
          }}
        >
          <Tabs
            value={selectedTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 36,
              mb: 2,
              "& .MuiTabs-indicator": {
                backgroundColor: "#ff9800",
              },
              "& .MuiTab-root": {
                textTransform: "none",
                fontWeight: 400,
                fontSize: "14px",
                minHeight: 36,
                px: 2,
                py: 1,
                color:
                  theme.palette.mode === "dark"
                    ? "rgba(255, 255, 255, 0.7)"
                    : "rgba(0, 0, 0, 0.7)",
                "&.Mui-selected": {
                  color: "#ff9800",
                  fontWeight: 500,
                },
                "&:hover": {
                  color: theme.palette.mode === "dark" ? "#ffffff" : "#000000",
                },
              },
              "& .MuiTabs-scrollButtons": {
                color:
                  theme.palette.mode === "dark"
                    ? "rgba(255, 255, 255, 0.5)"
                    : "rgba(0, 0, 0, 0.5)",
              },
            }}
          >
            {inheritanceSources.map(
              (
                source: {
                  nodeId: React.Key | null | undefined;
                  nodeTitle:
                    | string
                    | number
                    | bigint
                    | boolean
                    | React.ReactElement<
                        any,
                        string | React.JSXElementConstructor<any>
                      >
                    | Iterable<React.ReactNode>
                    | React.ReactPortal
                    | Promise<React.AwaitedReactNode>
                    | null
                    | undefined;
                },
                index: any,
              ) => (
                <Tab
                  key={source.nodeId}
                  label={source.nodeTitle}
                  sx={{
                    maxWidth: 200,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                />
              ),
            )}
          </Tabs>

          {/* Tab Panels */}
          {inheritanceSources.map(
            (source: InheritanceSource, index: number) => (
              <Box
                key={source.nodeId}
                role="tabpanel"
                hidden={selectedTab !== index}
                sx={{
                  display: selectedTab === index ? "block" : "none",
                  minHeight: 80,
                }}
              >
                {selectedTab === index && (
                  <Box>
                    {/* Source Header */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        mb: 1.5,
                        gap: 1,
                      }}
                    >
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: 500,
                          fontSize: "14px",
                          color:
                            theme.palette.mode === "dark"
                              ? "#ffffff"
                              : "#000000",
                        }}
                      >
                        {source.nodeTitle}
                      </Typography>

                      {source.isInherited && source.inheritedFrom && (
                        <Typography
                          sx={{
                            fontSize: "12px",
                            color:
                              theme.palette.mode === "dark"
                                ? "rgba(255, 255, 255, 0.6)"
                                : "rgba(0, 0, 0, 0.6)",
                          }}
                        >
                          (Inherited from {'"'}
                          {source.inheritedFrom}
                          {'"'})
                        </Typography>
                      )}

                      {(source.nodeId ===
                        currentVisibleNode.inheritance[property]?.ref ||
                        (source.isInherited &&
                          relatedNodes[source.nodeId]?.inheritance[property]?.ref ===
                            currentVisibleNode.inheritance[property]?.ref)) && (
                        <Typography
                          sx={{
                            fontSize: "12px",
                            color: "#ff9800",
                            fontWeight: 500,
                          }}
                        >
                          (Currently Used)
                        </Typography>
                      )}
                    </Box>

                    <Box
                      sx={{
                        p: 2,
                        backgroundColor:
                          theme.palette.mode === "dark" ? "#2a2a2a" : "#f5f5f5",
                        borderRadius: 1,
                        minHeight: 50,
                        border:
                          theme.palette.mode === "dark"
                            ? "1px solid #404040"
                            : "1px solid #e0e0e0",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {renderValueContent(source, index)}
                    </Box>
                  </Box>
                )}
              </Box>
            ),
          )}

          {/* {getHelpText() && (
            <Box sx={{ 
              mt: 2, 
              p: 1.5,
              backgroundColor: theme.palette.mode === 'dark' 
                ? 'rgba(255, 152, 0, 0.1)' 
                : 'rgba(255, 152, 0, 0.05)',
              borderRadius: 1,
              border: `1px solid ${theme.palette.mode === 'dark' 
                ? 'rgba(255, 152, 0, 0.2)' 
                : 'rgba(255, 152, 0, 0.1)'}`
            }}>
              <Typography 
                variant="caption" 
                sx={{ 
                  color: theme.palette.mode === 'dark' 
                    ? 'rgba(255, 255, 255, 0.7)' 
                    : 'rgba(0, 0, 0, 0.7)',
                  fontStyle: 'italic',
                  fontSize: '12px',
                  lineHeight: 1.3
                }}
              >
                {getHelpText()}
              </Typography>
            </Box>
          )} */}
        </Box>
      </Collapse>
    </Box>
  );
};

export default InheritanceDetailsPanel;
