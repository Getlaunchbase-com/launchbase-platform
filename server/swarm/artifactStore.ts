import { storagePut, storageGet } from "../storage";
import { createHash } from "crypto";

export const DEFAULT_ARTIFACT_ALLOWLIST = [
  "repairPacket.json",
  "failurePacket.json",
  "failurePacket.original.json",
  "failurePacket.escalated.json",
  "retryMeta.json",
  "attempts.jsonl",
  "patch.diff",
  "scorecard.json",
  "meta.json",
  "stdout.log",
  "stderr.log",
] as const;

export type ArtifactName = (typeof DEFAULT_ARTIFACT_ALLOWLIST)[number];

export function isAllowedArtifactName(name: string): boolean {
  return DEFAULT_ARTIFACT_ALLOWLIST.includes(name as any);
}

export function buildArtifactKey(repairId: string, fileName: string): string {
  return `swarm/runs/${repairId}/${fileName}`;
}

export async function putArtifactText(repairId: string, fileName: string, content: string, contentType = "text/plain") {
  const key = buildArtifactKey(repairId, fileName);
  await storagePut(key, content, contentType);
  return key;
}

export async function putArtifactBytes(repairId: string, fileName: string, content: Buffer, contentType = "application/octet-stream") {
  const key = buildArtifactKey(repairId, fileName);
  await storagePut(key, content, contentType);
  return key;
}

export async function getArtifactUrl(key: string): Promise<string> {
  const { url } = await storageGet(key);
  return url;
}

export function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}
