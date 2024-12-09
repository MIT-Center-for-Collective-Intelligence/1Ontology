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
  setSearchValue: any;
  label: string;
  sx?: any;
};
export const SearchBox = ({ setSearchValue, label, sx }: IProps) => {
  const [search, setSearch] = useState("");
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    const typingTimeout = setTimeout(() => {
      setSearchValue(search);
    }, 500);

    return () => clearTimeout(typingTimeout);
  }, [search]);
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
          value={window.innerWidth > 800 ? search : inputValue}
          onChange={(e) =>
            window.innerWidth > 800
              ? setSearch(e.target.value)
              : setInputValue(e.target.value)
          }
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
                  sx={{}}
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
          value={window.innerWidth > 800 ? search : inputValue}
          onChange={(e) =>
            window.innerWidth > 800
              ? setSearch(e.target.value)
              : setInputValue(e.target.value)
          }
          endAdornment={
            <InputAdornment position="end">
              <IconButton
                color="primary"
                onClick={() => {
                  setSearch(inputValue);
                  setInputValue("");
                  const element = document.getElementById(
                    "notebook-sidebar-view"
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
