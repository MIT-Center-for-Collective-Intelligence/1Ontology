import {
  Box,
  Modal,
  Paper,
  // Divider,
  Popover,
  Skeleton,
} from "@mui/material";
import { EmojiClickData } from "emoji-picker-react";
import CloseIcon from "@mui/icons-material/Close";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  doc,
  FieldValue,
  getDoc,
  getFirestore,
  increment,
  onSnapshot,
  query,
  runTransaction,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import dynamic from "next/dynamic";
import React, { Suspense, useEffect, useRef, useState } from "react";
import { TransitionGroup } from "react-transition-group";
// import { NotFoundNotification } from "../Sidebar/SidebarV2/NotificationSidebar";
import { IChatMessage, Reaction } from "@components/types/IChat";

import { RiveComponentMemoized } from "../Common/RiveComponentExtended";
import { MESSAGES, NODES } from "@components/lib/firestoreClient/collections";
import {
  chatChange,
  getMessagesSnapshot,
} from "@components/client/firestore/messages.firestore";
import { recordLogs, synchronizeStuff } from "@components/lib/utils/helpers";
import MessageComponent from "./MessageComponent";
import ReplyMessage from "./ReplyMessage";
import ChatInput from "./ChatInput";
import { INode } from "@components/types/INode";
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
  nodes: { [nodeId: string]: INode };
  scrollingRef: any;
  placeholder: string;
};

