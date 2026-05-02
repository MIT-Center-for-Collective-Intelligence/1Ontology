// import MicIcon from "@mui/icons-material/Mic";
// import SettingsVoiceIcon from "@mui/icons-material/SettingsVoice";
import { Box, SxProps, TextField, Theme, useTheme } from "@mui/material";
import { getStorage } from "firebase/storage";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Mention, MentionsInput, MentionsInputStyle } from "react-mentions";
import { MentionUser } from "./MentionUser";
import { DESIGN_SYSTEM_COLORS } from "@components/lib/theme/colors";
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
  const [imageUrls, setImageUrls] = useState<string[]>(
    editing?.imageUrls || [],
  );
  const [inputValue, setInputValue] = useState<string>(editing?.text || "");
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

  let style: MentionsInputStyle = {
    highlighter: {
      boxSizing: "border-box",
      overflow: "hidden",
      height: "auto",
      minHeight: textAreaMinHeight,
      maxHeight: "300px",
    },
    control: {
      fontSize: 15,
      lineHeight: 1.45,
      padding: "0",
      boxShadow: "none",
      border: "none",
      overflow: "hidden",
      minHeight: textAreaMinHeight,
      maxHeight: "300px",
      height: "auto",
      resize: "none",
      backgroundColor: "transparent",
    },
    input: {
      overflow: "auto",
      fontSize: 15,
      lineHeight: 1.45,
      border: "none",
      outline: "none",
      width: "100%",
      color: theme.palette.mode === "dark" ? "#f5f5f7" : "#1d1d1f",
      padding: "16px 20px 8px",
      fontFamily: inputFont,
      minHeight: textAreaMinHeight,
      maxHeight: "300px",
      height: "auto",
      resize: "none",
      boxSizing: "border-box",
    },
    suggestions: {
      list: {
        background:
          theme.palette.mode === "dark"
            ? DESIGN_SYSTEM_COLORS.notebookG700
            : DESIGN_SYSTEM_COLORS.gray100,
        padding: "2px",
        fontSize: 16,
        maxHeight: "150px",
        overflowY: "auto",
      },
    },
  };

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
          (message: any) => {
            confirmIt(message, "ok", "");
          },
        );
      } catch (error) {
        confirmIt("Sorry, Your image could't get uploaded", "ok", "");
      }
    },
    [setImageUrls, user],
  );
  const onKeyDown = (event: any) => {
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

  return (
    <Box
      sx={[
        {
          borderRadius: "26px",
          border: (t) =>
            t.palette.mode === "dark"
              ? "1px solid rgba(255, 255, 255, 0.12)"
              : "1px solid rgba(0, 0, 0, 0.08)",
          backgroundColor: (t) =>
            t.palette.mode === "dark" ? "#333333" : "#e8e8ed",
          boxShadow: (t) =>
            t.palette.mode === "dark"
              ? "0 1px 0 rgba(255, 255, 255, 0.06) inset, 0 8px 24px rgba(0, 0, 0, 0.18)"
              : "0 1px 0 rgba(255, 255, 255, 0.7) inset, 0 4px 18px rgba(0, 0, 0, 0.06)",
          pb: 0,
          overflow: "hidden",
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
          onKeyDown={onKeyDown}
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
        <Box
          sx={{
            "& textarea::placeholder": {
              color:
                theme.palette.mode === "dark"
                  ? "rgba(245, 245, 247, 0.45)"
                  : "rgba(29, 29, 31, 0.35)",
              opacity: 1,
            },
          }}
        >
          <MentionsInput
            id="comment-mention"
            className="comment-input"
            placeholder={placeholder}
            style={style}
            value={inputValue}
            singleLine={false}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => onKeyDown(e)}
          >
            <Mention
              trigger="@"
              data={users}
              displayTransform={(id, display) => `@${display}`}
              markup="[@__display__](__id__)"
              renderSuggestion={(suggestion: any) => (
                <MentionUser user={suggestion} />
              )}
              appendSpaceOnAdd={true}
              style={{
                backgroundColor:
                  theme.palette.mode === "dark"
                    ? "rgba(10, 132, 255, 0.35)"
                    : "rgba(0, 122, 255, 0.22)",
              }}
            />
          </MentionsInput>
        </Box>
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
