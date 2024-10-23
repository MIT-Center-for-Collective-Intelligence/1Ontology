import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";
import {
  Box,
  IconButton,
  List,
  ListItem,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";

import React, { useEffect, useMemo, useRef, useState } from "react";

const SearchSideBar = ({
  openSearchedNode,
  searchWithFuse,
}: {
  openSearchedNode: any;
  searchWithFuse: any;
}) => {
  const [searchValue, setSearchValue] = useState("");
  const [isListOpen, setIsListOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  const searchResults = useMemo(() => {
    /*  recordLogs({
      action: "Searched",
      query: searchValue,
    }); */
    return searchWithFuse(searchValue);
  }, [searchValue]);

  const handleFocus = () => {
    if (searchValue.trim() !== "") {
      setIsFocused(true);
      setIsListOpen(true);
    }
  };

  const clearSearch = () => {
    setSearchValue("");
    setIsListOpen(false);
    setIsFocused(false);
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (searchValue.trim() === "") {
        setIsFocused(false);
        setIsListOpen(false);
      }
    }, 100);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    if (value.trim()) {
      setIsListOpen(true);
      setIsFocused(true);
    } else {
      setIsListOpen(false);
      setIsFocused(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setIsFocused(false);
        setIsListOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <Box
      ref={sidebarRef}
      sx={{
        overflow: "auto",
        height: isFocused ? "100vh" : "",
        position: "relative",
        zIndex: isFocused ? 1000 : "",
        background: isFocused
          ? theme.palette.mode === "dark"
            ? "black"
            : "white"
          : "",
      }}
    >
      <TextField
        placeholder="Search..."
        value={searchValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        fullWidth
        InputProps={{
          style: {
            fontSize: "19px",
            borderRadius: "45px",
          },
          startAdornment: (
            <IconButton
              sx={{ mr: "5px", cursor: "auto" }}
              color="primary"
              edge="end"
            >
              <SearchIcon />
            </IconButton>
          ),
          endAdornment: searchValue && (
            <IconButton
              sx={{ mr: "5px" }}
              onClick={clearSearch}
              color="primary"
              edge="end"
            >
              <CloseIcon />
            </IconButton>
          ),
        }}
        sx={{
          p: "8px",
          position: "sticky",
          top: "0px",
          background: (theme) =>
            theme.palette.mode === "dark" ? "black" : "white",
          zIndex: 1000,
        }}
      />
      {isListOpen && searchResults.length > 0 && (
        <List sx={{ zIndex: isListOpen ? 10 : 0 }}>
          {searchResults.map((node: any) => (
            <ListItem
              key={node.id}
              onClick={() => {
                openSearchedNode(node);
                setSearchValue(node.title);
                setIsListOpen(false);
                setIsFocused(false);
              }}
              sx={{
                display: "flex",
                alignItems: "center",
                color: "white",
                cursor: "pointer",
                borderRadius: "4px",
                padding: "8px",
                transition: "background-color 0.3s",
                // border: "1px solid #ccc",
                mt: "5px",
                "&:hover": {
                  backgroundColor: (theme) =>
                    theme.palette.mode === "dark"
                      ? DESIGN_SYSTEM_COLORS.notebookG450
                      : "white",
                },
              }}
            >
              <Typography>
                {node.title}
                {!!node.context?.title && ` at ${node.context.title}`}
              </Typography>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

export default SearchSideBar;
