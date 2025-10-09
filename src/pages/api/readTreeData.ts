import { NextApiRequest, NextApiResponse } from "next";
import { OpenAI } from "openai";
import { askGemini, openai } from "./helpers";
import { Content } from "@google/generative-ai";

import {
  ALGORITHMS,
  COPILOT_PROMPTS,
  GUIDELINES,
  LOGS,
} from "@components/lib/firestoreClient/collections";
import { db } from "@components/lib/firestoreServer/admin";
import { INode } from "@components/types/INode";
import fbAuth from "@components/middlewares/fbAuth";
import { extractJSON, getDoerCreate } from "@components/lib/utils/helpers";

// const { Storage } = require(“@google-cloud/storage”);

import { storage } from "@components/lib/firestoreServer/admin";

const saveLogs = (
  uname: string,
  type: "info" | "error",
  logs: { [key: string]: any },
) => {
  try {
    const logRef = db.collection(LOGS).doc();
    logRef.set({
      type,
      ...logs,
      createdAt: new Date(),
      doer: uname,
      doerCreate: getDoerCreate(uname),
    });
  } catch (error) {
    console.error(error);
  }
};

let guidelines: any = null;

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    // Support both POST and GET methods
    if (req.method !== "POST" && req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Get uname from fbAuth middleware (attached to req.body.data.user.userData)
    const { uname } = req.body?.data?.user?.userData || {};

    if (!uname) {
      return res.status(401).json({ error: "Unauthorized: User not authenticated" });
    }

    // Get tree data from Firebase Storage
    const bucket = storage.bucket();
    const fileName = "1760015678218.json";

    try {
      // Try to fetch from Firebase Storage first
      const file = bucket.file(fileName);
      const [exists] = await file.exists();

      if (exists) {
        const [contents] = await file.download();
        const treeData = JSON.parse(contents.toString());

        saveLogs(uname, "info", {
          action: "readTreeData",
          source: "firebase-storage",
          fileName,
          success: true,
        });

        return res.status(200).json({
          success: true,
          data: treeData,
          source: "firebase-storage",
          metadata: {
            timestamp: new Date().toISOString(),
            fileName,
          },
        });
      }
    } catch (storageError: any) {
      console.error("Error reading from Firebase Storage:", storageError);

      saveLogs(uname, "error", {
        action: "readTreeData",
        source: "firebase-storage",
        error: storageError.message,
      });
    }

    // Fallback: Return a message indicating to use static file
    saveLogs(uname, "info", {
      action: "readTreeData",
      source: "fallback",
      message: "Tree data not found in Firebase Storage, use static file",
    });

    return res.status(200).json({
      success: true,
      message: "Tree data should be loaded from static file: /tree-hierarchy.json",
      source: "static-file",
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error: any) {
    console.error("Error in readTreeData handler:", error);

    const { uname } = req.body?.data?.user?.userData || {};
    if (uname) {
      saveLogs(uname, "error", {
        action: "readTreeData",
        error: error.message,
        stack: error.stack,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to read tree data",
      details: error.message,
    });
  }
}

export default fbAuth(handler);
