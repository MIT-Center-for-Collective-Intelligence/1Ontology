import React, { useEffect, useState } from "react";
import Head from "next/head";
import {
  Avatar,
  Box,
  Container,
  Grid,
  Typography,
  ThemeProvider,
  CssBaseline,
  Fade,
  IconButton,
} from "@mui/material";
import { useThemeManager } from "../../lib/hooks/useThemeManager";
import { createLandingTheme } from "../../theme/landingTheme";
import { Navigation } from "./_components/Navigation";
import { MobileDrawer } from "./_components/MobileDrawer";
import { Footer } from "./_components/Footer";
import { OpenInNew } from "@mui/icons-material";

interface TeamMember {
  name: string;
  affiliation: string;
  image?: string;
}

interface TeamData {
  roles: Record<string, TeamMember[]>;
}

interface Publication {
  id: string;
  title: string;
  authors: string[];
  journal: string;
  year: number;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  url: string;
  abstract: string;
}

interface PublicationsData {
  publications: Publication[];
}

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

// Team Member Component with Role and Affiliation
const TeamMemberCard = ({ member, index }: { member: TeamMember; index: number }) => {
  return (
    <Fade in={true} timeout={600 + index * 100}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          p: 2,
        }}
      >
        {/* Profile Picture */}
        <Avatar
          src={member.image}
          alt={member.name}
          sx={{
            width: { xs: 120, sm: 130, md: 140, lg: 120 },
            height: { xs: 120, sm: 130, md: 140, lg: 120 },
            mb: 2,
            transition: "all 0.3s ease-in-out",
            "&:hover": {
              transform: "scale(1.05)",
            },
            "& img": {
              width: "120%",
              height: "120%",
              objectFit: "cover",
              objectPosition: "center",
            },
          }}
        />

        {/* Name */}
        <Typography
          variant="h6"
          component="h3"
          sx={{
            fontWeight: 600,
            mb: 0.5,
            color: "text.primary",
            fontSize: { xs: "1rem", sm: "1.125rem", md: "1.25rem" },
            fontFamily:
              '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
          }}
        >
          {member.name}
        </Typography>

        {/* Affiliation */}
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            fontWeight: 400,
            fontSize: { xs: "0.875rem", sm: "0.9rem" },
            fontFamily:
              '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          {member.affiliation}
        </Typography>
      </Box>
    </Fade>
  );
};

// Clean Publication Item Component
const PublicationItem = ({ publication, index }: { publication: Publication; index: number }) => {
  return (
    <Fade in={true} timeout={600 + index * 50}>
      <Box
        sx={{
          py: 4,
          borderBottom: (theme) =>
            theme.palette.mode === "dark"
              ? "1px solid rgba(255,255,255,0.08)"
              : "1px solid rgba(0,0,0,0.08)",
          transition: "all 0.3s ease-in-out",
          "&:hover": {
            "& .publication-title": {
              color: "primary.main",
            },
          },
          "&:last-child": {
            borderBottom: "none",
          },
        }}
      >
        {/* Title */}
        <Typography
          variant="h5"
          component="h3"
          className="publication-title"
          sx={{
            fontWeight: 500,
            mb: 2,
            color: "text.primary",
            fontSize: { xs: "1.125rem", sm: "1.25rem", md: "1.375rem" },
            fontFamily:
              '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
            lineHeight: 1.4,
            letterSpacing: "-0.01em",
            transition: "color 0.3s ease-in-out",
          }}
        >
          <Box
            component="a"
            href={publication.url}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              color: "inherit",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "flex-start",
              gap: 1,
              "&:hover": {
                color: "primary.main",
              },
            }}
          >
            {publication.title}
            <OpenInNew
              sx={{
                fontSize: { xs: 18, sm: 20 },
                opacity: 0.6,
                mt: 0.1,
                transition: "opacity 0.3s ease-in-out",
                "&:hover": {
                  opacity: 1,
                },
              }}
            />
          </Box>
        </Typography>

        {/* Authors and Publication Info */}
        <Box sx={{ mb: 2 }}>
          <Typography
            variant="body1"
            sx={{
              color: "text.secondary",
              fontWeight: 400,
              mb: 0.5,
              fontFamily:
                '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
              fontSize: { xs: "0.9rem", sm: "1rem" },
            }}
          >
            {publication.authors.join(", ")}
          </Typography>
          
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              fontStyle: "italic",
              fontFamily:
                '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
              fontSize: { xs: "0.875rem", sm: "0.9rem" },
              opacity: 0.8,
            }}
          >
            {publication.journal} ({publication.year})
            {publication.volume && `, Vol. ${publication.volume}`}
            {publication.issue && `, Issue ${publication.issue}`}
            {publication.pages && `, pp. ${publication.pages}`}
          </Typography>
        </Box>

        {/* Abstract */}
        <Typography
          variant="body1"
          sx={{
            color: "text.primary",
            lineHeight: 1.7,
            fontFamily:
              '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
            fontSize: { xs: "0.9rem", sm: "1rem" },
            opacity: 0.9,
            maxWidth: "100%",
          }}
        >
          {publication.abstract}
        </Typography>
      </Box>
    </Fade>
  );
};

