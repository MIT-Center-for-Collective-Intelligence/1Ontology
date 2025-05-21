import {
  Button,
  TextField,
  Grid,
  Typography,
  Tooltip,
  useTheme,
  Skeleton,
  Container,
} from "@mui/material";
import React, { useEffect, useState, useCallback } from "react";

import { Box, Paper } from "@mui/material";
import { debounce } from "lodash";
import CircularProgress from "@mui/material/CircularProgress";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import BedtimeIcon from "@mui/icons-material/Bedtime";

const LoadingConsultant = () => {
  return (
    <Box display="flex" width="100%" height="100%" sx={{ p: 2, gap: "14px" }}>
      <Skeleton
        variant="rectangular"
        width="50%"
        height="100%"
        sx={{ borderRadius: "25px" }}
      />
      <Skeleton
        variant="rectangular"
        width="50%"
        height="100%"
        sx={{ borderRadius: "25px" }}
      />
    </Box>
  );
};

const PromptDialogComponent = ({
  onClose,
  confirmation,
  loadingResponse,
  generateNewDiagramState,
  setGenerateNewDiagramState,
  handleThemeSwitch,
  ignoreCLD,
}: {
  onClose: any;
  confirmation: any;
  loadingResponse: any;
  generateNewDiagramState: any;
  setGenerateNewDiagramState: any;
  handleThemeSwitch: any;
  ignoreCLD?: boolean;
}) => {
  const db = getFirestore("causal-diagram");
  const admin = true; /* useRecoilValue(isAdminState) */
  const [caseDescription, setCaseDescription] = useState("");
  const [llmPrompt, setLlmPrompt] = useState("");
  const [consultingTopic, setConsultingTopic] = useState("");
  const [ideaEvaluator, setIdeaEvaluator] = useState(false);
  const [problemStatement, setProblemStatement] = useState("");
  const theme = useTheme();

  useEffect(() => {
    getPrompt();
  }, [confirmation]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSavePrompt = useCallback(
    debounce(async (promptToSave) => {
      const promptDocs = await getDocs(
        query(
          collection(db, "diagramPrompts"),
          where("consultant", "==", true),
          where("type", "==", "generate"),
        ),
      );

      if (promptDocs.docs.length > 0) {
        await setDoc(promptDocs.docs[0].ref, {
          prompt: promptToSave,
          type: confirmation.toLowerCase(),
          consultant: true,
        });
      } else {
        const promptRef = doc(collection(db, "diagramPrompts"));
        await setDoc(promptRef, {
          prompt: promptToSave,
          type: confirmation.toLowerCase(),
          consultant: true,
        });
      }
    }, 1000),
    [db, confirmation],
  );

  const getPrompt = async () => {
    const promptDocs = await getDocs(
      query(
        collection(db, "diagramPrompts"),
        where("consultant", "==", true),
        where("type", "==", "generate"),
      ),
    );

    if (promptDocs.docs.length > 0) {
      const promptData = promptDocs.docs[0].data();
      setLlmPrompt(promptData?.prompt || "");
    }
  };

  const handleClose = async () => {
    // Save immediately when closing
    await savePrompt();
    await onClose({
      documentDetailed: caseDescription,
      consultingTopic,
      problemStatement,
    });
  };

  const handleUserInputChange = (event: any) => {
    setCaseDescription(event.target.value);
  };

  const handleProblemStatementChange = (event: any) => {
    setProblemStatement(event.target.value);
  };

  const handleLlmPromptChange = (event: any) => {
    const newPrompt = event.target.value;
    setLlmPrompt(newPrompt);
    debouncedSavePrompt(newPrompt);
  };

  const savePrompt = async () => {
    debouncedSavePrompt.cancel();

    const promptDocs = await getDocs(
      query(
        collection(db, "diagramPrompts"),
        where("consultant", "==", true),
        where("type", "==", "generate"),
      ),
    );

    if (promptDocs.docs.length > 0) {
      await setDoc(promptDocs.docs[0].ref, {
        prompt: llmPrompt,
        type: confirmation.toLowerCase(),
        consultant: true,
      });
    } else {
      const promptRef = doc(collection(db, "diagramPrompts"));

      await setDoc(promptRef, {
        prompt: llmPrompt,
        type: confirmation.toLowerCase(),
        consultant: true,
      });
    }
  };

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSavePrompt.cancel();
    };
  }, [debouncedSavePrompt]);
  if (loadingResponse === "generate") {
    return (
      <Container
        maxWidth="sm"
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <Box
          component="img"
          src="loader.gif"
          alt="Loading..."
          sx={{ width: 200, height: 200, borderRadius: "25px" }}
        />
      </Container>
    );
  }
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 3,
        p: 2,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          textAlign: "center",
          position: "relative",
        }}
      >
        <Typography
          sx={{
            fontSize: "26px",
            fontWeight: "bold",
            borderRadius: "25px",
            mt: "17px",
            color: (theme) =>
              theme.palette.mode === "dark" ? "white" : "black",
            mx: "auto", // center the text
          }}
        >
          {!!ignoreCLD
            ? "Consulting App"
            : "Consulting using causal loop diagrams"}
        </Typography>
        {generateNewDiagramState && (
          <Button
            onClick={() => setGenerateNewDiagramState(false)}
            variant="contained"
            sx={{
              ml: "auto",
              borderRadius: "26px",
              backgroundColor: "red",
              color: "white",
              px: 4,
              mb: "5px",
              fontSize: "16px",
              fontWeight: "bold",
              mr: "15px",
              "&:hover": {
                backgroundColor: "darkorange",
              },
              "&:disabled": {
                backgroundColor: "action.disabledBackground",
              },
            }}
            // disabled={!inputValue.trim() || !consultingTopic.trim()}
          >
            Cancel
          </Button>
        )}
        <Tooltip
          title={
            theme.palette.mode === "dark"
              ? "Turn on the light"
              : "Turn off the light"
          }
          sx={{ position: "absolute", right: 0, top: 0, mt: "17px", mr: 2 }}
        >
          <Box
            onClick={handleThemeSwitch}
            sx={{
              border: "1px solid gray",
              borderRadius: "10px",
              pt: 1,
              px: 1,
              pb: 0,
              ":hover": {
                backgroundColor: (theme) =>
                  theme.palette.mode === "dark" ? "gray" : "#e0e0e0",
              },
            }}
          >
            {theme.palette.mode === "dark" ? (
              <WbSunnyIcon sx={{ color: "white" }} />
            ) : (
              <BedtimeIcon sx={{ color: "gray" }} />
            )}
          </Box>
        </Tooltip>
      </Box>

      <Paper
        sx={{
          p: 1,
          borderRadius: "25px",
          backgroundColor: (theme) =>
            theme.palette.mode === "dark" ? "#000000" : "",
        }}
        elevation={6}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: "13px" }}>
          <TextField
            label="Consulting Topic"
            autoFocus
            margin="dense"
            type="text"
            value={consultingTopic}
            onChange={(e) => setConsultingTopic(e.target.value)}
            fullWidth
            variant="outlined"
            InputLabelProps={{
              sx: {
                color: "gray",
              },
            }}
            sx={{
              maxWidth: "500px",
              "& .MuiOutlinedInput-root": {
                borderRadius: "12px",
              },
            }}
          />

          <Button
            onClick={() => handleClose()}
            variant="contained"
            sx={{
              borderRadius: "26px",
              backgroundColor: "orange",
              color: "white",
              px: 4,
              mb: "5px",
              fontSize: "16px",
              fontWeight: "bold",
              "&:hover": {
                backgroundColor: "darkorange",
              },
              "&:disabled": {
                backgroundColor: "action.disabledBackground",
              },
              textTransform: "capitalize",
            }}
            disabled={
              !caseDescription.trim() ||
              !consultingTopic.trim() ||
              !problemStatement.trim()
            }
          >
            {confirmation}
          </Button>
        </Box>
        <Grid container spacing={2} sx={{ flexGrow: 1, overflow: "hidden" }}>
          <Grid
            item
            xs={admin && !ignoreCLD ? 6 : 12}
            sx={{ display: "flex", flexDirection: "column", gap: 2 }}
          >
            <TextField
              label={"Enter the case description below:"}
              placeholder={"Case description..."}
              value={caseDescription}
              onChange={handleUserInputChange}
              fullWidth
              multiline
              minRows={14}
              maxRows={ideaEvaluator ? 14 : 500}
              variant="outlined"
              inputProps={{ maxRows: 14 }}
              sx={{
                // flexGrow: 3,
                overflow: "auto",
                borderRadius: "12px",
                "& .MuiOutlinedInput-root": {
                  borderRadius: "12px",
                },
              }}
              InputLabelProps={{
                shrink: true,
                sx: {
                  fontWeight: 600,
                  color: "text.primary",
                  fontSize: "1rem",
                  transform: "none",
                  position: "relative",
                },
              }}
            />

            <TextField
              label="Explain the problem below:"
              placeholder="Problem description..."
              value={problemStatement}
              onChange={handleProblemStatementChange}
              fullWidth
              multiline
              minRows={14}
              maxRows={14}
              variant="outlined"
              sx={{
                flexGrow: 1,
                overflow: "auto",
                borderRadius: "12px",
                maxHeight: "75vh",
                "& .MuiOutlinedInput-root": {
                  borderRadius: "12px",
                },
              }}
              InputLabelProps={{
                shrink: true,
                sx: {
                  fontWeight: 600,
                  color: "text.primary",
                  fontSize: "1rem",
                  transform: "none",
                  position: "relative",
                },
              }}
            />
          </Grid>

          {admin && !ignoreCLD && (
            <Grid
              item
              xs={6}
              sx={{ display: "flex", flexDirection: "column", gap: 2 }}
            >
              <Typography
                variant="subtitle1"
                fontWeight={600}
                color="text.primary"
              >
                System Prompt:
              </Typography>
              <TextField
                placeholder="Enter system prompt here..."
                value={llmPrompt}
                onChange={handleLlmPromptChange}
                fullWidth
                multiline
                minRows={14}
                variant="outlined"
                sx={{
                  flexGrow: 1,
                  overflow: "auto",
                  borderRadius: "12px",
                  maxHeight: "75vh",
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "12px",
                  },
                }}
              />
            </Grid>
          )}
        </Grid>
      </Paper>
    </Box>
  );
};

export default PromptDialogComponent;
