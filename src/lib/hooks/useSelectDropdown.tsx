import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
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

  const [selectedOption, setSelectedOption] = useState<{
    id: string;
    title: string;
  }>({ id: "o1-preview", title: "O1" });
  const [inputValue, setInputValue] = useState<string>("");
  const [numberValue, setNumberValue] = useState<number>(7);
  const resolveRef = React.useRef<any>(null);
  // localStorage.setItem(
  //   `lastSearches_${user?.userId}`,
  //   JSON.stringify(validSearches)
  // );
  const showDialog = useCallback(() => {
    setIsOpen(true);
    const savedInputValue = localStorage.getItem(`user-copilot-message`);
    setInputValue(savedInputValue || "");
    return new Promise<{
      userMessage: string;
      model: string;
      deepNumber: number;
    }>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const closeDialog = useCallback(
    (start: boolean = false) => {
      setIsOpen(false);
      localStorage.setItem(`user-copilot-message`, inputValue);
      setNumberValue(7);

      if (resolveRef.current && start) {
        resolveRef.current({
          userMessage: inputValue,
          model: selectedOption.id,
          deepNumber: numberValue,
        });
      }
    },
    [inputValue, selectedOption, numberValue]
  );

  const handleSelectChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const selected = OPTIONS.find((option) => option.id === event.target.value);
    setSelectedOption(selected || { id: "", title: "" });
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const handleNumberChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNumberValue(Number(event.target.value));
  };

  const dropdownDialog = (
    <Dialog open={isOpen} onClose={() => closeDialog()} fullWidth maxWidth="md">
      <DialogTitle>Copilot Settings:</DialogTitle>
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
          <InputLabel>Select an LLM Option</InputLabel>
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
        <TextField
          margin="dense"
          id="number-input"
          type="number"
          label="How far away from this node should I explore to propose improvements?"
          value={numberValue || ""}
          onChange={handleNumberChange}
          fullWidth
          inputProps={{ min: 0 }}
          sx={{
            mt: 3,
            mx: "auto",
            display: "block",
            textAlign: "center",
            "& .MuiInputLabel-root": {
              color: "gray",
            },
          }}
        />
      </DialogContent>
      <DialogActions sx={{ justifyContent: "center", mb: "5px" }}>
        <Button
          onClick={() => closeDialog(true)}
          variant="contained"
          sx={{
            borderRadius: "26px",
            backgroundColor: DESIGN_SYSTEM_COLORS.primary800,
          }}
          disabled={numberValue === 0}
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
