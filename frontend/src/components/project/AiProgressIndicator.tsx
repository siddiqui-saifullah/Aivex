import { useEffect, useState } from "react";
import MessageGroup from "../shared/MessageGroup";

const AiProgressIndicator = () => {
  const [dots, setDots] = useState(".");
  const [createdAt] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev === ".") return "..";
        if (prev === "..") return "...";
        return ".";
      });
    }, 400);

    return () => clearInterval(interval);
  }, []);

  return (
    <MessageGroup
      groupId="ai-thinking"
      username="Aivex"
      messages={[
        {
          id: "ai-thinking-msg",
          text: `Thinking${dots}`,
          timestamp: createdAt,
        },
      ]}
      type="incoming"
      isAI={true}
      isTyping={false}
    />
  );
};

export default AiProgressIndicator;
