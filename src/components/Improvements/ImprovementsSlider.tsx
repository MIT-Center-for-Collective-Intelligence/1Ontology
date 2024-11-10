import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import { Box, Button, Paper, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";

type IProposalSliderProps = {
  proposals: any;
  setCurrentImprovement: any;
  currentImprovement: any;
  handleAcceptChange: any;
  setImprovements: any;
  setCurrentVisibleNode: any;
  navigateToNode: any;
  compareThisImprovement: any;
};
const ImprovementsSlider = ({
  proposals,
  setCurrentImprovement,
  currentImprovement,
  handleAcceptChange,
  setImprovements,
  setCurrentVisibleNode,
  navigateToNode,
  compareThisImprovement,
}: IProposalSliderProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!proposals[currentIndex]) {
      return;
    }
    setTimeout(() => {
      navigateToNode(proposals[currentIndex].nodeId);

      if (proposals[currentIndex].newNode) {
        setCurrentImprovement(proposals[currentIndex]);
      } else {
        compareThisImprovement(proposals[currentIndex]);
      }
    }, 100);
  }, []);

  const handleNext = (display = true) => {
    setCurrentIndex((prevIndex) => {
      const newPrev = prevIndex === proposals.length - 1 ? 0 : prevIndex + 1;
      if (display) {
        if (proposals[newPrev].newNode) {
          setCurrentImprovement(proposals[newPrev]);
        } else {
          compareThisImprovement(proposals[newPrev]);
        }
        if (proposals[newPrev]?.nodeId) {
          navigateToNode(proposals[newPrev]?.nodeId);
        }
      }
      return newPrev;
    });
  };

  const handlePrevious = (display = true) => {
    setCurrentIndex((prevIndex) => {
      const newPrev = prevIndex === 0 ? proposals.length - 1 : prevIndex - 1;
      if (display) {
        if (proposals[newPrev].newNode) {
          setCurrentImprovement(proposals[newPrev]);
        } else {
          compareThisImprovement(proposals[newPrev]);
        }
        if (proposals[newPrev]?.nodeId) {
          navigateToNode(proposals[newPrev]?.nodeId);
        }
      }
      return newPrev;
    });
  };

  const onHandleAcceptChange = async () => {
    await handleAcceptChange(currentImprovement);
    setImprovements((prev: any) => {
      prev[currentIndex].implemented = true;
      return prev;
    });
    setCurrentImprovement((prev: any) => {
      const _prev = { ...prev };
      _prev.implemented = true;
      return _prev;
    });
  };
  const onHandleRejectChange = () => {
    setImprovements((prev: any) => {
      prev.splice(currentIndex, 1);
      return prev;
    });
    handleNext();
    setTimeout(() => {
      handlePrevious();
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
        {currentImprovement &&
          proposals.map((proposal: any, index: number) => (
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
                disabled={proposal === null}
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
                }}
              >
                {currentImprovement.newNode ? (
                  <Box>
                    <Typography>
                      This proposal adds a new node titled:
                    </Typography>
                    <Typography
                      sx={{
                        fontWeight: "bold",
                        color: "orange",
                        my: "13px",
                        fontSize: "17px",
                      }}
                    >
                      {currentImprovement.node.title}
                    </Typography>
                  </Box>
                ) : (
                  <Typography sx={{ mb: "15px" }}>
                    This proposal changes to{" "}
                    <strong style={{ color: "orange" }}>
                      {currentImprovement.title}
                    </strong>
                    :
                  </Typography>
                )}

                {!currentImprovement.newNode &&
                  Object.keys(currentImprovement.modifiedProperties).map(
                    (p: string) => (
                      <Box key={p} sx={{ mb: "15px" }}>
                        <Typography
                          sx={{
                            textTransform: "capitalize",
                            fontWeight: "bold",
                            color: "orange",
                          }}
                        >
                          {p}:
                        </Typography>
                        <Typography>
                          {" "}
                          {currentImprovement.modifiedProperties[p].reasoning}
                        </Typography>
                        <Typography>
                          Co-pilot is proposing to add
                          <ul>
                            {(
                              currentImprovement.modifiedProperties[p]
                                ?.addedNonExistentElements || []
                            ).map((nodeTitle: string) => (
                              <li style={{ color: "orange" }}>{nodeTitle}</li>
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
                      </Box>
                    )
                  )}

                <Typography
                  sx={{ mr: "15px", mt: "5px", ml: "5px", fontWeight: "bold" }}
                >
                  {index + 1}/{proposals.length}
                </Typography>
                {currentImprovement.implemented && (
                  <Typography
                    sx={{ mt: "15px", fontWeight: "bold", color: "green" }}
                  >
                    Suggested improvement is implemented!
                  </Typography>
                )}
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
                // disabled={currentImprovement === null}
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
          <Button
            onClick={onHandleAcceptChange}
            autoFocus
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
            Implement Improvement
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default ImprovementsSlider;
