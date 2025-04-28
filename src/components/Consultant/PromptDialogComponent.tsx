import { Button, TextField, Grid, Typography } from "@mui/material";
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

const PromptDialogComponent = ({
  onClose,
  confirmation,
  loadingResponse,
  generateNewDiagramState,
  setGenerateNewDiagramState,
}: {
  onClose: any;
  confirmation: any;
  loadingResponse: any;
  generateNewDiagramState: any;
  setGenerateNewDiagramState: any;
}) => {
  const db = getFirestore("causal-diagram");
  const admin = true; /* useRecoilValue(isAdminState) */
  const [caseDescription, setCaseDescription] =
    useState(`## 1. The Core Phenomenon: Global warming, characterized by a sustained increase in Earth's average surface temperature, is unequivocally driven by human activities since the pre-industrial era. The primary cause is the enhanced greenhouse effect resulting from the accumulation of greenhouse gases (GHGs) – principally carbon dioxide (CO2), methane (CH4), and nitrous oxide (N2O) – in the atmosphere. These gases trap heat, leading to warming trends documented by extensive scientific evidence, including the assessment reports of the Intergovernmental Panel on Climate Change (IPCC). Current atmospheric CO2 concentrations significantly exceed levels seen in at least the last 800,000 years.
## 2. Primary Drivers:
Fossil Fuel Combustion: Burning coal, oil, and natural gas for energy (electricity generation, heating, industry) and transportation remains the largest source of CO2 emissions globally.
Industrial Processes: Certain industrial activities, like cement production and chemical manufacturing, release significant amounts of CO2 and other GHGs.
Agriculture, Forestry, and Other Land Use (AFOLU): This sector is a major source of CH4 (from livestock digestion, rice cultivation, manure management) and N2O (from fertilizer use). Deforestation and land degradation reduce the planet's capacity to absorb CO2 and often release stored carbon.
Waste Management: Landfills and wastewater treatment release CH4.
## 3. Observed and Projected Impacts: The consequences of global warming are already being felt worldwide and are projected to intensify:
Environmental: Rising sea levels (threatening coastal communities and ecosystems), increased frequency and intensity of extreme weather events (heatwaves, droughts, floods, powerful storms), ocean acidification (harming marine life, especially coral reefs and shellfish), melting glaciers and polar ice sheets, disruption of ecosystems and biodiversity loss, shifts in species ranges, and thawing permafrost (releasing more GHGs – a potential feedback loop).
Socio-Economic: Threats to food security (crop yield variability, failures), water scarcity in many regions, damage to infrastructure from extreme weather, negative impacts on human health (heat stress, vector-borne diseases), displacement of populations ("climate migrants"), economic disruption in sectors like agriculture, fisheries, tourism, and insurance, and potential for increased geopolitical instability and conflict over resources.
## 4. Key Systems and Actors: Addressing climate change involves a complex interplay of interconnected systems and diverse actors:
Governments: National governments set policies (regulations, subsidies, carbon pricing), negotiate international agreements (like the Paris Agreement under the UNFCCC), and fund research and deployment. Sub-national governments (states, cities) often implement specific actions.
Industry & Business: Energy companies, manufacturers, agricultural businesses, transportation providers, and others are major emitters but also key players in developing and deploying solutions. Financial institutions influence investment flows towards low-carbon or high-carbon activities.
Consumers & Civil Society: Individual choices (consumption patterns, travel, diet) collectively have a large impact. Non-governmental organizations (NGOs), activists, and community groups play vital roles in advocacy, awareness-raising, and implementing local solutions.
Science & Technology: Researchers monitor the climate system, develop climate models, and innovate low-carbon technologies (renewable energy, batteries, carbon capture, sustainable materials, climate-resilient agriculture).
International Bodies: Organizations like the UN, IPCC, and World Bank facilitate cooperation, knowledge sharing, and finance.
## 5. Current Responses & Efforts: Significant efforts are underway, but widely considered insufficient to meet the scale of the challenge:
International Agreements: The Paris Agreement aims to limit global warming to well below 2, preferably to 1.5 degrees Celsius, compared to pre-industrial levels, through Nationally Determined Contributions (NDCs).
Renewable Energy Growth: Rapid cost reductions have led to significant growth in solar and wind power deployment.
Energy Efficiency: Improvements in building insulation, appliance standards, and industrial processes aim to reduce energy demand.
Electrification: Transitioning transportation (EVs) and heating towards electricity powered by clean sources.
Carbon Pricing: Mechanisms like carbon taxes and emissions trading systems (ETS) are implemented in various jurisdictions to create economic incentives for reducing emissions.
Adaptation Measures: Efforts to cope with unavoidable impacts, such as building sea walls, developing drought-resistant crops, and improving early warning systems.
## 6. Major Challenges & Complexities: Progress is hindered by numerous factors:
Scale & Inertia: The global energy system and economy have massive inertia built around fossil fuels. Transition requires vast investment and infrastructure changes.
Economic Concerns: Fears of job losses in fossil fuel industries, costs of transition, and impacts on economic competitiveness.
Political & Social Barriers: Lack of political will, lobbying by vested interests, public resistance to certain policies (e.g., carbon taxes), short-term political cycles conflicting with long-term climate goals, and challenges in achieving behavior change.
International Cooperation: Ensuring equitable burden-sharing between developed and developing nations, coordinating policies globally, and managing "carbon leakage" (where emissions shift to regions with weaker policies).
Technological Hurdles: Need for further innovation and cost reduction in areas like long-duration energy storage, sustainable aviation/shipping fuels, and large-scale carbon removal. Scaling existing technologies faces infrastructure and supply chain bottlenecks.
Interconnectedness & Feedback Loops: Climate change impacts can exacerbate other problems (e.g., poverty, migration) and trigger reinforcing feedback loops (e.g., melting ice reduces Earth's reflectivity, leading to more warming). Addressing one part of the system often has unintended consequences elsewhere.
Information & Coordination: Effectively coordinating actions across diverse actors, managing complex information flows, and ensuring transparency and accountability remain significant challenges.`);
  const [llmPrompt, setLlmPrompt] = useState("");
  const [consultingTopic, setConsultingTopic] = useState(
    "The Global Climate Change Challenge",
  );
  const [ideaEvaluator, setIdeaEvaluator] = useState(false);
  const [problemStatement, setProblemStatement] =
    useState(`The global climate system is facing unprecedented disruption due to human-induced greenhouse gas emissions, posing existential threats to ecosystems, economies, and societies worldwide. Despite growing awareness, international agreements like the Paris Accord, and advancements in low-carbon technologies, the current pace of global decarbonization and adaptation is insufficient to limit warming to safe levels (well below 2°C, aiming for 1.5°C) and manage the escalating impacts. Significant barriers related to economic inertia, political feasibility, social acceptance, technological scalability, international coordination, and complex system dynamics hinder progress.
The challenge is to design innovative and effective systems, coordination mechanisms, incentive structures, and information flows – leveraging the collective intelligence of diverse human actors (governments, industries, communities, individuals) and advanced technologies (AI, digital platforms, clean energy tech) – to dramatically accelerate the global transition towards a sustainable, resilient, net-zero emissions economy, while ensuring the transition is just, equitable, and effectively manages the unavoidable impacts of climate change already locked into the system.`);

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
      <Box
        sx={{
          width: "100%",
          height: "100%",
          minHeight: "300px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <CircularProgress size={80} />
      </Box>
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
      <Typography
        sx={{
          alignItems: "center",
          textAlign: "center",
          fontSize: "26px",
          fontWeight: "bold",
          borderRadius: "25px",
          mt: "17px",
          color: (theme) => (theme.palette.mode === "dark" ? "white" : "black"),
        }}
      >
        Consulting using causal loop diagrams
      </Typography>
      <Paper
        sx={{
          p: 1,
          borderRadius: "25px",
          backgroundColor: (theme) =>
            theme.palette.mode === "dark" ? "#000000" : "#c0c0c0",
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
            }}
            disabled={
              !caseDescription.trim() ||
              !consultingTopic.trim() ||
              !problemStatement.trim()
            }
          >
            {confirmation}
          </Button>

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
        </Box>
        <Grid container spacing={2} sx={{ flexGrow: 1, overflow: "hidden" }}>
          <Grid
            item
            xs={admin ? 6 : 12}
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

          {admin && (
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
