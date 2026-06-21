import React, { useState } from "react";
import { Box, Typography, Button } from "@mui/material";

const SolutionsTab = ({
  solutions = [],
  selectedSolutionId,
  setSelectedSolutionId,
}: {
  solutions: any;
  selectedSolutionId: string;
  setSelectedSolutionId: any;
}) => {
  const [currentSolutionIndex, setCurrentSolutionIndex] = useState(0);

  const handleNext = () => {
    if (currentSolutionIndex < solutions.length - 1) {
      setCurrentSolutionIndex(currentSolutionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentSolutionIndex > 0) {
      setCurrentSolutionIndex(currentSolutionIndex - 1);
    }
  };

  if (solutions.length === 0) return null;

  return (
    <Box sx={{ padding: 2 }}>
      <Box sx={{ my: 2, borderRadius: "25px", border: "1px solid gray", p: 3 }}>
        <Typography>
          <strong style={{ color: "orange", fontWeight: "bold" }}>
            Description:
          </strong>{" "}
          {solutions[currentSolutionIndex].description}
        </Typography>
        <Typography sx={{ mt: "13px" }}>
          <strong style={{ color: "orange", fontWeight: "bold" }}>
            Advantages:
          </strong>{" "}
          {solutions[currentSolutionIndex].advantages}
        </Typography>
      </Box>

      {/* Navigation buttons */}
      <Box sx={{ display: "flex", gap: "15px" }}>
        <Button
          sx={{ borderRadius: "25px" }}
          onClick={handlePrevious}
          variant="outlined"
          disabled={currentSolutionIndex === 0}
        >
          Previous
        </Button>
        <Button
          sx={{ borderRadius: "25px" }}
          onClick={handleNext}
          variant="outlined"
          disabled={currentSolutionIndex === solutions.length - 1}
        >
          Next
        </Button>
        <Button
          sx={{
            borderRadius: "25px",
            backgroundColor:
              selectedSolutionId === solutions[currentSolutionIndex].id
                ? "green"
                : "",
          }}
          variant="outlined"
          onClick={() => {
            setSelectedSolutionId((prev:any) => {
              if (prev === solutions[currentSolutionIndex].id) {
                return null;
              } else {
                return solutions[currentSolutionIndex].id;
              }
            });
          }}
        >
          {selectedSolutionId === solutions[currentSolutionIndex].id
            ? "Unselect"
            : "View"}
        </Button>
      </Box>
    </Box>
  );
};

export default SolutionsTab;
