const WebSocket = require("ws");
const http = require("http");
const StaticServer = require("node-static").Server;
const ywsUtils = require("y-websocket/bin/utils");
const setupWSConnection = ywsUtils.setupWSConnection;
const docs = ywsUtils.docs;
const getYDoc = ywsUtils.getYDoc;
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

// Inheritance management maps for parent-child document synchronization
const inheritanceMap = new Map(); // sourceDocId -> Set of dependent docIds (parent -> child)
const forwardingMap = new Map(); // dependentDocId -> sourceDocId (child -> parent ["ws/nodeB-description" -> "ws/nodeA-description"])
const inheritanceCache = new Map(); // nodeId-property -> inheritance data (cached firebase inheritance queries)
const inheritanceLocks = new Map(); // docId -> boolean (for breaking inheritance)
const inheritanceSetupCache = new Map(); // docId -> Y.Doc instance (track which Y.Doc instances have had inheritance setup)
const inheritanceInitLocks = new Map(); // docId -> Promise (prevent duplicate inheritance initialization)

// Function to get inheritance information
// Check if a document should inherit from another document
const getInheritanceInfo = async (nodeId, property) => {
  const cacheKey = `${nodeId}-${property}`;
  
  if (inheritanceCache.has(cacheKey)) {
    return inheritanceCache.get(cacheKey);
  }

  try {
    const firestoreDoc = await db.collection(NODES).doc(nodeId).get();
    const firestoreData = firestoreDoc.data();
    
    let inheritanceInfo = null;
    if (property !== "title" && 
        firestoreData && 
        firestoreData.inheritance && 
        firestoreData.inheritance[property]?.ref) {
      inheritanceInfo = {
        inheritsFrom: firestoreData.inheritance[property].ref,
        sourceDocId: `ws/${firestoreData.inheritance[property].ref}-${property}`
      };
    }
    
    // Cache for 30 seconds to avoid repeated Firebase queries
    inheritanceCache.set(cacheKey, inheritanceInfo);
    setTimeout(() => {
      inheritanceCache.delete(cacheKey);
    }, 30000);
    
    return inheritanceInfo;
  } catch (error) {
    console.error("Error getting inheritance info:", error);
    return null; // This does not inherit and is independent
  }
};

// Function to setup inheritance forwarding
// This function is called every time a user opens an editor
const setupInheritanceForwarding = async (docId) => {
  const nodeId = docId.replace("ws/", "").split("-")[0];
  const property = docId.replace("ws/", "").split("-")[1].replaceAll("%20", " ");
  
  const inheritanceInfo = await getInheritanceInfo(nodeId, property);
  
  if (inheritanceInfo) {
    const sourceDocId = inheritanceInfo.sourceDocId;
    
    console.log(`Setting up inheritance: ${docId} inherits from ${sourceDocId}`);
    
    // Add to inheritance mapping
    if (!inheritanceMap.has(sourceDocId)) {
      inheritanceMap.set(sourceDocId, new Set());
    }
    inheritanceMap.get(sourceDocId).add(docId);
    forwardingMap.set(docId, sourceDocId);
    
    // Ensure source document exists 
    if (!docs.has(sourceDocId)) {
      console.log(`Creating source document: ${sourceDocId}`);
      const sourceDoc = getYDoc(sourceDocId);
      console.log(`Source document ${sourceDocId} created and will be loaded when needed`);
    }
    
    return true; // This document inherits
  }
  
  return false; // This document doesn't inherit
};

// Function to forward updates to dependent documents
// This pushes parent changes to all inheriting children in real-time
// This function is triggered everytime a parent document changes
const forwardUpdateToDependents = (sourceDocId, update, origin) => {
  if (origin === "inheritance-forward") {
    return; // Prevent infinite loops
  }
  
  const dependents = inheritanceMap.get(sourceDocId);
  if (!dependents || dependents.size === 0) {
    return;
  }
  
  console.log(`Forwarding update from ${sourceDocId} to ${Array.from(dependents)} (origin: ${origin})`);
  
  const sourceDoc = docs.get(sourceDocId);
  if (!sourceDoc) return;
  
  const sourceContent = sourceDoc.getText("quill").toString();
  console.log(`Source content after update: "${sourceContent}"`);
  
  dependents.forEach(dependentDocId => {
    const dependentDoc = docs.get(dependentDocId);
    if (dependentDoc && !inheritanceLocks.get(dependentDocId)) {
      try {
        const dependentText = dependentDoc.getText("quill");
        const currentContent = dependentText.toString();
        
        console.log(`Before forwarding: ${dependentDocId}: "${currentContent}"`);
        
        // Sync text content to update
        if (currentContent !== sourceContent) {
          dependentDoc.transact(() => {
            dependentText.delete(0, dependentText.length);
            dependentText.insert(0, sourceContent);
          }, "inheritance-forward");
          
          console.log(`After forwarding: ${dependentDocId}: "${dependentText.toString()}"`);
          
          // Mark as updated so it gets saved to Firebase
          updatedDocs.set(dependentDocId, { structuredProperty: false });
        }
        
      } catch (error) {
        console.error(`Error forwarding update to ${dependentDocId}:`, error);
      }
    }
  });
};

