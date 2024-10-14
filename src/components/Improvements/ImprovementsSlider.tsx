import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import { Box, Button, Paper, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";
import MarkdownRender from "../Markdown/MarkdownRender";

type IProposalSliderProps = {
  proposals: any;
  setCurrentImprovement: any;
  handleAcceptChange: any;
  setImprovements: any;
  handleRejectChange: any;
};
const ImprovementsSlider = ({
  proposals,
  setCurrentImprovement,
  handleAcceptChange,
  setImprovements,
  handleRejectChange,
}: IProposalSliderProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!proposals[currentIndex]) {
      return;
    }
    setTimeout(() => {
      setCurrentImprovement(proposals[currentIndex]);
    }, 100);
  }, [currentIndex]);

  const handleNext = (display = true) => {
    setCurrentIndex((prevIndex) => {
      const newPrev = prevIndex === proposals.length - 1 ? 0 : prevIndex + 1;
      if (display) {
        setCurrentImprovement(proposals[newPrev]);
      }
      return newPrev;
    });
  };

  const handlePrevious = (display = true) => {
    setCurrentIndex((prevIndex) => {
      const newPrev = prevIndex === 0 ? proposals.length - 1 : prevIndex - 1;
      if (display) {
        setCurrentImprovement(proposals[newPrev]);
      }
      return newPrev;
    });
  };
  const onHandleAcceptChange = async () => {
    await handleAcceptChange(proposals[currentIndex]);
    handleNext(false);
    // setImprovements((prev: any) => {
    //   prev.splice(currentIndex, 1);
    //   return prev;
    // });
    if (proposals.length <= 0) {
      return;
    }
    handlePrevious();
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
    handleRejectChange();
  };

  const generateSuggestionMessage = (suggestion: any): string => {
    return "Invalid action.";
  };

  return (
    <Box
      sx={{
        position: "relative",
        width: "410px",
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
              disabled={proposal === null}
            >
              <ArrowBackIosNewIcon />
            </Button>

            <Paper sx={{ p: "15px", m: "17px", width: "300px" }}>
              {Object.keys(proposal || {}).length > 0 && (
                <Box sx={{ mb: "15px" }}>
                  <strong style={{ fontWeight: "bold", marginRight: "5px" }}>
                    {" "}
                    Proposal:
                  </strong>{" "}
                  <MarkdownRender
                    text={proposal.improvementDetails}
                    sx={{
                      fontSize: "16px",
                      fontWeight: 400,
                      letterSpacing: "inherit",
                    }}
                  />
                </Box>
              )}
              <strong style={{ fontWeight: "bold", marginRight: "5px" }}>
                {" "}
                Description:
              </strong>{" "}
              <Typography sx={{ display: "flex" }}>
                {" "}
                {(proposal || {}).description}
              </Typography>
              <Typography
                sx={{ mr: "15px", mt: "5px", ml: "5px", fontWeight: "bold" }}
              >
                {currentIndex + 1}/{proposals.length}
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
              // disabled={currentImprovement === null}
            >
              <ArrowForwardIosIcon />
            </Button>
          </Box>
        ))}
      </Box>
      <Box
        sx={{ display: "flex", gap: "20px", alignItems: "center", my: "13px" }}
      >
        <Button
          onClick={onHandleRejectChange}
          color="error"
          variant="contained"
        >
          Delete Proposal
        </Button>
        <Button
          onClick={onHandleAcceptChange}
          color="success"
          autoFocus
          variant="contained"
          sx={{ ml: "auto" }}
        >
          Implement Proposal
        </Button>
      </Box>
    </Box>
  );
};

export default ImprovementsSlider;
