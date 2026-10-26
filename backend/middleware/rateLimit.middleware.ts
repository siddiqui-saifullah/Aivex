import type { NextFunction, Request, Response } from "express";

/**
 * Small in-memory fixed-window limiter keyed by user (or IP). Good enough for
 * a single server instance; use Redis if the backend is scaled out.
 */
export const rateLimit = ({
    windowMs,
    max,
    key = (req) => String(req.user?._id ?? req.ip),
    message = "Too many runs, please wait a moment",
    failuresOnly = false,
}: {
    windowMs: number;
    max: number;
    /** What to count requests by (default: the signed-in user, else the IP). */
    key?: (req: Request) => string;
    message?: string;
    /** Count only requests that fail (wrong passwords), not successful sign-ins. */
    failuresOnly?: boolean;
}) => {
    const hits = new Map<string, { count: number; resetAt: number }>();

    return (req: Request, res: Response, next: NextFunction) => {
        const id = key(req);
        const now = Date.now();
        const entry = hits.get(id);
        // A request that succeeds gives its slot back
        const refundOnSuccess = () => {
            if (!failuresOnly) return;
            res.on("finish", () => {
                const current = hits.get(id);
                if (res.statusCode < 400 && current && current.count > 0) current.count--;
            });
        };

        if (!entry || entry.resetAt <= now) {
            hits.set(id, { count: 1, resetAt: now + windowMs });
            // Opportunistic cleanup so the map can't grow forever
            if (hits.size > 10_000) {
                for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
            }
            refundOnSuccess();
            return next();
        }

        if (entry.count >= max) {
            res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
            return res.status(429).json({ message });
        }

        entry.count++;
        refundOnSuccess();
        next();
    };
};
