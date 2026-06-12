import React, { useState } from "react";
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Typography,
  Paper,
  Tooltip,
  IconButton,
  useTheme,
  Slide,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";

interface AddPropertyFormProps {
  addNewProperty: (title: string, type: string) => void;
  locked: boolean;
  setOpenAddProperty: any;
  exitingProperties: string[];
  appName?: string;
}

const SpecialCharacterRegex = /^[a-zA-Z0-9 ]*$/; // Adjust regex as necessary

const AddPropertyForm: React.FC<AddPropertyFormProps> = ({
  addNewProperty,
  locked,
  setOpenAddProperty,
  exitingProperties,
  appName,
}) => {
  const theme = useTheme();
  const BUTTON_COLOR = theme.palette.mode === "dark" ? "#373739" : "#dde2ea";

  const [propertyType, setPropertyType] = useState<string>("String");
  const [newPropertyTitle, setNewPropertyTitle] = useState<string>("");
  const [inputError, setInputError] = useState<boolean>(false);
  const [duplicateError, setDuplicateError] = useState<boolean>(false);

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const isValid = SpecialCharacterRegex.test(value) && value.length <= 30;

    setNewPropertyTitle(value);
    setInputError(!isValid);
    setDuplicateError(false);
  };

  const handleAddProperty = () => {
    if (
      !newPropertyTitle ||
      !propertyType ||
      inputError ||
      locked ||
      duplicateError
    ) {
      return;
    }

    // Check if the property already exists
    if (
      exitingProperties.some(
        (p) =>
          p.replaceAll(" ", "").trim().toLowerCase() ===
          newPropertyTitle.replaceAll(" ", "").trim().toLowerCase(),
      )
    ) {
      setDuplicateError(true);
      return;
    }

    // Add the new property
    addNewProperty(newPropertyTitle, propertyType);
    setNewPropertyTitle("");
    setPropertyType("String");
  };

  const handleCancel = () => {
    setOpenAddProperty(false);
    setNewPropertyTitle("");
    setInputError(false);
    setDuplicateError(false);
  };

  const disableAdd =
    !propertyType ||
    !newPropertyTitle ||
    inputError ||
    locked ||
    duplicateError;

  const modernFieldSx = {
    "& .MuiOutlinedInput-root": {
      borderRadius: "14px",
      backgroundColor: (theme: any) =>
        theme.palette.mode === "dark"
          ? "rgba(255, 255, 255, 0.04)"
          : "rgba(15, 23, 42, 0.03)",
      transition:
        "background-color 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
      "& .MuiOutlinedInput-notchedOutline": {
        borderColor: (theme: any) =>
          theme.palette.mode === "dark"
            ? "rgba(255, 255, 255, 0.18)"
            : "rgba(15, 23, 42, 0.14)",
        transition: "border-color 0.2s ease",
      },
      "&:hover": {
        backgroundColor: (theme: any) =>
          theme.palette.mode === "dark"
            ? "rgba(255, 255, 255, 0.06)"
            : "rgba(15, 23, 42, 0.05)",
        "& .MuiOutlinedInput-notchedOutline": {
          borderColor: (theme: any) =>
            theme.palette.mode === "dark"
              ? "rgba(255, 255, 255, 0.3)"
              : "rgba(15, 23, 42, 0.24)",
        },
      },
      "&.Mui-focused": {
        "& .MuiOutlinedInput-notchedOutline": {
          borderColor: "orange",
          borderWidth: "1.5px",
        },
        boxShadow: "0 0 0 3px rgba(255, 165, 0, 0.18)",
      },
    },
  } as const;

  return (
    <Slide direction="down" in={true} timeout={500}>
      <Paper
        elevation={9}
        sx={{
          mt: "20px",
          mb: "20px",
          borderRadius: "30px",
          borderBottomRightRadius: "18px",
          borderBottomLeftRadius: "18px",
          width: "100%",
          overflow: "hidden",
          border: "2px solid orange",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            background: (theme) =>
              theme.palette.mode === "dark" ? "#242425" : "#d0d5dd",
            p: 3,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <AddIcon sx={{ color: "orange" }} />
            <Typography
              sx={{
                fontSize: "20px",
                fontWeight: 500,
                fontFamily: "Roboto, sans-serif",
                padding: "4px",
              }}
            >
              Add New Property
            </Typography>
          </Box>

          <Box sx={{ ml: "auto" }}>
            <Tooltip title={"Close"}>
              <IconButton
                onClick={handleCancel}
                sx={{ borderRadius: "25px", backgroundColor: "red" }}
              >
                <CloseIcon sx={{ color: "white" }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2.5,
            p: 3,
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              alignItems: "flex-start",
              gap: 2,
            }}
          >
            <FormControl
              variant="outlined"
              sx={{
                ...modernFieldSx,
                width: { xs: "100%", sm: "200px" },
                flexShrink: 0,
              }}
            >
              <InputLabel id="property-type-label">Type</InputLabel>
              <Select
                labelId="property-type-label"
                id="add-property-type"
                value={propertyType}
                onChange={(event) => setPropertyType(event.target.value)}
                label="Type"
                MenuProps={{
                  PaperProps: {
                    sx: {
                      borderRadius: "14px",
                      mt: "6px",
                      boxShadow: (theme) =>
                        theme.palette.mode === "dark"
                          ? "0 12px 32px rgba(0,0,0,0.5)"
                          : "0 12px 32px rgba(15,23,42,0.16)",
                      "& .MuiMenuItem-root": {
                        borderRadius: "8px",
                        mx: "6px",
                        my: "2px",
                      },
                    },
                  },
                }}
              >
                {(!!appName
                  ? ["String", "Activity"]
                  : [
                      "String",
                      "Activity",
                      "Object",
                      "Actor",
                      "Evaluation Dimension",
                      "Incentive",
                      "Reward",
                      "Numeric",
                    ]
                ).map((item) => (
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
              error={inputError || duplicateError}
              fullWidth
              variant="outlined"
              helperText={
                inputError
                  ? "Max 30 characters, no special characters allowed."
                  : duplicateError
                    ? "This property already exists."
                    : ""
              }
              slotProps={{
                inputLabel: {
                  sx: { color: "text.secondary" },
                },
              }}
              sx={modernFieldSx}
            />
          </Box>

          <Box sx={{ display: "flex", gap: "14px", mt: "4px" }}>
            <Button
              onClick={handleAddProperty}
              disabled={disableAdd}
              variant="outlined"
              fullWidth
              sx={{
                borderRadius: "18px",
                backgroundColor: BUTTON_COLOR,
                ":hover": {
                  backgroundColor:
                    theme.palette.mode === "light" ? "#f0f0f0" : "",
                },
              }}
            >
              Add Property
            </Button>
            <Button
              onClick={handleCancel}
              variant="outlined"
              color="error"
              fullWidth
              sx={{ borderRadius: "18px" }}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      </Paper>
    </Slide>
  );
};

export default AddPropertyForm;
