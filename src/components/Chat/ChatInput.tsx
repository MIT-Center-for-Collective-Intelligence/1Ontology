// import MicIcon from "@mui/icons-material/Mic";
// import SettingsVoiceIcon from "@mui/icons-material/SettingsVoice";
import { Box, Paper, Popper, SxProps, TextField, Theme, useTheme } from "@mui/material";
import { getStorage } from "firebase/storage";
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { MentionUser } from "./MentionUser";
import {
  applyPlainTextEdit,
  caretAfterMentionInsert,
  getActiveMentionQuery,
  insertMentionMarkup,
  markupToPlain,
} from "./mentionMarkup";
import { getTextareaCaretClientRect } from "./textareaCaret";
import { IChatMessage } from "@components/types/IChat";
import { useUploadImage } from "@components/hooks/useUploadImage";
import { isValidHttpUrl } from "@components/lib/utils/utils";
import { getTaggedUsers } from "@components/lib/utils/string.utils";
import { development } from "@components/lib/CONSTANTS";
import MessageInputFooter from "./MessageInputFooter";

type ChatInputProps = {
  user: any;
  type: string;
  message?: IChatMessage;
  onSubmit: any;
  onClose?: any;
  isEditing?: boolean;
  sx?: SxProps<Theme>;
  users: any;
  confirmIt: any;
  editing: any;
  setEditing: any;
  setOpenSelectModel?: React.Dispatch<React.SetStateAction<boolean>>;
  chatType: string;
  placeholder: string;
  consultant?: boolean;
};

/** Minimum textarea height when empty (composer feels tappable, matches ~3 lines). */
const CHAT_INPUT_TEXT_MIN_HEIGHT_PX = 96;

const MENTION_POPPER_Z = 12_000;