const Chat = ({
  user,
  confirmIt,
  chatType,
  nodeId,
  setOpenSelectModel,
  users,
  navigateToNode,
  nodes,
  scrollingRef,
  placeholder,
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

  const [messages, setMessages] = useState<IChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [openMedia, setOpenMedia] = useState<any>("");

  const scrolled = useRef(false);
  useEffect(() => {
    setMessages([]);
    if (!user) return;

    if (!nodeId && chatType === "node") return;
    setIsLoading(true);

    const onSynchronize = (changes: chatChange[]) => {
      setMessages((prev) => {
        const updatedMessages = changes.reduce(synchronizeStuff, [...prev]);
        return updatedMessages.sort(
          (a, b) => a.createdAt.seconds - b.createdAt.seconds,
        );
      });
      setIsLoading(false);
    };

    const killSnapshot = getMessagesSnapshot(
      db,
      { nodeId: nodeId, type: chatType, lastVisible: null },
      onSynchronize,
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
    comment?: IChatMessage,
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
      setMessages((prevMessages) => {
        const messageIdx = prevMessages.findIndex(
          (m: any) => m.id === message.id,
        );
        if (!prevMessages[messageIdx].reactions.hasOwnProperty(emoji)) {
          prevMessages[messageIdx].reactions[emoji] = [];
        }
        prevMessages[messageIdx].reactions[emoji].push({
          user: user?.uname,
          emoji,
          fName: user.fName,
          lName: user.lName,
        });
        return prevMessages;
      });
    } else {
      setReplies((prevReplies) => {
        const messageIdx = prevReplies.findIndex(
          (m: any) => m.id === message.id,
        );
        if (!prevReplies[messageIdx].reactions.hasOwnProperty(emoji)) {
          prevReplies[messageIdx].reactions[emoji] = [];
        }
        prevReplies[messageIdx].reactions[emoji].push({
          user: user?.uname,
          emoji,
          fName: user.fName,
          lName: user.lName,
        });
        return prevReplies;
      });
    }
    let mRef = null;
    if (!message.parentMessage) {
      mRef = getMessageDocRef(message.id || "");
    } else {
      const cRef = getMessageDocRef(message.parentMessage);
      mRef = doc(cRef, "replies", message?.id || "");
    }

    await updateDoc(mRef, {
      [`reactions.${emoji}`]: arrayUnion({
        user: user?.uname,
        emoji,
        fName: user.fName,
        lName: user.lName,
      }),
    });

    createNotifications(
      emoji,
      message.text,
      message?.parentMessage || message?.id,
      new Set([message.sender]),
    );

    recordLogs({
      action: `Reacted on a ${message.parentMessage ? "reply" : "message"}`,
      messageId: message?.parentMessage || message?.id,
    });
  };
  const removeReaction = async (message: IChatMessage, emoji: string) => {
    if (!message.id) return;
    if (!message.parentMessage) {
      setMessages((prevMessages) => {
        const _prevMessages = [...prevMessages];
        const messageIdx = _prevMessages.findIndex(
          (m: any) => m.id === message.id,
        );
        _prevMessages[messageIdx].reactions[emoji] = _prevMessages[
          messageIdx
        ].reactions[emoji].filter((r: any) => r.user !== user?.uname);
        if (_prevMessages[messageIdx].reactions[emoji].length === 0) {
          delete _prevMessages[messageIdx].reactions[emoji];
        }

        return _prevMessages;
      });
    } else {
      setReplies((prevReplies) => {
        const _prevMessages = [...prevReplies];
        const messageIdx = _prevMessages.findIndex(
          (m: any) => m.id === message.id,
        );
        _prevMessages[messageIdx].reactions[emoji] = _prevMessages[
          messageIdx
        ].reactions[emoji].filter((r: any) => r.user !== user?.uname);
        if (_prevMessages[messageIdx].reactions[emoji].length === 0) {
          delete _prevMessages[messageIdx].reactions[emoji];
        }

        return _prevMessages;
      });
    }
    let messageRef = null;
    if (!message.parentMessage) {
      messageRef = getMessageDocRef(message.id);
    } else {
      const cRef = getMessageDocRef(message.parentMessage);
      messageRef = doc(cRef, "replies", message?.id || "");
    }

    await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(messageRef);

      if (!docSnap.exists()) return;

      const reactions = docSnap.data().reactions || [];
      const updatedReactions = reactions[emoji].filter(
        (reaction: Reaction) => reaction.user !== user?.uname,
      );
      if (updatedReactions.length === 0) {
        transaction.update(messageRef, {
          [`reactions.${emoji}`]: deleteField(),
        });
      } else {
        transaction.update(messageRef, {
          [`reactions.${emoji}`]: updatedReactions,
        });
      }
    });
    recordLogs({
      action: `Removed reaction from a ${
        message.parentMessage ? "reply" : "message"
      }`,
      messageId: message?.parentMessage || message?.id,
    });
  };

  const toggleReaction = (message: IChatMessage, emoji: string) => {
    if (!message?.id || !user?.uname) return;
    const reactionIdx = (message.reactions || {})[emoji]
      ? (message.reactions || {})[emoji].findIndex(
          (r: any) => r.user === user?.uname,
        )
      : -1;
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
        (a: any, b: any) => a.createdAt.toMillis() - b.createdAt.toMillis(),
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
    taggedUsers: Set<string> = new Set(),
  ) => {
    const batch = writeBatch(db);
    for (const userData of users) {
      if (userData.uname === user.uname) continue;
      if (
        (userData.uname !== "1man" && userData.uname !== "ouhrac") ||
        taggedUsers.has(userData.uname)
      ) {
        continue;
      }

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
    taggedUsers: Set<string>,
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
    if (chatType === "node") {
      const nodeDoc = await getDoc(doc(collection(db, NODES), nodeId));
      const nodeData = nodeDoc.data();
      (nodeData?.contributors || []).forEach((contributor: string) => {
        taggedUsers.add(contributor);
      });
    }

    createNotifications(
      `New Message from ${user.fName + " " + user.lName}`,
      text,
      docRef.id,
      taggedUsers,
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
    taggedUsers: Set<string>,
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
      taggedUsers,
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
    messageId: string,
  ) => {
    await updateDoc(getMessageDocRef(messageId), {
      text: text,
      imageUrls,
      edited: true,
      editedAt: new Date(),
    });
  };

  const deleteMessage = async (messageId: string) => {
    try {
      if (!messageId) return;
      const commentRef = getMessageDocRef(messageId);
      await updateDoc(commentRef, {
        deleted: true,
      });

      recordLogs({
        action: "Deleted a message",
        messageId: messageId,
      });
    } catch (error: any) {
      recordLogs({
        type: "error",
        error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
        messageId: messageId,
        at: "deleteMessage",
      });
    }
  };

  const editReply = async (
    text: string,
    imageUrls: string[],
    messageId: string,
    replyId: string,
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
        "Keep",
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
        setOpenMedia={setOpenMedia}
      />
    ));
  };

  const scrollToBottom = () => {
    if (scrollingRef.current) {
      scrollingRef.current.scrollIntoView({ behaviour: "smooth" });
    }
  };

  const renderMessages = (messages: IChatMessage[]) => {
    return (
      <Box>
        {[...messages].map((message) => (
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
            nodes={nodes}
            setOpenMedia={setOpenMedia}
          />
        ))}
        <Box ref={scrollingRef}></Box>
      </Box>
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
            <Box sx={{ mt: "10px" }}>
              {Array.from(new Array(10)).map((_, index) => (
                <Box
                  key={index}
                  sx={{
                    display: "flex",
                    justifyContent: "flex-start",
                    p: 1,
                    mt: "10px",
                  }}
                >
                  <Skeleton
                    variant="circular"
                    width={50}
                    height={45}
                    sx={{
                      bgcolor: "grey.500",
                      borderRadius: "50%",
                    }}
                  />
                  <Box sx={{ width: "100%" }}>
                    <Box sx={{ display: "flex" }}>
                      <Skeleton
                        variant="rectangular"
                        width={100}
                        height={10}
                        sx={{
                          bgcolor: "grey.300",
                          borderRadius: "10px",
                          ml: "8px",
                        }}
                      />
                      <Skeleton
                        variant="rectangular"
                        width={50}
                        height={10}
                        sx={{
                          bgcolor: "grey.300",
                          borderRadius: "10px",
                          ml: "8px",
                        }}
                      />
                    </Box>
                    <Skeleton
                      variant="rectangular"
                      height={90}
                      sx={{
                        bgcolor: "grey.300",
                        borderRadius: "10px",
                        mt: "10px",
                        ml: "8px",
                        width: "97%",
                      }}
                    />
                  </Box>
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
            <Box sx={{ px: 2, mb: "133px" }}>
              {renderMessages([...messages])}
            </Box>
          )}
        </Box>
        <Box
          sx={{
            position: "fixed",
            bottom: "13px",
            mt: "15px",
            p: 2,
            width: "100%",
          }}
        >
          <ChatInput
            user={user}
            type="message"
            placeholder={placeholder}
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
      <Suspense fallback={<div></div>}>
        <Modal
          open={Boolean(openMedia)}
          onClose={() => setOpenMedia(null)}
          aria-labelledby="modal-modal-title"
          aria-describedby="modal-modal-description"
          sx={{ backgroundColor: "black" }}
        >
          <>
            <Paper
              sx={{
                position: "relative",
                height: "100vh",
                width: "100vw",
                background: "transparent",
                padding: 0,
                margin: 0,
                overflow: "hidden",
              }}
            >
              <CloseIcon
                sx={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  zIndex: 1,
                  cursor: "pointer",
                  backgroundColor: "gray",
                  borderRadius: "50%",
                  padding: 1,
                  fontSize: "40px",
                  ":hover": {
                    backgroundColor: "#303134",
                  },
                }}
                onClick={() => setOpenMedia(null)}
              />
              <img
                src={openMedia || ""}
                alt="Node image"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
            </Paper>
          </>
        </Modal>
      </Suspense>
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
