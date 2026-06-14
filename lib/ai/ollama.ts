export class OllamaOfflineError extends Error {
  constructor(message = "Ollama is not reachable") {
    super(message);
    this.name = "OllamaOfflineError";
  }
}

export class OllamaModelMissingError extends Error {
  constructor(model: string) {
    super(`Ollama model "${model}" is not installed. Run: ollama pull ${model}`);
    this.name = "OllamaModelMissingError";
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OllamaChunk {
  model?: string;
  message?: { role: string; content: string };
  done?: boolean;
  error?: string;
}

function getHost(): string {
  return process.env.OLLAMA_HOST?.replace(/\/$/, "") || "http://127.0.0.1:11434";
}

export function getOllamaConfig() {
  return {
    host: getHost(),
    model: process.env.OLLAMA_MODEL || "qwen2.5:7b",
    timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS) || 120000
  };
}

export async function isOllamaReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${getHost()}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function listInstalledModels(): Promise<string[]> {
  try {
    const res = await fetch(`${getHost()}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const json = (await res.json()) as { models?: Array<{ name: string }> };
    return (json.models ?? []).map((m) => m.name);
  } catch {
    return [];
  }
}

export async function* streamChat(
  messages: ChatMessage[],
  abortSignal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  const { host, model, timeoutMs } = getOllamaConfig();
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
  const combined = abortSignal
    ? mergeSignals(abortSignal, timeoutController.signal)
    : timeoutController.signal;

  let response: Response;
  try {
    response = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, stream: true }),
      signal: combined
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new OllamaOfflineError("Ollama request timed out or was aborted.");
    }
    throw new OllamaOfflineError(
      "Could not reach Ollama. Start it with: ollama serve"
    );
  }

  if (!response.ok) {
    clearTimeout(timeoutId);
    const errText = await response.text().catch(() => "");
    if (response.status === 404 || /not found|pull/i.test(errText)) {
      throw new OllamaModelMissingError(model);
    }
    throw new Error(`Ollama returned ${response.status}: ${errText.slice(0, 200)}`);
  }
  if (!response.body) {
    clearTimeout(timeoutId);
    throw new Error("Ollama returned empty body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let chunk: OllamaChunk;
        try {
          chunk = JSON.parse(trimmed);
        } catch {
          continue;
        }
        if (chunk.error) throw new Error(chunk.error);
        const piece = chunk.message?.content;
        if (piece) yield piece;
        if (chunk.done) return;
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
    else signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  };
  forward(a);
  forward(b);
  return controller.signal;
}
