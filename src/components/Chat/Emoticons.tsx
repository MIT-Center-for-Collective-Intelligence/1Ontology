import { Button, Tooltip, Typography } from "@mui/material";
import { Box } from "@mui/system";
import React, { useEffect, useState } from "react";
import { IChatMessage, Reaction } from " @components/types/IChat";
import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";
import { shortenNumber } from " @components/lib/utils/utils";
import { getJoinUsernames } from " @components/lib/utils/string.utils";

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
  if (message.id === "KrdzjY33okG5Z9mGuBBo") {
    console.log(reactionsMap, "reactionsMap ==>", user);
  }
  const handleAddReaction = (e: any) => toggleEmojiPicker(e, boxRef, message);

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
            <Tooltip
              placement="top"
              key={emoji}
              title={
                <Box sx={{ textAlign: "center" }}>
                  <Typography variant="body2">
                    {getJoinUsernames(reactors, user.uname)}
                    <span style={{ color: "black" }}>reacted with {emoji}</span>
                  </Typography>
                </Box>
              }
              sx={{
                "& .MuiTooltip-tooltip": {
                  backgroundColor: "black",
                  color: "white",
                },
              }}
            >
              <Button
                sx={{
                  color: (theme) =>
                    theme.palette.mode === "dark"
                      ? DESIGN_SYSTEM_COLORS.gray100
                      : DESIGN_SYSTEM_COLORS.notebookG700,
                  fontSize: "15px",
                  minWidth: "0",
                  padding: "0px 10px",
                  borderRadius: "12px",
                  border: reactedByCurrentUser ? "1px solid orange" : "",
                  background: (theme) =>
                    theme.palette.mode === "dark"
                      ? DESIGN_SYSTEM_COLORS.notebookG500
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
            </Tooltip>
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
