import React from "react";
import Link from "next/link";
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
  Typography,
} from "@mui/material";
import {
  LANDING_ROUTES,
  landingHrefForSection,
} from "../../../constants/landingRoutes";
import type { LandingSectionId } from "../../../constants/landingTypes";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  activeLandingSection?: LandingSectionId;
  onSelectLandingSection?: (id: LandingSectionId) => void;
}

const MobileDrawer: React.FC<MobileDrawerProps> = ({
  open,
  onClose,
  activeLandingSection,
  onSelectLandingSection,
}) => {
  const landingSpa =
    activeLandingSection !== undefined && onSelectLandingSection !== undefined;
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
    >
      <Box
        sx={{ width: 280, p: 2 }}
        role="presentation"
        onClick={onClose}
        onKeyDown={onClose}
      >
        <Typography
          variant="subtitle2"
          sx={{ px: 1, py: 1, color: "text.secondary" }}
        >
          Menu
        </Typography>
        <Divider sx={{ mb: 1 }} />
        <List>
          {LANDING_ROUTES.map((link, index) => (
            <ListItem key={index} disablePadding>
              {landingSpa ? (
                <ListItemButton
                  selected={activeLandingSection === link.id}
                  onClick={() => {
                    onSelectLandingSection!(link.id);
                    onClose();
                  }}
                >
                  <ListItemText primary={link.title} />
                </ListItemButton>
              ) : (
                <Link
                  href={landingHrefForSection(link.id)}
                  passHref
                  legacyBehavior
                  scroll={false}
                >
                  <ListItemButton component="a">
                    <ListItemText primary={link.title} />
                  </ListItemButton>
                </Link>
              )}
            </ListItem>
          ))}
        </List>
      </Box>
    </Drawer>
  );
};
export default MobileDrawer;
