import CloseIcon from "@mui/icons-material/Close";
import CollectionsIcon from "@mui/icons-material/Collections";
import AddLinkIcon from "@mui/icons-material/AddLink";
// import MicIcon from "@mui/icons-material/Mic";
// import SettingsVoiceIcon from "@mui/icons-material/SettingsVoice";
import {
  Box,
  Button,
  IconButton,
  SxProps,
  TextField,
  Theme,
  Tooltip,
  useTheme,
} from "@mui/material";
import { getStorage } from "firebase/storage";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Mention, MentionsInput, MentionsInputStyle } from "react-mentions";
import { MentionUser } from "./MentionUser";
import { DESIGN_SYSTEM_COLORS } from "@components/lib/theme/colors";
import { IChatMessage } from "@components/types/IChat";
import { useUploadImage } from "@components/hooks/useUploadImage";
import { isValidHttpUrl } from "@components/lib/utils/utils";
import defaultStyle from "./defaultStyle";
import { getTaggedUsers } from "@components/lib/utils/string.utils";
import { development, SCROLL_BAR_STYLE } from "@components/lib/CONSTANTS";
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

  let style: MentionsInputStyle = {
    highlighter: {
      boxSizing: "border-box",
      overflow: "hidden",
      height: "auto",
      minHeight: "5px",
      maxHeight: "300px",
    },
    control: {
      fontSize: 16,
      padding: "10px",
      boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.1)",
      border: "none",
      overflow: "hidden",
      minHeight: "5px",
      maxHeight: "300px",
      height: "auto",
      resize: "none",
    },
    input: {
      overflow: "auto",
      fontSize: 16,
      border: "none",
      outline: "none",
      width: "100%",
      color: theme.palette.mode === "dark" ? "white" : "black",
      padding: "15px",
      paddingBottom: "0px",
      fontFamily: "system-ui",
      minHeight: "40px",
      maxHeight: "300px",
      height: "auto",
      resize: "none",
      ...SCROLL_BAR_STYLE,
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
    ...SCROLL_BAR_STYLE,
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
      sx={{
        border: (theme) =>
          `solid 1px ${
            theme.palette.mode === "light"
              ? DESIGN_SYSTEM_COLORS.gray300
              : "gray"
          }`,
        borderRadius: "10px",
        backgroundColor: (theme) =>
          theme.palette.mode === "dark" ? "#363636" : "#d4d6d7",
        ...SCROLL_BAR_STYLE,
        pb: 0,
      }}
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
                fontSize: 16,
                padding: "15px",
                paddingBottom: "0px",
                fontFamily: "system-ui",
                color: theme.palette.mode === "dark" ? "white" : "black",
                ...SCROLL_BAR_STYLE,
              },
            },
          }}
        />
      ) : (
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
            style={{ backgroundColor: "#0d8fad" }}
          />
        </MentionsInput>
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
