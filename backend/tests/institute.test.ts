import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { ADMIN_EMAIL, as, canRun, createUser, setup, teardown, type TestUser } from "./helpers.js";

const SECRET = "rzp_test_secret";
const sign = (data: string) => crypto.createHmac("sha256", SECRET).update(data).digest("hex");

describe("institute plan", { skip: !canRun && "set TEST_MONGO_URL to run API tests" }, () => {
    let app: Awaited<ReturnType<typeof setup>>;
    let mock: http.Server;
    const links: { amount: number; reference_id: string; description: string }[] = [];
    let teacher: TestUser;
    let admin: TestUser;
    let User: typeof import("../models/user.model.js").default;
    let SeatPack: typeof import("../models/institute.model.js").SeatPack;

    before(async () => {
        delete process.env.VEX_DAILY_LIMIT;
        mock = http.createServer((req, res) => {
            let body = "";
            req.on("data", (c) => (body += c));
            req.on("end", () => {
                const data = JSON.parse(body);
                links.push(data);
                const id = `plink_seat_${links.length}`;
                res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ id, short_url: `https://rzp.io/i/${id}` }));
            });
        }).listen(0);
        Object.assign(process.env, {
            RAZORPAY_API_BASE: `http://127.0.0.1:${(mock.address() as AddressInfo).port}`,
            RAZORPAY_KEY_ID: "rzp_test_key",
            RAZORPAY_KEY_SECRET: SECRET,
        });
        app = await setup();
        User = (await import("../models/user.model.js")).default;
        SeatPack = (await import("../models/institute.model.js")).SeatPack;
        [teacher, admin] = await Promise.all([createUser(), createUser(ADMIN_EMAIL)]);
    });
    after(async () => {
        mock.close();
        await teardown();
    });

    const newClass = async (owner: TestUser) => (await as(owner).post("/classrooms", { name: `Class ${crypto.randomBytes(2).toString("hex")}`, stack: "c" })).body;
    const join = async (student: TestUser, code: string) => assert.equal((await as(student).post("/classrooms/join", { code })).status, 200);
    const limitOf = async (u: TestUser) => (await as(u).get("/ai/usage")).body.limit;

    it("only teachers can buy seats, at least 20", async () => {
        const res = await as(teacher).post("/billing/institute/checkout", { seats: 25, period: "monthly", institute: "Test College" });
        assert.equal(res.status, 403);
        await User.updateOne({ _id: teacher.id }, { teachingMode: true });
        assert.equal((await as(teacher).post("/billing/institute/checkout", { seats: 5, period: "monthly", institute: "Test College" })).status, 400);
        assert.equal((await as(teacher).post("/billing/institute/checkout", { seats: 25, period: "monthly", institute: "" })).status, 400);
    });

    it("paying for 25 seats covers the students already in the class", async () => {
        const cls = await newClass(teacher);
        const student = await createUser();
        await join(student, cls.code);
        assert.equal(await limitOf(student), 3);

        const res = await as(teacher).post("/billing/institute/checkout", { seats: 25, period: "yearly", institute: "Test College" });
        assert.equal(res.status, 201);
        const link = links.at(-1)!;
        assert.equal(link.amount, 25 * 399 * 100);
        assert.match(link.description, /25 seats \(1 year\)/);
        const linkId = res.body.url.split("/").pop();
        const paymentId = "pay_seats_1";
        const verify = await as(teacher).post("/billing/verify", {
            razorpay_payment_id: paymentId,
            razorpay_payment_link_id: linkId,
            razorpay_payment_link_reference_id: link.reference_id,
            razorpay_payment_link_status: "paid",
            razorpay_signature: sign(`${linkId}|${link.reference_id}|paid|${paymentId}`),
        });
        assert.equal(verify.status, 200, JSON.stringify(verify.body));
        assert.equal(verify.body.paid.kind, "seats");
        assert.equal(verify.body.paid.seats, 25);
        // The teacher's own plan doesn't change
        assert.equal(verify.body.plan, "free");

        assert.equal(await limitOf(student), 30);
        const me = (await as(student).get("/billing/me")).body;
        assert.equal(me.plan, "student");
        assert.equal(me.institute.institute, "Test College");

        const summary = (await as(teacher).get("/billing/institute")).body;
        assert.equal(summary.capacity, 25);
        assert.equal(summary.students.length, 1);
        assert.equal(summary.students[0].covered, true);
    });

    it("seats fill in joining order; leaving frees a seat", async () => {
        const t2 = await createUser();
        await User.updateOne({ _id: t2.id }, { teachingMode: true });
        await as(admin).post("/admin/seat-packs", { email: t2.email, seats: 2, days: 30, institute: "Small School" });
        const cls = await newClass(t2);
        const [a, b, c] = await Promise.all([createUser(), createUser(), createUser()]);
        for (const s of [a, b, c]) await join(s, cls.code);
        assert.deepEqual([await limitOf(a), await limitOf(b), await limitOf(c)], [30, 30, 3]);
        const summary = (await as(t2).get("/billing/institute")).body;
        assert.deepEqual(summary.students.map((s: { covered: boolean }) => s.covered), [true, true, false]);

        assert.equal((await as(a).post(`/classrooms/${cls._id}/leave`)).status, 204);
        assert.equal(await limitOf(c), 30);
        assert.equal(await limitOf(a), 3);
    });

    it("a student with their own bigger plan keeps it", async () => {
        const cls = await newClass(teacher);
        const s = await createUser();
        await User.updateOne({ _id: s.id }, { plan: "pro", planExpiresAt: new Date(Date.now() + 86_400_000) });
        await join(s, cls.code);
        assert.equal(await limitOf(s), 60);
    });

    it("coverage ends when the seats expire", async () => {
        const cls = await newClass(teacher);
        const s = await createUser();
        await join(s, cls.code);
        assert.equal(await limitOf(s), 30);
        await SeatPack.updateMany({ owner: teacher.id }, { validUntil: new Date(Date.now() - 1000) });
        assert.equal(await limitOf(s), 3);
    });

    it("colleges can ask for a quote; admins see it", async () => {
        assert.equal((await request(app).post("/billing/institute/inquiry").send({ name: "A", email: "x", institute: "" })).status, 400);
        const res = await request(app).post("/billing/institute/inquiry").send({
            name: "Dr Sharma", email: "hod@college.test", institute: "City Engineering College", students: 600, message: "Invoice please",
        });
        assert.equal(res.status, 201);
        const list = await as(admin).get("/admin/institutes");
        assert.equal(list.status, 200);
        assert.equal(list.body.inquiries[0].institute, "City Engineering College");
        assert.ok(list.body.packs.length >= 2);
        assert.equal((await as(admin).patch(`/admin/inquiries/${list.body.inquiries[0]._id}`, { status: "done" })).status, 204);
        assert.equal((await as(teacher).get("/admin/institutes")).status, 404);
    });

    it("admin seat grants check their input", async () => {
        assert.equal((await as(admin).post("/admin/seat-packs", { email: "nobody@x.test", seats: 10, days: 30 })).status, 404);
        assert.equal((await as(admin).post("/admin/seat-packs", { email: teacher.email, seats: 0, days: 30 })).status, 400);
    });
});
