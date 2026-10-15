import type { Types } from "mongoose";
import { fromStoredFiles } from "./fileStore.js";

interface RawChatMessage {
    _id: Types.ObjectId;
    text?: string;
    role: string;
    sender?: Types.ObjectId | null;
    filePatch?: unknown;
    createdAt?: Date;
}

export const normalizeChatMessage = (msg: RawChatMessage) => ({
    id: msg._id,
    text: msg.text,
    role: msg.role,
    sender: msg.sender,
    filePatch: msg.filePatch ? fromStoredFiles(msg.filePatch) : null,
    createdAt: msg.createdAt,
});
