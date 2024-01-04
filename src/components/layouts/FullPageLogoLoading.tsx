/*
  FullPageLogoLoading component renders a full-page loading screen with a centered logo.
  It utilizes Material-UI's Box and Next.js Image components for layout and image rendering.
  Uncomment the CircularProgress component if you want to display a loading spinner.
*/
import { Box } from "@mui/material";
// import CircularProgress from "@mui/material/CircularProgress";
import Image from "next/image";

import LogoDarkMode from "../../../public/animated-icon-1cademy.gif";

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
        <Image
          loading="lazy"
          src={LogoDarkMode.src}
          alt="logo"
          width={250}
          height={250}
        />
        {/* <CircularProgress sx={{ mt: 5 }} /> */}
      </Box>
    </Box>
  );
};

export default FullPageLogoLoading;
