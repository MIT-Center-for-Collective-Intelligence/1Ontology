import React, { useState, useEffect } from "react";
import { Box, TextField, IconButton, Tooltip } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DoneIcon from "@mui/icons-material/Done";

const SpecialCharacterRegex = /^[a-zA-Z0-9 ]*$/;

const EditProperty = ({
  value,
  onChange,
  onSave,
  onCancel,
  property,
}: {
  value: string;
  onChange: (val: string) => void;
  onSave: () => void;
  onCancel: () => void;
  property: string;
}) => {
  const [inputError, setInputError] = useState(false);

  useEffect(() => {
    const isValid = SpecialCharacterRegex.test(value) && value.length <= 30;
    setInputError(!isValid);
  }, [value]);

  const handleChange = (newValue: string) => {
    onChange(newValue);
  };

  const isUnchanged = property.trim() === value.trim();
  const isEmpty = value.trim() === "";
  const canSave = !inputError && !isUnchanged && !isEmpty;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
      <TextField
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && canSave) {
            onSave();
          } else if (e.key === "Escape") {
            onCancel();
          }
        }}
        error={inputError}
        helperText={
          inputError ? "Max 30 characters, no special characters allowed." : ""
        }
        autoFocus
        fullWidth
        variant="outlined"
        size="small"
        sx={{
          "& .MuiOutlinedInput-root": {
            borderRadius: "15px",
          },
        }}
      />

      <Tooltip title="Save" placement="top">
        <span>
          <IconButton
            onClick={onSave}
            color="success"
            aria-label="save"
            sx={{
              borderRadius: "50%",
              border: `1px solid ${canSave ? "green" : "gray"}`,
            }}
            disabled={!canSave}
          >
            <DoneIcon />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Cancel" placement="top">
        <IconButton
          onClick={onCancel}
          aria-label="cancel"
          color="error"
          sx={{ borderRadius: "50%", border: "1px solid red" }}
        >
          <CloseIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default EditProperty;
