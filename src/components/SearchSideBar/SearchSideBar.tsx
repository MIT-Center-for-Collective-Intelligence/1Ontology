import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";
import {
  Box,
  GlobalStyles,
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
import { SCROLL_BAR_STYLE } from " @components/lib/CONSTANTS";

const SearchSideBar = ({
  openSearchedNode,
  searchWithFuse,
  lastSearches,
  updateLastSearches,
}: {
  openSearchedNode: any;
  searchWithFuse: any;
  lastSearches: any[];
  updateLastSearches: Function;
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
    setIsFocused(true);
    if (searchValue.trim() !== "" || !!lastSearches.length) {
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

  const handleNodeClick = (node: any) => {
    openSearchedNode(node);
    setSearchValue(node.title);
    updateLastSearches(node);
    setIsListOpen(false);
    setIsFocused(false);
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

  const renderListItem = (node: any) => (
    <ListItem
      key={node.id}
      onClick={() => handleNodeClick(node)}
      sx={{
        display: "flex",
        alignItems: "center",
        color: "white",
        cursor: "pointer",
        borderRadius: "4px",
        padding: "8px",
        transition: "background-color 0.3s",
        mt: "5px",
        "&:hover": {
          backgroundColor: (theme) =>
            theme.palette.mode === "dark"
              ? "rgba(255, 255, 255, 0.1)"
              : "rgba(0, 0, 0, 0.1)",
        },
      }}
    >
      <Typography>
        {node.title}
        {!!node.context?.title && ` at ${node.context.title}`}
      </Typography>
    </ListItem>
  );

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
        ...SCROLL_BAR_STYLE,
      }}
    >
      <GlobalStyles
        styles={{
          "& input:-webkit-autofill": {
            boxShadow: `0px 0px 0px 100px ${
              theme.palette.mode === "dark" ? "black" : "white"
            } inset !important`,
            WebkitTextFillColor: `${
              theme.palette.mode === "dark" ? "#fff" : "#000"
            } !important`,
            caretColor: "#fff !important",
            borderRadius: "0 !important",
          },
        }}
      />
      <TextField
        placeholder="Search..."
        value={searchValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        fullWidth
        InputProps={{
          sx: {
            fontSize: "19px",
            borderRadius: "45px",
            background: (theme) =>
              theme.palette.mode === "dark"
                ? "black !important"
                : "white !important",
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
            theme.palette.mode === "dark"
              ? "black !important"
              : "white !important",
          zIndex: 1000,
        }}
      />
      {isListOpen && (
        <List sx={{ zIndex: isListOpen ? 10 : 0 }}>
          {searchResults.length > 0
            ? searchResults.map(renderListItem)
            : searchValue === "" &&
              lastSearches.length > 0 &&
              lastSearches.map(renderListItem)}
        </List>
      )}
    </Box>
  );
};

export default SearchSideBar;
