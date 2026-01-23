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
  const MAX_RETRIES_404 = 3;
  const RETRY_DELAY_MS = 200;

  for (let attempt = 0; attempt <= MAX_RETRIES_404; attempt++) {
    try {
      console.log('[chatStore] readTextFromStorage: getting URL for', key, `(attempt ${attempt + 1})`);
      const { url } = await storageGet(key);

      const res = await fetch(url);
      if (!res.ok) {
        const bodyPreview = await res.text().then(t => t.slice(0, 200)).catch(() => "");
        console.warn('[chatStore] fetch not ok', {
          key,
          status: res.status,
          statusText: res.statusText,
          bodyPreview,
          attempt: attempt + 1,
        });

        // Permissions/config: do NOT retry
        if (res.status === 401 || res.status === 403) {
          throw new Error(`storage fetch unauthorized for key=${key} status=${res.status}`);
        }

        // Not found: small retry (write->read race)
        if (res.status === 404 && attempt < MAX_RETRIES_404) {
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
          continue;
        }

        // Other errors: don't hide them
        throw new Error(`storage fetch failed key=${key} status=${res.status}`);
      }

      const text = await res.text();
      console.log('[chatStore] fetch success:', text.length, 'chars');
      return text;
    } catch (err) {
      console.error('[chatStore] readTextFromStorage error', { key, err });
      // Important: do NOT silently convert real problems into "no messages"
      throw err;
    }
  }

  return null;
}

async function readJsonFromStorage<T>(key: string): Promise<T | null> {
  console.log('[chatStore] readJsonFromStorage:', key);
  const text = await readTextFromStorage(key);
  if (!text) return null;
  return JSON.parse(text) as T;
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
  const key = messagesKey(threadId);
  console.log('[chatStore] listOpsChatMessages called:', { threadId, key });
  const doc = await readJsonFromStorage<{ messages: OpsChatMessage[] }>(key);
  const messages = (doc?.messages ?? []).sort((a, b) => (a.createdAtIso > b.createdAtIso ? 1 : -1));
  console.log('[chatStore] Returning messages:', messages.length);
  return messages;
}

export async function appendOpsChatMessage(
  threadId: string,
  msg: Omit<OpsChatMessage, "id" | "threadId" | "createdAtIso">,
): Promise<OpsChatMessage> {
  console.log('[chatStore] appendOpsChatMessage called:', { threadId, role: msg.role, text: msg.text.substring(0, 50) });
  const createdAtIso = nowIso();
  const full: OpsChatMessage = {
    id: makeId("msg"),
    threadId,
    role: msg.role,
    text: msg.text,
    createdAtIso,
    meta: msg.meta,
  };

  const key = messagesKey(threadId);
  console.log('[chatStore] Reading existing messages from:', key);
  const doc = (await readJsonFromStorage<{ messages: OpsChatMessage[] }>(key)) ?? { messages: [] };
  console.log('[chatStore] Existing messages count:', doc.messages?.length ?? 0);
  doc.messages = [...(doc.messages ?? []), full].slice(-500); // cap for MVP
  console.log('[chatStore] New messages count:', doc.messages.length);
  console.log('[chatStore] Writing messages to storage:', key);
  await writeJsonToStorage(key, doc);
  console.log('[chatStore] ✅ Message saved successfully');
  
  // Echo read-back to verify storage
  const echo = await readJsonFromStorage<{ messages: OpsChatMessage[] }>(key);
  console.log('[chatStore] Echo read-back count:', echo?.messages?.length ?? 0);

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
