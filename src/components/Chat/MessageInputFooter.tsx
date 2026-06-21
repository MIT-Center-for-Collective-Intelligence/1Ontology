import React, { useRef } from "react";
import { Box, Tooltip, IconButton, Button, useTheme } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CollectionsIcon from "@mui/icons-material/Collections";
import AddLinkIcon from "@mui/icons-material/AddLink";

interface MessageInputFooterProps {
  imageUrls: string[];
  isUploading: boolean;
  percentageUploaded: number;
  onUploadImage: (event: React.ChangeEvent<HTMLInputElement>) => void;
  uploadImageClicked: () => void;
  setOpenSelectModel?: (open: boolean) => void;
  onClose?: () => void;
  handleSendMessage: () => void;
  inputValue: string;
  setImageUrls: React.Dispatch<React.SetStateAction<string[]>>;
  chatType: string;
}

const MessageInputFooter: React.FC<MessageInputFooterProps> = ({
  imageUrls,
  isUploading,
  percentageUploaded,
  onUploadImage,
  uploadImageClicked,
  setOpenSelectModel,
  onClose,
  handleSendMessage,
  inputValue,
  setImageUrls,
  chatType,
}) => {
  const theme = useTheme();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const iconMuted =
    theme.palette.mode === "dark"
      ? "rgba(245, 245, 247, 0.88)"
      : "rgba(29, 29, 31, 0.72)";
  const sendOrange = "#E68A4D";
  const sendDisabledBg =
    theme.palette.mode === "dark"
      ? "rgba(255, 255, 255, 0.12)"
      : "rgba(0, 0, 0, 0.08)";

  return (
    <Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", px: 2.5, pt: 0.5 }}>
        {(imageUrls || []).map((imageUrl) => (
          <Box
            key={imageUrl}
            sx={{
              display: "flex",
              position: "relative",
              "&:hover .close-icon": { opacity: 1 },
              width: "100px",
              p: 1,
            }}
          >
            <Tooltip title="Remove Image" placement="top">
              <CloseIcon
                className="close-icon"
                sx={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  zIndex: 1,
                  cursor: "pointer",
                  borderRadius: "50%",
                  opacity: 0,
                  transition: "opacity 0.3s",
                  backgroundColor: "grey",
                  color: "white",
                  height: "20px",
                  width: "20px",
                }}
                onClick={() =>
                  setImageUrls((prev) =>
                    prev.filter((image) => image !== imageUrl),
                  )
                }
              />
            </Tooltip>
            <img
              width="100%"
              style={{ borderRadius: "8px", objectFit: "contain" }}
              src={imageUrl}
              alt=""
            />
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          px: 2.5,
          pb: 2,
          pt: 0.5,
        }}
      >
        <Box
          sx={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={onUploadImage}
              hidden
            />
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {isUploading ? (
                <span
                  style={{
                    minWidth: 40,
                    fontSize: 12,
                    fontWeight: 500,
                    textAlign: "center",
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
                    color: iconMuted,
                  }}
                >
                  {percentageUploaded + "%"}
                </span>
              ) : chatType ? (
                <Tooltip title="Upload Image">
                  <IconButton
                    onClick={uploadImageClicked}
                    size="small"
                    sx={{
                      color: iconMuted,
                      borderRadius: "12px",
                      p: 1,
                      "&:hover": {
                        backgroundColor:
                          theme.palette.mode === "dark"
                            ? "rgba(255, 255, 255, 0.08)"
                            : "rgba(0, 0, 0, 0.06)",
                      },
                    }}
                  >
                    <CollectionsIcon sx={{ fontSize: 22 }} />
                  </IconButton>
                </Tooltip>
              ) : (
                <></>
              )}
            </Box>
            {setOpenSelectModel && (
              <Tooltip title="Share a node">
                <IconButton
                  onClick={() => setOpenSelectModel(true)}
                  size="small"
                  sx={{
                    color: iconMuted,
                    borderRadius: "12px",
                    p: 1,
                    "&:hover": {
                      backgroundColor:
                        theme.palette.mode === "dark"
                          ? "rgba(255, 255, 255, 0.08)"
                          : "rgba(0, 0, 0, 0.06)",
                    },
                  }}
                >
                  <AddLinkIcon sx={{ fontSize: 22 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {onClose && (
              <Button
                onClick={onClose}
                variant="text"
                disabled={!inputValue && !imageUrls?.length}
                sx={{
                  minWidth: 0,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: "12px",
                  textTransform: "none",
                  fontWeight: 500,
                  fontSize: 15,
                  color: iconMuted,
                }}
              >
                Cancel
              </Button>
            )}
            <Tooltip
              title={
                /Mac/i.test(navigator.userAgent) ? "⌘ + Enter" : "Ctrl + Enter"
              }
            >
              <Button
                onClick={handleSendMessage}
                variant="contained"
                disableElevation
                disabled={!inputValue && !imageUrls?.length}
                sx={{
                  minWidth: 44,
                  width: 44,
                  height: 44,
                  p: 0,
                  borderRadius: "14px",
                  boxShadow: "none",
                  backgroundColor: onClose
                    ? theme.palette.mode === "dark"
                      ? "rgba(52, 199, 89, 0.95)"
                      : "#34c759"
                    : sendOrange,
                  color: "#fff",
                  "&:hover": {
                    boxShadow: "none",
                    backgroundColor: onClose
                      ? theme.palette.mode === "dark"
                        ? "rgba(52, 199, 89, 1)"
                        : "#30b350"
                      : "#d97a3d",
                  },
                  "&.Mui-disabled": {
                    backgroundColor: sendDisabledBg,
                    color:
                      theme.palette.mode === "dark"
                        ? "rgba(245, 245, 247, 0.35)"
                        : "rgba(29, 29, 31, 0.28)",
                  },
                }}
              >
                {onClose ? (
                  "Save"
                ) : (
                  <svg
                    width="19"
                    height="19"
                    viewBox="0 0 18 18"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    stroke="currentColor"
                  >
                    <path
                      d="M7.74976 10.2501L16.4998 1.50014M7.85608 10.5235L10.0462 16.1552C10.2391 16.6513 10.3356 16.8994 10.4746 16.9718C10.5951 17.0346 10.7386 17.0347 10.8592 16.972C10.9983 16.8998 11.095 16.6518 11.2886 16.1559L16.7805 2.08281C16.9552 1.63516 17.0426 1.41133 16.9948 1.26831C16.9533 1.1441 16.8558 1.04663 16.7316 1.00514C16.5886 0.957356 16.3647 1.0447 15.9171 1.21939L1.84398 6.71134C1.34808 6.90486 1.10013 7.00163 1.02788 7.14071C0.965237 7.26129 0.965322 7.40483 1.0281 7.52533C1.10052 7.66433 1.34859 7.7608 1.84471 7.95373L7.47638 10.1438C7.57708 10.183 7.62744 10.2026 7.66984 10.2328C7.70742 10.2596 7.74028 10.2925 7.76709 10.3301C7.79734 10.3725 7.81692 10.4228 7.85608 10.5235Z"
                      stroke="inherit"
                      strokeWidth="1.66667"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </Button>
            </Tooltip>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default MessageInputFooter;
