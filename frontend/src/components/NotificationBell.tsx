import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AtSign,
  Bell,
  BellRing,
  Bot,
  ClipboardList,
  LifeBuoy,
  MessageSquareText,
  Send,
  Check,
  CheckCheck,
  Crown,
  GraduationCap,
  Loader2,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  UserX,
  type LucideIcon,
  Flag,
} from "lucide-react";
import { useNotifications } from "../hooks/useNotifications";
import { useToast } from "../context/toast.context";
import { timeAgo } from "../utils/timeAgo";
import { getErrorMessage } from "../utils/getErrorMessage";
import { respondToInvite } from "../services/project.service";
import type { AppNotification, InviteStatus, NotificationType } from "../types";

const ICONS: Record<NotificationType, { icon: LucideIcon; tone: string }> = {
  "project-invite": { icon: UserPlus, tone: "bg-teal-500/15 text-teal-300" },
  "invite-accepted": { icon: UserCheck, tone: "bg-emerald-500/15 text-emerald-300" },
  "invite-declined": { icon: UserX, tone: "bg-zinc-500/15 text-zinc-300" },
  "project-removed": { icon: UserMinus, tone: "bg-red-500/15 text-red-300" },
  "project-owner": { icon: Crown, tone: "bg-amber-500/15 text-amber-300" },
  mention: { icon: AtSign, tone: "bg-sky-500/15 text-sky-300" },
  "class-join": { icon: GraduationCap, tone: "bg-violet-500/15 text-violet-300" },
  "class-ai": { icon: Bot, tone: "bg-teal-500/15 text-teal-300" },
  assignment: { icon: ClipboardList, tone: "bg-teal-500/15 text-teal-300" },
  submission: { icon: Send, tone: "bg-sky-500/15 text-sky-300" },
  "submission-review": { icon: MessageSquareText, tone: "bg-emerald-500/15 text-emerald-300" },
  "help-request": { icon: LifeBuoy, tone: "bg-amber-500/15 text-amber-300" },
  "class-leave": { icon: UserMinus, tone: "bg-zinc-500/15 text-zinc-300" },
  "class-removed": { icon: UserMinus, tone: "bg-red-500/15 text-red-300" },
  "report-update": { icon: Flag, tone: "bg-amber-500/15 text-amber-300" },
};

const INVITE_STATUS_LABEL: Record<Exclude<InviteStatus, "pending">, string> = {
  accepted: "You joined",
  declined: "Declined",
  cancelled: "Invitation withdrawn",
  expired: "No longer available",
};

const desktopAlertsSupported = () => typeof window !== "undefined" && "Notification" in window;

