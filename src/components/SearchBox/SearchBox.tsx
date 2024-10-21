import {
  Button,
  FormControl,
  InputAdornment,
  OutlinedInput,
} from "@mui/material";
import React, { useEffect, useState } from "react";
import SearchIcon from "@mui/icons-material/Search";

type IProps = {
  setSearchValue: any;
  label: string;
};
export const SearchBox = ({ setSearchValue, label }: IProps) => {
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
              <Button
                variant="contained"
                color="primary"
                sx={{
                  mr: "-14px",
                  minWidth: "42px",
                  width: "42px",
                  minHeight: "42px",
                  height: "42px",
                }}
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
                    color: "white!important",
                  }}
                />
              </Button>
            </InputAdornment>
          }
        />
      )}
    </FormControl>
  );
};
