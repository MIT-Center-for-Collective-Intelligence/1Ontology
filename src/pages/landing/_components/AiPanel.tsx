import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  MenuItem,
  TextField,
  Typography,
  alpha,
  keyframes,
  useTheme,
} from "@mui/material";
import type { Theme } from "@mui/material/styles";
import {
  AutoAwesomeOutlined as SparkIcon,
  ArrowUpward as SendIcon,
  SettingsOutlined as GearIcon,
} from "@mui/icons-material";
import {
  collection,
  documentId,
  getDocs,
  getFirestore,
  query as firestoreQuery,
  where,
} from "firebase/firestore";
import {
  AI_PROVIDERS,
  AiCallError,
  type AiConf,
  type AiProviderId,
  type ChatMsg,
  type ToolCall,
  callLLM,
  clearAiConf,
  defaultModel,
  loadAiConf,
  modelLabel,
  saveAiConf,
  verifyAiConf,
} from "./aiProviders";
import {
  MAX_GET_ACTIVITIES_BATCH,
  MAX_SEARCH_RESULTS,
  MAX_TOOL_ITERATIONS,
  SYSTEM_PROMPT,
  TOOLS,
  formatActivityProfile,
  formatSearchResults,
  type SearchHit,
} from "./aiContext";
import { Post } from "../../../lib/utils/Post";
import { NODES } from "../../../lib/firestoreClient/collections";
import type { INode } from "../../../types/INode";

const INTER =
  '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif';

const dotBounce = keyframes`
  0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
  40% { transform: translateY(-4px); opacity: 1; }
`;

const TypingDots: React.FC<{ color: string }> = ({ color }) => (
  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, py: 0.3 }}>
    {[0, 1, 2].map((i) => (
      <Box
        key={i}
        sx={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          bgcolor: color,
          animation: `${dotBounce} 1.2s infinite ease-in-out`,
          animationDelay: `${i * 0.15}s`,
        }}
      />
    ))}
  </Box>
);

type Turn =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string; modelLabel: string }
  | { kind: "error"; text: string; details?: unknown; status?: number };

type Props = {
  appName: string;
  // optional title forwarded from chip clicks for an immediate label
  navigateToNode: (id: string, title?: string) => void;
};

type SearchChromaResult = {
  id: string;
  title?: string;
  description?: string;
};

const runSearchActivities = async (
  query: string,
  appName: string,
): Promise<string> => {
  const trimmed = (query ?? "").trim();
  if (!trimmed) {
    return formatSearchResults(query ?? "", []);
  }
  try {
    const resp = await Post<{ results?: SearchChromaResult[] }>(
      "/searchChroma",
      {
        query: trimmed,
        appName,
        nodeType: "activity",
        resultsNum: MAX_SEARCH_RESULTS,
        skillsFuture: false,
      },
    );
    const hits: SearchHit[] = (resp?.results ?? []).map((r) => ({
      id: r.id,
      title: r.title ?? r.id,
      description: r.description,
    }));
    return formatSearchResults(trimmed, hits);
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Search failed for an unknown reason.";
    return `Search error: ${msg}. Try a different query or proceed without search.`;
  }
};

// Firestore `in` queries cap at 30 ids per call. We cap inputs at
// MAX_GET_ACTIVITIES_BATCH (20) but still chunk to be safe.
const FIRESTORE_IN_LIMIT = 30;

const fetchNodesByIds = async (
  ids: string[],
): Promise<Map<string, INode>> => {
  const out = new Map<string, INode>();
  if (ids.length === 0) return out;
  const db = getFirestore();
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += FIRESTORE_IN_LIMIT) {
    chunks.push(ids.slice(i, i + FIRESTORE_IN_LIMIT));
  }
  const snapshots = await Promise.all(
    chunks.map((chunk) =>
      getDocs(
        firestoreQuery(
          collection(db, NODES),
          where(documentId(), "in", chunk),
        ),
      ),
    ),
  );
  for (const snapshot of snapshots) {
    snapshot.forEach((doc) => {
      const data = { id: doc.id, ...(doc.data() as object) } as INode;
      out.set(doc.id, data);
    });
  }
  return out;
};

const notFoundProfile = (id: string) => `=== #${id} ===\n(Not found.)\n`;

