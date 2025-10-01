import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  AppBar,
  Box,
  Button,
  Container,
  IconButton,
  Toolbar,
  Typography,
} from "@mui/material";
import {
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
}

const Navigation: React.FC<NavigationProps> = ({
  isDark,
  handleThemeSwitch,
  isAuthenticated,
  isAuthLoading,
  onMobileMenuOpen,
}) => {
  const router = useRouter();

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

            <IconButton onClick={handleThemeSwitch} size="small">
              {isDark ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>

            {isAuthLoading ? (
              <Button variant="contained" color="primary" disabled>
                Loading...
              </Button>
            ) : isAuthenticated ? (
              <Link href="/" passHref legacyBehavior>
                <Button variant="contained" color="primary" component="a">
                  Go to Platform
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/signin" passHref legacyBehavior>
                  <Button
                    variant="text"
                    color="primary"
                    component="a"
                    sx={{ display: { xs: "none", sm: "inline-flex" } }}
                  >
                    Sign In
                  </Button>
                </Link>
                <Link href="/signup" passHref legacyBehavior>
                  <Button variant="contained" color="primary" component="a">
                    Register
                  </Button>
                </Link>
              </>
            )}

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
