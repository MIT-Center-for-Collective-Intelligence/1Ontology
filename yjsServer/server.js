const WebSocket = require("ws");
const http = require("http");
const StaticServer = require("node-static").Server;
const ywsUtils = require("y-websocket/bin/utils");
const setupWSConnection = ywsUtils.setupWSConnection;
const docs = ywsUtils.docs;
const env = require("lib0/environment");
const nostatic = env.hasParam("--nostatic");
const Y = require("yjs");

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
  doc.on("update", (update, origin) => {
    if (origin) {
      updatedDocs.set(docId, { structuredProperty });
    }
  });

  if (!isInitialized && doc) {
    loadContent(docId, !!structuredProperty);
  }
});

const loadContent = async (docId, structured) => {
  if (lockMap.get(docId)) {
    console.log(`Document ${docId} is already being initialized.`);
    return;
  }
  console.log(lockMap, "lockMap");
  lockMap.set(docId, true);

  try {
    const nodeId = docId.replace("ws/", "").split("-")[0];
    const property = docId.replace("ws/", "").split("-")[1].replace("%20", " ");
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
        if (!lastContent || lastContent !== textContent) {
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
