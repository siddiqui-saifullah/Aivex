import mongoose, { type Types } from "mongoose";

/** Seats a teacher bought (or an admin granted) for their classes, valid until a date. */
export interface ISeatPack {
    owner: Types.ObjectId;
    institute: string;
    seats: number;
    validUntil: Date;
    source: "payment" | "admin";
    payment: Types.ObjectId | null;
    createdAt: Date;
}

const seatPackSchema = new mongoose.Schema<ISeatPack>(
    {
        owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        institute: { type: String, trim: true, maxlength: 100, default: "" },
        seats: { type: Number, required: true, min: 1 },
        validUntil: { type: Date, required: true },
        source: { type: String, enum: ["payment", "admin"], default: "payment" },
        payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", default: null },
    },
    { timestamps: true },
);
export const SeatPack = mongoose.model<ISeatPack>("SeatPack", seatPackSchema);

/**
 * A student holding one of a teacher's seats. Seats are filled in order
 * (oldest first): when there are more students than seats, the latest ones
 * wait for a seat to free up.
 */
export interface ISeat {
    owner: Types.ObjectId;
    student: Types.ObjectId;
    createdAt: Date;
}

const seatSchema = new mongoose.Schema<ISeat>(
    {
        owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    },
    { timestamps: true },
);
seatSchema.index({ owner: 1, student: 1 }, { unique: true });
export const Seat = mongoose.model<ISeat>("Seat", seatSchema);

/** "Contact us" from a college that wants a quote or to pay by invoice. */
export interface IInstituteInquiry {
    name: string;
    email: string;
    institute: string;
    students: number;
    message: string;
    user: Types.ObjectId | null;
    status: "new" | "done";
    createdAt: Date;
}

const inquirySchema = new mongoose.Schema<IInstituteInquiry>(
    {
        name: { type: String, required: true, trim: true, maxlength: 80 },
        email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
        institute: { type: String, required: true, trim: true, maxlength: 120 },
        students: { type: Number, default: 0, min: 0 },
        message: { type: String, trim: true, maxlength: 2000, default: "" },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        status: { type: String, enum: ["new", "done"], default: "new" },
    },
    { timestamps: true },
);
export const InstituteInquiry = mongoose.model<IInstituteInquiry>("InstituteInquiry", inquirySchema);
