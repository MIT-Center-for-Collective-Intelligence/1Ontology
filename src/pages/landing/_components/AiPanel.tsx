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
} from "@mui/icons-material";
import {
  AI_PROVIDERS,
  AiCallError,
  type AiConf,
  type AiProviderId,
  type ChatMsg,
  callLLM,
  clearAiConf,
  defaultModel,
  loadAiConf,
  modelLabel,
  saveAiConf,
  verifyAiConf,
} from "./aiProviders";
import { buildDirectory, buildSystemPrompt } from "./aiContext";
import type { INode } from "../../../types/INode";

const INTER =
  '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif';

// Three-dot typing indicator — each dot bounces on a staggered delay.
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
  | { kind: "error"; text: string };

type Props = {
  nodes: { [id: string]: INode };
  navigateToNode: (id: string) => void;
};

// ──────────────────────────────────────────────────────────────
// Inline markdown-lite renderer for assistant replies.
// Handles fenced code blocks, **#ID Title** chips (clickable), **bold**,
// `inline code`, ## headings, --- rules, and newlines.
// ──────────────────────────────────────────────────────────────

const renderInline = (
  text: string,
  onNav: (id: string) => void,
  accent: string,
  keyPrefix: string,
): React.ReactNode[] => {
  const out: React.ReactNode[] = [];
  // Split on **#ID Title** first since chips take priority
  const chipRe = /\*\*#([A-Za-z0-9_-]+)\s+([^*]+)\*\*/g;
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
    const id = m[1];
    const title = m[2].trim();
    out.push(
      <Box
        key={`${keyPrefix}-chip${i}`}
        component="span"
        onClick={() => onNav(id)}
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
  // Handle **bold**, `code`, newlines.
  const out: React.ReactNode[] = [];
  const tokenRe = /\*\*([^*]+)\*\*|`([^`]+)`|\n/g;
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
    } else {
      out.push(<br key={`${keyPrefix}-br${i}`} />);
    }
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
};

const AssistantText: React.FC<{
  text: string;
  onNav: (id: string) => void;
}> = ({ text, onNav }) => {
  const theme = useTheme();
  const accent = theme.palette.primary.main;

  // Split out fenced code blocks (```...```) and render them as preformatted.
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
          <Box key={`seg${idx}`} component="span">
            {renderInline(seg.text, onNav, accent, `seg${idx}`)}
          </Box>
        ),
      )}
    </Box>
  );
};

// ──────────────────────────────────────────────────────────────
// Main panel
// ──────────────────────────────────────────────────────────────

const AiPanel: React.FC<Props> = ({ nodes, navigateToNode }) => {
  const theme = useTheme();
  const accent = theme.palette.primary.main;

  const [conf, setConf] = useState<AiConf | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingConf, setEditingConf] = useState(false);

  // Form state for provider/model/key (used by empty-state + "change key")
  const [formProv, setFormProv] = useState<AiProviderId>("openrouter");
  const [formModel, setFormModel] = useState<string>(defaultModel("openrouter"));
  const [formKey, setFormKey] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const streamRef = useRef<HTMLDivElement | null>(null);

  // Hydrate from localStorage once.
  useEffect(() => {
    const existing = loadAiConf();
    if (existing) {
      setConf(existing);
      setFormProv(existing.prov);
      setFormModel(existing.model);
    }
    setHydrated(true);
  }, []);

  // Scroll to bottom on new turns or loading flip.
  useEffect(() => {
    const el = streamRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [turns, loading]);

  // Directory is expensive to build for large ontologies; memoize on `nodes`.
  const directory = useMemo(() => buildDirectory(nodes), [nodes]);

  // Keep only the last 20 display turns of conversation context.
  const historyForPrompt: ChatMsg[] = useMemo(() => {
    const msgs: ChatMsg[] = [];
    for (const t of turns) {
      if (t.kind === "user") msgs.push({ role: "user", content: t.text });
      else if (t.kind === "assistant")
        msgs.push({ role: "assistant", content: t.text });
    }
    return msgs.slice(-20);
  }, [turns]);

  const send = useCallback(async () => {
    const q = input.trim();
    if (!q || !conf || loading) return;
    setInput("");
    setTurns((prev) => [...prev, { kind: "user", text: q }]);
    setLoading(true);
    try {
      const sys = buildSystemPrompt(q, nodes, directory);
      const msgs: ChatMsg[] = [
        { role: "system", content: sys },
        ...historyForPrompt,
        { role: "user", content: q },
      ];
      const text = await callLLM(conf, msgs);
      setTurns((prev) => [
        ...prev,
        { kind: "assistant", text, modelLabel: modelLabel(conf) },
      ]);
    } catch (e) {
      const msg =
        e instanceof AiCallError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Something went wrong.";
      setTurns((prev) => [...prev, { kind: "error", text: msg }]);
    } finally {
      setLoading(false);
    }
  }, [input, conf, loading, nodes, directory, historyForPrompt]);

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
    setEditingConf(false);
  };

  // Until we've loaded from localStorage, show a spinner to avoid flashing
  // the empty state for users who already have a key configured.
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

  // ──────────────────────────────────────────────────────────
  // Empty / configure state
  // ──────────────────────────────────────────────────────────

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
        {/* Hero — minimal text block, matches the search empty-state voice */}
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

        {/* Form — stacked fields, no card chrome */}
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

  // ──────────────────────────────────────────────────────────
  // Chat state
  // ──────────────────────────────────────────────────────────

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Conversation stream */}
      <Box
        ref={streamRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          px: 1.5,
          pt: 1.5,
          pb: 2,
          // Soft fade at the bottom so scrolled messages dissolve into the
          // composer area instead of getting hard-cut at the edge.
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
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                }}
              >
                {t.text}
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
              }}
            >
              <TypingDots color={alpha(theme.palette.text.primary, 0.45)} />
            </Box>
          )}
        </Box>
      </Box>

      {/* Composer — pinned to the bottom, sits just above the footer */}
      <Box sx={{ px: 1.5, pt: 1, pb: 1 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            p: 0.5,
            pl: 2,
            pr: 1,
            borderRadius: 999,
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
            maxRows={4}
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
              "& .MuiInputBase-input": {
                fontFamily: INTER,
                fontSize: "0.88rem",
                lineHeight: 1.45,
                py: 0.7,
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

      {/* Persistent footer: model info + change-key link */}
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

export default AiPanel;
