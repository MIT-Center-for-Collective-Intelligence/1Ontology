import React, { useState } from "react";
import { useRouter } from "next/router";
import {
  AppBar,
  Box,
  Button,
  Container,
  Grid,
  IconButton,
  Toolbar,
  Typography,
  ThemeProvider,
  createTheme,
  CssBaseline,
  Card,
  CardContent,
  Divider,
  Chip,
} from "@mui/material";
import {
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  Menu as MenuIcon,
} from "@mui/icons-material";
import TreeVisualization, { TreeNode } from "../components/TreeVisualization";

// Data definition moved to TreeVisualization component

// Simplified demo data - just node title, children, and app count
const simplifiedSampleData: TreeNode = {
  name: "Act",
  appCount: 30068,
  children: [
    {
      name: 'Act on information ("Think")',
      appCount: 18178,
      children: [
        {
          name: "Create information",
          appCount: 8392,
          children: [
            {
              name: "Decide",
              appCount: 36,
              children: [],
            },
            {
              name: "Plan",
              appCount: 396,
              children: [],
            },
            {
              name: "Analyze",
              appCount: 1317,
              children: [],
            },
            {
              name: "Design",
              appCount: 186,
              children: [],
            },
          ],
        },
        {
          name: "Modify information",
          appCount: 420,
          children: [
            {
              name: "Revise",
              appCount: 410,
              children: [],
            },
            {
              name: "Convert",
              appCount: 268,
              children: [],
            },
          ],
        },
        {
          name: "Transfer information",
          appCount: 18728,
          children: [
            {
              name: "Get information",
              appCount: 1658,
              children: [],
            },
            {
              name: "Provide information",
              appCount: 14308,
              children: [],
            },
            {
              name: "Exchange information",
              appCount: 2762,
              children: [],
            },
          ],
        },
      ],
    },
    {
      name: 'Act on physical objects ("Do")',
      appCount: 13,
      children: [
        {
          name: "Create physical objects",
          appCount: 0,
          children: [],
        },
        {
          name: "Modify physical objects",
          appCount: 13,
          children: [],
        },
        {
          name: "Transfer physical objects",
          appCount: 0,
          children: [],
        },
      ],
    },
    {
      name: 'Act with other actors ("Interact")',
      appCount: 11877,
      children: [
        {
          name: "Transfer service",
          appCount: 2513,
          children: [
            {
              name: "Assist",
              appCount: 1956,
              children: [],
            },
            {
              name: "Facilitate",
              appCount: 1945,
              children: [],
            },
            {
              name: "Teach",
              appCount: 2002,
              children: [],
            },
          ],
        },
        {
          name: "Exchange information",
          appCount: 2762,
          children: [],
        },
      ],
    },
  ],
};

