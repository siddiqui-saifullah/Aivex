import type { NextFunction, Request, Response } from "express";

/** Returns 0 when the hit is allowed, otherwise the ms until the next one is. */
export type Limiter = (key: string) => number;

/**
 * Small in-memory fixed-window limiter. Good enough for a single server
 * instance; use Redis if the backend is scaled out.
 */
export const createLimiter = ({ windowMs, max }: { windowMs: number; max: number }): Limiter => {
    const hits = new Map<string, { count: number; resetAt: number }>();

    return (key) => {
        const now = Date.now();
        const entry = hits.get(key);

        if (!entry || entry.resetAt <= now) {
            hits.set(key, { count: 1, resetAt: now + windowMs });
            // Opportunistic cleanup so the map can't grow forever
            if (hits.size > 10_000) {
                for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
            }
            return 0;
        }

        if (entry.count >= max) return entry.resetAt - now;

        entry.count++;
        return 0;
    };
};

/** Express middleware keyed by user (or IP). */
export const rateLimit = (limiterOrOptions: Limiter | { windowMs: number; max: number }) => {
    const limiter = typeof limiterOrOptions === "function" ? limiterOrOptions : createLimiter(limiterOrOptions);

    return (req: Request, res: Response, next: NextFunction) => {
        const waitMs = limiter(String(req.user?._id ?? req.ip));
        if (waitMs > 0) {
            res.setHeader("Retry-After", Math.ceil(waitMs / 1000));
            return res.status(429).json({ message: "Too many runs, please wait a moment" });
        }
        next();
    };
};
