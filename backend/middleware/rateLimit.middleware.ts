import type { NextFunction, Request, Response } from "express";

/**
 * Small in-memory fixed-window limiter keyed by user (or IP). Good enough for
 * a single server instance; use Redis if the backend is scaled out.
 */
export const rateLimit = ({ windowMs, max }: { windowMs: number; max: number }) => {
    const hits = new Map<string, { count: number; resetAt: number }>();

    return (req: Request, res: Response, next: NextFunction) => {
        const key = String(req.user?._id ?? req.ip);
        const now = Date.now();
        const entry = hits.get(key);

        if (!entry || entry.resetAt <= now) {
            hits.set(key, { count: 1, resetAt: now + windowMs });
            // Opportunistic cleanup so the map can't grow forever
            if (hits.size > 10_000) {
                for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
            }
            return next();
        }

        if (entry.count >= max) {
            res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
            return res.status(429).json({ message: "Too many runs, please wait a moment" });
        }

        entry.count++;
        next();
    };
};