/** Header bell: unread badge, a dropdown of recent notifications, live updates. */
const NotificationBell = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState(() =>
    desktopAlertsSupported() ? Notification.permission : "denied",
  );
  const [now, setNow] = useState(() => Date.now());
  const ref = useRef<HTMLDivElement>(null);

  const [answering, setAnswering] = useState<string | null>(null);
  const { items, unread, hasMore, loading, loadMore, markRead, clearAll, setInviteStatus } = useNotifications({
    enabled: true,
    onIncoming: (n) => {
      // Already looking at it: no need to interrupt (answers to your invites always show)
      const isInviteAnswer = n.type === "invite-accepted" || n.type === "invite-declined";
      if (!isInviteAnswer && n.link && n.link === location.pathname && document.visibilityState === "visible") return;
      if (document.visibilityState === "hidden" && desktopAlertsSupported() && Notification.permission === "granted") {
        const alert = new Notification(n.title, { body: n.body || undefined, icon: "/aivex.svg", tag: n._id });
        alert.onclick = () => {
          window.focus();
          if (n.link) navigate(n.link);
          void markRead([n._id]);
        };
      } else {
        toast.info(n.title, 5000);
      }
    },
  });

  // Unread count in the tab title
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\) /, "");
    document.title = unread > 0 ? `(${unread > 99 ? "99+" : unread}) ${base}` : base;
  }, [unread, location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    setNow(Date.now());
    setOpen((o) => !o);
  };

  const openItem = (n: AppNotification) => {
    if (!n.read) void markRead([n._id]);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  const answerInvite = async (n: AppNotification, accept: boolean) => {
    if (!n.projectId || answering) return;
    setAnswering(n._id);
    try {
      await respondToInvite(n.projectId, accept);
      setInviteStatus(n.projectId, accept ? "accepted" : "declined");
      if (accept) {
        toast.success("Joined the project");
        setOpen(false);
        navigate(`/projects/${n.projectId}`);
      }
    } catch (err) {
      const message = getErrorMessage(err, "Could not answer the invitation");
      toast.error(message);
      if (/no longer available/i.test(message)) setInviteStatus(n.projectId, "expired");
    } finally {
      setAnswering(null);
    }
  };

  const enableDesktopAlerts = async () => {
    if (!desktopAlertsSupported()) return;
    setPermission(await Notification.requestPermission());
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Notifications"
        className={`relative p-2 rounded-full transition-colors ${
          open ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
        }`}
      >
        {unread > 0 ? <BellRing size={18} /> : <Bell size={18} />}
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-500 px-1 text-[10px] font-bold leading-none text-black ring-2 ring-black">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-2 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/60 overflow-hidden animate-fade-in"
        >
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <p className="text-sm font-semibold text-white">
              Notifications{unread > 0 && <span className="ml-1.5 text-teal-300">{unread} new</span>}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => markRead()}
                disabled={unread === 0}
                title="Mark all as read"
                aria-label="Mark all as read"
                className="rounded-md p-1.5 text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <CheckCheck size={16} />
              </button>
              <button
                onClick={() => {
                  if (window.confirm("Clear all notifications?")) void clearAll();
                }}
                disabled={items.length === 0}
                title="Clear all"
                aria-label="Clear all notifications"
                className="rounded-md p-1.5 text-zinc-400 transition hover:bg-white/5 hover:text-red-300 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          <div className="max-h-[min(28rem,calc(100dvh-10rem))] overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-zinc-500">
                  <Bell size={18} />
                </div>
                <p className="text-sm font-medium text-zinc-200">You're all caught up</p>
                <p className="text-xs text-zinc-500">Invites, @mentions and class updates show up here.</p>
              </div>
            ) : (
              <ul>
                {items.map((n) => {
                  const { icon: Icon, tone } = ICONS[n.type] ?? ICONS.mention;
                  if (n.type === "project-invite" && n.status) {
                    const isPending = n.status === "pending";
                    return (
                      <li key={n._id} className={`flex gap-3 px-4 py-3 ${isPending ? "bg-teal-500/4" : ""}`}>
                        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}>
                          <Icon size={15} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm leading-snug ${isPending ? "font-medium text-white" : "text-zinc-300"}`}>
                            {n.title}
                          </p>
                          <p className="mt-1 text-[11px] text-zinc-600">{timeAgo(n.createdAt, now)}</p>
                          {isPending ? (
                            <div className="mt-2 flex gap-2">
                              <button
                                onClick={() => answerInvite(n, true)}
                                disabled={answering === n._id}
                                className="flex items-center gap-1 rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-teal-400 disabled:opacity-60"
                              >
                                {answering === n._id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                Accept
                              </button>
                              <button
                                onClick={() => answerInvite(n, false)}
                                disabled={answering === n._id}
                                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white disabled:opacity-60"
                              >
                                Decline
                              </button>
                            </div>
                          ) : (
                            <p className="mt-1.5 text-xs text-zinc-500">
                              {n.status === "accepted" && n.projectId ? (
                                <button
                                  onClick={() => {
                                    setOpen(false);
                                    navigate(`/projects/${n.projectId}`);
                                  }}
                                  className="text-teal-300 hover:underline"
                                >
                                  {INVITE_STATUS_LABEL.accepted} · open project
                                </button>
                              ) : (
                                INVITE_STATUS_LABEL[n.status as Exclude<InviteStatus, "pending">]
                              )}
                            </p>
                          )}
                        </div>
                        {isPending && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-teal-400" aria-label="Unread" />}
                      </li>
                    );
                  }
                  return (
                    <li key={n._id}>
                      <button
                        onClick={() => openItem(n)}
                        className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-white/3 ${
                          n.read ? "" : "bg-teal-500/4"
                        }`}
                      >
                        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}>
                          <Icon size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-sm leading-snug ${n.read ? "text-zinc-300" : "font-medium text-white"}`}>
                            {n.title}
                          </span>
                          {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-zinc-500">{n.body}</span>}
                          <span className="mt-1 block text-[11px] text-zinc-600">{timeAgo(n.createdAt, now)}</span>
                        </span>
                        {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-teal-400" aria-label="Unread" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {hasMore && (
              <button
                onClick={() => void loadMore()}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 border-t border-zinc-900 py-2.5 text-xs text-zinc-400 hover:text-white"
              >
                {loading && <Loader2 size={12} className="animate-spin" />} Show older
              </button>
            )}
          </div>

          {permission === "default" && (
            <button
              onClick={enableDesktopAlerts}
              className="flex w-full items-center gap-2 border-t border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-xs text-zinc-300 hover:text-white"
            >
              <BellRing size={13} className="text-teal-300" /> Get desktop alerts when Aivex is in the background
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
