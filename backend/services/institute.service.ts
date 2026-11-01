import mongoose, { type Types } from "mongoose";
import AppError from "../errors/AppError.js";
import userModel from "../models/user.model.js";
import Classroom from "../models/classroom.model.js";
import type { IPayment } from "../models/payment.model.js";
import { InstituteInquiry, Seat, SeatPack } from "../models/institute.model.js";
import { INSTITUTE, PERIOD_DAYS, isPeriod } from "../config/plans.js";
import { billingEnabled, createPaymentLink } from "./billing.service.js";
import { isMailConfigured, sendInstituteInquiry } from "./mail.service.js";

type Id = Types.ObjectId | string;
const DAY = 86_400_000;

/**
 * Institute plan. A teacher buys seat packs; every student in their classes
 * holds a seat, filled oldest first. While the teacher has enough valid
 * seats, a student gets the Student plan's AI. Leaving or being removed from
 * the teacher's last class gives the seat back.
 */

const activePacks = (owner: Id) => SeatPack.find({ owner, validUntil: { $gt: new Date() } }).sort({ validUntil: -1 }).lean();

const capacityOf = (packs: { seats: number }[]) => packs.reduce((n, p) => n + p.seats, 0);

/** Give seats to students of the teacher's classes who don't have one yet. */
export const fillSeats = async (owner: Id, studentIds?: Id[]) => {
    let students = studentIds?.map(String);
    if (!students) {
        const classes = await Classroom.find({ teacher: owner }).select("students").lean();
        students = classes
            .flatMap((c) => c.students)
            .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime())
            .map((s) => String(s.user));
    }
    for (const student of [...new Set(students)]) {
        if (student === String(owner)) continue;
        await Seat.updateOne({ owner, student }, { $setOnInsert: { owner, student } }, { upsert: true }).catch(() => undefined);
    }
};

/** A student joined one of the teacher's classes. */
export const onStudentJoined = async (owner: Id, student: Id) => {
    if (!await SeatPack.exists({ owner, validUntil: { $gt: new Date() } })) return;
    await fillSeats(owner, [student]);
};

/** A student left (or was removed from) a class: free the seat if it was their last class with this teacher. */
export const onStudentLeft = async (owner: Id, student: Id) => {
    const stillIn = await Classroom.exists({ teacher: owner, "students.user": student });
    if (!stillIn) await Seat.deleteOne({ owner, student });
};

/** The seat that gives this student AI through a teacher, if any. */
export const seatCoverage = async (student: Id) => {
    const seats = await Seat.find({ student }).lean();
    for (const seat of seats) {
        const packs = await activePacks(seat.owner);
        const capacity = capacityOf(packs);
        if (!capacity) continue;
        const ahead = await Seat.countDocuments({ owner: seat.owner, _id: { $lt: seat._id } });
        if (ahead >= capacity) continue;
        const owner = await userModel.findById(seat.owner).select("name").lean();
        return {
            institute: packs[0].institute,
            teacher: owner?.name ?? "",
            expiresAt: packs[0].validUntil,
        };
    }
    return null;
};

/** What a teacher sees: their seat packs and who holds the seats. */
export const instituteSummary = async (owner: Id) => {
    const [packs, seats] = await Promise.all([
        SeatPack.find({ owner }).sort({ validUntil: -1 }).limit(20).lean(),
        Seat.find({ owner }).sort({ _id: 1 }).populate<{ student: { _id: Types.ObjectId; name: string; username: string } }>("student", "name username").lean(),
    ]);
    const now = Date.now();
    const capacity = capacityOf(packs.filter((p) => p.validUntil.getTime() > now));
    return {
        price: INSTITUTE.pricePerSeat,
        minSeats: INSTITUTE.minSeats,
        maxSeats: INSTITUTE.maxSeats,
        enabled: billingEnabled(),
        capacity,
        packs: packs.map((p) => ({
            _id: p._id,
            institute: p.institute,
            seats: p.seats,
            validUntil: p.validUntil,
            active: p.validUntil.getTime() > now,
            source: p.source,
        })),
        students: seats
            .filter((s) => s.student)
            .map((s, i) => ({ _id: s.student._id, name: s.student.name, username: s.student.username, covered: i < capacity })),
    };
};

const cleanInstitute = (name: unknown) => String(name ?? "").trim().replace(/\s+/g, " ").slice(0, 100);

