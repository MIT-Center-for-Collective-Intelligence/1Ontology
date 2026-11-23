import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@components/components/context/AuthContext";

const newSessionId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export type VisitLogDetails = {
  nodeId?: string;
  nodeTitle?: string;
  searchQuery?: string;
  source?: string;
  resultCount?: number;
};

type VisitSession = { sessionId: string; path: string };

const postVisitLog = (body: Record<string, unknown>) => {
  void fetch("/api/log-visit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {});
};

export const usePageVisitLog = () => {
  const [{ user, isAuthInitialized }] = useAuth();
  const usernameRef = useRef<string | undefined>(user?.uname);
  usernameRef.current = user?.uname;
  const sessionRef = useRef<VisitSession | null>(null);

  const send = useCallback(
    (session: VisitSession, payload: Record<string, unknown>) => {
      const username = usernameRef.current;
      postVisitLog({
        path: session.path,
        sessionId: session.sessionId,
        locale: navigator.language,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(username ? { username } : {}),
        ...payload,
      });
    },
    [],
  );

  useEffect(() => {
    if (!isAuthInitialized) return;

    const session: VisitSession = {
      sessionId: newSessionId(),
      path: window.location.pathname,
    };
    sessionRef.current = session;
    const startedAt = Date.now();

    send(session, { event: "page_view", referrer: document.referrer || null });

    let left = false;
    const leave = () => {
      if (left) return;
      left = true;
      send(session, { event: "page_leave", visibleMs: Date.now() - startedAt });
    };

    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
      sessionRef.current = null;
    };
  }, [isAuthInitialized, send]);

  return useCallback(
    (event: string, details: VisitLogDetails = {}) => {
      const session = sessionRef.current;
      if (!session) return;
      send(session, { event, ...details });
    },
    [send],
  );
};
