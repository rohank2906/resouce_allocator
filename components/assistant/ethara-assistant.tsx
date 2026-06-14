"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sparkles,
  X,
  Send,
  Minimize2,
  Maximize2,
  Trash2,
  Loader2,
  AlertCircle,
  Bot
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface StatusResponse {
  reachable: boolean;
  host: string;
  model: string;
  modelInstalled: boolean;
  installedModels: string[];
}

const STORAGE_KEY = "ethara-assistant-history-v1";
const MAX_STORED = 24;

const SUGGESTED_PROMPTS = [
  "Show attendance today",
  "Which project has the most employees?",
  "Who is on leave?",
  "How many TPMs do we have?",
  "List staffing distribution by role"
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function EtharaAssistant() {
  const { data: session, status: authStatus } = useSession();
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [serviceStatus, setServiceStatus] = useState<StatusResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ChatMsg[];
        if (Array.isArray(parsed)) setMessages(parsed.slice(-MAX_STORED));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED)));
    } catch {
      // ignore
    }
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/assistant")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((s: StatusResponse) => setServiceStatus(s))
      .catch(() => setServiceStatus(null));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, partial, streaming]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || streaming) return;

      setError(null);
      const userMsg: ChatMsg = { id: uid(), role: "user", content: text };
      const baseHistory = messages.slice(-MAX_STORED);
      setMessages([...baseHistory, userMsg]);
      setDraft("");
      setStreaming(true);
      setPartial("");

      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            history: baseHistory.map((m) => ({ role: m.role, content: m.content })),
            message: text
          }),
          signal: ac.signal
        });
        if (!res.ok || !res.body) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error ?? `Assistant returned ${res.status}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let acc = "";
        let sawError: string | null = null;

        const flushEvent = (event: string, data: string) => {
          if (event === "token") {
            try {
              const parsed = JSON.parse(data) as { text?: string };
              if (parsed.text) {
                acc += parsed.text;
                setPartial(acc);
              }
            } catch {
              // ignore
            }
          } else if (event === "error") {
            try {
              const parsed = JSON.parse(data) as { message?: string };
              sawError = parsed.message ?? "Assistant failed.";
            } catch {
              sawError = "Assistant failed.";
            }
          }
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() ?? "";
          for (const block of blocks) {
            const lines = block.split("\n");
            let eventName = "message";
            let dataStr = "";
            for (const ln of lines) {
              if (ln.startsWith("event:")) eventName = ln.slice(6).trim();
              else if (ln.startsWith("data:")) dataStr += ln.slice(5).trim();
            }
            if (dataStr) flushEvent(eventName, dataStr);
          }
        }

        if (sawError) {
          setError(sawError);
        } else if (acc.trim()) {
          setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: acc }]);
        } else {
          setError("Assistant returned an empty response.");
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // user-cancelled
        } else {
          setError(err instanceof Error ? err.message : "Assistant failed.");
        }
      } finally {
        setStreaming(false);
        setPartial("");
        abortRef.current = null;
      }
    },
    [messages, streaming]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
    setPartial("");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  if (authStatus !== "authenticated" || !session) return null;

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            type="button"
            onClick={() => setOpen(true)}
            initial={{ scale: 0.6, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.6, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            aria-label="Open Ethara Assistant"
            className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-accent/30 bg-gradient-to-br from-accent to-[hsl(262_85%_60%)] text-white shadow-2xl shadow-accent/30 backdrop-blur-xl transition-all duration-200 hover:scale-105 hover:shadow-accent/50 sm:bottom-6 sm:right-6"
          >
            <Sparkles className="h-5 w-5" strokeWidth={2.25} />
            <span className="pointer-events-none absolute -inset-1 rounded-full bg-accent/20 blur-xl" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className={cn(
              "fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-border-strong/50 bg-surface-overlay/90 shadow-2xl backdrop-blur-2xl",
              "dark:bg-[hsl(220_18%_10%/0.92)] dark:border-white/10",
              maximized
                ? "inset-3 sm:inset-6 lg:inset-12"
                : "bottom-3 right-3 left-3 top-16 sm:left-auto sm:bottom-5 sm:right-5 sm:top-auto sm:h-[640px] sm:w-[420px]"
            )}
          >
            <Header
              maximized={maximized}
              onMinimize={() => setOpen(false)}
              onToggleMax={() => setMaximized((m) => !m)}
              onClear={clear}
              status={serviceStatus}
            />

            <div
              ref={scrollRef}
              className="flex-1 space-y-3 overflow-y-auto px-4 py-4 scrollbar-thin"
            >
              {messages.length === 0 && !streaming && (
                <EmptyState
                  onPick={(p) => {
                    setDraft(p);
                    void send(p);
                  }}
                  status={serviceStatus}
                />
              )}
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              {streaming && (
                <MessageBubble
                  message={{ id: "live", role: "assistant", content: partial }}
                  live
                />
              )}
              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
                  <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <Composer
              value={draft}
              onChange={setDraft}
              onSend={() => void send(draft)}
              onStop={stop}
              streaming={streaming}
              inputRef={inputRef}
              disabled={!serviceStatus?.reachable}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Header({
  maximized,
  onMinimize,
  onToggleMax,
  onClear,
  status
}: {
  maximized: boolean;
  onMinimize: () => void;
  onToggleMax: () => void;
  onClear: () => void;
  status: StatusResponse | null;
}) {
  const tone = !status
    ? "bg-muted text-muted-foreground"
    : status.reachable && status.modelInstalled
      ? "bg-[hsl(152_65%_45%)] text-white"
      : "bg-[hsl(35_95%_55%)] text-white";

  const label = !status
    ? "Checking…"
    : !status.reachable
      ? "Offline"
      : !status.modelInstalled
        ? `Pull ${status.model}`
        : "Online";

  return (
    <div className="flex items-center justify-between gap-2 border-b border-border-subtle/60 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-[hsl(262_85%_60%)] text-white shadow-md">
          <Sparkles className="h-4 w-4" strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight text-foreground">Ethara Assistant</p>
          <p className="flex items-center gap-1.5 text-2xs text-muted-foreground">
            <span className={cn("inline-block h-1.5 w-1.5 rounded-full", tone)} />
            <span className="tabular">{label}</span>
            {status?.reachable && status.modelInstalled && (
              <>
                <span className="opacity-40">·</span>
                <span className="font-numeric truncate">{status.model}</span>
              </>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear conversation"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onToggleMax}
          aria-label={maximized ? "Restore size" : "Expand"}
          className="hidden h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
        >
          {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={onMinimize}
          aria-label="Minimize"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function EmptyState({
  onPick,
  status
}: {
  onPick: (prompt: string) => void;
  status: StatusResponse | null;
}) {
  return (
    <div className="space-y-4 pt-2">
      <div className="rounded-xl border border-border-subtle bg-gradient-to-br from-accent/5 to-transparent px-4 py-4 text-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent to-[hsl(262_85%_60%)] text-white">
          <Bot className="h-5 w-5" strokeWidth={2.25} />
        </div>
        <p className="text-sm font-medium text-foreground">Hi, I&apos;m Ethara Assistant.</p>
        <p className="mt-1 text-xs text-muted-foreground text-pretty">
          Ask me about employees, projects, attendance, requests, or staffing. I only have read access — I can&apos;t change anything.
        </p>
      </div>
      {status && !status.reachable && (
        <div className="rounded-lg border border-[hsl(35_95%_50%/0.35)] bg-[hsl(35_95%_50%/0.08)] px-3 py-2.5 text-xs text-[hsl(28_85%_35%)] dark:text-[hsl(38_92%_75%)]">
          Ollama isn&apos;t running. Start it on this machine with <code className="font-numeric">ollama serve</code>, then try again.
        </div>
      )}
      {status?.reachable && !status.modelInstalled && (
        <div className="rounded-lg border border-[hsl(35_95%_50%/0.35)] bg-[hsl(35_95%_50%/0.08)] px-3 py-2.5 text-xs text-[hsl(28_85%_35%)] dark:text-[hsl(38_92%_75%)]">
          Model <code className="font-numeric">{status.model}</code> isn&apos;t pulled yet. Run <code className="font-numeric">ollama pull {status.model}</code>.
        </div>
      )}
      <div>
        <p className="mb-2 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
          Try asking
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPick(p)}
              className="rounded-full border border-border-subtle bg-muted/30 px-3 py-1 text-xs text-foreground/80 transition-all duration-150 hover:border-accent/40 hover:bg-accent/10 hover:text-foreground"
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, live }: { message: ChatMsg; live?: boolean }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-muted text-muted-foreground"
            : "bg-gradient-to-br from-accent to-[hsl(262_85%_60%)] text-white"
        )}
      >
        {isUser ? (
          <span className="text-2xs font-semibold">U</span>
        ) : (
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} />
        )}
      </div>
      <div
        className={cn(
          "min-w-0 max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "rounded-tr-sm bg-accent/15 text-foreground"
            : "rounded-tl-sm bg-muted/50 text-foreground"
        )}
      >
        {message.content ? (
          <FormattedContent content={message.content} />
        ) : live ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Thinking…
          </span>
        ) : null}
        {live && message.content && <BlinkingCursor />}
      </div>
    </div>
  );
}

function BlinkingCursor() {
  return (
    <span className="ml-0.5 inline-block h-3.5 w-1.5 -translate-y-px animate-pulse rounded-sm bg-accent align-middle" />
  );
}

function FormattedContent({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return (
    <div className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const body = part.replace(/^```[a-z]*\n?/, "").replace(/```$/, "");
          return (
            <pre
              key={i}
              className="my-1.5 overflow-x-auto rounded-md bg-background/60 px-2.5 py-2 text-xs font-numeric text-foreground/90 ring-1 ring-border-subtle"
            >
              <code>{body}</code>
            </pre>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}

function Composer({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  inputRef,
  disabled
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  disabled: boolean;
}) {
  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!streaming) onSend();
    }
  };

  return (
    <div className="border-t border-border-subtle/60 bg-surface/60 px-3 py-3 backdrop-blur-xl">
      <div className="flex items-end gap-2 rounded-xl border border-border-subtle bg-background/60 px-3 py-2 transition-colors focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/20">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder={disabled ? "Assistant is offline…" : "Ask about employees, projects, attendance…"}
          rows={1}
          disabled={disabled && !streaming}
          className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none disabled:opacity-50"
        />
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive transition-colors hover:bg-destructive/25"
          >
            <span className="block h-2.5 w-2.5 rounded-sm bg-destructive" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSend}
            disabled={!value.trim() || disabled}
            aria-label="Send"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-[hsl(262_85%_60%)] text-white shadow-sm transition-all duration-150 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <p className="mt-1.5 text-2xs text-muted-foreground/70">
        Read-only · Press Enter to send, Shift+Enter for newline
      </p>
    </div>
  );
}
