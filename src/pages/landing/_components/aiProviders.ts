// Provider adapters for the BYO-key chat loop. Each provider's
// request/response shape is translated in `build` and `parse`.

import type { ToolDef } from "./aiContext";

export type AiProviderId = "openrouter" | "anthropic" | "openai" | "google";

export type ToolCall = {
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type ChatMsg = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  // assistant tool-call turns; content may be empty
  toolCalls?: ToolCall[];
  toolCallId?: string;
  toolName?: string;
};

export type LLMResponse =
  | { kind: "text"; text: string }
  | { kind: "tool_calls"; text: string; calls: ToolCall[] };

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
  build: (
    model: string,
    key: string,
    msgs: ChatMsg[],
    tools?: ToolDef[],
  ) => BuiltRequest;
  parse: (raw: unknown) => LLMResponse;
};

export type AiConf = {
  prov: AiProviderId;
  model: string;
  key: string;
};

// GPT-5 and the o1/o3 reasoning family rejected `max_tokens` and want
// `max_completion_tokens` instead. Detect by model id (handles bare
// names and OpenRouter's `openai/...` prefix).
const openaiTokenField = (model: string): "max_tokens" | "max_completion_tokens" =>
  /(^|\/)(gpt-5|o[13])/i.test(model) ? "max_completion_tokens" : "max_tokens";

const toolsToOpenAI = (tools: ToolDef[]) =>
  tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));

const toolsToAnthropic = (tools: ToolDef[]) =>
  tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));

const toolsToGemini = (tools: ToolDef[]) => [
  {
    functionDeclarations: tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: {
        // Gemini wants UPPERCASE type names
        type: "OBJECT",
        properties: Object.fromEntries(
          Object.entries(t.inputSchema.properties).map(([k, v]) => [
            k,
            v.type === "array"
              ? {
                  type: "ARRAY",
                  description: v.description,
                  items: { type: "STRING" },
                }
              : { type: v.type.toUpperCase(), description: v.description },
          ]),
        ),
        required: t.inputSchema.required,
      },
    })),
  },
];

// OpenAI / OpenRouter share the same wire format.
const msgsToOpenAI = (msgs: ChatMsg[]): unknown[] =>
  msgs.map((m) => {
    if (m.role === "tool") {
      return {
        role: "tool",
        tool_call_id: m.toolCallId,
        content: m.content,
      };
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      return {
        role: "assistant",
        content: m.content || null,
        tool_calls: m.toolCalls.map((c) => ({
          id: c.id,
          type: "function",
          function: {
            name: c.name,
            arguments: JSON.stringify(c.input),
          },
        })),
      };
    }
    return { role: m.role, content: m.content };
  });

const msgsToAnthropic = (msgs: ChatMsg[]) => {
  const out: Array<{ role: "user" | "assistant"; content: unknown }> = [];
  for (const m of msgs) {
    if (m.role === "system") continue; // Anthropic handles system separately.
    if (m.role === "tool") {
      out.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: m.toolCallId,
            content: m.content,
          },
        ],
      });
      continue;
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      const blocks: unknown[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const c of m.toolCalls) {
        blocks.push({
          type: "tool_use",
          id: c.id,
          name: c.name,
          input: c.input,
        });
      }
      out.push({ role: "assistant", content: blocks });
      continue;
    }
    out.push({ role: m.role, content: m.content });
  }
  return out;
};

