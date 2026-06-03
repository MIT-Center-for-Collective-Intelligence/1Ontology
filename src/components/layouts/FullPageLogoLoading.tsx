import { Box, Typography, keyframes } from "@mui/material";
import LogoDarkMode from "../../../public/loader.gif";

const breathe = keyframes`
  0% { transform: scale(0.95); opacity: 0.8; }
  50% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.8; }
`;

const pulse = keyframes`
  0% { opacity: 0.4; }
  50% { opacity: 1; }
  100% { opacity: 0.4; }
`;

const drift = keyframes`
  0% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -50px) scale(1.1); }
  66% { transform: translate(-20px, 20px) scale(0.9); }
  100% { transform: translate(0, 0) scale(1); }
`;

const float = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-20px); }
  100% { transform: translateY(0px); }
`;

const meshGradient = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const FullPageLogoLoading = () => {
  const logoSrc =
    typeof LogoDarkMode === "string"
      ? LogoDarkMode
      : (LogoDarkMode as any)?.src;
  return (
    <Box
      sx={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background:
          "linear-gradient(-45deg, #050505, #121212, #0a0a0a, #18181b)",
        backgroundSize: "400% 400%",
        animation: `${meshGradient} 15s ease infinite`,
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 9999,
        overflow: "hidden",
      }}
    >
      {/* Grain / Noise Overlay */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.04,
          zIndex: 1,
          pointerEvents: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
      {/* Subtle Color Mesh Orbs */}
      <Box
        sx={{
          position: "absolute",
          top: "-20%",
          left: "-10%",
          width: "70%",
          height: "70%",
          background:
            "radial-gradient(circle, rgba(99, 102, 241, 0.05) 0%, transparent 70%)",
          filter: "blur(100px)",
          zIndex: 0,
        }}
      />
      <Box
        sx={{
          position: "absolute",
          bottom: "-20%",
          right: "-10%",
          width: "70%",
          height: "70%",
          background:
            "radial-gradient(circle, rgba(168, 85, 247, 0.05) 0%, transparent 70%)",
          filter: "blur(100px)",
          zIndex: 0,
        }}
      />
      <Box
        sx={{
          position: "absolute",
          width: "500px",
          height: "500px",
          background:
            "radial-gradient(circle, rgba(156, 39, 176, 0.05) 0%, transparent 70%)",
          filter: "blur(80px)",
          borderRadius: "50%",
          bottom: "-5%",
          right: "-5%",
          zIndex: 0,
          animation: `${drift} 25s infinite ease-in-out reverse`,
        }}
      />
      <Box
        sx={{
          position: "absolute",
          width: "400px",
          height: "400px",
          background:
            "radial-gradient(circle, rgba(255, 255, 255, 0.03) 0%, transparent 70%)",
          filter: "blur(100px)",
          borderRadius: "50%",
          top: "30%",
          right: "10%",
          zIndex: 0,
          animation: `${drift} 18s infinite ease-in-out 2s`,
        }}
      />

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          textAlign: "center",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1,
          animation: `${breathe} 4s ease-in-out infinite`,
        }}
      >
        <Box
          sx={{
            position: "relative",
            p: 1,
            borderRadius: "32px",
            background: "rgba(255, 255, 255, 0.03)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.05)",
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
          }}
        >
          <Box
            component="img"
            src={logoSrc}
            alt="Ontology Logo"
            width={220}
            height={220}
            sx={{ borderRadius: "24px", display: "block" }}
          />
        </Box>

        <Box sx={{ mt: 6 }}>
          <Typography
            textAlign="center"
            variant="caption"
            mt={1}
            sx={{
              fontWeight: 900,
              fontSize: "28px",
              letterSpacing: "-0.02em",
              color: "rgba(255,255,255,0.92)",
              textShadow: "0 18px 45px rgba(0,0,0,0.55)",
            }}
          >
            The Ontology of Collective Intelligence
          </Typography>
          <Typography
            sx={{
              mt: 1.25,
              maxWidth: 520,
              mx: "auto",
              color: "rgba(255,255,255,0.72)",
              fontSize: "1.05rem",
              lineHeight: 1.55,
            }}
          >
            Build, explore, and connect ideas with a calm, focused workspace.
          </Typography>
          <Box
            sx={{
              mt: 2,
              width: "40px",
              height: "2px",
              background: "rgba(255, 255, 255, 0.2)",
              mx: "auto",
              position: "relative",
              overflow: "hidden",
              borderRadius: "1px",
              "&::after": {
                content: '""',
                position: "absolute",
                top: 0,
                left: "-100%",
                width: "100%",
                height: "100%",
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)",
                animation: "shimmer 2s infinite",
              },
              "@keyframes shimmer": {
                "100%": { left: "100%" },
              },
            }}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default FullPageLogoLoading;
