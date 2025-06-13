import {
  Button,
  FormControl,
  IconButton,
  InputAdornment,
  OutlinedInput,
} from "@mui/material";
import React, { useEffect, useState } from "react";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";

type IProps = {
  setSearch: any;
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

  return (
    <FormControl
      sx={{
        m: 0,
        ...sx,
      }}
      fullWidth
    >
      {window.innerWidth > 800 && (
        <OutlinedInput
          placeholder={label}
          sx={{
            borderRadius: "30px",
            backgroundColor: (theme) =>
              theme.palette.mode === "dark" ? "#080808" : "white",
            margin: "12px",
            border: "none",
            color: (theme) =>
              theme.palette.mode === "dark" ? "white" : "black",
            boxShadow: glowSearchBox ? "0 0 8px 2px rgba(0, 255, 0, 0.6)" : "",
            "& input": {
              margin: "11px",
              border: "none",
              p: 0,
              "&::placeholder": {
                color: (theme) =>
                  theme.palette.mode === "dark" ? "white!important" : "gray",
              },
            },
          }}
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
      )}

      {window.innerWidth <= 800 && (
        <OutlinedInput
          placeholder={label}
          sx={{
            borderRadius: "30px",
            backgroundColor: (theme) =>
              theme.palette.mode === "dark" ? "#080808" : "white",
            margin: "12px",
            border: "none",
            color: (theme) =>
              theme.palette.mode === "dark" ? "white" : "black",
            boxShadow: glowSearchBox ? "0 0 8px 2px rgba(0, 255, 0, 0.6)" : "",
            "& input": {
              margin: "11px",
              border: "none",
              p: "0 0 0 5px",
              "&::placeholder": {
                color: (theme) =>
                  theme.palette.mode === "dark" ? "white!important" : "gray",
              },
            },
          }}
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
