import type { Request, Response } from "express";
import mongoose from "mongoose";
import * as ai from "../services/ai.service.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../errors/AppError.js";
import type { AiResponse } from "../types/index.js";
import { AI_DISABLED_MESSAGE, isAiDisabledInProject } from "../services/aiPolicy.service.js";
import { ENHANCE_ROUTE, aiOptionsFor, quotaMessage, quotaStatus, recordModelUse, takeQuota } from "../services/aiQuota.service.js";

export const getResultPoint = async (req: Request, res: Response) => {
    try {
        const { prompt } = req.query;
        if (typeof prompt !== "string" || !prompt.trim()) {
            res.status(400).send({ message: "prompt query parameter is required" });
            return;
        }
        const refund = await takeQuota(req.user!._id, "vex");
        if (!refund) {
            res.status(429).send({ message: quotaMessage("vex", await quotaStatus(req.user!._id, "vex")) });
            return;
        }
        const { model, ...response } = await ai.generate({ prompt, ...await aiOptionsFor(req.user!._id) });
        if (ai.AI_ERROR_REPLY.test(response.text ?? "")) refund();
        else void recordModelUse(req.user!._id, model).catch(() => undefined);
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
    const { prompt, projectId } = req.body;

    if (typeof prompt !== "string" || !prompt.trim()) {
        throw new AppError("prompt is required", 400);
    }
    if (typeof projectId === "string" && mongoose.Types.ObjectId.isValid(projectId)
        && await isAiDisabledInProject(projectId, req.user!._id)) {
        throw new AppError(AI_DISABLED_MESSAGE, 403);
    }
    if (prompt.length > 4000) {
        throw new AppError("prompt is too long to enhance", 413);
    }

    const refund = await takeQuota(req.user!._id, "enhance");
    if (!refund) throw new AppError(quotaMessage("enhance", await quotaStatus(req.user!._id, "enhance")), 429);

    const enhanced = await ai.enhancePrompt(prompt.trim(), ENHANCE_ROUTE).catch((err) => {
        refund();
        console.error("Enhance failed:", err);
        const status = (err as { status?: number }).status === 429 ? 429 : 502;
        throw new AppError(
            status === 429 ? ai.friendlyAiError(err) : "Could not enhance the prompt right now",
            status,
        );
    });

    res.status(200).json({ prompt: enhanced || prompt.trim() });
});

/* -------------------------------------------------------------------------- */
/* DAILY ALLOWANCE                                                            */
/* -------------------------------------------------------------------------- */
export const usageController = catchAsync(async (req, res) => {
    res.status(200).json(await quotaStatus(req.user!._id, "vex"));
});
