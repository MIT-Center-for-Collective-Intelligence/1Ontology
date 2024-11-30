import {
  Box,
  Button,
  Checkbox,
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
  Typography,
} from "@mui/material";
import React, { useCallback, useState } from "react";
import { DESIGN_SYSTEM_COLORS } from "../theme/colors";
import { MODELS_OPTIONS } from "../utils/copilotPrompts";
import CopilotPrompt from " @components/components/CopilotPrompt/CopilotPrompt";
import { useAuth } from " @components/components/context/AuthContext";

const useSelectDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [{ user }] = useAuth();

  const [selectedOption, setSelectedOption] = useState<{
    id: string;
    title: string;
  }>({ id: "o1-preview", title: "O1" });
  const [inputValue, setInputValue] = useState<string>("");
  const [numberValue, setNumberValue] = useState<number>(12);
  const [nodeTitle, setNodeTitle] = useState("");
  const [generateNewNodes, setGenerateNewNodes] = useState(true);
  const [generateImprovement, setGenerateImprovement] = useState(true);
  const resolveRef = React.useRef<any>(null);
  // localStorage.setItem(
  //   `lastSearches_${user?.userId}`,
  //   JSON.stringify(validSearches)
  // );
  const showDialog = useCallback((nodeTitle: string) => {
    setIsOpen(true);
    setNodeTitle(nodeTitle);
    const savedInputValue = localStorage.getItem(`user-copilot-message`);
    const savedNumberValue = localStorage.getItem(`user-number-value`);
    setInputValue(savedInputValue || "");
    if (savedNumberValue) {
      setNumberValue(Number(savedNumberValue));
    }
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
      localStorage.setItem(`user-number-value`, String(numberValue));

      if (resolveRef.current && start) {
        resolveRef.current({
          userMessage: inputValue,
          model: selectedOption.id,
          deepNumber: numberValue,
          generateNewNodes,
          generateImprovement,
        });
      }
    },
    [
      inputValue,
      numberValue,
      selectedOption.id,
      generateNewNodes,
      generateImprovement,
    ]
  );

  const handleSelectChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const selected = MODELS_OPTIONS.find(
      (option) => option.id === event.target.value
    );
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
      <DialogTitle>
        Improving the sub-ontology around{" "}
        <strong style={{ color: "orange" }}>{nodeTitle}</strong>:
      </DialogTitle>

      <DialogContent
        sx={{
          "&::-webkit-scrollbar": {
            display: "none",
          },
        }}
      >
        {user?.uname === "ouhrac" && <CopilotPrompt />}
        <TextField
          autoFocus
          margin="dense"
          id="prompt-input"
          label="Please write your instructions to co-pilot here:"
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          fullWidth
          multiline
          sx={{
            mx: "auto",
            display: "block",
            textAlign: "center",
            "& .MuiInputLabel-root": {
              color: "gray",
            },
          }}
        />
        {user?.uname === "ouhrac" && (
          <Box
            sx={{
              display: "flex",
              mt: "25px",
              mb: "10px",
              p: 1,
              cursor: "pointer",
              ":hover": {
                backgroundColor: "#766a57",
                borderRadius: "25px",
              },
            }}
            onClick={() => {
              setGenerateNewNodes((prev) => !prev);
            }}
          >
            <Checkbox checked={generateNewNodes} sx={{ p: 0 }} />
            <Typography sx={{ ml: "15px" }}> Generate New Nodes</Typography>
          </Box>
        )}
        {user?.uname === "ouhrac" && (
          <Box
            sx={{
              display: "flex",
              mb: "25px",
              cursor: "pointer",
              p: 1,
              ":hover": {
                backgroundColor: "#766a57",
                borderRadius: "25px",
              },
            }}
            onClick={() => {
              setGenerateImprovement((prev) => !prev);
            }}
          >
            <Checkbox checked={generateImprovement} sx={{ p: 0 }} />
            <Typography sx={{ ml: "15px" }}> Generate improvement</Typography>
          </Box>
        )}
        {!generateNewNodes &&
          !generateImprovement &&
          user?.uname === "ouhrac" && (
            <Typography sx={{ color: "red", mb: "15px" }}>
              {`Select at least one option: 'Generate New Nodes,' 'Generate Improvement' or both!`}
            </Typography>
          )}
        <FormControl fullWidth sx={{ mb: 2, mt: "15px" }}>
          <InputLabel>Select an LLM Option</InputLabel>
          <Select
            value={selectedOption?.id || ""}
            onChange={(e: any) => handleSelectChange(e)}
            label="Select an Option"
          >
            {MODELS_OPTIONS.map((option) => (
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
          label={
            <Box>
              How far away from this node{" "}
              <strong style={{ color: "orange" }}>{nodeTitle} </strong>
              should I explore to propose improvements?
            </Box>
          }
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
          disabled={
            numberValue === 0 || (!generateNewNodes && !generateImprovement)
          }
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

  const selectIt = useCallback(
    (nodeTitle: string) => showDialog(nodeTitle),
    [showDialog]
  );

  return { selectIt, dropdownDialog };
};

export default useSelectDropdown;
