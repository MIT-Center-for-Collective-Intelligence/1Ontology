// import React, { useEffect, useRef, useState } from "react";
// import Quill from "quill";
// import * as Y from "yjs";
// import { WebsocketProvider } from "y-websocket";
// import { QuillBinding } from "y-quill";
// import "quill/dist/quill.snow.css";
// import { Box } from "@mui/material";

// const getRandomColor = () => {
//   return "red";
// };
// const user = `user-${Math.floor(Math.random() * 1000)}`;

// const TextFieldCollab = () => {
//   const editorRef = useRef<HTMLDivElement | null>(null);
//   const [cursors, setCursors] = useState<{
//     [key: string]: { position: number; selectionStart: number; selectionEnd: number; color: string };
//   }>({});
//   const localClientId = useRef(user);

//   useEffect(() => {
//     // Initialize Y.js document and provider
//     const ydoc = new Y.Doc();
//     const provider = new WebsocketProvider(
//       "wss://demos.yjs.dev/ws",
//       "TextFieldCollabQuill",
//       ydoc
//     );

//     const yText = ydoc.getText("quillText");
//     const yCursors = ydoc.getMap("quillCursors");

//     // Initialize Quill editor
//     const quill = new Quill(editorRef.current!, {
//       theme: "snow", // You can change the theme to "bubble" or other supported themes
//     });

//     // Bind Quill to Y.js text for collaboration
//     new QuillBinding(yText, quill);

//     // Update local state when text changes
//     quill.on("text-change", () => {
//       const currentRange = quill.getSelection();
//       if (currentRange) {
//         updateCursor(currentRange.index, currentRange.length);
//       }
//     });

//     // Observe and render cursors of other users
//     yCursors.observe(() => {
//       const newCursors = yCursors.toJSON();
//       setCursors(newCursors);
//     });

//     // Function to update cursor and selection in the Yjs map
//     const updateCursor = (index: number, length: number) => {
//       const selectionStart = index;
//       const selectionEnd = index + length;

//       const currentCursor: any = yCursors.get(localClientId.current) || {};
//       if (!currentCursor.color) {
//         currentCursor.color = getRandomColor();
//       }
//       yCursors.set(localClientId.current, {
//         position: index,
//         selectionStart,
//         selectionEnd,
//         color: currentCursor.color,
//       });
//     };

//     // Remove cursor when the user leaves or loses focus
//     const handleBlur = () => {
//       yCursors.delete(localClientId.current);
//     };

//     quill.on("selection-change", (range) => {
//       if (!range) {
//         handleBlur();
//       }
//     });

//     return () => {
//       provider.destroy();
//     };
//   }, []);

//   // Helper function to render the selections of other users
//   const renderCursors = () => {
//     return Object.keys(cursors).map((clientId) => {
//       if (clientId === localClientId.current) return null;

//       const cursor = cursors[clientId];
//       const selectionStart = cursor.selectionStart;
//       const selectionEnd = cursor.selectionEnd;
//       const color = cursor.color;

//       // Visualize the selection with a background color
//       return (
//         <div key={clientId} style={{ position: "relative" }}>
//           <div
//             style={{
//               backgroundColor: color,
//               opacity: 0.3,
//               position: "absolute",
//               zIndex: 1,
//               // Additional styles based on selection can be added here
//             }}
//           >
//             {/* You can add additional styling or text here */}
//           </div>
//         </div>
//       );
//     });
//   };

//   return (
//     <Box style={{ width: "100%", padding: "14px", position: "relative" }}>
//       <div ref={editorRef} style={{ height: "300px" }} />
//       {renderCursors()}
//     </Box>
//   );
// };

// export default TextFieldCollab;
