import {
  Button,
  styled,
  Tooltip,
  tooltipClasses,
  TooltipProps,
  Typography,
} from "@mui/material";
import { Box } from "@mui/system";
import React from "react";
import { IChatMessage, Reaction } from "@components/types/IChat";
import { DESIGN_SYSTEM_COLORS } from "@components/lib/theme/colors";
import { shortenNumber } from "@components/lib/utils/utils";
import { getJoinUsernames } from "@components/lib/utils/string.utils";

type EmoticonsProps = {
  message: IChatMessage;
  reactionsMap: { [emoji: string]: Reaction[] };
  toggleEmojiPicker: (event: any, boxRef: any, message?: IChatMessage) => void;
  toggleReaction: (comment: IChatMessage, emoji: string) => void;
  user: any;
  boxRef: any;
};

export const Emoticons = ({
  message,
  reactionsMap,
  toggleEmojiPicker,
  toggleReaction,
  user,
  boxRef,
}: EmoticonsProps) => {
  if (Array.isArray(reactionsMap)) {
    return;
  }

  const HtmlTooltip = styled(({ className, ...props }: TooltipProps) => (
    <Tooltip {...props} classes={{ popper: className }} />
  ))(({ theme }) => ({
    [`& .${tooltipClasses.tooltip}`]: {
      backgroundColor: theme.palette.mode === "dark" ? "black" : "#f5f5f9",
      color: "rgba(124, 118, 118, 0.87)",
      maxWidth: 220,
      fontSize: theme.typography.pxToRem(12),
      border:
        theme.palette.mode === "dark"
          ? "1px solid #dadde9"
          : "1px solid rgb(18, 18, 20)",
    },
  }));
  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "5px",
      }}
    >
      {Object.entries(reactionsMap).map(
        ([emoji, reactors]: [string, Reaction[]]) => {
          const reactedByCurrentUser =
            reactors.findIndex((c) => c.user === user.uname) !== -1;
          return (
            <HtmlTooltip
              placement="top"
              key={emoji}
              title={
                <Box
                  sx={{
                    textAlign: "center",
                    border: "1psx solid gray",
                    borderRadius: "13px",
                  }}
                >
                  <Typography variant="body2">
                    {getJoinUsernames(reactors, user.uname)}
                    <span style={{ color: "gray" }}>reacted with {emoji}</span>
                  </Typography>
                </Box>
              }
              sx={{
                p: 0,
                borderRadius: "13px",
                "& .MuiTooltip-tooltip": {
                  color: "white",
                  padding: "5px !important",
                  borderRadius: "13px",
                },
              }}
            >
              <Button
                sx={{
                  color: (theme) =>
                    theme.palette.mode === "dark"
                      ? DESIGN_SYSTEM_COLORS.gray100
                      : "#51657a",
                  fontSize: "15px",
                  minWidth: "0",
                  padding: "0px 10px",
                  borderRadius: "12px",
                  border: reactedByCurrentUser ? "1px solid orange" : "",
                  background: (theme) =>
                    theme.palette.mode === "dark"
                      ? DESIGN_SYSTEM_COLORS.notebookG500
                      : reactedByCurrentUser
                        ? "#9cc9ed"
                        : DESIGN_SYSTEM_COLORS.gray300,
                }}
                onClick={() => toggleReaction(message, emoji)}
              >
                {emoji}{" "}
                <span
                  style={{
                    fontWeight: reactedByCurrentUser ? "bold" : "",
                    paddingLeft: "2px",
                  }}
                >
                  {shortenNumber(reactors.length, 2, false)}
                </span>
              </Button>
            </HtmlTooltip>
          );
        },
      )}
      {/* {Object.keys(reactions)?.length > 0 && (
        <IconButton onClick={handleAddReaction}>
          <AddReactionIcon color="secondary" />
        </IconButton>
      )} */}
    </Box>
  );
};
