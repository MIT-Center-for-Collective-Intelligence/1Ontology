import { Box, Button, Paper, Typography, useTheme } from "@mui/material";

type NavigationErrorProps = {
  type: "not-found" | "wrong-app";
  onGoBack: () => void;
};

const NavigationError = ({
  type,
  onGoBack,
}: NavigationErrorProps) => {
  const theme = useTheme();

  const getTitle = () => {
    switch (type) {
      case "not-found":
        return "Node Not Found";
      case "wrong-app":
        return "Wrong Ontology";
      default:
        return "Error";
    }
  };

  const getMessage = () => {
    switch (type) {
      case "not-found":
        return "This node doesn't exist in the current ontology.";
      case "wrong-app":
        return `This node belongs to a different ontology.`;
      default:
        return "An error occurred while loading this node.";
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        mt: "125px",
        p: 4,
      }}
    >
      <Typography
        variant="h5"
        sx={{
          mb: 2,
          fontWeight: "bold",
          color: theme.palette.mode === "dark" ? "#ff9800" : "#f57c00",
        }}
      >
        {getTitle()}
      </Typography>
      <Typography variant="body1" sx={{ mb: 3, color: "text.secondary" }}>
        {getMessage()}
      </Typography>
      <Button
        variant="contained"
        onClick={onGoBack}
        sx={{
          borderRadius: "10px",
          textTransform: "none",
          px: 4,
          py: 1.5,
          fontSize: "16px",
        }}
      >
        Go Back
      </Button>
    </Box>
  );
};

export default NavigationError;
