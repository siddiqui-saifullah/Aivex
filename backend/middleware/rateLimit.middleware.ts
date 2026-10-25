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
}: {
    windowMs: number;
    max: number;
    /** What to count requests by (default: the signed-in user, else the IP). */
    key?: (req: Request) => string;
    message?: string;
}) => {
    const hits = new Map<string, { count: number; resetAt: number }>();

    return (req: Request, res: Response, next: NextFunction) => {
        const id = key(req);
        const now = Date.now();
        const entry = hits.get(id);

        if (!entry || entry.resetAt <= now) {
            hits.set(id, { count: 1, resetAt: now + windowMs });
            // Opportunistic cleanup so the map can't grow forever
            if (hits.size > 10_000) {
                for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
            }
            return next();
        }

        if (entry.count >= max) {
            res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
            return res.status(429).json({ message });
        }

        entry.count++;
        next();
    };
};