const msgsToGemini = (msgs: ChatMsg[]) => {
  // Gemini has no system role; merge system into the first user turn.
  const sys = msgs.find((m) => m.role === "system")?.content ?? "";
  const rest = msgs.filter((m) => m.role !== "system");

  const parts = rest.map((m) => {
    if (m.role === "tool") {
      let parsed: unknown = m.content;
      try {
        parsed = JSON.parse(m.content);
      } catch {
        /* keep as string */
      }
      return {
        role: "user",
        parts: [
          {
            functionResponse: {
              name: m.toolName ?? "",
              response:
                typeof parsed === "object" && parsed !== null
                  ? (parsed as Record<string, unknown>)
                  : { content: m.content },
            },
          },
        ],
      };
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      const blocks: unknown[] = [];
      if (m.content) blocks.push({ text: m.content });
      for (const c of m.toolCalls) {
        blocks.push({ functionCall: { name: c.name, args: c.input } });
      }
      return { role: "model", parts: blocks };
    }
    return {
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    };
  });

  if (sys && parts.length > 0 && parts[0].role === "user") {
    const first = parts[0].parts[0] as { text?: string };
    if (typeof first.text === "string") {
      first.text = sys + "\n\n" + first.text;
    }
  }

  return parts;
};

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
    build(model, key, msgs, tools) {
      const body: Record<string, unknown> = {
        model,
        messages: msgsToOpenAI(msgs),
        [openaiTokenField(model)]: 4096,
      };
      if (tools?.length) {
        body.tools = toolsToOpenAI(tools);
        body.tool_choice = "auto";
      }
      return {
        url: "https://openrouter.ai/api/v1/chat/completions",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body,
      };
    },
    parse: parseOpenAIResponse,
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
    build(model, key, msgs, tools) {
      const sys = msgs.find((m) => m.role === "system")?.content ?? "";
      const body: Record<string, unknown> = {
        model,
        max_tokens: 4096,
        // cache the static system prompt across turns
        system: sys
          ? [
              {
                type: "text",
                text: sys,
                cache_control: { type: "ephemeral" },
              },
            ]
          : undefined,
        messages: msgsToAnthropic(msgs),
      };
      if (tools?.length) {
        body.tools = toolsToAnthropic(tools);
      }
      return {
        url: "https://api.anthropic.com/v1/messages",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
          "Content-Type": "application/json",
        },
        body,
      };
    },
    parse: parseAnthropicResponse,
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
    build(model, key, msgs, tools) {
      const body: Record<string, unknown> = {
        model,
        messages: msgsToOpenAI(msgs),
        [openaiTokenField(model)]: 4096,
      };
      if (tools?.length) {
        body.tools = toolsToOpenAI(tools);
        body.tool_choice = "auto";
      }
      return {
        url: "https://api.openai.com/v1/chat/completions",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body,
      };
    },
    parse: parseOpenAIResponse,
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
    build(model, key, msgs, tools) {
      const body: Record<string, unknown> = {
        contents: msgsToGemini(msgs),
        generationConfig: { maxOutputTokens: 4096 },
      };
      if (tools?.length) {
        body.tools = toolsToGemini(tools);
      }
      return {
        url:
          "https://generativelanguage.googleapis.com/v1beta/models/" +
          model +
          ":generateContent?key=" +
          encodeURIComponent(key),
        headers: { "Content-Type": "application/json" },
        body,
      };
    },
    parse: parseGeminiResponse,
  },
};

function parseOpenAIResponse(raw: unknown): LLMResponse {
  const r = raw as {
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: Array<{
          id: string;
          type?: string;
          function?: { name?: string; arguments?: string };
        }>;
      };
      finish_reason?: string;
    }>;
    usage?: { prompt_tokens?: number };
  };
  const choice = r.choices?.[0];
  const msg = choice?.message;
  const toolCalls = msg?.tool_calls;

  if (toolCalls?.length) {
    const calls: ToolCall[] = toolCalls
      .filter((c) => c.function?.name)
      .map((c) => {
        let input: Record<string, unknown> = {};
        try {
          input = c.function?.arguments
            ? (JSON.parse(c.function.arguments) as Record<string, unknown>)
            : {};
        } catch {
          /* leave empty so handler can return a parse error */
        }
        return {
          id: c.id,
          name: c.function?.name ?? "",
          input,
        };
      });
    return { kind: "tool_calls", text: msg?.content ?? "", calls };
  }

  const content = msg?.content;
  if (typeof content === "string" && content) {
    return { kind: "text", text: content };
  }

  const finish = choice?.finish_reason;
  const promptTokens = r.usage?.prompt_tokens;
  if (finish === "length") {
    throw new AiCallError(
      promptTokens
        ? `Prompt too large (${promptTokens.toLocaleString()} tokens) — the model ran out of token budget before producing any output.`
        : "The model ran out of token budget before producing any output.",
      undefined,
      { reason: "empty-completion", finish_reason: finish, body: raw },
    );
  }
  if (finish === "content_filter") {
    throw new AiCallError(
      "Response was blocked by the provider's content filter.",
      undefined,
      { reason: "content-filter", finish_reason: finish, body: raw },
    );
  }
  throw new AiCallError("Provider returned an empty response.", undefined, {
    reason: "empty-completion",
    finish_reason: finish,
    body: raw,
  });
}

function parseAnthropicResponse(raw: unknown): LLMResponse {
  const r = raw as {
    content?: Array<{
      type?: string;
      text?: string;
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
    }>;
    stop_reason?: string;
    usage?: { input_tokens?: number };
  };
  const blocks = r.content ?? [];
  let text = "";
  const calls: ToolCall[] = [];
  for (const b of blocks) {
    if (b.type === "text" && b.text) {
      text += (text ? "\n" : "") + b.text;
    } else if (b.type === "tool_use" && b.id && b.name) {
      calls.push({ id: b.id, name: b.name, input: b.input ?? {} });
    }
  }

  if (calls.length > 0) {
    return { kind: "tool_calls", text, calls };
  }
  if (text) {
    return { kind: "text", text };
  }

  const stop = r.stop_reason;
  const promptTokens = r.usage?.input_tokens;
  if (stop === "max_tokens") {
    throw new AiCallError(
      promptTokens
        ? `Prompt too large (${promptTokens.toLocaleString()} tokens) — the model ran out of token budget before producing any output.`
        : "The model ran out of token budget before producing any output.",
      undefined,
      { reason: "empty-completion", stop_reason: stop, body: raw },
    );
  }
  throw new AiCallError("Provider returned an empty response.", undefined, {
    reason: "empty-completion",
    stop_reason: stop,
    body: raw,
  });
}

