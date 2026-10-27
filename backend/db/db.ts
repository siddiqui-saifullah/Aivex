import mongoose from "mongoose";
import { resetAdminPasswords } from "../services/adminBootstrap.service.js";
import { backfillCanonicalEmails } from "../services/user.service.js";

function connect(): void {
    const mongoUrl = process.env.MONGO_URL;
    if (!mongoUrl) {
        console.warn('MONGO_URL not set; skipping database connection (development only).');
        return;
    }

    mongoose.connect(mongoUrl)
        .then(() => {
            console.log("Connected to database");
            backfillCanonicalEmails().catch((err) => console.error("emailCanonical backfill failed:", err));
            return resetAdminPasswords().catch((err) => console.error("Admin password reset failed:", err));
        })
        .catch((err: unknown) => {
            console.error('Failed to connect to MongoDB:', err);
            process.exit(1);
        });
};

export default connect;
