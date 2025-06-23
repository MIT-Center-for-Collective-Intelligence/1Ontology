import { DISPLAY } from "@components/lib/CONSTANTS";
import {
  capitalizeFirstLetter,
  getTooltipHelper,
} from "@components/lib/utils/string.utils";
import { Paper, Typography, Box, Tooltip, List, ListItem } from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { ICollection } from "@components/types/INode";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";

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
                backgroundColor:
                  collection.change === "added"
                    ? "green"
                    : collection.change === "removed"
                      ? "red"
                      : "",

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
                  /*    color:
                    collection.change === "removed"
                      ? "red"
                      : collection.change === "added"
                        ? "green"
                        : "", */
                }}
              >
                {collection.collectionName !== "main"
                  ? collection.collectionName
                  : ""}
              </Typography>
              {/* {(collection.change === "removed" ||
                collection.change === "added") && (
                <Tooltip
                  placement="top"
                  title={`Implementing this will ${
                    collection.change === "added" ? "add the new" : "remove"
                  } collection titled ${collection.collectionName}`}
                >
                  <Button
                    sx={{
                      borderRadius: "25px",
                      fontSize: "11px",
                      ml: "15px",
                    }}
                  >
                    Implement
                  </Button>
                </Tooltip>
              )} */}
            </Box>
            <List>
              {collection.nodes.map((node: any) => (
                <ListItem key={node.id}>
                  <DragIndicatorIcon
                    sx={{
                      color:
                        node.change === "added"
                          ? "green"
                          : node.change === "removed"
                            ? "red"
                            : "",
                    }}
                  />
                  {node.changeType === "sort" && (
                    <SwapHorizIcon
                      sx={{
                        color:
                          node.change === "added"
                            ? "green"
                            : node.change === "removed"
                              ? "red"
                              : "",
                        pl: "5px",
                      }}
                    />
                  )}
                  <Typography
                    variant="body1"
                    sx={{
                      textDecoration:
                        node.change === "removed" ? "line-through" : "",
                      color:
                        node.change === "added"
                          ? "green"
                          : node.change === "removed"
                            ? "red"
                            : "",
                    }}
                  >
                    {node.title || getTitle(nodes, node.id)}
                  </Typography>
                  {node.optional && (
                    <span
                      style={{ color: "gray", marginLeft: "9px" }}
                    >{`(optional)`}</span>
                  )}
                </ListItem>
              ))}{" "}
              {collection.collectionName === "main" &&
                currentImprovement.detailsOfChange.addedNonExistentElements
                  ?.length > 0 && (
                  <Box>
                    {currentImprovement.detailsOfChange.addedNonExistentElements.map(
                      (item: string, index: number) => (
                        <ListItem key={item}>
                          <DragIndicatorIcon
                            sx={{
                              color: "green",
                            }}
                          />
                          <Typography
                            key={index}
                            variant="body1"
                            sx={{ color: "green" }}
                          >
                            {item}
                          </Typography>
                          {(currentImprovement.change?.optionalParts || [])
                            .length > 0 &&
                            currentImprovement.change.optionalParts.includes(
                              item,
                            ) && (
                              <span
                                style={{ color: "gray", marginLeft: "9px" }}
                              >{`(optional)`}</span>
                            )}
                        </ListItem>
                      ),
                    )}{" "}
                  </Box>
                )}
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
                DISPLAY[property] ? DISPLAY[property] : property,
              )}
            </Typography>
          </Tooltip>
        </Box>
        {renderValue(currentImprovement.detailsOfChange?.comparison || [])}
      </Box>
    </Paper>
  );
};

export default VisualizeTheProperty;
