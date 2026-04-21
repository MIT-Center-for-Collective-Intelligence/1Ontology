/*
  FullPageLogoLoading component renders a full-page loading screen with a centered logo.
  Material-UI Box layout; plain img for the loader GIF (avoids Next/Image fetchPriority DOM warnings).
  Uncomment CircularProgress to show a loading spinner.
*/
import { Box } from "@mui/material";
// import CircularProgress from "@mui/material/CircularProgress";

import LogoDarkMode from "../../../public/loader.gif";

const FullPageLogoLoading = () => {
  return (
    <Box
      sx={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          textAlign: "center",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <img
          src={LogoDarkMode.src}
          alt="logo"
          width={250}
          height={250}
          style={{ borderRadius: "25px" }}
          loading="lazy"
        />
        {/* <CircularProgress sx={{ mt: 5 }} /> */}
      </Box>
    </Box>
  );
};

export default FullPageLogoLoading;
