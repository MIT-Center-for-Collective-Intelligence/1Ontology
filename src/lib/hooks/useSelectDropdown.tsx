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
  const editPrompt = user?.uname === "ouhrac" || user?.uname === "1man";

  const [selectedOption, setSelectedOption] = useState<{
    id: string;
    title: string;
  }>({ id: "o1-preview", title: "O1" });
  const [inputValue, setInputValue] = useState<string>("");
  const [numberValue, setNumberValue] = useState<number>(12);
  const [nodeTitle, setNodeTitle] = useState("");
  const [generateNewNodes, setGenerateNewNodes] = useState(true);
  const [proposeDeleteNode, setProposeDeleteNodes] = useState(true);
  const [nodeType, setNodeType] = useState<string>("");
  const [selectedProperties, setSelectedProperties] = useState<Set<string>>(
    new Set()
  );

  const resolveRef = React.useRef<any>(null);
  // localStorage.setItem(
  //   `lastSearches_${user?.userId}`,
  //   JSON.stringify(validSearches)
  // );
  const showDialog = useCallback((nodeTitle: string, nodeType: string) => {
    setIsOpen(true);
    setNodeTitle(nodeTitle);
    setNodeType(nodeType);
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
      console.log("selectedProperties ==>", selectedProperties);
      if (resolveRef.current && start) {
        resolveRef.current({
          userMessage: inputValue,
          model: selectedOption.id,
          deepNumber: numberValue,
          generateNewNodes,
          selectedProperties,
          proposeDeleteNode,
        });
      }
    },
    [
      inputValue,
      numberValue,
      selectedOption.id,
      generateNewNodes,
      selectedProperties,
      proposeDeleteNode,
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
    <Dialog
      open={isOpen}
      onClose={() => closeDialog()}
      fullScreen
      sx={{
        width: "100%",
        height: "100%",
      }}
    >
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
        {editPrompt && (
          <CopilotPrompt
            setGenerateNewNodes={setGenerateNewNodes}
            proposeDeleteNode={proposeDeleteNode}
            setProposeDeleteNodes={setProposeDeleteNodes}
            generateNewNodes={generateNewNodes}
            nodeType={nodeType}
            selectedProperties={selectedProperties}
            setSelectedProperties={setSelectedProperties}
          />
        )}
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
            numberValue === 0 ||
            (!generateNewNodes &&
              selectedProperties.size <= 0 &&
              !proposeDeleteNode &&
              editPrompt)
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
    (nodeTitle: string, nodeType: string) => showDialog(nodeTitle, nodeType),
    [showDialog]
  );

  return { selectIt, dropdownDialog };
};

export default useSelectDropdown;
