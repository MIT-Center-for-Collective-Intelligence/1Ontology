import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from "@mui/material";
import React, { useCallback, useMemo, useState } from "react";
import { DESIGN_SYSTEM_COLORS } from "../theme/colors";
import { MODELS_OPTIONS } from "../utils/copilotPrompts";
import CopilotPrompt from "@components/components/CopilotPrompt/CopilotPrompt";
import { useAuth } from "@components/components/context/AuthContext";
import { PROPERTIES_TO_IMPROVE } from "../CONSTANTS";
import { INode } from "@components/types/INode";
import { getNodesInThreeLevels } from "../utils/helpersCopilot";

const useSelectDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [{ user }] = useAuth();

  const [selectedOption, setSelectedOption] = useState<{
    id: string;
    title: string;
  }>({
    id: "gemini-2.5-pro-exp-03-25",
    title: "Gemini-2.5 PRO EXP 03-25",
  });
  const [inputValue, setInputValue] = useState<string>("");
  const [numberValue, setNumberValue] = useState<number>(12);
  const [nodeTitle, setNodeTitle] = useState("");
  const [generateNewNodes, setGenerateNewNodes] = useState(true);
  const [proposeDeleteNode, setProposeDeleteNodes] = useState(false);
  const [nodeType, setNodeType] = useState<string>("");
  const [selectedProperties, setSelectedProperties] = useState<Set<string>>(
    new Set(),
  );
  const [inputProperties, setInputProperties] = useState<Set<string>>(
    new Set(),
  );
  const [nodes, setNodes] = useState<{ [nodeId: string]: INode }>({});
  const [nodeId, setNodeId] = useState("");

  const resolveRef = React.useRef<any>(null);
  // localStorage.setItem(
  //   `lastSearches_${user?.userId}`,
  //   JSON.stringify(validSearches)
  // );
  const showDialog = useCallback(
    (
      nodeTitle: string,
      nodeType: string,
      nodes: { [nodeId: string]: INode },
      nodeId: string,
    ) => {
      setIsOpen(true);
      setNodeTitle(nodeTitle);
      setNodeId(nodeId);
      setNodeType(nodeType);
      setNodes(nodes);
      setSelectedProperties(
        new Set([
          "title",
          "description",
          "specializations",
          "generalizations",
          "parts",
        ]),
      );
      setInputProperties(
        new Set([
          "title",
          "description",
          "specializations",
          "generalizations",
          "parts",
        ]),
      );
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
    },
    [],
  );

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
          selectedProperties,
          proposeDeleteNode,
          inputProperties,
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
      inputProperties,
    ],
  );
  const nodes_Array = useMemo(() => {
    const nodeData = nodes[nodeId];
    if (!nodeData) {
      return;
    }
    const n = getNodesInThreeLevels(
      nodeData,
      nodes,
      new Set(),
      numberValue,
      inputProperties,
    );

    if (
      n &&
      inputProperties.size !==
        (PROPERTIES_TO_IMPROVE[nodeType]?.length || 0) +
          (PROPERTIES_TO_IMPROVE["allTypes"]?.length || 0)
    ) {
      for (let node of n) {
        for (let property in node) {
          if (!inputProperties.has(property) && property !== "nodeType") {
            delete node[property];
          }
        }
      }
    }
    return n;
  }, [nodes, nodeId, numberValue, inputProperties]);

  const handleSelectChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const selected = MODELS_OPTIONS.find(
      (option) => option.id === event.target.value,
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

        <CopilotPrompt
          setGenerateNewNodes={setGenerateNewNodes}
          proposeDeleteNode={proposeDeleteNode}
          setProposeDeleteNodes={setProposeDeleteNodes}
          generateNewNodes={generateNewNodes}
          nodeType={nodeType}
          selectedProperties={selectedProperties}
          setSelectedProperties={setSelectedProperties}
          inputProperties={inputProperties}
          setInputProperties={setInputProperties}
          nodes={nodes_Array}
          nodeTitle={nodeTitle}
          numberValue={numberValue}
          handleNumberChange={handleNumberChange}
          inputValue={inputValue}
          handleInputChange={handleInputChange}
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
              !proposeDeleteNode)
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
    (
      nodeTitle: string,
      nodeType: string,
      nodes: { [nodeId: string]: INode },
      nodeId: string,
    ) => showDialog(nodeTitle, nodeType, nodes, nodeId),
    [showDialog],
  );

  return { selectIt, dropdownDialog };
};

export default useSelectDropdown;
