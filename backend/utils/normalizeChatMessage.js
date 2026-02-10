export const normalizeChatMessage = (msg) => ({
    id: msg._id,
    text: msg.text,
    role: msg.role,
    sender: msg.sender,
    filePatch: msg.filePatch,
    createdAt: msg.createdAt,
});