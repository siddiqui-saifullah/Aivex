import catchAsync from "../utils/catchAsync.js";
import * as runner from "../services/runner.service.js";

export const getLanguagesController = catchAsync(async (req, res) => {
    res.status(200).json({
        configured: runner.isRunnerConfigured(),
        languages: Object.entries(runner.RUNNER_LANGUAGES).map(([id, l]) => ({
            id,
            label: l.label,
            extensions: l.extensions,
        })),
    });
});

export const runCodeController = catchAsync(async (req, res) => {
    const result = await runner.runCode({
        language: req.body.language,
        files: req.body.files,
        stdin: req.body.stdin ?? "",
    });
    res.status(200).json(result);
});
