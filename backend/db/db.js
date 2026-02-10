import mongoose from "mongoose";

function connect() {
    const mongoUrl = process.env.MONGO_URL;
    if (!mongoUrl) {
        console.warn('MONGO_URL not set; skipping database connection (development only).');
        return;
    }

    mongoose.connect(mongoUrl)
        .then(() => console.log("Connected to database"))
        .catch((err) => {
            console.error('Failed to connect to MongoDB:', err);
        });
};

export default connect;