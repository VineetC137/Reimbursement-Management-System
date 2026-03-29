export type NotificationSummary = {
  id: string;
  title: string;
  message: string;
  status: string;
  channel: string;
  readAt: string | null;
  createdAt: string;
  payload: Record<string, unknown> | null;
};
