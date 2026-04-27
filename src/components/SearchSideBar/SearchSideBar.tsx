import HistoryIcon from "@mui/icons-material/History";
import {
  Alert,
  Box,
  GlobalStyles,
  IconButton,
  InputAdornment,
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

import React, { useCallback, useEffect, useRef, useState } from "react";
import { development, SCROLL_BAR_STYLE } from "@components/lib/CONSTANTS";
import { Post } from "@components/lib/utils/Post";

const SearchSideBar = ({
  openSearchedNode,
  searchWithFuse,
  lastSearches,
  updateLastSearches,
  skillsFuture,
  skillsFutureApp,
  isExperimentalSearch,
  onSearchChange,
}: {
  openSearchedNode: any;
  searchWithFuse: any;
  lastSearches: any[];
  updateLastSearches: Function;
  skillsFuture: boolean;
  skillsFutureApp: string;
  isExperimentalSearch: boolean;
  onSearchChange?: (value: string) => void;
}) => {
  const [searchValue, setSearchValue] = useState("");
  const [isListOpen, setIsListOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<any>([]);
  const [loadingSearchResult, setLoadingSearchResult] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [searchRefreshKey, setSearchRefreshKey] = useState(0);
  const [errorSearch, setErrorSearch] = useState(false);

  const theme = useTheme();

  const getSearchResults = (query: string) => {
    return searchWithFuse(query).slice(0, 30);
  };

  const handleFocus = () => {
    setIsFocused(true);

    if (searchValue.trim() !== "") {
      const freshResults = getSearchResults(searchValue.trim());
      if (freshResults.length === 0) {
        setSearchValue("");
        setIsListOpen(!!lastSearches.length);
      } else {
        setSearchRefreshKey((prevKey) => prevKey + 1);
        setIsListOpen(true);
      }
    } else if (lastSearches.length > 0) {
      setIsListOpen(true);
    }

    updateLastSearches();
  };

  const clearSearch = () => {
    setSearchValue("");
    setIsListOpen(false);
    setIsFocused(false);
    if (onSearchChange) onSearchChange("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    if (onSearchChange) onSearchChange(value);
    if (value.trim()) {
      setSearchResults(getSearchResults(value.trim()));
      setIsListOpen(true);
      setIsFocused(true);
    } else {
      setSearchResults([]);
      setIsListOpen(!!lastSearches.length);
      setIsFocused(false);
    }
  };

  const handleNodeClick = (node: any) => {
    openSearchedNode(node);
    setSearchValue(node.title);
    // Outline tree uses this value as react-arborist `searchTerm`; if we don't clear
    // the parent, the typed query keeps filtering and can hide the whole outline.
    if (onSearchChange) onSearchChange("");
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

      const chromaResults: any[] = [...(response.results || [])];
      let combinedResults: any[] = [];

      // if no API results but Fuse has matches, fallback
      if (chromaResults.length <= 0 && fuseSearch.length > 0) {
        chromaResults.push(...fuseSearch);
      }

      // Handle exact match
      const exactResult = fuseSearch[0];
      if (
        exactResult &&
        exactResult.title.trim() === searchValue.toLowerCase().trim() &&
        !chromaResults.some((r: any) => r.id === exactResult.id)
      ) {
        chromaResults.unshift({ id: exactResult.id, title: exactResult.title });
      }

      if (isExperimentalSearch) {
        // Alternate between fuseSearch and chromaResults, avoiding duplicates
        const seen = new Set<string>();
        const maxLength = Math.max(fuseSearch.length, chromaResults.length);

        for (let i = 0; i < maxLength; i++) {
          const fuseItem = fuseSearch[i];
          const chromaItem = chromaResults[i];

          if (fuseItem && !seen.has(fuseItem.id)) {
            combinedResults.push(fuseItem);
            seen.add(fuseItem.id);
          }

          if (chromaItem && !seen.has(chromaItem.id)) {
            combinedResults.push(chromaItem);
            seen.add(chromaItem.id);
          }
        }
      } else {
        combinedResults = development ? fuseSearch : chromaResults;
      }

      setSearchResults(combinedResults);
    } catch (error) {
      setSearchResults(fuseSearch);
      console.error(error);
    } finally {
      setLoadingSearchResult(false);
    }
  }, [
    searchValue,
    searchWithFuse,
    skillsFuture,
    skillsFutureApp,
    isExperimentalSearch,
  ]);

  const onKeyDown = (event: any) => {
    if (event.key === "Enter") {
      searchQuery();
    }
    if (event.key === "Escape") {
      setSearchValue("");
      if (onSearchChange) onSearchChange("");
    }
  };

  const renderListItem = (node: any, lastSearch: boolean = false) => (
    <ListItem
      key={node.id}
      onClick={() => handleNodeClick(node)}
      sx={{
        display: "flex",
        alignItems: "center",
        color: (theme) => theme.palette.text.primary,
        cursor: "pointer",
        borderRadius: "12px",
        px: 1.25,
        py: 1,
        my: 0.25,
        gap: 1,
        whiteSpace: "normal",
        transition: "background-color 0.15s ease",
        "&:hover": {
          backgroundColor: (theme) =>
            theme.palette.mode === "dark"
              ? "rgba(255, 255, 255, 0.08)"
              : "rgba(15, 23, 42, 0.06)",
        },
      }}
    >
      {lastSearch ? (
        <HistoryIcon
          sx={{
            fontSize: 18,
            color: (theme) => theme.palette.text.secondary,
          }}
        />
      ) : (
        <SearchIcon
          sx={{
            fontSize: 18,
            color: (theme) => theme.palette.text.secondary,
          }}
        />
      )}
      <Typography sx={{ fontSize: "0.95rem", lineHeight: 1.35 }}>
        {node.title}
        {!!node.context?.title && ` at ${node.context.title}`}
      </Typography>
    </ListItem>
  );

  const resultsPanelSx = {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: "12px",
    right: "12px",
    zIndex: (theme: any) => theme.zIndex.modal + 1,
    // Tall panel: use most of the viewport so many results are visible (inner list scrolls)
    height: "calc(100vh - 88px)",
    maxHeight: "calc(100vh - 88px)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    py: "8px",
    borderRadius: "18px",
    border: "1px solid",
    borderColor: (theme: any) =>
      theme.palette.mode === "dark"
        ? "rgba(255, 255, 255, 0.12)"
        : "rgba(15, 23, 42, 0.10)",
    backgroundColor: (theme: any) =>
      theme.palette.mode === "dark"
        ? "rgba(20, 20, 20, 0.98)"
        : "rgba(255, 255, 255, 1)",
    boxShadow: (theme: any) =>
      theme.palette.mode === "dark"
        ? "0 18px 44px rgba(0, 0, 0, 0.55)"
        : "0 18px 44px rgba(15, 23, 42, 0.16)",
    backdropFilter: "blur(10px)",
  };

  return (
    <Box
      ref={sidebarRef}
      sx={{
        position: "relative",
        overflow: "visible",
        maxHeight: "fit-content",
        borderRadius: "32px",
        /*         border: isFocused ? "1px solid gray" : "", */
        mt: "5px",
        zIndex: isListOpen || loadingSearchResult ? 1400 : 2,
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
        slotProps={{
          input: {
            sx: {
              border: "1px solid",
              borderColor: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(255, 255, 255, 0.22)"
                  : "rgba(15, 23, 42, 0.16)",
              fontSize: "16px",
              borderRadius: "999px",
              backgroundColor: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(5, 5, 5, 0.86)"
                  : "rgba(255, 255, 255, 0.92)",
              padding: "10px 14px",
              minHeight: "56px",
              transition:
                "background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
              backdropFilter: "blur(12px)",
              "&:hover": {
                backgroundColor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(12, 12, 12, 0.95)"
                    : "rgba(255, 255, 255, 1)",
                borderColor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255, 255, 255, 0.34)"
                    : "rgba(15, 23, 42, 0.24)",
              },
              "&.Mui-focused": {
                backgroundColor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(5, 5, 5, 0.98)"
                    : "rgba(255, 255, 255, 1)",
                boxShadow: (theme) =>
                  theme.palette.mode === "dark"
                    ? `0 0 0 2px ${theme.palette.primary.dark}, 0 10px 30px rgba(0,0,0,0.45)`
                    : `0 0 0 2px ${theme.palette.primary.light}, 0 10px 30px rgba(15,23,42,0.12)`,
                borderColor: (theme) => theme.palette.primary.main,
              },
              "& .MuiOutlinedInput-notchedOutline": {
                border: "none",
              },
              "& input": {
                padding: "0",
                color: (theme) => theme.palette.text.primary,
                fontWeight: 500,
                "&::placeholder": {
                  color: (theme) => theme.palette.text.disabled,
                  opacity: 0.8,
                },
              },
            },
            startAdornment: (
              <InputAdornment position="start" sx={{ mr: 0, ml: 0 }}>
                <IconButton
                  sx={{
                    mr: 1.5,
                    p: 0,
                    cursor: "default",
                    color: (theme) =>
                      theme.palette.mode === "dark"
                        ? "rgba(255,255,255,0.4)"
                        : "rgba(0,0,0,0.4)",
                  }}
                  disableRipple
                  tabIndex={-1}
                >
                  <SearchIcon />
                </IconButton>
              </InputAdornment>
            ),
            /* Always mount end adornment so MUI doesn't tear down the <input> when focus
             * or `searchValue` toggles visibility of these controls (that remount drops focus). */
            endAdornment: (
              <InputAdornment position="end" sx={{ marginRight: 0, maxHeight: "none" }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    width: searchValue.trim() ? "auto" : 0,
                    minWidth: 0,
                    overflow: "hidden",
                  }}
                >
                  <Tooltip title="Search">
                    <span>
                      <IconButton
                        size="small"
                        onClick={searchQuery}
                        disabled={!searchValue.trim()}
                        sx={{
                          backgroundColor: (theme) => theme.palette.primary.main,
                          color: "white",
                          width: 28,
                          height: 28,
                          flexShrink: 0,
                          "&:hover": {
                            backgroundColor: (theme) =>
                              theme.palette.primary.dark,
                          },
                        }}
                      >
                        <SearchIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Clear">
                    <span>
                      <IconButton
                        size="small"
                        onClick={clearSearch}
                        disabled={!searchValue.trim()}
                        sx={{
                          color: (theme) => theme.palette.text.secondary,
                          width: 28,
                          height: 28,
                          flexShrink: 0,
                          "&:hover": {
                            color: (theme) => theme.palette.error.main,
                            backgroundColor: (theme) =>
                              theme.palette.mode === "dark"
                                ? "rgba(255,0,0,0.15)"
                                : "rgba(255,0,0,0.08)",
                          },
                        }}
                      >
                        <CloseIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              </InputAdornment>
            ),
          },
        }}
        sx={{
          px: 1.5,
          py: 1.25,
          position: "relative",
          zIndex: (theme) => theme.zIndex.modal + 2,
          borderBottom: "none",
          transition: "background-color 0.3s ease, border-bottom 0.3s ease",
        }}
      />

      {loadingSearchResult && isFocused && (
        <Box sx={resultsPanelSx}>
          <List
            sx={{
              py: 0,
              px: 1,
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              ...SCROLL_BAR_STYLE,
            }}
          >
            {[...Array(24)].map((_, index) => (
              <ListItem
                key={index}
                sx={{ display: "flex", alignItems: "center" }}
              >
                <Skeleton
                  variant="rounded"
                  height={25}
                  width={`${40 + ((index * 13) % 50)}%`}
                  sx={{ borderRadius: "14px" }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {isListOpen && !loadingSearchResult && !errorSearch && (
        <Box sx={resultsPanelSx}>
          {searchValue === "" && lastSearches.length > 0 && (
            <Typography
              sx={{
                px: 2,
                pb: 0.75,
                flexShrink: 0,
                color: (theme) => theme.palette.text.secondary,
                fontSize: "0.8rem",
                fontWeight: 600,
              }}
            >
              Recent searches
            </Typography>
          )}

          <List
            sx={{
              py: 0,
              px: 1,
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              ...SCROLL_BAR_STYLE,
            }}
          >
            {searchResults.length > 0
              ? searchResults.map((node: any) => renderListItem(node))
              : searchValue === "" &&
                lastSearches.length > 0 &&
                lastSearches.map((node) => renderListItem(node, true))}
          </List>
        </Box>
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
