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
import {
  ArrowForward as ArrowForwardIcon,
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  Menu as MenuIcon,
} from "@mui/icons-material";
import { LANDING_ROUTES } from "../../../constants/landingRoutes";

interface NavigationProps {
  isDark: boolean;
  handleThemeSwitch: () => void;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  onMobileMenuOpen: () => void;
  showNavBarButtons?: boolean;
}

const navTextButtonSx = {
  color: "text.primary",
  fontWeight: 500,
  textTransform: "none" as const,
  borderRadius: 1,
  px: 1.5,
  "&:hover": {
    color: "primary.main",
    bgcolor: "rgba(255,152,0,0.1)",
  },
};

const Navigation: React.FC<NavigationProps> = ({
  isDark,
  handleThemeSwitch,
  isAuthenticated,
  isAuthLoading,
  onMobileMenuOpen,
  showNavBarButtons = true,
}) => {
  const router = useRouter();

  const landingCtaBgSx = {
    bgcolor: isDark ? "#5c6b7d" : "#556477",
    color: "#fff",
    boxShadow: "none",
    "&:hover": {
      bgcolor: isDark ? "#6a7a8e" : "#637592",
      boxShadow: 2,
    },
  };

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        bgcolor: "background.default",
        backdropFilter: "blur(8px)",
      }}
    >
      <Container maxWidth="xl">
        <Toolbar sx={{ justifyContent: "space-between", py: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Link href="/landing" passHref legacyBehavior>
              <Box
                component="a"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <img
                  src={
                    isDark
                      ? "/MIT-Logo-small-Dark.png"
                      : "/MIT-Logo-Small-Light.png"
                  }
                  alt="MIT Logo"
                  style={{ height: "40px", width: "auto" }}
                />
              </Box>
            </Link>
            <Box sx={{ display: { xs: "none", sm: "block" } }}>
              <Typography
                variant="body1"
                sx={{ fontWeight: 500, color: "text.primary" }}
              >
                Ontology of Collective Intelligence
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                AI & Future of Work
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            {showNavBarButtons && (
              <Box
                sx={{
                  display: { xs: "none", md: "flex" },
                  alignItems: "center",
                  gap: 3,
                }}
              >
                {LANDING_ROUTES.map((link, index) => {
                  const isActive = router.pathname === link.href;

                  return (
                    <Link key={index} href={link.href} passHref legacyBehavior>
                      <Button
                        component="a"
                        sx={{
                          color: isActive ? "primary.main" : "text.primary",
                          bgcolor: isActive
                            ? "rgba(255,152,0,0.1)"
                            : "transparent",
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
                    </Link>
                  );
                })}
              </Box>
            )}

            <IconButton onClick={handleThemeSwitch} size="small">
              {isDark ? <LightModeIcon /> : <DarkModeIcon />}
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
                    fontWeight: 500,
                    borderRadius: 2,
                    px: 2,
                    borderColor: "divider",
                    color: "text.secondary",
                    "&.Mui-disabled": {
                      borderColor: "divider",
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
                      <ArrowForwardIcon sx={{ fontSize: 18, opacity: 0.9 }} />
                    }
                    sx={{
                      ...landingCtaBgSx,
                      textTransform: "none",
                      fontWeight: 600,
                      borderRadius: "25px",
                      px: 2.25,
                      py: 0.875,
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
                      ...landingCtaBgSx,
                      textTransform: "none",
                      fontWeight: 600,
                      borderRadius: "25px",
                      px: 2.25,
                      py: 0.875,
                    }}
                  >
                    Sign in/Sign up
                  </Button>
                </Link>
              )}
            </Box>

            <IconButton
              sx={{ display: { xs: "flex", md: "none" } }}
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
