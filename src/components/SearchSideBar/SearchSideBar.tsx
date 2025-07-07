import { DESIGN_SYSTEM_COLORS } from "@components/lib/theme/colors";
import {
  Alert,
  Box,
  GlobalStyles,
  IconButton,
  List,
  ListItem,
  Skeleton,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { development, SCROLL_BAR_STYLE } from "@components/lib/CONSTANTS";
import { Post } from "@components/lib/utils/Post";

const SearchSideBar = ({
  openSearchedNode,
  searchWithFuse,
  lastSearches,
  updateLastSearches,
  skillsFuture,
  skillsFutureApp,
}: {
  openSearchedNode: any;
  searchWithFuse: any;
  lastSearches: any[];
  updateLastSearches: Function;
  skillsFuture: boolean;
  skillsFutureApp: string;
}) => {
  const [searchValue, setSearchValue] = useState("");
  const [isListOpen, setIsListOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearchResult, setLoadingSearchResult] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [searchRefreshKey, setSearchRefreshKey] = useState(0);
  const [errorSearch, setErrorSearch] = useState(false);

  const theme = useTheme();

  const getSearchResults = (query: string) => {
    return searchWithFuse(query).slice(0, 30);
  };

  // const searchResults = useMemo(() => {
  //   /*  recordLogs({
  //     action: "Searched",
  //     query: searchValue,
  //   }); */
  //   if (!searchValue.trim()) {
  //     return [];
  //   }
  //   return getSearchResults(searchValue);
  // }, [searchValue, searchRefreshKey]);

  const handleFocus = () => {
    setIsFocused(true);

    if (searchValue.trim() !== "") {
      // Force a fresh search to verify if the node still exists
      const freshResults = getSearchResults(searchValue.trim());

      if (freshResults.length === 0) {
        setSearchValue("");
        setIsListOpen(!!lastSearches.length);
      } else {
        // Force a re-render to update the search results
        setSearchRefreshKey((prevKey) => prevKey + 1);
        setIsListOpen(true);
      }
    } else if (lastSearches.length > 0) {
      // Display last searches if no current search value
      setIsListOpen(true);
    }

    updateLastSearches();
  };

  const clearSearch = () => {
    setSearchValue("");
    setIsListOpen(false);
    setIsFocused(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    if (value.trim()) {
      setIsListOpen(true);
      setIsFocused(true);
    } else {
      setIsListOpen(!!lastSearches.length);
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

  const searchQuery = useCallback(async () => {
    const fuseSearch = searchWithFuse(searchValue).slice(0, 30);

    try {
      setErrorSearch(false);
      setLoadingSearchResult(true);
      const response: any = !development
        ? await Post("/searchChroma", {
            query: searchValue,
            skillsFuture,
            appName: skillsFuture ? skillsFutureApp : null,
          })
        : { results: [] };

      const results: any = [...(response.results || [])];

      const existAlready =
        fuseSearch.length > 0
          ? results.findIndex((c: { id: string }) => {
              return c.id === fuseSearch[0].id;
            })
          : -1;
      if (existAlready === -1 && fuseSearch.length > 0) {
        results.unshift(fuseSearch[0]);
      }

      setSearchResults(development ? fuseSearch : results);
    } catch (error) {
      setSearchResults(fuseSearch);
      console.error(error);
      // setErrorSearch(true);
    } finally {
      setLoadingSearchResult(false);
    }
  }, [searchValue, skillsFuture, skillsFutureApp]);

  const onKeyDown = (event: any) => {
    if (event.key === "Enter") {
      searchQuery();
    }
  };
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
        onKeyDown={onKeyDown}
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
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Tooltip title={"Search in the Ontology"}>
                <IconButton
                  sx={{ mr: "5px" }}
                  onClick={searchQuery}
                  color="primary"
                  edge="end"
                >
                  <SearchIcon />
                </IconButton>
              </Tooltip>{" "}
              <IconButton
                sx={{ mr: "5px" }}
                onClick={clearSearch}
                color="primary"
                edge="end"
              >
                <CloseIcon />
              </IconButton>
            </Box>
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
      {loadingSearchResult && (
        <List sx={{ zIndex: 10 }}>
          {[...Array(15)].map((_, index) => (
            <Box key={index} sx={{ px: 4, mt: "0px" }}>
              <Skeleton variant="text" height={55} width="100%" sx={{ p: 0 }} />
            </Box>
          ))}
        </List>
      )}

      {isListOpen && !loadingSearchResult && !errorSearch && (
        <List sx={{ zIndex: isListOpen ? 10 : 0 }}>
          {searchResults.length > 0
            ? searchResults.map(renderListItem)
            : searchValue === "" &&
              lastSearches.length > 0 &&
              lastSearches.map(renderListItem)}
        </List>
      )}
      {errorSearch && isListOpen && (
        <Alert severity="error">
          There was an error searching through the ontology.
        </Alert>
      )}
    </Box>
  );
};

export default SearchSideBar;
