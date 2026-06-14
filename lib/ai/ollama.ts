export class OllamaOfflineError extends Error {
  constructor(message = "Assistant backend is not reachable") {
    super(message);
    this.name = "OllamaOfflineError";
  }
}

export class OllamaModelMissingError extends Error {
  constructor(model: string) {
    super(`Model "${model}" is not available on the configured LLM provider.`);
    this.name = "OllamaModelMissingError";
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function getBaseUrl(): string {
  const explicit = process.env.LLM_API_BASE_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  const ollamaHost = process.env.OLLAMA_HOST?.replace(/\/$/, "");
  if (ollamaHost) return `${ollamaHost}/v1`;
  return "http://127.0.0.1:11434/v1";
}

function getApiKey(): string {
  return process.env.LLM_API_KEY || "ollama";
}

function getModel(): string {
  return process.env.LLM_MODEL || process.env.OLLAMA_MODEL || "qwen2.5:7b";
}

function getTimeoutMs(): number {
  return Number(process.env.LLM_TIMEOUT_MS || process.env.OLLAMA_TIMEOUT_MS) || 120000;
}

export function getOllamaConfig() {
  return {
    host: getBaseUrl(),
    model: getModel(),
    timeoutMs: getTimeoutMs()
  };
}

export async function isOllamaReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${getBaseUrl()}/models`, {
      headers: { Authorization: `Bearer ${getApiKey()}` },
      signal: AbortSignal.timeout(3500)
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function listInstalledModels(): Promise<string[]> {
  try {
    const res = await fetch(`${getBaseUrl()}/models`, {
      headers: { Authorization: `Bearer ${getApiKey()}` },
      signal: AbortSignal.timeout(4500)
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: Array<{ id: string }> };
    return (json.data ?? []).map((m) => m.id);
  } catch {
    return [];
  }
}

export async function* streamChat(
  messages: ChatMessage[],
  abortSignal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  const baseUrl = getBaseUrl();
  const model = getModel();
  const timeoutMs = getTimeoutMs();
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
  const combined = abortSignal
    ? mergeSignals(abortSignal, timeoutController.signal)
    : timeoutController.signal;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey()}`
      },
      body: JSON.stringify({ model, messages, stream: true }),
      signal: combined
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new OllamaOfflineError("Assistant request timed out or was aborted.");
    }
    throw new OllamaOfflineError(
      "Could not reach the LLM provider. Verify LLM_API_BASE_URL / OLLAMA_HOST is correct and reachable."
    );
  }

  if (!response.ok) {
    clearTimeout(timeoutId);
    const errText = await response.text().catch(() => "");
    if (response.status === 404 || /not found|does not exist|model/i.test(errText)) {
      throw new OllamaModelMissingError(model);
    }
    if (response.status === 401 || response.status === 403) {
      throw new OllamaOfflineError(
        "LLM provider rejected the API key. Check LLM_API_KEY in your environment."
      );
    }
    throw new Error(`LLM provider returned ${response.status}: ${errText.slice(0, 300)}`);
  }
  if (!response.body) {
    clearTimeout(timeoutId);
    throw new Error("LLM provider returned empty body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl = buffer.indexOf("\n");
      while (nl >= 0) {
        const rawLine = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        nl = buffer.indexOf("\n");
        const line = rawLine.trim();
        if (!line || !line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") return;
        let chunk: {
          choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>;
          error?: unknown;
        };
        try {
          chunk = JSON.parse(payload);
        } catch {
          continue;
        }
        if (chunk.error) {
          throw new Error(
            typeof chunk.error === "string" ? chunk.error : JSON.stringify(chunk.error)
          );
        }
        const piece = chunk.choices?.[0]?.delta?.content;
        if (piece) yield piece;
      }
    }
  } finally {
    clearTimeout(timeoutId);
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

function mergeSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const forward = (signal: AbortSignal) => {
    if (signal.aborted) controller.abort(signal.reason);
    else
      signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  };
  forward(a);
  forward(b);
  return controller.signal;
}
