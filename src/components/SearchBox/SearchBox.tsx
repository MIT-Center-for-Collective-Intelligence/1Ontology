import {
  FormControl,
  IconButton,
  InputAdornment,
  OutlinedInput,
} from "@mui/material";
import React, { useState } from "react";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";

type IProps = {
  setSearch: (value: string) => void;
  search: string;
  label: string;
  glowSearchBox?: boolean;
  sx?: any;
};

export const SearchBox = ({
  setSearch,
  search,
  label,
  glowSearchBox,
  sx,
}: IProps) => {
  const [inputValue, setInputValue] = useState("");

  const inputStyles = {
    borderRadius: "30px",
    backgroundColor: (theme: any) =>
      theme.palette.mode === "dark" ? "#080808" : "white",
    margin: "12px",
    border: "none",
    color: (theme: any) => (theme.palette.mode === "dark" ? "white" : "black"),
    boxShadow: glowSearchBox ? "0 0 8px 2px rgba(0, 255, 0, 0.6)" : "",
    "& input": {
      margin: "11px",
      border: "none",
      p: "0 0 0 5px",
      color: glowSearchBox
        ? "green"
        : (theme: any) => (theme.palette.mode === "dark" ? "white" : "black"),
      caretColor: glowSearchBox ? "green" : undefined,
      "&::placeholder": {
        color: (theme: any) =>
          theme.palette.mode === "dark" ? "white!important" : "gray",
      },
    },
  };

  return (
    <FormControl
      sx={{
        m: 0,
        ...sx,
      }}
      fullWidth
    >
      {window.innerWidth > 800 ? (
        <OutlinedInput
          placeholder={label}
          sx={inputStyles}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          startAdornment={
            <InputAdornment position="start">
              <SearchIcon
                sx={{
                  color: (theme) =>
                    theme.palette.mode === "dark" ? "white!important" : "gray",
                }}
              />
            </InputAdornment>
          }
          endAdornment={
            search && (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => {
                    setSearch("");
                  }}
                  color="primary"
                  edge="end"
                >
                  <CloseIcon />
                </IconButton>
              </InputAdornment>
            )
          }
        />
      ) : (
        <OutlinedInput
          placeholder={label}
          sx={inputStyles}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          endAdornment={
            <InputAdornment position="end">
              <IconButton
                color="primary"
                onClick={() => {
                  setSearch(inputValue);
                  setInputValue("");
                  const element = document.getElementById(
                    "notebook-sidebar-view",
                  ) as HTMLElement;
                  if (element) {
                    element.style.left = "-1000px";
                  }
                }}
              >
                <SearchIcon
                  sx={{
                    color: (theme) =>
                      theme.palette.mode === "dark"
                        ? "white!important"
                        : "gray",
                  }}
                />
              </IconButton>
            </InputAdornment>
          }
        />
      )}
    </FormControl>
  );
};
