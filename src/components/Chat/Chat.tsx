//import CloseIcon from "@mui/icons-material/Close";
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
  getFirestore,
  increment,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import moment from "moment";
import dynamic from "next/dynamic";
import React, { useEffect, useRef, useState } from "react";
import { CSSTransition, TransitionGroup } from "react-transition-group";
import OptimizedAvatar from "./OptimizedAvatar";
//import { Post } from "@/lib/mapApi";
// import { NotFoundNotification } from "../Sidebar/SidebarV2/NotificationSidebar";
import { MessageButtons } from "./MessageButtons";
import MessageInput from "./MessageInput";
import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";
import MarkdownRender from "../Markdown/MarkdownRender";
import { IChat } from " @components/types/IChat";
import { Emoticons } from "./Emoticons";
const DynamicMemoEmojiPicker = dynamic(() => import("./EmojiPicker"), {
  loading: () => <p>Loading...</p>,
  ssr: false,
});

type ChatProps = {
  user: any;
  confirmIt: any;
  messages: IChat[];
  users: any;
  sidebarWidth?: number;
  innerHeight?: number;
  setMessages: React.Dispatch<React.SetStateAction<IChat[]>>;
  firstLoad: boolean;
  isLoading: boolean;
  //onlineUsers: { [uname: string]: boolean };
  type: string;
  nodeId?: string;
};

const Chat = ({
  user,
  confirmIt,
  messages,
  users,
  // sidebarWidth,
  // innerHeight,
  setMessages,
  firstLoad,
  isLoading,
  // onlineUsers,
  type,
  nodeId,
}: ChatProps) => {
  const db = getFirestore();
  const [showReplies, setShowReplies] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [isRecording] = useState<boolean>(false);
  const [recordingType] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const commentRef = useRef<{
    comment: any;
  }>({
    comment: null,
  });
  const [anchorEl, setAnchorEl] = useState(null);
  const openPicker = Boolean(anchorEl);
  const scrolling = useRef<any>();

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
    let commentRef = collection(db, "messages");
    return commentRef;
  };
  const getMessageDocRef = (messageId: string) => {
    let messageRef = doc(db, "messages", messageId);

    return messageRef;
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
    await addDoc(getMessageRef(), commentData);
    // Post("/comment/sendNotification", {
    //   subject: "New comment",
    //   comment: { ...commentData, id: docRef.id },
    //   nodeId:
    //     commentSidebarInfo.type === "node"
    //       ? commentSidebarInfo.id
    //       : commentSidebarInfo.proposal.node,
    //   commentSidebarInfo,
    //   members: users,
    // });
    //scrollToBottom();
  };

  const addReply = async (
    text: string,
    imageUrls: string[],
    commentId: string
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
    const commentRef = getMessageDocRef(commentId);
    const replyRef = collection(commentRef, "replies");
    const docRef = await addDoc(replyRef, reply);
    await updateDoc(commentRef, {
      totalReplies: increment(1),
    });
    // Post("/comment/sendNotification", {
    //   subject: "Reply",
    //   comment: { ...reply, id: docRef.id },
    //   nodeId:
    //     commentSidebarInfo.type === "node"
    //       ? commentSidebarInfo.id
    //       : commentSidebarInfo.proposal.node,
    //   commentSidebarInfo,
    //   members: users,
    // });
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
                  size={30}
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
                        text={message.text}
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
            height: "calc(100vh - 300px)",
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
                      ml: "5px",
                    }}
                  />
                </Box>
              ))}
            </Box>
          )}
          {!firstLoad && messages.length === 0 ? (
            <></>
          ) : (
            // <Box
            //   sx={{
            //     mt: "40%",
            //     display: "flex",
            //     alignItems: "center",
            //     justifyContent: "center",
            //   }}
            // >
            //   <NotFoundNotification title="Start Commenting" description="" />
            // </Box>
            <Box>{renderMessages()}</Box>
          )}
        </Box>
        <Box
          sx={{
            position: "fixed",
            bottom: "13px",
            mt: "15px",

            width: (document?.getElementById("right-panel-tabs")?.clientWidth || 0) - 20,
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