// Function to break inheritance relationship
// Break inheritance when user types in inheriting document
// This function is triggered when user types in child document
const breakInheritance = async (docId) => {
  if (inheritanceLocks.get(docId)) {
    return; // Already breaking or broken
  }
  
  console.log(`Breaking inheritance for: ${docId}`);
  inheritanceLocks.set(docId, true);
  
  try {
    const sourceDocId = forwardingMap.get(docId);
    if (sourceDocId) {
      // Remove from inheritance mappings
      const dependents = inheritanceMap.get(sourceDocId);
      if (dependents) {
        dependents.delete(docId);
        if (dependents.size === 0) {
          inheritanceMap.delete(sourceDocId);
        }
      }
      forwardingMap.delete(docId);
      
      // Update Firebase to break inheritance
      const nodeId = docId.replace("ws/", "").split("-")[0];
      const property = docId.replace("ws/", "").split("-")[1].replaceAll("%20", " ");
      
      const firestoreRef = db.collection(NODES).doc(nodeId);
      await firestoreRef.update({
        [`inheritance.${property}.ref`]: null
      });
      
      // Clear cache
      inheritanceCache.delete(`${nodeId}-${property}`);
      // Clear setup cache to allow inheritance re-evaluations
      inheritanceSetupCache.delete(docId);
      
      console.log(`Inheritance broken for ${docId}. Removed from mappings and cleared processed tracking.`);
    }
  } catch (error) {
    console.error(`Error breaking inheritance for ${docId}:`, error);
  } finally {
    // IMPORTANT: Clear the inheritance lock after breaking
    inheritanceLocks.delete(docId);
    
    // Reset lastSavedContent so the next save works correctly
    const doc = docs.get(docId);
    if (doc) {
      const currentContent = doc.getText("quill").toString();
      lastSavedContent.set(docId, ""); // Reset so next save triggers
      console.log(`Cleared inheritance lock and reset lastSavedContent for ${docId}, current content: "${currentContent}"`);
    }
  }
};

// Function to handle inheritance restoration
// This function restores inheritance when user selects new parent via SelectInheritance
// This function is trigered when there is Awareness message from YjsEdittorWrapper
const handleInheritanceRestoration = async (docId, changeData) => {
  const { nodeId, property, newInheritanceRef, timestamp } = changeData;
  
  console.log(`Handling inheritance restoration for ${docId}:`, changeData);
  
  try {
    // Clear any existing inheritance locks
    inheritanceLocks.delete(docId);
    
    // Remove from old inheritance relationships
    const oldSourceDocId = forwardingMap.get(docId);
    if (oldSourceDocId) {
      const dependents = inheritanceMap.get(oldSourceDocId);
      if (dependents) {
        dependents.delete(docId);
        if (dependents.size === 0) {
          inheritanceMap.delete(oldSourceDocId);
        }
      }
      forwardingMap.delete(docId);
      console.log(`Removed old inheritance relationship: ${docId} -> ${oldSourceDocId}`);
    }
    
    // Clear inheritance cache
    inheritanceCache.delete(`${nodeId}-${property}`);
    // Clear inheritance setup cache tracking
    inheritanceSetupCache.delete(docId);
    
    // Re-establish inheritance if not overridden
    if (newInheritanceRef !== 'inheritance-overridden') {
      const newSourceDocId = `ws/${newInheritanceRef}-${property.replace(/\s/g, '%20')}`;
      
      console.log(`Re-establishing inheritance: ${docId} -> ${newSourceDocId}`);
      
      // Set up new inheritance mappings
      if (!inheritanceMap.has(newSourceDocId)) {
        inheritanceMap.set(newSourceDocId, new Set());
      }
      inheritanceMap.get(newSourceDocId).add(docId);
      forwardingMap.set(docId, newSourceDocId);
      
      // Ensure source document exists
      if (!docs.has(newSourceDocId)) {
        console.log(`Creating new source document: ${newSourceDocId}`);
        getYDoc(newSourceDocId);
        await loadContent(newSourceDocId, false);
      }
      
      // Wait for source document to be loaded
      let retries = 0;
      while (!initializedDocs.has(newSourceDocId) && retries < 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        retries++;
      }
      
      // Sync content from source to inheriting document
      const sourceDoc = docs.get(newSourceDocId);
      const inheritingDoc = docs.get(docId);
      
      if (sourceDoc && inheritingDoc) {
        const sourceContent = sourceDoc.getText("quill").toString();
        const inheritingText = inheritingDoc.getText("quill");
        const currentContent = inheritingText.toString();
        
        console.log(`Syncing content from ${newSourceDocId} to ${docId}`);
        console.log(`Source content: "${sourceContent}"`);
        console.log(`Current content: "${currentContent}"`);
        
        // It is critical to ALWAYS apply content from new source, regardless of current content
        inheritingDoc.transact(() => {
          inheritingText.delete(0, inheritingText.length);
          inheritingText.insert(0, sourceContent);
        }, "inheritance-restored");
        
        // Force update tracking regardless of content similarity
        updatedDocs.set(docId, { structuredProperty: false });
        
        // Reset lastSavedContent to ensure the new content gets saved to Firebase
        lastSavedContent.set(docId, currentContent !== sourceContent ? "" : sourceContent);
        
        console.log(`Inheritance restored successfully for ${docId}`);
        console.log(`Set lastSavedContent to force save: ${lastSavedContent.get(docId)}`);
      } else {
        console.error(`Failed to get documents for inheritance restoration: source=${!!sourceDoc}, inheriting=${!!inheritingDoc}`);
      }
    } else {
      console.log(`Inheritance overridden for ${docId} - no source relationship established`);
    }
    
  } catch (error) {
    console.error(`Error handling inheritance restoration for ${docId}:`, error);
  }
};

