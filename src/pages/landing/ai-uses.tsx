import React, { useEffect, useState } from "react";
import Head from "next/head";
import {
  Box,
  Button,
  Container,
  Grid,
  Typography,
  ThemeProvider,
  CssBaseline,
  Card,
  Chip,
} from "@mui/material";
import { useThemeManager } from "../../lib/hooks/useThemeManager";
import { createLandingTheme } from "../../theme/landingTheme";
import { Navigation } from "./_components/Navigation";
import { MobileDrawer } from "./_components/MobileDrawer";
import { Footer } from "./_components/Footer";
import { OpenInNew } from "@mui/icons-material";
import TreeVisualization, { TreeNode } from "./_components/TreeVisualization";

// Data definition moved to TreeVisualization component

// Simplified demo data - just node title, children, and app count
const simplifiedSampleData: TreeNode = {
  id: "act",
  name: "Act",
  appCount: 30068,
  children: [
    {
      id: "act-info-think",
      name: 'Act on information ("Think")',
      appCount: 18178,
      children: [
        {
          id: "create-info",
          name: "Create information",
          appCount: 8392,
          children: [
            {
              id: "decide",
              name: "Decide",
              appCount: 36,
              children: [],
            },
            {
              id: "plan",
              name: "Plan",
              appCount: 396,
              children: [],
            },
            {
              id: "analyze",
              name: "Analyze",
              appCount: 1317,
              children: [],
            },
            {
              id: "design",
              name: "Design",
              appCount: 186,
              children: [],
            },
          ],
        },
        {
          id: "modify-info",
          name: "Modify information",
          appCount: 420,
          children: [
            {
              id: "revise",
              name: "Revise",
              appCount: 410,
              children: [],
            },
            {
              id: "convert",
              name: "Convert",
              appCount: 268,
              children: [],
            },
          ],
        },
        {
          id: "transfer-info",
          name: "Transfer information",
          appCount: 18728,
          children: [
            {
              id: "get-info",
              name: "Get information",
              appCount: 1658,
              children: [],
            },
            {
              id: "provide-info",
              name: "Provide information",
              appCount: 14308,
              children: [],
            },
            {
              id: "exchange-info-transfer",
              name: "Exchange information",
              appCount: 2762,
              children: [],
            },
          ],
        },
      ],
    },
    {
      id: "act-physical-do",
      name: 'Act on physical objects ("Do")',
      appCount: 13,
      children: [
        {
          id: "create-physical",
          name: "Create physical objects",
          appCount: 0,
          children: [],
        },
        {
          id: "modify-physical",
          name: "Modify physical objects",
          appCount: 13,
          children: [],
        },
        {
          id: "transfer-physical",
          name: "Transfer physical objects",
          appCount: 0,
          children: [],
        },
      ],
    },
    {
      id: "act-actors-interact",
      name: 'Act with other actors ("Interact")',
      appCount: 11877,
      children: [
        {
          id: "transfer-service",
          name: "Transfer service",
          appCount: 2513,
          children: [
            {
              id: "assist",
              name: "Assist",
              appCount: 1956,
              children: [],
            },
            {
              id: "facilitate",
              name: "Facilitate",
              appCount: 1945,
              children: [],
            },
            {
              id: "teach",
              name: "Teach",
              appCount: 2002,
              children: [],
            },
          ],
        },
        {
          id: "exchange-info-service",
          name: "Exchange information",
          appCount: 2762,
          children: [],
        },
      ],
    },
  ],
};

