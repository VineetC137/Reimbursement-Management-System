import path from "node:path";

import multer from "multer";

import { AppError } from "../lib/app-error.js";
import { ensureUploadDirectory } from "../lib/storage.js";

const acceptedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain"
]);

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => {
    callback(null, ensureUploadDirectory());
  },
  filename: (_request, file, callback) => {
    const sanitizedBaseName = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .slice(0, 48) || "receipt";
    const extension = path.extname(file.originalname) || ".bin";

    callback(null, `${Date.now()}-${sanitizedBaseName}${extension}`);
  }
});

export const receiptUploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 8 * 1024 * 1024
  },
  fileFilter: (_request, file, callback) => {
    if (!acceptedMimeTypes.has(file.mimetype)) {
      callback(new AppError(400, "INVALID_RECEIPT_FILE", "Upload PNG, JPG, WEBP, PDF, or TXT receipts only."));
      return;
    }

    callback(null, true);
  }
});
