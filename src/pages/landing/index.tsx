import React, { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import { Box, ThemeProvider, CssBaseline, GlobalStyles } from "@mui/material";
import { useThemeManager } from "../../lib/hooks/useThemeManager";
import Navigation from "./_components/Navigation";
import MobileDrawer from "./_components/MobileDrawer";
import { createLandingTheme } from "../../theme/landingTheme";
import { LandingHomeSection } from "./sections/LandingHomeSection";
import { PaperLandingSection } from "./paper";
import { PlatformLandingSection } from "./platform";
import { AiUsesLandingSection } from "./ai-uses";
import { TeamLandingSection } from "./team";
import type { LandingSectionId } from "../../constants/landingTypes";
import {
  landingHashToSection,
  landingSectionToHash,
  LANDING_SECTION_TITLES,
} from "../../constants/landingTypes";

const HOME_DESCRIPTION =
  "A comprehensive framework to systematically understand where and how AI can be used, and what this means for people and organizations.";

const LandingPage = () => {
  const { isDark, handleThemeSwitch, isAuthenticated, isAuthLoading } =
    useThemeManager();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [section, setSection] = useState<LandingSectionId>("home");

  const theme = createLandingTheme(isDark);

  useEffect(() => {
    setSection(landingHashToSection(window.location.hash));
  }, []);

  useEffect(() => {
    const onHashChange = () =>
      setSection(landingHashToSection(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const commitSection = useCallback((id: LandingSectionId) => {
    setSection(id);
    const hash = landingSectionToHash(id);
    window.history.replaceState(null, "", `/landing${hash}`);
    // After React paints the new section — avoids fighting layout (and pairs with stable scrollbar gutter).
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      });
    });
  }, []);

  return (
    <>
      <Head>
        <title>{LANDING_SECTION_TITLES[section]}</title>
        {section === "home" && (
          <meta name="description" content={HOME_DESCRIPTION} />
        )}
      </Head>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <GlobalStyles
          styles={{
            html: {
              scrollbarGutter: "stable",
            },
          }}
        />
        <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
          <Navigation
            isDark={isDark}
            handleThemeSwitch={handleThemeSwitch}
            isAuthenticated={isAuthenticated}
            isAuthLoading={isAuthLoading}
            onMobileMenuOpen={() => setMobileNavOpen(true)}
            activeLandingSection={section}
            onLandingSectionChange={commitSection}
          />

          <MobileDrawer
            open={mobileNavOpen}
            onClose={() => setMobileNavOpen(false)}
            activeLandingSection={section}
            onSelectLandingSection={(id) => {
              commitSection(id);
              setMobileNavOpen(false);
            }}
          />

          {section === "home" && (
            <LandingHomeSection
              isAuthenticated={isAuthenticated}
              isDark={isDark}
              onGoToSection={commitSection}
            />
          )}
          {section === "paper" && (
            <PaperLandingSection onGoToSection={commitSection} />
          )}
          {section === "platform" && (
            <PlatformLandingSection
              isDark={isDark}
              isAuthenticated={isAuthenticated}
              onGoToSection={commitSection}
            />
          )}
          {section === "aiUses" && (
            <AiUsesLandingSection
              isDark={isDark}
              onGoToSection={commitSection}
            />
          )}
          {section === "team" && (
            <TeamLandingSection
              isDark={isDark}
              onGoToSection={commitSection}
            />
          )}
        </Box>
      </ThemeProvider>
    </>
  );
};

export default LandingPage;
