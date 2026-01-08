import { useState, useEffect } from "react";
import { trpc } from "../lib/trpc";
import DashboardLayout from "../components/DashboardLayout";

type AlertStatus = "active" | "resolved";
type Tenant = "all" | "launchbase" | "vinces";

interface Alert {
  id: number;
  tenant: string;
  alertKey: string;
  fingerprint: string;
  severity: string;
  title: string;
  message: string;
  status: AlertStatus;
  firstSeenAt: Date;
  lastSeenAt: Date;
  sentAt: Date | null;
  resolvedAt: Date | null;
  deliveryProvider: string | null;
  deliveryMessageId: string | null;
  lastError: string | null;
  meta: Record<string, unknown> | null;
}

export default function AdminAlerts() {
  const [statusFilter, setStatusFilter] = useState<AlertStatus | "all">("active");
  const [tenantFilter, setTenantFilter] = useState<Tenant>("all");
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch alerts
  const { data: alerts, isLoading, refetch } = trpc.admin.getAlerts.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    tenant: tenantFilter === "all" ? undefined : tenantFilter,
  });

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refetch();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, refetch]);

  const activeCount = alerts?.filter((a: Alert) => a.status === "active").length || 0;
  const resolvedCount = alerts?.filter((a: Alert) => a.status === "resolved").length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Alerts</h1>
            <p className="text-sm text-gray-600 mt-1">
              System health alerts and incident tracking
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300"
              />
              Auto-refresh (30s)
            </label>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Refresh Now
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-600">Active Alerts</div>
            <div className="text-3xl font-bold text-red-600 mt-1">{activeCount}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-600">Resolved (24h)</div>
            <div className="text-3xl font-bold text-green-600 mt-1">{resolvedCount}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-600">Total Alerts</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">{alerts?.length || 0}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex flex-wrap gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`px-4 py-2 text-sm rounded-lg ${
                    statusFilter === "all"
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setStatusFilter("active")}
                  className={`px-4 py-2 text-sm rounded-lg ${
                    statusFilter === "active"
                      ? "bg-red-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Active ({activeCount})
                </button>
                <button
                  onClick={() => setStatusFilter("resolved")}
                  className={`px-4 py-2 text-sm rounded-lg ${
                    statusFilter === "resolved"
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Resolved ({resolvedCount})
                </button>
              </div>
            </div>

            {/* Tenant Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tenant
              </label>
              <select
                value={tenantFilter}
                onChange={(e) => setTenantFilter(e.target.value as Tenant)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg bg-white"
              >
                <option value="all">All Tenants</option>
                <option value="launchbase">LaunchBase</option>
                <option value="vinces">Vince's Snowplow</option>
              </select>
            </div>
          </div>
        </div>

        {/* Alerts Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-600">Loading alerts...</div>
          ) : !alerts || alerts.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-gray-400 text-4xl mb-2">✓</div>
              <div className="text-gray-600 font-medium">No alerts found</div>
              <div className="text-gray-500 text-sm mt-1">
                {statusFilter === "active"
                  ? "All systems operational"
                  : "No resolved alerts in the last 24 hours"}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                      Tenant
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                      Alert Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                      Severity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                      First Seen
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                      Last Seen
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                      Resolved
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                      Message
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {alerts.map((alert: Alert) => (
                    <tr key={alert.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            alert.status === "active"
                              ? "bg-red-100 text-red-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {alert.status === "active" ? "🔴 Active" : "✅ Resolved"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {alert.tenant === "launchbase" ? "LaunchBase" : "Vince's Snowplow"}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-700">
                        {alert.alertKey}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            alert.severity === "critical"
                              ? "bg-red-100 text-red-800"
                              : alert.severity === "warning"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {alert.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(alert.firstSeenAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(alert.lastSeenAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {alert.resolvedAt
                          ? new Date(alert.resolvedAt).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-md truncate">
                        {alert.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Fingerprint Reference */}
        {alerts && alerts.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="text-sm font-medium text-gray-700 mb-2">
              Alert Fingerprints (for dedupe tracking)
            </div>
            <div className="space-y-1">
              {alerts.slice(0, 5).map((alert: Alert) => (
                <div key={alert.id} className="text-xs font-mono text-gray-600">
                  {alert.fingerprint}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
