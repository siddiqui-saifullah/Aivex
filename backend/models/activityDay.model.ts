import mongoose, { type Types } from "mongoose";

/** One row per user per day they used Aivex (daily active users). */
export interface IActivityDay {
    /** UTC day, "YYYY-MM-DD". */
    day: string;
    user: Types.ObjectId;
}

const activityDaySchema = new mongoose.Schema<IActivityDay>({
    day: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
});

activityDaySchema.index({ day: 1, user: 1 }, { unique: true });

const ActivityDay = mongoose.model<IActivityDay>("ActivityDay", activityDaySchema);
export default ActivityDay;
