import { Box, Typography, Paper, Button, Tooltip } from "@mui/material";
import OptimizedAvatar from "../Chat/OptimizedAvatar";
import { getChangeDescription } from "@components/lib/utils/helpers";
import { NodeChange } from "@components/types/INode";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import MarkdownRender from "../Markdown/MarkdownRender";
import moment from "moment";

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
  const getToolTip = () => {
    let tooltipText = "";
    const modifiedMoment = moment(activity.modifiedAt.toDate());
    if (modifiedMoment.isSame(moment(), "day")) {
      tooltipText = `Today at ${modifiedMoment.format("h:mm:ss A")}`;
    } else if (modifiedMoment.isSame(moment().subtract(1, "day"), "day")) {
      tooltipText = `Yesterday at ${modifiedMoment.format("h:mm:ss A")}`;
    } else {
      tooltipText = modifiedMoment.format("MMM Do [at] h:mm:ss A");
    }

    return tooltipText;
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        mt: 2,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          position: "relative",
          p: 3,
          mx: 2,
          borderRadius: 3,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          transition: "box-shadow 0.3s ease-in-out",
          "&:hover": {
            boxShadow: "0 12px 32px rgba(0,0,0,0.15)",
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
        {modifiedByDetails && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              mb: 2,
            }}
          >
            <OptimizedAvatar
              alt={`${modifiedByDetails.fName} ${modifiedByDetails.lName}`}
              imageUrl={modifiedByDetails.imageUrl || ""}
              size={40}
              sx={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
            <Box>
              <Typography sx={{ fontWeight: 600 }}>
                {modifiedByDetails.fName} {modifiedByDetails.lName}
              </Typography>
              <Tooltip
                title={getToolTip()}
                placement="top"
                componentsProps={{
                  tooltip: {
                    sx: {
                      backgroundColor: "black",
                      color: "#fff",
                      fontSize: "12px",
                      "& .MuiTooltip-arrow": {
                        color: "black",
                      },
                    },
                  },
                }}
              >
                <Typography
                  sx={{
                    fontSize: "12px",
                    color: "text.secondary",
                    display: "inline",
                    ":hover": {
                      borderBottom: "2px solid gray",
                    },
                  }}
                >
                  {dayjs(new Date(activity.modifiedAt.toDate()))
                    .fromNow()
                    .includes("NaN")
                    ? "a few minutes ago"
                    : `${dayjs(new Date(activity.modifiedAt.toDate())).fromNow()}`}
                </Typography>
              </Tooltip>
              <Typography
                sx={{
                  fontSize: "13px",
                  color: "text.secondary",
                  mt: 0.5,
                }}
              >
                {getChangeDescription(activity, "")}
              </Typography>
            </Box>
          </Box>
        )}

        {!modifiedByDetails && (
          <Typography
            sx={{
              fontSize: "13px",
              color: "text.secondary",
              mb: 2,
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
              setTimeout(() => setIsSelected(false), 500);
            }
          }}
          variant={
            isSelected || selectedDiffNode?.id === activity.id
              ? "contained"
              : "outlined"
          }
          sx={{
            position: "absolute",
            top: 16,
            right: 16,
            borderRadius: 20,
            fontSize: "12px",
            textTransform: "none",
            px: 2,
            py: 0.5,
            backgroundColor:
              isSelected || selectedDiffNode?.id === activity.id
                ? undefined
                : (theme) =>
                    theme.palette.mode === "dark" ? "#29292a" : "#d3d3d3",
          }}
        >
          {isSelected || selectedDiffNode?.id === activity.id
            ? "Unselect"
            : "View"}
        </Button>
        <Box
          sx={{
            mt: modifiedByDetails ? 1 : 0,
          }}
        >
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              fontSize: "18px",
              mb: activity.reasoning ? 2 : 0,
              wordBreak: "break-word",
            }}
          >
            {nodes[activity.nodeId]?.title || activity.fullNode?.title}
          </Typography>

          {activity.reasoning && (
            <Box
              sx={{
                p: 2,
                border: "1px solid #ccc",
                borderRadius: 2,
                backgroundColor: (theme) =>
                  theme.palette.mode === "dark" ? "#424242" : "#f9f9f9",
              }}
            >
              <Typography sx={{ fontWeight: 600, mb: 1 }}>Comments</Typography>
              <MarkdownRender
                text={activity.reasoning}
                sx={{
                  fontSize: "16px",
                  fontWeight: 400,
                  letterSpacing: "inherit",
                }}
              />
              {/*<Typography
                sx={{
                  fontSize: "14px",
                  wordBreak: "break-word",
                }}
              >
                {activity.reasoning}
              </Typography> */}
            </Box>
          )}
        </Box>
        {process.env.NODE_ENV === "development" && (
          <div>
            <ul>
              <li>
                <span style={{ color: "orange" }}>Activity ID:</span>{" "}
                {activity.id}
              </li>
              <li>  
                <span style={{ color: "orange" }}>Node ID:</span>{" "}
                {activity.nodeId}
              </li>
              <li>
                <span style={{ color: "orange" }}>Log LLM ID:</span>{" "}
                {activity.logLLMId}
              </li>
            </ul>
          </div>
        )}
      </Paper>
    </Box>
  );
};

export default ActivityDetails;