wss.on("connection", async (conn, req) => {
  const docId = req.url.slice(1).split("?")[0];
  const parameters = req.url.slice(1).split("?")[1];
  const structuredProperty = parameters ? parameters.trim() === "type=structured" : false;
  console.log({ docId, structuredProperty }, parameters ? parameters.trim() : "no parameters");

  setupWSConnection(conn, req, { docName: docId });
  const isInitialized = initializedDocs.has(docId);

  conn.on("close", (code, reason) => {
    console.log(`Connection closed for docId: ${docId}`);
  });
  
  const doc = docs.get(docId);
  
  // Listen for awareness changes (inheritance restoration messages)
  doc.awareness.on('change', ({ added, removed, updated }) => {
    [...added, ...updated].forEach(clientId => {
      const state = doc.awareness.getStates().get(clientId);
      if (state?.inheritanceChange?.type === 'inheritance-restored') {
        console.log(`Received inheritance change message from client ${clientId} for ${docId}:`, state.inheritanceChange);
        handleInheritanceRestoration(docId, state.inheritanceChange);
      }
    });
  });
  
  // Setup inheritance forwarding for this document
  let inherits = false;
  const currentDoc = docs.get(docId);
  const processedDoc = inheritanceSetupCache.get(docId);
  
  if (!processedDoc || processedDoc !== currentDoc) {
    // Either never processed, or Y.js created a new Y.Doc instance
    inheritanceSetupCache.set(docId, currentDoc);
    inherits = await setupInheritanceForwarding(docId);
    console.log(`Inheritance setup completed for ${docId} - inherits: ${inherits} (new Y.Doc: ${!processedDoc})`);
  } else {
    // This doc has been processed, check if it inherits without running inheritance forwarding
    inherits = forwardingMap.has(docId);
    console.log(`Document ${docId} already processed - inherits: ${inherits} (same Y.Doc)`);
  }
  
  doc.on("update", (update, origin) => {
    if (origin) {
      updatedDocs.set(docId, { structuredProperty });
      
      // If this document has dependents, forward the update
      if (inheritanceMap.has(docId)) {
        forwardUpdateToDependents(docId, update, origin);
      }
      
      // If this is a user update on an inheriting document, break inheritance
      // Only break on actual user updates and not on system operations
      if (origin !== "inheritance-forward" && // Don't break when forwarding from parent
          origin !== "server-load" && // Don't break when loading from Firebase 
          origin !== "inheritance-init" && // Don't break when initializing inheritance
          origin !== "inheritance-restored" && // Don't break when restoring inheritance
          forwardingMap.has(docId) && // Only if document inherits
          !inheritanceLocks.get(docId)) { // Only if not already breaking
        console.log(`User update detected on inheriting document: ${docId}, origin: ${origin}`);
        // This is a user update: Break Inheritance
        breakInheritance(docId);
      }
    }
  });

  // Load content if not initialized
  if (!isInitialized && doc) {
    if (!inherits) {
      // Non-inheriting documents load their own content
      loadContent(docId, !!structuredProperty);
    } else {
      // Inheriting documents need coordinated initialization
      initializeInheritedDocument(docId, !!structuredProperty);
    }
  }
});

