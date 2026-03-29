import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok" } });
});

app.get("/api/v1/docs", (_req, res) => {
  res.json({
    success: true,
    data: {
      message: "OpenAPI scaffold placeholder. See docs/API_SPEC.md for endpoint contracts."
    }
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
