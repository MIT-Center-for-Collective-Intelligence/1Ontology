import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import { db } from "@components/lib/firestoreServer/admin";
import { LOGS } from "@components/lib/firestoreClient/collections";
import fbAuth from "@components/middlewares/fbAuth";

type LogBody = {
  event?: string;
  path?: string;
  referrer?: string | null;
  sessionId?: string;
  visibleMs?: number;
  /** Client-detected browser/OS string (server still records User-Agent header). */
  clientBrowserHint?: string;
  locale?: string;
  timeZone?: string;
  username?: string;
};

function getClientIp(req: NextApiRequest): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string") {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  if (Array.isArray(xff) && xff[0]) {
    const first = xff[0].split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) return realIp.trim();
  return req.socket.remoteAddress ?? "unknown";
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).end();
    }

    let body: LogBody = {};
    try {
      body =
        typeof req.body === "object" && req.body !== null
          ? (req.body as LogBody)
          : {};
    } catch {
      body = {};
    }

    const userAgent =
      (typeof req.headers["user-agent"] === "string" &&
        req.headers["user-agent"]) ||
      "";

    const entry = {
      at: new Date().toISOString(),
      ip: getClientIp(req),
      userAgent,
      uname: body.username ?? null,
      clientBrowserHint: body.clientBrowserHint ?? null,
      event: body.event ?? "unknown",
      path: body.path ?? null,
      referrer: body.referrer ?? null,
      sessionId: body.sessionId ?? null,
      visibleMs: typeof body.visibleMs === "number" ? body.visibleMs : null,
      locale: body.locale ?? null,
      timeZone: body.timeZone ?? null,
    };
    if (entry.timeZone) {
      console.log(entry);
      const logRef = db.collection(LOGS).doc();
      await logRef.set({
        type: "info",
        ...entry,
        createdAt: new Date(),
        doer: body.username ?? "unknown",
      });
    }

    return res.status(204).end();
  } catch (error) {
    console.error(error);
    return res.status(500).end();
  }
}

export default handler;
