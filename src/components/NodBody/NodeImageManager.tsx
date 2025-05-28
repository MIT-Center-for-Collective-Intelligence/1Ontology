import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  CircularProgress,
  Button,
  Stack,
  Paper,
  Dialog,
  DialogContent,
  MobileStepper,
} from "@mui/material";
import {
  Close as CloseIcon,
  Collections as CollectionsIcon,
  Add as AddIcon,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import {
  doc,
  updateDoc,
  arrayUnion,
  collection,
  onSnapshot,
  arrayRemove,
  Timestamp,
  getFirestore,
} from "firebase/firestore";
import {
  deleteObject,
  FirebaseStorage,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { useUploadImage } from "@components/hooks/useUploadImage";
import { isValidHttpUrl } from "@components/lib/utils/utils";
import { User } from "@components/types/IAuth";
import OptimizedAvatar from "../Chat/OptimizedAvatar";
import dayjs from "dayjs";
import useDialog from "@components/lib/hooks/useConfirmDialog";
import { INode, NodeChange } from "@components/types/INode";
import PropertyContributors from "../StructuredProperty/PropertyContributors";
import { updateInheritance } from "@components/lib/utils/helpers";

type UploadUserInfo = {
  userId: string;
  fName: string;
  lName: string;
  uname: string;
  imageUrl: string;
};

type NodeImage = {
  url: string;
  path: string;
  uploadedAt: any;
  uploadedBy: UploadUserInfo;
};

type PreviewImage = {
  file: File;
  previewUrl: string;
};

type NodeImageManagerProps = {
  nodeId: string;
  currentVisibleNode: INode;
  user: User;
  firestore: any;
  storage: FirebaseStorage;
  nodeCollection?: string;
  confirmIt: any;
  saveNewChangeLog: Function;
  selectedDiffNode: NodeChange | null;
  nodes: { [id: string]: INode };
  getTitleNode: any;
  enableEdit: any;
};

export const NodeImageManager: React.FC<NodeImageManagerProps> = ({
  nodeId,
  currentVisibleNode,
  user,
  firestore,
  storage,
  nodeCollection = "nodes",
  confirmIt,
  saveNewChangeLog,
  selectedDiffNode,
  nodes,
  getTitleNode,
  enableEdit,
}) => {
  const [nodeImages, setNodeImages] = useState<NodeImage[]>([]);
  const [selectedImages, setSelectedImages] = useState<PreviewImage[]>([]);
  // const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const db = getFirestore();

  const handleImageClick = (index: number) => {
    setSelectedImageIndex(index);
    setViewerOpen(true);
  };

  const getImageDiffStatus = (image: NodeImage) => {
    if (!selectedDiffNode || selectedDiffNode.modifiedProperty !== "images") {
      return null;
    }

    const previousUrls =
      selectedDiffNode.previousValue?.map((img: NodeImage) => img.url) || [];
    const newUrls =
      selectedDiffNode.newValue?.map((img: NodeImage) => img.url) || [];

    if (selectedDiffNode.changeType === "add images") {
      return !previousUrls.includes(image.url) ? "added" : null;
    }

    if (selectedDiffNode.changeType === "remove images") {
      return !newUrls.includes(image.url) ? "removed" : null;
    }

    return null;
  };

  const getDisplayImages = () => {
    if (!selectedDiffNode) return nodeImages;

    if (selectedDiffNode.changeType === "add images") {
      return selectedDiffNode.newValue || [];
    }

    if (selectedDiffNode.changeType === "remove images") {
      return selectedDiffNode.previousValue || [];
    }

    return nodeImages;
  };

  const displayImages = getDisplayImages();

  const handleDeleteClick = async (
    image: NodeImage,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();

    const confirmed = await confirmIt(
      "Are you sure you want to delete this image?",
      "Delete",
      "Cancel",
    );

    if (confirmed) {
      try {
        setIsDeleting(true);

        // Store the current state for change logging
        const originalImages = [...nodeImages];

        // Remove from Node's Firestore
        const nodeRef = doc(collection(firestore, nodeCollection), nodeId);
        const reference = nodes[nodeId]?.inheritance["images"]?.ref;
        if (reference) {
          let previousImages = nodes[reference].properties.images || [];
          previousImages = previousImages.filter(
            (img: NodeImage) => img.url !== image.url,
          );

          await updateDoc(nodeRef, {
            "properties.images": previousImages,
            "inheritance.images.ref": null,
          });
          updateInheritance({
            nodeId,
            updatedProperties: ["images"],
            db,
          });
        } else {
          await updateDoc(nodeRef, {
            images: arrayRemove(image),
          });
        }

        // Remove from Firebase Storage
        // Temporarily commented out to retain the node's image history for review
        // const url = new URL(image.url);
        // const pathParam = url.searchParams.get('o');

        // if (pathParam) {
        //   const decodedPath = decodeURIComponent(pathParam);
        //   try {
        //     const imageRef = ref(storage, decodedPath);
        //     await deleteObject(imageRef);
        //   } catch (storageError: any) {
        //     console.warn('Storage deletion error:', storageError);
        //   }
        // }

        saveNewChangeLog(firestore, {
          nodeId,
          modifiedBy: user.uname,
          modifiedProperty: "images",
          previousValue: originalImages,
          newValue: originalImages.filter((img) => img.url !== image.url),
          modifiedAt: new Date(),
          changeType: "remove images",
          fullNode: currentVisibleNode,
          changeDetails: {
            removedImage: {
              url: image.url,
              uploadedAt: image.uploadedAt,
              uploadedBy: image.uploadedBy,
            },
          },
        });
      } catch (error) {
        console.error("Error deleting image:", error);
        alert("Failed to delete image. Please try again.");
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const { isUploading, percentageUploaded, uploadImage } = useUploadImage({
    storage,
  });

  const { userId } = user;

  useEffect(() => {
    let _images = [];
    const reference = nodes[nodeId]?.inheritance["images"]?.ref;
    if (!nodes[nodeId]) {
      return;
    }
    if (reference) {
      _images = nodes[reference].properties.images || [];
    } else {
      _images = nodes[nodeId].properties.images || [];
    }
    setNodeImages(_images || []);
  }, [nodes, nodeId]);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, [fileInputRef]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newImages = Array.from(files).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setSelectedImages((prev) => [...prev, ...newImages]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeSelectedImage = (index: number) => {
    setSelectedImages((prev) => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].previewUrl);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  const handleUploadSelectedImages = async () => {
    try {
      let bucket =
        process.env.NODE_ENV === "development"
          ? process.env.NEXT_PUBLIC_DEV_STORAGE_BUCKET
          : process.env.NEXT_PUBLIC_STORAGE_BUCKET;

      if (bucket && isValidHttpUrl(bucket)) {
        const { hostname } = new URL(bucket);
        bucket = hostname;
      }

      const path = `https://storage.googleapis.com/${bucket}/ontology-node-images/${userId}`;

      const uploadUserInfo: UploadUserInfo = {
        userId: user.userId,
        fName: user.fName,
        lName: user.lName,
        uname: user.uname,
        imageUrl: user.imageUrl,
      };

      // Store original images for change logging
      const originalImages = [...nodeImages];
      const uploadedImages: NodeImage[] = [];

      // Upload all images
      for (const image of selectedImages) {
        const imageFileName = `${userId}_${Date.now()}`;
        const event = { target: { files: [image.file] } };

        const url = await uploadImage({
          event,
          path,
          imageFileName,
        });

        const newImage = {
          url,
          path: `${path}/${imageFileName}`,
          uploadedAt: new Date(),
          uploadedBy: uploadUserInfo,
        };

        uploadedImages.push(newImage);

        const nodeRef = doc(collection(firestore, nodeCollection), nodeId);
        const reference = nodes[nodeId]?.inheritance["images"]?.ref;
        if (reference) {
          const previousImages = nodes[reference].properties.images || [];
          previousImages.push(newImage);
          await updateDoc(nodeRef, {
            "properties.images": previousImages,
            "inheritance.images.ref": null,
          });
          updateInheritance({
            nodeId,
            updatedProperties: ["images"],
            db,
          });
        } else {
          await updateDoc(nodeRef, {
            "properties.images": arrayUnion(newImage),
          });
        }
      }

      saveNewChangeLog(firestore, {
        nodeId,
        modifiedBy: user.uname,
        modifiedProperty: "images",
        previousValue: originalImages,
        newValue: [...originalImages, ...uploadedImages],
        modifiedAt: new Date(),
        changeType: "add images",
        fullNode: currentVisibleNode,
        changeDetails: {
          addedImagesCount: uploadedImages.length,
        },
      });

      // Cleanup
      selectedImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      setSelectedImages([]);
    } catch (error) {
      console.error("Image upload error", error);
      confirmIt("Sorry, your images could not be uploaded", "ok");
    }
  };

  return (
    <Paper
      id="property-images"
      elevation={9}
      sx={{
        borderRadius: "30px",
        borderBottomRightRadius: "18px",
        borderBottomLeftRadius: "18px",
        minWidth: "500px",
        width: "100%",
        minHeight: "150px",
        maxHeight: "100%",
        overflow: "auto",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
      }}
    >
      <Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            background: (theme: any) =>
              theme.palette.mode === "dark" ? "#242425" : "#d0d5dd",
            p: 3,
          }}
        >
          <Typography
            sx={{
              fontSize: "20px",
              fontWeight: 500,
              fontFamily: "Roboto, sans-serif",
              mr: "auto",
            }}
          >
            Images
          </Typography>
          {currentVisibleNode.inheritance["images"]?.ref && (
            <Typography sx={{ fontSize: "14px", ml: "9px" }}>
              {'(Inherited from "'}
              {getTitleNode(currentVisibleNode.inheritance["images"].ref || "")}
              {'")'}
            </Typography>
          )}
          <PropertyContributors
            currentVisibleNode={currentVisibleNode}
            property={"images"}
          />
        </Box>
        <Box sx={{ p: "16px", mt: "auto" }}>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 3,
              mb: 3,
            }}
          >
            {displayImages.length === 0 ? (
              <Box
                sx={{
                  width: "100%",
                  textAlign: "center",
                  py: 6,
                  color: "text.secondary",
                }}
              >
                <Typography variant="body1">
                  No images have been uploaded yet
                </Typography>
              </Box>
            ) : (
              displayImages.map((image: any, index: any) => {
                const diffStatus = getImageDiffStatus(image);
                return (
                  <Box
                    key={index}
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 1,
                    }}
                  >
                    <Box
                      sx={{
                        position: "relative",
                        width: "150px",
                        height: "150px",
                        cursor: "pointer",
                        "&:hover": {
                          opacity: 0.9,
                          "& .delete-icon": {
                            opacity: 1,
                          },
                        },
                        border:
                          diffStatus === "added"
                            ? "3px solid green"
                            : diffStatus === "removed"
                              ? "3px solid #f44336"
                              : "none",
                        borderRadius: "12px",
                        ...(diffStatus && {
                          "&::after": {
                            content: `"${
                              diffStatus === "added" ? "New" : "Removed"
                            }"`,
                            position: "absolute",
                            top: -12,
                            right: 8,
                            backgroundColor:
                              diffStatus === "added" ? "green" : "#f44336",
                            color: "white",
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontSize: "12px",
                            zIndex: 1,
                          },
                        }),
                      }}
                      onClick={() => handleImageClick(index)}
                    >
                      <img
                        src={image.url || ""}
                        alt=""
                        style={{
                          width: "100%",
                          height: "100%",
                          borderRadius: "8px",
                          objectFit: "cover",
                          ...(diffStatus === "removed" && {
                            opacity: 0.7,
                            filter: "grayscale(50%)",
                          }),
                        }}
                      />
                      {!selectedDiffNode && enableEdit && (
                        <Tooltip title="Delete Image" placement="top">
                          <IconButton
                            className="delete-icon"
                            onClick={(e) => handleDeleteClick(image, e)}
                            sx={{
                              position: "absolute",
                              top: -14,
                              right: -14,
                              opacity: 0,
                              transition: "opacity 0.3s",
                              bgcolor: "#ff9800",
                              padding: "6px",
                              zIndex: 1,
                              "&:hover": {
                                bgcolor: "#f57c00",
                              },
                              width: "32px",
                              height: "32px",
                              minWidth: "32px",
                              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                            }}
                          >
                            <DeleteIcon sx={{ fontSize: 16, color: "white" }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "white",
                        opacity: diffStatus === "removed" ? 0.5 : 0.7,
                        maxWidth: "150px",
                      }}
                    >
                      Uploaded by {image.uploadedBy.fName}{" "}
                      {image.uploadedBy.lName}
                      {image.uploadedAt instanceof Timestamp && (
                        <Typography variant="subtitle2">
                          {dayjs(new Date(image.uploadedAt.toDate()))
                            .fromNow()
                            .includes("NaN")
                            ? "a few minutes ago"
                            : `${dayjs(
                                new Date(image.uploadedAt.toDate()),
                              ).fromNow()}`}
                        </Typography>
                      )}
                    </Typography>
                  </Box>
                );
              })
            )}

            {displayImages.length > 0 && (
              <ImageViewerDialog
                open={viewerOpen}
                onClose={() => setViewerOpen(false)}
                images={displayImages}
                initialIndex={selectedImageIndex}
                onDeleteImage={
                  !selectedDiffNode ? handleDeleteClick : undefined
                }
                isDiffView={!!selectedDiffNode}
                diffStatus={
                  selectedDiffNode?.changeType === "add images"
                    ? "added"
                    : selectedDiffNode?.changeType === "remove images"
                      ? "removed"
                      : null
                }
              />
            )}
          </Box>

          {selectedImages.length > 0 && (
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 2,
                mb: 2,
                p: 2,
                border: "1px solid orange",
                borderRadius: "15px",
              }}
            >
              {selectedImages.map((image, index) => (
                <Box
                  key={index}
                  sx={{
                    position: "relative",
                    width: "100px",
                    height: "100px",
                    "&:hover .close-icon": { opacity: 1 },
                  }}
                >
                  <IconButton
                    className="close-icon"
                    onClick={() => removeSelectedImage(index)}
                    sx={{
                      position: "absolute",
                      top: -8,
                      right: -8,
                      zIndex: 1,
                      opacity: 0,
                      transition: "opacity 0.3s",
                      bgcolor: "grey.700",
                      p: 0.5,
                      "&:hover": {
                        bgcolor: "grey.600",
                      },
                    }}
                  >
                    <CloseIcon sx={{ fontSize: 16, color: "white" }} />
                  </IconButton>
                  <img
                    src={image.previewUrl}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: "8px",
                      objectFit: "cover",
                    }}
                  />
                </Box>
              ))}
            </Box>
          )}

          <Box
            sx={{
              width: "100%",
              display: "flex",
              justifyContent: "flex-end",
              mt: 2,
              gap: 2,
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              hidden
              multiple
              accept="image/jpeg,image/png,image/gif,image/jpg,image/webp"
            />

            {isUploading ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={24} />
                <Typography variant="caption" sx={{ color: "white" }}>
                  {percentageUploaded}%
                </Typography>
              </Box>
            ) : (
              <Stack direction="row" spacing={2}>
                {selectedImages.length > 0 && (
                  <>
                    <Button
                      variant="outlined"
                      onClick={handleUploadClick}
                      startIcon={<AddIcon />}
                      sx={{
                        borderColor: "orange.main",
                        color: "orange.main",
                        "&:hover": {
                          borderColor: "orange.dark",
                          bgcolor: "rgba(255, 165, 0, 0.04)",
                        },
                      }}
                    >
                      Select More
                    </Button>

                    <Button
                      variant="contained"
                      onClick={handleUploadSelectedImages}
                      startIcon={<CollectionsIcon />}
                      sx={{
                        bgcolor: "orange.main",
                        "&:hover": {
                          bgcolor: "orange.dark",
                        },
                      }}
                    >
                      Upload Selected ({selectedImages.length})
                    </Button>
                  </>
                )}

                {selectedImages.length === 0 && (
                  <Button
                    variant="contained"
                    onClick={handleUploadClick}
                    startIcon={<CollectionsIcon />}
                    sx={{
                      bgcolor: "orange.main",
                      "&:hover": {
                        bgcolor: "orange.dark",
                      },
                      display: !enableEdit ? "none" : "block",
                    }}
                  >
                    Upload Images
                  </Button>
                )}
              </Stack>
            )}
          </Box>
        </Box>
      </Box>
    </Paper>
  );
};

