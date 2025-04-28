import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Paper,
  TextField,
  IconButton,
  Button,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import MessageComponent from "../Chat/MessageComponent";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import Message from "./ChatElements/Message";
import { useAuth } from "../context/AuthContext";
import { db } from "@components/lib/firestoreServer/admin";
import { processChanges } from "@components/lib/utils/utils";
import {
  GROUPS,
  LINKS,
  NODES,
} from "@components/lib/firestoreClient/collections";
const CONSULTANT_MESSAGES = "consultantMessages";

const ConsultantChat = ({
  diagramId,
  setSelectedSolutionId,
  selectedSolutionId,
}: {
  diagramId: string;
  setSelectedSolutionId: any;
  selectedSolutionId: string;
}) => {
  const db = getFirestore("causal-diagram");
  const [messages, setMessages] = useState<any[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyToInput, setReplyToInput] = useState<string>("");
  const messagesEndRef = useRef<any>(null);
  const [editing, setEditing] = useState<string>("");
  const [showReplies, setShowReplies] = useState<Set<string>>(new Set());
  const [{ user }] = useAuth();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const diagramsQuery = query(
      collection(db, CONSULTANT_MESSAGES),
      where("diagramId", "==", diagramId),
      where("root", "==", true),
    );

    const unsubscribeDiagrams = onSnapshot(diagramsQuery, (snapshot) => {
      const changes = snapshot.docChanges();
      setMessages((prev: any) => processChanges(prev, changes));
    });
    return () => {
      unsubscribeDiagrams();
    };
  }, [db]);

  const renderMessages = (messages: any) =>
    messages.map((msg: any) => (
      <Message
        key={msg.id}
        message={msg}
        showReplies={showReplies}
        setShowReplies={setShowReplies}
        user={user}
        depth={0}
        diagramId={diagramId}
        setSelectedSolutionId={setSelectedSolutionId}
        userImage={user?.imageUrl ?? ""}
        selectedSolutionId={selectedSolutionId}
      />
    ));

  return (
    <Box
      sx={{
        overflowY: "auto",
        pr: 1,
        height: "90vh",
        "&::-webkit-scrollbar": {
          display: "none",
        },
      }}
    >
      {messages.length === 0 ? (
        <Typography textAlign="center" mt={10}>
          Start your conversation
        </Typography>
      ) : (
        renderMessages(messages)
      )}
      <div ref={messagesEndRef} />
    </Box>
  );
};

export default ConsultantChat;
