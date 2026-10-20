/** Fired when the user's invitations change (new invite, answered, withdrawn). */
export const INVITES_CHANGED = "aivex:invites-changed";

export const announceInvitesChanged = () => window.dispatchEvent(new Event(INVITES_CHANGED));
