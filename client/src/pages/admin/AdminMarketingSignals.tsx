/**
 * Marketing Signals Admin Page
 * New signals inbox using marketingSignals table
 */

import { useState } from "react";
import { trpc } from "../../lib/trpc";

const STATUSES = ["new", "triaged", "qualified", "rejected", "converted"] as const;

export function AdminMarketingSignals() {
  const [status, setStatus] = useState<(typeof STATUSES)[number] | undefined>("new");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const listQuery = trpc.marketingSignals.list.useQuery({
    status,
    search: search.trim() || undefined,
    limit: 100,
  });

  const setStatusMut = trpc.marketingSignals.setStatus.useMutation({
    onSuccess: () => {
      listQuery.refetch();
      setSelectedId(null);
    },
  });

  const addNoteMut = trpc.marketingSignals.addNote.useMutation({
    onSuccess: () => {
      listQuery.refetch();
      setNoteText("");
      setSelectedId(null);
    },
  });

  const seedMut = trpc.marketingSignals.seed.useMutation({
    onSuccess: () => listQuery.refetch(),
  });

  const rows = listQuery.data?.rows ?? [];
  const selectedRow = rows.find((r) => r.id === selectedId);

  return (
    <div style={{ padding: 16, maxWidth: 1400 }}>
      <h2>Marketing Signals</h2>

      <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "12px 0" }}>
        <label>
          Status{" "}
          <select value={status ?? ""} onChange={(e) => setStatus(e.target.value as any || undefined)}>
            <option value="">All</option>
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="entity name, jurisdiction, source..."
            style={{ width: 300 }}
          />
        </label>

        <button onClick={() => listQuery.refetch()}>Refresh</button>

        <button
          onClick={() => seedMut.mutate({ count: 10 })}
          disabled={seedMut.isPending}
          style={{ marginLeft: "auto" }}
        >
          {seedMut.isPending ? "Seeding..." : "Seed Test Signals"}
        </button>
      </div>

      {listQuery.isLoading && <div>Loading...</div>}

      {listQuery.isError && <div style={{ color: "red" }}>Error: {listQuery.error.message}</div>}

      {!listQuery.isLoading && rows.length === 0 && (
        <div style={{ padding: 20, textAlign: "center", color: "#666" }}>
          No signals found. Try clicking "Seed Test Signals" to generate sample data.
        </div>
      )}

      {rows.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #ddd" }}>
              <th style={{ textAlign: "left", padding: 8 }}>Created</th>
              <th style={{ textAlign: "left", padding: 8 }}>Entity Name</th>
              <th style={{ textAlign: "left", padding: 8 }}>Jurisdiction</th>
              <th style={{ textAlign: "left", padding: 8 }}>Source</th>
              <th style={{ textAlign: "center", padding: 8 }}>Score</th>
              <th style={{ textAlign: "left", padding: 8 }}>Status</th>
              <th style={{ textAlign: "left", padding: 8 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                style={{
                  borderBottom: "1px solid #eee",
                  backgroundColor: selectedId === row.id ? "#f0f8ff" : "transparent",
                }}
              >
                <td style={{ padding: 8, fontSize: 12 }}>
                  {new Date(row.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: 8 }}>
                  <strong>{row.entityName}</strong>
                  {row.notes && (
                    <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                      📝 {row.notes.substring(0, 60)}
                      {row.notes.length > 60 && "..."}
                    </div>
                  )}
                </td>
                <td style={{ padding: 8 }}>{row.jurisdiction}</td>
                <td style={{ padding: 8, fontSize: 12 }}>{row.sourceType}</td>
                <td style={{ padding: 8, textAlign: "center" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 4,
                      backgroundColor:
                        row.score >= 70 ? "#d4edda" : row.score >= 50 ? "#fff3cd" : "#f8d7da",
                      color: row.score >= 70 ? "#155724" : row.score >= 50 ? "#856404" : "#721c24",
                      fontSize: 12,
                      fontWeight: "bold",
                    }}
                  >
                    {row.score}
                  </span>
                </td>
                <td style={{ padding: 8 }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 4,
                      backgroundColor: "#e9ecef",
                      fontSize: 12,
                    }}
                  >
                    {row.status}
                  </span>
                </td>
                <td style={{ padding: 8 }}>
                  <button
                    onClick={() => setSelectedId(row.id)}
                    style={{ fontSize: 12, marginRight: 4 }}
                  >
                    {selectedId === row.id ? "Close" : "Manage"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedRow && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            border: "1px solid #ddd",
            borderRadius: 4,
            backgroundColor: "#f9f9f9",
          }}
        >
          <h3>Manage Signal: {selectedRow.entityName}</h3>

          <div style={{ marginBottom: 12 }}>
            <strong>Change Status:</strong>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusMut.mutate({ id: selectedRow.id, status: s })}
                  disabled={setStatusMut.isPending || selectedRow.status === s}
                  style={{
                    padding: "4px 12px",
                    backgroundColor: selectedRow.status === s ? "#007bff" : "#e9ecef",
                    color: selectedRow.status === s ? "white" : "black",
                    border: "none",
                    borderRadius: 4,
                    cursor: selectedRow.status === s ? "default" : "pointer",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <strong>Add Note:</strong>
            <div style={{ marginTop: 8 }}>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note about this signal..."
                style={{ width: "100%", minHeight: 80, padding: 8 }}
              />
              <button
                onClick={() => {
                  if (noteText.trim()) {
                    addNoteMut.mutate({ id: selectedRow.id, note: noteText.trim() });
                  }
                }}
                disabled={addNoteMut.isPending || !noteText.trim()}
                style={{ marginTop: 8 }}
              >
                {addNoteMut.isPending ? "Adding..." : "Add Note"}
              </button>
            </div>
          </div>

          {selectedRow.notes && (
            <div style={{ marginTop: 12 }}>
              <strong>Existing Notes:</strong>
              <div
                style={{
                  marginTop: 8,
                  padding: 8,
                  backgroundColor: "white",
                  border: "1px solid #ddd",
                  borderRadius: 4,
                  whiteSpace: "pre-wrap",
                  fontSize: 14,
                }}
              >
                {selectedRow.notes}
              </div>
            </div>
          )}

          {selectedRow.reasons && selectedRow.reasons.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <strong>Score Reasons:</strong>
              <ul style={{ marginTop: 8 }}>
                {selectedRow.reasons.map((reason, i) => (
                  <li key={i} style={{ fontSize: 14 }}>
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