type ImageViewerDialogProps = {
  open: boolean;
  onClose: () => void;
  images: NodeImage[];
  initialIndex?: number;
  onDeleteImage?: (image: NodeImage, event: React.MouseEvent) => void;
  isDiffView?: boolean;
  diffStatus?: "added" | "removed" | null;
};

const ImageViewerDialog: React.FC<ImageViewerDialogProps> = ({
  open,
  onClose,
  images,
  initialIndex = 0,
  onDeleteImage,
  isDiffView,
  diffStatus,
}) => {
  const [activeStep, setActiveStep] = useState(initialIndex);

  useEffect(() => {
    if (open) {
      setActiveStep(initialIndex);
    }
  }, [open, initialIndex]);

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const currentImage = images[activeStep];

  if (!currentImage) return;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      sx={{ borderRadius: "25px" }}
    >
      <DialogContent sx={{ p: 0, position: "relative" }}>
        <IconButton
          onClick={onClose}
          sx={{
            position: "absolute",
            right: 8,
            top: 8,
            bgcolor: "rgba(0, 0, 0, 0.4)",
            "&:hover": {
              bgcolor: "white",
              color: "black",
            },
            color: "white",
            zIndex: 2,
          }}
        >
          <CloseIcon />
        </IconButton>

        {isDiffView && (
          <Box
            sx={{
              position: "absolute",
              top: 8,
              left: 8,
              bgcolor: diffStatus === "added" ? "#4CAF50" : "#f44336",
              color: "white",
              padding: "4px 12px",
              borderRadius: "25px",
              zIndex: 2,
              fontSize: "14px",
            }}
          >
            {diffStatus === "added" ? "New Image" : "Removed Image"}
          </Box>
        )}

        {/* Main Image */}
        <Box
          sx={{
            width: "100%",
            height: "70vh",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            bgcolor: "black",
            position: "relative",
          }}
        >
          <img
            src={currentImage.url}
            alt=""
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              ...(diffStatus === "removed" && {
                opacity: 0.7,
                filter: "grayscale(50%)",
              }),
            }}
          />
        </Box>

        {/* Image Info */}
        <Paper
          sx={{
            position: "absolute",
            bottom: 45,
            left: 0,
            right: 0,
            bgcolor: "rgba(0, 0, 0, 0.2)",
            color: "white",
            p: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <OptimizedAvatar
              alt={`${currentImage.uploadedBy.fName} ${currentImage.uploadedBy.lName}`}
              imageUrl={currentImage.uploadedBy.imageUrl || ""}
              size={30}
              sx={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
            <Box>
              <Typography sx={{ color: "white" }}>
                {currentImage.uploadedBy.fName} {currentImage.uploadedBy.lName}
              </Typography>
              {currentImage.uploadedAt instanceof Timestamp && (
                <Typography variant="subtitle2" sx={{ opacity: 0.7 }}>
                  {dayjs(new Date(currentImage.uploadedAt.toDate()))
                    .fromNow()
                    .includes("NaN")
                    ? "a few minutes ago"
                    : `${dayjs(
                        new Date(currentImage.uploadedAt.toDate()),
                      ).fromNow()}`}
                </Typography>
              )}
            </Box>
          </Box>
        </Paper>

        {/* Carousel Controls */}
        <MobileStepper
          steps={images.length}
          position="static"
          activeStep={activeStep}
          sx={{
            bgcolor: "black",
            "& .MuiMobileStepper-dot": {
              bgcolor: "grey.500",
            },
            "& .MuiMobileStepper-dotActive": {
              bgcolor: "white",
            },
          }}
          nextButton={
            <IconButton
              onClick={handleNext}
              disabled={activeStep === images.length - 1}
              sx={{ color: "white" }}
            >
              <KeyboardArrowRight />
            </IconButton>
          }
          backButton={
            <IconButton
              onClick={handleBack}
              disabled={activeStep === 0}
              sx={{ color: "white" }}
            >
              <KeyboardArrowLeft />
            </IconButton>
          }
        />
      </DialogContent>
    </Dialog>
  );
};
