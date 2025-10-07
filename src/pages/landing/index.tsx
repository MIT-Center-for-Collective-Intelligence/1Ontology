import React, { useEffect } from "react";
import Head from "next/head";
import {
  Box,
  Button,
  Container,
  Grid,
  Paper,
  Typography,
  ThemeProvider,
  CssBaseline,
} from "@mui/material";
import { useThemeManager } from "../../lib/hooks/useThemeManager";
import {
  ChevronRight,
  OpenInNew,
} from "@mui/icons-material";
import  Navigation  from "./_components/Navigation";
import  MobileDrawer  from "./_components/MobileDrawer";
import  Footer  from "./_components/Footer";
import { createLandingTheme } from "../../theme/landingTheme";
import { useRouter } from "next/router";

const LandingPage = () => {
  const router = useRouter();
  const { isDark, handleThemeSwitch, isAuthenticated, isAuthLoading } = useThemeManager();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  const theme = createLandingTheme(isDark);
useEffect(() => {
  if(!router.isReady) return;
  router.replace(`/`);
}, [router.isReady]);
return <></>;

  return (
    <>
      <Head>
        <title>AI and the Future of Work - An Ontology Approach</title>
        <meta name="description" content="A comprehensive framework to systematically understand where and how AI can be used, and what this means for people and organizations." />
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

        {/* Hero Section - Subtle */}
        <Box
          sx={{
            pt: 18,
            pb: 12,
            bgcolor: "background.default",
          }}
        >
          <Container maxWidth="md">
            <Box sx={{ textAlign: "center", maxWidth: "700px", mx: "auto" }}>
              {/* Main Title */}
              <Typography
                variant="h2"
                component="h1"
                sx={{
                  fontWeight: 400,
                  mb: 1,
                  fontSize: {
                    xs: "2.25rem",
                    sm: "2.75rem",
                    md: "3.25rem",
                  },
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                  color: "text.primary",
                  fontFamily:
                    '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                }}
              >
                AI and the Future of Work
              </Typography>

              {/* Subtitle */}
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 300,
                  color: "primary.main",
                  mb: 4,
                  fontSize: { xs: "1.25rem", sm: "1.5rem", md: "1.75rem" },
                  letterSpacing: "-0.01em",
                  fontFamily:
                    '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                }}
              >
                An Ontology Approach
              </Typography>

              {/* Description */}
              <Typography
                variant="body1"
                sx={{
                  color: "text.secondary",
                  mb: 6,
                  lineHeight: 1.7,
                  maxWidth: "600px",
                  mx: "auto",
                  fontWeight: 400,
                  fontSize: { xs: "1rem", md: "1.125rem" },
                  fontFamily:
                    '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                }}
              >
                A comprehensive framework to systematically understand where
                and how AI can be used, and what this means for people and
                organizations.
              </Typography>

              {/* CTA Button */}
              <Box sx={{ display: "flex", justifyContent: "center" }}>
                <Button
                  component="a"
                  href="/landing/platform"
                  variant="contained"
                  color="primary"
                  size="medium"
                  endIcon={<ChevronRight />}
                  sx={{
                    px: 4,
                    py: 1.5,
                    fontSize: "1rem",
                    fontWeight: 500,
                    borderRadius: 2,
                    textTransform: "none",
                    fontFamily:
                      '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                  }}
                >
                  Explore Platform
                </Button>
              </Box>
            </Box>
          </Container>
        </Box>

        {/* Research Framework Section - Subtle */}
        <Box
          sx={{
            py: 10,
            bgcolor: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(0,0,0,0.02)"
                : "rgba(249,250,251,0.6)",
            borderTop: (theme) =>
              theme.palette.mode === "dark"
                ? "1px solid rgba(255,255,255,0.05)"
                : "1px solid rgba(148,163,184,0.12)",
          }}
        >
          <Container maxWidth="xl">

            {/* Main Content Grid */}
            <Grid
              container
              sx={{
                position: "relative",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  left: "33.333%",
                  top: 0,
                  bottom: 0,
                  width: "1px",
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(0,0,0,0.1)",
                  zIndex: 1,
                  display: { xs: "none", lg: "block" }, // Hide on mobile, show on large screens
                },
                "&::after": {
                  content: '""',
                  position: "absolute",
                  left: "66.666%",
                  top: 0,
                  bottom: 0,
                  width: "1px",
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(0,0,0,0.1)",
                  zIndex: 1,
                  display: { xs: "none", lg: "block" }, // Hide on mobile, show on large screens
                },
              }}
            >
              {/* Challenges Column */}
              <Grid item xs={12} lg={4}>
                <Box sx={{ px: 3, position: "relative", zIndex: 2 }}>
                  <Typography
                    variant="h5"
                    sx={{
                      mb: 3,
                      fontWeight: 600,
                      color: "primary.main",
                      fontFamily:
                        '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                    }}
                  >
                    Challenges
                  </Typography>

                  <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}
                  >
                    {[
                      "How to take advantage of AI opportunities?",
                      "Widespread anxiety and fear of job displacement",
                      "Many ad hoc approaches to using AI",
                    ].map((challenge, index) => (
                      <Typography
                        key={index}
                        variant="body1"
                        sx={{
                          color: "text.primary",
                          lineHeight: 1.6,
                          fontWeight: 400,
                          fontFamily:
                            '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                        }}
                      >
                        • {challenge}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              </Grid>

              {/* Horizontal divider for mobile */}
              <Box
                sx={{
                  display: { xs: "block", lg: "none" },
                  width: "100%",
                  height: "1px",
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(0,0,0,0.1)",
                  my: 4,
                }}
              />

              {/* Questions Column */}
              <Grid item xs={12} lg={4}>
                <Box sx={{ px: 3, position: "relative", zIndex: 2 }}>
                  <Typography
                    variant="h5"
                    sx={{
                      mb: 3,
                      fontWeight: 600,
                      color: "primary.main",
                      fontFamily:
                        '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                    }}
                  >
                    Questions
                  </Typography>

                  <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    {/* First Question - Diagram */}
                    <Box>
                      {/* Custom diagram matching the image exactly */}
                      <Box
                        sx={{
                          position: "relative",
                          py: 2,
                          px: 2,
                          mb: 0,
                        }}
                      >
                        {/* Question with precise positioning */}
                        <Box
                          sx={{
                            textAlign: "center",
                            mb: 6,
                            position: "relative",
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: "1.2rem",
                              fontWeight: 400,
                              color: "text.primary",
                              fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                              display: { xs: "block", lg: "inline-block" },
                              position: "relative",
                              textAlign: { xs: "left", lg: "center" },
                            }}
                          >
                            <Typography
                              component="span"
                              sx={{
                                color: "primary.main",
                                fontWeight: 700,
                                position: "relative",
                                fontSize: "1.2rem",
                              }}
                              id="where-word"
                            >
                              Where
                            </Typography>
                            {" and "}
                            <Typography
                              component="span"
                              sx={{
                                color: "primary.main",
                                fontWeight: 700,
                                position: "relative",
                                fontSize: "1.2rem",
                              }}
                              id="how-word"
                            >
                              how
                            </Typography>
                            {" can AI be used?"}
                          </Typography>

                          {/* Two mirrored L-shaped arrows (100% width) */}
                          <svg
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: "0",
                              width: "100%",
                              height: "65px",
                              pointerEvents: "none",
                            }}
                          >
                            {/* Left arrow: down-left-down (moved 15px left) */}
                            <path
                              id="arrow1q1"
                              d="M 80 6.5 L 80 33.8 L 47.5 33.8 L 47.5 55.25"
                              stroke="#ff9800"
                              strokeWidth="2"
                              fill="none"
                              strokeLinecap="square"
                            />

                            {/* Left arrow head pointing down */}
                            <polygon
                              points="47.5,61.75 42.3,55.25 52.7,55.25"
                              fill="#ff9800"
                            />

                            {/* Right arrow: down-right-down (horizontal line 105px longer) */}
                            <path
                              id="arrow2q1"
                              d="M 170 6.5 L 170 33.8 L 307.5 33.8 L 307.5 55.25"
                              stroke="#ff9800"
                              strokeWidth="2"
                              fill="none"
                              strokeLinecap="square"
                            />

                            {/* Right arrow head pointing down */}
                            <polygon
                              points="307.5,61.75 302.3,55.25 312.7,55.25"
                              fill="#ff9800"
                            />
                          </svg>
                        </Box>

                        {/* Modern target boxes with rounder borders */}
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: { xs: "flex-start", lg: "center" },
                            alignItems: "center",
                            gap: 10,
                            pt: "15px",
                          }}
                        >
                          <Box
                            sx={{
                              px: 2,
                              py: 1.5,
                              mr: 5,
                              border: "1px solid",
                              borderColor: "primary.main",
                              borderRadius: 3,
                              bgcolor: (theme) =>
                                theme.palette.mode === "dark"
                                  ? "rgba(255,152,0,0.05)"
                                  : "rgba(255,152,0,0.03)",
                              fontWeight: 500,
                              fontSize: "0.95rem",
                              color: "primary.main",
                              textAlign: "center",
                              fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                              minWidth: "90px",
                              transition: "all 0.2s ease",
                              "&:hover": {
                                bgcolor: (theme) =>
                                  theme.palette.mode === "dark"
                                    ? "rgba(255,152,0,0.1)"
                                    : "rgba(255,152,0,0.08)",
                                transform: "translateY(-1px)",
                                boxShadow: (theme) =>
                                  theme.palette.mode === "dark"
                                    ? "0 4px 12px rgba(255,152,0,0.2)"
                                    : "0 4px 12px rgba(255,152,0,0.15)",
                              },
                            }}
                          >
                            Activities
                          </Box>
                          <Box
                            sx={{
                              px: 2,
                              py: 1.5,
                              ml: 5,
                              border: "1px solid",
                              borderColor: "primary.main",
                              borderRadius: 3,
                              bgcolor: (theme) =>
                                theme.palette.mode === "dark"
                                  ? "rgba(255,152,0,0.05)"
                                  : "rgba(255,152,0,0.03)",
                              fontWeight: 500,
                              fontSize: "0.95rem",
                              color: "primary.main",
                              textAlign: "center",
                              fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                              minWidth: "90px",
                              transition: "all 0.2s ease",
                              "&:hover": {
                                bgcolor: (theme) =>
                                  theme.palette.mode === "dark"
                                    ? "rgba(255,152,0,0.1)"
                                    : "rgba(255,152,0,0.08)",
                                transform: "translateY(-1px)",
                                boxShadow: (theme) =>
                                  theme.palette.mode === "dark"
                                    ? "0 4px 12px rgba(255,152,0,0.2)"
                                    : "0 4px 12px rgba(255,152,0,0.15)",
                              },
                            }}
                          >
                            Processes
                          </Box>
                        </Box>
                      </Box>
                    </Box>

                    {/* Second Question */}
                    <Box sx={{ textAlign: { xs: "left", lg: "center" }, position: "relative" }}>
                      <Typography
                        variant="body1"
                        sx={{
                          mb: 2,
                          fontWeight: 600,
                          color: "text.primary",
                          fontSize: "1.2rem",
                          fontFamily:
                            '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                          textAlign: { xs: "left", lg: "center" },
                        }}
                      >
                        What does this mean for
                        <br />
                        <Typography
                          component="span"
                          sx={{ color: "primary.main", fontWeight: 700, fontSize: "1.2rem" }}
                        >
                          people
                        </Typography>{" "}
                        and{" "}
                        <Typography
                          component="span"
                          sx={{ color: "primary.main", fontWeight: 700, fontSize: "1.2rem" }}
                        >
                          organizations
                        </Typography>
                        ?
                      </Typography>

                      {/* Two mirrored L-shaped arrows for question 2 */}
                      <svg
                        style={{
                          position: "absolute",
                          top: "90%",
                          left: "0",
                          width: "100%",
                          height: "65px",
                          pointerEvents: "none",
                        }}
                      >
                                                {/* Left arrow: down-left-down (for "people") */}
                        <path
                          id="arrow1q2"
                          d="M 130 6.5 L 130 33.8 L 47.5 33.8 L 47.5 55.25"
                          stroke="#ff9800"
                          strokeWidth="2"
                          fill="none"
                          strokeLinecap="square"
                        />
                        
                        {/* Left arrow head pointing down */}
                        <polygon
                          points="47.5,61.75 42.3,55.25 52.7,55.25"
                          fill="#ff9800"
                        />

                                                {/* Right arrow: down-right-down (for "organizations") */}
                        <path
                          id="arrow2q2"
                          d="M 255 6.5 L 255 33.8 L 327.5 33.8 L 327.5 55.25"
                          stroke="#ff9800"
                          strokeWidth="2"
                          fill="none"
                          strokeLinecap="square"
                        />
                        
                        {/* Right arrow head pointing down */}
                        <polygon
                          points="327.5,61.75 322.3,55.25 332.7,55.25"
                          fill="#ff9800"
                        />
                      </svg>
                    </Box>
                    {/* Question 2 target boxes */}
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: { xs: "flex-start", lg: "center" },
                        alignItems: "center",
                        gap: 10,
                        pt: "25px",
                      }}
                    >
                      <Box
                        sx={{
                          px: 2,
                          py: 1.5,
                          border: "1px solid",
                          borderColor: "primary.main",
                          borderRadius: 3,
                          bgcolor: (theme) =>
                            theme.palette.mode === "dark"
                              ? "rgba(255,152,0,0.05)"
                              : "rgba(255,152,0,0.03)",
                          fontWeight: 500,
                          fontSize: "0.95rem",
                          color: "primary.main",
                          textAlign: "center",
                          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                          minWidth: "90px",
                          transition: "all 0.2s ease",
                          "&:hover": {
                            bgcolor: (theme) =>
                              theme.palette.mode === "dark"
                                ? "rgba(255,152,0,0.1)"
                                : "rgba(255,152,0,0.08)",
                            transform: "translateY(-1px)",
                            boxShadow: (theme) =>
                              theme.palette.mode === "dark"
                                ? "0 4px 12px rgba(255,152,0,0.2)"
                                : "0 4px 12px rgba(255,152,0,0.15)",
                          },
                        }}
                      >
                        Jobs & Skills
                      </Box>
                      <Box
                        sx={{
                          px: 2,
                          py: 1.5,
                          border: "1px solid",
                          borderColor: "primary.main",
                          borderRadius: 3,
                          bgcolor: (theme) =>
                            theme.palette.mode === "dark"
                              ? "rgba(255,152,0,0.05)"
                              : "rgba(255,152,0,0.03)",
                          fontWeight: 500,
                          fontSize: "0.95rem",
                          color: "primary.main",
                          textAlign: "center",
                          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                          minWidth: "90px",
                          transition: "all 0.2s ease",
                          "&:hover": {
                            bgcolor: (theme) =>
                              theme.palette.mode === "dark"
                                ? "rgba(255,152,0,0.1)"
                                : "rgba(255,152,0,0.08)",
                            transform: "translateY(-1px)",
                            boxShadow: (theme) =>
                              theme.palette.mode === "dark"
                                ? "0 4px 12px rgba(255,152,0,0.2)"
                                : "0 4px 12px rgba(255,152,0,0.15)",
                          },
                        }}
                      >
                        Processes, Products & Services
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Grid>

              {/* Horizontal divider for mobile */}
              <Box
                sx={{
                  display: { xs: "block", lg: "none" },
                  width: "100%",
                  height: "1px",
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(0,0,0,0.1)",
                  my: 4,
                }}
              />

              {/* Our Approach Column */}
              <Grid item xs={12} lg={4}>
                <Box sx={{ px: 3, position: "relative", zIndex: 2 }}>
                  <Typography
                    variant="h5"
                    sx={{
                      mb: 1,
                      fontWeight: 600,
                      color: "primary.main",
                      fontFamily:
                        '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                    }}
                  >
                    Our Approach:
                  </Typography>

                  <Typography
                    variant="h6"
                    sx={{
                      mb: 3,
                      fontWeight: 600,
                      color: "text.primary",
                      fontFamily:
                        '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                    }}
                  >
                    A Comprehensive Ontology of Work
                  </Typography>

                  <Typography
                    variant="body1"
                    sx={{
                      fontWeight: 600,
                      color: "text.primary",
                      mb: 2,
                      fontFamily:
                        '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                    }}
                  >
                    Hypotheses:
                  </Typography>

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
                        fontWeight: 400,
                        fontFamily:
                          '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                      }}
                    >
                      • There are fundamental{" "}
                      <Typography
                        component="span"
                        sx={{ color: "primary.main", fontWeight: 600 }}
                      >
                        patterns
                      </Typography>{" "}
                      in the activities and processes people and computers
                      do today.
                    </Typography>

                    <Typography
                      variant="body1"
                      sx={{
                        color: "text.primary",
                        lineHeight: 1.6,
                        fontWeight: 400,
                        fontFamily:
                          '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                      }}
                    >
                      • These patterns can be represented by{" "}
                      <Typography
                        component="span"
                        sx={{ color: "primary.main", fontWeight: 600 }}
                      >
                        {`"family trees"`}
                      </Typography>{" "}
                      of the different types of activities (an {`"ontology"`}).
                    </Typography>

                    <Typography
                      variant="body1"
                      sx={{
                        color: "text.primary",
                        lineHeight: 1.6,
                        fontWeight: 400,
                        fontFamily:
                          '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                      }}
                    >
                      • This ontology organizes work activities into a{" "}
                      <Typography
                        component="span"
                        sx={{ color: "primary.main", fontWeight: 600 }}
                      >
                        systematic framework
                      </Typography>{" "}
                      to automatically predict where and how AI can be used and help people flourish through this transition.
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Container>
        </Box>

        {/* Uses Section */}
        <Box
          sx={{
            py: 10,
            bgcolor: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(0,0,0,0.02)"
                : "rgba(248,250,252,0.5)",
            borderTop: (theme) =>
              theme.palette.mode === "dark"
                ? "1px solid rgba(255,255,255,0.05)"
                : "1px solid rgba(148,163,184,0.1)",
          }}
        >
          <Container maxWidth="xl">
            <Grid container>
              {/* Uses Section */}
              <Grid item xs={12}>
                <Box sx={{ position: "relative", zIndex: 2 }}>
                  <Typography
                    variant="h4"
                    sx={{
                      mb: 6,
                      fontWeight: 400,
                      fontSize: { xs: "1.75rem", md: "2rem" },
                      letterSpacing: "-0.01em",
                      color: "text.primary",
                      fontFamily:
                        '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                    }}
                  >
                    Uses
                  </Typography>

                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {/* Predicting Performance */}
                    <Box
                      sx={{
                        pb: 4,
                        borderBottom: (theme) =>
                          theme.palette.mode === "dark"
                            ? "1px solid rgba(255,255,255,0.08)"
                            : "1px solid rgba(0,0,0,0.08)",
                      }}
                    >
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 600,
                          color: "text.primary",
                          fontFamily:
                            '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                          fontSize: "1.1rem",
                          mb: 2,
                          lineHeight: 1.3,
                        }}
                      >
                        <Typography
                          component="span"
                          sx={{ color: "primary.main", fontWeight: 700, fontSize: "1.1rem" }}
                        >
                          Predicting
                        </Typography>{" "}
                        performance of human-AI workflows
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                        <Typography
                          sx={{
                            color: "primary.main",
                            fontSize: "1rem",
                            fontWeight: 500,
                            mt: 0.5,
                          }}
                        >
                          ↳
                        </Typography>
                        <Typography
                          variant="body1"
                          sx={{
                            color: "text.primary",
                            fontFamily:
                              '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                            lineHeight: 1.6,
                            flex: 1,
                          }}
                        >
                          Decide whether & how to automate or augment processes
                        </Typography>
                      </Box>
                    </Box>

                    {/* Learning from Activity "Relatives" */}
                    <Box
                      sx={{
                        py: 4,
                        borderBottom: (theme) =>
                          theme.palette.mode === "dark"
                            ? "1px solid rgba(255,255,255,0.08)"
                            : "1px solid rgba(0,0,0,0.08)",
                      }}
                    >
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 600,
                          color: "text.primary",
                          fontFamily:
                            '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                          fontSize: "1.1rem",
                          mb: 2,
                          lineHeight: 1.3,
                        }}
                      >
                        <Typography
                          component="span"
                          sx={{ color: "primary.main", fontWeight: 700, fontSize: "1.1rem" }}
                        >
                          Learning
                        </Typography>{" "}
                        from activity {`"relatives"`}
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                        <Typography
                          sx={{
                            color: "primary.main",
                            fontSize: "1rem",
                            fontWeight: 500,
                            mt: 0.5,
                          }}
                        >
                          ↳
                        </Typography>
                        <Typography
                          variant="body1"
                          sx={{
                            color: "text.primary",
                            fontFamily:
                              '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                            lineHeight: 1.6,
                            flex: 1,
                          }}
                        >
                          Rapidly adopt innovations from similar processes in
                          other organizations and industries
                        </Typography>
                      </Box>
                    </Box>

                    {/* Forecasting Displacement & Reskilling */}
                    <Box sx={{ pt: 4 }}>
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 600,
                          color: "text.primary",
                          fontFamily:
                            '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                          fontSize: "1.1rem",
                          mb: 2,
                          lineHeight: 1.3,
                        }}
                      >
                        <Typography
                          component="span"
                          sx={{ color: "primary.main", fontWeight: 700, fontSize: "1.1rem" }}
                        >
                          Forecasting
                        </Typography>{" "}
                        Displacement & Reskilling Opportunities
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                        <Typography
                          sx={{
                            color: "primary.main",
                            fontSize: "1rem",
                            fontWeight: 500,
                            mt: 0.5,
                          }}
                        >
                          ↳
                        </Typography>
                        <Typography
                          variant="body1"
                          sx={{
                            color: "text.primary",
                            fontFamily:
                              '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                            lineHeight: 1.6,
                            flex: 1,
                          }}
                        >
                          Develop appropriate policies and transition programs
                          to help workers
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Container>
        </Box>

        {/* Current Progress Section */}
        <Box
          sx={{
            py: 10,
            bgcolor: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(0,0,0,0.04)"
                : "rgba(249,250,251,0.6)",
            borderTop: (theme) =>
              theme.palette.mode === "dark"
                ? "1px solid rgba(255,255,255,0.05)"
                : "1px solid rgba(148,163,184,0.1)",
          }}
        >
          <Container maxWidth="xl">
            <Grid container>
              {/* Current Progress Section */}
              <Grid item xs={12}>
                <Box sx={{ position: "relative", zIndex: 2 }}>
                  <Typography
                    variant="h4"
                    sx={{
                      mb: 6,
                      fontWeight: 400,
                      fontSize: { xs: "1.75rem", md: "2rem" },
                      letterSpacing: "-0.01em",
                      color: "text.primary",
                      fontFamily:
                        '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                      textAlign: "left",
                    }}
                  >
                    Current Progress
                  </Typography>

                  <Grid 
                    container 
                    spacing={6}
                    sx={{
                      position: "relative",
                      "&::before": {
                        content: '""',
                        position: "absolute",
                        left: "50%",
                        top: "10%",
                        bottom: 0,
                        width: "1px",
                        bgcolor: (theme) =>
                          theme.palette.mode === "dark"
                            ? "rgba(255,255,255,0.1)"
                            : "rgba(0,0,0,0.1)",
                        zIndex: 1,
                        display: { xs: "none", lg: "block" }, // Hide on mobile, show on large screens
                      },
                    }}
                  >
                    {/* Left Column - Knowledge Base and Impacts on People */}
                    <Grid item xs={12} lg={6}>
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {/* Knowledge Base */}
                    <Box
                      sx={{
                        pb: 4,
                        mr: 2,
                        borderBottom: (theme) =>
                          theme.palette.mode === "dark"
                            ? "1px solid rgba(255,255,255,0.08)"
                            : "1px solid rgba(0,0,0,0.08)",
                      }}
                    >
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 700,
                          color: "primary.main",
                          fontFamily:
                            '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                          fontSize: "1.1rem",
                          mb: 3,
                          textDecoration: "underline",
                          textUnderlineOffset: "4px",
                        }}
                      >
                        Knowledge Base
                      </Typography>

                      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <Box>
                          <Typography
                            variant="body1"
                            sx={{
                              mb: 1.5,
                              fontWeight: 600,
                              color: "text.primary",
                              fontFamily:
                                '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                            }}
                          >
                            • Software:
                          </Typography>
                          <Typography
                            variant="body1"
                            sx={{
                              color: "text.primary",
                              lineHeight: 1.6,
                              fontFamily:
                                '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                              ml: 2,
                              mb: 2,
                            }}
                          >
                            Developed scalable{" "}
                            <Typography
                              component="span"
                              sx={{ color: "primary.main", fontWeight: 600 }}
                            >
                              software platform
                            </Typography>{" "}
                            for storing, editing, and viewing our ontology
                          </Typography>
                          <Box sx={{ ml: 2 }}>
                            <Button
                              variant="outlined"
                              size="small"
                              href="/landing/platform"
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
                              View Platform Details
                            </Button>
                          </Box>
                        </Box>

                        <Box>
                          <Typography
                            variant="body1"
                            sx={{
                              mb: 1.5,
                              fontWeight: 600,
                              color: "text.primary",
                              fontFamily:
                                '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                            }}
                          >
                            • Content:
                          </Typography>
                          <Typography
                            variant="body1"
                            sx={{
                              color: "text.primary",
                              lineHeight: 1.6,
                              fontFamily:
                                '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                              ml: 2,
                            }}
                          >
                            Developed data-driven verb hierarchy using all{" "}
                            <Typography
                              component="span"
                              sx={{ color: "primary.main", fontWeight: 600 }}
                            >
                              ≈20k O*Net tasks
                            </Typography>
                          </Typography>
                        </Box>
                      </Box>
                    </Box>

                    {/* Impacts on People */}
                    <Box sx={{ pt: 4 }}>
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 700,
                          color: "primary.main",
                          fontFamily:
                            '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                          fontSize: "1.1rem",
                          mb: 3,
                          textDecoration: "underline",
                          textUnderlineOffset: "4px",
                        }}
                      >
                        Impacts on People
                      </Typography>

                      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <Box>
                          <Typography
                            variant="body1"
                            sx={{
                              mb: 1.5,
                              fontWeight: 600,
                              color: "text.primary",
                              fontFamily:
                                '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                            }}
                          >
                            • Job Changes:
                          </Typography>
                          <Typography
                            variant="body1"
                            sx={{
                              color: "text.primary",
                              lineHeight: 1.6,
                              fontFamily:
                                '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                              ml: 2,
                            }}
                          >
                            Predicting which jobs will be automated vs augmented
                          </Typography>
                        </Box>

                        <Box>
                          <Typography
                            variant="body1"
                            sx={{
                              mb: 1.5,
                              fontWeight: 600,
                              color: "text.primary",
                              fontFamily:
                                '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                            }}
                          >
                            • Reskilling & Pre-skilling:
                          </Typography>
                          <Typography
                            variant="body1"
                            sx={{
                              color: "text.primary",
                              lineHeight: 1.6,
                              fontFamily:
                                '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                              ml: 2,
                            }}
                          >
                            {`Predicting skills needed for today's new jobs and
                            future jobs that do not yet exist`}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                      </Box>
                    </Grid>

                    {/* Horizontal divider for mobile */}
                    <Box
                      sx={{
                        display: { xs: "block", lg: "none" },
                        width: "100%",
                        height: "1px",
                        bgcolor: (theme) =>
                          theme.palette.mode === "dark"
                            ? "rgba(255,255,255,0.1)"
                            : "rgba(0,0,0,0.1)",
                        my: 4,
                      }}
                    />

                    {/* Right Column - Where & How AI Can Be Used */}
                    <Grid item xs={12} lg={6}>
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {/* Where & How AI Can Be Used */}
                    <Box
                      sx={{
                        py: 4,
                        borderBottom: (theme) =>
                          theme.palette.mode === "dark"
                            ? "1px solid rgba(255,255,255,0.08)"
                            : "1px solid rgba(0,0,0,0.08)",
                      }}
                    >
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 700,
                          color: "primary.main",
                          fontFamily:
                            '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                          fontSize: "1.1rem",
                          mb: 3,
                          textDecoration: "underline",
                          textUnderlineOffset: "4px",
                        }}
                      >
                        Where & How AI Can Be Used
                      </Typography>

                      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <Box>
                          <Typography
                            variant="body1"
                            sx={{
                              mb: 1.5,
                              fontWeight: 600,
                              color: "text.primary",
                              fontFamily:
                                '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                            }}
                          >
                            • Surveying Current Tools:
                          </Typography>
                          <Typography
                            variant="body1"
                            sx={{
                              color: "text.primary",
                              lineHeight: 1.6,
                              fontFamily:
                                '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                              ml: 2,
                              mb: 2,
                            }}
                          >
                            Mapping existing AI applications into our ontology
                          </Typography>
                          <Box sx={{ ml: 2 }}>
                            <Button
                              variant="outlined"
                              size="small"
                              href="/landing/ai-uses"
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
                              Explore AI Applications
                            </Button>
                          </Box>
                        </Box>

                        <Box>
                          <Typography
                            variant="body1"
                            sx={{
                              mb: 1.5,
                              fontWeight: 600,
                              color: "text.primary",
                              fontFamily:
                                '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                            }}
                          >
                            • Performance Prediction:
                          </Typography>
                          <Typography
                            variant="body1"
                            sx={{
                              color: "text.primary",
                              lineHeight: 1.6,
                              fontFamily:
                                '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                              ml: 2,
                              mb: 1,
                            }}
                          >
                            Fitting models to experimental data comparing humans,
                            humans with AI, and AI in different process
                            configurations
                          </Typography>
                          <Typography
                            variant="body1"
                            sx={{
                              color: "text.primary",
                              lineHeight: 1.6,
                              fontFamily:
                                '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                              ml: 2,
                            }}
                          >
                            Measuring relative abilities of humans and AI on
                            various tasks
                          </Typography>
                        </Box>

                        <Box>
                          <Typography
                            variant="body1"
                            sx={{
                              mb: 1.5,
                              fontWeight: 600,
                              color: "text.primary",
                              fontFamily:
                                '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                            }}
                          >
                            • Case Studies:
                          </Typography>
                          <Typography
                            variant="body1"
                            sx={{
                              color: "text.primary",
                              lineHeight: 1.6,
                              fontFamily:
                                '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                              ml: 2,
                            }}
                          >
                            Working with industry partners to map their operations
                            to our ontology and identify AI use cases
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>
              </Grid>
            </Grid>
          </Container>
        </Box>

        {/* Sophisticated Inheritance Section */}
        <Box
          id="ontology"
          sx={{
            py: 8,
            bgcolor: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(0,0,0,0.2)"
                : "rgba(247,248,250,0.7)",
            borderTop: (theme) =>
              theme.palette.mode === "dark"
                ? "1px solid rgba(255,255,255,0.08)"
                : "1px solid rgba(148,163,184,0.15)",
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
                  ? "linear-gradient(180deg, rgba(255,152,0,0.01) 0%, transparent 50%, rgba(33,150,243,0.01) 100%)"
                  : "linear-gradient(180deg, rgba(255,152,0,0.02) 0%, transparent 50%, rgba(33,150,243,0.02) 100%)",
              zIndex: 0,
            }}
          />

          <Container maxWidth="xl" sx={{ position: "relative", zIndex: 1 }}>
            {/* Section Header */}
            <Box sx={{ textAlign: "center", mb: 6 }}>
              <Typography
                variant="h4"
                sx={{
                  mb: 4,
                  fontWeight: 400,
                  fontSize: { xs: "1.75rem", md: "2rem" },
                  letterSpacing: "-0.01em",
                  color: "text.primary",
                  fontFamily:
                    '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                }}
              >
                Inheritance
              </Typography>


            </Box>

            {/* Inheritance Information - Compact */}
            <Box sx={{ mb: 6, maxWidth: "600px", mx: "auto" }}>
              <Typography
                variant="body1"
                sx={{
                  mb: 4,
                  fontWeight: 500,
                  color: "text.primary",
                  fontFamily:
                    '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                  textAlign: "center",
                  fontSize: "1rem",
                  lineHeight: 1.6,
                }}
              >
                Specializations {`"inherit"`} (and may {`"over-ride"`}) properties from
                their generalizations:
              </Typography>

              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  flexWrap: "wrap",
                  gap: 3,
                  mb: 0,
                }}
              >
                {[
                  { label: "Parts / processes", color: "primary.main" },
                  { label: "Evaluation criteria", color: "primary.main" },
                  {
                    label: "Performance prediction models",
                    color: "primary.main",
                  },
                ].map((item, index) => (
                  <Box
                    key={index}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                    }}
                  >
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        bgcolor: item.color,
                        borderRadius: "50%",
                        flexShrink: 0,
                        boxShadow: "0 0 6px rgba(255,152,0,0.4)",
                      }}
                    />
                    <Typography
                      variant="body1"
                      sx={{
                        fontFamily:
                          '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                        fontWeight: 400,
                        color: "text.primary",
                        fontSize: "0.95rem",
                      }}
                    >
                      {item.label}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Large Central Image */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                position: "relative",
                maxWidth: "1400px",
                mx: "auto",
              }}
            >
              {/* Decorative background elements */}
              <Box
                sx={{
                  position: "absolute",
                  top: -40,
                  right: -40,
                  width: 150,
                  height: 150,
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg, rgba(255,152,0,0.08) 0%, rgba(33,150,243,0.08) 100%)",
                  filter: "blur(50px)",
                  zIndex: 0,
                }}
              />

              <Box
                sx={{
                  position: "absolute",
                  bottom: -30,
                  left: -30,
                  width: 120,
                  height: 120,
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg, rgba(76,175,80,0.08) 0%, rgba(255,152,0,0.08) 100%)",
                  filter: "blur(40px)",
                  zIndex: 0,
                }}
              />

              <Paper
                elevation={16}
                sx={{
                  borderRadius: 3,
                  overflow: "hidden",
                  position: "relative",
                  zIndex: 1,
                  width: "100%",
                  border: (theme) =>
                    theme.palette.mode === "dark"
                      ? "1px solid rgba(255,255,255,0.1)"
                      : "1px solid rgba(0,0,0,0.08)",
                  boxShadow: (theme) =>
                    theme.palette.mode === "dark"
                      ? "0 32px 64px -12px rgba(0,0,0,0.6)"
                      : "0 32px 64px -12px rgba(0,0,0,0.2)",
                  transition: "all 0.4s ease",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: (theme) =>
                      theme.palette.mode === "dark"
                        ? "0 40px 80px -12px rgba(0,0,0,0.7)"
                        : "0 40px 80px -12px rgba(0,0,0,0.25)",
                  },
                }}
              >
                <Box
                  component="img"
                  src={isDark ? "/inheritance_dark.jpg" : "/inheritance_light.jpg"}
                  alt="Inheritance diagram showing ontology structure"
                  sx={{
                    width: "100%",
                    height: "auto",
                    display: "block",
                  }}
                />
              </Paper>
            </Box>

            {/* Highlighted text below image */}
            <Box sx={{ textAlign: "center", mt: 6, maxWidth: "700px", mx: "auto" }}>
              <Typography
                variant="h6"
                sx={{
                  color: "primary.main",
                  lineHeight: 1.6,
                  fontWeight: 600,
                  fontSize: "1.125rem",
                  fontFamily:
                    '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                }}
              >
                The ontology structure allows us to{" "}
                <Typography
                  component="span"
                  sx={{ 
                    fontWeight: 700,
                    fontSize: "1.125rem",
                    fontStyle: "italic",
                  }}
                >
                  automatically scale our knowledge
                </Typography>{" "}
                using the principle of inheritance
              </Typography>
            </Box>
          </Container>
        </Box>

        {/* Sophisticated CTA Section */}
        <Box
          sx={{
            py: 12,
            bgcolor: (theme) =>
              theme.palette.mode === "dark"
                ? "linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)"
                : "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
            borderTop: (theme) =>
              theme.palette.mode === "dark"
                ? "1px solid rgba(255,255,255,0.08)"
                : "1px solid rgba(0,0,0,0.1)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Elegant background pattern */}
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: (theme) =>
                theme.palette.mode === "dark"
                  ? `radial-gradient(circle at 50% 50%, rgba(255,152,0,0.03) 0%, transparent 70%),
                 radial-gradient(circle at 20% 20%, rgba(33,150,243,0.02) 0%, transparent 50%)`
                  : `radial-gradient(circle at 50% 50%, rgba(255,152,0,0.04) 0%, transparent 70%),
                 radial-gradient(circle at 20% 20%, rgba(33,150,243,0.03) 0%, transparent 50%)`,
              zIndex: 0,
            }}
          />

          <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
            <Box sx={{ textAlign: "center" }}>
              <Typography
                variant="h3"
                sx={{
                  mb: 3,
                  fontWeight: 300,
                  fontSize: { xs: "1.75rem", md: "2.25rem", lg: "2.75rem" },
                  letterSpacing: "-0.02em",
                  color: (theme) =>
                    theme.palette.mode === "dark" ? "#f8f9fa" : "#1a1a1a",
                  fontFamily:
                    '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                }}
              >
                Start Exploring the Platform
              </Typography>

              <Typography
                variant="h6"
                sx={{
                  mb: 5,
                  color: (theme) =>
                    theme.palette.mode === "dark" ? "#94a3b8" : "#64748b",
                  lineHeight: 1.7,
                  maxWidth: "600px",
                  mx: "auto",
                  fontWeight: 400,
                  fontSize: { xs: "1rem", md: "1.125rem" },
                  fontFamily:
                    '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                }}
              >
                Access our comprehensive ontology editing platform and contribute to
                advancing our understanding of AI integration in work processes.
              </Typography>

              <Box
                sx={{
                  display: "flex",
                  gap: 3,
                  justifyContent: "center",
                  flexDirection: { xs: "column", sm: "row" },
                  alignItems: "center",
                }}
              >
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  endIcon={<OpenInNew />}
                  component="a"
                  href="/"
                  sx={{ px: 4 }}
                >
                  {isAuthenticated ? "Go to Platform" : "Access Research Platform"}
                </Button>
              </Box>
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

export default LandingPage;
