import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  Box,
  Button,
  Paper,
  Slide,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import {
  collection,
  doc,
  updateDoc,
  getFirestore,
} from "firebase/firestore";
import { useTheme } from "@emotion/react";
import { INode } from "@components/types/INode";
import { NODES } from "@components/lib/firestoreClient/collections";
import {
  saveNewChangeLog,
  updateInheritance,
} from "@components/lib/utils/helpers";
import {
  capitalizeFirstLetter,
  getTooltipHelper,
  lowercaseFirstLetter,
} from "@components/lib/utils/string.utils";
import { DISPLAY } from "@components/lib/CONSTANTS";
import { useAuth } from "../context/AuthContext";
import PropertyContributors from "../StructuredProperty/PropertyContributors";
import EditIcon from "@mui/icons-material/Edit";
import EditProperty from "../AddPropertyForm/EditProprety";
import InheritanceDetailsPanel from "./InheritanceDetailsPanel";

type INumericPropertyProps = {
  currentVisibleNode: INode;
  property: string;
  value: number | string;
  nodes: any;
  locked: boolean;
  selectedDiffNode: any;
  currentImprovement: any;
  sx?: any;
  skillsFuture: boolean;
  enableEdit: boolean;
  skillsFutureApp: string;
  modifyProperty?: Function;
  deleteProperty?: Function;
};

