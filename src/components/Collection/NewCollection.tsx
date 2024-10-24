import { Paper, TextField, Box, Button } from "@mui/material";
import { useState } from "react";

interface NewCollectionProps {
  onAdd: (collectionName: string) => void;
  onCancel: () => void;
}

const NewCollection: React.FC<NewCollectionProps> = ({ onAdd, onCancel }) => {
  const [collectionName, setCollectionName] = useState("");

  const isInvalidName = (name: string) => {
    const forbiddenNames = ["default", "main"];
    return !forbiddenNames.includes(name.trim().toLowerCase());
  };

  return (
    <Paper
      elevation={9}
      sx={{
        borderRadius: "20px",
        mt: "15px",
        p: 2,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <TextField
        label="Collection Name"
        value={collectionName}
        onChange={(e) => setCollectionName(e.target.value)}
        fullWidth
        variant="outlined"
        InputLabelProps={{
          style: { color: "grey" },
        }}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (collectionName.trim() && isInvalidName(collectionName)) {
              onAdd(collectionName);
            }
          }
        }}
        error={isInvalidName(collectionName)}
        helperText={
          !isInvalidName(collectionName)
            ? 'Name cannot be "default" or "main"'
            : ""
        }
      />
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "10px",
          mt: 2,
        }}
      >
        <Button
          onClick={() => onCancel()}
          variant="outlined"
          sx={{ borderRadius: "18px" }}
        >
          Cancel
        </Button>
        <Button
          onClick={() => onAdd(collectionName)}
          variant="contained"
          sx={{ borderRadius: "18px" }}
          disabled={!collectionName.trim() || !isInvalidName(collectionName)}
        >
          Add
        </Button>
      </Box>
    </Paper>
  );
};

export default NewCollection;
