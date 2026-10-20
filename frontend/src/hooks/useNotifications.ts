import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  clearNotifications,
  getNotifications,
  markNotificationsRead,
} from "../services/notification.service";
import type { AppNotification, InviteStatus } from "../types";
import { announceInvitesChanged } from "../utils/inviteEvents";

interface Options {
  enabled: boolean;
  /** Called for each notification that arrives live. */
  onIncoming?: (n: AppNotification) => void;
}

/** The signed-in user's notifications, kept live over the /notifications socket. */
export const useNotifications = ({ enabled, onIncoming }: Options) => {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const onIncomingRef = useRef(onIncoming);
  useEffect(() => {
    onIncomingRef.current = onIncoming;
  });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    getNotifications()
      .then((page) => {
        if (!alive) return;
        setItems(page.items);
        setUnread(page.unread);
        setHasMore(page.hasMore);
      })
      .catch(() => {
        /* older server without notifications: the bell just stays empty */
      });

    const socket: Socket = io(`${import.meta.env.VITE_API_URL}/notifications`, {
      // Own connection: sharing one with the project socket would send this
      // handshake (without a projectId) for the project chat too
      forceNew: true,
      auth: { token: localStorage.getItem("token") },
      reconnectionDelayMax: 10_000,
    });
    socket.on("notification:new", (n: AppNotification) => {
      setItems((prev) => (prev.some((p) => p._id === n._id) ? prev : [n, ...prev]));
      setUnread((u) => u + 1);
      if (n.type === "project-invite") announceInvitesChanged();
      onIncomingRef.current?.(n);
    });
    socket.on("notification:unread", ({ unread: count }: { unread: number }) => setUnread(count));
    // An invite was answered here or elsewhere, or withdrawn by its owner
    socket.on(
      "notification:resolved",
      ({ projectId, status, unread: count }: { projectId: string; status: InviteStatus; unread: number }) => {
        setItems((prev) =>
          prev.map((n) =>
            n.type === "project-invite" && n.projectId === projectId && n.status === "pending"
              ? { ...n, status, read: true }
              : n,
          ),
        );
        setUnread(count);
        announceInvitesChanged();
      },
    );

    return () => {
      alive = false;
      socket.disconnect();
    };
  }, [enabled]);

  const loadMore = useCallback(async () => {
    const last = items[items.length - 1];
    if (!last || loading) return;
    setLoading(true);
    try {
      const page = await getNotifications(last.createdAt);
      setItems((prev) => [...prev, ...page.items.filter((n) => !prev.some((p) => p._id === n._id))]);
      setHasMore(page.hasMore);
    } finally {
      setLoading(false);
    }
  }, [items, loading]);

  const markRead = useCallback(async (ids?: string[]) => {
    setItems((prev) => prev.map((n) => (!ids || ids.includes(n._id) ? { ...n, read: true } : n)));
    if (!ids) setUnread(0);
    try {
      const { unread: count } = await markNotificationsRead(ids);
      setUnread(count);
    } catch {
      /* the next load corrects it */
    }
  }, []);

  /** Show an invite's answer right away (the server confirms over the socket). */
  const setInviteStatus = useCallback((projectId: string, status: InviteStatus) => {
    setItems((prev) =>
      prev.map((n) =>
        n.type === "project-invite" && n.projectId === projectId && n.status === "pending"
          ? { ...n, status, read: true }
          : n,
      ),
    );
  }, []);

  const clearAll = useCallback(async () => {
    setItems([]);
    setUnread(0);
    setHasMore(false);
    await clearNotifications().catch(() => undefined);
  }, []);

  return { items, unread, hasMore, loading, loadMore, markRead, clearAll, setInviteStatus };
};
