import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import FilterNoneIcon from "@mui/icons-material/FilterNone";
import Diversity3Icon from "@mui/icons-material/Diversity3";
import PsychologyIcon from "@mui/icons-material/Psychology";
import PrecisionManufacturingIcon from "@mui/icons-material/PrecisionManufacturing";
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Box,
  Button,
  Avatar,
  IconButton,
  Tooltip,
  Typography,
  Skeleton,
  Chip,
  useTheme,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import ChatInput from "@components/components/Chat/ChatInput";
import MarkdownRender from "@components/components/Markdown/MarkdownRender";
import { Post } from "@components/lib/utils/Post";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { processChanges } from "@components/lib/utils/utils";
import { DESIGN_SYSTEM_COLORS } from "@components/lib/theme/colors";
import { extractMoves } from "@components/lib/utils/ConsultantUtils";
import { LoadingButton } from "@mui/lab";

// Assume you'll import the image yourself
// import consultantImage from "@/public/consultant.png";

const CONSULTANT_MESSAGES = "consultantMessages";

const getMoveTooltip = (action: string): string => {
  const tooltips: Record<string, string> = {
    "ZOOM OUT": "Stepping back, generalizing, seeing the bigger picture",
    "ZOOM IN": "Breaking down problems, making ideas concrete",
    ANALOGIZE: "Using analogies from potentially different domains",
    GROUPIFY: "Exploring different group structures (superminds)",
    COGNIFY: "Focusing on cognitive processes needed",
    TECHNIFY: "Exploring the role of technology",
  };

  return tooltips[action] || "";
};
const Message = ({
  message,
  showReplies,
  setShowReplies,
  user,
  depth,
  diagramId,
  setSelectedSolutionId,
  selectedSolutionId,
  userImage,
}: {
  message: any;
  showReplies: any;
  setShowReplies: any;
  user: any;
  depth: any;
  diagramId: any;
  setSelectedSolutionId: any;
  selectedSolutionId: string;
  userImage: string;
}) => {
  const theme = useTheme();
  const db = getFirestore("causal-diagram");
  const [nestedMessages, setNestedMessages] = useState<any[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const isFirstNested = depth > 0; // Helper to identify the first nested message
  const [tempText, setTempText] = useState("");
  const [loadingResponse, setLoadingResponse] = useState(false);
  const [loadingCopy, setLoadingCopy] = useState(false);

  useEffect(() => {
    if (!diagramId) return;
    const diagramsQuery = query(
      collection(db, CONSULTANT_MESSAGES),
      where("diagramId", "==", diagramId),
      where("parentMessage", "==", message.id),
    );

    const unsubscribeDiagrams = onSnapshot(diagramsQuery, (snapshot) => {
      const changes = snapshot.docChanges();
      setNestedMessages((prev: any) => processChanges(prev, changes));
    });

    return () => unsubscribeDiagrams();
  }, [db, diagramId, message.id]);

  const addReply = async (inputValue: string, imageUrls: string[]) => {
    const messageRef = doc(collection(db, CONSULTANT_MESSAGES));
    try {
      setLoadingResponse(true);

      const newMessage = {
        id: messageRef.id,
        parentMessage: message.id,
        text: inputValue,
        createdAt: new Date(),
        root: false,
        diagramId,
        uname: user.uname,
        loadingReply: true,
        role: "user",
      };
      await setDoc(messageRef, newMessage);

      setShowReplies((prev: any) => {
        const _prev = new Set(prev);
        _prev.add(messageRef.id);
        return _prev;
      });
      await Post("/consultant", {
        messageId: messageRef.id,
        diagramId,
        userPrompt: inputValue,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingResponse(false);
      updateDoc(messageRef, {
        loadingReply: deleteField(),
      });
    }
  };
  const getThreadOfMessages = async (messageId: string) => {
    const messagesList: any = [];
    const messageRef = doc(db, CONSULTANT_MESSAGES, messageId);
    const messageDoc = await getDoc(messageRef);

    if (!messageDoc.exists()) {
      return messagesList; // or handle the case when document doesn't exist
    }

    const messageData = messageDoc.data();
    messagesList.push({
      role: messageData.role ? "Consultee" : "Consultant",

      text: JSON.stringify(
        {
          alternatives: [
            {
              response: messageData.text,
              moves: messageData.moves,
            },
          ],
        },
        null,
        2,
      ),
    });

    const nextLevel = messageData.root
      ? []
      : await getThreadOfMessages(messageData.parentMessage);
    messagesList.push(...nextLevel);
    return messagesList;
  };
  const copyThread = async (messageId: string) => {
    try {
      setLoadingCopy(true);
      const messagesList = await getThreadOfMessages(messageId);

      await navigator.clipboard.writeText(
        JSON.stringify(messagesList.reverse(), null, 2),
      );
      setTempText("Copied!");

      setTimeout(() => {
        setTempText("");
      }, 1000);
    } catch (err) {
      console.error("Failed to copy diagram:", err);
      setTempText("Copy failed!");
      setTimeout(() => {
        setTempText("");
      }, 1000);
    } finally {
      setLoadingCopy(false);
    }
  };
  const movesExtracted = useMemo(() => {
    return extractMoves(message.moves || "") || [];
  }, message.moves);
  return (
    <Box
      ref={boxRef}
      sx={{
        display: "flex",
        position: "relative",
        pl: `${depth * 24}px`,
        pb: "12px",
        width: depth === 0 ? "98%" : "100%",
        "&::before": isFirstNested
          ? {
              content: '""',
              position: "absolute",
              top: "-6px",
              left: `${(depth - 1) * 24 + 16}px`,
              width: "2px",
              height: "calc(100%)",
              backgroundColor: DESIGN_SYSTEM_COLORS.gray500,
              borderBottomLeftRadius: "8px",
              borderBottomRightRadius: "8px",
            }
          : depth > 0
            ? {
                content: '""',
                position: "absolute",
                top: 0,
                left: `${(depth - 1) * 24 + 16}px`,
                width: "2px",
                height: "80%",
                backgroundColor: DESIGN_SYSTEM_COLORS.gray500,
                borderBottomLeftRadius: "8px",
              }
            : undefined,
      }}
    >
      <Box sx={{ flexGrow: 1 }}>
        <Box
          sx={{
            p: "10px",
            borderRadius: "10px",
            backgroundColor: (theme) =>
              theme.palette.mode === "dark"
                ? DESIGN_SYSTEM_COLORS.notebookG700
                : "white",
            position: "relative",
          }}
        >
          <Box
            sx={{
              display: "flex",
              gap: "8px",
              alignItems: "center",
              borderColor: DESIGN_SYSTEM_COLORS.gray400,
              pb: "6px",
              mb: "10px",
            }}
          >
            {" "}
            <Avatar
              src={
                message.role === "user"
                  ? userImage
                  : theme.palette.mode === "dark"
                    ? "/consultant_dark.png"
                    : "/consultant_light.png"
              }
              sx={{
                width: 32,
                height: 32,
                fontSize: "14px",
                mr: 1,
                backgroundColor: DESIGN_SYSTEM_COLORS.gray500,
              }}
            />
            {movesExtracted.map((move: any, idx: number) => {
              return (
                <Box
                  key={idx}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                  }}
                >
                  <Tooltip title={getMoveTooltip(move.action)}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "9px",
                      }}
                    >
                      {move.action === "ZOOM OUT" ? (
                        <ZoomOutIcon sx={{ fontSize: "29px" }} />
                      ) : move.action === "ZOOM IN" ? (
                        <ZoomInIcon sx={{ fontSize: "29px" }} />
                      ) : move.action === "ANALOGIZE" ? (
                        <FilterNoneIcon sx={{ fontSize: "29px" }} />
                      ) : move.action === "GROUPIFY" ? (
                        <Diversity3Icon sx={{ fontSize: "29px" }} />
                      ) : move.action === "COGNIFY" ? (
                        <PsychologyIcon sx={{ fontSize: "29px" }} />
                      ) : move.action === "TECHNIFY" ? (
                        <PrecisionManufacturingIcon sx={{ fontSize: "29px" }} />
                      ) : null}

                      <Typography
                        variant="caption"
                        sx={{ fontWeight: "bold", mr: "4px" }}
                      >
                        {move.action}
                      </Typography>
                    </Box>
                  </Tooltip>
                  {move.detail
                    .split(",")
                    .filter((c: string) => !!c)
                    .map((item: string, index: number) => (
                      <Chip
                        key={index}
                        label={item.trim()}
                        style={{ margin: 4 }}
                      />
                    ))}
                </Box>
              );
            })}{" "}
            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
                ml: "auto",
              }}
            >
              {message.role !== "user" && (
                <LoadingButton
                  loading={message.loadingCld}
                  variant={
                    selectedSolutionId === message.id ? "contained" : "outlined"
                  }
                  size="small"
                  onClick={() => {
                    setSelectedSolutionId((prev: any) =>
                      prev === message.id ? null : message.id,
                    );
                  }}
                  sx={{ borderRadius: "25px" }}
                >
                  {selectedSolutionId === message.id ? "Unselect" : "View CLD"}
                </LoadingButton>
              )}

              <Button
                variant={showReplies.has(message.id) ? "contained" : "outlined"}
                size="small"
                onClick={() =>
                  setShowReplies((prev: any) => {
                    const _prev = new Set(prev);
                    if (_prev.has(message.id)) {
                      _prev.delete(message.id);
                    } else {
                      _prev.add(message.id);
                    }
                    return _prev;
                  })
                }
                sx={{ borderRadius: "25px" }}
              >
                {showReplies.has(message.id) ? (
                  <>
                    <KeyboardArrowUpIcon fontSize="small" /> Hide
                  </>
                ) : (
                  <Box sx={{ display: "flex", gap: "4px" }}>
                    <KeyboardArrowDownIcon fontSize="small" />{" "}
                    <Typography sx={{ color: "orange" }}>
                      {nestedMessages.length > 0 ? nestedMessages.length : ""}
                    </Typography>
                    <Typography sx={{ color: "orange" }}>
                      {nestedMessages.length > 2 ? "Replies" : "Reply"}
                    </Typography>
                  </Box>
                )}
              </Button>
              {tempText ? (
                <Box>
                  <Typography>{tempText}</Typography>
                </Box>
              ) : (
                <Tooltip title="Copy Thread of Messages">
                  <IconButton
                    onClick={() => {
                      copyThread(message.id);
                    }}
                  >
                    <ContentCopyIcon sx={{ color: "orange" }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>

          <MarkdownRender text={message.text} />
        </Box>

        {showReplies.has(message.id) && (
          <Box mt="8px">
            {!!message?.loadingReply ? (
              <Skeleton
                variant="rectangular"
                height={170}
                sx={{ borderRadius: "19px", mt: "10px" }}
              />
            ) : (
              <ChatInput
                user={user}
                type="reply"
                message={message}
                onSubmit={addReply}
                users={{}}
                confirmIt={() => {}}
                setEditing={() => {}}
                chatType={""}
                editing={""}
                placeholder="Write a reply..."
                consultant={true}
                disabled={loadingResponse}
              />
            )}
          </Box>
        )}

        <Box sx={{ mt: "14px" }}>
          {showReplies.has(message.id) &&
            nestedMessages
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((nested) => (
                <Message
                  key={nested.id}
                  message={nested}
                  showReplies={showReplies}
                  setShowReplies={setShowReplies}
                  user={user}
                  depth={depth + 1}
                  diagramId={diagramId}
                  setSelectedSolutionId={setSelectedSolutionId}
                  userImage={userImage}
                  selectedSolutionId={selectedSolutionId}
                />
              ))}
        </Box>
      </Box>
    </Box>
  );
};

export default React.memo(Message);
