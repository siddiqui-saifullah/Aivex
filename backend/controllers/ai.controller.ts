import type { Request, Response } from "express";
import * as ai from "../services/ai.service.js";
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


export const getResult = async ({ prompt }: { prompt: string }): Promise<AiResponse | undefined> => {
    try {
        console.log("Request : Ai is working on Query")
        const response = await ai.generate({ prompt });
        console.log("response sent");
        return response;
    } catch (error) {
        console.log(error);
    }
}
