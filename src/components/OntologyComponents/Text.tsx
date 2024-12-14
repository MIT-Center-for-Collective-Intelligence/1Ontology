import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { Box, Paper, TextField, Tooltip, Typography } from "@mui/material";
import {
  getDoc,
  collection,
  doc,
  updateDoc,
  getDocs,
  query,
  where,
  getFirestore,
} from "firebase/firestore";
import * as Y from "yjs";
import { useTheme } from "@emotion/react";
import { INode } from " @components/types/INode";
import { NODES } from " @components/lib/firestoreClient/collections";
import {
  randomProminentColor,
  saveNewChangeLog,
  updateInheritance,
  updatePartsAndPartsOf,
  updatePropertyOf,
} from " @components/lib/utils/helpers";
import { diffWords, diffLines } from "diff"; // Using diffLines for line-by-line diff
import {
  capitalizeFirstLetter,
  getTooltipHelper as getTooltipHelper,
} from " @components/lib/utils/string.utils";
import ManageNodeButtons from "./ManageNodeButtons";
import { DISPLAY, WS_URL } from " @components/lib/CONSTANTS";
import { useAuth } from "../context/AuthContext";
import YjsEditor from "../YJSEditor/YjsEditor";
import SimpleEditor from "../YJSEditor/SimpleEditor";
import SelectInheritance from "../SelectInheritance/SelectInheritance";
import { WebsocketProvider } from "y-websocket";
import PropertyContributors from "../StructuredProperty/PropertyContributors";
// import YjsEditor from "../YJSEditor/YjsEditor";

type ITextProps = {
  currentVisibleNode: INode;
  setCurrentVisibleNode: Function;
  property: string;
  text: string; // Real-time text from WebSocket
  confirmIt: any;
  nodes: { [id: string]: INode };
  setSelectTitle?: any;
  selectTitle?: any;
  locked: boolean;
  selectedDiffNode: any;
  getTitleNode: any;
  root?: any;
  manageLock?: any;
  deleteNode?: any;
  handleLockNode?: any;
  navigateToNode?: any;
  displaySidebar?: Function;
  activeSidebar?: any;
  structured?: boolean;
  currentImprovement: any;
  checkDuplicateTitle?: any;
  sx?: any;
};

