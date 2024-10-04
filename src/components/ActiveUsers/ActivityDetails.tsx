import {
  getChangeDescription,
  getModifiedAt,
} from " @components/lib/utils/helpers";
import { NodeChange } from " @components/types/INode";
import { Box, Typography, Paper, Button } from "@mui/material";
import OptimizedAvatar from "../Chat/OptimizedAvatar";

const ActivityDetails = ({
  activity,
  displayDiff,
  modifiedByDetails,
}: {
  activity: NodeChange;
  displayDiff: Function;
  modifiedByDetails?: any;
}) => {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", mt: "8px" }}>
      <Typography
        sx={{
          fontSize: "12px",
          fontWeight: "600",
          ml: "auto",
          mr: 5,
          color: "text.secondary",
        }}
      >
        {getModifiedAt(activity.modifiedAt)}
      </Typography>

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
            boxShadow: "0px 6px 20px rgba(0, 0, 0, 0.15)",
          },
        }}
      >
        {modifiedByDetails && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              position: "absolute",
              top: 12,
              left: 12,
            }}
          >
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

            <Typography
              sx={{
                marginLeft: 1,
                fontSize: "14px",
                color: "text.primary",
              }}
            >
              {modifiedByDetails.fName} {modifiedByDetails.lName}
            </Typography>
          </Box>
        )}

        <Button
          onClick={() => displayDiff(activity)}
          variant="outlined"
          sx={{
            borderRadius: "20px",
            position: "absolute",
            top: 12,
            right: 12,
            padding: "4px 12px",
            fontSize: "12px",
          }}
        >
          View
        </Button>

        <Box
          sx={{
            paddingBottom: 4,
            paddingLeft: 2,
            paddingTop: modifiedByDetails ? 9 : 4,
          }}
        >
          <Typography
            variant="body2"
            sx={{ fontSize: "13px", mt: 2, mb: 1.5, color: "text.secondary" }}
          >
            {getChangeDescription(activity, "")}
          </Typography>

          <Typography
            variant="h6"
            sx={{
              fontWeight: "bold",
              fontSize: "16px",
              wordWrap: "break-word",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {activity.fullNode.title}
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default ActivityDetails;
