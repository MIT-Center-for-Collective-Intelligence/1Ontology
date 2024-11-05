import { DISPLAY } from " @components/lib/CONSTANTS";
import {
  capitalizeFirstLetter,
  getTooltipHelper,
} from " @components/lib/utils/string.utils";
import {
  Paper,
  Typography,
  Box,
  Tooltip,
  List,
  ListItem,
  ListItemIcon,
} from "@mui/material";
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
  const [newValue, setNewValue] = useState<ICollection[]>([]);
  const [oldValue, setOldValue] = useState<ICollection[]>([]);
  useEffect(() => {
    const propertyIdx = currentImprovement.detailsOfChange.findIndex(
      (c: any) => c.modifiedProperty === property
    );
    if (propertyIdx !== -1) {
      setOldValue(
        currentImprovement.detailsOfChange[propertyIdx].previousValue
      );
    }
    if (propertyIdx !== -1) {
      setNewValue(currentImprovement.detailsOfChange[propertyIdx].newValue);
    }
  }, [currentImprovement]);
  const renderValue = (value: ICollection[], changeType: string) => {
    return (
      <Box sx={{ display: "flex", flexDirection: "column" }}>
        {(value || [])?.map((collection) => (
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
                    changeType === "removed" ? "line-through" : "",
                  color: changeType === "removed" ? "red" : "green",
                }}
              >
                {collection.collectionName !== "main"
                  ? collection.collectionName
                  : ""}
              </Typography>
            </Box>
            <List>
              {collection.nodes.map((node) => (
                <ListItem key={node.id}>
                  <DragIndicatorIcon
                    sx={{ color: changeType === "removed" ? "red" : "green" }}
                  />
                  <Typography
                    variant="body1"
                    sx={{
                      textDecoration:
                        changeType === "removed" ? "line-through" : "",
                      color: changeType === "removed" ? "red" : "green",
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
        {renderValue(newValue, "added")}
        {renderValue(oldValue, "removed")}
      </Box>
    </Paper>
  );
};

export default VisualizeTheProperty;
