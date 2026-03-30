import React from "react";
import Link from "next/link";
import { Box, Container, Grid, Typography } from "@mui/material";
import {
  LANDING_ROUTES,
  EXTERNAL_LINKS,
  landingHrefForSection,
} from "../../../constants/landingRoutes";
import type { LandingSectionId } from "../../../constants/landingTypes";
import Image from "next/image";

interface FooterProps {
  isDark: boolean;
  /** When set, nav links switch sections without leaving `/landing`. */
  onLandingSectionChange?: (id: LandingSectionId) => void;
}

const Footer: React.FC<FooterProps> = ({ isDark, onLandingSectionChange }) => {
  return (
    <Box
      component="footer"
      sx={{
        py: 3,
        bgcolor: "background.paper",
        borderTop: (theme) =>
          theme.palette.mode === "dark"
            ? "1px solid rgba(255,255,255,0.08)"
            : "1px solid rgba(0,0,0,0.08)",
      }}
    >
      <Container maxWidth="xl">
        <Grid
          container
          spacing={0}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
        >
          {/* Logo & Title */}
          <Grid size={{ xs: 12, md: 3 }}>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                pr: { md: 3 },
                mb: { xs: 3, md: 0 },
                textAlign: { xs: "center", md: "left" },
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  mb: 2,
                  justifyContent: { xs: "center", md: "flex-start" },
                }}
              >
                <Image
                  src={
                    isDark
                      ? "/MIT-Logo-small-Dark.png"
                      : "/MIT-Logo-Small-Light.png"
                  }
                  alt="MIT"
                  width={isDark ? 235 : 200}
                  height={isDark ? 176 : 130}
                  style={{ height: 28, width: "auto" }}
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
          <Grid size={{ xs: 6, md: 3 }}>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1,
                px: { md: 3 },
                ml: { md: 6 },
                mb: { xs: 3, md: 0 },
                justifyContent: "center",
                height: "100%",
              }}
            >
              {LANDING_ROUTES.map((link, idx) =>
                onLandingSectionChange ? (
                  <Typography
                    key={idx}
                    component="button"
                    type="button"
                    onClick={() => onLandingSectionChange(link.id)}
                    sx={{
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      textAlign: "inherit",
                      font: "inherit",
                      color: "text.secondary",
                      fontSize: "0.9rem",
                      textDecoration: "underline",
                      textUnderlineOffset: "0.2em",
                      padding: 0,
                      "&:hover": { color: "primary.main" },
                    }}
                  >
                    {link.title}
                  </Typography>
                ) : (
                  <Link
                    key={idx}
                    href={landingHrefForSection(link.id)}
                    passHref
                    legacyBehavior
                    scroll={false}
                  >
                    <Typography
                      component="a"
                      sx={{
                        color: "text.secondary",
                        fontSize: "0.9rem",
                        textDecoration: "underline",
                        textUnderlineOffset: "0.2em",
                        "&:hover": { color: "primary.main" },
                      }}
                    >
                      {link.title}
                    </Typography>
                  </Link>
                ),
              )}
            </Box>
          </Grid>

          {/* Desktop Divider */}
          <Box
            sx={{
              width: "1px",
              bgcolor: "divider",
              mx: 2,
              display: { xs: "none", md: "block" },
              alignSelf: "stretch",
            }}
          />

          {/* Related Project Links */}
          <Grid size={{ xs: 6, md: 3 }}>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1,
                px: { md: 3 },
                mb: { xs: 3, md: 0 },
                justifyContent: "center",
                height: "100%",
              }}
            >
              <Typography
                component="a"
                href={EXTERNAL_LINKS.m3s.href}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  color: "text.secondary",
                  fontSize: "0.9rem",
                  textDecoration: "underline",
                  textUnderlineOffset: "0.2em",
                  "&:hover": { color: "primary.main" },
                }}
              >
                {EXTERNAL_LINKS.m3s.title}
              </Typography>
              <Typography
                component="a"
                href={EXTERNAL_LINKS.cci.href}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  color: "text.secondary",
                  fontSize: "0.9rem",
                  textDecoration: "underline",
                  textUnderlineOffset: "0.2em",
                  "&:hover": { color: "primary.main" },
                }}
              >
                {EXTERNAL_LINKS.cci.title}
              </Typography>
            </Box>
          </Grid>

          {/* Desktop Divider */}
          <Box
            sx={{
              width: "1px",
              bgcolor: "divider",
              mx: 2,
              display: { xs: "none", md: "block" },
              alignSelf: "stretch",
            }}
          />

          {/* Accessibility Info */}
          <Grid size={{ xs: 12, md: 2 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: { xs: "center", md: "center" },
                alignItems: "center",
                height: "100%",
                pl: { md: 3 },
              }}
            >
              <Typography
                component="a"
                href={EXTERNAL_LINKS.accessibility.href}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  color: "text.secondary",
                  fontSize: "0.9rem",
                  textDecoration: "underline",
                  textUnderlineOffset: "0.2em",
                  "&:hover": { color: "primary.main" },
                }}
              >
                {EXTERNAL_LINKS.accessibility.title}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default Footer;
