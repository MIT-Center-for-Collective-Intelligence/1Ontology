import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
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
  }>(MODELS_OPTIONS[0]);
  const [inputValue, setInputValue] = useState<string>("");
  const [numberValue, setNumberValue] = useState<number>(12);
  const [nodeTitle, setNodeTitle] = useState("");
  const [generateNewNodes, setGenerateNewNodes] = useState(true);
  const [proposeDeleteNode, setProposeDeleteNodes] = useState(true);
  const [nodeType, setNodeType] = useState<string>("");
  const [improveProperties, setImproveProperties] = useState<Set<string>>(
    new Set(PROPERTIES_TO_IMPROVE.allTypes),
  );
  const [inputProperties, setInputProperties] = useState<Set<string>>(
    new Set(PROPERTIES_TO_IMPROVE.allTypes),
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
      setImproveProperties(
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
          selectedProperties: improveProperties,
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
      improveProperties,
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
      PaperProps={{
        sx: {
          bgcolor: (theme) =>
            theme.palette.mode === "light" ? "#fbfcfd" : "#0d1117",
          backgroundImage: "none",
        },
      }}
    >
      <DialogTitle sx={{ p: { xs: 2, md: 4 }, pb: { xs: 1, md: 2 } }}>
        <Box
          sx={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            py: 4,
            px: 3,
            borderRadius: "24px",
            background: (theme) =>
              theme.palette.mode === "dark"
                ? "linear-gradient(135deg, rgba(30,35,41,0.8) 0%, rgba(13,17,23,0.9) 100%)"
                : "linear-gradient(135deg, #ffffff 0%, rgba(240, 244, 248, 0.6) 100%)",
            backdropFilter: "blur(20px)",
            border: "1px solid",
            borderColor: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.08)"
                : "rgba(0,0,0,0.04)",
            boxShadow: (theme) =>
              theme.palette.mode === "dark"
                ? "0 10px 40px rgba(0,0,0,0.5)"
                : "0 10px 40px rgba(0,0,0,0.05)",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Subtle background shape */}
          <Box
            sx={{
              position: "absolute",
              top: "-50%",
              left: "-10%",
              width: "50%",
              height: "200%",
              background:
                "radial-gradient(circle, rgba(255,105,0,0.08) 0%, rgba(255,105,0,0) 70%)",
              zIndex: 0,
              pointerEvents: "none",
            }}
          />
          <Box
            sx={{
              position: "absolute",
              bottom: "-50%",
              right: "-10%",
              width: "50%",
              height: "200%",
              background:
                "radial-gradient(circle, rgba(255,105,0,0.05) 0%, rgba(255,105,0,0) 70%)",
              zIndex: 0,
              pointerEvents: "none",
            }}
          />

          <Typography
            variant="overline"
            sx={{
              fontSize: "0.85rem",
              fontWeight: 700,
              color: "text.secondary",
              letterSpacing: "1.5px",
              mb: 1,
              zIndex: 1,
            }}
          >
            AI Assistant
          </Typography>
          <Typography
            variant="h4"
            sx={{
              fontSize: { xs: "22px", md: "32px" },
              fontWeight: 800,
              color: "text.primary",
              zIndex: 1,
              lineHeight: 1.3,
            }}
          >
            Improving the sub-ontology around{" "}
            <Box
              component="span"
              sx={{
                color: "#ff6900",
                position: "relative",
                display: "inline-block",
                "&::after": {
                  content: '""',
                  position: "absolute",
                  bottom: "2px",
                  left: 0,
                  width: "100%",
                  height: "3px",
                  backgroundColor: "rgba(255,105,0,0.3)",
                  borderRadius: "2px",
                },
              }}
            >
              {nodeTitle}
            </Box>
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent
        sx={{
          "&::-webkit-scrollbar": {
            display: "none",
          },
          px: { xs: 2, md: 4 },
          pt: 1,
        }}
      >
        <CopilotPrompt
          setGenerateNewNodes={setGenerateNewNodes}
          proposeDeleteNode={proposeDeleteNode}
          setProposeDeleteNodes={setProposeDeleteNodes}
          generateNewNodes={generateNewNodes}
          nodeType={nodeType}
          improveProperties={improveProperties}
          setImproveProperties={setImproveProperties}
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
      <DialogActions
        sx={{
          justifyContent: "center",
          p: { xs: 3, md: 4 },
          pt: 3,
          gap: 2,
          borderTop: "1px solid",
          borderColor: (theme) =>
            theme.palette.mode === "dark"
              ? "rgba(255,255,255,0.05)"
              : "rgba(0,0,0,0.05)",
          bgcolor: (theme) =>
            theme.palette.mode === "dark"
              ? "rgba(13,17,23,0.8)"
              : "rgba(255,255,255,0.8)",
          backdropFilter: "blur(10px)",
        }}
      >
        <Button
          onClick={() => closeDialog()}
          color="inherit"
          variant="outlined"
          sx={{
            borderRadius: "14px",
            py: 1.5,
            px: { xs: 4, md: 6 },
            fontSize: "1rem",
            fontWeight: 700,
            textTransform: "none",
            borderWidth: "1.5px",
            color: "text.primary",
            borderColor: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.2)"
                : "rgba(0,0,0,0.2)",
            ":hover": {
              borderWidth: "1.5px",
              borderColor: "text.primary",
              bgcolor: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(0,0,0,0.03)",
            },
          }}
        >
          Cancel
        </Button>

        <Button
          onClick={() => closeDialog(true)}
          variant="contained"
          sx={{
            borderRadius: "14px",
            backgroundColor: "#ff6900",
            color: "#fff",
            py: 1.5,
            px: { xs: 4, md: 6 },
            fontSize: "1rem",
            fontWeight: 700,
            textTransform: "none",
            border: "1px solid #ff6900",
            boxShadow: "0 6px 16px rgba(255,105,0,0.3)",
            transition: "all 0.2s ease-in-out",
            "&:hover": {
              transform: "translateY(-2px)",
              boxShadow: "0 8px 25px rgba(255,105,0,0.45)",
              backgroundColor: "#e55e00",
              borderColor: "#e55e00",
            },
            "&:disabled": {
              backgroundColor: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(255,255,255,0.1)"
                  : "rgba(0,0,0,0.12)",
              color: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(255,255,255,0.3)"
                  : "rgba(0,0,0,0.26)",
              boxShadow: "none",
              border: "none",
            },
          }}
          disabled={
            numberValue === 0 ||
            (!generateNewNodes &&
              improveProperties.size <= 0 &&
              !proposeDeleteNode)
          }
        >
          Improve Details
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
