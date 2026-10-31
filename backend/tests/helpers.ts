/**
 * API test helpers. Tests need a MongoDB and a Redis to talk to:
 *   TEST_MONGO_URL=mongodb://127.0.0.1:27017 REDIS_HOST=127.0.0.1 npm test
 * Each run uses its own throwaway database, dropped at the end.
 */
import crypto from "node:crypto";
import type { Express } from "express";
import request from "supertest";

export const ADMIN_EMAIL = `admin_${crypto.randomBytes(4).toString("hex")}@example.com`;

const baseUrl = process.env.TEST_MONGO_URL;
export const canRun = Boolean(baseUrl);

let app: Express;

/** Start the app on a fresh database (call once per test file). */
export const setup = async () => {
    const db = `aivex_test_${crypto.randomBytes(4).toString("hex")}`;
    const url = new URL(baseUrl!);
    url.pathname = `/${db}`;
    process.env.MONGO_URL = url.toString();
    process.env.JWT_SECRET ??= "test-secret";
    process.env.ADMIN_EMAILS = ADMIN_EMAIL;
    // No email codes or OAuth in tests: sign-up creates the account directly
    delete process.env.SMTP_HOST;
    app = (await import("../app.js")).default;
    const mongoose = (await import("mongoose")).default;
    await mongoose.connection.asPromise();
    return app;
};

export const teardown = async () => {
    const mongoose = (await import("mongoose")).default;
    await mongoose.connection.dropDatabase().catch(() => undefined);
    await mongoose.disconnect();
    const redis = (await import("../services/redis.service.js")).default;
    redis.disconnect();
};

/**
 * Usernames must pass the spam filter (real-looking words, no random runs)
 * and be unique within a test file: duplicates in parallel inserts hang the
 * local FerretDB instead of failing fast.
 */
const WORDS = ["maple", "river", "lotus", "tiger", "cedar", "amber", "coral", "falcon", "harbor", "meadow", "orbit", "pebble"];
let created = 0;
const name = () => {
    const n = created++;
    return `tester_${WORDS[n % WORDS.length]}_${WORDS[Math.floor(n / WORDS.length) % WORDS.length]}`;
};

export interface TestUser {
    id: string;
    token: string;
    username: string;
    email: string;
}

/** Created directly (sign-up over HTTP is rate limited per IP). */
export const createUser = async (email = `${name()}@example.com`): Promise<TestUser> => {
    const username = name();
    const { createUser: create } = await import("../services/user.service.js");
    const user = await create({ name: "Test Person", username, email, password: "password123" });
    return { id: String(user._id), token: user.generateJWT(), username, email };
};

/** An authenticated request as `user`. */
export const as = (user: TestUser) => {
    const auth = (r: request.Test) => r.set("Authorization", `Bearer ${user.token}`);
    return {
        get: (path: string) => auth(request(app).get(path)),
        post: (path: string, body?: object) => auth(request(app).post(path)).send(body ?? {}),
        patch: (path: string, body?: object) => auth(request(app).patch(path)).send(body ?? {}),
        delete: (path: string) => auth(request(app).delete(path)),
    };
};
