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

import { collection, doc, updateDoc, getFirestore } from "firebase/firestore";
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
import EditProperty from "../AddPropertyForm/EditProperty";
import InheritanceDetailsPanel from "./InheritanceDetailsPanel";
import SelectInheritance from "../SelectInheritance/SelectInheritance";

interface NumericPropertyValue {
  value: number | string;
  unit: string;
}

type INumericPropertyProps = {
  currentVisibleNode: INode;
  property: string;
  value: NumericPropertyValue | number | string;
  relatedNodes: { [id: string]: INode };
  fetchNode: (nodeId: string) => Promise<INode | null>;
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
  relatedNodes,
  fetchNode,
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
  const [numericValue, setNumericValue] = useState<number | string>("");
  const [unit, setUnit] = useState<string>("");
  const [error, setError] = useState("");
  const [isEditingValue, setIsEditingValue] = useState(false);
  const [isEditingUnit, setIsEditingUnit] = useState(false);
  const [{ user }] = useAuth();
  const [reference, setReference] = useState<string | null>(null);
  const [editProperty, setEditProperty] = useState("");
  const [newPropertyValue, setNewPropertyValue] = useState("");
  const valueInputRef = useRef<HTMLInputElement>(null);
  const unitInputRef = useRef<HTMLInputElement>(null);

  const normalizedValue = useMemo((): NumericPropertyValue => {
    if (typeof value === "object" && value !== null && "value" in value) {
      return {
        value: value.value || "",
        unit: value.unit || "",
      };
    }
    return {
      value: value || "",
      unit: "",
    };
  }, [value]);

  const displayValue = useMemo(() => normalizedValue.value, [normalizedValue]);
  const displayUnit = useMemo(() => normalizedValue.unit, [normalizedValue]);

  const currentImprovementChange = useMemo(() => {
    if (currentImprovement?.newNode || !currentImprovement) return null;
    if (currentImprovement?.modifiedProperty === property) {
      return currentImprovement.detailsOfChange;
    }
    return null;
  }, [currentImprovement, property]);

  useEffect(() => {
    setReference(currentVisibleNode.inheritance[property]?.ref || null);
  }, [currentVisibleNode, property]);

  useEffect(() => {
    if (!isEditingValue && !isEditingUnit) {
      setNumericValue(displayValue);
      setUnit(displayUnit);
    }
  }, [displayValue, displayUnit, isEditingValue, isEditingUnit]);

  const saveChangeHistory = useCallback(
    async (
      previousValue: NumericPropertyValue,
      newValue: NumericPropertyValue,
      nodeId: string,
    ) => {
      if (
        !user?.uname ||
        JSON.stringify(previousValue) === JSON.stringify(newValue)
      )
        return;

      saveNewChangeLog(db, {
        nodeId,
        modifiedBy: user.uname,
        modifiedProperty: property,
        previousValue: JSON.stringify(previousValue),
        newValue: JSON.stringify(newValue),
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
    async (newValue: number | string, newUnit: string) => {
      if (!user?.uname) return;

      const previousValue = normalizedValue;

      try {
        const processedValue =
          typeof newValue === "string"
            ? newValue === ""
              ? ""
              : parseFloat(newValue)
            : newValue;

        const newPropertyValue: NumericPropertyValue = {
          value: processedValue,
          unit: newUnit.trim(),
        };

        const nodeRef = doc(collection(db, NODES), currentVisibleNode?.id);

        const updateData = {
          [`properties.${property}`]: newPropertyValue,
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
          newPropertyValue,
          currentVisibleNode?.id,
        );

        setIsEditingValue(false);
        setIsEditingUnit(false);
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
      normalizedValue,
    ],
  );

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

  const handleUnitChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = event.target.value;
      setUnit(inputValue);
      setError("");
    },
    [],
  );

  const handleKeyPress = useCallback(
    (event: React.KeyboardEvent, field: "value" | "unit") => {
      if (event.key === "Enter" && !error) {
        event.preventDefault();
        onSaveNumericChange(numericValue, unit);
      }
      if (event.key === "Escape") {
        if (field === "value") {
          setNumericValue(displayValue);
          setIsEditingValue(false);
        } else {
          setUnit(displayUnit);
          setIsEditingUnit(false);
        }
        setError("");
      }
    },
    [numericValue, unit, error, onSaveNumericChange, displayValue, displayUnit],
  );

  const handleBlur = useCallback(
    (field: "value" | "unit") => {
      const hasChanged =
        field === "value"
          ? numericValue !== displayValue
          : unit !== displayUnit;

      if (!error && hasChanged) {
        onSaveNumericChange(numericValue, unit);
      } else {
        if (field === "value") {
          setNumericValue(displayValue);
          setIsEditingValue(false);
        } else {
          setUnit(displayUnit);
          setIsEditingUnit(false);
        }
        setError("");
      }
    },
    [numericValue, unit, displayValue, displayUnit, error, onSaveNumericChange],
  );

  const backgroundColor = useMemo(() => {
    if (
      selectedDiffNode?.changeType === "delete node" &&
      property === "title"
    ) {
      return "red";
    }
    if (selectedDiffNode?.changeType === "add node" && property === "title") {
      return theme.palette.mode === "dark" ? "green" : "#4ccf37";
    }
    return theme.palette.mode === "dark" ? "#242425" : "#d0d5dd";
  }, [selectedDiffNode?.changeType, property, theme.palette.mode]);

  const renderDiffChanges = () => {
    if (currentImprovementChange && !currentImprovement.implemented) {
      const prevValue = JSON.parse(currentImprovementChange.previousValue);
      const newValue = JSON.parse(currentImprovementChange.newValue);

      return (
        <Box sx={{ p: 3 }}>
          <Typography sx={{ color: "red", textDecoration: "line-through" }}>
            {`${prevValue.value}${prevValue.unit ? ` ${prevValue.unit}` : ""}`}
          </Typography>
          <Typography sx={{ color: "green" }}>
            {`${newValue.value}${newValue.unit ? ` ${newValue.unit}` : ""}`}
          </Typography>
        </Box>
      );
    }

    if (
      selectedDiffNode?.modifiedProperty === property &&
      selectedDiffNode.changeType === "change text"
    ) {
      const prevValue = JSON.parse(selectedDiffNode.previousValue);
      const newValue = JSON.parse(selectedDiffNode.newValue);

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
              {`${prevValue.value}${prevValue.unit ? ` ${prevValue.unit}` : ""}`}
            </Typography>
            <Typography
              sx={{
                fontSize: "18px",
                fontWeight: 500,
                color: "green",
              }}
            >
              {`${newValue.value}${newValue.unit ? ` ${newValue.unit}` : ""}`}
            </Typography>
          </Box>
        </Box>
      );
    }

    return null;
  };

  const isReadOnly =
    !!currentVisibleNode.unclassified ||
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
                {
                  relatedNodes[currentVisibleNode.inheritance[property].ref]
                    ?.title
                }
                {'")'}
              </Typography>
            )}
            {!currentImprovement &&
              !currentVisibleNode.unclassified &&
              currentVisibleNode.inheritance[property] && (
                <SelectInheritance
                  currentVisibleNode={currentVisibleNode}
                  property={property}
                  nodes={relatedNodes}
                  enableEdit={enableEdit}
                />
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
              {displayValue !== ""
                ? `${displayValue}${displayUnit ? ` ${displayUnit}` : ""}`
                : `0${displayUnit ? ` ${displayUnit}` : ""}`}
            </Typography>
          </Box>
        ) : (
          <>
            {renderDiffChanges() || (
              <Box sx={{ p: 3 }}>
                <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
                  <TextField
                    ref={valueInputRef}
                    type="number"
                    value={numericValue}
                    onChange={handleValueChange}
                    onKeyDown={(e) => handleKeyPress(e, "value")}
                    onBlur={() => handleBlur("value")}
                    onFocus={() => setIsEditingValue(true)}
                    placeholder="Enter value..."
                    variant="outlined"
                    error={!!error}
                    helperText={error}
                    sx={{
                      flex: 2,
                      "& .MuiOutlinedInput-root": {
                        borderRadius: "12px",
                      },
                    }}
                    slotProps={{
                      input: {
                        sx: {
                          fontSize: "16px",
                          borderRadius: "12px",
                        },
                      },
                    }}
                  />

                  <TextField
                    ref={unitInputRef}
                    value={unit}
                    onChange={handleUnitChange}
                    onKeyDown={(e) => handleKeyPress(e, "unit")}
                    onBlur={() => handleBlur("unit")}
                    onFocus={() => setIsEditingUnit(true)}
                    placeholder="Unit"
                    variant="outlined"
                    sx={{
                      flex: 1,
                      "& .MuiOutlinedInput-root": {
                        borderRadius: "12px",
                      },
                    }}
                    slotProps={{
                      input: {
                        sx: {
                          fontSize: "16px",
                          borderRadius: "12px",
                        },
                      },
                    }}
                  />
                </Box>
              </Box>
            )}
          </>
        )}

        {/* Inheritance Details */}
        <InheritanceDetailsPanel
          property={property}
          currentVisibleNode={currentVisibleNode}
          relatedNodes={relatedNodes}
          fetchNode={fetchNode}
        />
      </Paper>
    </Slide>
  );
};

export default NumericProperty;
