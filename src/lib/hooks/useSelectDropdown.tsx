import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import React, { useCallback, useState } from "react";
import { DESIGN_SYSTEM_COLORS } from "../theme/colors";
const OPTIONS = [
  { id: "o1-preview", title: "O1" },
  { id: "gpt-4o", title: "GPT-4o" },
  { id: "Gemini 1.5 PRO", title: "Gemini 1.5 PRO" },
];

const useSelectDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);

  const [selectedOption, setSelectedOption] = useState<any>({
    id: "o1-preview",
    title: "O1",
  });
  const [inputValue, setInputValue] = useState("");
  const resolveRef = React.useRef<any>(null);

  const showDialog = useCallback(() => {
    setIsOpen(true);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const closeDialog = useCallback(() => {
    setIsOpen(false);

    setInputValue("");

    if (resolveRef.current) {
      resolveRef.current({ userMessage: inputValue, model: selectedOption.id });
    }
  }, [inputValue]);

  const handleSelectChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const selected = OPTIONS.find((option) => option.id === event.target.value);
    setSelectedOption(selected || null);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const dropdownDialog = (
    <Dialog open={isOpen} onClose={() => closeDialog()}>
      <DialogContent>
        <DialogContentText sx={{ mb: "15px" }}>
          Select the LLM model you want to use:
        </DialogContentText>
        <TextField
          autoFocus
          margin="dense"
          id="prompt-input"
          type="text"
          value={inputValue}
          placeholder="Your message to the LLM"
          onChange={handleInputChange}
          fullWidth
          multiline
          sx={{
            mt: 3,
            mx: "auto",
            display: "block",
            textAlign: "center",
          }}
        />
        <FormControl fullWidth sx={{ mb: 2, mt: "15px" }}>
          <InputLabel>Select an Option</InputLabel>
          <Select
            value={selectedOption?.id || ""}
            onChange={(e: any) => handleSelectChange(e)}
            label="Select an Option"
          >
            {OPTIONS.map((option) => (
              <MenuItem key={option.id} value={option.id}>
                {option.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions sx={{ justifyContent: "center", mb: "5px" }}>
        <Button
          onClick={() => closeDialog()}
          variant="contained"
          sx={{
            borderRadius: "26px",
            backgroundColor: DESIGN_SYSTEM_COLORS.primary800,
          }}
        >
          Start
        </Button>

        <Button
          onClick={() => closeDialog()}
          color="primary"
          variant="outlined"
          sx={{ borderRadius: "26px" }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );

  const selectIt = useCallback(() => showDialog(), [showDialog]);

  return { selectIt, dropdownDialog };
};

export default useSelectDropdown;
