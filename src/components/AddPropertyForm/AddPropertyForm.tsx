import React, { useState } from "react";
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Paper,
  Typography,
} from "@mui/material";

interface AddPropertyFormProps {
  addNewProperty: (title: string, type: string) => void;
  locked: boolean;
  setOpenAddProperty: any;
}

const SpecialCharacterRegex = /^[a-zA-Z0-9 ]*$/; // Adjust regex as necessary

const AddPropertyForm: React.FC<AddPropertyFormProps> = ({
  addNewProperty,
  locked,
  setOpenAddProperty,
}) => {
  const [propertyType, setPropertyType] = useState<string>("String");
  const [newPropertyTitle, setNewPropertyTitle] = useState<string>("");
  const [inputError, setInputError] = useState<boolean>(false);

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const isValid = SpecialCharacterRegex.test(value) && value.length <= 30;

    setNewPropertyTitle(value);
    setInputError(!isValid);
  };

  return (
    <Paper
      sx={{
        mt: "20px",
        mb: "20px",
        borderRadius: "18px",
        padding: "20px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
      }}
    >
      <Typography variant="h6" sx={{ mb: "16px" }}>
        Add New Property
      </Typography>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <FormControl variant="outlined" sx={{ borderRadius: "20px" }}>
          <InputLabel id="property-type-label">Type</InputLabel>
          <Select
            labelId="property-type-label"
            value={propertyType}
            onChange={(event) => setPropertyType(event.target.value)}
            label="Property Type"
            sx={{ borderRadius: "20px" }}
          >
            {[
              "String",
              "Activity",
              "Object",
              "Actor",
              "Evaluation Dimension",
              "Incentive",
              "Reward",
            ].map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Property Title"
          value={newPropertyTitle}
          onChange={handleTitleChange}
          error={inputError}
          helperText={
            inputError
              ? "Max 30 characters, no special characters allowed."
              : ""
          }
          InputLabelProps={{
            sx: { color: "grey" },
          }}
        />
        <Box sx={{ display: "flex", gap: "10px" }}>
          <Button
            onClick={() => {
              if (newPropertyTitle && propertyType && !inputError) {
                addNewProperty(newPropertyTitle, propertyType);
                setNewPropertyTitle("");
                setPropertyType("");
              }
            }}
            color="primary"
            disabled={
              !propertyType || !newPropertyTitle || inputError || locked
            }
            variant="contained"
            sx={{
              borderRadius: "18px",
              backgroundColor: "green",
              mt: "10px",
            }}
            fullWidth
          >
            {"Add"}
          </Button>
          <Button
            onClick={() => {
              setOpenAddProperty(false);
              setNewPropertyTitle("");
              setInputError(false);
            }}
            color="primary"
            variant="contained"
            sx={{
              borderRadius: "18px",
              mt: "10px",
              backgroundColor: "red",
            }}
            fullWidth
          >
            {"Cancel"}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
};

export default AddPropertyForm;
