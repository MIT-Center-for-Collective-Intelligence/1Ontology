import React, { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  AppBar,
  Avatar,
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
  Fade,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
} from "@mui/material";
import { useThemeManager } from "../lib/hooks/useThemeManager";
import {
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  Menu as MenuIcon,
  OpenInNew,
} from "@mui/icons-material";

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
  const router = useRouter();
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
        default: isDark ? "#121212" : "#f9fafb",
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
    },
  });

  const navigationLinks = [
    { title: "Home", href: "/landing" },
    { title: "Platform", href: "/platform-details" },
    { title: "AI Uses", href: "/ai-uses" },
    { title: "Team", href: "/team" },
    { title: "Treemap", href: "/treemap" },
  ];

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
                    {navigationLinks.map((link, index) => {
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
                    {navigationLinks.map((link, idx) => (
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

export default TeamPage;