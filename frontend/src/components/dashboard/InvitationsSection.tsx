import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Loader2, MailOpen, Users, Flag } from "lucide-react";
import { getMyInvites, respondToInvite } from "../../services/project.service";
import { useReport } from "../../context/report.context";
import { useToast } from "../../context/toast.context";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { INVITES_CHANGED } from "../../utils/inviteEvents";
import { plural } from "../../utils/plural";
import { timeAgo } from "../../utils/timeAgo";
import { STACK_FORMATTER } from "../../constants/options";
import type { ProjectInvite } from "../../types";

/** Dashboard strip: project invitations to accept or decline. Hidden when there are none. */
const InvitationsSection = ({ onAccepted }: { onAccepted?: () => void }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const report = useReport();
  const [invites, setInvites] = useState<ProjectInvite[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      getMyInvites()
        .then((list) => alive && setInvites(list))
        .catch(() => {
          /* older server: no invitations */
        });
    load();
    // New invites, or ones answered from the notification bell
    window.addEventListener(INVITES_CHANGED, load);
    return () => {
      alive = false;
      window.removeEventListener(INVITES_CHANGED, load);
    };
  }, []);

  const answer = async (invite: ProjectInvite, accept: boolean) => {
    setBusy(invite.projectId);
    try {
      await respondToInvite(invite.projectId, accept);
      setInvites((prev) => prev.filter((i) => i.projectId !== invite.projectId));
      if (accept) {
        toast.success(`Joined “${invite.name}”`);
        onAccepted?.();
        navigate(`/projects/${invite.projectId}`);
      } else {
        toast.info("Invitation declined");
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not answer the invitation"));
      setInvites((prev) => prev.filter((i) => i.projectId !== invite.projectId));
    } finally {
      setBusy(null);
    }
  };

  if (invites.length === 0) return null;

  return (
    <section className="mb-10" aria-labelledby="invites-heading">
      <div className="mb-4 flex items-center gap-2">
        <MailOpen size={18} className="text-teal-400" />
        <h2 id="invites-heading" className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
          Invitations
        </h2>
        <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-xs font-semibold text-teal-300">
          {invites.length}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {invites.map((invite) => (
          <div
            key={invite.projectId}
            className="flex flex-col gap-3 rounded-xl border border-teal-500/20 bg-teal-500/5 p-4"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-white">{invite.name}</p>
              <p className="mt-0.5 text-xs text-zinc-400">
                <span className="text-zinc-200">@{invite.invitedBy.username ?? invite.owner.username}</span> invited
                you · {timeAgo(invite.createdAt)}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                <Users size={12} /> {plural(invite.membersCount, "member")}
                <span>· {STACK_FORMATTER[invite.stack] ?? invite.stack}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => answer(invite, true)}
                disabled={busy === invite.projectId}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-teal-500 py-2 text-sm font-semibold text-black transition hover:bg-teal-400 disabled:opacity-60"
              >
                {busy === invite.projectId ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Accept
              </button>
              <button
                onClick={() => answer(invite, false)}
                disabled={busy === invite.projectId}
                className="flex-1 rounded-lg border border-white/10 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white disabled:opacity-60"
              >
                Decline
              </button>
              <button
                onClick={() => report.open({ targetType: "project", targetId: invite.projectId, label: `the invitation to “${invite.name}”` })}
                title="Report as spam or abuse"
                aria-label={`Report the invitation to ${invite.name}`}
                className="rounded-lg border border-white/10 px-2.5 text-zinc-500 transition hover:bg-white/5 hover:text-red-300"
              >
                <Flag size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default InvitationsSection;
