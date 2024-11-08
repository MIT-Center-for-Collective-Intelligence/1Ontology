import { DISPLAY } from " @components/lib/CONSTANTS";
import {
  capitalizeFirstLetter,
  getTooltipHelper,
} from " @components/lib/utils/string.utils";
import { Paper, Typography, Box, Tooltip, List, ListItem } from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { useEffect, useState } from "react";
import { ICollection } from " @components/types/INode";

type Node = {
  id: string;
};

type Collection = {
  collectionName: string;
  nodes: Node[];
};

type CollectionListProps = {
  currentImprovement: any;
  property: string;
  getTitle: any;
  nodes: any;
};

const VisualizeTheProperty: React.FC<CollectionListProps> = ({
  currentImprovement,
  property,
  getTitle,
  nodes,
}) => {
  const [mergedValue, setMergedValue] = useState([]);
  const [addedLinks, setAddLinks] = useState(new Set());
  const [removedLinks, setRemovedLinks] = useState(new Set());

  useEffect(() => {
    const propertyIdx = currentImprovement.detailsOfChange.findIndex(
      (c: any) => c.modifiedProperty === property
    );
    const newValue = currentImprovement.detailsOfChange[propertyIdx].newValue;

    setAddLinks(
      new Set(currentImprovement.detailsOfChange[propertyIdx].addedLinks)
    );
    setRemovedLinks(
      new Set(currentImprovement.detailsOfChange[propertyIdx].removedLinks)
    );
    const previousValue =
      currentImprovement.detailsOfChange[propertyIdx].previousValue;

    for (let collection of newValue) {
      const collectionIdx = previousValue.findIndex(
        (c: ICollection) => c.collectionName === collection.collectionName
      );
      if (collectionIdx === -1) {
        collection.change = "added";
      }
    }
    for (let collection of previousValue) {
      const collectionIdx = newValue.findIndex(
        (c: ICollection) => c.collectionName === collection.collectionName
      );
      if (collectionIdx === -1) {
        newValue.push(collection);
        collection.change = "removed";
      }
    }
    setMergedValue(newValue);
  }, [currentImprovement]);

  const renderValue = (value: ICollection[]) => {
    return (
      <Box sx={{ display: "flex", flexDirection: "column" }}>
        {(value || [])?.map((collection: any) => (
          <Paper
            key={collection.collectionName}
            sx={{
              m: "15px",
              borderRadius: "20px",
            }}
            elevation={5}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                background: (theme: any) =>
                  theme.palette.mode === "dark" ? "#242425" : "#d0d5dd",
                borderTopLeftRadius: "20px",
                borderTopRightRadius: "20px",
                m: 0,
                p: 2,
                // gap: "10px",
              }}
            >
              <Typography
                sx={{
                  fontSize: "20px",
                  fontWeight: 500,
                  fontFamily: "Roboto, sans-serif",
                  minHeight: "5px",
                  textDecoration:
                    collection.change === "removed" ? "line-through" : "",
                  color: collection.change === "removed" ? "red" : "green",
                }}
              >
                {collection.collectionName !== "main"
                  ? collection.collectionName
                  : ""}
              </Typography>
            </Box>
            <List>
              {collection.nodes.map((node: any) => (
                <ListItem key={node.id}>
                  <DragIndicatorIcon
                    sx={{
                      color: addedLinks.has(node.id)
                        ? "green"
                        : removedLinks.has(node.id)
                        ? "red"
                        : "",
                    }}
                  />
                  <Typography
                    variant="body1"
                    sx={{
                      textDecoration: removedLinks.has(node.id)
                        ? "line-through"
                        : "",
                      color: addedLinks.has(node.id)
                        ? "green"
                        : removedLinks.has(node.id)
                        ? "red"
                        : "",
                    }}
                  >
                    {getTitle(nodes, node.id)}
                  </Typography>
                </ListItem>
              ))}
            </List>
          </Paper>
        ))}
      </Box>
    );
  };
  return (
    <Paper
      elevation={9}
      sx={{
        borderRadius: "30px",
        borderBottomRightRadius: "18px",
        borderBottomLeftRadius: "18px",
        minWidth: "500px",
        width: "100%",
        minHeight: "150px",
        maxHeight: "100%",
        overflow: "auto",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box gap={2}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            background: (theme: any) =>
              theme.palette.mode === "dark" ? "#242425" : "#d0d5dd",
            p: 3,
          }}
        >
          <Tooltip title={getTooltipHelper(property)}>
            <Typography
              sx={{
                fontSize: "20px",
                fontWeight: 500,
                fontFamily: "Roboto, sans-serif",
                color: "orange",
              }}
            >
              {capitalizeFirstLetter(
                DISPLAY[property] ? DISPLAY[property] : property
              )}
            </Typography>
          </Tooltip>
        </Box>
        {renderValue(mergedValue)}
      </Box>
    </Paper>
  );
};

export default VisualizeTheProperty;
