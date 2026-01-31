import {
  Box,
  CircularProgress,
  FormControl,
  IconButton,
  InputAdornment,
  OutlinedInput,
  Tooltip,
} from "@mui/material";
import React from "react";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";

type IProps = {
  setSearch: (value: string) => void;
  search: string;
  label: string;
  glowSearchBox?: boolean;
  sx?: any;
  onSearch?: () => void;
  loading?: boolean;
};

export const SearchBox = ({
  setSearch,
  search,
  label,
  glowSearchBox,
  sx,
  onSearch,
  loading = false,
}: IProps) => {
  const handleSidebarClose = () => {
    const element = document.getElementById(
      "notebook-sidebar-view",
    ) as HTMLElement;
    if (element) {
      element.style.left = "-1000px";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    console.log("[SEARCH BOX] Key pressed:", e.key, "search value:", search);
    if (e.key === "Enter") {
      if (onSearch && search.trim().length >= 3) {
        console.log("[SEARCH BOX] Calling onSearch callback");
        onSearch();
      } else {
        console.log("[SEARCH BOX] Enter pressed but conditions not met:", {
          hasOnSearch: !!onSearch,
          searchLength: search.trim().length,
        });
      }
      handleSidebarClose();
    }
  };

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
      <OutlinedInput
        placeholder={label}
        sx={inputStyles}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={handleKeyDown}
        startAdornment={
          <InputAdornment position="start">
            <SearchIcon
              sx={{
                color: (theme) =>
                  glowSearchBox
                    ? "rgba(0, 255, 0, 0.6)"
                    : theme.palette.mode === "dark"
                      ? "white!important"
                      : "gray",
              }}
            />
          </InputAdornment>
        }
        endAdornment={
          search && (
            <InputAdornment position="end" sx={{ p: "10px" }}>
              <Box sx={{ display: "flex", alignItems: "center", p: 1 }}>
                {onSearch && (
                  <Tooltip title={loading ? "" : "Search in the Ontology"}>
                    <IconButton
                      onClick={() => {
                        console.log(
                          "[SEARCH BOX] Search button clicked, search value:",
                          search,
                        );
                        if (search.trim().length >= 3) {
                          console.log(
                            "[SEARCH BOX] Calling onSearch callback from button",
                          );
                          onSearch();
                          handleSidebarClose();
                        } else {
                          console.log(
                            "[SEARCH BOX] Search value too short:",
                            search.trim().length,
                          );
                        }
                      }}
                      color="primary"
                      edge="end"
                      disabled={loading || search.trim().length < 3}
                    >
                      {loading ? (
                        <CircularProgress
                          size={20}
                          sx={{
                            color: (theme) =>
                              glowSearchBox
                                ? "rgba(0, 255, 0, 0.6)"
                                : theme.palette.mode === "dark"
                                  ? "white!important"
                                  : "gray",
                          }}
                        />
                      ) : (
                        <SearchIcon />
                      )}
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title={"Clear"}>
                  <IconButton
                    onClick={() => {
                      setSearch("");
                    }}
                    edge="end"
                    sx={{ color: "white", ml: "13px" }}
                  >
                    <CloseIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </InputAdornment>
          )
        }
      />
    </FormControl>
  );
};
