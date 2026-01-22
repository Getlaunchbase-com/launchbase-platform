import { storageGet, storagePut } from "../storage";

export type OpsChatThread = {
  id: string;
  title: string;
  createdAtIso: string;
  updatedAtIso: string;
  lastMessagePreview?: string;
};

export type OpsChatMessage = {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "system";
  text: string;
  createdAtIso: string;
  meta?: Record<string, unknown>;
};

const INDEX_KEY = "swarm/ops-chat/index.json";

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

async function readTextFromStorage(key: string): Promise<string | null> {
  try {
    const { url } = await storageGet(key);
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function readJsonFromStorage<T>(key: string): Promise<T | null> {
  const text = await readTextFromStorage(key);
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function writeJsonToStorage(key: string, value: unknown): Promise<void> {
  await storagePut(key, JSON.stringify(value, null, 2), "application/json");
}

function messagesKey(threadId: string): string {
  return `swarm/ops-chat/threads/${threadId}.messages.json`;
}

export async function listOpsChatThreads(): Promise<OpsChatThread[]> {
  const idx = (await readJsonFromStorage<{ threads: OpsChatThread[] }>(INDEX_KEY)) ?? { threads: [] };
  return (idx.threads ?? []).sort((a, b) => (a.updatedAtIso < b.updatedAtIso ? 1 : -1));
}

export async function createOpsChatThread(input?: { title?: string }): Promise<OpsChatThread> {
  const createdAtIso = nowIso();
  const thread: OpsChatThread = {
    id: makeId("thread"),
    title: (input?.title || "Ops Chat").trim() || "Ops Chat",
    createdAtIso,
    updatedAtIso: createdAtIso,
    lastMessagePreview: "",
  };

  const idx = (await readJsonFromStorage<{ threads: OpsChatThread[] }>(INDEX_KEY)) ?? { threads: [] };
  idx.threads = [thread, ...(idx.threads ?? [])];
  await writeJsonToStorage(INDEX_KEY, idx);
  await writeJsonToStorage(messagesKey(thread.id), { messages: [] as OpsChatMessage[] });
  return thread;
}

export async function listOpsChatMessages(threadId: string): Promise<OpsChatMessage[]> {
  const doc = await readJsonFromStorage<{ messages: OpsChatMessage[] }>(messagesKey(threadId));
  return (doc?.messages ?? []).sort((a, b) => (a.createdAtIso > b.createdAtIso ? 1 : -1));
}

export async function appendOpsChatMessage(
  threadId: string,
  msg: Omit<OpsChatMessage, "id" | "threadId" | "createdAtIso">,
): Promise<OpsChatMessage> {
  const createdAtIso = nowIso();
  const full: OpsChatMessage = {
    id: makeId("msg"),
    threadId,
    role: msg.role,
    text: msg.text,
    createdAtIso,
    meta: msg.meta,
  };

  const doc = (await readJsonFromStorage<{ messages: OpsChatMessage[] }>(messagesKey(threadId))) ?? { messages: [] };
  doc.messages = [...(doc.messages ?? []), full].slice(-500); // cap for MVP
  await writeJsonToStorage(messagesKey(threadId), doc);

  // update index
  const idx = (await readJsonFromStorage<{ threads: OpsChatThread[] }>(INDEX_KEY)) ?? { threads: [] };
  idx.threads = (idx.threads ?? []).map((t) =>
    t.id === threadId
      ? {
          ...t,
          updatedAtIso: createdAtIso,
          lastMessagePreview: (full.text || "").slice(0, 140),
        }
      : t,
  );
  await writeJsonToStorage(INDEX_KEY, idx);

  return full;
}
