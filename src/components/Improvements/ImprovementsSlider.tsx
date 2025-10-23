import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import { LoadingButton } from "@mui/lab";
import { Box, Button, List, ListItem, Paper, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

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
  titleToIdMap: { [title: string]: string };
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
  titleToIdMap,
}: IProposalSliderProps) => {
  const [implementingProposal, setImplementingProposal] =
    useState<boolean>(false);
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
        titleToIdMap,
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
        width: "450px",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "flex",
          transition: "transform 0.5s ease-in-out",
          transform: `translateX(-${currentIndex * 100}%)`,
        }}
      >
        {proposals.map((proposal: any, index: number) => (
          <Box key={index} sx={{ display: "flex", minWidth: "100%" }}>
            <Button
              variant="contained"
              sx={{
                minWidth: "32px",
                p: 0,
                m: 0,
                // ml: "-14px",
                backgroundColor: "#1973d3",
                borderTopLeftRadius: "0px",
                borderBottomLeftRadius: "0px",
                ":hover": { backgroundColor: "#084694" },
                zIndex: 99999,
              }}
              onClick={() => handlePrevious()}
              disabled={proposals.length === 1 || implementingProposal}
            >
              <ArrowBackIosNewIcon />
            </Button>

            <Paper
              sx={{
                p: "15px",
                mx: "5px",
                width: "400px",
                textAlign: "left",
                backgroundColor: (theme) =>
                  theme.palette.mode === "light" ? "#d0d5dd" : "",
                position: "relative",
              }}
            >
              {(proposal?.newNode || proposal?.deleteNode) && (
                <Box sx={{ mb: "16px" }}>
                  {proposal?.newNode ? (
                    <Typography>
                      This proposal adds a new node titled:
                    </Typography>
                  ) : (
                    <Typography>
                      This proposal suggest to delete the node titled:
                    </Typography>
                  )}
                  <Typography
                    sx={{
                      fontWeight: "bold",
                      color: "orange",
                      fontSize: "17px",
                    }}
                  >
                    {proposal.node?.title || proposal?.title || ""}
                  </Typography>
                  <Typography sx={{ mt: "15px" }}>Reasoning:</Typography>
                  <Typography>{proposal.reasoning}</Typography>
                </Box>
              )}{" "}
              {Object.values(proposal.addedNonExistentElements || {}).length >
                0 && (
                <Typography sx={{ color: "orange" }}>
                  {`The nodes below don't exist in the ontology yet. By
                  accepting this proposal, the new nodes will be created under unclassified:`}
                </Typography>
              )}
              {Object.values(proposal.addedNonExistentElements || {}).length >
                0 && (
                <ul style={{ marginBottom: "25px" }}>
                  {Object.values(proposal.addedNonExistentElements)
                    .flatMap((c) => c)
                    .map((node: any) => (
                      <li key={node.id}>{node.title}</li>
                    ))}
                </ul>
              )}
              {!proposal?.newNode &&
                !proposal.deleteNode &&
                proposal?.change?.modified_property && (
                  <Box
                    key={proposal?.change?.modified_property}
                    sx={{ mb: "15px" }}
                  >
                    <Typography
                      sx={{
                        // fontWeight: "bold",
                        // color: "orange",
                        mb: "5px",
                      }}
                    >
                      Changing{" "}
                      <strong
                        style={{
                          color: "orange",
                          textTransform: "capitalize",
                        }}
                      >
                        {proposal.change.modified_property}
                      </strong>{" "}
                      {proposal.change.reasoning ? "because" : ""}:
                    </Typography>
                    <Typography sx={{ pb: "24px" }}>
                      {" "}
                      {proposal.change.reasoning}
                    </Typography>
                    {(proposal.detailsOfChange.addedNonExistentElements.length >
                      0 ||
                      Object.keys(
                        proposal.detailsOfChange.addedNonExistentElements,
                      ).length > 0) && (
                      <Typography>
                        {`The nodes below don't exist in the ontology yet. By
                        accepting this proposal, the new nodes will be created under unclassified:`}
                      </Typography>
                    )}
                    {(proposal.detailsOfChange.addedNonExistentElements.length >
                      0 ||
                      Object.keys(proposal.addedNonExistentElements || {})
                        .length > 0) && (
                      <ul style={{ marginBottom: "35px" }}>
                        {Array.isArray(
                          proposal.detailsOfChange.addedNonExistentElements,
                        ) &&
                          proposal.detailsOfChange.addedNonExistentElements.map(
                            (item: string, index: number) => (
                              <li key={item}>
                                <Typography key={index} variant="body1">
                                  {item}
                                </Typography>{" "}
                              </li>
                            ),
                          )}
                      </ul>
                    )}
                    {/*      {(
                    currentImprovement.modifiedProperties[p]
                      ?.addedNonExistentElements || []
                  ).length > 0 && (
                    <Typography>
                      AI Assistant is proposing to add
                      <ul>
                        {(
                          currentImprovement.modifiedProperties[p]
                            ?.addedNonExistentElements || []
                        ).map((nodeTitle: string) => (
                          <li key={nodeTitle} style={{ color: "orange" }}>
                            {nodeTitle}
                          </li>
                        ))}
                      </ul>
                      as a new {p}, but such{" "}
                      {(
                        currentImprovement.modifiedProperties[p]
                          ?.addedNonExistentElements || []
                      ).length > 2
                        ? "nodes do"
                        : "a node does"}{" "}
                      not exist.
                    </Typography>
                  )} */}
                  </Box>
                )}
              <Typography
                sx={{
                  position: "absolute",
                  bottom: "15px",
                  left: "15px",
                  display: "flex",
                  // flexDirection: "inline",
                  fontWeight: "bold",
                  gap: "13px",
                }}
              >
                {index + 1}/{proposals.length}
                {!!currentImprovement?.implemented && (
                  <Typography
                    sx={{
                      fontWeight: "bold",
                      color: "green",
                    }}
                  >
                    Suggested improvement is implemented!
                  </Typography>
                )}
              </Typography>
            </Paper>

            <Button
              variant="contained"
              sx={{
                minWidth: "32px",
                p: 0,
                m: 0 /* , mr: "-14px" */,
                borderTopRightRadius: "0px",
                borderBottomRightRadius: "0px",
              }}
              onClick={() => handleNext()}
              disabled={proposals.length === 1 || implementingProposal}
            >
              <ArrowForwardIosIcon />
            </Button>
          </Box>
        ))}
      </Box>

      {!currentImprovement?.implemented && (
        <Box
          sx={{
            display: "flex",
            gap: "20px",
            alignItems: "center",
            my: "13px",
          }}
        >
          <Button
            onClick={onHandleRejectChange}
            color="error"
            variant="contained"
          >
            Delete Improvement
          </Button>
          <LoadingButton
            loading={implementingProposal}
            onClick={onHandleAcceptChange}
            variant="contained"
            sx={{
              ml: "auto",
              color: "white",
              backgroundColor: "#115f07",
              ":hover": {
                backgroundColor: "green",
              },
            }}
          >
            {" "}
            Implement Improvement
          </LoadingButton>
        </Box>
      )}
    </Box>
  );
};

export default ImprovementsSlider;
