import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  AppBar,
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  Toolbar,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import {
  ArrowForward as ArrowForwardIcon,
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  Menu as MenuIcon,
} from "@mui/icons-material";
import {
  LANDING_ROUTES,
  landingHrefForSection,
} from "../../../constants/landingRoutes";
import type { LandingSectionId } from "../../../constants/landingTypes";

interface NavigationProps {
  isDark: boolean;
  handleThemeSwitch: () => void;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  onMobileMenuOpen: () => void;
  /** When set with `onLandingSectionChange`, landing nav uses local section state (stay on `/landing`). */
  activeLandingSection?: LandingSectionId;
  onLandingSectionChange?: (id: LandingSectionId) => void;
}

const Navigation: React.FC<NavigationProps> = ({
  isDark,
  handleThemeSwitch,
  isAuthenticated,
  isAuthLoading,
  onMobileMenuOpen,
  activeLandingSection,
  onLandingSectionChange,
}) => {
  const router = useRouter();
  const theme = useTheme();
  const landingSpa =
    activeLandingSection !== undefined && onLandingSectionChange !== undefined;

  const accent = theme.palette.primary.main;
  const glassBg = alpha(theme.palette.background.default, isDark ? 0.72 : 0.76);
  const navClusterBg = alpha(theme.palette.text.primary, isDark ? 0.06 : 0.045);

  const ctaSx = {
    position: "relative" as const,
    overflow: "hidden",
    color: "#fff",
    border: `1px solid ${alpha("#fff", 0.14)}`,
    background: isDark
      ? `linear-gradient(135deg, ${alpha("#7a8a9e", 0.95)} 0%, ${alpha("#5c4a3a", 0.85)} 48%, ${alpha(accent, 0.92)} 100%)`
      : `linear-gradient(135deg, ${alpha("#556477", 0.98)} 0%, ${alpha("#6d5c47", 0.9)} 45%, ${alpha(accent, 0.88)} 100%)`,
    boxShadow: `0 4px 18px ${alpha(accent, isDark ? 0.28 : 0.22)}`,
    transition: theme.transitions.create(
      ["box-shadow", "transform", "filter", "border-color"],
      { duration: 220, easing: theme.transitions.easing.easeOut },
    ),
    "&::before": {
      content: '""',
      position: "absolute",
      inset: 0,
      background:
        "linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.14) 48%, transparent 62%)",
      transform: "translateX(-120%)",
      transition: "transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
    },
    "&:hover": {
      boxShadow: `0 8px 28px ${alpha(accent, isDark ? 0.38 : 0.32)}`,
      transform: "translateY(-1px)",
      filter: "brightness(1.04)",
      borderColor: alpha("#fff", 0.22),
      "&::before": {
        transform: "translateX(120%)",
      },
    },
    "&:active": {
      transform: "translateY(0)",
    },
  };

  const iconChipSx = {
    borderRadius: 2,
    border: `1px solid ${alpha(theme.palette.divider, isDark ? 0.45 : 0.65)}`,
    backgroundColor: alpha(
      theme.palette.background.paper,
      isDark ? 0.35 : 0.65,
    ),
    backdropFilter: "blur(10px)",
    transition: theme.transitions.create(
      ["background-color", "border-color", "transform", "box-shadow"],
      { duration: 200 },
    ),
    "&:hover": {
      backgroundColor: alpha(accent, isDark ? 0.12 : 0.08),
      borderColor: alpha(accent, 0.35),
      boxShadow: `0 0 0 3px ${alpha(accent, 0.12)}`,
    },
  };

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        left: 0,
        right: 0,
        width: "100%",
        backgroundColor: glassBg,
        backdropFilter: "saturate(140%) blur(16px)",
        WebkitBackdropFilter: "saturate(140%) blur(16px)",
        borderBottom: `1px solid ${alpha(theme.palette.divider, isDark ? 0.55 : 0.65)}`,
        boxShadow: `0 1px 0 ${alpha(theme.palette.common.black, isDark ? 0.12 : 0.04)}`,
      }}
    >
      <Container maxWidth="xl">
        <Toolbar
          disableGutters
          sx={{
            justifyContent: "space-between",
            py: { xs: 1.1, sm: 1.25 },
            minHeight: { xs: 56, sm: 64 },
            gap: 2,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: { xs: 1.5, sm: 2.25 },
            }}
          >
            {landingSpa ? (
              <Box
                component="button"
                type="button"
                aria-label="Home"
                onClick={() => onLandingSectionChange!("home")}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                  borderRadius: 1,
                  border: "none",
                  background: "none",
                  padding: 0,
                  transition: theme.transitions.create("transform", {
                    duration: 280,
                    easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
                  }),
                  "&:hover": { transform: "scale(1.04)" },
                  "&:focus-visible": {
                    outline: `2px solid ${alpha(accent, 0.55)}`,
                    outlineOffset: 2,
                  },
                }}
              >
                <img
                  src={
                    isDark
                      ? "/MIT-Logo-small-Dark.png"
                      : "/MIT-Logo-Small-Light.png"
                  }
                  alt="MIT Logo"
                  style={{ height: "40px", width: "auto", display: "block" }}
                />
              </Box>
            ) : (
              <Link href="/landing" passHref legacyBehavior scroll={false}>
                <Box
                  component="a"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                    borderRadius: 1,
                    transition: theme.transitions.create("transform", {
                      duration: 280,
                      easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
                    }),
                    "&:hover": { transform: "scale(1.04)" },
                    "&:focus-visible": {
                      outline: `2px solid ${alpha(accent, 0.55)}`,
                      outlineOffset: 2,
                    },
                  }}
                >
                  <img
                    src={
                      isDark
                        ? "/MIT-Logo-small-Dark.png"
                        : "/MIT-Logo-Small-Light.png"
                    }
                    alt="MIT Logo"
                    style={{ height: "40px", width: "auto", display: "block" }}
                  />
                </Box>
              </Link>
            )}
            <Box
              sx={{
                display: { xs: "none", sm: "block" },
                pl: 2,
                borderLeft: `3px solid ${alpha(accent, 0.65)}`,
              }}
            >
              <Typography
                variant="body1"
                sx={{
                  fontWeight: 650,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.25,
                  color: "text.primary",
                  fontSize: "0.98rem",
                }}
              >
                Ontology of Collective Intelligence
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  mt: 0.25,
                  color: "text.secondary",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase" as const,
                  fontWeight: 600,
                  fontSize: "0.62rem",
                  opacity: 0.92,
                }}
              >
                AI & Future of Work
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: { xs: 1, sm: 1.25 },
            }}
          >
            <Box
              sx={{
                display: { xs: "none", md: "flex" },
                alignItems: "center",
                gap: 0.5,
                px: 0.65,
                py: 0.45,
                borderRadius: 999,
                backgroundColor: navClusterBg,
                border: `1px solid ${alpha(theme.palette.divider, isDark ? 0.4 : 0.55)}`,
                boxShadow: `inset 0 1px 0 ${alpha("#fff", isDark ? 0.04 : 0.65)}`,
              }}
            >
              {LANDING_ROUTES.map((link, index) => {
                const isActive = landingSpa
                  ? activeLandingSection === link.id
                  : router.asPath.split("#")[0] === "/landing" &&
                    (link.id === "home"
                      ? !router.asPath.includes("#")
                      : router.asPath.includes(
                          `#${link.id === "aiUses" ? "ai-uses" : link.id}`,
                        ));

                const navButton = (
                  <Button
                    disableRipple
                    {...(landingSpa
                      ? {
                          type: "button" as const,
                          onClick: () => onLandingSectionChange!(link.id),
                          component: "button" as const,
                        }
                      : {
                          component: "a" as const,
                        })}
                    sx={{
                      position: "relative",
                      color: isActive ? accent : "text.primary",
                      bgcolor: isActive
                        ? alpha(accent, isDark ? 0.18 : 0.12)
                        : "transparent",
                      fontWeight: isActive ? 650 : 520,
                      fontSize: "0.8125rem",
                      minWidth: 0,
                      px: 1.6,
                      py: 0.65,
                      textTransform: "none" as const,
                      borderRadius: "25px",
                      transition: theme.transitions.create(
                        ["color", "background-color", "box-shadow"],
                        { duration: 180 },
                      ),
                      "&:hover": {
                        color: accent,
                        bgcolor: alpha(accent, isDark ? 0.12 : 0.08),
                        boxShadow: isActive
                          ? undefined
                          : `0 0 0 1px ${alpha(accent, 0.18)} inset`,
                      },
                      ...(isActive && {
                        boxShadow: `0 0 0 1px ${alpha(accent, 0.28)} inset, 0 2px 10px ${alpha(accent, 0.12)}`,
                      }),
                    }}
                  >
                    {link.title}
                  </Button>
                );

                return landingSpa ? (
                  <React.Fragment key={link.id}>{navButton}</React.Fragment>
                ) : (
                  <Link
                    key={link.id}
                    href={landingHrefForSection(link.id)}
                    passHref
                    legacyBehavior
                    scroll={false}
                  >
                    {navButton}
                  </Link>
                );
              })}
            </Box>

            <IconButton
              onClick={handleThemeSwitch}
              size="small"
              aria-label={
                isDark ? "Switch to light mode" : "Switch to dark mode"
              }
              sx={{ ...iconChipSx, p: 0.85, borderRadius: "25px" }}
            >
              {isDark ? (
                <LightModeIcon sx={{ fontSize: 20 }} />
              ) : (
                <DarkModeIcon sx={{ fontSize: 20 }} />
              )}
            </IconButton>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                flexShrink: 0,
              }}
            >
              {isAuthLoading ? (
                <Button
                  variant="outlined"
                  disabled
                  startIcon={
                    <CircularProgress size={14} thickness={5} color="inherit" />
                  }
                  sx={{
                    textTransform: "none",
                    fontWeight: 600,
                    borderRadius: 999,
                    px: 2,
                    py: 0.75,
                    borderColor: alpha(theme.palette.divider, 0.9),
                    color: "text.secondary",
                    backgroundColor: alpha(theme.palette.background.paper, 0.4),
                    "&.Mui-disabled": {
                      borderColor: alpha(theme.palette.divider, 0.85),
                      color: "text.secondary",
                    },
                  }}
                >
                  Signing in…
                </Button>
              ) : isAuthenticated ? (
                <Link href="/" passHref legacyBehavior>
                  <Button
                    variant="contained"
                    color="inherit"
                    component="a"
                    endIcon={
                      <ArrowForwardIcon
                        sx={{
                          fontSize: 18,
                          opacity: 0.95,
                          transition: "transform 0.22s ease",
                        }}
                      />
                    }
                    sx={{
                      ...ctaSx,
                      textTransform: "none",
                      fontWeight: 650,
                      borderRadius: 999,
                      px: 2.35,
                      py: 0.95,
                      "&:hover .MuiButton-endIcon": {
                        transform: "translateX(3px)",
                      },
                    }}
                  >
                    Go to platform
                  </Button>
                </Link>
              ) : (
                <Link href="/signin" passHref legacyBehavior>
                  <Button
                    variant="contained"
                    color="inherit"
                    component="a"
                    sx={{
                      ...ctaSx,
                      textTransform: "none",
                      fontWeight: 650,
                      borderRadius: 999,
                      px: 2.35,
                      py: 0.95,
                    }}
                  >
                    Sign in / Sign up
                  </Button>
                </Link>
              )}
            </Box>

            <IconButton
              sx={{
                display: { xs: "flex", md: "none" },
                ...iconChipSx,
                p: 0.9,
              }}
              onClick={onMobileMenuOpen}
              aria-label="Open navigation menu"
            >
              <MenuIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};
export default Navigation;
