import React, { useState, useEffect, useRef } from "react";
import { Box } from "@mui/material";
import {
  collection,
  getFirestore,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import Message from "./ChatElements/Message";
import { useAuth } from "../context/AuthContext";
import { processChanges } from "@components/lib/utils/utils";
const CONSULTANT_MESSAGES = "consultantMessages";

const ConsultantChat = ({
  diagramId,
  setSelectedSolutionId,
  selectedSolutionId,
  ignoreCLD,
}: {
  diagramId: string;
  setSelectedSolutionId: any;
  selectedSolutionId: string;
  ignoreCLD?: boolean;
}) => {
  const db = getFirestore("causal-diagram");
  const [messages, setMessages] = useState<any[]>([]);
  const messagesEndRef = useRef<any>(null);
  const [showReplies, setShowReplies] = useState<Set<string>>(new Set());
  const [{ user }] = useAuth();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!diagramId) {
      return;
    }
    setMessages([]);
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
  }, [db, diagramId]);

  const renderMessages = (messages: any) =>
    messages.map((msg: any, index: number) => (
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
        ignoreCLD={!!ignoreCLD}
      />
    ));

  return (
    <Box
      sx={{
        overflowY: "auto",
        pr: 1,
        height: "100vh",
        "&::-webkit-scrollbar": {
          display: "none",
        },
        pb: "500px",
        pt: "30px",
      }}
    >
      {renderMessages(messages)}
      {/*       <div ref={messagesEndRef} /> */}
    </Box>
  );
};

export default ConsultantChat;