const runGetActivities = async (
  ids: string[],
  appName: string,
  cache: Map<string, string>,
  currentLog: ChatMsg[],
): Promise<string> => {
  const cleaned = Array.from(
    new Set(
      (Array.isArray(ids) ? ids : [])
        .filter((x): x is string => typeof x === "string" && !!x.trim())
        .map((x) => x.trim()),
    ),
  ).slice(0, MAX_GET_ACTIVITIES_BATCH);

  if (cleaned.length === 0) return "No ids provided.";

  const missing = cleaned.filter((id) => !cache.has(id));
  if (missing.length > 0) {
    try {
      const fetched = await fetchNodesByIds(missing);
      for (const id of missing) {
        const node = fetched.get(id) ?? null;
        // Scope guard: hide nodes from other apps so cross-app data
        // can't leak through tool calls.
        if (node && (node as { appName?: string }).appName !== appName) {
          cache.set(id, notFoundProfile(id));
          continue;
        }
        cache.set(id, node ? formatActivityProfile(id, node) : notFoundProfile(id));
      }
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Fetch failed for an unknown reason.";
      return `get_activities error: ${msg}.`;
    }
  }

  // Detect ids whose full profile still sits in the current message log;
  // emit a pointer instead of duplicating the blob in the prompt.
  const stillInLog = (id: string) => {
    const tag = `=== #${id} `;
    return currentLog.some((m) => m.role === "tool" && m.content.includes(tag));
  };
  const parts = cleaned.map((id) => {
    if (stillInLog(id)) {
      return `=== #${id} ===\n(Already provided in an earlier tool result above; reuse that profile.)\n`;
    }
    return cache.get(id) ?? notFoundProfile(id);
  });

  return parts.join("\n");
};

const executeToolCall = async (
  call: ToolCall,
  appName: string,
  cache: Map<string, string>,
  currentLog: ChatMsg[],
): Promise<string> => {
  if (call.name === "search_activities") {
    const q = (call.input?.query ?? "") as string;
    return runSearchActivities(q, appName);
  }
  if (call.name === "get_activities") {
    const ids = (call.input?.ids ?? []) as string[];
    return runGetActivities(ids, appName, cache, currentLog);
  }
  return `Unknown tool: ${call.name}. Available tools: search_activities, get_activities.`;
};

const statusForCall = (call: ToolCall): string => {
  if (call.name === "search_activities") {
    const q = (call.input?.query ?? "") as string;
    return q ? `Searching for "${q.slice(0, 40)}"…` : "Searching ontology…";
  }
  if (call.name === "get_activities") {
    const ids = (call.input?.ids ?? []) as string[];
    const n = Array.isArray(ids) ? ids.length : 0;
    return n === 1
      ? "Reading 1 activity…"
      : `Reading ${n} activities…`;
  }
  return `Calling ${call.name}…`;
};

// Markdown-lite: fenced code, **#ID Title** chips, **bold**, `code`,
// ## headings, --- rules, newlines.
const renderInline = (
  text: string,
  onNav: (id: string, title?: string) => void,
  accent: string,
  keyPrefix: string,
): React.ReactNode[] => {
  const out: React.ReactNode[] = [];
  // Chips first; the optional prefix recovers a chip when the model
  // wraps surrounding words in the same bold span.
  const chipRe = /\*\*([^*]*?)#([A-Za-z0-9_-]+)\s+(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = chipRe.exec(text)) !== null) {
    if (m.index > last) {
      out.push(
        ...renderPlain(
          text.slice(last, m.index),
          accent,
          `${keyPrefix}-p${i}`,
        ),
      );
    }
    const prefix = m[1];
    const id = m[2];
    const title = m[3].trim();
    if (prefix) {
      out.push(
        <Box
          key={`${keyPrefix}-bp${i}`}
          component="strong"
          sx={{ fontWeight: 700 }}
        >
          {prefix}
        </Box>,
      );
    }
    out.push(
      <Box
        key={`${keyPrefix}-chip${i}`}
        component="span"
        onClick={() => onNav(id, title)}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          px: 0.7,
          py: 0.1,
          mx: 0.25,
          borderRadius: "8px",
          bgcolor: alpha(accent, 0.14),
          border: `1px solid ${alpha(accent, 0.35)}`,
          color: accent,
          fontSize: "0.82em",
          fontWeight: 600,
          cursor: "pointer",
          transition: "background 0.15s ease",
          "&:hover": { bgcolor: alpha(accent, 0.24) },
        }}
      >
        {title}
      </Box>,
    );
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) {
    out.push(
      ...renderPlain(text.slice(last), accent, `${keyPrefix}-p${i}`),
    );
  }
  return out;
};

const renderPlain = (
  text: string,
  accent: string,
  keyPrefix: string,
): React.ReactNode[] => {
  const out: React.ReactNode[] = [];
  // Block-level handling (lists, headings, rules, line breaks) is upstream
  // in renderTextBlock; this pass only needs the inline tokens.
  // Non-greedy bold so `*` inside the run (e.g. "5* hotels") survives.
  const tokenRe = /\*\*(.+?)\*\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = tokenRe.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      out.push(
        <Box
          key={`${keyPrefix}-b${i}`}
          component="strong"
          sx={{ fontWeight: 700 }}
        >
          {m[1]}
        </Box>,
      );
    } else if (m[2]) {
      out.push(
        <Box
          key={`${keyPrefix}-c${i}`}
          component="code"
          sx={{
            fontFamily:
              '"SF Mono", ui-monospace, Menlo, Monaco, "Cascadia Code", monospace',
            fontSize: "0.85em",
            bgcolor: (t) => alpha(t.palette.text.primary, 0.08),
            px: 0.5,
            py: 0.1,
            borderRadius: 0.6,
          }}
        >
          {m[2]}
        </Box>,
      );
    }
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
};

