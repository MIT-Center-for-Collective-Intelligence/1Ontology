const WebSocket = require("ws");
const http = require("http");
const StaticServer = require("node-static").Server;
const ywsUtils = require("y-websocket/bin/utils");
const setupWSConnection = ywsUtils.setupWSConnection;
const docs = ywsUtils.docs;
const env = require("lib0/environment");
const nostatic = env.hasParam("--nostatic");
const Y = require("yjs");
const { decoding } = require('lib0');

const production = process.env.PRODUCTION != null;
const port = process.env.PORT || 3003;
const NODES = "nodes";
const { db } = require("./admin");

const server = http.createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        response: "ok",
      })
    );
    return;
  }
});

const wss = new WebSocket.Server({ server });
const initializedDocs = new Set();
const updatedDocs = new Map();
const lastSavedContent = new Map();
const lockMap = new Map();
const docChanges = new Map();
const lastSavedChangeLogContentMap = new Map();

wss.on("connection", async (conn, req) => {
  const docId = req.url.slice(1).split("?")[0];
  const parameters = req.url.slice(1).split("?")[1];
  const structuredProperty = parameters.trim() === "type=structured";
  console.log({ docId, structuredProperty }, parameters.trim());
  setupWSConnection(conn, req, { docName: docId });
  const isInitialized = initializedDocs.has(docId);

  conn.on("close", (code, reason) => {
    console.log(`Connection closed for docId: ${docId}`);
  });
  const doc = docs.get(docId);

  const awareness = doc.awareness;
  const connectedClients = awareness.states;

  doc.on("update", (update, origin) => {
    if (origin) {
      updatedDocs.set(docId, { structuredProperty });
    }

    try {
      const decodedUpdate = decodeUpdate(update);

      const updateOrigin = decodeClientID(update);

      const userClientID = updateOrigin[0]?.client;

      // Stops registering update if clientID is not available (e.g., first load with null origin)
      if (userClientID == null || connectedClients.get(userClientID) == null) return;

      if (!docChanges.has(docId)) {
        docChanges.set(docId, new Map());
      }

      const currentDoc = docChanges.get(docId);

      if (!currentDoc.has(userClientID)) {
        currentDoc.set(userClientID, []);
      }

      const username = connectedClients.get(userClientID).user.uname;
      const log = {
        decodedUpdate,
        userClientID,
        username,
        timestamp: new Date().toISOString(),
      }

      // Store the update log in the user's update array in the docChanges map
      // This array will hold individual updates until the changelog is saved by any user
      currentDoc.get(userClientID).push(log);
    } catch (error) {
      console.error(error);
    }
  });

  conn.on("message", async (message) => {
    try {
      // y-websocket handles WebSocket messages as Uint8Array
      // Encoding and decoding are required to handle message types and prevent type mismatches
      if (message instanceof ArrayBuffer) {
        const decoder = decoding.createDecoder(new Uint8Array(message));

        const clientId = decoding.readVarUint(decoder);

        const messageDataLength = decoding.readVarUint(decoder);

        const messageDataArray = decoding.readUint8Array(decoder, messageDataLength);

        let messageDataString;
        try {
          messageDataString = new TextDecoder('utf-8', { fatal: false }).decode(messageDataArray);
        } catch (decodeError) {
          console.error('Decoding error:', decodeError);
          return;
        }

        messageDataString = messageDataString.trim();

        // Verify the message is JSON parsable
        if (!messageDataString.startsWith('{') || !messageDataString.endsWith('}')) {
          return;
        }

        let parsedMessage;
        try {
          parsedMessage = JSON.parse(messageDataString);
        } catch (jsonError) {
          console.error('JSON Parsing Error:', jsonError);
          return;
        }

        console.log('clientId', clientId);
        console.log('Parsed message', parsedMessage);

        // Save the changelog
        if (parsedMessage.type === "saveChangeLog") {
          const currentDoc = docChanges.get(docId);
          if (!currentDoc) return;

          const activeUsers = getActiveUsers(connectedClients, clientId, currentDoc);
          console.log('collaborators', activeUsers);

          saveChangeLog(docId, activeUsers);

          // Cleanup the updates from document changelog map after saving the changelog
          docChanges.delete(docId);
        }
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  });

  if (!isInitialized && doc) {
    loadContent(docId, !!structuredProperty);
  }
});


const decodeClientID = (update) => {
  const decodedOps = Y.decodeUpdate(update);

  let origins = [];

  decodedOps.structs.forEach((item) => {
    origins.push(item.origin);
  })

  return origins;
}

const decodeUpdate = (update) => {
  const decodedOps = Y.decodeUpdate(update);

  let extractedText = [];

  decodedOps.structs.forEach((item) => {
    const content = item.content;

    if (content) {
      if (content instanceof Y.Text) {
        const insertedText = content.toString();
        extractedText.push(insertedText);
      } else if (content instanceof Y.ContentString) {
        extractedText.push(content.str);
      }
    }
  });

  return extractedText;
};

const saveChangeLog = async (docId, activeUsers) => {
  try {
    const doc = docs.get(docId);
    const nodeId = docId.replace("ws/", "").split("-")[0];
    const property = docId.replace("ws/", "").split("-").slice(1).join("-");

    if (doc) {
      const textContent = doc.getText("quill").toString();
      const lastContent = lastSavedChangeLogContentMap.get(docId) || '';

      const modifiedUser = Array.isArray(activeUsers) ? activeUsers[0] : activeUsers;

      const log = {
        nodeId: nodeId,
        modifiedBy: modifiedUser,
        collaborators: Array.isArray(activeUsers) && activeUsers.length > 1 ? activeUsers.slice(1) : undefined, // If there is more than one users, add the remaining to collaborators
        modifiedProperty: property,
        previousValue: lastContent,
        newValue: textContent,
        modifiedAt: new Date(),
        changeType: "change text",
        fullNode: await fetchFullNodeFromFirestore(nodeId),
      }

      if (lastContent !== textContent) {
        // save changelog
        const nodeLogRef = db.collection("nodeLogs").doc();
        await nodeLogRef.set(log);
        console.log('changelog saved!');


        // update user reuptation
        const userRef = db.collection("users").doc(modifiedUser);
        const userDoc = await userRef.get();
        const currentReputation = userDoc.data().reputations || 0;
        const userUpdateData = {
          reputations: currentReputation + 1,
          lasChangeMadeAt: new Date(),
        };
        await userRef.update(userUpdateData);

        // Update node contributors
        if (modifiedUser) {
          const nodeRef = db.collection("nodes").doc(nodeId);
          const nodeDoc = await nodeRef.get();
          const currentContributors = nodeDoc.data().contributors || [];
          const currentContributorsByProperty = nodeDoc.data().contributorsByProperty || {};

          const updateData = {
            contributors: Array.from(new Set([...currentContributors, modifiedUser])),
          };

          if (property) {
            const propertyContributors = currentContributorsByProperty[property] || [];
            updateData[`contributorsByProperty.${property}`] = Array.from(new Set([...propertyContributors, modifiedUser]));
          }

          await nodeRef.update(updateData);
        }
      }

      lastSavedChangeLogContentMap.set(docId, textContent);
    }
  } catch (error) {
    console.log("error==>", error);
  }
}

function getActiveUsers(connectedClients, currentClientId, currentDoc) {
  const activeUsernames = [];

  if (connectedClients.has(currentClientId)) {
    const currentClientData = connectedClients.get(currentClientId);
    // Add the current client's username first
    activeUsernames.push(currentClientData.user?.uname);
  }
  for (const [userClientID, changes] of currentDoc) {
    if (connectedClients.has(userClientID)) {
      const clientData = connectedClients.get(userClientID);

      const hasChanges = changes.length > 0;
      // Previously used to track user activity based on cursor presence. 
      // Now, user activity is detected by tracking changes, but the cursor check is retained for future reference.
      const hasCursor = clientData.cursor !== null;

      if (hasChanges) {
        activeUsernames.push(clientData.user?.uname);
      }
    }
  }

  const uniqueActiveUsernames = [...new Set(activeUsernames)];

  return uniqueActiveUsernames.length === 1
    ? uniqueActiveUsernames[0]
    : uniqueActiveUsernames;
}

async function fetchFullNodeFromFirestore(nodeId) {
  try {
    const firestoreRef = db.collection(NODES).doc(nodeId);
    const nodeSnapshot = await firestoreRef.get();

    if (nodeSnapshot.exists) {
      return {
        id: nodeSnapshot.id,
        ...nodeSnapshot.data()
      };
    } else {
      console.warn(`No node found with ID: ${nodeId}`);
      return null;
    }
  } catch (error) {
    console.error('Error fetching node from Firestore:', error);
    return null;
  }
}

const loadContent = async (docId, structured) => {
  if (lockMap.get(docId)) {
    console.log(`Document ${docId} is already being initialized.`);
    return;
  }
  console.log(lockMap, "lockMap");
  lockMap.set(docId, true);

  try {
    const nodeId = docId.replace("ws/", "").split("-")[0];
    const property = docId
      .replace("ws/", "")
      .split("-")[1]
      .replaceAll("%20", " ");
    const firestoreDoc = await db.collection(NODES).doc(nodeId).get();

    let firestoreData = firestoreDoc.data();
    if (
      property !== "title" &&
      firestoreData &&
      firestoreData.inheritance[property]?.ref
    ) {
      console.log("this is inherited", nodeId, property);
      docs.delete(docId);
      initializedDocs.delete(docId);
      return;
    }
    if (firestoreData) {
      let content = "";
      if (property === "title") {
        content = firestoreData[property];
      } else {
        if (structured) {
          content = firestoreData?.textValue
            ? firestoreData?.textValue[property] || ""
            : "";
        } else {
          content = firestoreData.properties[property];
        }
      }

      const doc = docs.get(docId);
      const isInitialized = initializedDocs.has(docId);
      console.log("isInitialized", isInitialized, docId, content);
      if (doc) {
        const yText = doc.getText("quill");
        if (yText) {
          lastSavedContent.set(docId, content);
          lastSavedChangeLogContentMap.set(docId, content);
          console.log("initializing the document", property, docId, {
            prev: yText.toString(),
            content,
          });
          setTimeout(() => {
            if (yText.toString() !== content) {
              doc.transact(() => {
                yText.delete(0, yText.length);
                yText.insert(0, content);
              }, "server-load");
              initializedDocs.add(docId);
            }
          }, 200);
        }
      }
    }
  } catch (error) {
    console.error("Error loading content:", error);
  } finally {
    lockMap.delete(docId); // Release the lock after initialization
  }
};

const saveInFirestore = async (docId, newValue, structured) => {
  try {
    const nodeId = docId.replace("ws/", "").split("-")[0];
    const property = docId
      .replace("ws/", "")
      .split("-")[1]
      .replaceAll("%20", " ");
    const firestoreRef = db.collection(NODES).doc(nodeId);

    if (property === "title") {
      await firestoreRef.update({
        [`${property}`]: newValue,
      });
    }
    if (property !== "title") {
      if (structured) {
        await firestoreRef.update({
          [`textValue.${property}`]: newValue,
        });
      } else {
        await firestoreRef.update({
          [`properties.${property}`]: newValue,
        });
      }
    }
    lastSavedContent.set(docId, newValue);
  } catch (error) {
    console.log("error saving the database");
    console.error(error);
  }
};

const checkInheritance = async (docId) => {
  const nodeId = docId.replace("ws/", "").split("-")[0];
  const property = docId.replace("ws/", "").split("-")[1];
  const nodeDoc = await db.collection(NODES).doc(nodeId).get();
  const nodeData = nodeDoc.data();

  if (property !== "title" && nodeData && nodeData.inheritance[property]?.ref) {
    console.log("checkInheritance", nodeId, property);
    docs.delete(docId);
    initializedDocs.delete(docId);
  }
};

setInterval(() => {
  if (updatedDocs.size > 0) {
    console.log("updatedDocs", updatedDocs);
  }
  try {
    updatedDocs.forEach((value, docId) => {
      const doc = docs.get(docId);

      if (doc) {
        const textContent = doc.getText("quill").toString();
        const lastContent = lastSavedContent.get(docId);

        console.log("trying to updated", docId, {
          lastContent,
          newContent: textContent,
        });
        if (lastContent !== textContent) {
          console.log("updated", docId);
          saveInFirestore(docId, textContent, value.structuredProperty);
        }
      }
      updatedDocs.delete(docId);
    });
  } catch (error) {
    console.log("error==>", error);
  }
}, 2000);

setInterval(() => {
  try {
    let conns = 0;
    let ids = [];
    docs.forEach((doc, id) => {
      checkInheritance(id);
      conns += doc.conns.size;
      const connUsers = new Set();
      Array.from(doc.awareness.getStates().values()).forEach((c) => {
        if (c?.user?.name) {
          connUsers.add(c.user.name);
        }
      });
      ids.push({ id, connUsers: Array.from(connUsers) });
    });
    const stats = {
      conns,
      docs: docs.size,
      ids,
    };

    console.log(
      "\x1b[31m%s\x1b[0m",
      `${new Date().toISOString()} Stats: ${JSON.stringify(stats)}`
    );
  } catch (error) {
    console.log("setInterval error");
    console.error(error);
  }
}, 7000);

server.listen(port, "0.0.0.0");

console.log(
  `Listening to http://localhost:${port} (${
    production ? "production + " : ""
  } ${nostatic ? "no static content" : "serving static content"})`
);
