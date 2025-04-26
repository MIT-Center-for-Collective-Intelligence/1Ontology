import React, { useRef } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import moment from "moment";
import OptimizedAvatar from "./OptimizedAvatar";
import { DESIGN_SYSTEM_COLORS } from "@components/lib/theme/colors";
import MarkdownRender from "../Markdown/MarkdownRender";
import { Emoticons } from "./Emoticons";
import { MessageButtons } from "./MessageButtons";
import { IChatMessage } from "@components/types/IChat";
import ChatInput from "./ChatInput";
import { AddReactionOutlined } from "@mui/icons-material";

interface ReplyMessageProps {
  reply: any;
  index: number;
  editing: any;
  messageId: string;
  user: any;
  users: any;
  confirmIt: () => void;
  setEditing: React.Dispatch<React.SetStateAction<any>>;
  editReply: any;
  deleteReply: (messageId: string, replyId: string) => void;
  toggleEmojiPicker: (event: any, boxRef: any, message?: IChatMessage) => void;
  toggleReaction: (comment: IChatMessage, emoji: string) => void;
  chatType: string;
  setOpenMedia: any;
}

const ReplyMessage: React.FC<ReplyMessageProps> = ({
  reply,
  index,
  editing,
  messageId,
  user,
  users,
  confirmIt,
  setEditing,
  editReply,
  deleteReply,
  toggleEmojiPicker,
  toggleReaction,
  chatType,
  setOpenMedia,
}) => {
  const boxRef = useRef(null);
  return (
    <Box ref={boxRef} key={index} sx={{ display: "flex" }}>
      <Box
        sx={{
          width: "40px",
          height: "40px",
          cursor: "pointer",
          borderRadius: "50%",
        }}
      >
        <OptimizedAvatar
          alt={reply.senderDetail?.fullname || ""}
          imageUrl={reply.senderDetail?.imageUrl || ""}
          size={30}
          sx={{ border: "none" }}
        />
      </Box>
      <Box sx={{ width: "90%" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box sx={{ display: "flex" }}>
            <Typography
              sx={{ fontSize: "16px", fontWeight: "500", lineHeight: "24px" }}
            >
              {reply.senderDetail.fullname}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: "12px" }}>
            {moment(reply.createdAt.toDate().getTime()).format("h:mm a")}
          </Typography>
        </Box>
        {editing?.parentMessage === messageId && editing?.id === reply.id ? (
          <ChatInput
            message={reply}
            user={user}
            type="reply"
            onClose={() => setEditing(null)}
            onSubmit={editReply}
            isEditing={true}
            users={users}
            confirmIt={confirmIt}
            editing={editing}
            setEditing={setEditing}
            chatType={chatType}
            placeholder="Share your thoughts..."
          />
        ) : (
          <Box
            className="reply-box"
            sx={{
              position: "relative",
              fontSize: "16px",
              fontWeight: "400",
              lineHeight: "24px",
              p: "10px 14px",
              borderRadius: "9px",
              background: (theme) =>
                theme.palette.mode === "dark"
                  ? DESIGN_SYSTEM_COLORS.notebookG700
                  : DESIGN_SYSTEM_COLORS.gray300,
              ":hover": {
                "& .message-buttons": {
                  display: "block",
                },
              },
            }}
          >
            <Box
              sx={{ fontSize: "16px", fontWeight: "400", lineHeight: "24px" }}
            >
              <MarkdownRender
                text={reply.text}
                sx={{
                  fontSize: "16px",
                  fontWeight: 400,
                  letterSpacing: "inherit",
                }}
              />
              <Box
                sx={{
                  pt: 1,
                  display: "flex",
                  gap: "15px",
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                {(reply.imageUrls || []).map((imageUrl: string) => (
                  <img
                    width={"100%"}
                    style={{
                      borderRadius: "8px",
                      objectFit: "contain",
                      cursor: "pointer",
                    }}
                    src={imageUrl}
                    alt="reply image"
                    key={imageUrl}
                    onClick={() => setOpenMedia(imageUrl)}
                  />
                ))}
              </Box>
            </Box>
            <Box className="message-buttons" sx={{ display: "none" }}>
              <MessageButtons
                message={reply}
                handleEditMessage={() => setEditing(reply)}
                handleDeleteMessage={() => deleteReply(messageId, reply.id)}
                toggleEmojiPicker={toggleEmojiPicker}
                user={user}
                boxRef={boxRef}
              />
            </Box>
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "5px",
                paddingTop: "5px",
              }}
            >
              <Emoticons
                message={reply}
                reactionsMap={reply.reactions}
                toggleEmojiPicker={toggleEmojiPicker}
                toggleReaction={toggleReaction}
                user={user}
                boxRef={boxRef}
              />
              <IconButton onClick={(e) => toggleEmojiPicker(e, boxRef, reply)}>
                <AddReactionOutlined
                  color="secondary"
                  sx={{ fontSize: "19px" }}
                />
              </IconButton>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ReplyMessage;