function parseGeminiResponse(raw: unknown): LLMResponse {
  const r = raw as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          functionCall?: {
            name?: string;
            args?: Record<string, unknown>;
          };
        }>;
      };
      finishReason?: string;
    }>;
    usageMetadata?: { promptTokenCount?: number };
  };
  const parts = r.candidates?.[0]?.content?.parts ?? [];
  let text = "";
  const calls: ToolCall[] = [];
  let fcCounter = 0;
  for (const p of parts) {
    if (p.text) {
      text += (text ? "\n" : "") + p.text;
    } else if (p.functionCall?.name) {
      // Gemini doesn't return tool-call ids; synthesize one
      calls.push({
        id: `gemini-fc-${fcCounter++}`,
        name: p.functionCall.name,
        input: p.functionCall.args ?? {},
      });
    }
  }

  if (calls.length > 0) {
    return { kind: "tool_calls", text, calls };
  }
  if (text) return { kind: "text", text };

  const finish = r.candidates?.[0]?.finishReason;
  const promptTokens = r.usageMetadata?.promptTokenCount;
  if (finish === "MAX_TOKENS") {
    throw new AiCallError(
      promptTokens
        ? `Prompt too large (${promptTokens.toLocaleString()} tokens) — the model ran out of token budget before producing any output.`
        : "The model ran out of token budget before producing any output.",
      undefined,
      { reason: "empty-completion", finishReason: finish, body: raw },
    );
  }
  if (finish === "SAFETY" || finish === "RECITATION") {
    throw new AiCallError(
      finish === "SAFETY"
        ? "Response was blocked by the provider's safety filter."
        : "Response was blocked because it would have recited copyrighted material.",
      undefined,
      { reason: "content-filter", finishReason: finish, body: raw },
    );
  }
  throw new AiCallError("Provider returned an empty response.", undefined, {
    reason: "empty-completion",
    finishReason: finish,
    body: raw,
  });
}

export const defaultModel = (prov: AiProviderId): string => {
  const p = AI_PROVIDERS[prov];
  return p.models.find((m) => m.default)?.id ?? p.models[0].id;
};

export const modelLabel = (conf: AiConf): string => {
  const p = AI_PROVIDERS[conf.prov];
  if (!p) return `${conf.prov}/${conf.model}`;
  return p.models.find((m) => m.id === conf.model)?.name ?? conf.model;
};

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

export class AiCallError extends Error {
  status?: number;
  details?: unknown;
  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const callLLM = async (
  conf: AiConf,
  messages: ChatMsg[],
  tools?: ToolDef[],
): Promise<LLMResponse> => {
  const p = AI_PROVIDERS[conf.prov];
  if (!p) throw new AiCallError("Unknown provider");
  const req = p.build(conf.model, conf.key, messages, tools);

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
      undefined,
      {
        reason: "network",
        url: req.url,
        provider: conf.prov,
        model: conf.model,
        cause:
          e instanceof Error
            ? { name: e.name, message: e.message }
            : String(e),
      },
    );
  }

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    let parsed: unknown = null;
    let msg = "";
    try {
      parsed = JSON.parse(txt);
      const j = parsed as { error?: { message?: string }; message?: string };
      msg = j?.error?.message || j?.message || "";
    } catch {
      /* ignore */
    }
    if (resp.status === 401 || resp.status === 403) {
      msg = "Invalid or expired API key.";
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
    throw new AiCallError(msg, resp.status, {
      reason: "http",
      url: req.url,
      provider: conf.prov,
      model: conf.model,
      status: resp.status,
      statusText: resp.statusText,
      body: parsed ?? txt,
    });
  }

  let data: unknown;
  try {
    data = await resp.json();
  } catch {
    throw new AiCallError("Malformed response from the provider.", undefined, {
      reason: "parse",
      url: req.url,
      provider: conf.prov,
      model: conf.model,
      status: resp.status,
    });
  }
  const err = (data as { error?: { message?: string; code?: number } }).error;
  if (err) {
    let msg = err.message || String(err.code ?? "") || "Provider error";
    if (err.code === 429 || /rate.?limit/i.test(msg)) {
      msg = "Rate limit exceeded. Wait a moment and try again.";
    } else if (err.code === 401 || err.code === 403) {
      msg = "Invalid or expired API key.";
    }
    throw new AiCallError(msg, undefined, {
      reason: "provider-error",
      url: req.url,
      provider: conf.prov,
      model: conf.model,
      status: resp.status,
      body: data,
    });
  }

  return p.parse(data);
};

// One-token ping; confirms auth + routing without running tools.
export const verifyAiConf = async (conf: AiConf): Promise<void> => {
  const r = await callLLM(conf, [{ role: "user", content: "ping" }]);
  if (r.kind !== "text" && r.kind !== "tool_calls") {
    throw new AiCallError("Verification call returned an unexpected shape.");
  }
};

export default function AiProvidersPage() {
  return null;
}
