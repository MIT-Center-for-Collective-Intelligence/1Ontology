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

const WordNet: React.FC = () => {
  const [query, setQuery] = useState<string>("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [tree, setTree] = useState<TreeApi<TreeData> | null | undefined>(null);

  const handleSearch = async () => {
    if (!query) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response: any = await Post("/wordnetapi", {
        query,
      });
      console.log("response ===>", response);
      setResult(response.hypernymTree);
    } catch (err) {
      setError("Failed to fetch data");
    } finally {
      setLoading(false);
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
      <Box display="flex" flexDirection="column" gap={2} width={400}>
        <Box
          display="flex"
          gap={2}
          sx={{ my: "15px", alignItems: "center", textAlign: "center" }}
        >
          <TextField
            label="Search"
            variant="outlined"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            fullWidth
          />
          <Button variant="contained" onClick={handleSearch} disabled={loading}>
            Search
          </Button>
        </Box>
        {loading && <CircularProgress />}
        {error && <Typography color="error">{error}</Typography>}
      </Box>
      <Box sx={{ width: "100%" }}>{result && renderTree(result)}</Box>
    </Box>
  );
};

export default WordNet;
