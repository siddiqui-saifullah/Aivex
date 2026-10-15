import type { Request, Response } from "express";
import * as ai from "../services/ai.service.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../errors/AppError.js";
import type { AiResponse } from "../types/index.js";

export const getResultPoint = async (req: Request, res: Response) => {
    try {
        const { prompt } = req.query;
        if (typeof prompt !== "string" || !prompt.trim()) {
            res.status(400).send({ message: "prompt query parameter is required" });
            return;
        }
        const response = await ai.generate({ prompt });
        res.send(response)
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: (error as Error).message })
    }
}


export const getResult = async (params: Parameters<typeof ai.generate>[0]): Promise<AiResponse | undefined> => {
    try {
        return await ai.generate(params);
    } catch (error) {
        console.log(error);
    }
}

/* -------------------------------------------------------------------------- */
/* ENHANCE PROMPT                                                             */
/* -------------------------------------------------------------------------- */
export const enhancePromptController = catchAsync(async (req, res) => {
    const { prompt } = req.body;

    if (typeof prompt !== "string" || !prompt.trim()) {
        throw new AppError("prompt is required", 400);
    }
    if (prompt.length > 4000) {
        throw new AppError("prompt is too long to enhance", 413);
    }

    const enhanced = await ai.enhancePrompt(prompt.trim()).catch((err) => {
        console.error("Enhance failed:", err);
        const status = (err as { status?: number }).status === 429 ? 429 : 502;
        throw new AppError(
            status === 429 ? ai.friendlyAiError(err) : "Could not enhance the prompt right now",
            status,
        );
    });

    res.status(200).json({ prompt: enhanced || prompt.trim() });
});
