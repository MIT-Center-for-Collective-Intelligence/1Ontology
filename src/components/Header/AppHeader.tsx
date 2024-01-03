import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import LogoutIcon from "@mui/icons-material/Logout";
import { Avatar, Typography, useTheme } from "@mui/material";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import { Stack } from "@mui/system";
import { getAuth } from "firebase/auth";
import Image from "next/image";
import { useRouter } from "next/router";
import React, { forwardRef, useState } from "react";
import mitLogo from "../../../public/CCI-logo.gif";
import mitLogoDark from "../../../public/MIT-Logo-Dark.png";
import { capitalizeString } from "../../lib/utils/string.utils";
import useThemeChange from " @components/lib/hooks/useThemeChange";
import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";
import ROUTES from " @components/lib/utils/routes";
import { useAuth } from "../context/AuthContext";

export const HEADER_HEIGHT = 80;
export const HEADER_HEIGHT_MOBILE = 72;

export const orangeDark = "#FF6D00";
export const orange900 = "#E56200";

export type HeaderPage = "ONE_CADEMY" | "ONE_ASSISTANT" | "COMMUNITIES";

type AppHeaderProps = {
  page: HeaderPage;
  sections: any;
  selectedSectionId: string;
  onSwitchSection: (sectionId: string) => void;
  mitpage?: boolean;
  tutorPage?: boolean;
  // preUrl?: string;
};

const AppHeader = forwardRef(({ onSwitchSection }: AppHeaderProps, ref) => {
  const [{ isAuthenticated, user }] = useAuth();
  const [handleThemeSwitch] = useThemeChange();
  const theme = useTheme();
  const router = useRouter();
  const [profileMenuOpen, setProfileMenuOpen] = useState(null);
  const isProfileMenuOpen = Boolean(profileMenuOpen);

  const signOut = async () => {
    router.push(ROUTES.signIn);
    getAuth().signOut();
  };

  const handleProfileMenuOpen = (event: any) => {
    setProfileMenuOpen(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setProfileMenuOpen(null);
  };

  const renderProfileMenu = (
    <Menu
      id="ProfileMenu"
      anchorEl={profileMenuOpen}
      open={isProfileMenuOpen}
      onClose={handleProfileMenuClose}
    >
      {isAuthenticated && user && (
        <Typography sx={{ p: "6px 16px" }}>
          {capitalizeString(user.fName ?? "")}
        </Typography>
      )}
      {isAuthenticated && user && (
        <MenuItem sx={{ flexGrow: 3 }} onClick={signOut}>
          <LogoutIcon /> <span id="LogoutText">Logout</span>
        </MenuItem>
      )}
    </Menu>
  );

  return (
    <>
      <Box
        ref={ref}
        sx={{
          background: (theme) =>
            theme.palette.mode === "dark"
              ? "rgba(0,0,0,.72)"
              : DESIGN_SYSTEM_COLORS.gray200,
          backdropFilter: "saturate(180%) blur(10px)",
          position: "sticky",
          top: "0",
          // zIndex: "22",
        }}
      >
        <Stack
          direction={"row"}
          justifyContent="space-between"
          alignItems="center"
          spacing={{ xs: "2px", sm: "8px", md: "16px" }}
          sx={{
            px: { xs: "16px", sm: "32px" },
            maxWidth: "100%",
            margin: "auto",
            height: {
              xs: `${HEADER_HEIGHT_MOBILE}px`,
              md: `${HEADER_HEIGHT}px`,
            },
          }}
        >
          <Stack direction={"row"} alignItems="center" spacing={"16px"}>
            <Avatar
              src={
                theme.palette.mode === "dark" ? mitLogoDark.src : mitLogo.src
              }
              alt="logo"
              sx={{
                cursor: "pointer",
                width: "240px",
                height: "auto",
                borderRadius: 0,
              }}
              onClick={() => {}}
            />
          </Stack>
          <Stack
            direction={"row"}
            justifyContent="flex-end"
            alignItems="center"
            spacing={"8px"}
          >
            <Tooltip title="Change theme">
              <IconButton onClick={handleThemeSwitch} size="small">
                {theme.palette.mode === "dark" ? (
                  <LightModeIcon />
                ) : (
                  <DarkModeIcon />
                )}
              </IconButton>
            </Tooltip>

            {isAuthenticated && user && (
              <Tooltip title={capitalizeString(user.fName ?? "")}>
                <IconButton onClick={handleProfileMenuOpen}>
                  <Box
                    sx={{
                      width: "26px",
                      height: "26px",
                      borderRadius: "30px",
                      color: (theme) => theme.palette.common.gray,
                    }}
                    aria-haspopup="true"
                    aria-controls="lock-menu"
                    aria-label={`${user.fName}'s Account`}
                    aria-expanded={isProfileMenuOpen ? "true" : undefined}
                  >
                    <Image
                      src={user.imageUrl || ""}
                      alt={user.fName}
                      width={26}
                      height={26}
                      quality={40}
                      objectFit="cover"
                      style={{
                        borderRadius: "30px",
                      }}
                    />
                  </Box>
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Stack>
        {isAuthenticated && user && renderProfileMenu}
      </Box>
    </>
  );
});

AppHeader.displayName = "AppHeader";

const AppHeaderMemoized = React.memo(AppHeader);

export default AppHeaderMemoized;