const NumericProperty = ({
  currentVisibleNode,
  property,
  value,
  nodes,
  locked,
  selectedDiffNode,
  currentImprovement,
  sx,
  skillsFuture,
  enableEdit,
  skillsFutureApp,
  modifyProperty,
  deleteProperty,
}: INumericPropertyProps) => {
  const db = getFirestore();
  const theme: any = useTheme();
  const [numericValue, setNumericValue] = useState<number | string>(value);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [{ user }] = useAuth();
  const [reference, setReference] = useState<string | null>(null);
  const [editProperty, setEditProperty] = useState("");
  const [newPropertyValue, setNewPropertyValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const displayValue = useMemo(() => {
    return value;
  }, [value]);

  const currentImprovementChange = useMemo(() => {
    if (currentImprovement?.newNode || !currentImprovement) return null;
    if (currentImprovement?.modifiedProperty === property) {
      return currentImprovement.detailsOfChange;
    }
    return null;
  }, [currentImprovement]);

  useEffect(() => {
    setReference(currentVisibleNode.inheritance[property]?.ref || null);
  }, [currentVisibleNode]);

  const saveChangeHistory = useCallback(
    async (
      previousValue: number | string,
      newValue: number | string,
      nodeId: string,
    ) => {
      if (!user?.uname || previousValue === newValue) return;
      saveNewChangeLog(db, {
        nodeId,
        modifiedBy: user.uname,
        modifiedProperty: property,
        previousValue: previousValue.toString(),
        newValue: newValue.toString(),
        modifiedAt: new Date(),
        changeType: "change text",
        fullNode: currentVisibleNode,
        skillsFuture,
        ...(skillsFutureApp ? { appName: skillsFutureApp } : {}),
      });
    },
    [db, property, user, currentVisibleNode, skillsFuture, skillsFutureApp],
  );

  const onSaveNumericChange = useCallback(
    async (newValue: number | string) => {
      if (!user?.uname) return;

      const previousValue = currentVisibleNode.properties[property];

      try {
        const numericNewValue =
          typeof newValue === "string"
            ? newValue === ""
              ? ""
              : parseFloat(newValue)
            : newValue;

        const nodeRef = doc(collection(db, NODES), currentVisibleNode?.id);

        const updateData = {
          [`properties.${property}`]: numericNewValue,
          ...(reference ? { [`inheritance.${property}.ref`]: null } : {}),
        };

        await updateDoc(nodeRef, updateData);

        if (reference) {
          updateInheritance({
            nodeId: currentVisibleNode?.id,
            updatedProperties: [property],
            db,
          });
        }

        await saveChangeHistory(
          previousValue,
          numericNewValue,
          currentVisibleNode?.id,
        );

        setIsEditing(false);
      } catch (error) {
        console.error("Error saving numeric value:", error);
        setError("Failed to save value");
      }
    },
    [
      user?.uname,
      currentVisibleNode?.id,
      reference,
      property,
      db,
      saveChangeHistory,
    ],
  );

  useEffect(() => {
    if (!isEditing) {
      setNumericValue(displayValue);
    }
  }, [displayValue, isEditing]);

  const handleDeleteProperty = useCallback(() => {
    if (deleteProperty) {
      deleteProperty(property);
    }
  }, [deleteProperty, property]);

  const handleValueChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = event.target.value;
      setNumericValue(inputValue);
      setError("");
    },
    [],
  );

  const handleKeyPress = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" && !error) {
        event.preventDefault();
        onSaveNumericChange(numericValue);
      }
      if (event.key === "Escape") {
        setNumericValue(displayValue);
        setIsEditing(false);
        setError("");
      }
    },
    [numericValue, error, onSaveNumericChange, displayValue],
  );

  const handleBlur = useCallback(() => {
    if (!error && numericValue !== displayValue) {
      onSaveNumericChange(numericValue);
    } else {
      setNumericValue(displayValue);
      setIsEditing(false);
      setError("");
    }
  }, [numericValue, displayValue, error, onSaveNumericChange]);

  const backgroundColor = useMemo(() => {
    if (selectedDiffNode?.changeType === "delete node" && property === "title") {
      return "red";
    }
    if (selectedDiffNode?.changeType === "add node" && property === "title") {
      return theme.palette.mode === "dark" ? "green" : "#4ccf37";
    }
    return theme.palette.mode === "dark" ? "#242425" : "#d0d5dd";
  }, [selectedDiffNode?.changeType, property, theme.palette.mode]);

  const renderDiffChanges = () => {
    if (currentImprovementChange && !currentImprovement.implemented) {
      return (
        <Box sx={{ p: 3 }}>
          <Typography sx={{ color: "red", textDecoration: "line-through" }}>
            {currentImprovementChange.previousValue}
          </Typography>
          <Typography sx={{ color: "green" }}>
            {currentImprovementChange.newValue}
          </Typography>
        </Box>
      );
    }

    if (selectedDiffNode?.modifiedProperty === property && 
        selectedDiffNode.changeType === "change text") {
      return (
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <Typography
              sx={{
                fontSize: "18px",
                fontWeight: 500,
                color: "red",
                textDecoration: "line-through",
              }}
            >
              {selectedDiffNode.previousValue}
            </Typography>
            <Typography
              sx={{
                fontSize: "18px",
                fontWeight: 500,
                color: "green",
              }}
            >
              {selectedDiffNode.newValue}
            </Typography>
          </Box>
        </Box>
      );
    }

    return null;
  };

  const isReadOnly = !!currentVisibleNode.unclassified || 
                     currentImprovement?.newNode || 
                     locked || 
                     !enableEdit ||
                     (selectedDiffNode && selectedDiffNode.modifiedProperty !== property);

  return (
    <Slide direction="up" in={true} mountOnEnter unmountOnExit timeout={500}>
      <Paper
        id={`property-${property}`}
        elevation={9}
        sx={{
          borderRadius: "20px",
          width: "100%",
          border:
            selectedDiffNode?.changeDetails?.addedProperty === property
              ? selectedDiffNode?.changeType === "add property"
                ? "3px solid #4ccf37"
                : selectedDiffNode?.changeType === "remove property"
                  ? "3px solid rgb(224, 8, 11)"
                  : ""
              : "",
          ...sx,
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            textAlign: "center",
            background: backgroundColor,
            p: 3,
            pb: 1.5,
            borderTopRightRadius: "18px",
            borderTopLeftRadius: "18px",
          }}
        >
          {editProperty === property ? (
            <EditProperty
              value={newPropertyValue}
              onChange={setNewPropertyValue}
              onSave={() => {
                if (modifyProperty) {
                  modifyProperty({
                    newValue: newPropertyValue,
                    previousValue: property,
                  });
                }
                setEditProperty("");
                setNewPropertyValue("");
              }}
              onCancel={() => {
                setEditProperty("");
                setNewPropertyValue("");
              }}
              property={property}
            />
          ) : (
            <Tooltip title={getTooltipHelper(lowercaseFirstLetter(property))}>
              <Box
                sx={{
                  position: "relative",
                  display: "inline-block",
                  pl: "1px",
                  "&:hover":
                    enableEdit && modifyProperty
                      ? {
                          border: "2px solid orange",
                          borderRadius: "15px",
                          pr: "15px",
                          cursor: "pointer",
                          backgroundColor: "gray",
                        }
                      : {},
                  "&:hover .edit-icon":
                    enableEdit && modifyProperty
                      ? {
                          display: "block",
                        }
                      : {},
                }}
                onClick={() => {
                  if (enableEdit && modifyProperty) {
                    setEditProperty(property);
                    setNewPropertyValue(property);
                  }
                }}
              >
                <Typography
                  sx={{
                    fontSize: "20px",
                    fontWeight: 500,
                    fontFamily: "Roboto, sans-serif",
                    padding: "4px",
                  }}
                >
                  {capitalizeFirstLetter(
                    DISPLAY[property] ? DISPLAY[property] : property,
                  )}
                </Typography>

                <EditIcon
                  className="edit-icon"
                  sx={{
                    position: "absolute",
                    top: "-8px",
                    right: "-8px",
                    color: "orange",
                    backgroundColor: "white",
                    borderRadius: "50%",
                    fontSize: "16px",
                    display: "none",
                  }}
                />
              </Box>
            </Tooltip>
          )}

          <Box
            sx={{
              display: "flex",
              ml: "auto",
              gap: "14px",
              alignItems: "center",
            }}
          >
            <PropertyContributors
              currentVisibleNode={currentVisibleNode}
              property={property}
            />
            {currentVisibleNode.inheritance[property]?.ref && (
              <Typography sx={{ fontSize: "14px", ml: "9px" }}>
                {'(Inherited from "'}
                {nodes[currentVisibleNode.inheritance[property].ref]?.title}
                {'")'}
              </Typography>
            )}
            {enableEdit && deleteProperty && (
              <Tooltip title={"Delete property"} placement="top">
                <Button
                  variant="outlined"
                  color="error"
                  sx={{ borderRadius: "25px" }}
                  onClick={handleDeleteProperty}
                >
                  Delete Property
                </Button>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Error Display */}
        <Typography color="red" sx={{ pl: "5px" }}>
          {error}
        </Typography>

        {/* Main Content */}
        {isReadOnly ? (
          <Box>
            <Typography
              sx={{
                fontSize: "19px",
                p: "19px",
              }}
            >
              {displayValue !== "" ? displayValue : "No value"}
            </Typography>
          </Box>
        ) : (
          <>
            {renderDiffChanges() || (
              <Box sx={{ p: 3 }}>
                <TextField
                  ref={inputRef}
                  type="number"
                  value={numericValue}
                  onChange={handleValueChange}
                  onKeyDown={handleKeyPress}
                  onBlur={handleBlur}
                  onFocus={() => setIsEditing(true)}
                  placeholder="Enter a numeric value..."
                  fullWidth
                  variant="outlined"
                  error={!!error}
                  helperText={error}
                  InputProps={{
                    sx: {
                      fontSize: "16px",
                      borderRadius: "12px",
                    },
                  }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "12px",
                    },
                  }}
                />
              </Box>
            )}
          </>
        )}

        {/* Inheritance Details */}
        <InheritanceDetailsPanel
          property={property}
          currentVisibleNode={currentVisibleNode}
          nodes={nodes}
        />
      </Paper>
    </Slide>
  );
};

export default NumericProperty;