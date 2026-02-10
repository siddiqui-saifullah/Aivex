export const errorHandler = (err, req, res, next) => {
    if (err.isOperational) {
        return res.status(err.statusCode).json({
            message: err.message,
        });
    }

    console.error(err);
    res.status(500).json({
        message: "Internal Server Error",
    });
};
