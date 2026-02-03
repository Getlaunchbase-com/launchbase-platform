import { useState } from "react";

const STATUSES = ["new", "triaged", "queued", "running", "done", "archived"] as const;

export function AdminMarketingInbox() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("new");
  const [q, setQ] = useState("");

  return (
    <div style={{ padding: 16, maxWidth: 1100 }}>
      <h2>Marketing Inbox</h2>

      <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "12px 0" }}>
        <label>
          Status{" "}
          <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label>
          Search{" "}
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="title, source, url..."
            style={{ width: 300 }}
          />
        </label>

        <button onClick={() => {}}>Refresh</button>
      </div>

      <div>Loading...</div>
    </div>
  );
}
