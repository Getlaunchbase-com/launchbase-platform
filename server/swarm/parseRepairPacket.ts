export type ParsedExecution = {
  stopReason?: string;
  applied?: boolean;
  testsPassed?: boolean;
  patchValid?: boolean;
  costUsd?: number;
  latencyMs?: number;
  escalationTriggered?: boolean;
  didRetry?: boolean;
  modelPrimary?: string;
  modelFallback?: string;
};

export function parseRepairPacketJson(obj: any): ParsedExecution {
  const exec = obj?.execution ?? obj?.repairPacket?.execution ?? obj?.result?.execution ?? {};
  const facts = exec?.facts ?? obj?.facts ?? {};
  const parsed: ParsedExecution = {
    stopReason: exec?.stopReason ?? obj?.stopReason,
    applied: exec?.applied ?? facts?.applied,
    testsPassed: exec?.testsPassed ?? facts?.testsPassed,
    patchValid: exec?.patchValid ?? facts?.patchValid,
    costUsd: exec?.costUsd ?? obj?.costUsd,
    latencyMs: exec?.latencyMs ?? obj?.latencyMs,
    escalationTriggered: obj?.retryMeta?.escalationTriggered ?? obj?.execution?.retryMeta?.escalationTriggered,
    didRetry: obj?.retryMeta?.didRetry ?? obj?.execution?.retryMeta?.didRetry,
  };

  // Some packets include routing
  const routing = obj?.routing ?? exec?.routing ?? obj?.meta?.routing;
  if (routing) {
    parsed.modelPrimary = routing?.primaryModel ?? routing?.primary ?? routing?.modelPrimary;
    parsed.modelFallback = routing?.fallbackModel ?? routing?.fallback ?? routing?.modelFallback;
  }

  return parsed;
}
