import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";
import { IChatMessage } from " @components/types/IChat";
import AddReactionIcon from "@mui/icons-material/AddReaction";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import MarkAsUnreadIcon from "@mui/icons-material/MarkAsUnread";
import ReplyIcon from "@mui/icons-material/Reply";
import { IconButton, Tooltip } from "@mui/material";
import { Box, SxProps, Theme } from "@mui/system";
import React from "react";
type CommentButtonProps = {
  message: IChatMessage;
  sx?: SxProps<Theme>;
  replyMessage?: (message: any) => void;
  forwardMessage?: (message: any) => void;
  toggleEmojiPicker: (event: any, comment?: any) => void;
  handleEditMessage?: any;
  setInputMessage?: any;
  handleDeleteMessage?: any;
  user: any;
  makeMessageUnread?: (comment: any) => void;
};
export const MessageButtons = ({
  message,
  sx,
  replyMessage,
  toggleEmojiPicker,
  handleEditMessage,
  handleDeleteMessage,
  user,
  makeMessageUnread,
}: CommentButtonProps) => {
  const isSender = user.uname === message.sender;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        position: "absolute",
        background: (theme) =>
          theme.palette.mode === "dark"
            ? DESIGN_SYSTEM_COLORS.notebookG700
            : DESIGN_SYSTEM_COLORS.gray100,
        top: "-46px",
        right: "0px",
        borderRadius: "8px",
        p: "3px",
        ...sx,
      }}
    >
      {replyMessage && !message.parentMessage && (
        <Tooltip title={"reply"}>
          <IconButton onClick={replyMessage}>
            <ReplyIcon />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title={"react"}>
        <IconButton onClick={(e: any) => toggleEmojiPicker(e, message)}>
          <AddReactionIcon color="secondary" />
        </IconButton>
      </Tooltip>
      {!message.parentMessage && makeMessageUnread && (
        <Tooltip title={"unread"}>
          <IconButton onClick={() => makeMessageUnread(message)}>
            <MarkAsUnreadIcon color="secondary" />
          </IconButton>
        </Tooltip>
      )}
      {/* <Tooltip title={"forward"}>
        <IconButton onClick={handleForwardMessage}>
          <ReplyIcon sx={{ transform: "scaleX(-1)" }} />
        </IconButton>
      </Tooltip> */}
      {isSender && handleEditMessage && (
        <Tooltip title={"edit"}>
          <IconButton onClick={handleEditMessage}>
            <EditIcon />
          </IconButton>
        </Tooltip>
      )}
      {handleDeleteMessage && isSender && (
        <Tooltip title={"delete"}>
          <IconButton onClick={handleDeleteMessage}>
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};
