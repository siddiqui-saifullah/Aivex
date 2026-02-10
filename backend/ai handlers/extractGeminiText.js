export const extractGeminiText = (response) => {
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
