// ──────────────────────────────────────────────────────────────
// Navigate AI — provider adapters, BYO-key, client-side only
// ──────────────────────────────────────────────────────────────

export type AiProviderId = "openrouter" | "anthropic" | "openai" | "google";

export type ChatMsg = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ProviderModel = {
  id: string;
  name: string;
  default?: boolean;
};

type BuiltRequest = {
  url: string;
  headers: Record<string, string>;
  body: unknown;
};

export type ProviderConfig = {
  name: string;
  models: ProviderModel[];
  build: (model: string, key: string, msgs: ChatMsg[]) => BuiltRequest;
  parse?: (raw: unknown) => string;
};

export type AiConf = {
  prov: AiProviderId;
  model: string;
  key: string;
};

// Model IDs per provider. Conservative, real IDs; users can update if the
// provider releases newer ones. Default item per provider is marked.
export const AI_PROVIDERS: Record<AiProviderId, ProviderConfig> = {
  openrouter: {
    name: "OpenRouter",
    models: [
      {
        id: "anthropic/claude-sonnet-4-6",
        name: "Claude Sonnet 4.6 (frontier)",
        default: true,
      },
      {
        id: "anthropic/claude-haiku-4-5",
        name: "Claude Haiku 4.5 (fast/cheap)",
      },
      { id: "openai/gpt-5.4", name: "GPT-5.4 (frontier)" },
      { id: "openai/gpt-5.4-mini", name: "GPT-5.4 mini (cheap)" },
      { id: "openai/gpt-4o", name: "GPT-4o" },
      { id: "openai/gpt-4o-mini", name: "GPT-4o mini" },
      {
        id: "google/gemini-3.1-pro-preview",
        name: "Gemini 3.1 Pro Preview",
      },
      { id: "google/gemini-3.1-flash", name: "Gemini 3.1 Flash" },
      { id: "google/gemini-2.0-flash", name: "Gemini 2.0 Flash" },
    ],
    build(model, key, msgs) {
      return {
        url: "https://openrouter.ai/api/v1/chat/completions",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: { model, messages: msgs, max_tokens: 4096 },
      };
    },
  },

  anthropic: {
    name: "Anthropic",
    models: [
      {
        id: "claude-sonnet-4-6",
        name: "Claude Sonnet 4.6 (frontier)",
        default: true,
      },
      {
        id: "claude-sonnet-4-6-20260301",
        name: "Claude Sonnet 4.6 (dated 2026-03-01)",
      },
      {
        id: "claude-opus-4-7",
        name: "Claude Opus 4.7 (most capable)",
      },
      {
        id: "claude-haiku-4-5-20251001",
        name: "Claude Haiku 4.5 (fast/cheap)",
      },
    ],
    build(model, key, msgs) {
      const sys = msgs.find((m) => m.role === "system")?.content ?? "";
      const rest = msgs
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content }));
      // cache_control on the system block lets Anthropic cache the ~20K-token
      // ontology directory across turns (big cost win).
      return {
        url: "https://api.anthropic.com/v1/messages",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
          "Content-Type": "application/json",
        },
        body: {
          model,
          max_tokens: 4096,
          system: sys
            ? [
                {
                  type: "text",
                  text: sys,
                  cache_control: { type: "ephemeral" },
                },
              ]
            : undefined,
          messages: rest,
        },
      };
    },
    parse(raw) {
      const r = raw as { content?: Array<{ text?: string }> };
      return r.content?.[0]?.text ?? JSON.stringify(raw);
    },
  },

  openai: {
    name: "OpenAI",
    models: [
      { id: "gpt-4o", name: "GPT-4o", default: true },
      { id: "gpt-4o-mini", name: "GPT-4o mini" },
      { id: "gpt-5.4", name: "GPT-5.4 (frontier)" },
      { id: "gpt-5.4-mini", name: "GPT-5.4 mini (cheap)" },
      { id: "gpt-5.4-nano", name: "GPT-5.4 nano (cheapest)" },
    ],
    build(model, key, msgs) {
      return {
        url: "https://api.openai.com/v1/chat/completions",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: { model, messages: msgs, max_tokens: 4096 },
      };
    },
  },

  google: {
    name: "Google Gemini",
    models: [
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        default: true,
      },
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
      { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
      {
        id: "gemini-3.1-pro-preview",
        name: "Gemini 3.1 Pro Preview (frontier)",
      },
      { id: "gemini-3.1-flash", name: "Gemini 3.1 Flash" },
      { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite (cheapest)" },
    ],
    build(model, key, msgs) {
      // Gemini has no system role; merge the system block into the first
      // user turn so the model still sees it.
      const parts = msgs.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      if (msgs[0]?.role === "system") {
        if (parts.length > 1) {
          parts[1].parts[0].text = msgs[0].content + "\n\n" + parts[1].parts[0].text;
          parts.shift();
        } else {
          parts[0].role = "user";
        }
      }
      return {
        url:
          "https://generativelanguage.googleapis.com/v1beta/models/" +
          model +
          ":generateContent?key=" +
          encodeURIComponent(key),
        headers: { "Content-Type": "application/json" },
        body: {
          contents: parts,
          generationConfig: { maxOutputTokens: 4096 },
        },
      };
    },
    parse(raw) {
      const r = raw as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };
      return r.candidates?.[0]?.content?.parts?.[0]?.text ?? JSON.stringify(raw);
    },
  },
};

