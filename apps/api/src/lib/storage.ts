import { mkdirSync } from "node:fs";
import path from "node:path";

import { env } from "../config/env.js";

function resolveStorageRoot(): string {
  return path.resolve(process.cwd(), env.uploadDir);
}

export function ensureUploadDirectory(): string {
  const uploadDirectory = resolveStorageRoot();
  mkdirSync(uploadDirectory, { recursive: true });
  return uploadDirectory;
}

export function resolveReceiptPublicUrl(fileName: string): string {
  return `${env.publicApiBaseUrl}/uploads/${encodeURIComponent(fileName)}`;
}

export function buildStoredReceiptPath(fileName: string): string {
  return path.join(ensureUploadDirectory(), fileName);
}
