import { NotificationStatus } from "@prisma/client";

import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";
import type { NotificationSummary } from "./notification.types.js";

function mapNotification(notification: {
  id: string;
  title: string;
  message: string;
  status: NotificationStatus;
  channel: string;
  readAt: Date | null;
  createdAt: Date;
  payload: unknown;
}): NotificationSummary {
  return {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    status: notification.status,
    channel: notification.channel,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
    payload:
      notification.payload && typeof notification.payload === "object" && !Array.isArray(notification.payload)
        ? (notification.payload as Record<string, unknown>)
        : null
  };
}

export async function listNotifications(companyId: string, userId: string): Promise<NotificationSummary[]> {
  const notifications = await prisma.notification.findMany({
    where: {
      companyId,
      userId
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 20
  });

  return notifications.map(mapNotification);
}

export async function markNotificationRead(
  companyId: string,
  userId: string,
  notificationId: string
): Promise<NotificationSummary> {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      companyId,
      userId
    }
  });

  if (!notification) {
    throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Notification was not found");
  }

  const updatedNotification = await prisma.notification.update({
    where: {
      id: notification.id
    },
    data: {
      status: NotificationStatus.READ,
      readAt: notification.readAt ?? new Date()
    }
  });

  return mapNotification(updatedNotification);
}

export async function markAllNotificationsRead(companyId: string, userId: string): Promise<{ updatedCount: number }> {
  const result = await prisma.notification.updateMany({
    where: {
      companyId,
      userId,
      readAt: null
    },
    data: {
      status: NotificationStatus.READ,
      readAt: new Date()
    }
  });

  return {
    updatedCount: result.count
  };
}