export const defaultModel = (prov: AiProviderId): string => {
  const p = AI_PROVIDERS[prov];
  return p.models.find((m) => m.default)?.id ?? p.models[0].id;
};

export const modelLabel = (conf: AiConf): string => {
  const p = AI_PROVIDERS[conf.prov];
  if (!p) return `${conf.prov}/${conf.model}`;
  return p.models.find((m) => m.id === conf.model)?.name ?? conf.model;
};

// ──────────────────────────────────────────────────────────────
// localStorage persistence
// ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "navigate.aiConf";

export const loadAiConf = (): AiConf | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AiConf>;
    if (
      parsed.prov &&
      parsed.model &&
      parsed.key &&
      AI_PROVIDERS[parsed.prov as AiProviderId]
    ) {
      return parsed as AiConf;
    }
  } catch {
    /* fall through */
  }
  return null;
};

export const saveAiConf = (conf: AiConf): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conf));
  } catch {
    /* storage may be disabled — silent */
  }
};

export const clearAiConf = (): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* silent */
  }
};

// ──────────────────────────────────────────────────────────────
// callLLM — one POST, provider-shaped request, normalized error
// ──────────────────────────────────────────────────────────────

export class AiCallError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export const callLLM = async (
  conf: AiConf,
  messages: ChatMsg[],
): Promise<string> => {
  const p = AI_PROVIDERS[conf.prov];
  if (!p) throw new AiCallError("Unknown provider");
  const req = p.build(conf.model, conf.key, messages);

  let resp: Response;
  try {
    resp = await fetch(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify(req.body),
    });
  } catch (e) {
    throw new AiCallError(
      e instanceof Error
        ? `Network error: ${e.message}`
        : "Network error while contacting the provider.",
    );
  }

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    let msg = "";
    try {
      const j = JSON.parse(txt);
      msg = j?.error?.message || j?.message || "";
    } catch {
      /* ignore */
    }
    if (resp.status === 401 || resp.status === 403) {
      msg =
        "Invalid or expired API key. Check the key in the AI settings below.";
    } else if (resp.status === 429) {
      msg = "Rate limit exceeded. Wait a moment and try again.";
    } else if (
      resp.status === 402 ||
      (resp.status === 400 && /insufficient|credit|balance/i.test(msg))
    ) {
      msg = "Insufficient credits or quota on your API account.";
    } else if (!msg) {
      msg = txt.slice(0, 200) || `HTTP ${resp.status}`;
    }
    throw new AiCallError(msg, resp.status);
  }

  let data: unknown;
  try {
    data = await resp.json();
  } catch {
    throw new AiCallError("Malformed response from the provider.");
  }
  const err = (data as { error?: { message?: string; code?: number } }).error;
  if (err) {
    let msg = err.message || String(err.code ?? "") || "Provider error";
    if (err.code === 429 || /rate.?limit/i.test(msg)) {
      msg = "Rate limit exceeded. Wait a moment and try again.";
    } else if (err.code === 401 || err.code === 403) {
      msg = "Invalid or expired API key.";
    }
    throw new AiCallError(msg);
  }

  if (p.parse) return p.parse(data);
  const oai = data as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return oai.choices?.[0]?.message?.content ?? JSON.stringify(data);
};

// ──────────────────────────────────────────────────────────────
// verifyAiConf — lightweight "does this key actually work?" probe.
// Sends a tiny one-token ping through the same adapter pipeline so the
// provider does real auth + routing, and error mapping stays consistent
// with callLLM (401/403/429/402 etc). Throws AiCallError on failure.
// ──────────────────────────────────────────────────────────────

export const verifyAiConf = async (conf: AiConf): Promise<void> => {
  await callLLM(conf, [{ role: "user", content: "ping" }]);
};

export default function AiProvidersPage() {
  return null;
}
