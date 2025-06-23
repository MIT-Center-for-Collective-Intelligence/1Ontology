import { Box, Typography, Paper, Button } from "@mui/material";
import OptimizedAvatar from "../Chat/OptimizedAvatar";
import { getChangeDescription } from "@components/lib/utils/helpers";
import { NodeChange } from "@components/types/INode";
import dayjs from "dayjs";
import { useEffect, useState } from "react";

const ActivityDetails = ({
  activity,
  displayDiff,
  modifiedByDetails,
  selectedDiffNode,
  nodes,
}: {
  activity: NodeChange;
  displayDiff: Function;
  modifiedByDetails?: any;
  selectedDiffNode: any;
  nodes: { [nodeId: string]: any };
}) => {
  const [isSelected, setIsSelected] = useState(false);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        mt: "8px",
      }}
    >
      <Paper
        elevation={3}
        sx={{
          padding: 2,
          marginX: "15px",
          mt: 0,
          position: "relative",
          borderRadius: "12px",
          boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)",
          transition: "box-shadow 0.3s ease-in-out",
          "&:hover": {
            boxShadow: "0px 16px 40px rgba(0, 0, 0, 0.15)",
          },
          backgroundColor: (theme) =>
            theme.palette.mode === "dark"
              ? isSelected || selectedDiffNode?.id === activity.id
                ? "rgba(173, 216, 230, 0.5)"
                : "#303134"
              : isSelected || selectedDiffNode?.id === activity.id
                ? "rgba(173, 216, 230, 0.5)"
                : "#e9ebf5",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            position: "absolute",
            top: 12,
            left: 12,
          }}
        >
          {modifiedByDetails && (
            <OptimizedAvatar
              alt={modifiedByDetails.fName + " " + modifiedByDetails.lName}
              imageUrl={modifiedByDetails.imageUrl || ""}
              size={40}
              sx={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
          )}

          {modifiedByDetails && (
            <Box
              sx={{
                marginLeft: 1,
                fontSize: "14px",
                color: "text.primary",
              }}
            >
              <Box sx={{ alignItems: "center", display: "flex", gap: "7px" }}>
                <Typography
                  sx={{
                    fontWeight: "bold",
                  }}
                >
                  {modifiedByDetails.fName} {modifiedByDetails.lName}{" "}
                </Typography>
                <Typography
                  sx={{
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "text.secondary",
                  }}
                >
                  {" "}
                  {dayjs(new Date(activity.modifiedAt.toDate()))
                    .fromNow()
                    .includes("NaN")
                    ? "a few minutes ago"
                    : `${dayjs(new Date(activity.modifiedAt.toDate())).fromNow()}`}
                </Typography>
              </Box>
              {modifiedByDetails && (
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: "13px",
                    // mt: 2,
                    // mb: 1.5,
                    mx: "2px",
                    color: "text.secondary",
                  }}
                >
                  {getChangeDescription(activity, "")}
                </Typography>
              )}
            </Box>
          )}
        </Box>
        {!modifiedByDetails && (
          <Typography
            variant="body2"
            sx={{
              fontSize: "13px",
              // mt: 2,
              // mb: 1.5,
              mx: "10px",
              color: "text.secondary",
            }}
          >
            {getChangeDescription(activity, "")}
          </Typography>
        )}
        <Button
          onClick={() => {
            if (isSelected || selectedDiffNode?.id === activity.id) {
              displayDiff(null);
            } else {
              displayDiff(null);
              displayDiff(activity);
              setIsSelected(true);
              setTimeout(() => {
                setIsSelected(false);
              }, 500);
            }
          }}
          variant={
            isSelected || selectedDiffNode?.id === activity.id
              ? "contained"
              : "outlined"
          }
          sx={{
            borderRadius: "20px",
            position: "absolute",
            top: 12,
            right: 12,
            padding: "4px 12px",
            fontSize: "12px",
            ml: "14px",
          }}
        >
          {isSelected || selectedDiffNode?.id === activity.id
            ? "Unselect"
            : "View"}
        </Button>

        <Box
          sx={{
            paddingBottom: 4,
            paddingLeft: 2,
            paddingTop: modifiedByDetails ? 9 : 4,
          }}
        >
          <Typography
            variant="h6"
            sx={{
              fontWeight: "bold",
              fontSize: "20px",
              wordWrap: "break-word",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              mt: "6px",
            }}
          >
            {nodes[activity.nodeId]?.title || activity.fullNode?.title}
            {/* {activity.fullNode?.title} */}
          </Typography>
          {activity.reasoning && (
            <Box
              sx={{
                width: "100%",
                overflow: "hidden",
                wordWrap: "break-word",
                p: 2,
                border: "1px solid gray",
                borderRadius: "17px",
              }}
            >
              <Typography sx={{ fontWeight: "bold" }}>Comments:</Typography>
              <Typography
                sx={{
                  wordWrap: "break-word",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {activity.reasoning}
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default ActivityDetails;