// Block-level pass: split on newlines, emit headings / rules / lists / paragraph
// lines, and delegate inline parsing (chips, bold, code) to renderInline.
const renderTextBlock = (
  text: string,
  onNav: (id: string, title?: string) => void,
  accent: string,
  keyPrefix: string,
): React.ReactNode[] => {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let listOrdered = false;
  let listSeq = 0;

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const items = listBuffer.slice();
    const ordered = listOrdered;
    const seq = listSeq++;
    out.push(
      <Box
        key={`${keyPrefix}-list${seq}`}
        component={ordered ? "ol" : "ul"}
        sx={{
          pl: 2.5,
          my: 0.4,
          "& li": { mb: 0.15 },
          "& li::marker": { color: alpha(accent, 0.7) },
        }}
      >
        {items.map((content, j) => (
          <li key={j}>
            {renderInline(content, onNav, accent, `${keyPrefix}-l${seq}-${j}`)}
          </li>
        ))}
      </Box>,
    );
    listBuffer = [];
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trimEnd();

    // Horizontal rule: --- or *** alone on a line.
    if (/^\s*(?:---+|\*\*\*+)\s*$/.test(line)) {
      flushList();
      out.push(
        <Box
          key={`${keyPrefix}-hr${idx}`}
          component="hr"
          sx={{
            border: 0,
            borderTop: (t) =>
              `1px solid ${alpha(t.palette.text.primary, 0.12)}`,
            my: 1,
          }}
        />,
      );
      return;
    }

    // Headings: # / ## / ###. Sized down so they sit nicely in a chat bubble.
    const heading = /^\s*(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flushList();
      const level = heading[1].length;
      const fontSize =
        level === 1 ? "1.05rem" : level === 2 ? "0.95rem" : "0.88rem";
      out.push(
        <Box
          key={`${keyPrefix}-h${idx}`}
          sx={{
            fontSize,
            fontWeight: 700,
            mt: idx === 0 ? 0 : 0.8,
            mb: 0.3,
            letterSpacing: "-0.005em",
          }}
        >
          {renderInline(heading[2], onNav, accent, `${keyPrefix}-h${idx}`)}
        </Box>,
      );
      return;
    }

    // List items: bullet (- or *) or numbered (1.). The bullet `*` regex
    // requires a trailing space, so it can't swallow a leading **bold**.
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const ordered = !!numbered;
      if (listBuffer.length > 0 && ordered !== listOrdered) flushList();
      listOrdered = ordered;
      listBuffer.push((bullet ?? numbered)![1]);
      return;
    }

    // Plain line — flush any pending list before emitting.
    flushList();
    if (line.length === 0) {
      out.push(
        <Box key={`${keyPrefix}-gap${idx}`} sx={{ height: "0.45em" }} />,
      );
      return;
    }
    out.push(
      <Box key={`${keyPrefix}-line${idx}`}>
        {renderInline(line, onNav, accent, `${keyPrefix}-line${idx}`)}
      </Box>,
    );
  });
  flushList();
  return out;
};

const AssistantText: React.FC<{
  text: string;
  onNav: (id: string, title?: string) => void;
}> = ({ text, onNav }) => {
  const theme = useTheme();
  const accent = theme.palette.primary.main;

  const segments = useMemo(() => {
    const re = /```(\w*)\n?([\s\S]*?)```/g;
    const parts: Array<
      { kind: "text"; text: string } | { kind: "code"; text: string }
    > = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) {
        parts.push({ kind: "text", text: text.slice(last, m.index) });
      }
      parts.push({ kind: "code", text: m[2] });
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
    return parts;
  }, [text]);

  return (
    <Box sx={{ fontSize: "0.85rem", lineHeight: 1.55, fontFamily: INTER }}>
      {segments.map((seg, idx) =>
        seg.kind === "code" ? (
          <Box
            key={`seg${idx}`}
            component="pre"
            sx={{
              my: 1,
              p: 1.1,
              borderRadius: 1,
              fontFamily:
                '"SF Mono", ui-monospace, Menlo, Monaco, "Cascadia Code", monospace',
              fontSize: "0.78rem",
              lineHeight: 1.5,
              bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
              overflowX: "auto",
              whiteSpace: "pre",
            }}
          >
            {seg.text}
          </Box>
        ) : (
          <React.Fragment key={`seg${idx}`}>
            {renderTextBlock(seg.text, onNav, accent, `seg${idx}`)}
          </React.Fragment>
        ),
      )}
    </Box>
  );
};

