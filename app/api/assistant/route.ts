import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth/nextauth";
import type { Role } from "@prisma/client";
import { buildAssistantContext, buildCallerContext } from "@/lib/ai/context";
import {
  getOllamaConfig,
  isOllamaReachable,
  listInstalledModels,
  streamChat,
  OllamaModelMissingError,
  OllamaOfflineError,
  type ChatMessage
} from "@/lib/ai/ollama";

const MAX_HISTORY = 12;

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000)
});

const requestSchema = z.object({
  history: z.array(messageSchema).max(MAX_HISTORY).default([]),
  message: z.string().trim().min(1).max(4000)
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = getOllamaConfig();
  const reachable = await isOllamaReachable();
  const installed = reachable ? await listInstalledModels() : [];
  return NextResponse.json({
    reachable,
    host: config.host,
    model: config.model,
    modelInstalled: installed.includes(config.model),
    installedModels: installed
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id as string;
  const email = session.user.email as string;
  const name = (session.user.name as string | undefined) ?? null;
  const role = session.user.role as Role;

  const json = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { history, message } = parsed.data;

  const caller = await buildCallerContext(userId, email, name, role);
  const { system, data } = await buildAssistantContext(caller, message);

  const messages: ChatMessage[] = [
    { role: "system", content: system },
    {
      role: "system",
      content: `LIVE DATA CONTEXT (snapshot at ${new Date().toISOString()}):\n${data}`
    },
    ...history.map((h) => ({ role: h.role, content: h.content } as ChatMessage)),
    { role: "user", content: message }
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, payload: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
        );
      };
      try {
        send("meta", {
          model: getOllamaConfig().model,
          contextChars: data.length,
          scope: caller.projectId ?? "global"
        });
        for await (const chunk of streamChat(messages, request.signal)) {
          send("token", { text: chunk });
        }
        send("done", { ok: true });
        controller.close();
      } catch (err) {
        if (err instanceof OllamaOfflineError) {
          send("error", {
            code: "OFFLINE",
            message:
              err.message ||
              "Ethara Assistant is offline. Verify the LLM provider is reachable and the API key is valid."
          });
        } else if (err instanceof OllamaModelMissingError) {
          send("error", {
            code: "MODEL_MISSING",
            message: err.message
          });
        } else {
          send("error", {
            code: "FAILED",
            message: err instanceof Error ? err.message : "Assistant failed."
          });
        }
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
