import { useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { Moon, Sun } from "../../components/Icons";

export default function AdminConsoleSettings() {
  const [darkMode, setDarkMode] = useState(true);
  const [showBudget, setShowBudget] = useState(true);
  const [notificationLevel, setNotificationLevel] = useState("important");

  return (
    <AdminLayout>
      <div style={{ maxWidth: "600px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "600", margin: "0 0 8px 0" }}>Settings</h1>
        <p style={{ fontSize: "14px", color: "#888", margin: "0 0 32px 0" }}>
          UI preferences and workspace configuration
        </p>

        {/* Theme */}
        <div
          style={{
            padding: "20px",
            backgroundColor: "#1a1a1a",
            borderRadius: "8px",
            border: "1px solid #333",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "14px", fontWeight: "600", margin: "0 0 4px 0" }}>Dark Mode</h2>
              <p style={{ fontSize: "12px", color: "#666", margin: 0 }}>
                Currently: {darkMode ? "Enabled" : "Disabled"}
              </p>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              style={{
                padding: "8px 16px",
                backgroundColor: darkMode ? "#333" : "#ff6b35",
                color: darkMode ? "#e0e0e0" : "#000",
                border: "none",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (darkMode) {
                  e.currentTarget.style.backgroundColor = "#444";
                } else {
                  e.currentTarget.style.backgroundColor = "#ff7a4a";
                }
              }}
              onMouseLeave={(e) => {
                if (darkMode) {
                  e.currentTarget.style.backgroundColor = "#333";
                } else {
                  e.currentTarget.style.backgroundColor = "#ff6b35";
                }
              }}
            >
              {darkMode ? <Moon size={14} /> : <Sun size={14} />}
              {darkMode ? "Disable" : "Enable"}
            </button>
          </div>
        </div>

        {/* Budget Visibility */}
        <div
          style={{
            padding: "20px",
            backgroundColor: "#1a1a1a",
            borderRadius: "8px",
            border: "1px solid #333",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "14px", fontWeight: "600", margin: "0 0 4px 0" }}>
                Show Budget & Costs
              </h2>
              <p style={{ fontSize: "12px", color: "#666", margin: 0 }}>
                Display cost information in UI
              </p>
            </div>
            <input
              type="checkbox"
              checked={showBudget}
              onChange={(e) => setShowBudget(e.target.checked)}
              style={{ width: "20px", height: "20px", cursor: "pointer" }}
            />
          </div>
        </div>

        {/* Notifications */}
        <div
          style={{
            padding: "20px",
            backgroundColor: "#1a1a1a",
            borderRadius: "8px",
            border: "1px solid #333",
            marginBottom: "16px",
          }}
        >
          <div>
            <h2 style={{ fontSize: "14px", fontWeight: "600", margin: "0 0 12px 0" }}>
              Notification Level
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {(["all", "important", "errors"] as const).map((level) => (
                <label
                  key={level}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px",
                    cursor: "pointer",
                    borderRadius: "4px",
                    backgroundColor:
                      notificationLevel === level ? "rgba(255, 107, 53, 0.1)" : "transparent",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    if (notificationLevel !== level) {
                      e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (notificationLevel !== level) {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }
                  }}
                >
                  <input
                    type="radio"
                    name="notification-level"
                    value={level}
                    checked={notificationLevel === level}
                    onChange={(e) => setNotificationLevel(e.target.value as any)}
                    style={{ cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "13px", color: "#e0e0e0", textTransform: "capitalize" }}>
                    {level === "all" ? "All notifications" : level === "important" ? "Important only" : "Errors only"}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Workspace */}
        <div
          style={{
            padding: "20px",
            backgroundColor: "#1a1a1a",
            borderRadius: "8px",
            border: "1px solid #333",
            marginBottom: "16px",
          }}
        >
          <h2 style={{ fontSize: "14px", fontWeight: "600", margin: "0 0 12px 0" }}>
            Workspace
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "#666", fontWeight: "600", display: "block", marginBottom: "4px" }}>
                Name
              </label>
              <input
                type="text"
                defaultValue="Default Workspace"
                style={{
                  width: "100%",
                  padding: "8px",
                  backgroundColor: "#0f0f0f",
                  border: "1px solid #333",
                  borderRadius: "4px",
                  fontSize: "12px",
                  color: "#e0e0e0",
                  outline: "none",
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "#666", fontWeight: "600", display: "block", marginBottom: "4px" }}>
                Time Zone
              </label>
              <select
                defaultValue="UTC"
                style={{
                  width: "100%",
                  padding: "8px",
                  backgroundColor: "#0f0f0f",
                  border: "1px solid #333",
                  borderRadius: "4px",
                  fontSize: "12px",
                  color: "#e0e0e0",
                  outline: "none",
                }}
              >
                <option value="UTC">UTC</option>
                <option value="EST">Eastern (EST)</option>
                <option value="PST">Pacific (PST)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: "#ff6b35",
            color: "#000",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#ff7a4a";
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#ff6b35";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          Save Changes
        </button>
      </div>
    </AdminLayout>
  );
}