/** Pay for seats: a Razorpay payment link, back to /settings/billing. */
export const createSeatCheckout = async (owner: Id, body: { seats?: unknown; period?: unknown; institute?: unknown }) => {
    if (!billingEnabled()) throw new AppError("Payments aren't open yet. Please check back soon.", 503);
    const seats = Number(body.seats);
    if (!Number.isInteger(seats) || seats < INSTITUTE.minSeats || seats > INSTITUTE.maxSeats) {
        throw new AppError(`Choose between ${INSTITUTE.minSeats} and ${INSTITUTE.maxSeats} seats. For more, contact us.`, 400);
    }
    if (!isPeriod(body.period)) throw new AppError("Choose monthly or yearly", 400);
    const institute = cleanInstitute(body.institute);
    if (institute.length < 2) throw new AppError("Enter your institute's name", 400);
    const user = await userModel.findById(owner).select("teachingMode").lean();
    if (!user?.teachingMode) throw new AppError("Turn on teaching mode in Settings to buy seats for your classes", 403);

    const amount = seats * INSTITUTE.pricePerSeat[body.period] * 100;
    return createPaymentLink(owner, {
        amount,
        description: `Aivex Institute: ${seats} seats (${body.period === "yearly" ? "1 year" : "1 month"})`,
        payment: { kind: "seats", plan: INSTITUTE.plan, period: body.period, seats, institute },
    });
};

/** A paid seat payment becomes a seat pack, and current students get seats. */
export const applySeatPayment = async (payment: IPayment & { _id: Types.ObjectId }) => {
    const validUntil = new Date(Date.now() + PERIOD_DAYS[payment.period] * DAY);
    await SeatPack.updateOne(
        { payment: payment._id },
        { $setOnInsert: { owner: payment.user, institute: payment.institute, seats: payment.seats, validUntil, source: "payment", payment: payment._id } },
        { upsert: true },
    );
    await fillSeats(payment.user);
    return validUntil;
};

/** Admin: seats for a college that paid by invoice. */
export const grantSeats = async (body: { email?: unknown; seats?: unknown; days?: unknown; institute?: unknown }) => {
    const email = String(body.email ?? "").trim().toLowerCase();
    const seats = Number(body.seats);
    const days = Number(body.days);
    if (!Number.isInteger(seats) || seats < 1 || seats > 100_000) throw new AppError("Enter a number of seats", 400);
    if (!Number.isInteger(days) || days < 1 || days > 1100) throw new AppError("Enter a number of days (up to 3 years)", 400);
    const user = await userModel.findOne({ email }).select("_id teachingMode").lean();
    if (!user) throw new AppError("No account with this email", 404);
    if (!user.teachingMode) await userModel.updateOne({ _id: user._id }, { teachingMode: true });
    const pack = await SeatPack.create({
        owner: user._id,
        institute: cleanInstitute(body.institute),
        seats,
        validUntil: new Date(Date.now() + days * DAY),
        source: "admin",
    });
    await fillSeats(user._id);
    return pack;
};

/* -------------------------------------------------------------------------- */
/* CONTACT                                                                    */
/* -------------------------------------------------------------------------- */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const createInquiry = async (body: Record<string, unknown>, userId?: Id) => {
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const institute = cleanInstitute(body.institute);
    const students = Math.max(0, Math.min(1_000_000, Math.floor(Number(body.students) || 0)));
    const message = String(body.message ?? "").trim().slice(0, 2000);
    if (name.length < 2) throw new AppError("Enter your name", 400);
    if (!EMAIL.test(email)) throw new AppError("Enter a valid email", 400);
    if (institute.length < 2) throw new AppError("Enter your institute's name", 400);

    const inquiry = await InstituteInquiry.create({ name, email, institute, students, message, user: userId ?? null });
    if (isMailConfigured()) {
        const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
        for (const to of admins) {
            void sendInstituteInquiry({ to, name, email, institute, students, message }).catch((err) => console.error("Inquiry email failed:", err));
        }
    }
    return { ok: true, id: inquiry._id };
};

/** Admin: enquiries and every seat pack. */
export const adminInstitutes = async () => {
    const [inquiries, packs] = await Promise.all([
        InstituteInquiry.find().sort({ createdAt: -1 }).limit(100).lean(),
        SeatPack.find().sort({ createdAt: -1 }).limit(100).populate<{ owner: { _id: Types.ObjectId; name: string; email: string } }>("owner", "name email").lean(),
    ]);
    return { inquiries, packs };
};

export const updateInquiry = async (id: string, status: unknown) => {
    if (!mongoose.isValidObjectId(id)) throw new AppError("Not found", 404);
    if (status !== "new" && status !== "done") throw new AppError("Invalid status", 400);
    const res = await InstituteInquiry.updateOne({ _id: id }, { status });
    if (!res.matchedCount) throw new AppError("Not found", 404);
};
