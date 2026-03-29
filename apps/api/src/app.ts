import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { expenseRouter } from "./modules/expenses/expense.routes.js";
import { metadataRouter } from "./modules/metadata/metadata.routes.js";
import { notificationRouter } from "./modules/notifications/notification.routes.js";
import { reportRouter } from "./modules/reports/report.routes.js";
import { usersRouter } from "./modules/users/user.routes.js";
import { workflowRouter } from "./modules/workflows/workflow.routes.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.clientUrl,
    credentials: true
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok" } });
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/metadata", metadataRouter);
app.use("/api/v1/users", usersRouter);
app.use("/api/v1/expenses", expenseRouter);
app.use("/api/v1/workflows", workflowRouter);
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1/reports", reportRouter);

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
