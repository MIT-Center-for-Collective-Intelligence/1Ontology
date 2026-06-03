import React, { useState, useRef, useEffect, useMemo } from "react";
import { Box, Typography, Button, IconButton, CircularProgress } from "@mui/material";
import { CSSTransition } from "react-transition-group";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

import LinkIcon from "@mui/icons-material/Link";
import { DESIGN_SYSTEM_COLORS } from "@components/lib/theme/colors";
import MarkdownRender from "../Markdown/MarkdownRender";
import { Emoticons } from "./Emoticons";
import { MessageButtons } from "./MessageButtons";
import OptimizedAvatar from "./OptimizedAvatar";
import ChatInput from "./ChatInput";
import dayjs from "dayjs";
import { getTitle } from "@components/lib/utils/string.utils";
import { INode } from "@components/types/INode";
import { AddReactionOutlined } from "@mui/icons-material";

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
  relatedNodes,
  fetchNode,
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
  relatedNodes: { [nodeId: string]: INode };
  fetchNode: (nodeId: string) => Promise<INode | null>;
  setOpenMedia: any;
}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const scrolling = useRef<HTMLDivElement>(null);
  const [sharedNode, setSharedNode] = useState<INode | null>(null);
  const [loadingSharedNode, setLoadingSharedNode] = useState(false);
  const createdAtLabel = useMemo(() => {
    if (!message.createdAt) return "";
    const fromNow = dayjs(new Date(message.createdAt.toDate())).fromNow();
    return fromNow.includes("NaN") ? "a few minutes ago" : fromNow;
  }, [message.createdAt]);

  // Fetch shared node if not in cache
  useEffect(() => {
    if (message.messageType === "node" && message.sharedNodeId) {
      const cachedNode = relatedNodes[message.sharedNodeId];
      if (cachedNode) {
        setSharedNode(cachedNode);
        setLoadingSharedNode(false);
      } else {
        setLoadingSharedNode(true);
        fetchNode(message.sharedNodeId).then((fetchedNode) => {
          setSharedNode(fetchedNode);
          setLoadingSharedNode(false);
        });
      }
    }
  }, [message.messageType, message.sharedNodeId, relatedNodes, fetchNode]);

  const handleDeleteMessage = async () => {
    if (
      await confirmIt(
        "Are you sure you want to delete this comment?",
        "Delete",
        "Keep",
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
          gap: 1.25,
          pt: 1.75,
        }}
      >
        {message.senderDetail && (
          <Box
            sx={{
              width: "42px",
              height: "42px",
              cursor: "pointer",
              borderRadius: "50%",
              flexShrink: 0,
            }}
          >
            <OptimizedAvatar
              alt={message.senderDetail.fullname || ""}
              imageUrl={message.senderDetail.imageUrl || ""}
              size={40}
              sx={{ border: "none" }}
            />
          </Box>
        )}

        <Box sx={{ width: "100%" }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              mb: 0.5,
            }}
          >
            {message.senderDetail && (
              <Box sx={{ display: "flex" }}>
                <Typography
                  sx={{
                    fontSize: "0.98rem",
                    fontWeight: 700,
                    lineHeight: 1.2,
                  }}
                >
                  {message.senderDetail.fullname}
                </Typography>
              </Box>
            )}
            {message.createdAt && (
              <Typography
                sx={(theme) => ({
                  fontSize: "0.72rem",
                  fontWeight: 500,
                  color:
                    theme.palette.mode === "dark"
                      ? "rgba(255,255,255,0.72)"
                      : "rgba(21,31,46,0.58)",
                })}
              >
                {createdAtLabel}
              </Typography>
            )}
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
                p: "13px 14px 12px",
                borderRadius: "16px",
                border: "none",
                background: (theme) =>
                  theme.palette.mode === "dark"
                    ? "linear-gradient(140deg, rgba(31, 33, 38, 0.98), rgba(22, 23, 27, 0.98))"
                    : "linear-gradient(140deg, rgba(255,255,255,0.98), rgba(246,248,252,0.98))",
                boxShadow: (theme) =>
                  theme.palette.mode === "dark"
                    ? "0 8px 16px rgba(0,0,0,0.18)"
                    : "0 7px 16px rgba(15, 28, 59, 0.06)",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                ":hover": {
                  transform: "translateY(-1px)",
                  boxShadow: (theme) =>
                    theme.palette.mode === "dark"
                      ? "0 10px 20px rgba(0,0,0,0.24)"
                      : "0 9px 20px rgba(15, 28, 59, 0.09)",
                  "& .message-buttons": {
                    display: "block",
                  },
                },
              }}
            >
              {message.messageType === "node" && sharedNode ? (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    p: "11px 12px",
                    borderRadius: "12px",
                    background: (theme) =>
                      theme.palette.mode === "dark"
                        ? message.sender === "You"
                          ? "rgba(80, 94, 118, 0.3)"
                          : "rgba(130, 84, 52, 0.35)"
                        : message.sender === "You"
                          ? "rgba(84, 118, 168, 0.13)"
                          : "rgba(255, 170, 104, 0.23)",
                    border: (theme) =>
                      theme.palette.mode === "dark"
                        ? "1px solid rgba(255,255,255,0.08)"
                        : "1px solid rgba(20,35,68,0.1)",
                    mb: "10px",
                    ":hover": {
                      backgroundColor: "rgba(255, 138, 61, 0.22)",
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
                    {sharedNode.title?.substr(0, 40)}
                  </Typography>
                </Box>
              ) : message.messageType === "node" && loadingSharedNode ? (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    p: "10px",
                  }}
                >
                  <CircularProgress size={20} />
                  <Typography sx={{ fontWeight: "400", fontStyle: "italic" }}>
                    Loading shared node...
                  </Typography>
                </Box>
              ) : (
                <MarkdownRender
                  text={message.text}
                  sx={{
                    fontSize: "13px",
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
                      borderRadius: "12px",
                      objectFit: "cover",
                      cursor: "pointer",
                      border: "1px solid rgba(255,255,255,0.08)",
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
                  gap: "6px",
                  mt: 0.5,
                }}
              >
                <Emoticons
                  message={message}
                  reactionsMap={message?.reactions || {}}
                  toggleEmojiPicker={toggleEmojiPicker}
                  toggleReaction={toggleReaction}
                  user={user}
                  boxRef={boxRef}
                />
                <IconButton
                  onClick={(e) => toggleEmojiPicker(e, boxRef, message)}
                  size="small"
                  sx={(theme) => ({
                    borderRadius: 999,
                    border: "none",
                    color:
                      theme.palette.mode === "dark"
                        ? "rgba(255,255,255,0.82)"
                        : "rgba(24,37,64,0.72)",
                    bgcolor:
                      theme.palette.mode === "dark"
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(248,250,255,0.75)",
                    "&:hover": {
                      bgcolor:
                        theme.palette.mode === "dark"
                          ? "rgba(255,255,255,0.09)"
                          : "rgba(240,245,255,0.95)",
                    },
                  })}
                >
                  <AddReactionOutlined
                    sx={{ fontSize: "19px" }}
                  />
                </IconButton>
                <Button
                  onClick={() =>
                    setShowReplies(
                      showReplies !== message.id ? message.id : null,
                    )
                  }
                  sx={(theme) => ({
                    marginLeft: "auto",
                    fontSize: "0.86rem",
                    fontWeight: 700,
                    lineHeight: 1,
                    textTransform: "none",
                    borderRadius: 999,
                    minHeight: 34,
                    px: 1.25,
                    border: "none",
                    color:
                      theme.palette.mode === "dark"
                        ? "#ffaf70"
                        : "#b85313",
                    background:
                      showReplies === message.id
                        ? theme.palette.mode === "dark"
                          ? "linear-gradient(140deg, rgba(93, 59, 38, 0.94), rgba(58, 38, 26, 0.94))"
                          : "linear-gradient(140deg, rgba(255, 204, 161, 0.88), rgba(255, 185, 122, 0.84))"
                        : "transparent",
                    "&:hover": {
                      background:
                        theme.palette.mode === "dark"
                          ? "rgba(255, 146, 78, 0.16)"
                          : "rgba(255, 168, 98, 0.18)",
                    },
                  })}
                  variant="outlined"
                >
                  {showReplies === message.id ? (
                    <KeyboardArrowUpIcon />
                  ) : (
                    <KeyboardArrowDownIcon />
                  )}
                  {showReplies === message.id
                    ? "Hide"
                    : message?.totalReplies || null}{" "}
                  {message?.totalReplies && message.totalReplies > 1
                    ? "Replies"
                    : "Reply"}
                </Button>
              </Box>
            </Box>
          )}

          {showReplies === message.id && (
            <Box sx={{ mt: "10px" }}>
              {replies.length > 0 && (
                <Box sx={{ mb: 1.75 }}>
                  {renderReplies(message.id, replies, boxRef)}
                </Box>
              )}
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
                placeholder="Share your thoughts..."
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
