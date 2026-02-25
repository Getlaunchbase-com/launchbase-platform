/**
 * File Upload Security — Magic byte validation, MIME enforcement, temp isolation, malware hook
 *
 * Enterprise-grade file ingestion requires all of:
 *   1. Strict MIME whitelist
 *   2. Magic byte (file signature) validation
 *   3. Decoded file size cap (not just base64 length)
 *   4. Temp directory isolation before final storage
 *   5. Malware scanning hook (external scanner integration)
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Magic byte signatures for known file types
// ---------------------------------------------------------------------------

const FILE_SIGNATURES: Record<string, { bytes: number[]; offset?: number }[]> = {
  "application/pdf": [{ bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  "image/png": [{ bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  "image/jpeg": [{ bytes: [0xff, 0xd8, 0xff] }],
  "image/tiff": [
    { bytes: [0x49, 0x49, 0x2a, 0x00] }, // Little-endian TIFF
    { bytes: [0x4d, 0x4d, 0x00, 0x2a] }, // Big-endian TIFF
  ],
};

// Allowed MIME types for blueprint uploads
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/tiff",
  "application/dxf",
  "application/dwg",
  "application/octet-stream",
]);

// Maximum decoded file size: 40 MB
const MAX_FILE_SIZE_BYTES = 40 * 1024 * 1024;

// Temp upload directory — isolated from production storage
const TEMP_UPLOAD_DIR = path.join(os.tmpdir(), "launchbase-uploads");

// ---------------------------------------------------------------------------
// MIME validation
// ---------------------------------------------------------------------------

export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType.toLowerCase());
}

// ---------------------------------------------------------------------------
// Magic byte validation
// ---------------------------------------------------------------------------

/**
 * Validate file content against expected magic bytes for the claimed MIME type.
 * Returns valid=true if the file signature matches, or if no signature is
 * defined for the type (e.g. DXF/DWG are text-based formats).
 */
export function validateMagicBytes(
  data: Buffer,
  claimedMimeType: string
): { valid: boolean; detectedType?: string; reason?: string } {
  const normalized = claimedMimeType.toLowerCase();
  const signatures = FILE_SIGNATURES[normalized];

  // No signature defined for this type — skip (DXF/DWG/octet-stream)
  if (!signatures) {
    return { valid: true };
  }

  // Check claimed type first
  for (const sig of signatures) {
    const offset = sig.offset ?? 0;
    if (data.length < offset + sig.bytes.length) continue;

    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (data[offset + i] !== sig.bytes[i]) {
        match = false;
        break;
      }
    }
    if (match) return { valid: true, detectedType: normalized };
  }

  // Mismatch — check if content matches a different known type
  for (const [mime, sigs] of Object.entries(FILE_SIGNATURES)) {
    if (mime === normalized) continue;
    for (const sig of sigs) {
      const offset = sig.offset ?? 0;
      if (data.length < offset + sig.bytes.length) continue;
      let match = true;
      for (let i = 0; i < sig.bytes.length; i++) {
        if (data[offset + i] !== sig.bytes[i]) {
          match = false;
          break;
        }
      }
      if (match) {
        return {
          valid: false,
          detectedType: mime,
          reason: `File content is ${mime}, but claimed ${claimedMimeType}`,
        };
      }
    }
  }

  return {
    valid: false,
    reason: `File content does not match expected signature for ${claimedMimeType}`,
  };
}

// ---------------------------------------------------------------------------
// File size validation
// ---------------------------------------------------------------------------

export function validateFileSize(data: Buffer): {
  valid: boolean;
  sizeBytes: number;
  maxBytes: number;
  reason?: string;
} {
  if (data.length > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      sizeBytes: data.length,
      maxBytes: MAX_FILE_SIZE_BYTES,
      reason: `File size ${(data.length / 1024 / 1024).toFixed(1)}MB exceeds maximum ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`,
    };
  }
  return { valid: true, sizeBytes: data.length, maxBytes: MAX_FILE_SIZE_BYTES };
}

// ---------------------------------------------------------------------------
// Temp file isolation
// ---------------------------------------------------------------------------

/**
 * Write file to an isolated temp directory. File is NOT in production storage
 * yet — caller must explicitly move it after all validation passes.
 */
