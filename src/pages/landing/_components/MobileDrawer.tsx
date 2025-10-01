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
import { LANDING_ROUTES } from "../../../constants/landingRoutes";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

const MobileDrawer: React.FC<MobileDrawerProps> = ({ open, onClose }) => {
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
              <Link href={link.href} passHref legacyBehavior>
                <ListItemButton component="a">
                  <ListItemText primary={link.title} />
                </ListItemButton>
              </Link>
            </ListItem>
          ))}
        </List>
      </Box>
    </Drawer>
  );
};
export default MobileDrawer;