const OntologyExplorer = () => {
  const router = useRouter();
  const [isDark, setIsDark] = useState(true);
  const [viewType, setViewType] = useState<"tree" | "sunburst">("tree");

  const theme = createTheme({
    palette: {
      mode: isDark ? "dark" : "light",
      primary: {
        main: "#ff9800",
        light: "#ffb74d",
        dark: "#f57c00",
      },
      secondary: {
        main: "#2196f3",
      },
      background: {
        default: isDark ? "#121212" : "#fafafa",
        paper: isDark ? "#1e1e1e" : "#ffffff",
      },
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: "none",
            borderRadius: 8,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
    },
  });

  const handleThemeSwitch = () => setIsDark(!isDark);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
        {/* Navigation */}
        <AppBar
          position="fixed"
          elevation={0}
          sx={{
            bgcolor: "background.paper",
            backdropFilter: "blur(8px)",
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Container maxWidth="xl">
            <Toolbar sx={{ justifyContent: "space-between", py: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <img
                    src={
                      isDark
                        ? "/MIT-Logo-small-Dark.png"
                        : "/MIT-Logo-Small-Light.png"
                    }
                    alt="MIT Logo"
                    style={{ height: "32px", width: "auto" }}
                  />
                </Box>
                <Box sx={{ display: { xs: "none", sm: "block" } }}>
                  <Typography
                    variant="body1"
                    sx={{ fontWeight: 500, color: "text.primary" }}
                  >
                    Ontology of Collective Intelligence
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary" }}
                  >
                    AI & Future of Work
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box
                  sx={{
                    display: { xs: "none", md: "flex" },
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  {[
                    { title: "Home", href: "/landing" },
                    { title: "Platform", href: "/platform-details" },
                    { title: "AI Uses", href: "/ai-uses" },
                  ].map((link, index) => {
                    const isActive = router.pathname === link.href;
                    
                    return (
                      <Button
                        key={index}
                        component="a"
                        href={link.href}
                        sx={{
                          color: isActive ? "primary.main" : "text.primary",
                          bgcolor: isActive ? "rgba(255,152,0,0.1)" : "transparent",
                          fontWeight: isActive ? 600 : 400,
                          "&:hover": { 
                            color: "primary.main",
                            bgcolor: "rgba(255,152,0,0.1)",
                          },
                          textTransform: "none",
                          borderRadius: 1,
                        }}
                      >
                        {link.title}
                      </Button>
                    );
                  })}
                </Box>

                <IconButton
                  onClick={handleThemeSwitch}
                  sx={{ bgcolor: "action.hover" }}
                >
                  {isDark ? <LightModeIcon /> : <DarkModeIcon />}
                </IconButton>

                <Button
                  variant="text"
                  color="primary"
                  sx={{ display: { xs: "none", sm: "inline-flex" } }}
                >
                  Sign In
                </Button>
                <Button variant="contained" color="primary">
                  Register
                </Button>

                <IconButton sx={{ display: { xs: "flex", md: "none" } }}>
                  <MenuIcon />
                </IconButton>
              </Box>
            </Toolbar>
          </Container>
        </AppBar>

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

            {/* Motivation & Methodology Cards */}
            <Grid container spacing={4} sx={{ maxWidth: "1200px", mx: "auto" }}>
              {/* Motivation Card */}
              <Grid item xs={12} lg={6}>
                <Card
                  sx={{
                    height: "100%",
                    bgcolor: (theme) =>
                      theme.palette.mode === "dark"
                        ? "rgba(255,255,255,0.03)"
                        : "rgba(255,255,255,0.7)",
                    borderRadius: 3,
                    border: (theme) =>
                      theme.palette.mode === "dark"
                        ? "1px solid rgba(255,255,255,0.08)"
                        : "1px solid rgba(0,0,0,0.08)",
                    boxShadow: (theme) =>
                      theme.palette.mode === "dark"
                        ? "0 8px 32px rgba(0,0,0,0.2)"
                        : "0 8px 32px rgba(0,0,0,0.08)",
                    backdropFilter: "blur(20px)",
                    transition: "all 0.3s ease",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow: (theme) =>
                        theme.palette.mode === "dark"
                          ? "0 12px 40px rgba(0,0,0,0.3)"
                          : "0 12px 40px rgba(0,0,0,0.12)",
                    },
                  }}
                >
                  <CardContent sx={{ p: 4 }}>
                    {/* Header with underline */}
                    <Box
                      sx={{
                        borderBottom: "3px solid #ff9800",
                        pb: 1,
                        mb: 3,
                      }}
                    >
                      <Typography
                        variant="h4"
                        sx={{
                          fontWeight: 600,
                          color: "#ff9800",
                          fontFamily:
                            '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                        }}
                      >
                        Motivation
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2.5,
                      }}
                    >
                      <Typography
                        variant="body1"
                        sx={{
                          color: "text.primary",
                          lineHeight: 1.6,
                          fontFamily:
                            '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                        }}
                      >
                        • The rapid emergence of thousands of AI applications
                        across diverse domains underscores an urgent question:{" "}
                        <strong
                          style={{ color: "#ff9800", fontStyle: "italic" }}
                        >
                          Where can AI be useful?
                        </strong>
                      </Typography>

                      <Typography
                        variant="body1"
                        sx={{
                          color: "text.primary",
                          lineHeight: 1.6,
                          fontFamily:
                            '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
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
                          fontFamily:
                            '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
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
                          fontFamily:
                            '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
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
                  </CardContent>
                </Card>
              </Grid>

              {/* Methodology Card */}
              <Grid item xs={12} lg={6}>
                <Card
                  sx={{
                    height: "100%",
                    bgcolor: (theme) =>
                      theme.palette.mode === "dark"
                        ? "rgba(255,255,255,0.03)"
                        : "rgba(255,255,255,0.7)",
                    borderRadius: 3,
                    border: (theme) =>
                      theme.palette.mode === "dark"
                        ? "1px solid rgba(255,255,255,0.08)"
                        : "1px solid rgba(0,0,0,0.08)",
                    boxShadow: (theme) =>
                      theme.palette.mode === "dark"
                        ? "0 8px 32px rgba(0,0,0,0.2)"
                        : "0 8px 32px rgba(0,0,0,0.08)",
                    backdropFilter: "blur(20px)",
                    transition: "all 0.3s ease",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow: (theme) =>
                        theme.palette.mode === "dark"
                          ? "0 12px 40px rgba(0,0,0,0.3)"
                          : "0 12px 40px rgba(0,0,0,0.12)",
                    },
                  }}
                >
                  <CardContent sx={{ p: 4 }}>
                    {/* Header with underline */}
                    <Box
                      sx={{
                        borderBottom: "3px solid #ff9800",
                        pb: 1,
                        mb: 3,
                      }}
                    >
                      <Typography
                        variant="h4"
                        sx={{
                          fontWeight: 600,
                          color: "#ff9800",
                          fontFamily:
                            '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                        }}
                      >
                        Methodology
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2.5,
                      }}
                    >
                      <Box>
                        <Typography
                          variant="body1"
                          sx={{
                            color: "text.primary",
                            lineHeight: 1.6,
                            fontFamily:
                              '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
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
                        <Typography
                          variant="caption"
                          sx={{
                            color: "text.secondary",
                            fontStyle: "italic",
                            display: "block",
                            mt: 0.5,
                            fontFamily:
                              '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                          }}
                        >
                          (see companion poster: "AI and the Future of Work: The
                          Ontology Approach")
                        </Typography>
                      </Box>

                      <Typography
                        variant="body1"
                        sx={{
                          color: "text.primary",
                          lineHeight: 1.6,
                          fontFamily:
                            '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                        }}
                      >
                        •{" "}
                        <strong style={{ color: "#ff9800" }}>
                          Source of AI App Data:
                        </strong>{" "}
                        Leveraged the{" "}
                        <strong style={{ fontStyle: "italic" }}>
                          "There's an AI for That"
                        </strong>{" "}
                        platform, which catalogs over{" "}
                        <strong>13,000 AI Apps</strong> across diverse domains.
                        Each entry includes metadata such as the app's name,
                        function, task description, tags, and taglines, enabling
                        rich task-level analysis.
                      </Typography>

                      <Typography
                        variant="body1"
                        sx={{
                          color: "text.primary",
                          lineHeight: 1.6,
                          fontFamily:
                            '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
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
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Container>
        </Box>

        {/* Interactive Tree Section */}
        <Box sx={{ py: 8 }}>
          <Container maxWidth="xl">
            <Typography
              variant="h4"
              align="center"
              sx={{ mb: 6, fontWeight: 600 }}
            >
              Interactive Ontology Visualization
            </Typography>

            <TreeVisualization
              data={simplifiedSampleData}
              isDark={isDark}
              viewType={viewType}
              onViewTypeChange={setViewType}
            />

            {/* Legend */}
            <Box sx={{ mt: 4, mb: 3 }}>
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
                  {/* Tree View Legend */}
                  <Grid item xs={12} md={6}>
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: 600, mb: 1.5, color: "text.secondary", fontSize: "0.875rem" }}
                    >
                      Tree View
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
              sx={{ mt: 4, display: "flex", justifyContent: "center", gap: 4 }}
            >
              <Card sx={{ minWidth: 120, textAlign: "center" }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography
                    variant="h6"
                    sx={{ color: "primary.main", fontWeight: 600 }}
                  >
                    {simplifiedSampleData.appCount.toLocaleString()}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary" }}
                  >
                    AI Applications
                  </Typography>
                </CardContent>
              </Card>

              <Card sx={{ minWidth: 120, textAlign: "center" }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography
                    variant="h6"
                    sx={{ color: "secondary.main", fontWeight: 600 }}
                  >
                    {countNodes(simplifiedSampleData)}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary" }}
                  >
                    Ontology Nodes
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          </Container>
        </Box>

        {/* Footer */}
        <Box
          component="footer"
          sx={{
            py: 6,
            bgcolor: "background.paper",
            borderTop: 1,
            borderColor: "divider",
          }}
        >
          <Container maxWidth="xl">
            <Grid container spacing={4}>
              <Grid item xs={12} md={8}>
                <Box
                  sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}
                >
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 700, color: "primary.main" }}
                  >
                    MIT
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    AI Ontology Explorer
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", mb: 3, lineHeight: 1.6 }}
                >
                  Interactive visualization platform for exploring AI
                  applications within the ontology of work activities. Part of
                  the comprehensive research on AI and the future of work.
                </Typography>
              </Grid>

              <Grid item xs={12} md={4}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                  Resources
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <Typography
                    component="a"
                    href="#"
                    variant="body2"
                    sx={{
                      color: "text.secondary",
                      textDecoration: "none",
                      "&:hover": { color: "primary.main" },
                    }}
                  >
                    Research Documentation
                  </Typography>
                  <Typography
                    component="a"
                    href="#"
                    variant="body2"
                    sx={{
                      color: "text.secondary",
                      textDecoration: "none",
                      "&:hover": { color: "primary.main" },
                    }}
                  >
                    Data Export
                  </Typography>
                  <Typography
                    component="a"
                    href="#"
                    variant="body2"
                    sx={{
                      color: "text.secondary",
                      textDecoration: "none",
                      "&:hover": { color: "primary.main" },
                    }}
                  >
                    API Access
                  </Typography>
                  <Typography
                    component="a"
                    href="https://m3s.mit.edu/"
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="body2"
                    sx={{
                      color: "text.secondary",
                      textDecoration: "none",
                      "&:hover": { color: "primary.main" },
                    }}
                  >
                    Research Info
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            <Divider sx={{ my: 4 }} />

            <Typography
              variant="body2"
              align="center"
              sx={{ color: "text.secondary" }}
            >
              © 2025 MIT. T6. Designing Human-AI Teams - AI Ontology Explorer.
            </Typography>
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
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
