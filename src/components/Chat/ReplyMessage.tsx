import React, { useRef } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import dayjs from "dayjs";
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
    <Box ref={boxRef} key={index} sx={{ display: "flex", pt: 1.5, gap: 1 }}>
      <Box
        sx={{
          width: "34px",
          height: "34px",
          cursor: "pointer",
          borderRadius: "50%",
          flexShrink: 0,
        }}
      >
        <OptimizedAvatar
          alt={reply.senderDetail?.fullname || ""}
          imageUrl={reply.senderDetail?.imageUrl || ""}
          size={32}
          sx={{ border: "none" }}
        />
      </Box>
      <Box sx={{ width: "100%" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            mb: 0.4,
          }}
        >
          <Box sx={{ display: "flex" }}>
            <Typography
              sx={{ fontSize: "0.95rem", fontWeight: 700, lineHeight: 1.2 }}
            >
              {reply.senderDetail.fullname}
            </Typography>
          </Box>
          <Typography
            sx={(theme) => ({
              fontSize: "0.74rem",
              color:
                theme.palette.mode === "dark"
                  ? "rgba(255,255,255,0.62)"
                  : "rgba(21,31,46,0.52)",
            })}
          >
            {dayjs(new Date(reply.createdAt.toDate())).fromNow()}
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
              fontSize: "14px",
              fontWeight: "400",
              lineHeight: "20px",
              p: "10px 12px",
              borderRadius: "14px",
              border: "none",
              background: (theme) =>
                theme.palette.mode === "dark"
                  ? "linear-gradient(145deg, rgba(30, 32, 36, 0.95), rgba(22, 23, 27, 0.95))"
                  : "linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(245, 248, 252, 0.98))",
              boxShadow: (theme) =>
                theme.palette.mode === "dark"
                  ? "0 8px 16px rgba(0,0,0,0.18)"
                  : "0 7px 16px rgba(15,28,59,0.06)",
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
                  fontSize: "13px",
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
                      borderRadius: "10px",
                      objectFit: "cover",
                      cursor: "pointer",
                      border: "1px solid rgba(255,255,255,0.08)",
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
                gap: "6px",
                paddingTop: "7px",
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
              <IconButton
                size="small"
                onClick={(e) => toggleEmojiPicker(e, boxRef, reply)}
                sx={(theme) => ({
                  borderRadius: 999,
                  border:
                    theme.palette.mode === "dark"
                      ? "1px solid rgba(255,255,255,0.14)"
                      : "1px solid rgba(18,30,60,0.16)",
                })}
              >
                <AddReactionOutlined
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
