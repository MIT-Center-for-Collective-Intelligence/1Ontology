import React, { useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  MenuItem,
  ListItemText,
  ListItemIcon,
  ListItem,
  List,
  Link,
  Button,
  TextField,
  useTheme,
  alpha,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ArrowRightAltIcon from "@mui/icons-material/ArrowRightAlt";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import DragHandleIcon from "@mui/icons-material/DragHandle";
import CloseIcon from "@mui/icons-material/Close";
import InheritedPartsLegend from "../Common/InheritedPartsLegend";
import {
  ILinkNode,
  INode,
  InheritedPartsDetail,
} from "@components/types/INode";
import SyncedSpinner from "@components/components/SyncedSpinner";
import {
  computeOrderRuns,
  getPartGeneralizationSources,
  orderBracketsAt,
} from "@components/lib/utils/partsHelper";
import {
  orderRunBracketSx,
  orderRunBracketWrapperSx,
  orderRunRowSx,
} from "@components/lib/utils/partsOrderStyles";
import { makeResolvedOf } from "@components/lib/hooks/useResolvedParts";

const SYMBOL_COL_SX = {
  minWidth: 28,
  width: 28,
  justifyContent: "center",
  display: "flex",
  alignItems: "center",
} as const;

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
  nodes: { [id: string]: any };
  fetchNode?: (nodeId: string) => Promise<INode | null>;
  readOnly?: boolean;
  setDisplayDetails: any;
  displayDetails: boolean;
  inheritedPartsDetails?: InheritedPartsDetail[] | null;
  inheritedPartsRepairing?: boolean;
  currentVisibleNode: any;
  resolvedParts: ILinkNode[];
  navigateToNode?: any;
  triggerSearch?: any;
  addPart?: any;
  removePart?: any;
}

