import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/app-error.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "./notification.service.js";

const notificationRouter = Router();

function getRouteParam(value: string | string[] | undefined, name: string): string {
  const normalizedValue = Array.isArray(value) ? value[0] : value;

  if (!normalizedValue) {
    throw new AppError(400, "INVALID_ROUTE_PARAM", `${name} is required`);
  }

  return normalizedValue;
}

notificationRouter.use(requireAuth);

notificationRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "AUTH_REQUIRED", "Authorization token is required");
    }

    const notifications = await listNotifications(req.auth.companyId, req.auth.userId);

    res.json({
      success: true,
      data: notifications
    });
  })
);

notificationRouter.patch(
  "/read-all",
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "AUTH_REQUIRED", "Authorization token is required");
    }

    const result = await markAllNotificationsRead(req.auth.companyId, req.auth.userId);

    res.json({
      success: true,
      message: "Notifications marked as read",
      data: result
    });
  })
);

notificationRouter.patch(
  "/:notificationId/read",
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "AUTH_REQUIRED", "Authorization token is required");
    }

    const notificationId = getRouteParam(req.params.notificationId, "notificationId");
    const notification = await markNotificationRead(req.auth.companyId, req.auth.userId, notificationId);

    res.json({
      success: true,
      message: "Notification marked as read",
      data: notification
    });
  })
);

export { notificationRouter };
