import React, { useState, useRef } from "react";
import { Box, Typography, Button } from "@mui/material";
import { CSSTransition } from "react-transition-group";

import LinkIcon from "@mui/icons-material/Link";
import moment from "moment";
import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";
import MarkdownRender from "../Markdown/MarkdownRender";
import { Emoticons } from "./Emoticons";
import { MessageButtons } from "./MessageButtons";
import OptimizedAvatar from "./OptimizedAvatar";
import ChatInput from "./ChatInput";
import dayjs from "dayjs";
import { getTitle } from " @components/lib/utils/string.utils";
import { INode } from " @components/types/INode";

const MessageComponent = ({
  message,
  user,
  editing,
  setEditing,
  users,
  confirmIt,
  toggleEmojiPicker,
  toggleReaction,
  showReplies,
  setShowReplies,
  renderReplies,
  addReply,
  editMessage,
  deleteMessage,
  navigateToNode,
  replies,
  chatType,
  nodes,
  setOpenMedia,
}: {
  message: any;
  user: any;
  editing: any;
  setEditing: any;
  users: any;
  confirmIt: any;
  toggleEmojiPicker: any;
  toggleReaction: any;
  showReplies: any;
  setShowReplies: any;
  renderReplies: any;
  addReply: any;
  editMessage: any;
  deleteMessage: any;
  navigateToNode: any;
  replies: any;
  chatType: string;
  nodes: { [nodeId: string]: INode };
  setOpenMedia: any;
}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const scrolling = useRef<HTMLDivElement>(null);
  const handleDeleteMessage = async () => {
    if (
      await confirmIt(
        "Are you sure you want to delete this message?",
        "Delete",
        "Keep"
      )
    ) {
      const element = document.getElementById(`message-${message.id}`);
      if (element) {
        element.style.borderRadius = "8px";
        element.style.padding = "8px";
        element.style.marginTop = "8px";
        element.style.backgroundColor = "#e91e63";
        element.style.transition = "all 0.5s ease";
        element.style.transform = "scaleY(0.5)";
        element.style.opacity = "0";
      }
      setTimeout(() => {
        deleteMessage(message.id);
      }, 500);
    }
  };

  return (
    <CSSTransition key={message.id} timeout={500} classNames="comment">
      <Box
        ref={boxRef}
        id={`message-${message.id}`}
        sx={{
          display: "flex",
          gap: "10px",
          pt: 5,
        }}
      >
        <Box
          sx={{
            width: "40px",
            height: "40px",
            cursor: "pointer",
            borderRadius: "50%",
          }}
        >
          <OptimizedAvatar
            alt={message.senderDetail.fullname || ""}
            imageUrl={message.senderDetail.imageUrl || ""}
            size={40}
            sx={{ border: "none" }}
          />
        </Box>

        <Box sx={{ width: "90%" }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Box sx={{ display: "flex" }}>
              <Typography
                sx={{
                  fontSize: "16px",
                  fontWeight: "500",
                  lineHeight: "24px",
                }}
              >
                {message.senderDetail.fullname}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: "12px" }}>
              {dayjs(new Date(message.createdAt.toDate()))
                .fromNow()
                .includes("NaN")
                ? "a few minutes ago"
                : `${dayjs(new Date(message.createdAt.toDate())).fromNow()}`}
            </Typography>
          </Box>

          {editing?.id === message.id ? (
            <ChatInput
              message={message}
              user={user}
              type="message"
              onClose={() => setEditing(null)}
              onSubmit={editMessage}
              isEditing
              users={users}
              confirmIt={confirmIt}
              setEditing={setEditing}
              chatType={chatType}
              editing={editing}
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
              {message.messageType === "node" && nodes[message.sharedNodeId] ? (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    p: "10px",
                    borderRadius: "8px",
                    background: (theme) =>
                      theme.palette.mode === "dark"
                        ? message.sender === "You"
                          ? DESIGN_SYSTEM_COLORS.notebookG600
                          : DESIGN_SYSTEM_COLORS.notebookO800
                        : message.sender === "You"
                        ? DESIGN_SYSTEM_COLORS.gray100
                        : DESIGN_SYSTEM_COLORS.orange50,
                    mb: "10px",
                    ":hover": {
                      backgroundColor: "orange",
                      cursor: "pointer",
                    },
                  }}
                  onClick={() => {
                    navigateToNode(message.sharedNodeId);
                  }}
                >
                  <Box
                    sx={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "50%",
                      background: DESIGN_SYSTEM_COLORS.primary600,
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <LinkIcon sx={{ color: DESIGN_SYSTEM_COLORS.gray25 }} />
                  </Box>
                  <Typography sx={{ fontWeight: "500" }}>
                    {getTitle(nodes, message.sharedNodeId)?.substr(0, 40)}
                  </Typography>
                </Box>
              ) : (
                <MarkdownRender
                  text={message.text}
                  sx={{
                    fontSize: "16px",
                    fontWeight: 400,
                    letterSpacing: "inherit",
                  }}
                />
              )}

              <Box
                sx={{
                  pt: 1,
                  display: "flex",
                  gap: "15px",
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                {(message.imageUrls || []).map((imageUrl: any) => (
                  <img
                    width={"100%"}
                    style={{
                      borderRadius: "8px",
                      objectFit: "contain",
                      cursor: "pointer",
                    }}
                    src={imageUrl}
                    alt="comment image"
                    key={imageUrl}
                    onClick={() => setOpenMedia(imageUrl)}
                  />
                ))}
              </Box>

              <Box className="message-buttons" sx={{ display: "none" }}>
                <MessageButtons
                  message={message}
                  handleEditMessage={() => setEditing(message)}
                  handleDeleteMessage={handleDeleteMessage}
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
                }}
              >
                <Emoticons
                  message={message}
                  reactionsMap={message.reactions}
                  toggleEmojiPicker={toggleEmojiPicker}
                  toggleReaction={toggleReaction}
                  user={user}
                  boxRef={boxRef}
                />
              </Box>
              <Button
                onClick={() =>
                  setShowReplies(showReplies !== message.id ? message.id : null)
                }
                style={{ border: "none", fontSize: "14px" }}
              >
                {showReplies === message.id
                  ? "Hide"
                  : message?.totalReplies || null}{" "}
                {message?.totalReplies && message.totalReplies > 1
                  ? "Replies"
                  : "Reply"}
              </Button>
            </Box>
          )}

          {showReplies === message.id && (
            <Box sx={{ mt: "10px" }}>
              {renderReplies(message.id, replies, boxRef)}
              <ChatInput
                user={user}
                type="reply"
                message={message}
                onSubmit={addReply}
                users={users}
                confirmIt={confirmIt}
                setEditing={setEditing}
                chatType={chatType}
                editing={editing}
              />
            </Box>
          )}
          <Box ref={scrolling}></Box>
        </Box>
      </Box>
    </CSSTransition>
  );
};

export default MessageComponent;