const InheritedPartsViewer: React.FC<InheritedPartsViewerProps> = ({
  selectedProperty,
  getAllGeneralizations,
  nodes,
  fetchNode,
  readOnly = false,
  setDisplayDetails,
  displayDetails,
  inheritedPartsDetails,
  inheritedPartsRepairing,
  currentVisibleNode,
  resolvedParts,
  triggerSearch,
  addPart,
  removePart,
  navigateToNode,
}) => {
  const isDarkMode = useTheme().palette.mode === "dark";
  const [activeTab, setActiveTab] = React.useState<string | null>(null);
  const [hoveredPartIndex, setHoveredPartIndex] = React.useState<number | null>(
    null,
  );
  // Exclude the current node itself — a root node should not appear as its
  // own generalization on the left side of the inheritance viewer.
  const generalizations: GeneralizationNode[] = getAllGeneralizations().filter(
    (g) => g.id !== currentVisibleNode.id,
  );

  // All lists come from the RESOLVED view (ref chain), never raw storage.
  const resolvedOf = useMemo(() => makeResolvedOf(nodes), [nodes]);

  useEffect(() => {
    // Set the first generalization as the active tab initially
    if (generalizations.length > 0 && !activeTab) {
      setActiveTab(generalizations[0].id);
    } else if (
      generalizations.length > 0 &&
      !generalizations.find((g) => g.id === activeTab)
    ) {
      // If the active tab is no longer in the list, reset to the first one
      setActiveTab(generalizations[0].id);
    } else if (generalizations.length === 0) {
      // Clear active tab if there are no generalizations
      setActiveTab(null);
    }
  }, [currentVisibleNode.id]); // Use node ID to avoid infinite loop

  if (selectedProperty !== "parts") return null;

  const getPartOptionalStatus = (partId: string, nodeId: string): boolean => {
    return !!resolvedOf(nodeId).find((n) => n.id === partId)?.optional;
  };

  const getCurrentPartOptionalStatus = (partId: string): boolean => {
    return !!resolvedParts.find((n) => n.id === partId)?.optional;
  };

  // Which gen this part is inherited through right now: the user's pick (via)
  // if still valid, else the overall source, else the first gen that provides
  // the part with the same owner. Undefined for owned parts or no match.
  const getPartCurrentSourceGenId = (partId: string): string | undefined => {
    const part = resolvedParts.find((n) => n.id === partId);
    if (!part?.inheritedFrom) return undefined;
    const withOwners = getPartGeneralizationSources(
      partId,
      generalizations,
      nodes,
    ).map((p) => {
      const genPart = resolvedOf(p.generalizationId).find(
        (n) => n.id === partId,
      );
      return {
        genId: p.generalizationId,
        owner: genPart?.inheritedFrom || p.generalizationId,
      };
    });
    if (part.via && withOwners.some((s) => s.genId === part.via)) {
      return part.via;
    }
    const matching = withOwners
      .filter((s) => s.owner === part.inheritedFrom)
      .map((s) => s.genId);
    const overallSource = currentVisibleNode.partsInheritance?.source ?? "";
    return matching.includes(overallSource) ? overallSource : matching[0];
  };

  // The generalization title a part is specifically inherited from: the
  // picked gen (via) when recorded, else the gen its owner resolves through.
  const getPartSpecificSourceTitle = (partId: string): string | null => {
    const part = resolvedParts.find((n) => n.id === partId);
    if (!part?.inheritedFrom) return null;
    const providers = getPartGeneralizationSources(
      partId,
      generalizations,
      nodes,
    );
    if (providers.length < 2) return null;
    const picked = part.via
      ? providers.find((p) => p.generalizationId === part.via)
      : undefined;
    const current =
      picked ??
      providers.find((p) => {
        const genPart = resolvedOf(p.generalizationId).find(
          (n) => n.id === partId,
        );
        return (
          (genPart?.inheritedFrom || p.generalizationId) === part.inheritedFrom
        );
      });
    return (
      current?.generalizationTitle ?? nodes[part.inheritedFrom]?.title ?? null
    );
  };

  const formatPartTitle = (
    title: string,
    isOptional: boolean,
    optionalChange?: "added" | "removed" | "none",
  ) => {
    if (optionalChange === "added") {
      return (
        <Box component="span" sx={{ display: "inline" }}>
          {title}{" "}
          <Box component="span" sx={{ color: "#ff9500", fontWeight: "bold" }}>
            +?
          </Box>
        </Box>
      );
    } else if (optionalChange === "removed") {
      return (
        <Box component="span" sx={{ display: "inline" }}>
          {title}{" "}
          <Box
            component="span"
            sx={{
              textDecoration: "line-through",
              color: "#ff9500",
              fontWeight: "bold",
            }}
          >
            ?
          </Box>
        </Box>
      );
    } else if (isOptional) {
      return (
        <Box component="span" sx={{ display: "inline" }}>
          {title}{" "}
          <Box component="span" sx={{ color: "#ff9500", fontWeight: "bold" }}>
            ?
          </Box>
        </Box>
      );
    }

    return title;
  };

  const getTabContent = (generalizationId: string): JSX.Element => {
    const genTitle =
      generalizations.find((g) => g.id === generalizationId)?.title ?? "";
    // Check if node has any parts at all
    const hasParts = resolvedParts.length > 0;

    if (!hasParts) {
      return (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            py: 2,
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: (theme) =>
                theme.palette.mode === "light" ? "#95a5a6" : "#7f8c8d",
              fontStyle: "italic",
              fontSize: "0.75rem",
            }}
          >
            No parts available
          </Typography>
        </Box>
      );
    }

    // Check if there is cached data for this generalization
    const cachedGeneralizationData = inheritedPartsDetails?.find(
      (calc) => calc.generalizationId === generalizationId,
    );

    if (!inheritedPartsDetails || !cachedGeneralizationData) {
      return (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            py: 2,
          }}
        >
          <SyncedSpinner size={16} />
          <Typography
            variant="body2"
            sx={{
              color: (theme) =>
                theme.palette.mode === "light" ? "#95a5a6" : "#7f8c8d",
              fontStyle: "italic",
              fontSize: "0.75rem",
            }}
          >
            Loading...
          </Typography>
        </Box>
      );
    }

    const details = cachedGeneralizationData.details || [];
    const orderRuns = computeOrderRuns(
      details,
      resolvedOf(generalizationId).map((p: ILinkNode) => p.id),
    );

    return (
      <Box>
        <List
          dense
          disablePadding
          sx={{
            border: (theme) =>
              details.length > 0
                ? `1px dashed ${alpha(theme.palette.divider, theme.palette.mode === "dark" ? 0.55 : 0.85)}`
                : "none",
            borderRadius: "16px",
            backgroundColor: (theme) =>
              details.length > 0
                ? alpha(
                    theme.palette.common.white,
                    theme.palette.mode === "dark" ? 0.02 : 0.4,
                  )
                : "transparent",
            py: 1,
            px: 1.5,
            my: 1.5,
          }}
        >
          {details.map((entry, index) => {
            const brackets = orderBracketsAt(orderRuns, index);
            const isMissing = entry.symbol === "x";
            // Read the part's optional state live from parts (details is just
            // the reference), so the badge updates on toggle without a recompute.
            const liveToOptional = entry.to
              ? getCurrentPartOptionalStatus(entry.to)
              : !!entry.toOptional;
            const liveOptionalChange: "added" | "removed" | "none" =
              entry.from && entry.to
                ? entry.fromOptional === liveToOptional
                  ? "none"
                  : liveToOptional
                    ? "added"
                    : "removed"
                : "none";
            return (
              <React.Fragment key={`${entry.from}-${entry.to}`}>
                <ListItem
                  dense
                  disableGutters
                  onMouseEnter={() => setHoveredPartIndex(index)}
                  onMouseLeave={() => setHoveredPartIndex(null)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    pr: 0,
                    minHeight: 0,
                    boxSizing: "border-box",
                    ...orderRunRowSx(isDarkMode, index === details.length - 1),
                    // Missing parts (gen has it, node doesn't) — de-emphasised
                    ...(isMissing && {
                      opacity: 0.5,
                      fontStyle: "italic",
                    }),
                    "&:hover .part-remove-button, &:focus-within .part-remove-button":
                      {
                        opacity: 1,
                        pointerEvents: "auto",
                      },
                    // Restore full opacity on hover so the add-button is easy to click
                    ...(isMissing && { "&:hover": { opacity: 0.8 } }),
                  }}
                >
                  {brackets.length > 0 && (
                    <Box sx={orderRunBracketWrapperSx()}>
                      {brackets.map((seg) => (
                        <Box
                          key={seg.depth}
                          sx={orderRunBracketSx(seg, isDarkMode)}
                        />
                      ))}
                    </Box>
                  )}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.5,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {!readOnly &&
                      entry.from &&
                      entry.symbol !== "x" &&
                      entry.symbol !== "=" && (
                        <ListItemIcon sx={{ minWidth: "auto" }}>
                          <Tooltip title="Search it below" placement="left">
                            <IconButton
                              sx={{ p: 0.4 }}
                              onClick={() =>
                                triggerSearch({
                                  id: entry.from,
                                  title: nodes[entry.from]?.title || "Unknown",
                                })
                              }
                            >
                              <SearchIcon
                                sx={{ fontSize: 19, color: "orange" }}
                              />
                            </IconButton>
                          </Tooltip>
                        </ListItemIcon>
                      )}

                    <ListItemText
                      primary={
                        entry.from ? (
                          <Link
                            underline={!!navigateToNode ? "hover" : "none"}
                            onClick={(e) => {
                              if (!navigateToNode) return;

                              if (e.metaKey || e.ctrlKey) {
                                const url = `${window.location.origin}${window.location.pathname}#${entry.from}`;
                                window.open(url, "_blank");
                              } else {
                                navigateToNode(entry.from);
                              }
                            }}
                            sx={{
                              cursor: !!navigateToNode ? "pointer" : "",
                              color: (them) =>
                                them.palette.mode === "dark"
                                  ? "white"
                                  : "black",
                              fontSize: "0.9rem",
                            }}
                          >
                            {formatPartTitle(
                              entry.fromTitle,
                              entry.fromOptional || false,
                            )}
                          </Link>
                        ) : null
                      }
                      sx={{ flex: 1, minWidth: 0, my: 0 }}
                    />
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 0.5,
                      flexShrink: 0,
                      px: 0.5,
                    }}
                  >
                    {!readOnly && entry.symbol === "=" && !!removePart && (
                      <Tooltip title={"Remove part"} placement="top">
                        <Box
                          component="span"
                          className="part-remove-button"
                          sx={{
                            display: "inline-flex",
                            opacity: 0,
                            pointerEvents: "none",
                            transition: "opacity 0.2s ease-in-out",
                            "&:focus-within": {
                              opacity: 1,
                              pointerEvents: "auto",
                            },
                          }}
                        >
                          <IconButton
                            sx={{ p: 0.5 }}
                            onClick={() => {
                              removePart(entry.to);
                            }}
                          >
                            <DeleteOutlineIcon
                              sx={{
                                fontSize: 20,
                                color: "red",
                              }}
                            />
                          </IconButton>
                        </Box>
                      </Tooltip>
                    )}

                    {!readOnly && entry.symbol === "x" && !!addPart && (
                      <Tooltip title={"Add Part"} placement="top">
                        <IconButton
                          sx={{ p: 0.5 }}
                          onClick={() => {
                            addPart(entry.from);
                          }}
                        >
                          <AddIcon
                            sx={{
                              fontSize: 20,
                              color: "green",
                              border: "1px solid green",
                              borderRadius: "50%",
                            }}
                          />
                        </IconButton>
                      </Tooltip>
                    )}

                    <ListItemIcon sx={SYMBOL_COL_SX}>
                      {entry.symbol === "x" ? (
                        <Tooltip
                          title={`"${genTitle}" has this part, but this node does not inherit it.`}
                          placement="top"
                        >
                          <CloseIcon sx={{ fontSize: 20, color: "orange" }} />
                        </Tooltip>
                      ) : entry.symbol === ">" ? (
                        <Tooltip
                          title={`"${genTitle}" has the part "${entry.fromTitle}". This node has "${entry.toTitle}", a descendant of it.`}
                          placement="top"
                        >
                          <ArrowForwardIosIcon
                            sx={{
                              fontSize: 20,
                              color: "orange",
                              p: 0.2,
                              borderRadius: "50%",
                            }}
                          />
                        </Tooltip>
                      ) : entry.symbol === "=" ? (
                        // A part specifically inherited through ANOTHER gen is
                        // not "equal" on this tab — hide the symbol but keep its
                        // space so the row columns stay aligned.
                        (() => {
                          const src = getPartCurrentSourceGenId(entry.to);
                          return (
                            <Tooltip
                              title={`This part is inherited from "${genTitle}". If it changes there, it changes here too.`}
                              placement="top"
                            >
                              <DragHandleIcon
                                sx={{
                                  fontSize: 20,
                                  color: "orange",
                                  visibility:
                                    src === undefined ||
                                    src === generalizationId
                                      ? "visible"
                                      : "hidden",
                                }}
                              />
                            </Tooltip>
                          );
                        })()
                      ) : entry.symbol === "+" ? (
                        <Tooltip
                          title={`This part was added directly to this node. "${genTitle}" does not have it, so it is not inherited.`}
                          placement="top"
                        >
                          <AddIcon sx={{ fontSize: 20, color: "orange" }} />
                        </Tooltip>
                      ) : null}
                    </ListItemIcon>
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <ListItemText
                      primary={
                        entry.to ? (
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                              width: "100%",
                            }}
                          >
                            <Link
                              underline={!!navigateToNode ? "hover" : "none"}
                              onClick={(e) => {
                                if (!navigateToNode) return;

                                if (e.metaKey || e.ctrlKey) {
                                  const url = `${window.location.origin}${window.location.pathname}#${entry.to}`;
                                  window.open(url, "_blank");
                                } else {
                                  navigateToNode(entry.to);
                                }
                              }}
                              sx={{
                                cursor: !!navigateToNode ? "pointer" : "",
                                color: (them) =>
                                  them.palette.mode === "dark"
                                    ? "white"
                                    : "black",
                                fontSize: "0.9rem",
                              }}
                            >
                              {formatPartTitle(
                                entry.toTitle,
                                liveToOptional,
                                liveOptionalChange,
                              )}
                            </Link>
                            {(() => {
                              const sourceTitle = getPartSpecificSourceTitle(
                                entry.to,
                              );
                              return sourceTitle ? (
                                <Typography
                                  sx={{
                                    ml: "auto",
                                    flexShrink: 0,
                                    fontSize: "0.72rem",
                                    fontStyle: "italic",
                                    color: "gray",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {`(Inherited from "${sourceTitle}")`}
                                </Typography>
                              ) : null;
                            })()}
                          </Box>
                        ) : null
                      }
                      sx={{ flex: 1, minWidth: 0, my: 0 }}
                    />
                  </Box>
                </ListItem>
              </React.Fragment>
            );
          })}
        </List>
      </Box>
    );
  };
  // Get active generalization directly from generalizations array
  const activeGeneralization = generalizations.find((g) => g.id === activeTab);
  const activeGenId = activeGeneralization?.id;
  const activeGenTitle = activeGeneralization?.title;

  if (generalizations.length <= 0) {
    return null; // No generalizations and no own parts (root without parts)
  }

  return (
    <Box>
      {!displayDetails && (
        <Button
          variant="outlined"
          sx={{
            borderRadius: "25px",
            p: 0.5,
            px: 2,
            ml: "10px",
            mb: "9px",
          }}
          onClick={() => {
            setDisplayDetails((prev: boolean) => !prev);
          }}
        >
          <KeyboardArrowDownIcon />
          Parts inherited from ...
        </Button>
      )}
      {displayDetails && (
        <Box
          sx={{
            /*             px: "10px", */
            mt: "8px",
            backgroundColor: (theme) =>
              theme.palette.mode === "light" ? "#fafbfc" : "#1e1e1f",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: (theme: any) =>
                `1.5px solid ${theme.palette.mode === "light" ? "#f0f0f0" : "#333"}`,
              mb: "10px",
              py: "15px",
              px: "10px",
            }}
          >
            <Typography
              sx={{ ml: "7px", fontSize: "19px", fontWeight: "bold" }}
            >
              {"Parts inherited from generalizations:"}
            </Typography>

            {!triggerSearch && (
              <Button
                sx={{
                  border: "1px solid gray",
                  p: 0,
                  backgroundColor: "",
                  color: "gray",
                  borderRadius: "25px",
                }}
                onClick={() => {
                  setDisplayDetails(false);
                }}
              >
                Hide
              </Button>
            )}
          </Box>

          {activeGenId && activeGenTitle && (
            <Box key={activeGenId} sx={{ px: "10px" }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  height: 40,
                  position: "relative",
                  mx: 2,
                  mt: 2,
                  mb: inheritedPartsRepairing ? 4 : 2.5,
                }}
              >
                {/* Left Text */}
                <Box
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    pr: "30px", // space to avoid overlap with center icon
                  }}
                >
                  {generalizations.length > 1 ? (
                    <TextField
                      value={activeGenId}
                      onChange={(e) => setActiveTab(e.target.value)}
                      select
                      label="Generalizations"
                      sx={{ flex: 1, minWidth: 0 }}
                      slotProps={{
                        input: {
                          sx: {
                            height: "40px",
                            borderRadius: "18px",
                            color: "orange",
                            fontWeight: 700,
                            fontSize: "1.15rem",
                            backgroundColor: (theme) =>
                              theme.palette.background.paper,
                          },
                        },
                        inputLabel: { style: { color: "grey" } },
                        select: {
                          MenuProps: {
                            PaperProps: {
                              sx: {
                                border: "2px solid orange",
                                borderRadius: "12px",
                                "&::-webkit-scrollbar": { display: "none" },
                              },
                            },
                            MenuListProps: {
                              sx: { paddingTop: 0, paddingBottom: 0 },
                            },
                          },
                          renderValue: () => (
                            <Box
                              sx={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {activeGenTitle}
                            </Box>
                          ),
                        },
                      }}
                    >
                      {generalizations.map((gen) => (
                        <MenuItem
                          key={gen.id}
                          value={gen.id}
                          sx={{
                            border: "1px solid gray",
                            borderRadius: "25px",
                            my: "4px",
                            mx: "8px",
                          }}
                        >
                          <Typography>{gen.title}</Typography>
                        </MenuItem>
                      ))}
                    </TextField>
                  ) : (
                    <Tooltip title={activeGenTitle}>
                      <Typography
                        sx={{
                          color: "orange",
                          fontWeight: 700,
                          fontSize: "1.15rem",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {activeGenTitle}
                      </Typography>
                    </Tooltip>
                  )}
                </Box>

                <Box
                  sx={{
                    position: "absolute",
                    left: "50%",
                    transform: "translateX(-50%)",
                  }}
                >
                  {/* Rows keep rendering; only the arrow hints that the
                      annotation is recomputing. */}
                  {inheritedPartsRepairing ? (
                    <SyncedSpinner size={20} />
                  ) : (
                    <ArrowRightAltIcon
                      sx={{ color: "orange", fontSize: "50px" }}
                    />
                  )}
                </Box>

                {inheritedPartsRepairing && (
                  <Typography
                    sx={{
                      position: "absolute",
                      top: "100%",
                      left: "50%",
                      transform: "translateX(-50%)",
                      mt: "1px",
                      fontSize: "0.75rem",
                      fontWeight: "bold",
                      fontStyle: "italic",
                      color: "orange",
                      whiteSpace: "nowrap",
                      pointerEvents: "none",
                    }}
                  >
                    Calculating inheritance…
                  </Typography>
                )}

                <Box
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    pl: "30px",
                    display: "flex",
                    justifyContent: "flex-end",
                  }}
                >
                  <Tooltip title={currentVisibleNode.title}>
                    <Typography
                      sx={{
                        fontWeight: 700,
                        fontSize: "1.15rem",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        cursor: "default",
                      }}
                    >
                      {currentVisibleNode.title}
                    </Typography>
                  </Tooltip>
                </Box>
              </Box>

              {getTabContent(activeGenId)}
            </Box>
          )}

          <InheritedPartsLegend sx={{ px: 2, pr: 3 }} />
        </Box>
      )}
    </Box>
  );
};

export default InheritedPartsViewer;
