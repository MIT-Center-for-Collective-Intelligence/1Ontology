import { DESIGN_SYSTEM_COLORS } from "@components/lib/theme/colors";
import HistoryIcon from "@mui/icons-material/History";
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
  isExperimentalSearch,
}: {
  openSearchedNode: any;
  searchWithFuse: any;
  lastSearches: any[];
  updateLastSearches: Function;
  skillsFuture: boolean;
  skillsFutureApp: string;
  isExperimentalSearch: boolean;
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
  }, [searchValue, skillsFuture, skillsFutureApp, isExperimentalSearch]);

  const onKeyDown = (event: any) => {
    if (event.key === "Enter") {
      searchQuery();
    }
    if (event.key === "Escape") {
      setSearchValue("");
    }
  };

  const renderListItem = (node: any, lastSearch: boolean = false) => (
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
      {lastSearch && <HistoryIcon sx={{ fontSize: "20px", mr: "7px" }} />}
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
        overflowY: "auto",
        ...SCROLL_BAR_STYLE,
        background: isFocused
          ? theme.palette.mode === "dark"
            ? "black"
            : "white"
          : "",
        borderRadius: "50px",
        ...SCROLL_BAR_STYLE,
        /*         border: isFocused ? "1px solid gray" : "", */
        mt: "5px",
        zIndex: 2,
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
              border: "1px solid gray",
              fontSize: "16px",
              borderRadius: "24px",
              backgroundColor: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(20, 20, 20, 0.6)"
                  : "rgba(255, 255, 255, 0.6)",
              padding: "12px 18px",
              transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
              backdropFilter: "blur(8px)",
              "&:hover": {
                backgroundColor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(255, 255, 255, 0.8)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                transform: "translateY(-1px)",
              },
              "&.Mui-focused": {
                backgroundColor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(0, 0, 0, 0.8)"
                    : "rgba(255, 255, 255, 0.95)",
                boxShadow: (theme) =>
                  theme.palette.mode === "dark"
                    ? `0 0 0 2px ${theme.palette.primary.dark}, 0 8px 30px rgba(0,0,0,0.5)`
                    : `0 0 0 2px ${theme.palette.primary.light}, 0 8px 30px rgba(0,0,0,0.1)`,
                borderColor: "transparent",
                transform: "translateY(-2px)",
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
              >
                <SearchIcon />
              </IconButton>
            ),
            endAdornment: (searchValue || isFocused) && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {searchValue && (
                  <Tooltip title="Search">
                    <IconButton
                      size="small"
                      onClick={searchQuery}
                      sx={{
                        backgroundColor: (theme) => theme.palette.primary.main,
                        color: "white",
                        width: 28,
                        height: 28,
                        "&:hover": {
                          backgroundColor: (theme) =>
                            theme.palette.primary.dark,
                        },
                      }}
                    >
                      <SearchIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                )}
                {searchValue && (
                  <Tooltip title="Clear">
                    <IconButton
                      size="small"
                      onClick={clearSearch}
                      sx={{
                        color: (theme) => theme.palette.text.secondary,
                        width: 28,
                        height: 28,
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
                  </Tooltip>
                )}
              </Box>
            ),
          },
        }}
        sx={{
          p: 2,
          position: "sticky",
          top: 0,
          zIndex: 100,
          backdropFilter: "blur(20px) saturate(180%)",
          borderBottom: "none",
          transition: "background-color 0.3s ease, border-bottom 0.3s ease",
        }}
      />

      {loadingSearchResult && isFocused && (
        <List sx={{ zIndex: 0, pl: "4px" }}>
          {[...Array(100)].map((_, index) => (
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
      )}

      {isListOpen && !loadingSearchResult && !errorSearch && (
        <List sx={{ zIndex: 0 }}>
          {searchResults.length > 0
            ? searchResults.map((node: any) => renderListItem(node))
            : searchValue === "" &&
              lastSearches.length > 0 &&
              lastSearches.map((node) => renderListItem(node, true))}
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