const TeamPage = () => {
  const { isDark, handleThemeSwitch, isAuthenticated, isAuthLoading } = useThemeManager();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [publicationsData, setPublicationsData] = useState<PublicationsData | null>(null);

  useEffect(() => {
    // Fetch team data
    fetch("/landing_data/team_data.json")
      .then((res) => res.json())
      .then((data) => setTeamData(data))
      .catch((err) => console.error("Error loading team data:", err));
    
    // Fetch publications data
    fetch("/landing_data/publications_data.json")
      .then((res) => res.json())
      .then((data) => setPublicationsData(data))
      .catch((err) => console.error("Error loading publications data:", err));
  }, []);

  // Function to sort members by last name
  const sortMembersByLastName = (members: TeamMember[]) => {
    return [...members].sort((a, b) => {
      const lastNameA = a.name.split(' ').pop()?.toLowerCase() || '';
      const lastNameB = b.name.split(' ').pop()?.toLowerCase() || '';
      return lastNameA.localeCompare(lastNameB);
    });
  };

  // Get team data structure directly and sort members
  const membersByRole = teamData?.roles || {};
  const sortedMembersByRole = Object.fromEntries(
    Object.entries(membersByRole).map(([role, members]) => [
      role,
      sortMembersByLastName(members)
    ])
  );

  // Define role order for consistent display
  const roleOrder = ["Faculty Members", "Researchers", "Developers"];
  const sortedRoles = roleOrder.filter(role => sortedMembersByRole[role]);
  // Add any additional roles not in the predefined order
  const otherRoles = Object.keys(sortedMembersByRole).filter(role => !roleOrder.includes(role));
  const orderedRoles = [...sortedRoles, ...otherRoles];

  const theme = createLandingTheme(isDark);

  if (!teamData) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.default",
        }}
      >
        <Typography variant="h6" color="text.secondary">
          Loading team information...
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Head>
        <title>Our Team - AI and the Future of Work</title>
        <meta
          name="description"
          content="Meet the dedicated researchers, faculty, and students working on AI and the future of work ontology project at MIT."
        />
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

          {/* Hero Section */}
          <Box
            sx={{
              pt: 18,
              bgcolor: "background.default",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
              <Box sx={{ textAlign: "center", mb: 4 }}>
                <Typography
                  variant="h4"
                  component="h1"
                  sx={{
                    fontWeight: 500,
                    fontSize: { xs: "1.5rem", md: "1.75rem", lg: "2rem" },
                    letterSpacing: "-0.01em",
                    lineHeight: 1.3,
                    color: "text.primary",
                    fontFamily:
                      '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                  }}
                >
                  Our Team
                </Typography>
              </Box>
            </Container>
          </Box>

          {/* Team Members Section */}
          <Box sx={{ py: { xs: 4, md: 6 } }}>
            <Container maxWidth="xl">
              {orderedRoles.map((role, roleIndex) => {
                const members = sortedMembersByRole[role];
                return (
                <Box key={role} sx={{ mb: { xs: 6, md: 8 } }}>
                  {/* Role Section Header */}
                  <Box sx={{ mb: 4, textAlign: "center" }}>
                    <Typography
                      variant="h5"
                      component="h2"
                      sx={{
                        fontWeight: 500,
                        fontSize: { xs: "1.25rem", md: "1.5rem" },
                        letterSpacing: "-0.01em",
                        color: "text.primary",
                        fontFamily:
                          '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                        mb: 1,
                      }}
                    >
                      {role}
                    </Typography>
                    <Box
                      sx={{
                        width: 60,
                        height: 3,
                        bgcolor: "primary.main",
                        borderRadius: 1.5,
                        mx: "auto",
                        opacity: 0.8,
                      }}
                    />
                  </Box>

                  {/* Members Grid */}
                  <Grid container spacing={3} justifyContent="center">
                    {members.map((member, memberIndex) => (
                      <Grid 
                        item 
                        xs={6} 
                        sm={4} 
                        md={3} 
                        lg={2.4} 
                        key={`${role}-${memberIndex}`}
                        sx={{ display: "flex", justifyContent: "center" }}
                      >
                        <TeamMemberCard 
                          member={member} 
                          index={roleIndex * 10 + memberIndex} 
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
                );
              })}
            </Container>
          </Box>

          {/* Publications Section */}
          <Box
            sx={{
              py: { xs: 4, md: 6 },
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
            <Container maxWidth="lg">
              <Box sx={{ textAlign: "center", mb: 4 }}>
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 500,
                    fontSize: { xs: "1.5rem", md: "1.75rem", lg: "2rem" },
                    letterSpacing: "-0.01em",
                    lineHeight: 1.3,
                    color: "text.primary",
                    fontFamily:
                      '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                  }}
                >
                  Related Publications
                </Typography>
              </Box>

              <Box sx={{ maxWidth: "900px", mx: "auto" }}>
                {publicationsData?.publications.map((publication, index) => (
                  <PublicationItem
                    key={publication.id}
                    publication={publication}
                    index={index}
                  />
                )) || (
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      py: 8,
                    }}
                  >
                    <Typography
                      variant="body1"
                      sx={{
                        color: "text.secondary",
                        fontFamily:
                          '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                        opacity: 0.7,
                      }}
                    >
                      Loading publications...
                    </Typography>
                  </Box>
                )}
              </Box>
            </Container>
          </Box>

          {/* CTA Section */}
          {/* <Box
            sx={{
              py: 12,
              bgcolor: (theme) =>
                theme.palette.mode === "dark"
                  ? "linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)"
                  : "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
              borderTop: (theme) =>
                theme.palette.mode === "dark"
                  ? "1px solid rgba(255,255,255,0.05)"
                  : "1px solid rgba(148,163,184,0.1)",
              position: "relative",
              overflow: "hidden",
            }}
          >
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
                  Join Our Research
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
                  Interested in contributing to our research on AI and the future
                  of work? Explore collaboration opportunities and get in touch.
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
                    Explore Platform
                  </Button>
                  <Button
                    variant="outlined"
                    color="primary"
                    size="large"
                    component="a"
                    href="/landing"
                    sx={{ px: 4 }}
                  >
                    Learn More
                  </Button>
                </Box>
              </Box>
            </Container>
          </Box> */}

          {/* Footer */}
          <Footer isDark={isDark} />
        </Box>
      </ThemeProvider>
    </>
  );
};

export default TeamPage;