interface GeminiLikeResponse {
    candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
    }>;
}

export const extractGeminiText = (response: GeminiLikeResponse | null | undefined): string => {
    return (
        response?.candidates
            ?.map(candidate =>
                candidate.content?.parts
                    ?.map(part => part.text || "")
                    .join("")
            )
            .join("\n\n") || ""
    );
}