export function writeToTempIsolation(data: Buffer, filename: string): string {
  if (!fs.existsSync(TEMP_UPLOAD_DIR)) {
    fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true, mode: 0o700 });
  }

  const safeName = filename.replace(/[^\w.\-]/g, "_");
  const tempPath = path.join(TEMP_UPLOAD_DIR, `${randomUUID()}_${safeName}`);
  fs.writeFileSync(tempPath, data, { mode: 0o600 });
  return tempPath;
}

/**
 * Move validated file from temp isolation to final storage.
 */
export function moveFromTemp(tempPath: string, finalPath: string): void {
  const finalDir = path.dirname(finalPath);
  if (!fs.existsSync(finalDir)) {
    fs.mkdirSync(finalDir, { recursive: true });
  }
  // Try rename first (same filesystem), fall back to copy+delete
  try {
    fs.renameSync(tempPath, finalPath);
  } catch {
    fs.copyFileSync(tempPath, finalPath);
    fs.unlinkSync(tempPath);
  }
}

/**
 * Clean up temp file on validation failure.
 */
export function cleanupTemp(tempPath: string): void {
  try {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  } catch {
    // best-effort
  }
}

// ---------------------------------------------------------------------------
// Malware scanning hook
// ---------------------------------------------------------------------------

/**
 * Malware scanning hook. Calls external scanner if MALWARE_SCANNER_CMD is set.
 *
 * Expected scanner contract:
 *   - Takes file path as single argument
 *   - Exit code 0 = clean
 *   - Exit code 1 = infected
 *   - Any other exit code = scan error (treated as failure)
 *
 * When no scanner is configured, returns clean=true with scannerUsed=false
 * so callers can log that scanning was skipped.
 */
export async function scanForMalware(filePath: string): Promise<{
  clean: boolean;
  scannerUsed: boolean;
  reason?: string;
}> {
  const scannerCmd = process.env.MALWARE_SCANNER_CMD;
  if (!scannerCmd) {
    return { clean: true, scannerUsed: false };
  }

  try {
    const { execFileSync } = await import("child_process");
    execFileSync(scannerCmd, [filePath], {
      timeout: 30_000,
      stdio: "pipe",
    });
    return { clean: true, scannerUsed: true };
  } catch (err: any) {
    const exitCode = err.status ?? -1;
    return {
      clean: false,
      scannerUsed: true,
      reason:
        exitCode === 1
          ? "Malware detected by scanner"
          : `Scanner exited with code ${exitCode}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Combined validation pipeline
// ---------------------------------------------------------------------------

export interface FileValidationResult {
  valid: boolean;
  errors: string[];
  sizeBytes?: number;
  detectedType?: string;
  tempPath?: string;
}

/**
 * Run the full upload validation pipeline:
 *   1. MIME type whitelist check
 *   2. Decoded file size cap
 *   3. Magic byte (file signature) validation
 *   4. Write to temp isolation directory
 *   5. Malware scan hook
 *
 * If any step fails, earlier resources are cleaned up and errors returned.
 */
export async function validateUploadedFile(
  data: Buffer,
  claimedMimeType: string,
  filename: string
): Promise<FileValidationResult> {
  const errors: string[] = [];

  // 1. MIME whitelist
  if (!isAllowedMimeType(claimedMimeType)) {
    errors.push(`MIME type "${claimedMimeType}" is not allowed. Accepted: ${[...ALLOWED_MIME_TYPES].join(", ")}`);
    return { valid: false, errors };
  }

  // 2. File size
  const sizeResult = validateFileSize(data);
  if (!sizeResult.valid) {
    errors.push(sizeResult.reason!);
    return { valid: false, errors, sizeBytes: sizeResult.sizeBytes };
  }

  // 3. Magic bytes (for types with known signatures)
  const magicResult = validateMagicBytes(data, claimedMimeType);
  if (!magicResult.valid) {
    errors.push(magicResult.reason!);
    return { valid: false, errors, detectedType: magicResult.detectedType };
  }

  // 4. Temp isolation
  const tempPath = writeToTempIsolation(data, filename);

  // 5. Malware scan
  const scanResult = await scanForMalware(tempPath);
  if (!scanResult.clean) {
    cleanupTemp(tempPath);
    errors.push(scanResult.reason ?? "Malware scan failed");
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    sizeBytes: data.length,
    detectedType: magicResult.detectedType ?? claimedMimeType,
    tempPath,
  };
}
