import {
  Box,
  Button,
  // Divider,
  Popover,
  Skeleton,
  Typography,
} from "@mui/material";
import { EmojiClickData } from "emoji-picker-react";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDocs,
  getFirestore,
  increment,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import moment from "moment";
import dynamic from "next/dynamic";
import React, { useEffect, useRef, useState } from "react";
import { CSSTransition, TransitionGroup } from "react-transition-group";
import OptimizedAvatar from "./OptimizedAvatar";
// import { NotFoundNotification } from "../Sidebar/SidebarV2/NotificationSidebar";
import { MessageButtons } from "./MessageButtons";
import MessageInput from "./MessageInput";
import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";
import MarkdownRender from "../Markdown/MarkdownRender";
import { IChat } from " @components/types/IChat";
import { Emoticons } from "./Emoticons";
import LinkIcon from "@mui/icons-material/Link";
import { RiveComponentMemoized } from "../Common/RiveComponentExtended";
import { MESSAGES, USERS } from " @components/lib/firestoreClient/collections";
import {
  chatChange,
  getMessagesSnapshot,
} from " @components/client/firestore/messages.firestore";
import { recordLogs, synchronizeStuff } from " @components/lib/utils/helpers";
const DynamicMemoEmojiPicker = dynamic(() => import("./EmojiPicker"), {
  loading: () => <p>Loading...</p>,
  ssr: false,
});

type ChatProps = {
  user: any;
  confirmIt: any;
  sidebarWidth?: number;
  innerHeight?: number;
  type: string;
  nodeId: string;
  setOpenSelectModel: React.Dispatch<React.SetStateAction<boolean>>;
  users: any;
  navigateToNode: any;
};

