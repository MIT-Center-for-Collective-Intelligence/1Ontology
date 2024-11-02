import React, { useState, useRef } from "react";
import { Box, Tooltip, IconButton, Button } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CollectionsIcon from "@mui/icons-material/Collections";
import AddLinkIcon from "@mui/icons-material/AddLink";
import { DESIGN_SYSTEM_COLORS } from " @components/lib/theme/colors";

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
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <Box>
      <Box sx={{ display: "flex" }}>
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
                    prev.filter((image) => image !== imageUrl)
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

      <Box sx={{ width: "100%", display: "flex", alignItems: "center" }}>
        <Box
          sx={{
            width: "100%",
            p: "0px 8px 8px 8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={onUploadImage}
              hidden
            />
            <Box sx={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {isUploading ? (
                <span
                  style={{
                    width: "37px",
                    fontSize: "11px",
                    textAlign: "center",
                  }}
                >
                  {percentageUploaded + "%"}
                </span>
              ) : (
                <Tooltip title="Upload Image">
                  <IconButton onClick={uploadImageClicked}>
                    <CollectionsIcon
                      sx={{
                        color: (theme) =>
                          theme.palette.mode === "dark"
                            ? "notebookG200"
                            : undefined,
                      }}
                    />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
            {setOpenSelectModel && (
              <Tooltip title="Share a node">
                <IconButton onClick={() => setOpenSelectModel(true)}>
                  <AddLinkIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          <Box sx={{ display: "flex", gap: "10px" }}>
            {onClose && (
              <Button
                onClick={onClose}
                variant="outlined"
                // color="error"
                disabled={!inputValue && !imageUrls?.length}
                sx={{
                  minWidth: "0px",
                  // width: "36px",
                  height: "36px",
                  p: "10px",
                  borderRadius: "8px",
                }}
              >
                Cancel
              </Button>
            )}
            <Button
              onClick={handleSendMessage}
              variant="contained"
              disabled={!inputValue && !imageUrls?.length}
              sx={{
                minWidth: "0px",
                mr: "3px",
                // width:  "36px",
                height: "36px",
                p: "10px",
                borderRadius: "8px",
                backgroundColor: onClose ? "green" : "",
              }}
            >
              {onClose ? (
                "Save"
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  stroke={
                    !inputValue && !imageUrls?.length
                      ? DESIGN_SYSTEM_COLORS.notebookG200
                      : "white"
                  }
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
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default MessageInputFooter;