const Text = ({
  currentVisibleNode,
  property,
  text, // Real-time text prop from firestore snapshot
  confirmIt,
  setSelectTitle,
  selectTitle,
  locked,
  selectedDiffNode,
  getTitleNode,
  root,
  manageLock,
  deleteNode,
  handleLockNode,
  navigateToNode,
  displaySidebar,
  activeSidebar,
  nodes,
  structured = false,
  currentImprovement,
  checkDuplicateTitle,
  sx,
}: ITextProps) => {
  const db = getFirestore();
  const theme: any = useTheme();
  const [editorContent, setEditorContent] = useState(text); // Local state to manage text
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false); // State to check if user is editing
  const [{ user }] = useAuth();
  const focusAfterSaveRef = useRef(false); // Ref to track whether to refocus
  const [reference, setReference] = useState<string | null>(null);
  const [autoFocus, setAutoFocus] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<number | null>(null);
  const [switchToWebsocket, setSwitchToWebSocket] = useState(true);

  const currentImprovementChange = useMemo(() => {
    if (currentImprovement?.newNode || !currentImprovement) return null;

    if (currentImprovement?.modifiedProperty === property) {
      return currentImprovement.detailsOfChange;
    }
    return null;
  }, [currentImprovement]);

  // // Maintain focus after inheritance change
  // useEffect(() => {
  //   if (focusAfterSaveRef.current && textAreaRef.current) {
  //     textAreaRef.current.focus(); // Refocus after re-render
  //     focusAfterSaveRef.current = false; // Reset
  //   }
  // }, [currentVisibleNode.inheritance[property]?.ref]);
  useEffect(() => {
    setReference(currentVisibleNode.inheritance[property]?.ref || null);
    // setAutoFocus(false);
  }, [currentVisibleNode]);

  const saveChangeHistory = useCallback(
    (previousValue: string, newValue: string) => {
      if (!user?.uname) return;
      saveNewChangeLog(db, {
        nodeId: currentVisibleNode.id,
        modifiedBy: user.uname,
        modifiedProperty: property,
        previousValue: previousValue,
        newValue,
        modifiedAt: new Date(),
        changeType: "change text",
        fullNode: currentVisibleNode,
      });
    },
    [currentVisibleNode.id, db, property, user]
  );

  const onSaveTextChange = useCallback(
    async (copyValue: string) => {
      if (!user?.uname) return;

      // Mark that we want to keep focus after inheritance breaks
      focusAfterSaveRef.current = true;

      if (reference) {
        setSwitchToWebSocket(false);
        const nodeRef = doc(collection(db, NODES), currentVisibleNode.id);
        if (structured) {
          const referencedNode: any = nodes[reference];
          await updateDoc(nodeRef, {
            [`textValue.${property}`]: copyValue,
            [`properties.${property}`]: referencedNode.properties[property],
            [`inheritance.${property}.ref`]: null,
          });

          if (Array.isArray(referencedNode.properties[property])) {
            const links = referencedNode.properties[property].flatMap(
              (c) => c.nodes
            );
            if (property === "parts" || property === "isPartOf") {
              updatePartsAndPartsOf(
                links,
                { id: currentVisibleNode.id },
                property === "parts" ? "isPartOf" : "parts",
                db,
                nodes
              );
            } else {
              updatePropertyOf(
                links,
                { id: currentVisibleNode.id },
                property,
                nodes,
                db
              );
            }
          }
        } else {
          await updateDoc(nodeRef, {
            [`properties.${property}`]: copyValue,
            [`inheritance.${property}.ref`]: null,
          });
        }
        setAutoFocus(true);
        const ydoc = new Y.Doc();
        const websocketProvider = new WebsocketProvider(
          WS_URL,
          `${currentVisibleNode.id}-${property}`,
          ydoc,
          {
            connect: true,
            params: { type: structured ? "structured" : "" },
          }
        );

        setTimeout(() => {
          setSwitchToWebSocket(true);
        }, 900);
        setTimeout(() => {
          websocketProvider.disconnect();
          websocketProvider.destroy();
        }, 5000);

        updateInheritance({
          nodeId: currentVisibleNode.id,
          updatedProperties: [property],
          db,
        });
      }
    },
    [user?.uname, currentVisibleNode.id, reference, property, db, nodes]
  );

  useEffect(() => {
    if (!isEditing) {
      setEditorContent(text);
    }
  }, [text, isEditing]);

  // useEffect(() => {
  //   setError("");
  //   if (selectTitle) {
  //     textAreaRef.current.focus();
  //     setEditorContent("");
  //   } else {
  //     if (textAreaRef.current) {
  //       textAreaRef.current.blur();
  //     }
  //   }
  // }, [currentVisibleNode.id]);

  const renderDiff = (previousValue: string, newValue: string) => {
    try {
      /*       const diffContent = diffWords(previousValue, newValue);
      const lines = diffLines(previousValue, newValue); */

      return (
        <div>
          <div style={{ color: "red", textDecoration: "line-through" }}>
            {previousValue}
          </div>
          <div style={{ color: "green" }}>{newValue}</div>
        </div>
      );
      /*   return diffContent.map((line, index) => (
        <div key={uuidv4()}>
          <span
            style={{
              fontSize: property === "title" ? "29px" : "19px",
              color: line.added ? "green" : line.removed ? "red" : "",
              textDecoration: line.removed ? "line-through" : "none",
            }}
          >
            {line.value}
          </span>
        </div>
      )); */
    } catch (error) {
      return (
        <div>
          <div style={{ color: "red", textDecoration: "line-through" }}>
            {previousValue}
          </div>
          <div style={{ color: "green" }}>{newValue}</div>
        </div>
      );
    }
  };

  return (
    <Paper
      id={`property-${property}`}
      elevation={9}
      sx={{
        borderRadius: "20px",
        minWidth: "500px",
        width: "100%",
        border: structured ? "1px solid white" : "",
        ...sx,
      }}
    >
      {!structured && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            background: (theme: any) =>
              (selectedDiffNode?.changeType === "delete node" ||
                !!currentImprovement?.deleteNode) &&
              property === "title"
                ? "red"
                : (selectedDiffNode?.changeType === "add node" ||
                    !!currentImprovement?.newNode) &&
                  property === "title"
                ? "green"
                : theme.palette.mode === "dark"
                ? "#242425"
                : "#d0d5dd",
            p: 3,
            pb: 1.5,
            borderTopRightRadius: property !== "title" ? "18px" : "",
            borderTopLeftRadius: property !== "title" ? "18px" : "",
            backgroundColor:
              selectedDiffNode &&
              selectedDiffNode.changeType === "add property" &&
              selectedDiffNode.changeDetails.addedProperty === property
                ? "green"
                : "",
          }}
        >
          <Tooltip title={getTooltipHelper(property)}>
            <Typography
              sx={{
                fontSize: "20px",
                fontWeight: 500,
                fontFamily: "Roboto, sans-serif",
              }}
            >
              {capitalizeFirstLetter(
                DISPLAY[property] ? DISPLAY[property] : property
              )}
            </Typography>
          </Tooltip>
          <Box sx={{ display: "flex", ml: "auto", gap: "14px" }}>
            <PropertyContributors
              currentVisibleNode={currentVisibleNode}
              property={property}
            />

            {selectedDiffNode &&
              selectedDiffNode.changeType === "delete node" &&
              property === "title" && (
                <Typography sx={{ mx: "5px", ml: "145px", fontWeight: "bold" }}>
                  DELETED NODE
                </Typography>
              )}
            {currentVisibleNode.inheritance[property]?.ref && (
              <Typography sx={{ fontSize: "14px", ml: "9px" }}>
                {'(Inherited from "'}
                {getTitleNode(currentVisibleNode.inheritance[property].ref || "")}
                {'")'}
              </Typography>
            )}

            {property === "title" &&
              !selectedDiffNode &&
              displaySidebar &&
              !currentImprovement && (
                <ManageNodeButtons
                  locked={locked}
                  lockedInductor={!!currentVisibleNode.locked}
                  root={root}
                  manageLock={manageLock}
                  deleteNode={deleteNode}
                  getTitleNode={getTitleNode}
                  handleLockNode={handleLockNode}
                  navigateToNode={navigateToNode}
                  displaySidebar={displaySidebar}
                  activeSidebar={activeSidebar}
                  unclassified={!!currentVisibleNode.unclassified}
                />
              )}
            {property !== "title" &&
              !currentImprovement &&
              !currentVisibleNode.unclassified && (
                <SelectInheritance
                  currentVisibleNode={currentVisibleNode}
                  property={property}
                  nodes={nodes}
                />
              )}
          </Box>
        </Box>
      )}
      <Typography color="red" sx={{ pl: "5px" }}>
        {error}
      </Typography>
      {!!currentVisibleNode.unclassified ||
      currentImprovement?.newNode ||
      locked ||
      (selectedDiffNode &&
        (selectedDiffNode.modifiedProperty !== property || structured)) ||
      (currentVisibleNode.unclassified && property === "title") ? (
        <Typography
          sx={{ fontSize: property === "title" ? "34px" : "19px", p: "19px" }}
        >
          {text}
        </Typography>
      ) : (
        <>
          {currentImprovementChange && !currentImprovement.implemented ? (
            <Box sx={{ p: 3 }}>
              <Typography sx={{ color: "red", textDecoration: "line-through" }}>
                {currentImprovementChange.previousValue}
              </Typography>
              <Typography sx={{ color: "green" }}>
                {currentImprovementChange.newValue}
              </Typography>
            </Box>
          ) : selectedDiffNode &&
            selectedDiffNode.modifiedProperty === property ? (
            <Box sx={{ p: "10px", borderRadius: "5px" }}>
              <Box sx={{ display: "flow", gap: "3px", p: "14px" }}>
                {renderDiff(
                  selectedDiffNode.previousValue,
                  selectedDiffNode.newValue
                )}
              </Box>
            </Box>
          ) : !reference && switchToWebsocket ? (
            <YjsEditor
              fullname={`${user?.fName} ${user?.lName}`}
              property={property}
              nodeId={currentVisibleNode.id}
              color={randomProminentColor()}
              saveChangeHistory={saveChangeHistory}
              structured={structured}
              checkDuplicateTitle={checkDuplicateTitle}
              autoFocus={autoFocus}
              cursorPosition={cursorPosition}
            />
          ) : (
            <SimpleEditor
              property={property}
              text={text}
              breakInheritance={onSaveTextChange}
              nodeId={currentVisibleNode.id}
              setCursorPosition={setCursorPosition}
            />
          )}
        </>
      )}
    </Paper>
  );
};

export default Text;
