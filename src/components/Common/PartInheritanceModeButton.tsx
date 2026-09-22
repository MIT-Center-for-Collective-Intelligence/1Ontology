import React, { useState } from "react";
import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  SvgIconProps,
} from "@mui/material";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';

import SyncIcon from "@mui/icons-material/Sync";
import BlockIcon from "@mui/icons-material/Block";
import CheckIcon from "@mui/icons-material/Check";

export type InheritanceMode =
  | "neverInherit"
  | "alwaysInherit"
  | "inheritUnlessAlreadyOverRidden";

export const PART_INHERITANCE_MODE_OPTIONS: {
  value: InheritanceMode;
  label: string;
  Icon: React.ComponentType<SvgIconProps>;
  color: string;
}[] = [
  {
    value: "inheritUnlessAlreadyOverRidden",
    label: "Inherit Unless Overridden",
    Icon: AccountTreeOutlinedIcon,
    color: "#f2a43a",
  },
  {
    value: "alwaysInherit",
    label: "Always Inherit",
    Icon: SyncIcon,
    color: "#52d68a",
  },
  {
    value: "neverInherit",
    label: "Never Inherit",
    Icon: BlockIcon,
    color: "#ff6b6b",
  },
];

const PartInheritanceModeButton = ({
  value,
  onChange,
  disabled = false,
  onOpenChange,
  hoverBorderColor,
}: {
  value: InheritanceMode;
  onChange: (next: InheritanceMode) => void;
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
  hoverBorderColor?: string;
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const current =
    PART_INHERITANCE_MODE_OPTIONS.find((o) => o.value === value) ??
    PART_INHERITANCE_MODE_OPTIONS[0];
  const CurrentIcon = current.Icon;

  return (
    <Box sx={{ flexShrink: 0 }}>
      <Tooltip title={current.label} placement="top">
        <span>
          <IconButton
            size="small"
            disabled={disabled}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setAnchorEl(e.currentTarget);
              onOpenChange?.(true);
            }}
            sx={{
              width: 28,
              height: 28,
              p: 0,
              color: current.color,
              opacity: open ? 1 : 0.9,
              border: "1.5px solid transparent",
              borderRadius: "6px",
              transition: "border-color 0.15s ease, opacity 0.15s ease",
              "&:hover": {
                opacity: 1,
                color: current.color,
                borderColor: hoverBorderColor ?? current.color,
              },
            }}
            aria-label="Manage Inheritance"
          >
            <CurrentIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </span>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => {
          setAnchorEl(null);
          onOpenChange?.(false);
        }}
        onClick={(e) => e.stopPropagation()}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              borderRadius: "12px",
              minWidth: 300,
              border: "1px solid",
              borderColor: "divider",
            },
          },
        }}
      >
        {PART_INHERITANCE_MODE_OPTIONS.map((option) => {
          const selected = option.value === value;
          const OptionIcon = option.Icon;
          return (
            <MenuItem
              key={option.value}
              selected={selected}
              onClick={() => {
                onChange(option.value);
                setAnchorEl(null);
                onOpenChange?.(false);
              }}
              sx={{
                mx: 0.75,
                my: 0.35,
                borderRadius: "10px",
                fontSize: "0.9rem",
                gap: 0.5,
              }}
            >
              <ListItemIcon sx={{ minWidth: 28 }}>
                <OptionIcon sx={{ fontSize: 18, color: option.color }} />
              </ListItemIcon>
              <ListItemText primary={option.label} />
              <CheckIcon
                sx={{
                  fontSize: 16,
                  ml: 1,
                  color: option.color,
                  visibility: selected ? "visible" : "hidden",
                }}
              />
            </MenuItem>
          );
        })}
      </Menu>
    </Box>
  );
};

export default PartInheritanceModeButton;