const OntologyExplorer = () => {
  const { isDark, handleThemeSwitch, isAuthenticated, isAuthLoading } = useThemeManager();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [viewType, setViewType] = useState<"tree" | "sunburst">("tree");
  const [data, setData] = useState<TreeNode | null>(null);

    useEffect(() => {
    fetch("/landing_data/tree_data.json")
      .then((res) => res.json())
      .then((json) => setData(json));
  }, []);

  if (!data) {
    return <p>Loading ontology...</p>;
  }
  
  const theme = createLandingTheme(isDark);



  return (
    <>
      <Head>
        <title>Where AI Can Be Useful</title>
      </Head>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
        {/* Navigation */}
        <Navigation
          isDark={isDark}
          handleThemeSwitch={handleThemeSwitch}
          isAuthenticated={isAuthenticated}
          isAuthLoading={isAuthLoading}
          onMobileMenuOpen={() => setMobileNavOpen(true)}
        />

        {/* Mobile Navigation Drawer */}
        <MobileDrawer
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
        />

        {/* Clean Sophisticated Hero Section */}
        <Box
          sx={{
            pt: 16,
            pb: 12,
            background: (theme) =>
              theme.palette.mode === "dark"
                ? "linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #121212 100%)"
                : "linear-gradient(135deg, #fafafa 0%, #f0f0f0 50%, #e8e8e8 100%)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Subtle background pattern */}
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: (theme) =>
                theme.palette.mode === "dark"
                  ? `radial-gradient(circle at 25% 30%, rgba(255,152,0,0.02) 0%, transparent 50%),
                 radial-gradient(circle at 75% 70%, rgba(33,150,243,0.02) 0%, transparent 50%)`
                  : `radial-gradient(circle at 25% 30%, rgba(255,152,0,0.03) 0%, transparent 50%),
                 radial-gradient(circle at 75% 70%, rgba(33,150,243,0.03) 0%, transparent 50%)`,
              zIndex: 0,
            }}
          />

          <Container maxWidth="xl" sx={{ position: "relative", zIndex: 1 }}>
            {/* Title Section */}
            <Box sx={{ textAlign: "center", mb: 8 }}>
              <Typography
                variant="h2"
                component="h1"
                sx={{
                  fontWeight: 300,
                  mb: 2,
                  fontSize: { xs: "2.25rem", md: "3rem", lg: "3.75rem" },
                  letterSpacing: "-0.025em",
                  lineHeight: { xs: 1.2, md: 1.15 },
                  color: (theme) =>
                    theme.palette.mode === "dark" ? "#f8f9fa" : "#1a1a1a",
                  fontFamily:
                    '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                }}
              >
                Where AI Can Be Useful
              </Typography>

              <Typography
                variant="h4"
                sx={{
                  fontWeight: 600,
                  color: "primary.main",
                  mb: 6,
                  fontSize: { xs: "1.25rem", md: "1.75rem", lg: "2.25rem" },
                  letterSpacing: "-0.02em",
                  lineHeight: { xs: 1.3, md: 1.2 },
                  fontFamily:
                    '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                }}
              >
                An Interactive Ontology Perspective
              </Typography>
            </Box>

            {/* Motivation & Methodology - Subtle Layout */}
            <Box sx={{ maxWidth: "1200px", mx: "auto", mb: 4 }}>
              <Grid 
                container 
                spacing={12}
                sx={{ position: "relative" }}
              >
                {/* Motivation Section */}
                <Grid item xs={12} md={6}>
                  <Box sx={{ pr: { xs: 0, md: 3 } }}>
                    <Typography
                      variant="h5"
                      sx={{
                        fontWeight: 600,
                        color: "primary.main",
                        mb: 3,
                        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                      }}
                    >
                      Motivation
                    </Typography>

                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                      <Typography
                        variant="body1"
                        sx={{
                          color: "text.primary",
                          lineHeight: 1.6,
                          fontWeight: 400,
                          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                        }}
                      >
                        • The rapid emergence of thousands of AI applications
                        across diverse domains underscores an urgent question:{" "}
                        <strong style={{ color: "#ff9800", fontStyle: "italic" }}>
                          Where can AI be useful?
                        </strong>
                      </Typography>

                      <Typography
                        variant="body1"
                        sx={{
                          color: "text.primary",
                          lineHeight: 1.6,
                          fontWeight: 400,
                          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                        }}
                      >
                        • We adopt an{" "}
                        <strong style={{ color: "#ff9800" }}>
                          ontological perspective
                        </strong>{" "}
                        to systematically examine the functional scope of AI by
                        organizing tasks through a structured hierarchy of
                        action verbs, to better understand where AI is
                        substituting or augmenting human abilities.
                      </Typography>

                      <Typography
                        variant="body1"
                        sx={{
                          color: "text.primary",
                          lineHeight: 1.6,
                          fontWeight: 400,
                          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                        }}
                      >
                        • By observing{" "}
                        <strong style={{ color: "#ff9800" }}>
                          clusters of AI activity within specific branches of
                          the task ontology
                        </strong>
                        , we can infer that related but less-covered tasks may
                        represent{" "}
                        <strong style={{ color: "#ff9800" }}>
                          emerging opportunities
                        </strong>{" "}
                        for future AI applications.
                      </Typography>

                      <Typography
                        variant="body1"
                        sx={{
                          color: "text.primary",
                          lineHeight: 1.6,
                          fontWeight: 400,
                          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                        }}
                      >
                        • When a task is heavily automated in one domain, it may
                        signal{" "}
                        <strong style={{ color: "#ff9800" }}>
                          transferable potential
                        </strong>{" "}
                        to other domains with similar functional demands.
                      </Typography>
                    </Box>
                  </Box>
                </Grid>



                {/* Methodology Section */}
                <Grid item xs={12} md={6}>
                  <Box sx={{ pl: { xs: 0, md: 3 } }}>
                    <Typography
                      variant="h5"
                      sx={{
                        fontWeight: 600,
                        color: "primary.main",
                        mb: 3,
                        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                      }}
                    >
                      Methodology
                    </Typography>

                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                      <Box>
                        <Typography
                          variant="body1"
                          sx={{
                            color: "text.primary",
                            lineHeight: 1.6,
                            fontWeight: 400,
                            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                          }}
                        >
                          •{" "}
                          <strong style={{ color: "#ff9800" }}>
                            Ontology:
                          </strong>{" "}
                          Employed a{" "}
                          <strong>verb-based taxonomy of human tasks</strong>{" "}
                          comprising over <strong>300 action verbs</strong>,
                          grounded in established frameworks such as{" "}
                          <strong>O*NET</strong>, and manually curated to
                          reflect functional and semantic relationships among
                          tasks.
                        </Typography>
                        <Box sx={{ mt: 2 }}>
                          <Button
                            variant="outlined"
                            size="small"
                            href="/landing"
                            endIcon={<OpenInNew sx={{ fontSize: 16 }} />}
                            sx={{
                              fontSize: "0.8rem",
                              px: 2.5,
                              py: 1,
                              borderColor: "primary.main",
                              color: "primary.main",
                              fontWeight: 500,
                              borderRadius: 1.5,
                              textTransform: "none",
                              fontFamily:
                                '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                              transition: "all 0.2s ease",
                              "&:hover": {
                                bgcolor: "rgba(255,152,0,0.08)",
                                borderColor: "primary.dark",
                                color: "primary.dark",
                                transform: "translateY(-1px)",
                              },
                            }}
                          >
                            AI and the Future of Work: The Ontology Approach
                          </Button>
                        </Box>
                      </Box>

                      <Typography
                        variant="body1"
                        sx={{
                          color: "text.primary",
                          lineHeight: 1.6,
                          fontWeight: 400,
                          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                        }}
                      >
                        •{" "}
                        <strong style={{ color: "#ff9800" }}>
                          Source of AI App Data:
                        </strong>{" "}
                        Leveraged the{" "}
                        <strong style={{ fontStyle: "italic" }}>
                          {"There's an AI for That"}
                        </strong>{" "}
                        platform, which catalogs over{" "}
                        <strong>13,000 AI Apps</strong> {`across diverse domains.
                        Each entry includes metadata such as the app's name,
                        function, task description, tags, and taglines, enabling
                        rich task-level analysis.`}
                      </Typography>

                      <Typography
                        variant="body1"
                        sx={{
                          color: "text.primary",
                          lineHeight: 1.6,
                          fontWeight: 400,
                          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                        }}
                      >
                        •{" "}
                        <strong style={{ color: "#ff9800" }}>
                          Classification Pipeline:
                        </strong>{" "}
                        Designed an <strong>LLM-powered pipeline</strong> to
                        automatically classify each AI application into the most
                        appropriate node within the verb ontology, leveraging
                        all available textual metadata associated with the Apps
                        to ensure contextual accuracy and semantic alignment.
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </Container>
        </Box>

        {/* Interactive Tree Section */}
        <Box sx={{ py: 12 }}>
          <Container maxWidth="xl">
            <Typography
              variant="h4"
              align="center"
              sx={{
                mb: 8,
                fontWeight: 300,
                fontSize: { xs: "1.75rem", md: "2.25rem" },
                letterSpacing: "-0.02em",
                fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
              }}
            >
              Interactive Ontology Visualization
            </Typography>

            <TreeVisualization
              data={data}
              isDark={isDark}
              viewType={viewType}
              onViewTypeChange={setViewType}
              focusNodeId="create-information"
            />

            {/* Helper Content */}
            <Box sx={{ maxWidth: "900px", mx: "auto", mt: 10, mb: 8 }}>
              <Grid container spacing={8}>
                <Grid item xs={12} md={4}>
                  <Box>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 600,
                        color: "primary.main",
                        mb: 2,
                        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                      }}
                    >
                      Verb Hierarchy
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: "text.primary",
                        lineHeight: 1.6,
                        fontWeight: 400,
                        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                      }}
                    >
                      The DAG diagram represents hierarchical levels of the verb ontology, progressing from general to specific tasks from left to right, with{" "}
                      <strong style={{ color: "#ff9800" }}>{`"Act"`}</strong> as the root node at the far left of the structure.
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Box>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 600,
                        color: "primary.main",
                        mb: 2,
                        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                      }}
                    >
                      Number of AI Apps
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: "text.primary",
                        lineHeight: 1.6,
                        fontWeight: 400,
                        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                      }}
                    >
                      Color intensity encodes the number of AI Apps associated with that activity. <strong style={{ color: "#ff9800" }}>Darker shades</strong> indicate higher concentrations of AI Apps performing that activity.
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Box>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 600,
                        color: "primary.main",
                        mb: 2,
                        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                      }}
                    >
                      Analysis Insights
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: "text.primary",
                        lineHeight: 1.6,
                        fontWeight: 400,
                        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                      }}
                    >
                      By quantifying and visualizing the distribution of AI Apps across this verb taxonomy, we identify{" "}
                      <strong style={{ color: "#ff9800" }}>patterns of concentration</strong>, reveal underrepresented task areas, and assess the breadth and limitations of current AI deployment.
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>

            {/* Legend */}
            <Box sx={{ mt: 8, mb: 6 }}>
              <Box
                sx={{
                  maxWidth: "800px",
                  mx: "auto",
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(255,255,255,0.01)"
                      : "rgba(0,0,0,0.02)",
                  borderRadius: 2,
                  border: (theme) =>
                    theme.palette.mode === "dark"
                      ? "1px solid rgba(255,255,255,0.05)"
                      : "1px solid rgba(0,0,0,0.05)",
                  p: 3,
                }}
              >
                <Grid container spacing={3}>
                  {/* DAG View Legend */}
                  <Grid item xs={12} md={6}>
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: 600, mb: 1.5, color: "text.secondary", fontSize: "0.875rem" }}
                    >
                      DAG View
                    </Typography>
                      
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                      {/* Nodes */}
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 16,
                            height: 16,
                            borderRadius: "50%",
                            bgcolor: "#ef4444",
                            border: "1px solid #999",
                            flexShrink: 0,
                          }}
                        />
                        <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.75rem" }}>
                          Activity nodes
                        </Typography>
                      </Box>

                      {/* Size */}
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <Box
                            sx={{
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              bgcolor: "#fca5a5",
                              border: "1px solid #999",
                            }}
                          />
                          <Box
                            sx={{
                              width: 16,
                              height: 16,
                              borderRadius: "50%",
                              bgcolor: "#ef4444",
                              border: "1px solid #999",
                            }}
                          />
                        </Box>
                        <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.75rem" }}>
                          Size = app count
                        </Typography>
                      </Box>

                      {/* Numbers */}
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Chip
                          label="1,234"
                          size="small"
                          sx={{
                            bgcolor: "#ff9800",
                            color: "white",
                            fontWeight: "bold",
                            fontSize: "0.625rem",
                            height: 18,
                          }}
                        />
                        <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.75rem" }}>
                          Exact counts
                        </Typography>
                      </Box>
                    </Box>
                    </Grid>

                  {/* Sunburst View Legend */}
                  <Grid item xs={12} md={6}>
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: 600, mb: 1.5, color: "text.secondary", fontSize: "0.875rem" }}
                    >
                      Sunburst View
                    </Typography>
                    
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                      {/* Segments */}
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 20,
                            height: 10,
                            bgcolor: "#ef4444",
                            border: "1px solid #999",
                            borderRadius: 1,
                          }}
                        />
                        <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.75rem" }}>
                          Hierarchical segments
                        </Typography>
                      </Box>

                      {/* Size proportion */}
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <Box
                            sx={{
                              width: 6,
                              height: 10,
                              bgcolor: "#fca5a5",
                              border: "1px solid #999",
                              borderRadius: 1,
                            }}
                          />
                          <Box
                            sx={{
                              width: 16,
                              height: 10,
                              bgcolor: "#ef4444",
                              border: "1px solid #999",
                              borderRadius: 1,
                            }}
                          />
                        </Box>
                        <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.75rem" }}>
                          Arc size = app count
                        </Typography>
                      </Box>

                      {/* Center */}
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 16,
                            height: 16,
                            borderRadius: "50%",
                            background: "linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)",
                            border: "1px solid rgba(0,0,0,0.4)",
                          }}
                        />
                        <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.75rem" }}>
                          Root category
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            </Box>

            {/* Stats */}
            <Box
              sx={{ mt: 8, display: "flex", justifyContent: "center", gap: 6 }}
            >
              <Card sx={{ minWidth: 120, textAlign: "center", p: 2 }}>
                <Typography
                  variant="h6"
                  sx={{ color: "primary.main", fontWeight: 600 }}
                >
                  {data.appCount.toLocaleString()}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary" }}
                >
                  AI Applications
                </Typography>
              </Card>

              <Card sx={{ minWidth: 120, textAlign: "center", p: 2 }}>
                <Typography
                  variant="h6"
                  sx={{ color: "secondary.main", fontWeight: 600 }}
                >
                  {countNodes(data)}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary" }}
                >
                  Ontology Nodes
                </Typography>
              </Card>
            </Box>
          </Container>
        </Box>

        {/* Footer */}
        <Footer isDark={isDark} />
      </Box>
    </ThemeProvider>
    </>
  );
};

// Helper function to count total nodes in tree
const countNodes = (node: TreeNode | null): number => {
  if (!node) return 0;
  let count = 1;
  if (node.children) {
    count += node.children.reduce(
      (sum: number, child: TreeNode) => sum + countNodes(child),
      0,
    );
  }
  return count;
};

export default OntologyExplorer;
