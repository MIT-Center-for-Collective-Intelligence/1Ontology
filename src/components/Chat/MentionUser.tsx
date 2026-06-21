import { Box, Typography, useTheme } from "@mui/material";
import OptimizedAvatar from "./OptimizedAvatar";

type UsersTagProps = {
  user: any;
  /** Keyboard / hover highlighted row in the mention list. */
  focused?: boolean;
};

const mentionFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif';

export const MentionUser = ({ user, focused }: UsersTagProps) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const label = user.display ?? user.fullName ?? user.id;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        width: "100%",
        minWidth: 0,
        py: 0.875,
        px: 1.25,
        fontFamily: mentionFont,
        transition: "background-color 0.15s ease",
      }}
    >
      <Box
        sx={{
          position: "relative",
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: "50%",
          "& > .user-image": {
            borderRadius: "50%",
            overflow: "hidden",
            width: 36,
            height: 36,
          },
        }}
      >
        <Box className="user-image">
          <OptimizedAvatar
            alt={user.fullName ?? label}
            size={36}
            imageUrl={user.imageUrl}
            sx={{ border: "none" }}
          />
        </Box>
        <Box
          className="UserStatusOnlineIcon"
          sx={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: 10,
            height: 10,
            borderRadius: "50%",
            boxSizing: "border-box",
            border: "2px solid",
            borderColor: isDark ? "rgba(44, 44, 46, 0.95)" : "rgba(255, 255, 255, 0.95)",
            backgroundColor: "#34C759",
            pointerEvents: "none",
          }}
        />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          component="span"
          sx={{
            display: "block",
            fontSize: 15,
            fontWeight: focused ? 600 : 500,
            letterSpacing: "-0.01em",
            lineHeight: 1.25,
            color: isDark ? "#f5f5f7" : "#1d1d1f",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </Typography>
        {user.fullName &&
          user.display &&
          user.fullName !== user.display && (
            <Typography
              component="span"
              sx={{
                display: "block",
                mt: 0.125,
                fontSize: 12,
                fontWeight: 400,
                letterSpacing: "-0.006em",
                lineHeight: 1.2,
                color: isDark
                  ? "rgba(245, 245, 247, 0.48)"
                  : "rgba(29, 29, 31, 0.42)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user.fullName}
            </Typography>
          )}
      </Box>
    </Box>
  );
};
