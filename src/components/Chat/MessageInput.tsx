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
  Theme,
  Tooltip,
  useTheme,
} from "@mui/material";
import { getStorage } from "firebase/storage";
import React, { useCallback, useRef, useState } from "react";
import { Mention, MentionsInput } from "react-mentions";
import { MentionUser } from "./MentionUser";
import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";
import { IChatMessage } from " @components/types/IChat";
import { useUploadImage } from " @components/hooks/useUploadImage";
import { isValidHttpUrl } from " @components/lib/utils/utils";
import defaultStyle from "./defaultStyle";
import { getTaggedUsers } from " @components/lib/utils/string.utils";
import { SCROLL_BAR_STYLE } from " @components/lib/CONSTANTS";
import MessageInputFooter from "./MessageInputFooter";

type ChatInputProps = {
  user: any;
  type: string;
  message?: IChatMessage;
  onSubmit: any;
  onClose?: any;
  isEditing?: boolean;
  sx?: SxProps<Theme>;
  startListening: any;
  stopListening: any;
  isRecording: boolean;
  recordingType: string | null;
  users: any;
  confirmIt: any;
  editing?: any;
  setEditing: any;
  setOpenSelectModel?: React.Dispatch<React.SetStateAction<boolean>>;
};

const ChatInput = ({
  message,
  user,
  type,
  onSubmit,
  onClose,
  isEditing,
  sx,
  // startListening,
  // stopListening,
  // isRecording,
  // recordingType,
  users,
  confirmIt,
  editing,
  setEditing,
  setOpenSelectModel,
}: ChatInputProps) => {
  const theme = useTheme();
  const storage = getStorage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUrls, setImageUrls] = useState<string[]>(
    editing?.imageUrls || []
  );
  const [inputValue, setInputValue] = useState<string>(editing?.text || "");
  const { isUploading, percentageUploaded, uploadImage } = useUploadImage({
    storage,
  });

  const uploadImageClicked = useCallback(() => {
    fileInputRef?.current?.click();
  }, [fileInputRef]);

  let style = {
    // ...defaultStyle,
    highlighter: {
      boxSizing: "border-box",
      overflow: "hidden",
      height: 70,
    },

    control: {
      fontSize: 16,
      padding: "10px",
      boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.1)",
      border: "none",
      overFlow: "hidden",
    },
    input: {
      overflow: "auto",
      fontSize: 16,
      border: "none",
      outline: "none",
      width: "100%",
      color:
        theme.palette.mode === "dark"
          ? DESIGN_SYSTEM_COLORS.orange100
          : DESIGN_SYSTEM_COLORS.notebookG900,
      padding: "15px",
      paddingBottom: "0px",
      overFlow: "auto",
      fontFamily: "system-ui",
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

  const onUploadImage = useCallback(
    (event: any) => {
      try {
        let bucket: string = "ontology-41607.appspot.com";
        if (isValidHttpUrl(bucket)) {
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
          }
        );
      } catch (error) {
        confirmIt("Sorry, Your image could't get uploaded", "ok", "");
      }
    },
    [setImageUrls, user]
  );
  const onKeyDown = (e: any) => {
    if (e.key === "Enter" && (e.shiftKey || e.metaKey)) {
      e.preventDefault();
      setInputValue(inputValue + "\n");
    } else if (e.key === "Enter" || e.keyCode === 13) {
      e.preventDefault();
      if (inputValue) {
        if (type === "reply") {
          if (isEditing) {
            onSubmit(
              inputValue,
              imageUrls,
              message?.parentMessage,
              message?.id
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
        mt: "10px",
        border: (theme) =>
          `solid 1px ${
            theme.palette.mode === "light"
              ? DESIGN_SYSTEM_COLORS.gray300
              : DESIGN_SYSTEM_COLORS.notebookG500
          }`,
        borderRadius: "10px",
        backgroundColor: (theme) =>
          theme.palette.mode === "dark"
            ? DESIGN_SYSTEM_COLORS.notebookG700
            : DESIGN_SYSTEM_COLORS.gray100,
        ...sx,
        ...SCROLL_BAR_STYLE,
        pb: 0,
      }}
    >
      <MentionsInput
        id="comment-mention"
        className="comment-input"
        placeholder="Type your message here..."
        style={style}
        value={inputValue}
        singleLine={false}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => onKeyDown(e)}
      >
        <Mention
          trigger="@"
          data={users}
          displayTransform={(id, display) => {
            return `@${display}`;
          }}
          markup="[@__display__](__id__)"
          renderSuggestion={(suggestion: any) => (
            <MentionUser user={suggestion} />
          )}
          appendSpaceOnAdd={true}
          style={{
            backgroundColor: "#0d8fad",
            paddingRight: "5px",
          }}
        />
      </MentionsInput>
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
      />
    </Box>
  );
};

export default ChatInput;
