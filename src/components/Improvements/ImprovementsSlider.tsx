import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import { LoadingButton } from "@mui/lab";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import React, { useEffect, useState } from "react";

type IProposalSliderProps = {
  proposals: any;
  setCurrentImprovement: any;
  currentImprovement: any;
  handleAcceptChange: Function;
  setImprovements: any;
  setCurrentVisibleNode: any;
  onNavigateToNode: any;
  compareThisImprovement: any;
  currentIndex: number;
  setCurrentIndex: any;
  currentVisibleNode: any;
  nodesByTitle: any;
};

const ImprovementsSlider = ({
  proposals,
  setCurrentImprovement,
  currentImprovement,
  handleAcceptChange,
  setImprovements,
  setCurrentVisibleNode,
  onNavigateToNode,
  compareThisImprovement,
  currentIndex,
  setCurrentIndex,
  currentVisibleNode,
  nodesByTitle,
}: IProposalSliderProps) => {
  const [implementingProposal, setImplementingProposal] =
    useState<boolean>(false);
  const theme = useTheme();

  useEffect(() => {
    if (!proposals[currentIndex]) {
      return;
    }
    setTimeout(() => {
      if (proposals[currentIndex]?.deleteNode) {
        setCurrentImprovement(proposals[currentIndex]);
        onNavigateToNode(proposals[currentIndex].nodeId);
      } else if (proposals[currentIndex]?.newNode) {
        setCurrentImprovement(proposals[currentIndex]);
        onNavigateToNode(proposals[currentIndex].first_generalization);
      } else {
        onNavigateToNode(proposals[currentIndex].title);
        compareThisImprovement(proposals[currentIndex]);
      }
    }, 100);
  }, []);

  const handleNext = (display = true) => {
    setCurrentIndex((prevIndex: number) => {
      const newPrev = prevIndex === proposals.length - 1 ? 0 : prevIndex + 1;
      if (display) {
        if (proposals[newPrev]?.newNode || proposals[newPrev]?.deleteNode) {
          setCurrentImprovement(proposals[newPrev]);
        } else {
          compareThisImprovement(proposals[newPrev]);
        }

        const nodeTitle = proposals[newPrev]?.newNode
          ? proposals[newPrev].first_generalization
          : proposals[newPrev]?.title;
        onNavigateToNode(nodeTitle);
      }
      return newPrev;
    });
  };

  const handlePrevious = (display = true) => {
    setCurrentIndex((prevIndex: number) => {
      const newPrev = prevIndex === 0 ? proposals.length - 1 : prevIndex - 1;
      if (display) {
        if (proposals[newPrev]?.newNode || proposals[newPrev]?.deleteNode) {
          setCurrentImprovement(proposals[newPrev]);
        } else {
          compareThisImprovement(proposals[newPrev]);
        }

        const nodeTitle = !!proposals[newPrev]?.newNode
          ? proposals[newPrev].first_generalization
          : proposals[newPrev]?.title;

        onNavigateToNode(nodeTitle);
      }
      return newPrev;
    });
  };

  const onHandleAcceptChange = async () => {
    try {
      setImplementingProposal(true);
      const diffChange = await handleAcceptChange(
        currentImprovement,
        currentVisibleNode,
        nodesByTitle,
      );

      setImprovements((prev: any) => {
        prev[currentIndex].implemented = true;
        if (diffChange) {
          prev[currentIndex].diffChange = diffChange;
        }
        return prev;
      });
      setCurrentImprovement((prev: any) => {
        const _prev = { ...prev };
        _prev.implemented = true;
        return _prev;
      });
      setTimeout(() => {
        handleNext();
      }, 2000);
    } catch (error) {
      console.error(error);
    } finally {
      setImplementingProposal(false);
    }
  };

  const onHandleRejectChange = () => {
    setImprovements((prev: any) => {
      prev.splice(currentIndex, 1);
      return prev;
    });
    setTimeout(() => {
      handleNext();
    }, 500);
  };

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        maxWidth: "500px",
        borderRadius: "16px",
        boxShadow: "0 10px 40px -10px rgba(0,0,0,0.15)",
        backgroundColor: theme.palette.mode === "light" ? "#ffffff" : "#1e2329",
        border: "1px solid",
        borderColor: theme.palette.mode === "light" ? "#eaeef2" : "#2d3440",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        mb: 2,
      }}
    >
      {/* Navigation Arrows */}
      {proposals.length > 1 && (
        <>
          <IconButton
            onClick={() => handlePrevious()}
            disabled={implementingProposal}
            sx={{
              position: "absolute",
              left: "12px",
              top: "40%",
              transform: "translateY(-50%)",
              zIndex: 10,
              border: "1.5px solid orange",
              backgroundColor:
                theme.palette.mode === "light"
                  ? "rgba(255, 255, 255, 0.9)"
                  : "rgba(30, 35, 41, 0.9)",
              backdropFilter: "blur(4px)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              "&:hover": {
                backgroundColor:
                  theme.palette.mode === "light" ? "#ffffff" : "#2d3440",
              },
            }}
            size="small"
          >
            <ArrowBackIosNewIcon fontSize="small" sx={{ fontSize: "1rem" }} />
          </IconButton>
          <IconButton
            onClick={() => handleNext()}
            disabled={implementingProposal}
            sx={{
              position: "absolute",
              right: "12px",
              top: "40%",
              transform: "translateY(-50%)",
              zIndex: 10,
              border: "1.5px solid orange",
              backgroundColor:
                theme.palette.mode === "light"
                  ? "rgba(255, 255, 255, 0.9)"
                  : "rgba(30, 35, 41, 0.9)",
              backdropFilter: "blur(4px)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              "&:hover": {
                backgroundColor:
                  theme.palette.mode === "light" ? "#ffffff" : "#2d3440",
              },
            }}
            size="small"
          >
            <ArrowForwardIosIcon fontSize="small" sx={{ fontSize: "1rem" }} />
          </IconButton>
        </>
      )}

      <Box
        sx={{
          display: "flex",
          transition: "transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)",
          transform: `translateX(-${currentIndex * 100}%)`,
          alignItems: "stretch",
        }}
      >
        {proposals.map((proposal: any, index: number) => (
          <Box
            key={index}
            sx={{
              minWidth: "100%",
              p: "28px 60px",
              boxSizing: "border-box",
            }}
          >
            <Box sx={{ minHeight: "220px" }}>
              {(proposal?.newNode || proposal?.deleteNode) && (
                <Box sx={{ mb: 2 }}>
                  <Typography
                    variant="overline"
                    color="primary"
                    sx={{
                      fontWeight: 700,
                      letterSpacing: "0.5px",
                      display: "block",
                      mb: 0.5,
                      lineHeight: 1,
                    }}
                  >
                    {proposal?.newNode ? "Add New Node" : "Delete Node"}
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 800,
                      color: "text.primary",
                      mb: 2,
                      lineHeight: 1.25,
                    }}
                  >
                    {proposal.node?.title || proposal?.title || ""}
                  </Typography>
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    sx={{
                      fontWeight: 600,
                      mb: 0.5,
                      textTransform: "uppercase",
                      fontSize: "0.75rem",
                    }}
                  >
                    Reasoning
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      color: "text.primary",
                      lineHeight: 1.6,
                      opacity: 0.9,
                    }}
                  >
                    {proposal.reasoning}
                  </Typography>
                </Box>
              )}

              {Object.values(proposal.addedNonExistentElements || {}).length >
                0 && (
                <Box
                  sx={{
                    mt: 3,
                    p: 2.5,
                    borderRadius: 3,
                    bgcolor:
                      theme.palette.mode === "light"
                        ? "rgba(237, 108, 2, 0.06)"
                        : "rgba(237, 108, 2, 0.12)",
                    border: "1px solid",
                    borderColor:
                      theme.palette.mode === "light"
                        ? "rgba(237, 108, 2, 0.2)"
                        : "rgba(237, 108, 2, 0.3)",
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{ color: "warning.main", fontWeight: 700, mb: 1.5 }}
                  >
                    New nodes to be created under unclassified:
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={1}>
                    {Object.values(proposal.addedNonExistentElements)
                      .flatMap((c: any) => c)
                      .map((node: any, idx) => (
                        <Chip
                          key={node?.id || idx}
                          label={node?.title || node}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            bgcolor:
                              theme.palette.mode === "light"
                                ? "#fff3e0"
                                : "rgba(237, 108, 2, 0.2)",
                            color: "warning.dark",
                            borderRadius: "6px",
                          }}
                        />
                      ))}
                  </Stack>
                </Box>
              )}

              {!proposal?.newNode &&
                !proposal.deleteNode &&
                proposal?.change?.modified_property && (
                  <Box key={proposal?.change?.modified_property} sx={{ mb: 2 }}>
                    <Typography
                      variant="overline"
                      color="secondary"
                      sx={{
                        fontWeight: 700,
                        letterSpacing: "0.5px",
                        display: "block",
                        mb: 0.5,
                        lineHeight: 1,
                      }}
                    >
                      Modify Property
                    </Typography>
                    <Typography
                      variant="h5"
                      sx={{
                        fontWeight: 800,
                        color: "text.primary",
                        mb: 2,
                        textTransform: "capitalize",
                        lineHeight: 1.25,
                      }}
                    >
                      {proposal.change.modified_property}
                    </Typography>

                    {proposal.change.reasoning && (
                      <>
                        <Typography
                          variant="subtitle2"
                          color="text.secondary"
                          sx={{
                            fontWeight: 600,
                            mb: 0.5,
                            textTransform: "uppercase",
                            fontSize: "0.75rem",
                          }}
                        >
                          Reasoning
                        </Typography>
                        <Typography
                          variant="body1"
                          sx={{
                            color: "text.primary",
                            lineHeight: 1.6,
                            mb: 2,
                            opacity: 0.9,
                          }}
                        >
                          {proposal.change.reasoning}
                        </Typography>
                      </>
                    )}

                    {((proposal.detailsOfChange?.addedNonExistentElements || [])
                      .length > 0 ||
                      Object.keys(proposal.addedNonExistentElements || {})
                        .length > 0) && (
                      <Box
                        sx={{
                          mt: 2,
                          p: 2.5,
                          borderRadius: 3,
                          bgcolor:
                            theme.palette.mode === "light"
                              ? "rgba(237, 108, 2, 0.06)"
                              : "rgba(237, 108, 2, 0.12)",
                          border: "1px solid",
                          borderColor:
                            theme.palette.mode === "light"
                              ? "rgba(237, 108, 2, 0.2)"
                              : "rgba(237, 108, 2, 0.3)",
                        }}
                      >
                        <Typography
                          variant="subtitle2"
                          sx={{
                            color: "warning.main",
                            fontWeight: 700,
                            mb: 1.5,
                          }}
                        >
                          New nodes to be created under unclassified:
                        </Typography>
                        <Stack direction="row" flexWrap="wrap" gap={1}>
                          {Array.isArray(
                            proposal.detailsOfChange?.addedNonExistentElements,
                          ) &&
                            proposal.detailsOfChange.addedNonExistentElements.map(
                              (item: string, index: number) => (
                                <Chip
                                  key={index}
                                  label={item}
                                  size="small"
                                  variant="outlined"
                                  sx={{
                                    fontWeight: 600,
                                    color: "warning.dark",
                                    borderColor: "warning.main",
                                    bgcolor: "rgba(237, 108, 2, 0.05)",
                                    borderRadius: "6px",
                                  }}
                                />
                              ),
                            )}
                        </Stack>
                      </Box>
                    )}
                  </Box>
                )}
            </Box>
          </Box>
        ))}
      </Box>

      {/* Footer Details & Actions */}
      <Box
        sx={{
          p: "20px 24px",
          bgcolor: theme.palette.mode === "light" ? "#f8fafc" : "#111418",
          borderTop: "1px solid",
          borderColor: theme.palette.mode === "light" ? "#eaeef2" : "#2d3440",
          zIndex: 2,
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: currentImprovement?.implemented ? 0 : 2.5,
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box
              sx={{
                px: 1.5,
                py: 0.5,
                borderRadius: "20px",
                bgcolor: theme.palette.mode === "light" ? "#ffffff" : "#2d3440",
                border: "1px solid",
                borderColor:
                  theme.palette.mode === "light" ? "#d1d9e0" : "#444c56",
                fontSize: "0.80rem",
                fontWeight: 700,
                color: "text.secondary",
                boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
              }}
            >
              {currentIndex + 1} / {proposals.length}
            </Box>
            {!!currentImprovement?.implemented && (
              <Chip
                label="Implemented"
                size="small"
                color="success"
                sx={{
                  fontWeight: 700,
                  height: "26px",
                  borderRadius: "6px",
                }}
              />
            )}
          </Stack>
        </Box>

        {!currentImprovement?.implemented && (
          <Stack direction="row" spacing={2}>
            <Button
              onClick={onHandleRejectChange}
              color="error"
              variant="outlined"
              sx={{
                flex: 1,
                borderRadius: "10px",
                textTransform: "none",
                fontWeight: 700,
                borderWidth: "1.5px",
                letterSpacing: "0.3px",
                ":hover": {
                  borderWidth: "1.5px",
                  bgcolor: "rgba(211, 47, 47, 0.04)",
                },
              }}
              disabled={implementingProposal}
            >
              Reject
            </Button>
            <LoadingButton
              loading={implementingProposal}
              onClick={onHandleAcceptChange}
              variant="contained"
              color="success"
              sx={{
                flex: 2,
                borderRadius: "10px",
                textTransform: "none",
                fontWeight: 700,
                letterSpacing: "0.3px",
                boxShadow: "0 4px 14px rgba(46, 125, 50, 0.3)",
                ":hover": {
                  boxShadow: "0 6px 20px rgba(46, 125, 50, 0.4)",
                  transform: "translateY(-1px)",
                },
                transition: "all 0.2s ease",
              }}
            >
              Implement
            </LoadingButton>
          </Stack>
        )}
      </Box>
    </Box>
  );
};

export default ImprovementsSlider;