export const AiPanel: React.FC<Props> = ({ appName, navigateToNode }) => {
  const theme = useTheme();
  const accent = theme.palette.primary.main;

  const [conf, setConf] = useState<AiConf | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [editingConf, setEditingConf] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set());

  // Full log fed to the model (incl. tool calls/results); `turns` is
  // the visible history (user/assistant text + errors only).
  const [msgLog, setMsgLog] = useState<ChatMsg[]>([]);

  const toggleErrorDetails = useCallback((idx: number) => {
    setExpandedErrors((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  // Form state for provider/model/key (used by empty-state + "change key")
  const [formProv, setFormProv] = useState<AiProviderId>("openrouter");
  const [formModel, setFormModel] = useState<string>(defaultModel("openrouter"));
  const [formKey, setFormKey] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const streamRef = useRef<HTMLDivElement | null>(null);

  // Session cache of formatted profile strings keyed by activity id.
  // Survives turn-to-turn so a re-fetch of the same id skips Firestore;
  // when paired with stillInLog(), also skips re-emitting the blob.
  const profileCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const existing = loadAiConf();
    if (existing) {
      setConf(existing);
      setFormProv(existing.prov);
      setFormModel(existing.model);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    const el = streamRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [turns, loading]);

  const send = useCallback(async () => {
    const q = input.trim();
    if (!q || !conf || loading) return;
    setInput("");
    setTurns((prev) => [...prev, { kind: "user", text: q }]);
    setLoading(true);
    setStatus("Thinking…");

    // Snapshot so we can revert on error (avoids a half-tool-called log).
    const baseLog = msgLog;
    // Rough budget: ~100 mixed user/assistant/tool messages
    let trimmed = baseLog.length > 100 ? baseLog.slice(-100) : baseLog;
    const firstSafe = trimmed.findIndex(
      (m) => m.role === "user" || (m.role === "assistant" && !m.toolCalls?.length),
    );
    if (firstSafe > 0) trimmed = trimmed.slice(firstSafe);
    const initialMessages: ChatMsg[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...trimmed,
      { role: "user", content: q },
    ];

    let working: ChatMsg[] = initialMessages;
    let finalText = "";

    try {
      for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
        // Last iteration: drop tools so the model must produce a final answer.
        const toolsForCall = i === MAX_TOOL_ITERATIONS - 1 ? undefined : TOOLS;
        const resp = await callLLM(conf, working, toolsForCall);

        if (resp.kind === "text") {
          finalText = resp.text;
          working = [
            ...working,
            { role: "assistant", content: resp.text },
          ];
          break;
        }

        const calls = resp.calls;
        setStatus(
          calls.length === 1
            ? statusForCall(calls[0])
            : `Running ${calls.length} tools…`,
        );
        working = [
          ...working,
          {
            role: "assistant",
            content: resp.text ?? "",
            toolCalls: calls,
          },
        ];

        const logForDedup = working;
        const results = await Promise.all(
          calls.map(async (c) => ({
            id: c.id,
            name: c.name,
            content: await executeToolCall(
              c,
              appName,
              profileCacheRef.current,
              logForDedup,
            ),
          })),
        );
        for (const r of results) {
          working.push({
            role: "tool",
            content: r.content,
            toolCallId: r.id,
            toolName: r.name,
          });
        }
        setStatus("Thinking…");
      }

      if (!finalText) {
        throw new AiCallError(
          "The assistant kept calling tools without answering. Try rephrasing your question.",
        );
      }

      // System header is re-prepended on every send, so strip it here.
      setMsgLog(working.filter((m) => m.role !== "system"));
      setTurns((prev) => [
        ...prev,
        { kind: "assistant", text: finalText, modelLabel: modelLabel(conf) },
      ]);
    } catch (e) {
      const msg =
        e instanceof AiCallError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Something went wrong.";
      const details = e instanceof AiCallError ? e.details : undefined;
      const errStatus = e instanceof AiCallError ? e.status : undefined;
      setTurns((prev) => [
        ...prev,
        { kind: "error", text: msg, details, status: errStatus },
      ]);
      // Don't poison the log with a half-finished tool-call cycle.
    } finally {
      setLoading(false);
      setStatus("");
    }
  }, [input, conf, loading, msgLog, appName]);

  const handleProvChange = (prov: AiProviderId) => {
    setFormProv(prov);
    setFormModel(defaultModel(prov));
  };

  const saveForm = async () => {
    if (verifying) return;
    const key = formKey.trim();
    if (!key) {
      setFormError("Enter an API key.");
      return;
    }
    const next: AiConf = { prov: formProv, model: formModel, key };
    setFormError(null);
    setVerifying(true);
    try {
      await verifyAiConf(next);
    } catch (e) {
      const msg =
        e instanceof AiCallError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Couldn't verify the key.";
      setFormError(msg);
      setVerifying(false);
      return;
    }
    saveAiConf(next);
    setConf(next);
    setFormKey("");
    setVerifying(false);
    setEditingConf(false);
  };

  const clearAll = () => {
    clearAiConf();
    setConf(null);
    setFormKey("");
    setTurns([]);
    setMsgLog([]);
    profileCacheRef.current.clear();
    setEditingConf(false);
  };

  // Spinner until hydrated, to avoid flashing the empty state.
  if (!hydrated) {
    return (
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress size={20} thickness={4} />
      </Box>
    );
  }

  const showForm = !conf || editingConf;

  if (showForm) {
    return (
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          px: 1.5,
          pb: 2,
          "&::-webkit-scrollbar": { width: 6 },
          "&::-webkit-scrollbar-thumb": {
            background: alpha(theme.palette.text.primary, 0.14),
            borderRadius: 3,
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 0.6,
            mt: 3.5,
            mb: 2.5,
            px: 2,
          }}
        >
          <SparkIcon
            sx={{ fontSize: 18, color: accent, opacity: 0.85, mb: 0.3 }}
          />
          <Typography
            sx={{
              fontSize: "0.88rem",
              fontFamily: INTER,
              fontWeight: 600,
              color: "text.primary",
              letterSpacing: "-0.005em",
              lineHeight: 1.3,
            }}
          >
            {conf ? "Change your API key" : "Ask the ontology"}
          </Typography>
          <Typography
            sx={{
              fontSize: "0.75rem",
              fontFamily: INTER,
              color: "text.secondary",
              lineHeight: 1.55,
              maxWidth: 280,
            }}
          >
            Bring your own API key. It stays in this browser — nothing is sent
            to our servers.
          </Typography>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.55 }}>
            <Typography sx={fieldLabelSx}>Provider</Typography>
            <TextField
              select
              size="small"
              value={formProv}
              onChange={(e) =>
                handleProvChange(e.target.value as AiProviderId)
              }
              sx={modernFieldSx(theme)}
              slotProps={{
                select: { MenuProps: buildMenuProps(theme) },
              }}
            >
              {Object.entries(AI_PROVIDERS).map(([id, cfg]) => (
                <MenuItem key={id} value={id}>
                  {cfg.name}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.55 }}>
            <Typography sx={fieldLabelSx}>Model</Typography>
            <TextField
              select
              size="small"
              value={formModel}
              onChange={(e) => setFormModel(e.target.value)}
              sx={modernFieldSx(theme)}
              slotProps={{
                select: { MenuProps: buildMenuProps(theme) },
              }}
            >
              {AI_PROVIDERS[formProv].models.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.name}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.55 }}>
            <Typography sx={fieldLabelSx}>API key</Typography>
            <TextField
              type="password"
              size="small"
              placeholder="Paste your key…"
              value={formKey}
              onChange={(e) => {
                setFormKey(e.target.value);
                if (formError) setFormError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveForm();
              }}
              error={!!formError}
              helperText={formError ?? " "}
              sx={modernFieldSx(theme)}
            />
          </Box>

          <Button
            variant="text"
            disableElevation
            onClick={saveForm}
            disabled={verifying}
            startIcon={
              verifying ? (
                <CircularProgress
                  size={12}
                  thickness={5}
                  sx={{ color: "inherit" }}
                />
              ) : undefined
            }
            sx={{
              mt: 0.5,
              borderRadius: 999,
              textTransform: "none",
              fontFamily: INTER,
              fontWeight: 500,
              fontSize: "0.8rem",
              py: 0.85,
              letterSpacing: 0.2,
              color: accent,
              bgcolor: alpha(accent, 0.12),
              boxShadow: `inset 0 0 0 1px ${alpha(accent, 0.22)}`,
              transition: "all 0.15s ease",
              "&:hover": {
                bgcolor: alpha(accent, 0.2),
                boxShadow: `inset 0 0 0 1px ${alpha(accent, 0.32)}`,
              },
              "&:active": {
                transform: "scale(0.995)",
              },
              "&.Mui-disabled": {
                color: accent,
                bgcolor: alpha(accent, 0.08),
                boxShadow: `inset 0 0 0 1px ${alpha(accent, 0.18)}`,
                opacity: 0.8,
              },
            }}
          >
            {verifying
              ? "Verifying key…"
              : conf
                ? "Save changes"
                : "Save & enable"}
          </Button>

          {conf && (
            <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
              <Button
                variant="text"
                size="small"
                onClick={() => {
                  setEditingConf(false);
                  setFormKey("");
                  setFormError(null);
                  setFormProv(conf.prov);
                  setFormModel(conf.model);
                }}
                sx={{
                  textTransform: "none",
                  fontFamily: INTER,
                  fontSize: "0.73rem",
                  fontWeight: 500,
                  color: "text.secondary",
                  "&:hover": {
                    bgcolor: "transparent",
                    color: "text.primary",
                  },
                }}
              >
                Cancel
              </Button>
              <Button
                variant="text"
                size="small"
                onClick={clearAll}
                sx={{
                  textTransform: "none",
                  fontFamily: INTER,
                  fontSize: "0.73rem",
                  fontWeight: 500,
                  color: "text.secondary",
                  "&:hover": {
                    bgcolor: "transparent",
                    color: "error.main",
                  },
                }}
              >
                Clear saved key
              </Button>
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* <IconButton
        onClick={() => setEditingConf(true)}
        aria-label="API settings"
        disableRipple
        sx={{
          position: "absolute",
          top: 6,
          right: 10,
          zIndex: 5,
          width: 26,
          height: 26,
          color: "text.secondary",
          bgcolor: (t) => alpha(t.palette.background.paper, 0.75),
          backdropFilter: "blur(6px)",
          boxShadow: (t) =>
            `inset 0 0 0 1px ${alpha(t.palette.text.primary, 0.08)}`,
          transition:
            "color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease",
          "&:hover": {
            color: accent,
            bgcolor: (t) => alpha(t.palette.primary.main, 0.14),
            boxShadow: `inset 0 0 0 1px ${alpha(accent, 0.28)}`,
          },
        }}
      >
        <GearIcon sx={{ fontSize: 15 }} />
      </IconButton> */}

      <Box
        ref={streamRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          px: 1.5,
          pt: 1.5,
          pb: 2,
          // Soft fade so scrolled messages dissolve into the composer.
          maskImage:
            "linear-gradient(to bottom, #000 calc(100% - 24px), transparent)",
          WebkitMaskImage:
            "linear-gradient(to bottom, #000 calc(100% - 24px), transparent)",
          "&::-webkit-scrollbar": { width: 6 },
          "&::-webkit-scrollbar-thumb": {
            background: alpha(theme.palette.text.primary, 0.14),
            borderRadius: 3,
          },
        }}
      >
        {turns.length === 0 && !loading && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: 0.75,
              mt: 3,
              px: 2,
              color: "text.secondary",
            }}
          >
            <SparkIcon sx={{ fontSize: 22, opacity: 0.5, color: accent }} />
            <Typography
              sx={{
                fontSize: "0.8rem",
                fontFamily: INTER,
                fontWeight: 500,
              }}
            >
              Ask about any activity
            </Typography>
            <Typography
              sx={{
                fontSize: "0.72rem",
                fontFamily: INTER,
                color: "text.disabled",
                lineHeight: 1.5,
              }}
            >
              Try: &ldquo;What are the parts of Transport?&rdquo; or
              &ldquo;Compare Move vs Transport.&rdquo;
            </Typography>
          </Box>
        )}

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.1 }}>
          {turns.map((t, idx) => {
            if (t.kind === "user") {
              return (
                <Box
                  key={idx}
                  sx={{
                    alignSelf: "flex-end",
                    maxWidth: "85%",
                    px: 1.4,
                    py: 0.9,
                    borderRadius: "16px 16px 4px 16px",
                    background: (tt) =>
                      `linear-gradient(135deg, ${alpha(accent, tt.palette.mode === "dark" ? 0.24 : 0.18)} 0%, ${alpha(accent, tt.palette.mode === "dark" ? 0.14 : 0.1)} 100%)`,
                    border: `1px solid ${alpha(accent, 0.2)}`,
                    color: "text.primary",
                    fontFamily: INTER,
                    fontSize: "0.85rem",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    boxShadow: (tt) =>
                      tt.palette.mode === "dark"
                        ? "0 1px 2px rgba(0,0,0,0.2)"
                        : "0 1px 2px rgba(0,0,0,0.04)",
                  }}
                >
                  {t.text}
                </Box>
              );
            }
            if (t.kind === "assistant") {
              return (
                <Box
                  key={idx}
                  sx={{
                    alignSelf: "flex-start",
                    maxWidth: "92%",
                    px: 1.4,
                    py: 1.1,
                    borderRadius: "16px 16px 16px 4px",
                    bgcolor: (tt) => alpha(tt.palette.text.primary, 0.04),
                    border: (tt) =>
                      `1px solid ${alpha(tt.palette.text.primary, 0.05)}`,
                    color: "text.primary",
                    overflowWrap: "anywhere",
                  }}
                >
                  <Typography
                    component="span"
                    sx={{
                      display: "inline-block",
                      mb: 0.5,
                      fontFamily: INTER,
                      fontSize: "0.62rem",
                      letterSpacing: 0.6,
                      textTransform: "uppercase",
                      color: "text.disabled",
                      fontWeight: 600,
                    }}
                  >
                    {t.modelLabel}
                  </Typography>
                  <AssistantText text={t.text} onNav={navigateToNode} />
                </Box>
              );
            }
            // error
            const isExpanded = expandedErrors.has(idx);
            const hasDetails = t.details !== undefined;
            let detailsText = "";
            if (hasDetails) {
              try {
                detailsText = JSON.stringify(
                  t.status !== undefined &&
                    t.details &&
                    typeof t.details === "object"
                    ? { status: t.status, ...(t.details as object) }
                    : t.details,
                  null,
                  2,
                );
              } catch {
                detailsText = String(t.details);
              }
            }
            return (
              <Box
                key={idx}
                sx={{
                  alignSelf: "flex-start",
                  maxWidth: "92%",
                  px: 1.4,
                  py: 0.9,
                  borderRadius: "16px 16px 16px 4px",
                  bgcolor: (tt) => alpha(tt.palette.error.main, 0.08),
                  border: (tt) =>
                    `1px solid ${alpha(tt.palette.error.main, 0.3)}`,
                  color: "error.main",
                  fontFamily: INTER,
                  fontSize: "0.82rem",
                  lineHeight: 1.5,
                  overflowWrap: "anywhere",
                }}
              >
                <Box sx={{ whiteSpace: "pre-wrap" }}>{t.text}</Box>
                {hasDetails && (
                  <Box
                    component="button"
                    type="button"
                    onClick={() => toggleErrorDetails(idx)}
                    sx={{
                      mt: 0.6,
                      background: "none",
                      border: "none",
                      p: 0,
                      cursor: "pointer",
                      fontFamily: INTER,
                      fontSize: "0.7rem",
                      fontWeight: 500,
                      color: "error.main",
                      opacity: 0.75,
                      textDecoration: "underline",
                      textDecorationStyle: "dotted",
                      textUnderlineOffset: "2px",
                      "&:hover": { opacity: 1 },
                    }}
                  >
                    {isExpanded ? "Hide details" : "Show details"}
                  </Box>
                )}
                {hasDetails && isExpanded && (
                  <Box
                    component="pre"
                    sx={{
                      mt: 0.8,
                      p: 1,
                      borderRadius: 1,
                      bgcolor: (tt) =>
                        alpha(tt.palette.text.primary, 0.06),
                      color: "text.primary",
                      fontFamily:
                        '"SF Mono", ui-monospace, Menlo, Monaco, "Cascadia Code", monospace',
                      fontSize: "0.7rem",
                      lineHeight: 1.5,
                      maxHeight: 280,
                      overflow: "auto",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {detailsText}
                  </Box>
                )}
              </Box>
            );
          })}

          {loading && (
            <Box
              sx={{
                alignSelf: "flex-start",
                px: 1.4,
                py: 1,
                borderRadius: "16px 16px 16px 4px",
                bgcolor: (tt) => alpha(tt.palette.text.primary, 0.04),
                border: (tt) =>
                  `1px solid ${alpha(tt.palette.text.primary, 0.05)}`,
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <TypingDots color={alpha(theme.palette.text.primary, 0.45)} />
              {status && (
                <Typography
                  sx={{
                    fontSize: "0.75rem",
                    fontFamily: INTER,
                    color: "text.secondary",
                    lineHeight: 1.2,
                  }}
                >
                  {status}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </Box>

      <Box sx={{ px: 1.5, pt: 1, pb: 1 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-end",
            gap: 0.75,
            p: 0.5,
            pl: 2,
            pr: 0.5,
            borderRadius: "22px",
            bgcolor: (t) =>
              t.palette.mode === "dark"
                ? alpha(t.palette.background.paper, 0.85)
                : t.palette.background.paper,
            border: (t) => `1px solid ${alpha(t.palette.text.primary, 0.08)}`,
            boxShadow: (t) =>
              t.palette.mode === "dark"
                ? "0 4px 18px rgba(0,0,0,0.38)"
                : "0 4px 18px rgba(0,0,0,0.07)",
            transition: "border-color 0.15s ease, box-shadow 0.15s ease",
            "&:focus-within": {
              borderColor: alpha(accent, 0.4),
              boxShadow: (t) =>
                `${t.palette.mode === "dark" ? "0 4px 20px rgba(0,0,0,0.42)" : "0 4px 20px rgba(0,0,0,0.09)"}, 0 0 0 3px ${alpha(accent, 0.1)}`,
            },
          }}
        >
          <TextField
            variant="standard"
            fullWidth
            multiline
            maxRows={5}
            placeholder="Ask about the ontology…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={loading}
            slotProps={{
              input: { disableUnderline: true },
            }}
            sx={{
              alignSelf: "stretch",
              "& .MuiInputBase-root": {
                py: 0.7,
                pr: 0.5,
              },
              "& .MuiInputBase-input": {
                fontFamily: INTER,
                fontSize: "0.88rem",
                lineHeight: 1.45,
                py: 0,
                // Thin, subtle scrollbar that matches the message stream above.
                scrollbarWidth: "thin",
                scrollbarColor: (t) =>
                  `${alpha(t.palette.text.primary, 0.18)} transparent`,
                "&::-webkit-scrollbar": { width: 6 },
                "&::-webkit-scrollbar-track": { background: "transparent" },
                "&::-webkit-scrollbar-thumb": {
                  background: (t) => alpha(t.palette.text.primary, 0.16),
                  borderRadius: 3,
                },
                "&::-webkit-scrollbar-thumb:hover": {
                  background: (t) => alpha(t.palette.text.primary, 0.28),
                },
              },
              "& .MuiInputBase-input::placeholder": { opacity: 0.55 },
            }}
          />
          <IconButton
            onClick={send}
            disabled={!input.trim() || loading}
            disableRipple
            sx={{
              flexShrink: 0,
              alignSelf: "flex-end",
              mb: 0.25,
              width: 30,
              height: 30,
              color: accent,
              bgcolor: alpha(accent, 0.14),
              boxShadow: `inset 0 0 0 1px ${alpha(accent, 0.24)}`,
              transition:
                "background-color 0.15s ease, box-shadow 0.15s ease, transform 0.12s ease",
              "&:hover": {
                bgcolor: alpha(accent, 0.22),
                boxShadow: `inset 0 0 0 1px ${alpha(accent, 0.36)}`,
              },
              "&:active": {
                transform: "scale(0.96)",
              },
              "&.Mui-disabled": {
                color: "text.disabled",
                bgcolor: (t) => alpha(t.palette.text.primary, 0.05),
                boxShadow: (t) =>
                  `inset 0 0 0 1px ${alpha(t.palette.text.primary, 0.08)}`,
              },
            }}
          >
            {loading ? (
              <CircularProgress
                size={12}
                thickness={5}
                sx={{ color: "inherit" }}
              />
            ) : (
              <SendIcon sx={{ fontSize: 15 }} />
            )}
          </IconButton>
        </Box>
      </Box>

      <Box
        sx={{
          borderTop: (t) => `1px solid ${alpha(t.palette.text.primary, 0.06)}`,
          px: 1.75,
          py: 0.75,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Typography
          sx={{
            fontSize: "0.66rem",
            fontFamily: INTER,
            color: "text.disabled",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {conf ? modelLabel(conf) : ""}
        </Typography>
        <Box
          component="button"
          type="button"
          onClick={() => setEditingConf(true)}
          sx={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "0.7rem",
            fontFamily: INTER,
            fontWeight: 500,
            color: "text.secondary",
            p: 0,
            "&:hover": { color: accent },
          }}
        >
          Change API key
        </Box>
      </Box>
    </Box>
  );
};

const fieldLabelSx = {
  fontSize: "0.7rem",
  fontFamily: INTER,
  fontWeight: 600,
  color: "text.secondary",
  letterSpacing: 0.3,
  textTransform: "uppercase" as const,
  pl: 0.3,
};

const modernFieldSx = (theme: Theme) => ({
  "& .MuiOutlinedInput-root": {
    borderRadius: 2,
    bgcolor: alpha(theme.palette.text.primary, 0.035),
    fontFamily: INTER,
    fontSize: "0.86rem",
    transition: "background-color 0.15s ease, box-shadow 0.15s ease",
    "& fieldset": {
      borderColor: alpha(theme.palette.text.primary, 0.07),
      transition: "border-color 0.15s ease",
    },
    "&:hover": {
      bgcolor: alpha(theme.palette.text.primary, 0.05),
    },
    "&:hover fieldset": {
      borderColor: alpha(theme.palette.text.primary, 0.14),
    },
    "&.Mui-focused": {
      bgcolor:
        theme.palette.mode === "dark"
          ? alpha(theme.palette.primary.main, 0.06)
          : alpha(theme.palette.primary.main, 0.04),
      boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.1)}`,
    },
    "&.Mui-focused fieldset": {
      borderColor: alpha(theme.palette.primary.main, 0.5),
      borderWidth: 1,
    },
    "&.Mui-error": {
      boxShadow: `0 0 0 3px ${alpha(theme.palette.error.main, 0.1)}`,
    },
    "&.Mui-error fieldset": {
      borderColor: alpha(theme.palette.error.main, 0.55),
    },
  },
  "& .MuiSelect-select": {
    py: 1.05,
  },
  "& .MuiSelect-icon": {
    color: alpha(theme.palette.text.primary, 0.4),
    transition: "color 0.15s ease",
  },
  "&:hover .MuiSelect-icon": {
    color: alpha(theme.palette.text.primary, 0.7),
  },
  "& .MuiFormHelperText-root": {
    fontFamily: INTER,
    fontSize: "0.7rem",
    mt: 0.5,
    ml: 0.3,
  },
});

const buildMenuProps = (theme: Theme) => ({
  PaperProps: {
    sx: {
      mt: 0.5,
      borderRadius: 2,
      border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
      backgroundImage: "none",
      bgcolor:
        theme.palette.mode === "dark"
          ? alpha(theme.palette.background.paper, 0.94)
          : alpha(theme.palette.background.paper, 0.98),
      backdropFilter: "blur(10px)",
      boxShadow:
        theme.palette.mode === "dark"
          ? "0 10px 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)"
          : "0 10px 30px rgba(0,0,0,0.1)",
      overflow: "hidden",
      "& .MuiList-root": {
        py: 0.5,
      },
      "& .MuiMenuItem-root": {
        fontFamily: INTER,
        fontSize: "0.85rem",
        mx: 0.5,
        my: 0.1,
        px: 1.2,
        py: 0.75,
        borderRadius: 1.25,
        transition: "background-color 0.12s ease, color 0.12s ease",
        "&:hover": {
          bgcolor: alpha(theme.palette.text.primary, 0.06),
        },
        "&.Mui-selected": {
          bgcolor: alpha(theme.palette.primary.main, 0.14),
          color: theme.palette.primary.main,
          fontWeight: 600,
          "&:hover": {
            bgcolor: alpha(theme.palette.primary.main, 0.2),
          },
        },
      },
    },
  },
});

export default function AiPanelPage() {
  return null;
}
