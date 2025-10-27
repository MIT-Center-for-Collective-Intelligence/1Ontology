import { DISPLAY } from "@components/lib/CONSTANTS";
import {
  capitalizeFirstLetter,
  getTooltipHelper,
} from "@components/lib/utils/string.utils";
import { Paper, Typography, Box, Tooltip, List, ListItem } from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { ICollection } from "@components/types/INode";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";

type CollectionListProps = {
  currentImprovement: any;
  property: string;
  getTitle: any;
};

const VisualizeTheProperty: React.FC<CollectionListProps> = ({
  currentImprovement,
  property,
  getTitle,
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
              {collection.changeType === "sort" && (
                <SwapHorizIcon sx={{ mr: "6px" }} />
              )}
              <Typography
                sx={{
                  fontSize: "20px",
                  fontWeight: 500,
                  fontFamily: "Roboto, sans-serif",
                  minHeight: "5px",
                  textDecoration:
                    collection.change === "removed" &&
                    collection.changeType !== "sort"
                      ? "line-through"
                      : "",
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
            <List sx={{ pl: 2 }}>
              {collection.nodes.map((node: any) => (
                <ListItem
                  key={node.id}
                  id={node.change ? `${node.id}-${property}` : undefined}
                  sx={{ p: 1 }}
                >
                  {node.changeType === "sort" ? (
                    <SwapHorizIcon
                      sx={{
                        color:
                          node.change === "added"
                            ? "green"
                            : node.change === "removed"
                              ? "red"
                              : "",

                        mr: "3px",
                        fontSize: "27px",
                      }}
                    />
                  ) : node.change === "added" ? (
                    <AddIcon
                      sx={{
                        color: "green",
                        mr: "3px",
                        fontSize: "27px",
                      }}
                    />
                  ) : node.change === "removed" ? (
                    <RemoveIcon
                      sx={{
                        color: "red",
                        mr: "3px",
                        fontSize: "27px",
                      }}
                    />
                  ) : (
                    <FiberManualRecordIcon
                      sx={{
                        color:
                          node.change === "added"
                            ? "green"
                            : node.change === "removed"
                              ? "red"
                              : "",
                        fontSize: "15px",
                        mr: "10px",
                        pl: "4px",
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
                    {node.title || getTitle(node.id)}
                  </Typography>

                  {node.optional && (
                    <Tooltip title={"optional"} placement="top">
                      <Typography
                        sx={{ color: "orange", marginLeft: "9px" }}
                      >{`(O)`}</Typography>
                    </Tooltip>
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
                              <Tooltip title={"optional"}>
                                <Typography
                                  sx={{ color: "orange", marginLeft: "9px" }}
                                >{`(O)`}</Typography>
                              </Tooltip>
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
  );
};

export default VisualizeTheProperty;
