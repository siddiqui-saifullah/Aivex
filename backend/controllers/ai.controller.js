import * as ai from "../services/ai.service.js";

export const getResultPoint = async (req, res) => {
    try {
        const { prompt } = req.query;
        const response = await ai.generate({ prompt });
        res.send(response)
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: error.message })
    }
}


export const getResult = async ({ prompt }) => {
    try {
        console.log("Request : Ai is working on Query")
        const response = await ai.generate({ prompt });
        console.log("response sent");
        return response;
    } catch (error) {
        console.log(error);
    }
}