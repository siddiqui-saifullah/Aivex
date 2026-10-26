import { promises as dns } from "node:dns";
import disposableDomains from "disposable-email-domains/index.json" with { type: "json" };
import AppError from "../errors/AppError.js";

/**
 * Sign-up spam checks: throwaway email services, emails that can't receive
 * mail, and usernames/names that are reserved, abusive or look like spam.
 */

const DISPOSABLE = new Set<string>(disposableDomains);

/** "a.b+tag@googlemail.com" -> "ab@gmail.com": one account per real mailbox. */
export const canonicalEmail = (email: string) => {
    const [rawLocal = "", rawDomain = ""] = email.trim().toLowerCase().split("@");
    let local = rawLocal.split("+")[0];
    let domain = rawDomain;
    if (domain === "googlemail.com") domain = "gmail.com";
    if (domain === "gmail.com") local = local.replaceAll(".", "");
    return `${local}@${domain}`;
};

const isDisposableDomain = (domain: string) => {
    const parts = domain.split(".");
    // Subdomains of throwaway services too (x.mailinator.com)
    for (let i = 0; i < parts.length - 1; i++) {
        if (DISPOSABLE.has(parts.slice(i).join("."))) return true;
    }
    return false;
};

/** Whether DNS answers at all here (cached 5 min): a broken resolver must not block every sign-up. */
let dnsCheck: { ok: boolean; at: number } | null = null;
const dnsWorks = async () => {
    if (dnsCheck && Date.now() - dnsCheck.at < 5 * 60_000) return dnsCheck.ok;
    const ok = await dns.resolveMx("gmail.com").then((r) => r.length > 0, () => false);
    dnsCheck = { ok, at: Date.now() };
    return ok;
};

/** Whether the domain can receive mail (MX, or an A/AAAA fallback). Unknown on DNS trouble. */
const domainAcceptsMail = async (domain: string): Promise<boolean | null> => {
    const lookup = async () => {
        try {
            const mx = await dns.resolveMx(domain);
            // RFC 7505 "null MX": the domain explicitly accepts no mail
            if (mx.length > 0) return !(mx.length === 1 && mx[0].exchange === "");
        } catch (err) {
            const code = (err as NodeJS.ErrnoException).code;
            if (code !== "ENODATA" && code !== "ENOTFOUND") return null;
            if (code === "ENOTFOUND") return false;
        }
        try {
            return (await dns.resolve(domain)).length > 0;
        } catch {
            return false;
        }
    };
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
    return Promise.race([lookup(), timeout]);
};

/** Throws a 400 for throwaway or undeliverable addresses. */
export const assertEmailAllowed = async (email: string) => {
    const domain = email.trim().toLowerCase().split("@")[1] ?? "";
    if (!domain || !domain.includes(".")) throw new AppError("Enter a valid email address", 400);
    if (isDisposableDomain(domain)) {
        throw new AppError("Temporary email addresses aren't allowed. Use your real email", 400);
    }
    // Don't block sign-ups when DNS itself is having trouble
    if ((await domainAcceptsMail(domain)) === false && (await dnsWorks())) {
        throw new AppError(`"${domain}" can't receive email. Check the address for typos`, 400);
    }
};

/** Names that would impersonate the site or its staff. */
const RESERVED = new Set([
    "admin", "administrator", "root", "system", "sysadmin", "support", "help", "helpdesk",
    "moderator", "mod", "staff", "team", "official", "security", "abuse", "postmaster",
    "webmaster", "hostmaster", "info", "contact", "noreply", "no_reply", "mailer_daemon",
    "aivex", "aivex_team", "aivexofficial", "aivex_official", "vex", "vex_ai", "vexai",
    "api", "www", "mail", "ftp", "null", "undefined", "anonymous", "everyone", "here",
    "login", "logout", "register", "signup", "signin", "settings", "profile", "dashboard",
    "billing", "payment", "payments", "owner", "test", "guest", "user", "username",
]);

/** Spam and abuse found anywhere inside a name (no real name contains these). */
const BLOCKED_ANYWHERE = [
    "aivex", "casino", "viagra", "cialis", "porn", "onlyfans", "bitcoin", "airdrop", "giveaway",
    "freemoney", "http", "www", "telegram", "whatsapp",
    "fuck", "bitch", "pussy", "nigg", "fagg", "hitler",
    "chutiya", "chutiye", "madarchod", "behenchod", "bhenchod", "bhosd",
];

/** Blocked only as a whole word, since they are also parts of real names (Nazia, Randip, Essex). */
const BLOCKED_WORDS = new Set([
    "official", "sex", "xxx", "nude", "escort", "crypto", "forex", "betting", "shit", "cunt", "rape",
    "nazi", "gandu", "harami", "kutta", "kamina",
]);
/** Also real first names or surnames (Dick, Randi, Lund), so only blocked in usernames. */
const BLOCKED_USERNAME_WORDS = new Set(["admin", "moderator", "loan", "dick", "randi", "lund"]);

/** Words of a name: split on spaces, underscores and digits. */
const words = (text: string) => text.toLowerCase().split(/[\s_\d]+/).filter(Boolean);

const hasBlocked = (text: string, extraWords?: Set<string>) => {
    const compact = text.toLowerCase().replace(/[\s_.]+/g, "");
    return (
        BLOCKED_ANYWHERE.some((part) => compact.includes(part)) ||
        words(text).some((w) => BLOCKED_WORDS.has(w) || extraWords?.has(w))
    );
};

/** Throws a 400 when a username is reserved, abusive or looks auto-generated. */
export const assertUsernameAllowed = (username: string) => {
    const name = username.trim().toLowerCase();
    if (RESERVED.has(name) || RESERVED.has(name.replaceAll("_", ""))) {
        throw new AppError("This username is reserved. Choose another one", 400);
    }
    if (hasBlocked(name, BLOCKED_USERNAME_WORDS)) {
        throw new AppError("This username isn't allowed. Choose another one", 400);
    }
    const digits = name.replace(/\D/g, "").length;
    if (/\d{5,}/.test(name) || digits > name.length / 2) {
        throw new AppError("Username has too many numbers. Use mostly letters", 400);
    }
    if (/(.)\1{3,}/.test(name) || /^_|_$|__/.test(name)) {
        throw new AppError("Username looks like spam. Choose another one", 400);
    }
    // Keyboard mashing: 6+ letters in a row without a vowel (y counts)
    if (/[bcdfghjklmnpqrstvwxz]{6,}/.test(name)) {
        throw new AppError("Username looks like random letters. Choose another one", 400);
    }
};

/** Throws a 400 when a display name carries spam or abuse. */
export const assertNameAllowed = (fullName: string) => {
    if (hasBlocked(fullName)) throw new AppError("This name isn't allowed", 400);
    const name = fullName.trim().toLowerCase().replace(/\s+/g, "");
    if (/(.)\1{3,}/.test(name) || /[bcdfghjklmnpqrstvwxz]{7,}/.test(name)) {
        throw new AppError("Enter your real name", 400);
    }
};
