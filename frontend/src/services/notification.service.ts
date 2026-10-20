import axios from "../config/axios";
import type { AppNotification } from "../types";

export interface NotificationPage {
  items: AppNotification[];
  hasMore: boolean;
  unread: number;
}

export const getNotifications = async (before?: string): Promise<NotificationPage> => {
  const { data } = await axios.get<NotificationPage>("/notifications", { params: before ? { before } : undefined });
  return data;
};

/** Without ids, marks everything as read. */
export const markNotificationsRead = async (ids?: string[]) => {
  const { data } = await axios.patch<{ unread: number }>("/notifications/read", ids ? { ids } : {});
  return data;
};

export const clearNotifications = async () => {
  await axios.delete("/notifications");
};