const Chat = ({
  user,
  confirmIt,
  type,
  nodeId,
  setOpenSelectModel,
  users,
  navigateToNode,
}: ChatProps) => {
  const db = getFirestore();
  const [showReplies, setShowReplies] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [isRecording] = useState<boolean>(false);
  const [recordingType] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [width, setWidth] = useState<number>(0);
  const commentRef = useRef<{
    comment: any;
  }>({
    comment: null,
  });
  const [anchorEl, setAnchorEl] = useState(null);
  const openPicker = Boolean(anchorEl);
  const scrolling = useRef<any>();
  const [messages, setMessages] = useState<IChat[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!user) return;
    if (!nodeId) return;
    setIsLoading(true);
    setMessages([]);
    const onSynchronize = (changes: chatChange[]) => {
      setMessages((prev) => changes.reduce(synchronizeStuff, [...prev]));
      setIsLoading(false);
    };
    const killSnapshot = getMessagesSnapshot(
      db,
      { nodeId: nodeId, type: "node", lastVisible: null },
      onSynchronize
    );
    return () => killSnapshot();
  }, [db, user, nodeId]);

  useEffect(() => {
    const element = document.getElementById("right-panel-tabs");
    if (element) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          setWidth(entry.target.clientWidth);
        }
      });

      resizeObserver.observe(element);

      return () => {
        resizeObserver.disconnect();
      };
    }
  }, []);

  const toggleEmojiPicker = (event: any, comment?: IChat) => {
    commentRef.current.comment = comment || null;
    setAnchorEl(event.currentTarget);
    setShowEmojiPicker(!showEmojiPicker);
  };
  const handleCloseEmojiPicker = () => {
    setAnchorEl(null);
  };

  const handleEmojiClick = (emojiObject: EmojiClickData) => {
    const comment = commentRef.current.comment;
    if (comment) {
      toggleReaction(comment, emojiObject.emoji);
    }
    setShowEmojiPicker(false);
  };

  const addReaction = async (message: IChat, emoji: string) => {
    if (!message.id || !user?.uname) return;

    if (!message.parentMessage) {
      setMessages((prevComments) => {
        const commentIdx = prevComments.findIndex(
          (m: any) => m.id === message.id
        );
        prevComments[commentIdx].reactions.push({ user: user?.uname, emoji });
        return prevComments;
      });
    }
    if (!message.parentMessage) {
      const mRef = getMessageDocRef(message.id || "");
      await updateDoc(mRef, {
        reactions: arrayUnion({ user: user?.uname, emoji }),
      });
    } else {
      const cRef = getMessageDocRef(message.parentMessage);
      const replyRef = doc(cRef, "replies", message?.id || "");
      await updateDoc(replyRef, {
        reactions: arrayUnion({ user: user?.uname, emoji }),
      });
    }
    createNotifications(
      emoji,
      message.text,
      message?.parentMessage || message?.id
    );

    recordLogs({
      action: `Reacted on a ${message.parentMessage ? "reply" : "message"}`,
      messageId: message?.parentMessage || message?.id,
    });
  };

  const removeReaction = async (message: IChat, emoji: string) => {
    if (!message.id) return;
    if (!message.parentMessage) {
      setMessages((prevMessages: any) => {
        const messageIdx = prevMessages.findIndex(
          (m: any) => m.id === message.id
        );
        prevMessages[messageIdx].reactions = prevMessages[
          messageIdx
        ].reactions.filter(
          (r: any) => r.emoji !== emoji && r.user !== user?.uname
        );
        return prevMessages;
      });
    }

    if (!message.parentMessage) {
      const cRef = getMessageDocRef(message.id);
      await updateDoc(cRef, {
        reactions: arrayRemove({ user: user?.uname, emoji }),
      });
    } else {
      const cRef = getMessageDocRef(message.parentMessage);
      const replyRef = doc(cRef, "replies", message?.id || "");
      await updateDoc(replyRef, {
        reactions: arrayRemove({ user: user?.uname, emoji }),
      });
    }
    recordLogs({
      action: `Removed reaction from a ${
        message.parentMessage ? "reply" : "message"
      }`,
      messageId: message?.parentMessage || message?.id,
    });
  };

  const toggleReaction = (message: IChat, emoji: string) => {
    if (!message?.id || !user?.uname) return;
    const reactionIdx = message.reactions.findIndex(
      (r: any) => r.user === user?.uname && r.emoji === emoji
    );
    if (reactionIdx !== -1) {
      removeReaction(message, emoji);
    } else {
      addReaction(message, emoji);
    }
    setAnchorEl(null);
  };

  useEffect(() => {
    if (!showReplies) return;
    const commentRef = getMessageDocRef(showReplies);
    const replyRef = collection(commentRef, "replies");
    const q = query(replyRef, where("deleted", "==", false));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const repliesDocuments: any = snapshot.docs.map((doc) => {
        const document = doc.data();
        return { ...document, parentMessage: showReplies, id: doc.id };
      }) as any;
      repliesDocuments.sort(
        (a: any, b: any) => a.createdAt.toMillis() - b.createdAt.toMillis()
      );
      setReplies(repliesDocuments);
    });
    return () => unsubscribe();
  }, [showReplies]);

  const getMessageRef = () => {
    let commentRef = collection(db, MESSAGES);
    return commentRef;
  };
  const getMessageDocRef = (messageId: string) => {
    let messageRef = doc(db, MESSAGES, messageId);

    return messageRef;
  };

  const createNotifications = async (
    title: string,
    body: string,
    entityId: string
  ) => {
    const batch = writeBatch(db);
    for (const userData of users) {
      if (userData.uname === user.uname) continue;
      const notificationData = {
        title: title,
        body: body,
        user: userData.uname,
        sender: user.uname,
        senderDetail: {
          uname: user.uname,
          fullname: user.fName + " " + user.lName,
          imageUrl: user.imageUrl,
          uid: user.userId,
        },
        entityId: entityId,
        notificationType: "message",
        nodeId: nodeId || "",
        seen: false,
        type: type,
        createdAt: new Date(),
      };
      const notificationRef = doc(collection(db, "notifications"));
      batch.set(notificationRef, notificationData);
    }
    await batch.commit();
  };

  const addMessage = async (text: string, imageUrls: string[]) => {
    if (!user?.uname) return;
    const commentData = {
      nodeId: nodeId || "",
      text: text,
      sender: user.uname,
      senderDetail: {
        uname: user.uname,
        fullname: user.fName + " " + user.lName,
        imageUrl: user.imageUrl,
        uid: user.userId,
      },
      imageUrls,
      reactions: [],
      edited: false,
      deleted: false,
      totalReplies: 0,
      type: type,
      createdAt: new Date(),
    };
    const docRef = await addDoc(getMessageRef(), commentData);

    createNotifications(
      `New Message from ${user.fName + " " + user.lName}`,
      text,
      docRef.id
    );
    recordLogs({
      action: "Send a message",
      text,
      messageId: docRef.id,
    });
  };

  const addReply = async (
    text: string,
    imageUrls: string[],
    messageId: string
  ) => {
    if (!user?.uname) return;
    const reply = {
      text: text,
      sender: user.uname,
      senderDetail: {
        uname: user.uname,
        fullname: user.fName + " " + user.lName,
        imageUrl: user.imageUrl,
        uid: user.userId,
      },
      imageUrls: imageUrls,
      reactions: [],
      edited: false,
      deleted: false,
      createdAt: new Date(),
    };
    const messageRef = getMessageDocRef(messageId);
    const replyRef = collection(messageRef, "replies");
    const docRef = await addDoc(replyRef, reply);
    await updateDoc(messageRef, {
      totalReplies: increment(1),
    });

    createNotifications(
      `Reply by ${user.fName + " " + user.lName}`,
      text,
      messageId
    );

    recordLogs({
      action: "Replied on a message",
      text,
      messageId: messageId,
    });
  };

  const editMessage = async (
    text: string,
    imageUrls: string[],
    messageId: string
  ) => {
    await updateDoc(getMessageDocRef(messageId), {
      text: text,
      imageUrls,
      edited: true,
      editedAt: new Date(),
    });
  };

  const deleteMessage = async (messageId: string) => {
    if (
      await confirmIt(
        "Are you sure you want to delete this comment?",
        "Delete",
        "Keep"
      )
    ) {
      const commentRef = getMessageDocRef(messageId);
      await updateDoc(commentRef, {
        deleted: true,
      });
      recordLogs({
        action: "Deleted a message",
        messageId: messageId,
      });
    }
  };

  const editReply = async (
    text: string,
    imageUrls: string[],
    messageId: string,
    replyId: string
  ) => {
    const commentRef = getMessageDocRef(messageId);
    const replyRef = doc(commentRef, "replies", replyId);
    await updateDoc(replyRef, {
      text: text,
      imageUrls,
      edited: true,
      editedAt: new Date(),
    });
    recordLogs({
      action: "Edited a reply",
      messageId: messageId,
      replyId: replyId,
      text,
    });
  };

  const deleteReply = async (messageId: string, replyId: string) => {
    if (
      await confirmIt(
        "Are you sure you want to delete this reply?",
        "Delete",
        "Keep"
      )
    ) {
      const commentRef = getMessageDocRef(messageId);
      const replyRef = doc(commentRef, "replies", replyId);
      await updateDoc(replyRef, {
        deleted: true,
      });
      await updateDoc(commentRef, {
        totalReplies: increment(-1),
      });
      recordLogs({
        action: "Deleted a reply",
        messageId: messageId,
        replyId: replyId,
      });
    }
  };

  const renderReplies = (messageId: string, replies: any) => {
    return replies.map((reply: any, index: number) => (
      <Box
        key={index}
        sx={{
          display: "flex",
          gap: "10px",
          pt: 5,
        }}
      >
        <Box
          sx={{
            width: `40px`,
            height: `40px`,
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
          {/* {onlineUsers[reply.senderDetail?.uname] && (
            <Box
              sx={{ background: "#12B76A", fontSize: "1px" }}
              className="UserStatusOnlineIcon"
            />
          )} */}
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
                sx={{
                  fontSize: "16px",
                  fontWeight: "500",
                  lineHeight: "24px",
                }}
              >
                {reply.senderDetail.fullname}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: "12px" }}>
              {moment(reply.createdAt.toDate().getTime()).format("h:mm a")}
            </Typography>
          </Box>
          {editing?.parentMessage === messageId && editing?.id === reply.id ? (
            <MessageInput
              message={reply}
              user={user}
              type="reply"
              onClose={() => setEditing(null)}
              onSubmit={editReply}
              isEditing={true}
              isRecording={isRecording}
              recordingType={recordingType}
              users={users}
              startListening={() => {}}
              stopListening={() => {}}
              confirmIt={confirmIt}
              editing={editing}
              setEditing={setEditing}
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
                    : DESIGN_SYSTEM_COLORS.gray200,
                ":hover": {
                  "& .message-buttons": {
                    display: "block",
                  },
                },
              }}
            >
              <Box
                sx={{
                  fontSize: "16px",
                  fontWeight: "400",
                  lineHeight: "24px",
                }}
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
                      style={{ borderRadius: "8px", objectFit: "contain" }}
                      src={imageUrl}
                      alt="reply image"
                      key={imageUrl}
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
                  message={reply}
                  reactionsMap={reply.reactions}
                  toggleEmojiPicker={toggleEmojiPicker}
                  toggleReaction={toggleReaction}
                  user={user}
                />
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    ));
  };

  // const scrollToBottom = () => {
  //   if (scrolling.current) {
  //     scrolling.current.scrollIntoView({ behaviour: "smooth" });
  //   }
  // };

  const renderMessages = () => {
    return (
      <TransitionGroup>
        {messages.map((message) => (
          <CSSTransition key={message.id} timeout={500} classNames="comment">
            <Box
              id={`message-${message.id}`}
              sx={{
                display: "flex",
                gap: "10px",
                pt: 5,
              }}
            >
              <Box
                sx={{
                  width: `40px`,
                  height: `40px`,
                  cursor: "pointer",
                  borderRadius: "50%",
                }}
              >
                <OptimizedAvatar
                  alt={message.senderDetail?.fullname || ""}
                  imageUrl={message.senderDetail?.imageUrl || ""}
                  size={40}
                  sx={{ border: "none" }}
                />
                {/* {onlineUsers[message.senderDetail?.uname] && (
                  <Box
                    sx={{ background: "#12B76A", fontSize: "1px" }}
                    className="UserStatusOnlineIcon"
                  />
                )} */}
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
                    {moment(message.createdAt.toDate().getTime()).format(
                      "h:mm a"
                    )}
                  </Typography>
                </Box>
                {editing?.id === message.id ? (
                  <MessageInput
                    message={message}
                    user={user}
                    type="message"
                    onClose={() => setEditing(null)}
                    onSubmit={editMessage}
                    isEditing={true}
                    startListening={() => {}}
                    stopListening={() => {}}
                    isRecording={isRecording}
                    recordingType={recordingType}
                    users={users}
                    confirmIt={confirmIt}
                    editing={editing}
                    setEditing={setEditing}
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
                      sx={{
                        fontSize: "16px",
                        fontWeight: "400",
                        lineHeight: "24px",
                      }}
                    >
                      {message.messageType === "node" ? (
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
                            <LinkIcon
                              sx={{
                                color: DESIGN_SYSTEM_COLORS.gray25,
                              }}
                            />
                          </Box>
                          <Typography sx={{ fontWeight: "500" }}>
                            {message.text?.substr(0, 40)}
                            {message.text?.length > 40 ? "..." : ""}
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
                        {(message.imageUrls || []).map((imageUrl: string) => (
                          <img
                            width={"100%"}
                            style={{
                              borderRadius: "8px",
                              objectFit: "contain",
                            }}
                            src={imageUrl}
                            alt="comment image"
                            key={imageUrl}
                          />
                        ))}
                      </Box>
                    </Box>

                    <Box className="message-buttons" sx={{ display: "none" }}>
                      <MessageButtons
                        message={message}
                        handleEditMessage={() => setEditing(message)}
                        handleDeleteMessage={() => deleteMessage(message.id)}
                        toggleEmojiPicker={toggleEmojiPicker}
                        user={user}
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
                      />
                    </Box>

                    <Button
                      onClick={() =>
                        setShowReplies(!showReplies ? message.id : null)
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
                    {renderReplies(message.id, replies)}
                    <MessageInput
                      user={user}
                      type="reply"
                      message={message}
                      onSubmit={addReply}
                      startListening={() => {}}
                      stopListening={() => {}}
                      isRecording={isRecording}
                      recordingType={recordingType}
                      users={users}
                      confirmIt={confirmIt}
                      setEditing={setEditing}
                    />
                  </Box>
                )}
                <Box ref={scrolling}></Box>
              </Box>
            </Box>
          </CSSTransition>
        ))}
      </TransitionGroup>
    );
  };
  return (
    <Box
      sx={{
        position: "relative",
        borderRadius: "15px",
        listStyle: "none",
        transition: "box-shadow 0.3s",
      }}
    >
      <Popover
        open={openPicker}
        anchorEl={anchorEl}
        onClose={handleCloseEmojiPicker}
        anchorOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
      >
        {openPicker && (
          <DynamicMemoEmojiPicker
            width="300px"
            height="400px"
            onEmojiClick={handleEmojiClick}
            lazyLoadEmojis={true}
            theme={"dark"}
          />
        )}
      </Popover>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <Box
          id="comments-section"
          sx={{
            height: "calc(100vh - 180px)",
            overflow: "auto",
            "&::-webkit-scrollbar": {
              display: "none",
            },
          }}
        >
          {isLoading && (
            <Box>
              {Array.from(new Array(7)).map((_, index) => (
                <Box
                  key={index}
                  sx={{
                    display: "flex",
                    justifyContent: "flex-start",
                    p: 1,
                  }}
                >
                  <Skeleton
                    variant="circular"
                    width={50}
                    height={50}
                    sx={{
                      bgcolor: "grey.500",
                      borderRadius: "50%",
                    }}
                  />
                  <Skeleton
                    variant="rectangular"
                    width={410}
                    height={90}
                    sx={{
                      bgcolor: "grey.300",
                      borderRadius: "0px 10px 10px 10px",
                      mt: "19px",
                    }}
                  />
                </Box>
              ))}
            </Box>
          )}
          {messages.length === 0 ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                marginTop: "40%",
              }}
            >
              <Box
                sx={{ height: "100%", display: "grid", placeItems: "center" }}
              >
                <Box>
                  <Box
                    sx={{
                      width: { xs: "250px", sm: "300px" },
                      height: { xs: "250px", sm: "200px" },
                      "& .rive-canvas": {
                        height: "100%",
                      },
                    }}
                  >
                    <RiveComponentMemoized
                      src="/rive/notification.riv"
                      animations={"Timeline 1"}
                      artboard="New Artboard"
                      autoplay={true}
                      style={{
                        width: "100%",
                        height: "100%",
                      }}
                    />
                  </Box>
                </Box>
              </Box>
            </Box>
          ) : (
            <Box sx={{ px: 2 }}>{renderMessages()}</Box>
          )}
        </Box>
        <Box
          sx={{
            position: "fixed",
            bottom: "13px",
            mt: "15px",
            pl: 2,
            width: "420px" /* width - 10 */,
          }}
        >
          <MessageInput
            user={user}
            type="message"
            onSubmit={addMessage}
            startListening={() => {}}
            stopListening={() => {}}
            isRecording={isRecording}
            recordingType={recordingType}
            users={users}
            confirmIt={confirmIt}
            setEditing={setEditing}
            setOpenSelectModel={setOpenSelectModel}
          />
        </Box>
      </Box>
    </Box>
  );
};

const areEqual = (prevProps: any, nextProps: any) => {
  return (
    prevProps.user === nextProps.user &&
    prevProps.confirmIt === nextProps.confirmIt &&
    //prevProps.onClose === nextProps.onClose &&
    prevProps.messages === nextProps.messages &&
    prevProps.users === nextProps.users &&
    prevProps.setMessages === nextProps.setMessages &&
    prevProps.firstLoad === nextProps.firstLoad &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.type === nextProps.type &&
    prevProps.onlineUsers === nextProps.onlineUsers &&
    prevProps.nodeId === nextProps.nodeId
  );
};

export default React.memo(Chat, areEqual);
