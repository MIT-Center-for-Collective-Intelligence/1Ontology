import { useState } from "react";
import {
  TextField,
  Button,
  Typography,
  CircularProgress,
  Box,
} from "@mui/material";
import { Post } from " @components/lib/utils/Post";
import { TreeData } from " @components/types/INode";
import { TreeApi } from "react-arborist";
import { capitalizeFirstLetter } from " @components/lib/utils/string.utils";

const WordNet: React.FC = () => {
  const [query, setQuery] = useState<string>("");
  const [result, setResult] = useState<any>(null);
  const [resultParts, setResultParts] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState("");

  const handleSearch = async () => {
    if (!query) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response: any = await Post("/wordnetapi", {
        query,
      });

      setResult(response.hypernymTree || []);
      setResultParts(response.partsTree || []);
      setLastQuery(query);
    } catch (err) {
      console.log(err, "err");
      setError(`No synsets found`);
    } finally {
      setLoading(false);
    }
  };
  const onkeydown = (event: any) => {
    if (event.key === "Enter") {
      handleSearch();
    }
  };
  const renderTree = (nodes: TreeData[]) => {
    return (
      <ul>
        {nodes.map((node) => (
          <li key={node.id}>
            <Typography>{node.name}</Typography>
            {node.children && node.children.length > 0 && (
              <Box pl={2}>{renderTree(node.children)}</Box>
            )}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <Box>
      {" "}
      <Box display="flex" justifyContent="center" width="100%">
        <Box
          display="flex"
          flexDirection="column"
          gap={2}
          width={400}
          alignItems="center"
        >
          <Box
            display="flex"
            gap={2}
            sx={{
              my: "15px",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            <Typography sx={{ width: "400px", fontSize: "20px" }}>
              WordNet exploration:
            </Typography>
            <TextField
              label="Search"
              variant="outlined"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              fullWidth
              onKeyDown={onkeydown}
            />
            <Button
              variant="contained"
              onClick={handleSearch}
              disabled={loading}
            >
              Search
            </Button>
          </Box>
          {loading && <CircularProgress />}
          {error && (
            <Box sx={{ display: "flex" }}>
              <Typography color="error">{error}</Typography>
            </Box>
          )}
        </Box>
      </Box>
      {result && (
        <Typography sx={{ my: "5px", fontSize: "25px", ml: "14px" }}>
          Hypernym Tree (is a relationships) for{" "}
          {capitalizeFirstLetter(lastQuery)}
        </Typography>
      )}
      {result && <Box sx={{ width: "100%" }}>{renderTree(result)}</Box>}
      {resultParts && (
        <Typography sx={{ my: "5px", fontSize: "25px", ml: "14px" }}>
          Part-Of Trees for nodes in the Hypernym Tree{" "}
        </Typography>
      )}
      {resultParts && (
        <Box sx={{ width: "100%" }}>{renderTree(resultParts)}</Box>
      )}
    </Box>
  );
};

export default WordNet;