const ChatInput = ({
  message,
  user,
  type,
  onSubmit,
  onClose,
  isEditing,
  users,
  confirmIt,
  editing,
  setEditing,
  setOpenSelectModel,
  chatType,
  placeholder,
  consultant,
  sx,
}: ChatInputProps) => {
  const theme = useTheme();
  const storage = getStorage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mentionsTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const restoreSelectionRef = useRef(false);
  const selectionRef = useRef({ start: 0, end: 0 });

  const [imageUrls, setImageUrls] = useState<string[]>(
    editing?.imageUrls || [],
  );
  const [inputValue, setInputValue] = useState<string>(editing?.text || "");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionAnchor, setMentionAnchor] = useState<{
    top: number;
    left: number;
    height: number;
  } | null>(null);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [mentionHighlight, setMentionHighlight] = useState(0);

  const { isUploading, percentageUploaded, uploadImage } = useUploadImage({
    storage,
  });

  const uploadImageClicked = useCallback(() => {
    fileInputRef?.current?.click();
  }, [fileInputRef]);

  const inputFont =
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif';

  const chatInputScrollbar = {
    scrollbarWidth: "thin" as const,
    scrollbarColor:
      theme.palette.mode === "dark"
        ? "rgba(255, 255, 255, 0.28) transparent"
        : "rgba(0, 0, 0, 0.22) transparent",
    "&::-webkit-scrollbar": {
      width: 5,
      height: 5,
    },
    "&::-webkit-scrollbar-track": {
      backgroundColor: "transparent",
    },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor:
        theme.palette.mode === "dark"
          ? "rgba(255, 255, 255, 0.22)"
          : "rgba(0, 0, 0, 0.18)",
      borderRadius: 10,
      border: "2px solid transparent",
      backgroundClip: "padding-box",
    },
    "&::-webkit-scrollbar-thumb:hover": {
      backgroundColor:
        theme.palette.mode === "dark"
          ? "rgba(255, 255, 255, 0.38)"
          : "rgba(0, 0, 0, 0.28)",
    },
  };

  const textAreaMinHeight = `${CHAT_INPUT_TEXT_MIN_HEIGHT_PX}px`;
  const inputPad = "16px 20px 8px";

  const syncMentionPopper = useCallback(
    (plain: string, caret: number) => {
      const ta = mentionsTextareaRef.current;
      const ctx = getActiveMentionQuery(plain, caret);
      if (!ctx || !ta) {
        setMentionOpen(false);
        setMentionAnchor(null);
        return;
      }
      const list = Array.isArray(users) ? users : [];
      const q = ctx.query.toLowerCase();
      const next = list.filter((u: any) => {
        const d = (u.display ?? u.fullName ?? u.id ?? "").toLowerCase();
        return d.includes(q);
      });
      setFilteredUsers(next);
      setMentionHighlight(0);
      const r = getTextareaCaretClientRect(ta, caret);
      setMentionAnchor({
        top: r.top,
        left: r.left,
        height: r.height,
      });
      setMentionOpen(next.length > 0);
    },
    [users],
  );

  useLayoutEffect(() => {
    if (!restoreSelectionRef.current) return;
    restoreSelectionRef.current = false;
    const ta = mentionsTextareaRef.current;
    if (!ta) return;
    const { start, end } = selectionRef.current;
    try {
      ta.setSelectionRange(start, end);
    } catch {
      /* ignore */
    }
  }, [inputValue]);

  useEffect(() => {
    if (!!consultant) return;
    const savedInputValue = localStorage.getItem(
      `chatInputValue-${type}-${chatType}`,
    );
    if (isEditing) {
      setInputValue(editing?.text);
      return;
    }
    if (savedInputValue) {
      setInputValue(savedInputValue);
    } else {
      setInputValue("");
    }
  }, [chatType, type, isEditing]);

  useEffect(() => {
    if (!isEditing && !consultant) {
      localStorage.setItem(`chatInputValue-${type}-${chatType}`, inputValue);
    }
  }, [inputValue, chatType, type, isEditing]);

  const onUploadImage = useCallback(
    (event: any) => {
      try {
        let bucket = development
          ? process.env.NEXT_PUBLIC_DEV_STORAGE_BUCKET
          : process.env.NEXT_PUBLIC_STORAGE_BUCKET;

        if (bucket && isValidHttpUrl(bucket)) {
          const { hostname } = new URL(bucket);
          bucket = hostname;
        }
        const path =
          "https://storage.googleapis.com/" +
          bucket +
          `/ontology-chat-images/${user.userId}`;
        let imageFileName = new Date().toUTCString();
        uploadImage({ event, path, imageFileName }).then(
          (url: string) => {
            setImageUrls((prev: string[]) => [...prev, url]);
          },
          (msg: any) => {
            confirmIt(msg, "ok", "");
          },
        );
      } catch (error) {
        confirmIt("Sorry, Your image could't get uploaded", "ok", "");
      }
    },
    [setImageUrls, user, confirmIt, uploadImage],
  );

  const pickMention = useCallback(
    (u: any) => {
      const ta = mentionsTextareaRef.current;
      if (!ta) return;
      const plain = markupToPlain(inputValue);
      const caret = ta.selectionStart;
      const ctx = getActiveMentionQuery(plain, caret);
      if (!ctx) return;
      const display = u.display ?? u.fullName ?? u.id;
      const id = String(u.id ?? u.userId ?? "");
      const nextMarkup = insertMentionMarkup(
        inputValue,
        plain,
        ctx.atPlainIndex,
        caret,
        display,
        id,
      );
      const newCaret = caretAfterMentionInsert(ctx.atPlainIndex, display);
      selectionRef.current = { start: newCaret, end: newCaret };
      restoreSelectionRef.current = true;
      setInputValue(nextMarkup);
      setMentionOpen(false);
      setMentionAnchor(null);
    },
    [inputValue],
  );

  const handleComposerKeyDown = (event: React.KeyboardEvent) => {
    if (
      mentionOpen &&
      filteredUsers.length > 0 &&
      !event.metaKey &&
      !event.ctrlKey
    ) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMentionHighlight((h) => (h + 1) % filteredUsers.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionHighlight(
          (h) => (h - 1 + filteredUsers.length) % filteredUsers.length,
        );
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        pickMention(filteredUsers[mentionHighlight]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMentionOpen(false);
        return;
      }
    }

    if (
      event.key === "Enter" &&
      (event.metaKey || event.ctrlKey) &&
      (imageUrls.length > 0 || inputValue.trim())
    ) {
      event.preventDefault();
      if (inputValue) {
        if (type === "reply") {
          if (isEditing) {
            onSubmit(
              inputValue,
              imageUrls,
              message?.parentMessage,
              message?.id,
            );
          } else {
            const subscribed = [
              ...(message?.subscribed || []),
              message?.sender || "",
            ];
            const taggedUsers = getTaggedUsers(inputValue);
            subscribed.forEach((item) => taggedUsers.add(item));
            onSubmit(inputValue, imageUrls, message?.id, taggedUsers);
          }
        } else {
          if (isEditing) {
            onSubmit(inputValue, imageUrls, message?.id);
          } else {
            const taggedUsers = getTaggedUsers(inputValue);
            onSubmit(inputValue, imageUrls, taggedUsers);
          }
        }
      }
      setEditing(null);
      setImageUrls([]);
      setInputValue("");
    }
  };

  const handleSendMessage = () => {
    if (type === "reply") {
      if (isEditing) {
        onSubmit(inputValue, imageUrls, message?.parentMessage, message?.id);
      } else {
        const taggedUsers = getTaggedUsers(inputValue);
        onSubmit(inputValue, imageUrls, message?.id, taggedUsers);
      }
    } else {
      if (isEditing) {
        onSubmit(inputValue, imageUrls, message?.id);
      } else {
        const taggedUsers = getTaggedUsers(inputValue);
        onSubmit(inputValue, imageUrls, taggedUsers);
      }
    }
    setEditing(null);
    setImageUrls([]);
    setInputValue("");
  };

  const handleMentionTextChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const ta = e.target as HTMLTextAreaElement;
    const newPlain = ta.value;
    const prevPlain = markupToPlain(inputValue);
    const nextMarkup = applyPlainTextEdit(inputValue, prevPlain, newPlain);
    selectionRef.current = {
      start: ta.selectionStart,
      end: ta.selectionEnd,
    };
    restoreSelectionRef.current = true;
    setInputValue(nextMarkup);
    syncMentionPopper(newPlain, ta.selectionStart);
  };

  const handleSelectOrClick = () => {
    const ta = mentionsTextareaRef.current;
    if (!ta) return;
    const plain = markupToPlain(inputValue);
    syncMentionPopper(plain, ta.selectionStart);
  };

  const isDark = theme.palette.mode === "dark";

  return (
    <Box
      sx={[
        {
          borderRadius: "26px",
          border: (t) =>
            t.palette.mode === "dark"
              ? "1px solid rgba(255, 255, 255, 0.12)"
              : "1px solid gray",
          backgroundColor: (t) =>
            t.palette.mode === "dark" ? "#333333" : "#e8e8ed",
          boxShadow: (t) =>
            t.palette.mode === "dark"
              ? "0 1px 0 rgba(255, 255, 255, 0.06) inset, 0 8px 24px rgba(0, 0, 0, 0.18)"
              : "0 1px 0 rgba(255, 255, 255, 0.7) inset, 0 4px 18px rgba(0, 0, 0, 0.06)",
          pb: 0,
          overflow: "hidden",
          position: "relative",
          "& #comment-mention, & .comment-input textarea": chatInputScrollbar,
          "& .MuiInputBase-inputMultiline": chatInputScrollbar,
        },
        ...(sx ? (Array.isArray(sx) ? sx : [sx]) : []),
      ]}
    >
      {consultant ? (
        <TextField
          multiline
          fullWidth
          variant="standard"
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleComposerKeyDown}
          slotProps={{
            input: {
              disableUnderline: true,
              style: {
                fontSize: 15,
                lineHeight: 1.45,
                padding: "16px 20px 8px",
                fontFamily: inputFont,
                color: theme.palette.mode === "dark" ? "#f5f5f7" : "#1d1d1f",
                minHeight: textAreaMinHeight,
                boxSizing: "border-box",
              },
            },
          }}
          sx={{
            "& .MuiInputBase-inputMultiline": {
              minHeight: textAreaMinHeight,
              boxSizing: "border-box",
            },
            "& .MuiInputBase-input::placeholder": {
              color:
                theme.palette.mode === "dark"
                  ? "rgba(245, 245, 247, 0.45)"
                  : "rgba(29, 29, 31, 0.35)",
              opacity: 1,
            },
          }}
        />
      ) : (
        <>
          <TextField
            id="comment-mention"
            className="comment-input"
            multiline
            fullWidth
            variant="standard"
            placeholder={placeholder}
            value={markupToPlain(inputValue)}
            onChange={handleMentionTextChange}
            onKeyDown={handleComposerKeyDown}
            onSelect={handleSelectOrClick}
            onClick={handleSelectOrClick}
            inputRef={mentionsTextareaRef}
            slotProps={{
              input: {
                disableUnderline: true,
                "aria-autocomplete": "list",
                "aria-expanded": mentionOpen,
                role: "combobox",
                style: {
                  fontSize: 15,
                  lineHeight: 1.45,
                  padding: inputPad,
                  fontFamily: inputFont,
                  color: isDark ? "#f5f5f7" : "#1d1d1f",
                  minHeight: textAreaMinHeight,
                  boxSizing: "border-box",
                },
              },
            }}
            sx={{
              "& .MuiInputBase-inputMultiline": {
                minHeight: textAreaMinHeight,
                boxSizing: "border-box",
              },
              "& .MuiInputBase-input::placeholder": {
                color: isDark
                  ? "rgba(245, 245, 247, 0.45)"
                  : "rgba(29, 29, 31, 0.35)",
                WebkitTextFillColor: isDark
                  ? "rgba(245, 245, 247, 0.45)"
                  : "rgba(29, 29, 31, 0.35)",
                opacity: 1,
              },
            }}
          />
          <Popper
            open={mentionOpen && !!mentionAnchor && filteredUsers.length > 0}
            anchorEl={
              mentionAnchor
                ? {
                    getBoundingClientRect: () =>
                      new DOMRect(
                        mentionAnchor.left,
                        mentionAnchor.top,
                        0,
                        mentionAnchor.height,
                      ),
                  }
                : null
            }
            placement="top-start"
            style={{ zIndex: MENTION_POPPER_Z }}
            modifiers={[
              { name: "offset", options: { offset: [0, 8] } },
              {
                name: "preventOverflow",
                options: { padding: 8, boundary: "viewport" },
              },
            ]}
          >
            <Paper
              elevation={0}
              sx={{
                minWidth: 272,
                maxWidth: 320,
                maxHeight: 238,
                overflow: "hidden",
                borderRadius: "14px",
                border: isDark
                  ? "1px solid rgba(255, 255, 255, 0.12)"
                  : "1px solid rgba(0, 0, 0, 0.08)",
                boxShadow: isDark
                  ? "0 18px 48px rgba(0, 0, 0, 0.55), 0 0 1px rgba(255, 255, 255, 0.2)"
                  : "0 14px 44px rgba(0, 0, 0, 0.14), 0 0 1px rgba(0, 0, 0, 0.08)",
                backgroundColor: isDark
                  ? "rgba(44, 44, 46, 0.96)"
                  : "rgba(255, 255, 255, 0.96)",
                backdropFilter: "blur(28px) saturate(180%)",
              }}
            >
              <Box
                component="ul"
                role="listbox"
                aria-label="People"
                sx={{
                  m: 0,
                  p: 0.75,
                  maxHeight: 230,
                  overflowY: "auto",
                  listStyle: "none",
                  fontFamily: inputFont,
                  scrollbarWidth: "thin",
                  scrollbarColor: isDark
                    ? "rgba(255, 255, 255, 0.28) transparent"
                    : "rgba(0, 0, 0, 0.22) transparent",
                }}
              >
                {filteredUsers.map((u: any, i: number) => (
                  <Box
                    component="li"
                    key={String(u.id ?? u.userId ?? i)}
                    role="option"
                    aria-selected={i === mentionHighlight}
                    onMouseDown={(ev) => {
                      ev.preventDefault();
                      pickMention(u);
                    }}
                    onMouseEnter={() => setMentionHighlight(i)}
                    sx={{
                      borderRadius: "10px",
                      cursor: "pointer",
                      bgcolor:
                        i === mentionHighlight
                          ? isDark
                            ? "rgba(255, 255, 255, 0.11)"
                            : "rgba(0, 0, 0, 0.06)"
                          : "transparent",
                      transition: "background-color 0.12s ease",
                    }}
                  >
                    <MentionUser user={u} focused={i === mentionHighlight} />
                  </Box>
                ))}
              </Box>
            </Paper>
          </Popper>
        </>
      )}

      <MessageInputFooter
        imageUrls={imageUrls}
        isUploading={isUploading}
        percentageUploaded={percentageUploaded}
        onUploadImage={onUploadImage}
        uploadImageClicked={uploadImageClicked}
        setOpenSelectModel={setOpenSelectModel}
        onClose={onClose}
        handleSendMessage={handleSendMessage}
        inputValue={inputValue}
        setImageUrls={setImageUrls}
        chatType={chatType}
      />
      <input
        type="file"
        ref={fileInputRef}
        onChange={onUploadImage}
        accept="image/png, image/jpg, image/jpeg"
        hidden
      />
    </Box>
  );
};

export default ChatInput;
