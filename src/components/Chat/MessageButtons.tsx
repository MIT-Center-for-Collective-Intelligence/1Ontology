import { DESIGN_SYSTEM_COLORS } from "@components/lib/theme/colors";
import { IChatMessage } from "@components/types/IChat";
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
  toggleEmojiPicker: (event: any, boxRef: any, comment?: any) => void;
  handleEditMessage?: any;
  setInputMessage?: any;
  handleDeleteMessage?: any;
  user: any;
  makeMessageUnread?: (comment: any) => void;
  boxRef: any;
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
  boxRef,
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
        top: "-40px",
        right: "0px",
        borderRadius: "8px",
        p: "3px",
        ...sx,
      }}
    >
      {replyMessage && !message.parentMessage && (
        <Tooltip title={"reply"}>
          <IconButton onClick={replyMessage}>
            <ReplyIcon sx={{ fontSize: "19px" }} />
          </IconButton>
        </Tooltip>
      )}
      {/* <Tooltip title={"react"}>
        <IconButton onClick={(e: any) => toggleEmojiPicker(e, boxRef, message)}>
          <AddReactionIcon color="secondary" sx={{ fontSize: "19px" }} />
        </IconButton>
      </Tooltip> */}
      {!message.parentMessage && makeMessageUnread && (
        <Tooltip title={"unread"}>
          <IconButton onClick={() => makeMessageUnread(message)}>
            <MarkAsUnreadIcon color="secondary" sx={{ fontSize: "19px" }} />
          </IconButton>
        </Tooltip>
      )}
      {/* <Tooltip title={"forward"}>
        <IconButton onClick={handleForwardMessage}>
          <ReplyIcon sx={{ transform: "scaleX(-1)" }} />
        </IconButton>
      </Tooltip> */}
      {isSender && handleEditMessage && (
        <Tooltip title={"Edit message"}>
          <IconButton onClick={handleEditMessage}>
            <EditIcon sx={{ fontSize: "19px" }} />
          </IconButton>
        </Tooltip>
      )}
      {handleDeleteMessage && isSender && (
        <Tooltip title={"Delete message"}>
          <IconButton onClick={handleDeleteMessage}>
            <DeleteIcon sx={{ fontSize: "19px" }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};