// Function to handle coordinated initialization of inherited documents
const initializeInheritedDocument = async (docId, structuredProperty) => {
  // Check if already being initialized
  if (inheritanceInitLocks.has(docId)) {
    console.log(`Inheritance initialization already in progress for ${docId}`);
    return inheritanceInitLocks.get(docId);
  }

  const sourceDocId = forwardingMap.get(docId);
  if (!sourceDocId) {
    console.log(`No source document found for inherited document ${docId}`);
    return;
  }

  // Create and store the initialization promise
  const initPromise = (async () => {
    try {
      console.log(`Starting inheritance initialization for ${docId} from ${sourceDocId}`);
      
      // Ensure source document is loaded
      if (!initializedDocs.has(sourceDocId)) {
        console.log(`Loading source document ${sourceDocId} for inheritance`);
        await loadContent(sourceDocId, structuredProperty);
      }
      
      // Wait for source content to be fully loaded
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Copy content from source to inheriting document
      const sourceDoc = docs.get(sourceDocId);
      const inheritingDoc = docs.get(docId);
      
      if (sourceDoc && inheritingDoc) {
        const sourceContent = sourceDoc.getText("quill").toString();
        const inheritingText = inheritingDoc.getText("quill");
        
        if (sourceContent) {
          console.log(`Loading inherited content for ${docId} from ${sourceDocId}: "${sourceContent}"`);
          inheritingDoc.transact(() => {
            inheritingText.delete(0, inheritingText.length);
            inheritingText.insert(0, sourceContent);
          }, "inheritance-init");
        }
        
        // Mark as initialized
        initializedDocs.add(docId);
        console.log(`Inheritance initialization completed for ${docId}`);
      } else {
        console.error(`Failed to get documents for inheritance: source=${!!sourceDoc}, inheriting=${!!inheritingDoc}`);
      }
    } catch (error) {
      console.error(`Error during inheritance initialization for ${docId}:`, error);
    } finally {
      // Clean up the lock
      inheritanceInitLocks.delete(docId);
    }
  })();

  inheritanceInitLocks.set(docId, initPromise);
  return initPromise;
};

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
    // if (
    //   property !== "title" &&
    //   firestoreData &&
    //   firestoreData.inheritance[property]?.ref
    // ) {
    //   console.log("this is inherited", nodeId, property);
    //   docs.delete(docId);
    //   initializedDocs.delete(docId);
    //   return;
    // }
    if (firestoreData) {
      let content = "";
      if (property === "title") {
        content = firestoreData[property] || "";
      } else {
        if (structured) {
          content = firestoreData?.textValue
            ? firestoreData?.textValue[property] || ""
            : "";
        } else {
          content = firestoreData.properties[property] || "";
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
            }
            // Always mark as initialized after content loading attempt
            initializedDocs.add(docId);
            console.log(`Document ${docId} marked as initialized`);
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

// const checkInheritance = async (docId) => {
//   const nodeId = docId.replace("ws/", "").split("-")[0];
//   const property = docId.replace("ws/", "").split("-")[1];
//   const nodeDoc = await db.collection(NODES).doc(nodeId).get();
//   const nodeData = nodeDoc.data();

//   if (property !== "title" && nodeData && nodeData.inheritance[property]?.ref) {
//     console.log("checkInheritance", nodeId, property);
//     docs.delete(docId);
//     initializedDocs.delete(docId);
//   }
// };

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
      conns += doc.conns?.size || 0;
      const connUsers = new Set();
      try {
        Array.from(doc.awareness?.getStates()?.values() || []).forEach((c) => {
          if (c?.user?.name) {
            connUsers.add(c.user.name);
          }
        });
      } catch (error) {
        console.log(`Error reading awareness for ${id}:`, error);
      }
      ids.push({ id, connUsers: Array.from(connUsers) });
    });
    
    // Clean up processed tracking for documents with no connections
    // Without this, tracking Map will hold references to Y.Doc instances that Y.js has removed
    docs.forEach((doc, docId) => {
      const connectionCount = doc.conns?.size || 0;
      if (connectionCount === 0) {
        if (inheritanceSetupCache.has(docId)) {
          console.log(`Cleaning up setup cache for disconnected document: ${docId}`);
          inheritanceSetupCache.delete(docId);
        }
        if (inheritanceInitLocks.has(docId)) {
          console.log(`Cleaning up initialization lock for disconnected document: ${docId}`);
          inheritanceInitLocks.delete(docId);
        }
      }
    });
    
    // Add inheritance to stats
    const inheritanceStats = {
      inheritanceRelationships: inheritanceMap.size,
      forwardingRelationships: forwardingMap.size,
      inheritanceLocks: inheritanceLocks.size,
      cacheSize: inheritanceCache.size,
      processedDocuments: inheritanceSetupCache.size,
      initializationLocks: inheritanceInitLocks.size
    };
    
    const stats = {
      conns,
      docs: docs.size,
      ids,
      inheritance: inheritanceStats
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
