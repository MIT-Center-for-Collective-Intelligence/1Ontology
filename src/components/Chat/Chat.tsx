import {
  Box,
  // Divider,
  Popover,
  Skeleton,
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
  writeBatch,
} from "firebase/firestore";
import dynamic from "next/dynamic";
import React, { useEffect, useRef, useState } from "react";
import { TransitionGroup } from "react-transition-group";
// import { NotFoundNotification } from "../Sidebar/SidebarV2/NotificationSidebar";
import { IChatMessage } from " @components/types/IChat";

import { RiveComponentMemoized } from "../Common/RiveComponentExtended";
import { MESSAGES } from " @components/lib/firestoreClient/collections";
import {
  chatChange,
  getMessagesSnapshot,
} from " @components/client/firestore/messages.firestore";
import { recordLogs, synchronizeStuff } from " @components/lib/utils/helpers";
import MessageComponent from "./MessageComponent";
import ReplyMessage from "./ReplyMessage";
import ChatInput from "./ChatInput";
const DynamicMemoEmojiPicker = dynamic(() => import("./EmojiPicker"), {
  loading: () => <p>Loading...</p>,
  ssr: false,
});

type ChatProps = {
  user: any;
  confirmIt: any;
  sidebarWidth?: number;
  innerHeight?: number;
  chatType: string;
  nodeId: string;
  setOpenSelectModel: React.Dispatch<React.SetStateAction<boolean>>;
  users: any;
  navigateToNode: any;
};

const Chat = ({
  user,
  confirmIt,
  chatType,
  nodeId,
  setOpenSelectModel,
  users,
  navigateToNode,
}: ChatProps) => {
  const db = getFirestore();
  const [showReplies, setShowReplies] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [replies, setReplies] = useState<any[]>([]);
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
  const [messages, setMessages] = useState<IChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const scrolled = useRef(false);
  useEffect(() => {
    setMessages([]);
    if (!user) return;

    if (!nodeId && chatType === "node") return;
    setIsLoading(true);

    const onSynchronize = (changes: chatChange[]) => {
      setMessages((prev) => changes.reduce(synchronizeStuff, [...prev]));
      setIsLoading(false);
    };

    const killSnapshot = getMessagesSnapshot(
      db,
      { nodeId: nodeId, type: chatType, lastVisible: null },
      onSynchronize
    );
    return () => killSnapshot();
  }, [db, user, nodeId, chatType]);

  useEffect(() => {
    if (messages.length > 0 && !scrolled.current) {
      scrollToBottom();
      scrolled.current = true;
    }
  }, [messages]);

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

  const toggleEmojiPicker = (
    event: any,
    boxRef: any,
    comment?: IChatMessage
  ) => {
    commentRef.current.comment = comment || null;
    setAnchorEl(boxRef.current);
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

  const addReaction = async (message: IChatMessage, emoji: string) => {
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
      message?.parentMessage || message?.id,
      new Set([message.sender])
    );

    recordLogs({
      action: `Reacted on a ${message.parentMessage ? "reply" : "message"}`,
      messageId: message?.parentMessage || message?.id,
    });
  };

  const removeReaction = async (message: IChatMessage, emoji: string) => {
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

  const toggleReaction = (message: IChatMessage, emoji: string) => {
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
    setReplies([]);
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
    entityId: string,
    taggedUsers: Set<string> = new Set()
  ) => {
    const batch = writeBatch(db);
    for (const userData of users) {
      if (userData.uname === user.uname) continue;
      if (
        (userData.uname !== "1man" &&
          userData.uname !== "ouhrac" &&
          chatType !== "node") ||
        taggedUsers.has(userData.uname)
      )
        continue;

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
        type: chatType,
        createdAt: new Date(),
      };
      const notificationRef = doc(collection(db, "notifications"));
      batch.set(notificationRef, notificationData);
    }
    await batch.commit();
  };
  const addMessage = async (
    text: string,
    imageUrls: string[],
    taggedUsers: Set<string>
  ) => {
    if (!user?.uname) return;
    const commentData = {
      nodeId: chatType === "node" ? nodeId || "" : null,
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
      type: chatType,
      createdAt: new Date(),
    };
    const docRef = await addDoc(getMessageRef(), commentData);

    createNotifications(
      `New Message from ${user.fName + " " + user.lName}`,
      text,
      docRef.id,
      taggedUsers
    );
    recordLogs({
      action: "Send a message",
      text,
      messageId: docRef.id,
    });
    setTimeout(() => {
      scrollToBottom();
    }, 100);
  };

  const addReply = async (
    text: string,
    imageUrls: string[],
    messageId: string,
    taggedUsers: Set<string>
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
    await addDoc(replyRef, reply);
    await updateDoc(messageRef, {
      totalReplies: increment(1),
      subscribed: arrayUnion(user.uname),
    });

    createNotifications(
      `Reply by ${user.fName + " " + user.lName}`,
      text,
      messageId,
      taggedUsers
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
        "Are you sure you want to delete this message?",
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

  const renderReplies = (messageId: string, replies: any, boxRef: any) => {
    return replies.map((reply: any, index: number) => (
      <ReplyMessage
        key={reply.id}
        reply={reply}
        index={index}
        editing={editing}
        messageId={messageId}
        user={user}
        users={users}
        confirmIt={confirmIt}
        setEditing={setEditing}
        editReply={editReply}
        deleteReply={deleteReply}
        toggleEmojiPicker={toggleEmojiPicker}
        toggleReaction={toggleReaction}
        chatType={chatType}
      />
    ));
  };

  const scrollToBottom = () => {
    if (scrolling.current) {
      scrolling.current.scrollIntoView({ behaviour: "smooth" });
    }
  };

  const renderMessages = (messages: IChatMessage[]) => {
    return (
      <TransitionGroup>
        {messages.map((message) => (
          <MessageComponent
            key={message.id}
            message={message}
            user={user}
            editing={editing}
            setEditing={setEditing}
            users={users}
            confirmIt={confirmIt}
            toggleEmojiPicker={toggleEmojiPicker}
            toggleReaction={toggleReaction}
            showReplies={showReplies}
            setShowReplies={setShowReplies}
            renderReplies={renderReplies}
            addReply={addReply}
            editMessage={editMessage}
            deleteMessage={deleteMessage}
            navigateToNode={navigateToNode}
            replies={replies}
            chatType={chatType}
          />
        ))}
        <Box ref={scrolling}></Box>
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
            <Box sx={{ px: 2, mb: "133px" }}>{renderMessages(messages)}</Box>
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
          <ChatInput
            user={user}
            type="message"
            onSubmit={addMessage}
            users={users}
            confirmIt={confirmIt}
            editing={editing}
            setEditing={setEditing}
            setOpenSelectModel={setOpenSelectModel}
            chatType={chatType}
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
