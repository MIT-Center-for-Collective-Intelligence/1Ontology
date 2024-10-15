import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";
import {
  Box,
  IconButton,
  List,
  ListItem,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

import React, { useMemo, useState } from "react";

const SearchSideBar = ({
  openSearchedNode,
  searchWithFuse,
}: {
  openSearchedNode: any;
  searchWithFuse: any;
}) => {
  const [searchValue, setSearchValue] = useState("");

  const searchResults = useMemo(() => {
    /*  recordLogs({
      action: "Searched",
      query: searchValue,
    }); */
    return searchWithFuse(searchValue);
  }, [searchValue]);

  return (
    <Box sx={{ pl: "10px", overflow: "auto", height: "90vh" }}>
      <TextField
        variant="standard"
        placeholder="Search..."
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        fullWidth
        InputProps={{
          startAdornment: (
            <IconButton
              sx={{ mr: "5px", cursor: "auto" }}
              color="primary"
              edge="end"
            >
              <SearchIcon />
            </IconButton>
          ),
        }}
        autoFocus
        sx={{
          p: "8px",
          mt: "5px",
          position: "sticky",
          top: "0px",
          background: (theme) =>
            theme.palette.mode === "dark"
              ? "black"
              : DESIGN_SYSTEM_COLORS.gray200,
          zIndex: 1000,
        }}
      />
      <List>
        {searchResults.map((node: any) => (
          <ListItem
            key={node.id}
            onClick={() => openSearchedNode(node)}
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
                    : DESIGN_SYSTEM_COLORS.gray200,
              },
            }}
          >
            <Typography>{node.title}</Typography>
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default SearchSideBar;
