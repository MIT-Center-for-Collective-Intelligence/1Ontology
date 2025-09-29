import React, { useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  AppBar,
  Box,
  Button,
  Container,
  Grid,
  IconButton,
  Paper,
  Toolbar,
  Typography,
  ThemeProvider,
  createTheme,
  CssBaseline,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  TextField,
  InputAdornment,
  Divider,
  useMediaQuery,
  Drawer,
  ListItemButton,
} from "@mui/material";
import { useThemeManager } from "../lib/hooks/useThemeManager";
import {
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  Search,
  KeyboardArrowDown,
  KeyboardArrowRight,
  FiberManualRecord,
  OpenInNew,
  Menu as MenuIcon,
  AccountTree as AccountTreeIcon,
} from "@mui/icons-material";

const SidebarButton = ({
  icon,
  onClick,
}: {
  icon: React.ReactNode;
  onClick: () => void;
}) => (
  <IconButton onClick={onClick} size="small">
    {icon}
  </IconButton>
);

// Modern Tooltip Component
type FeatureType =
  | "semanticSearch"
  | "outlineView"
  | "selectedActivity"
  | "generalizations"
  | "specializations"
  | "parts"
  | "isPartOf"
  | "inheritance"
  | "inheritedParts";


// Message Bubble Component with varied layouts
const MessageBubble = ({
  feature,
  arrowPosition = "top",
  placement = "below",
  customArrowOffset,
  position,
  sx = {},
  scale = 1,
}: {
  feature: FeatureType;
  arrowPosition?: "top" | "bottom" | "left" | "right";
  placement?: "below" | "above" | "left" | "right" | "outside-left" | "outside-right";
  customArrowOffset?: { x?: number; y?: number };
  position?: { x?: number; y?: number };
  sx?: any;
  scale?: number;
}) => {
  const arrowSize = 10; // inner (fill) triangle size (bigger for clearer 1px border)
  const arrowBorderSize = arrowSize + 1; // outer (border) triangle size to create a 1px border
  const featureDetails = {
    semanticSearch: {
      title: "Semantic Search",
      description:
        "Finds the closest activities based on keywords and semantic embedding similarity.",
    },
    outlineView: {
      title: "Outline View",
      description:
        "Specializations of an activity are shown indented below that activity. Only the path to the selected activity is expanded.",
    },
    selectedActivity: {
      title: "Selected Activity",
      description: "The activity with details expanded on the right side.",
    },
    generalizations: {
      title: "Generalizations",
      description:
        "More general activities of which this activity is a type (i.e., a specialization).",
    },
    specializations: {
      title: "Specializations",
      description:
        "More specific types of this activity. These specializations are grouped into collections that differ along multiple dimensions, such as 'Transport what?' and 'Transport how?'",
    },
    parts: {
      title: "Parts",
      description:
        "The sub-activities of this activity. These parts define the internal process or structure of the activity.",
    },
    isPartOf: {
      title: "Is Part of",
      description:
        "Shows which larger activities this current activity is a component of.",
    },
    inheritance: {
      title: "Inheritance of Parts",
      description:
        "Specializations inherit parts from their generalizations in specific ways: = (No change: direct inheritance), > (Specialized part), × (Part not inherited), + (Part added).",
    },
    inheritedParts: {
      title: "Parts Inherited from Generalizations",
      description:
        "Shows how parts are inherited from parent activities and how they are transformed or specialized in the current activity.",
    },
  };

  const currentFeature = featureDetails[feature];

  // Arrow styles based on position (outer triangle: border)
  const getArrowStyles = () => {
    const defaultOffsetX = 16;
    const defaultOffsetY = 16;
    const offsetX = customArrowOffset?.x ?? defaultOffsetX;
    const offsetY = customArrowOffset?.y ?? defaultOffsetY;

    switch (arrowPosition) {
      case "top":
        return {
          top: `-${arrowBorderSize}px`,
          left: offsetX,
          borderLeft: `${arrowBorderSize}px solid transparent`,
          borderRight: `${arrowBorderSize}px solid transparent`,
          borderBottom: `${arrowBorderSize}px solid var(--bubble-border)`,
        };
      case "bottom":
        return {
          bottom: `-${arrowBorderSize}px`,
          left: offsetX,
          borderLeft: `${arrowBorderSize}px solid transparent`,
          borderRight: `${arrowBorderSize}px solid transparent`,
          borderTop: `${arrowBorderSize}px solid var(--bubble-border)`,
        };
      case "left":
        return {
          left: `-${arrowBorderSize}px`,
          top: offsetY,
          borderTop: `${arrowBorderSize}px solid transparent`,
          borderBottom: `${arrowBorderSize}px solid transparent`,
          borderRight: `${arrowBorderSize}px solid var(--bubble-border)`,
        };
      case "right":
        return {
          right: `-${arrowBorderSize}px`,
          top: offsetY,
          borderTop: `${arrowBorderSize}px solid transparent`,
          borderBottom: `${arrowBorderSize}px solid transparent`,
          borderLeft: `${arrowBorderSize}px solid var(--bubble-border)`,
        };
      default:
        return {
          top: `-${arrowBorderSize}px`,
          left: offsetX,
          borderLeft: `${arrowBorderSize}px solid transparent`,
          borderRight: `${arrowBorderSize}px solid transparent`,
          borderBottom: `${arrowBorderSize}px solid var(--bubble-border)`,
        };
    }
  };

  // Container styles based on placement
  const getContainerStyles = () => {
    const baseStyles = {
      position: (placement.includes("outside") || position) ? "absolute" : "relative",
      zIndex: (placement.includes("outside") || position) ? 10 : 1,
    };

    // If custom position is provided, use it
    if (position) {
      return {
        ...baseStyles,
        left: position.x,
        top: position.y,
        width: scale < 0.9 ? 200 : 250,
      };
    }

    switch (placement) {
      case "outside-left":
        return {
          ...baseStyles,
          left: scale < 0.9 ? -220 : -280,
          top: "50%",
          transform: "translateY(-50%)",
          width: scale < 0.9 ? 200 : 250,
          display: { xs: "none", lg: "block" }, // Hide on small screens
        };
      case "outside-right":
        return {
          ...baseStyles,
          right: scale < 0.9 ? -220 : -280,
          top: "50%",
          transform: "translateY(-50%)",
          width: scale < 0.9 ? 200 : 250,
          display: { xs: "none", lg: "block" }, // Hide on small screens
        };
      case "above":
        return {
          ...baseStyles,
          mb: 2,
          mt: 0,
        };
      case "left":
        return {
          ...baseStyles,
          position: "absolute",
          left: scale < 0.9 ? -220 : -280,
          top: 0,
          width: scale < 0.9 ? 200 : 250,
          display: { xs: "none", md: "block" }, // Hide on small screens
        };
      case "right":
        return {
          ...baseStyles,
          position: "absolute",
          right: scale < 0.9 ? -220 : -280,
          top: 0,
          width: scale < 0.9 ? 200 : 250,
          display: { xs: "none", md: "block" }, // Hide on small screens
        };
      default: // below
        return {
          ...baseStyles,
          mt: 2,
        };
    }
  };

  return (
    <Box
      sx={{
        "--bubble-bg": (theme) =>
          theme.palette.mode === "dark"
            ? "rgba(255,152,0,0.08)"
            : "rgba(255,152,0,0.05)",
        "--bubble-border": (theme) =>
          theme.palette.mode === "dark"
            ? "rgba(255,255,255,0.1)"
            : "rgba(0,0,0,0.08)",
        p: 2.5,
        bgcolor: "var(--bubble-bg)",
        border: "1px solid var(--bubble-border)",
        borderRadius: 3,
        boxShadow: (theme) =>
          theme.palette.mode === "dark"
            ? "0 4px 16px rgba(0,0,0,0.4)"
            : "0 4px 16px rgba(0,0,0,0.15)",
        backdropFilter: "blur(8px)",
        "&::before": {
          content: '""',
          position: "absolute",
          width: 0,
          height: 0,
          zIndex: 1,
          ...getArrowStyles(),
        },
        "&::after": {
          content: '""',
          position: "absolute",
          width: 0,
          height: 0,
          zIndex: 2,
          ...(arrowPosition === "top" && {
            top: `-${arrowSize}px`,
            left: customArrowOffset?.x ?? 16,
            borderLeft: `${arrowSize}px solid transparent`,
            borderRight: `${arrowSize}px solid transparent`,
            borderBottom: `${arrowSize}px solid var(--bubble-bg)`,
          }),
          ...(arrowPosition === "bottom" && {
            bottom: `-${arrowSize}px`,
            left: customArrowOffset?.x ?? 16,
            borderLeft: `${arrowSize}px solid transparent`,
            borderRight: `${arrowSize}px solid transparent`,
            borderTop: `${arrowSize}px solid var(--bubble-bg)`,
          }),
          ...(arrowPosition === "left" && {
            left: `-${arrowSize}px`,
            top: customArrowOffset?.y ?? 16,
            borderTop: `${arrowSize}px solid transparent`,
            borderBottom: `${arrowSize}px solid transparent`,
            borderRight: `${arrowSize}px solid var(--bubble-bg)`,
          }),
          ...(arrowPosition === "right" && {
            right: `-${arrowSize}px`,
            top: customArrowOffset?.y ?? 16,
            borderTop: `${arrowSize}px solid transparent`,
            borderBottom: `${arrowSize}px solid transparent`,
            borderLeft: `${arrowSize}px solid var(--bubble-bg)`,
          }),
        },
        ...getContainerStyles(),
        ...sx,
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 700,
          color: "primary.main",
          mb: 1.5,
          fontSize: "0.9rem",
          fontFamily:
            '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        }}
      >
        {currentFeature.title}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: "text.primary",
          lineHeight: 1.6,
          fontSize: "0.8rem",
          fontFamily:
            '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        }}
      >
        {currentFeature.description}
      </Typography>
    </Box>
  );
};

const PlatformDetailsPage = () => {
  const router = useRouter();
  const { isDark, handleThemeSwitch, isAuthenticated, isAuthLoading } = useThemeManager();
  const [expandedItems, setExpandedItems] = React.useState({
    act: true,
    actHow: true,
    create: true,
    move: true,
  });

  // Mobile state management
  const isMobile = useMediaQuery("(max-width:599px)");
  const isMediumScreen = useMediaQuery("(max-width:1150px)");
  const isSmallDesktop = useMediaQuery("(max-width:1439px)");
  const isPartsBubbleBreakpoint = useMediaQuery("(max-width:1500px)");
  const isSemanticSearchBreakpoint = useMediaQuery("(max-width:1725px)");
  const [mobileTreeOpen, setMobileTreeOpen] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  // Responsive scaling calculation
  const getResponsiveScale = () => {
    if (typeof window === 'undefined') return 1;
    
    const width = window.innerWidth;
    
    if (width >= 2000) return 1; // Full scale at 2000px+
    if (width <= 600) return 1; // No scaling on mobile
    
    // Gradual scaling from 2000px to 600px
    const scaleRange = 2000 - 600;
    const currentPosition = width - 600;
    const scaleFactor = currentPosition / scaleRange;
    
    // Scale from 1.0 to 0.9 (10% reduction for better proportions)
    return 1 - (scaleFactor * 0.1);
  };

  const [scale, setScale] = React.useState(1);

  // Update scale on window resize
  useEffect(() => {
    const updateScale = () => {
      setScale(getResponsiveScale());
    };

    // Set initial scale
    updateScale();

    // Add resize listener
    window.addEventListener('resize', updateScale);
    
    // Cleanup
    return () => window.removeEventListener('resize', updateScale);
  }, []);

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



  const handleItemClick = (item: keyof typeof expandedItems) => {
    setExpandedItems((prev) => ({
      ...prev,
      [item]: !prev[item],
    }));
  };

  return (
    <>
      <Head>
        <title>Software Platform for Editing the Ontology of Activities</title>
      </Head>
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
                <Box component="a" href="/landing" sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
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
                    { title: "Team", href: "/team" },
                    { title: "Treemap", href: "/treemap" },
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

                <SidebarButton
                  icon={
                    theme.palette.mode === "dark" ? (
                      <LightModeIcon />
                    ) : (
                      <DarkModeIcon />
                    )
                  }
                  onClick={handleThemeSwitch}
                />

                {isAuthLoading ? (
                  <Button 
                    variant="contained" 
                    color="primary"
                    disabled
                  >
                    Loading...
                  </Button>
                ) : isAuthenticated ? (
                  <Button 
                    variant="contained" 
                    color="primary"
                    component="a"
                    href="/"
                  >
                    Go to Platform
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="text"
                      color="primary"
                      component="a"
                      href="/signin"
                      sx={{ display: { xs: "none", sm: "inline-flex" } }}
                    >
                      Sign In
                    </Button>
                    <Button 
                      variant="contained" 
                      color="primary"
                      component="a"
                      href="/signup"
                    >
                      Register
                    </Button>
                  </>
                )}

                <IconButton 
                  sx={{ display: { xs: "flex", md: "none" } }}
                  onClick={() => setMobileNavOpen(true)}
                  aria-label="Open navigation menu"
                >
                  <MenuIcon />
                </IconButton>
              </Box>
            </Toolbar>
          </Container>
        </AppBar>

        {/* Mobile Navigation Drawer */}
        <Drawer
          anchor="right"
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          ModalProps={{ keepMounted: true }}
        >
          <Box
            sx={{ width: 280, p: 2 }}
            role="presentation"
            onClick={() => setMobileNavOpen(false)}
            onKeyDown={() => setMobileNavOpen(false)}
          >
            <Typography variant="subtitle2" sx={{ px: 1, py: 1, color: "text.secondary" }}>
              Menu
            </Typography>
            <Divider sx={{ mb: 1 }} />
            <List>
              {[
                { title: "Home", href: "/landing" },
                { title: "Platform", href: "/platform-details" },
                { title: "AI Uses", href: "/ai-uses" },
                { title: "Team", href: "/team" },
                { title: "Treemap", href: "/treemap" },
              ].map((link, index) => (
                <ListItem key={index} disablePadding>
                  <ListItemButton component="a" href={link.href}>
                    <ListItemText primary={link.title} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Box>
        </Drawer>

        {/* Combined Hero and Overview Section */}
        <Box
          sx={{
            pt: { xs: 28, md: 20 },
            pb: 12,
            background: (theme) =>
              theme.palette.mode === "dark"
                ? "linear-gradient(180deg, rgba(15,15,15,0.8) 0%, rgba(30,30,30,0.9) 50%, rgba(30,30,30,0.9) 100%)"
                : "linear-gradient(180deg, rgba(248,250,252,0.9) 0%, rgba(241,245,249,1) 50%, rgba(241,245,249,1) 100%)",
            borderBottom: (theme) =>
              theme.palette.mode === "dark"
                ? "1px solid rgba(255,255,255,0.08)"
                : "1px solid rgba(0,0,0,0.1)",
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

          <Container maxWidth="lg" sx={{ textAlign: "center", position: "relative", zIndex: 1 }}>
            {/* Main Title */}
            <Typography
              variant="h1"
              component="h1"
              sx={{
                fontWeight: 300,
                mb: 1,
                fontSize: {
                  xs: "2.5rem",
                  md: "3rem",
                  lg: "3.5rem",
                },
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
                color: (theme) =>
                  theme.palette.mode === "dark" ? "#e2e8f0" : "#334155",
                fontFamily:
                  '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
              }}
            >
              Software Platform for
            </Typography>

            <Typography
              variant="h1"
              component="h1"
              sx={{
                fontWeight: 600,
                mb: 6,
                color: "primary.main",
                fontSize: {
                  xs: "2.5rem",
                  md: "3rem",
                  lg: "3.5rem",
                },
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
                fontFamily:
                  '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
              }}
            >
              Editing the Ontology of Activities
            </Typography>

            {/* Description */}
            <Typography
              variant="h6"
              sx={{
                color: (theme) =>
                  theme.palette.mode === "dark" ? "#94a3b8" : "#64748b",
                mb: 8,
                maxWidth: "600px",
                mx: "auto",
                lineHeight: 1.6,
                fontWeight: 400,
                fontSize: { xs: "1rem", md: "1.125rem" },
                fontFamily:
                  '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
              }}
            >
              An interactive platform designed for collaborative ontology editing and management. Explore its features and capabilities for structuring knowledge about work activities.
            </Typography>
          </Container>

          <Container maxWidth="xl" sx={{ position: "relative", zIndex: 1 }}>
            <Box sx={{ 
              position: "relative", 
              overflow: "visible",
              // Adjust container height based on scale to prevent cutoff
              minHeight: scale < 0.9 ? "700px" : "600px",
              // Add top gap on mobile between hero and mockup
              mt: { xs: 16, md: 0 },
            }}>
              <Paper
                elevation={12}
                sx={{
                  bgcolor: "background.paper",
                  borderRadius: 3,
                  overflow: "visible",
                  position: "relative",
                  border: (theme) =>
                    theme.palette.mode === "dark"
                      ? "1px solid rgba(255,255,255,0.12)"
                      : "1px solid rgba(0,0,0,0.15)",
                  boxShadow: (theme) =>
                    theme.palette.mode === "dark"
                      ? "0 25px 50px -12px rgba(0,0,0,0.5)"
                      : "0 25px 50px -12px rgba(0,0,0,0.15)",
                  // Dynamic responsive scaling
                  transform: `scale(${scale})`,
                  transformOrigin: "top center",
                  transition: "transform 0.3s ease-in-out",
                  // Ensure proper spacing for scaled content
                  mx: "auto",
                  maxWidth: `${Math.max(scale * 100, 85)}%`,
                }}
              >
                {/* Mock Platform Header */}
                <Box
                  sx={{
                    bgcolor: (theme) =>
                      theme.palette.mode === "dark"
                        ? "rgba(255,255,255,0.02)"
                        : "rgba(0,0,0,0.02)",
                  px: 3,
                  py: 2,
                  borderBottom: 1,
                    borderColor: "divider",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2, width: "100%" }}>
                    {/* Mobile Menu Icons */}
                    {isMobile ? (
                      <>
                        <IconButton
                          onClick={() => setMobileTreeOpen(!mobileTreeOpen)}
                          sx={{
                            color: mobileTreeOpen ? theme.palette.primary.main : theme.palette.text.secondary,
                          }}
                        >
                          <AccountTreeIcon />
                        </IconButton>
                        
                        <Box sx={{ position: "relative", width: "100%" }}>
                          {/* Mobile Semantic Search Bubble */}
                          <MessageBubble 
                            feature="semanticSearch" 
                            placement="above"
                            arrowPosition="bottom"
                            customArrowOffset={{ x: 16 }}
                            sx={{
                              position: "absolute",
                              top: -120,
                              left: 0,
                              right: 0,
                              zIndex: 10,
                            }}
                          />
                          
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              backgroundColor: theme.palette.action.hover,
                              borderRadius: "20px",
                              padding: "8px 16px",
                              cursor: "pointer",
                              width: "100%",
                            }}
                          >
                            <Search sx={{ color: theme.palette.text.secondary, mr: 1 }} />
                            <Typography
                              variant="body2"
                              sx={{
                                color: theme.palette.text.secondary,
                                flex: 1,
                              }}
                            >
                              Search ontology...
                            </Typography>
                          </Box>
                        </Box>
                      </>
                    ) : (
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          fontFamily:
                            '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                        }}
                      >
                        Ontology Explorer
                      </Typography>
                    )}
                  </Box>

                </Box>

                <Grid 
                  container 
                  sx={{ 
                    minHeight: "600px",
                    // Smooth layout transitions for mobile
                    ...(isMobile && {
                      transition: "all 0.3s ease-in-out",
                    }),
                  }}
                >
                  {/* Left Sidebar - Tree View */}
                  <Grid
                    item
                    xs={isMobile ? 12 : 4}
                    sx={{
                      borderRight: isMobile ? 0 : 1,
                      borderBottom: isMobile ? 1 : 0,
                      borderColor: "divider",
                      position: "relative",
                      bgcolor: (theme) =>
                        theme.palette.mode === "dark"
                          ? "rgba(0,0,0,0.1)"
                          : "rgba(0,0,0,0.015)",
                      overflow: "visible",
                      // Mobile tree animation
                      ...(isMobile && {
                        maxHeight: mobileTreeOpen ? "600px" : "0px",
                        opacity: mobileTreeOpen ? 1 : 0,
                        transition: "all 0.3s ease-in-out",
                        overflow: "hidden",
                      }),
                    }}
                  >
                    <Box sx={{ 
                      p: scale < 0.9 ? 2.5 : 3, 
                      position: "relative" 
                    }}>
                      {/* Semantic Search Feature */}
                      <Box sx={{ position: "relative", display: { xs: "none", sm: "block" } }}>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            mb: 3,
                          }}
                        >
                          <TextField
                            fullWidth
                            placeholder="Semantic search..."
                            size="small"
                            disabled
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <Search sx={{ color: "text.secondary" }} />
                                </InputAdornment>
                              ),
                            }}
                            sx={{
                              "& .MuiOutlinedInput-root": {
                                bgcolor: (theme) =>
                                  theme.palette.mode === "dark"
                                    ? "rgba(255,255,255,0.03)"
                                    : "rgba(0,0,0,0.02)",
                                borderRadius: 2,
                                fontFamily:
                                  '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                              },
                              "& .MuiOutlinedInput-notchedOutline": {
                                borderColor: (theme) =>
                                  theme.palette.mode === "dark"
                                    ? "rgba(255,255,255,0.23)"
                                    : "rgba(0,0,0,0.23)",
                              }
                            }}
                          />
                        </Box>
                        <MessageBubble 
                          feature="semanticSearch" 
                          placement={isSemanticSearchBreakpoint ? "below" : "outside-left"}
                          arrowPosition={isSemanticSearchBreakpoint ? "top" : "right"}
                          customArrowOffset={isSemanticSearchBreakpoint ? { x: 16 } : { y: 35 }}
                          position={isSemanticSearchBreakpoint ? undefined : { 
                            x: scale < 0.9 ? -220 : -270, 
                            y: scale < 0.9 ? -22 : -25 
                          }}
                          scale={scale}
                        />
                      </Box>

                      {/* Outline View */}
                      <Box sx={{ position: "relative" }}>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            mb: 0,
                          }}
                        >
                          <List
                            dense
                            sx={{
                              flex: 1,
                              "& .MuiListItemText-primary": {
                                fontFamily:
                                  '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                              },
                            }}
                          >
                          <ListItem
                            onClick={() => handleItemClick("act")}
                            sx={{ cursor: "pointer" }}
                          >
                            <ListItemIcon sx={{ minWidth: 24 }}>
                              {expandedItems.act ? (
                                <KeyboardArrowDown
                                  sx={{ fontSize: 16, color: "primary.main" }}
                                />
                              ) : (
                                <KeyboardArrowRight sx={{ fontSize: 16 }} />
                              )}
                            </ListItemIcon>
                            <ListItemText
                              primary="Act"
                              sx={{
                                "& .MuiTypography-root": {
                                  fontWeight: 500,
                                  fontSize: "0.875rem",
                                },
                              }}
                            />
                          </ListItem>

                          <Collapse in={expandedItems.act}>
                            <List component="div" disablePadding sx={{ ml: 2 }}>
                              <ListItem
                                onClick={() => handleItemClick("actHow")}
                                sx={{ py: 0.5, cursor: "pointer" }}
                              >
                                <ListItemIcon sx={{ minWidth: 20 }}>
                                  {expandedItems.actHow ? (
                                    <KeyboardArrowDown sx={{ fontSize: 14 }} />
                                  ) : (
                                    <KeyboardArrowRight sx={{ fontSize: 14 }} />
                                  )}
                                </ListItemIcon>
                                <ListItemText
                                  primary="Act how?"
                                  sx={{
                                    "& .MuiTypography-root": {
                                      fontSize: "0.875rem",
                                      color: "primary.main",
                                      fontWeight: 600,
                                    },
                                  }}
                                />
                              </ListItem>

                              <Collapse in={expandedItems.actHow}>
                                <List
                                  component="div"
                                  disablePadding
                                  sx={{ ml: 2 }}
                                >
                                  <ListItem
                                    onClick={() => handleItemClick("create")}
                                    sx={{ py: 0.25, cursor: "pointer" }}
                                  >
                                    <ListItemIcon sx={{ minWidth: 20 }}>
                                      {expandedItems.create ? (
                                        <KeyboardArrowDown
                                          sx={{ fontSize: 12 }}
                                        />
                                      ) : (
                                        <KeyboardArrowRight
                                          sx={{ fontSize: 12 }}
                                        />
                                      )}
                                    </ListItemIcon>
                                    <ListItemText
                                      primary="Create"
                                      sx={{
                                        "& .MuiTypography-root": {
                                          fontSize: "0.875rem",
                                        },
                                      }}
                                    />
                                  </ListItem>

                                  <ListItem sx={{ py: 0.25 }}>
                                    <ListItemText
                                      primary="Modify"
                                      sx={{
                                        "& .MuiTypography-root": {
                                          fontSize: "0.875rem",
                                          ml: 3,
                                        },
                                      }}
                                    />
                                  </ListItem>

                                  <ListItem
                                    onClick={() => handleItemClick("move")}
                                    sx={{ py: 0.25, cursor: "pointer" }}
                                  >
                                    <ListItemIcon sx={{ minWidth: 20 }}>
                                      {expandedItems.move ? (
                                        <KeyboardArrowDown
                                          sx={{ fontSize: 12 }}
                                        />
                                      ) : (
                                        <KeyboardArrowRight
                                          sx={{ fontSize: 12 }}
                                        />
                                      )}
                                    </ListItemIcon>
                                    <ListItemText
                                      primary="Move"
                                      sx={{
                                        "& .MuiTypography-root": {
                                          fontSize: "0.875rem",
                                          fontWeight: 600,
                                        },
                                      }}
                                    />
                                  </ListItem>

                                  <Collapse in={expandedItems.move}>
                                    <List
                                      component="div"
                                      disablePadding
                                      sx={{ ml: 2 }}
                                    >
                                      <ListItem sx={{ py: 0.25 }}>
                                        <ListItemText
                                          primary="Move what?"
                                          sx={{
                                            "& .MuiTypography-root": {
                                              fontSize: "0.875rem",
                                              color: "primary.main",
                                              fontWeight: 600,
                                            },
                                          }}
                                        />
                                      </ListItem>

                                      <ListItem
                                        sx={{
                                        py: 0.25,
                                          bgcolor: "primary.main",
                                        borderRadius: 1,
                                        mx: 1,
                                          mb: 0.5,
                                        }}
                                      >
                                        <ListItemText
                                          primary="Transport"
                                          sx={{
                                            "& .MuiTypography-root": {
                                              fontSize: "0.875rem",
                                              fontWeight: 600,
                                              color: "white",
                                            },
                                          }}
                                        />
                                      </ListItem>

                                      <ListItem sx={{ py: 0.25 }}>
                                        <ListItemText
                                          primary="Put"
                                          sx={{
                                            "& .MuiTypography-root": {
                                              fontSize: "0.875rem",
                                            },
                                          }}
                                        />
                                      </ListItem>

                                      <ListItem sx={{ py: 0.25 }}>
                                        <ListItemText
                                          primary="Reorient"
                                          sx={{
                                            "& .MuiTypography-root": {
                                              fontSize: "0.875rem",
                                            },
                                          }}
                                        />
                                      </ListItem>

                                      <ListItem sx={{ py: 0.25 }}>
                                        <ListItemText
                                          primary="Exercise"
                                          sx={{
                                            "& .MuiTypography-root": {
                                              fontSize: "0.875rem",
                                            },
                                          }}
                                        />
                                      </ListItem>
                                    </List>
                                  </Collapse>

                                  <Collapse in={expandedItems.create}>
                                    <List
                                      component="div"
                                      disablePadding
                                      sx={{ ml: 1.5 }}
                                    >
                                      <ListItem sx={{ py: 0.25, display: { xs: "none", md: "block" } }}>
                                        <ListItemText
                                          primary="Create what"
                                          sx={{
                                            "& .MuiTypography-root": {
                                              fontSize: "0.875rem",
                                              color: "primary.main",
                                              fontWeight: 600,
                                            },
                                          }}
                                        />
                                      </ListItem>
                                      <ListItem sx={{ py: 0.25, display: { xs: "none", md: "block" } }}>
                                        <ListItemText
                                          primary="Create information"
                                          sx={{
                                            "& .MuiTypography-root": {
                                              fontSize: "0.875rem",
                                            },
                                          }}
                                        />
                                      </ListItem>

                                      <ListItem sx={{ py: 0.25, display: { xs: "none", md: "block" } }}>
                                        <ListItemText
                                          primary="Decide"
                                          sx={{
                                            "& .MuiTypography-root": {
                                              fontSize: "0.875rem",
                                            },
                                          }}
                                        />
                                      </ListItem>
                                    </List>
                                  </Collapse>
                                </List>
                              </Collapse>
                            </List>
                          </Collapse>
                          </List>
                        </Box>
                        <MessageBubble 
                          feature="outlineView" 
                          placement="below" 
                          arrowPosition="top"
                          sx={{
                            mt: scale < 0.9 ? 1.5 : 2,
                          }}
                          scale={scale}
                        />
                      </Box>
                    </Box>
                  </Grid>

                  {/* Main Content Area */}
                  <Grid 
                    item 
                    xs={isMobile ? 12 : 8} 
                    sx={{ 
                      position: "relative", 
                      overflow: "visible",
                      // Mobile content animation
                      ...(isMobile && {
                        transform: mobileTreeOpen ? "translateY(0)" : "translateY(-20px)",
                        opacity: mobileTreeOpen ? 1 : 0.8,
                        transition: "all 0.3s ease-in-out",
                      }),
                    }}
                  >
                    <Box sx={{ 
                      p: scale < 0.9 ? 2.5 : 4, 
                      position: "relative" 
                    }}>
                      {/* Title Bar */}
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 2,
                          mb: 4,
                          position: "relative",
                        }}
                      >
                        <Typography
                          variant="h4"
                          sx={{
                          fontWeight: 500,
                            fontFamily:
                              '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                            letterSpacing: "-0.01em",
                          }}
                        >
                          Transport
                        </Typography>
                        <MessageBubble 
                          feature="selectedActivity" 
                          placement="below" 
                          arrowPosition="left"
                          customArrowOffset={{ x: 16 }}
                          scale={scale}
                        />
                      </Box>

                      <Typography
                        variant="body1"
                        sx={{
                        mb: 4,
                          color: "text.secondary",
                          fontFamily:
                            '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                          lineHeight: 1.6,
                        }}
                      >
                        <strong>Description:</strong> Move something or somebody
                        around, usually over long distances
                      </Typography>

                      {/* Content Grid */}
                      <Grid container spacing={3} sx={{ overflow: "visible" }}>
                        <Grid item xs={12} md={isMediumScreen ? 12 : 6} sx={{ display: "flex", position: "relative", overflow: "visible" }}>
                          <Card
                            sx={{
                              height: "100%",
                              width: "100%",
                              bgcolor: "background.paper",
                            border: (theme) =>
                              theme.palette.mode === "dark"
                                ? "1px solid rgba(255,255,255,0.1)"
                                : "1px solid rgba(0,0,0,0.12)",
                            borderRadius: 2,
                              boxShadow: (theme) =>
                                theme.palette.mode === "dark" 
                                  ? "0 4px 12px rgba(0,0,0,0.3)" 
                                  : "0 2px 8px rgba(0,0,0,0.08)",
                              position: "relative",
                              overflow: "visible",
                            }}
                          >
                            <CardContent sx={{ p: 2 }}>
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                mb: 2,
                                  bgcolor: (theme) =>
                                    theme.palette.mode === "dark"
                                      ? "rgba(255,255,255,0.03)"
                                      : "rgba(0,0,0,0.02)",
                                  color: (theme) =>
                                    theme.palette.mode === "dark"
                                      ? "white"
                                      : "text.primary",
                                p: 1.5,
                                borderRadius: 1,
                                mx: -2,
                                  mt: -2,
                                }}
                              >
                                <Typography
                                  variant="subtitle2"
                                  sx={{
                                  fontWeight: 600,
                                    fontFamily:
                                      '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                  }}
                                >
                                  Generalizations ("Parents")
                                </Typography>
                              </Box>
                              <MessageBubble 
                                feature="generalizations" 
                                placement={isSmallDesktop ? "below" : undefined}
                                arrowPosition={isSmallDesktop ? "top" : "left"}
                                customArrowOffset={isSmallDesktop ? { x: 16 } : undefined}
                                position={isSmallDesktop ? undefined : { 
                                  x: scale < 0.9 ? 170 : 210, 
                                  y: 0 
                                }} 
                                scale={scale}
                              />
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1,
                                }}
                              >
                                <FiberManualRecord
                                  sx={{ fontSize: 8, color: "primary.main" }}
                                />
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontFamily:
                                      '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                  }}
                                >
                                  Move
                                </Typography>
                              </Box>
                            </CardContent>
                          </Card>
                        </Grid>

                        <Grid item xs={12} md={isMediumScreen ? 12 : 6} sx={{ display: "flex", position: "relative", overflow: "visible" }}>
                          <Card
                            sx={{
                              height: "100%",
                              width: "100%",
                              bgcolor: "background.paper",
                            border: (theme) =>
                              theme.palette.mode === "dark"
                                ? "1px solid rgba(255,255,255,0.1)"
                                : "rgba(0,0,0,0.12)",
                            borderRadius: 2,
                              boxShadow: (theme) =>
                                theme.palette.mode === "dark" 
                                  ? "0 4px 12px rgba(0,0,0,0.3)" 
                                  : "0 2px 8px rgba(0,0,0,0.08)",
                              position: "relative",
                              overflow: "visible",
                            }}
                          >
                            <CardContent sx={{ p: 2 }}>
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                mb: 2,
                                  bgcolor: (theme) =>
                                    theme.palette.mode === "dark"
                                      ? "rgba(255,255,255,0.03)"
                                      : "rgba(0,0,0,0.02)",
                                  color: (theme) =>
                                    theme.palette.mode === "dark"
                                      ? "white"
                                      : "text.primary",
                                p: 1.5,
                                borderRadius: 1,
                                mx: -2,
                                  mt: -2,
                                }}
                              >
                                <Typography
                                  variant="subtitle2"
                                  sx={{
                                  fontWeight: 600,
                                    fontFamily:
                                      '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                  }}
                                >
                                  Specializations ("Children")
                                </Typography>
                              </Box>
                              <MessageBubble 
                                feature="specializations" 
                                placement={isSmallDesktop ? "below" : "outside-right"}
                                arrowPosition={isSmallDesktop ? "top" : "left"}
                                customArrowOffset={isSmallDesktop ? { x: 16 } : { y: 15 }}
                                position={isSmallDesktop ? undefined : { 
                                  x: scale < 0.9 ? 230 : 280, 
                                  y: 5 
                                }}
                                scale={scale}
                              />
                              <Box
                                sx={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 1,
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  sx={{
                                  fontWeight: 600,
                                    color: "primary.main",
                                    fontFamily:
                                      '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                  }}
                                >
                                  Transport what?
                                </Typography>
                                <Box
                                  sx={{
                                    ml: 1,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 0.5,
                                  }}
                                >
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontFamily:
                                        '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                    }}
                                  >
                                    Transport information
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontFamily:
                                        '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                    }}
                                  >
                                    Transport physical objects
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontFamily:
                                        '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                    }}
                                  >
                                    Transport self (Travel)
                                  </Typography>
                                </Box>
                                <Typography
                                  variant="caption"
                                  sx={{
                                  fontWeight: 600,
                                  mt: 1,
                                    color: "primary.main",
                                    fontFamily:
                                      '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                  }}
                                >
                                  Transport how?
                                </Typography>
                                <Box
                                  sx={{
                                    ml: 1,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 0.5,
                                  }}
                                >
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontFamily:
                                        '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                    }}
                                  >
                                    Carry
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontFamily:
                                        '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                    }}
                                  >
                                    Pull
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontFamily:
                                        '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                    }}
                                  >
                                    Push
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontFamily:
                                        '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                    }}
                                  >
                                    Release
                                  </Typography>
                                </Box>
                              </Box>
                            </CardContent>
                          </Card>
                        </Grid>

                        <Grid item xs={12} md={isMediumScreen ? 12 : 6} sx={{ display: "flex", position: "relative" }}>
                          <Card
                            sx={{
                              height: "100%",
                              width: "100%",
                              bgcolor: "background.paper",
                            border: (theme) =>
                              theme.palette.mode === "dark"
                                ? "1px solid rgba(255,255,255,0.1)"
                                : "1px solid rgba(0,0,0,0.12)",
                            borderRadius: 2,
                              boxShadow: (theme) =>
                                theme.palette.mode === "dark" 
                                  ? "0 4px 12px rgba(0,0,0,0.3)" 
                                  : "0 2px 8px rgba(0,0,0,0.08)",
                              position: "relative",
                            }}
                          >
                            <CardContent sx={{ p: 2 }}>
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                mb: 2,
                                  bgcolor: (theme) =>
                                    theme.palette.mode === "dark"
                                      ? "rgba(255,255,255,0.03)"
                                      : "rgba(0,0,0,0.02)",
                                  color: (theme) =>
                                    theme.palette.mode === "dark"
                                      ? "white"
                                      : "text.primary",
                                p: 1.5,
                                borderRadius: 1,
                                mx: -2,
                                  mt: -2,
                                }}
                              >
                                <Typography
                                  variant="subtitle2"
                                  sx={{
                                  fontWeight: 600,
                                    fontFamily:
                                      '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                  }}
                                >
                                  Is Part of
                                </Typography>
                              </Box>
                              <MessageBubble 
                                feature="isPartOf" 
                                placement="below" 
                                arrowPosition="top"
                                sx={{
                                  mt: scale < 0.8 ? 1 : 2,
                                }}
                                scale={scale}
                              />
                            </CardContent>
                          </Card>
                        </Grid>

                        <Grid item xs={12} md={isMediumScreen ? 12 : 6} sx={{ display: "flex", position: "relative", overflow: "visible" }}>
                          <Card
                            sx={{
                              height: "100%",
                              width: "100%",
                              bgcolor: "background.paper",
                            border: (theme) =>
                              theme.palette.mode === "dark"
                                ? "1px solid rgba(255,255,255,0.1)"
                                : "1px solid rgba(0,0,0,0.12)",
                            borderRadius: 2,
                              boxShadow: (theme) =>
                                theme.palette.mode === "dark" 
                                  ? "0 4px 12px rgba(0,0,0,0.3)" 
                                  : "0 2px 8px rgba(0,0,0,0.08)",
                              position: "relative",
                              overflow: "visible",
                            }}
                          >
                            <CardContent sx={{ p: 2 }}>
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                mb: 2,
                                  bgcolor: (theme) =>
                                    theme.palette.mode === "dark"
                                      ? "rgba(255,255,255,0.03)"
                                      : "rgba(0,0,0,0.02)",
                                  color: (theme) =>
                                    theme.palette.mode === "dark"
                                      ? "white"
                                      : "text.primary",
                                p: 1.5,
                                borderRadius: 1,
                                mx: -2,
                                  mt: -2,
                                }}
                              >
                                <Typography
                                  variant="subtitle2"
                                  sx={{
                                  fontWeight: 600,
                                    fontFamily:
                                      '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                  }}
                                >
                                  Parts
                                </Typography>
                              </Box>
                              <MessageBubble 
                                feature="parts" 
                                placement={isSmallDesktop ? "below" : "outside-right"}
                                arrowPosition={isSmallDesktop ? "top" : "left"}
                                customArrowOffset={isSmallDesktop ? { x: 16 } : { y: 15 }}
                                position={isSmallDesktop ? undefined : { 
                                  x: scale < 0.9 ? 230 : 280, 
                                  y: 5 
                                }}
                                scale={scale}
                              />
                              <Box
                                sx={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 1,
                                }}
                              >
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                  }}
                                >
                                  <FiberManualRecord sx={{ fontSize: 8 }} />
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontFamily:
                                        '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                    }}
                                  >
                                    Get
                                  </Typography>
                                </Box>
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                  }}
                                >
                                  <FiberManualRecord sx={{ fontSize: 8 }} />
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontFamily:
                                        '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                    }}
                                  >
                                    Pack (O)
                                  </Typography>
                                </Box>
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                  }}
                                >
                                  <FiberManualRecord sx={{ fontSize: 8 }} />
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontFamily:
                                        '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                    }}
                                  >
                                    Load (O)
                                  </Typography>
                                </Box>
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                  }}
                                >
                                  <FiberManualRecord sx={{ fontSize: 8 }} />
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontFamily:
                                        '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                    }}
                                  >
                                    Operate transport for physical objects
                                  </Typography>
                                </Box>
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                  }}
                                >
                                  <FiberManualRecord sx={{ fontSize: 8 }} />
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontFamily:
                                        '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                    }}
                                  >
                                    Unload (O)
                                  </Typography>
                                </Box>
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                  }}
                                >
                                  <FiberManualRecord sx={{ fontSize: 8 }} />
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontFamily:
                                        '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                    }}
                                  >
                                    Unpack (O)
                                  </Typography>
                                </Box>
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                  }}
                                >
                                  <FiberManualRecord sx={{ fontSize: 8 }} />
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontFamily:
                                        '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                    }}
                                  >
                                    Provide
                                  </Typography>
                                </Box>

                                {/* Parts inherited from generalizations */}
                                <Box
                                  sx={{
                                    mt: 3,
                                    pt: 2,
                                    borderTop: 1,
                                    borderColor: "divider",
                                  }}
                                >
                                  <Box
                                    sx={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      mb: 2,
                                    }}
                                  >
                                    <Typography
                                      variant="body2"
                                      sx={{
                                      fontWeight: 600,
                                        color: "text.primary",
                                        fontFamily:
                                          '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                      }}
                                    >
                                      Parts inherited from generalizations:
                                    </Typography>
                                  </Box>
                                  <MessageBubble 
                                    feature="inheritedParts" 
                                    placement={isSmallDesktop ? "below" : (isPartsBubbleBreakpoint ? "outside-left" : "outside-right")}
                                    arrowPosition={isSmallDesktop ? "top" : (isPartsBubbleBreakpoint ? "right" : "left")}
                                    customArrowOffset={isSmallDesktop ? { x: 16 } : { y: 20 }}
                                    position={isSmallDesktop ? undefined : (isPartsBubbleBreakpoint ? { 
                                      x: scale < 0.9 ? -200 : -280, 
                                      y: scale < 0.9 ? 220 : 295 
                                    } : { 
                                      x: scale < 0.9 ? 260 : 306, 
                                      y: scale < 0.9 ? 220 : 295 
                                    })}
                                    scale={scale}
                                  />

                                  {/* Move -> Transport inheritance */}
                                  <Box sx={{ mb: 2 }}>
                                    {/* Header with Move and Transport titles */}
                                                                         <Box
                                       sx={{
                                         display: "grid",
                                         gridTemplateColumns: "80px auto",
                                         mb: 2,
                                         alignItems: "center",
                                         gap: 12,
                                       }}
                                     >
                                       <Typography
                                         variant="caption"
                                         sx={{
                                           fontWeight: 600,
                                           color: "warning.main",
                                           fontFamily:
                                             '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                         }}
                                       >
                                        Move
                                      </Typography>
                                       <Typography
                                         variant="caption"
                                         sx={{
                                           fontWeight: 600,
                                           fontFamily:
                                             '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                         }}
                                       >
                                        Transport
                                      </Typography>
                                    </Box>

                                     {/* Two-column layout for inheritance */}
                                     <Box
                                       sx={{
                                         display: "flex",
                                         flexDirection: "column",
                                         gap: 0.5,
                                       }}
                                     >
                                       {/* Get row */}
                                       <Box
                                         sx={{
                                           display: "grid",
                                           gridTemplateColumns: "80px 30px auto",
                                           alignItems: "center",
                                           gap: 1,
                                         }}
                                       >
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            fontFamily:
                                              '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                          }}
                                        >
                                          Get
                                        </Typography>
                                        <Typography
                                          variant="caption"
                                          sx={{ 
                                            color: "success.main",
                                            textAlign: "center",
                                          }}
                                        >
                                          =
                                        </Typography>
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            fontFamily:
                                              '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                          }}
                                        >
                                          Get
                                        </Typography>
                                      </Box>

                                                                                                                    {/* Pack row */}
                                       <Box
                                         sx={{
                                           display: "grid",
                                           gridTemplateColumns: "80px 30px auto",
                                           alignItems: "center",
                                           gap: 1,
                                         }}
                                       >
                                         <Typography
                                           variant="caption"
                                           sx={{
                                             fontFamily:
                                               '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                             color: "transparent",
                                           }}
                                         >
                                           .
                                         </Typography>
                                         <Typography
                                           variant="caption"
                                           sx={{ 
                                             color: "warning.main",
                                             textAlign: "center",
                                           }}
                                         >
                                           +
                                         </Typography>
                                         <Typography
                                           variant="caption"
                                           sx={{
                                             fontFamily:
                                               '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                           }}
                                         >
                                           Pack (O)
                                         </Typography>
                                       </Box>

                                       {/* Load row */}
                                       <Box
                                         sx={{
                                           display: "grid",
                                           gridTemplateColumns: "80px 30px auto",
                                           alignItems: "center",
                                           gap: 1,
                                         }}
                                       >
                                         <Typography
                                           variant="caption"
                                           sx={{
                                             fontFamily:
                                               '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                             color: "transparent",
                                           }}
                                         >
                                           .
                                         </Typography>
                                         <Typography
                                           variant="caption"
                                           sx={{ 
                                             color: "warning.main",
                                             textAlign: "center",
                                           }}
                                         >
                                           +
                                         </Typography>
                                         <Typography
                                           variant="caption"
                                           sx={{
                                             fontFamily:
                                               '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                           }}
                                         >
                                           Load (O)
                                         </Typography>
                                       </Box>

                                       {/* Move row */}
                                       <Box
                                         sx={{
                                           display: "grid",
                                           gridTemplateColumns: "80px 30px auto",
                                           alignItems: "center",
                                           gap: 1,
                                         }}
                                       >
                                         <Typography
                                           variant="caption"
                                           sx={{
                                             fontFamily:
                                               '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                           }}
                                         >
                                           Move
                                         </Typography>
                                         <Typography
                                           variant="caption"
                                           sx={{ 
                                             color: "primary.main",
                                             textAlign: "center",
                                           }}
                                         >
                                           &gt;
                                         </Typography>
                                         <Box
                                           sx={{
                                             display: "flex",
                                             flexDirection: "column",
                                           }}
                                         >
                                           <Typography
                                             variant="caption"
                                             sx={{
                                               fontFamily:
                                                 '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                               lineHeight: 1.2,
                                             }}
                                           >
                                             Operate transport for
                                           </Typography>
                                           <Typography
                                             variant="caption"
                                             sx={{
                                               fontFamily:
                                                 '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                               lineHeight: 1.2,
                                             }}
                                           >
                                             physical objects
                                           </Typography>
                                         </Box>
                                       </Box>

                                       {/* Unload row */}
                                       <Box
                                         sx={{
                                           display: "grid",
                                           gridTemplateColumns: "80px 30px auto",
                                           alignItems: "center",
                                           gap: 1,
                                         }}
                                       >
                                         <Typography
                                           variant="caption"
                                           sx={{
                                             fontFamily:
                                               '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                             color: "transparent",
                                           }}
                                         >
                                           .
                                         </Typography>
                                         <Typography
                                           variant="caption"
                                           sx={{ 
                                             color: "warning.main",
                                             textAlign: "center",
                                           }}
                                         >
                                           +
                                         </Typography>
                                         <Typography
                                           variant="caption"
                                           sx={{
                                             fontFamily:
                                               '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                           }}
                                         >
                                           Unload (O)
                                         </Typography>
                                       </Box>

                                       {/* Unpack row */}
                                       <Box
                                         sx={{
                                           display: "grid",
                                           gridTemplateColumns: "80px 30px auto",
                                           alignItems: "center",
                                           gap: 1,
                                         }}
                                       >
                                         <Typography
                                           variant="caption"
                                           sx={{
                                             fontFamily:
                                               '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                             color: "transparent",
                                           }}
                                         >
                                           .
                                         </Typography>
                                         <Typography
                                           variant="caption"
                                           sx={{ 
                                             color: "warning.main",
                                             textAlign: "center",
                                           }}
                                         >
                                           +
                                         </Typography>
                                         <Typography
                                           variant="caption"
                                           sx={{
                                             fontFamily:
                                               '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                           }}
                                         >
                                           Unpack (O)
                                         </Typography>
                                       </Box>

                                       {/* Provide row */}
                                       <Box
                                         sx={{
                                           display: "grid",
                                           gridTemplateColumns: "80px 30px auto",
                                           alignItems: "center",
                                           gap: 1,
                                         }}
                                       >
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            fontFamily:
                                              '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                          }}
                                        >
                                          Provide
                                        </Typography>
                                        <Typography
                                          variant="caption"
                                          sx={{ 
                                            color: "success.main",
                                            textAlign: "center",
                                          }}
                                        >
                                          =
                                        </Typography>
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            fontFamily:
                                              '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                          }}
                                        >
                                          Provide
                                        </Typography>
                                        </Box>
                                    </Box>
                                  </Box>

                                  {/* Legend */}
                                  <Box
                                    sx={{
                                    mt: 2,
                                    p: 1.5,
                                      bgcolor: (theme) =>
                                        theme.palette.mode === "dark"
                                          ? "rgba(255,255,255,0.03)"
                                          : "rgba(0,0,0,0.02)",
                                    border: (theme) =>
                                      theme.palette.mode === "dark"
                                        ? "1px solid rgba(255,255,255,0.08)"
                                        : "1px solid rgba(0,0,0,0.1)",
                                      borderRadius: 1,
                                    }}
                                  >
                                    <Typography
                                      variant="caption"
                                      sx={{
                                      fontWeight: 500,
                                        display: "block",
                                      mb: 0.5,
                                        fontFamily:
                                          '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                      }}
                                    >
                                      Legend:
                                    </Typography>
                                    <Box
                                      sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 0.25,
                                      }}
                                    >
                                      <Box
                                        sx={{
                                          display: "grid",
                                          gridTemplateColumns: "20px auto",
                                          alignItems: "center",
                                          gap: 1,
                                        }}
                                      >
                                        <span style={{ color: "#f57c00" }}>
                                          (O)
                                        </span>
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            color: "text.secondary",
                                            fontFamily:
                                              '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                          }}
                                        >
                                          = Optional
                                        </Typography>
                                      </Box>
                                      <Box
                                        sx={{
                                          display: "grid",
                                          gridTemplateColumns: "20px auto",
                                          alignItems: "center",
                                          gap: 1,
                                        }}
                                      >
                                        <span style={{ color: "#4caf50" }}>
                                          =
                                        </span>
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            color: "text.secondary",
                                            fontFamily:
                                              '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                          }}
                                        >
                                          = no change
                                        </Typography>
                                      </Box>
                                      <Box
                                        sx={{
                                          display: "grid",
                                          gridTemplateColumns: "20px auto",
                                          alignItems: "center",
                                          gap: 1,
                                        }}
                                      >
                                        <span style={{ color: "#1976d2" }}>
                                          &gt;
                                        </span>
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            color: "text.secondary",
                                            fontFamily:
                                              '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                          }}
                                        >
                                          = specialized part
                                        </Typography>
                                      </Box>
                                      <Box
                                        sx={{
                                          display: "grid",
                                          gridTemplateColumns: "20px auto",
                                          alignItems: "center",
                                          gap: 1,
                                        }}
                                      >
                                        <span style={{ color: "#f57c00" }}>
                                          +
                                        </span>
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            color: "text.secondary",
                                            fontFamily:
                                              '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                                          }}
                                        >
                                          = part added
                                        </Typography>
                                      </Box>
                                    </Box>
                                  </Box>
                                </Box>
                              </Box>
                            </CardContent>
                          </Card>
                        </Grid>
                      </Grid>
                    </Box>
                  </Grid>
                </Grid>
              </Paper>


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
                : "linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)",
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
                mb: 4,
                fontWeight: 300,
                  fontSize: { xs: "2rem", md: "2.5rem", lg: "3rem" },
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
                mb: 6,
                  color: (theme) =>
                    theme.palette.mode === "dark" ? "#94a3b8" : "#64748b",
                lineHeight: 1.7,
                  maxWidth: "600px",
                  mx: "auto",
                fontWeight: 400,
                  fontSize: { xs: "1.125rem", md: "1.25rem" },
                  fontFamily:
                    '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                }}
              >
                Access our comprehensive ontology editing platform and
                contribute to advancing our understanding of AI integration in
                work processes.
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

        {/* Sophisticated Footer */}
        <Box
          component="footer"
          sx={{
            py: 6,
            bgcolor: "background.paper",
            borderTop: (theme) =>
              theme.palette.mode === "dark"
                ? "1px solid rgba(255,255,255,0.08)"
                : "1px solid rgba(0,0,0,0.08)",
          }}
        >
          <Container maxWidth="xl">
            <Grid container spacing={0} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }}>
              {/* Logo & Title */}
              <Grid item xs={12} md={3}>
                <Box sx={{ 
                  display: "flex", 
                  flexDirection: "column", 
                  pr: { md: 3 },
                  mb: { xs: 3, md: 0 },
                  textAlign: { xs: "center", md: "left" }
                }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2, justifyContent: { xs: "center", md: "flex-start" } }}>
                    <img
                      src={isDark ? "/MIT-Logo-small-Dark.png" : "/MIT-Logo-Small-Light.png"}
                      alt="MIT Logo"
                      style={{ height: "28px", width: "auto" }}
                    />
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      Ontology of Collective Intelligence
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    © {new Date().getFullYear()} MIT. All rights reserved.
                  </Typography>
                </Box>
              </Grid>

              {/* Navigation Links */}
              <Grid item xs={12} md={3}>
                <Box sx={{ 
                  display: "flex", 
                  flexDirection: { xs: "row", md: "column" }, 
                  flexWrap: { xs: "wrap", md: "nowrap" },
                  columnGap: { xs: 2, md: 0 },
                  rowGap: { xs: 1, md: 1 },
                  justifyContent: { xs: "center", md: "center" },
                  alignItems: { xs: "center", md: "flex-start" },
                  textAlign: { xs: "center", md: "left" },
                  px: { md: 3 }, 
                  ml: { md: 6 },
                  mb: { xs: 3, md: 0 },
                  height: "100%" 
                }}>
                  {[
                    { title: "Home", href: "/landing" },
                    { title: "Platform", href: "/platform-details" },
                    { title: "AI Uses", href: "/ai-uses" },
                    { title: "Team", href: "/team" },
                    { title: "Treemap", href: "/treemap" },
                  ].map((link, idx) => (
                    <Typography
                      key={idx}
                      component="a"
                      href={link.href}
                      sx={{
                        color: "text.secondary",
                        fontSize: "0.9rem",
                        textDecoration: "none",
                        "&:hover": { color: "primary.main" },
                        px: { xs: 0.5, md: 0 },
                        py: { xs: 0.25, md: 0 },
                      }}
                    >
                      {link.title}
                    </Typography>
                  ))}
                </Box>
              </Grid>

              {/* Desktop Divider */}
              <Box sx={{ 
                width: "1px", 
                bgcolor: "divider", 
                mx: 2,
                display: { xs: "none", md: "block" },
                alignSelf: "stretch"
              }} />

              {/* Related Project Links */}
              <Grid item xs={12} md={3}>
                <Box sx={{ 
                  display: "flex", 
                  flexDirection: "column", 
                  gap: 1, 
                  px: { md: 3 },
                  mb: { xs: 3, md: 0 }, 
                  justifyContent: { xs: "center", md: "center" },
                  alignItems: { xs: "center", md: "flex-start" },
                  height: "100%" 
                }}>
                  <Typography
                    component="a"
                    href="https://m3s.mit.edu/"
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      color: "text.secondary",
                      fontSize: "0.9rem",
                      textDecoration: "none",
                      "&:hover": { color: "primary.main" },
                    }}
                  >
                    M3S - Mens Manus and Machina
                  </Typography>
                  <Typography
                    component="a"
                    href="https://cci.mit.edu/"
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      color: "text.secondary",
                      fontSize: "0.9rem",
                      textDecoration: "none",
                      "&:hover": { color: "primary.main" },
                    }}
                  >
                    MIT Center for Collective Intelligence
                  </Typography>
                </Box>
              </Grid>

              {/* Desktop Divider */}
              <Box sx={{ 
                width: "1px", 
                bgcolor: "divider", 
                mx: 2,
                display: { xs: "none", md: "block" },
                alignSelf: "stretch"
              }} />

              {/* Accessibility Info */}
              <Grid item xs={12} md={2}>
                <Box sx={{ 
                  display: "flex", 
                  justifyContent: { xs: "center", md: "center" }, 
                  alignItems: "center", 
                  height: "100%", 
                  pl: { md: 3 } 
                }}>
                  <Typography
                    component="a"
                    href="https://accessibility.mit.edu/"
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      color: "text.secondary",
                      fontSize: "0.9rem",
                      textDecoration: "none",
                      "&:hover": { color: "primary.main" },
                    }}
                  >
                    Accessibility Info
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
    </>
  );
};

export default PlatformDetailsPage;
