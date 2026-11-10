import { useEffect, useState } from "react";
import { Bot, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { identifyGillyStudent } from "@/services/gilly";

type Message = {
  role: "assistant" | "user";
  content: string;
};

export default function Gilly() {
  const [studentId, setStudentId] = useState<string | null>(null);
  const [status, setStatus] = useState("Verifying your identity...");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    let active = true;

    identifyGillyStudent()
      .then((id) => {
        if (!active) return;

        setStudentId(id);
        setStatus("");
        setMessages([
          {
            role: "assistant",
            content: "Hey! I'm Gilly AI. What shall we learn today?",
          },
        ]);
      })
      .catch(() => {
        console.error("Gilly identity error:",error);

        if(active) {
        setStatus(
          error instanceof Error 
          ? error.message
          : "Identity verification failed."
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  function handleSend() {
    const text = input.trim();

    if (!text || !studentId) return;

    setMessages((previous) => [
      ...previous,
      { role: "user", content: text },
    ]);

    setInput("");
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <header className="flex items-center gap-3 border-b p-4">
        <Bot className="h-6 w-6 text-primary" />
        <div>
          <h1 className="font-semibold">Gilly AI</h1>
          <p className="text-xs text-muted-foreground">
            Your personal learning assistant
          </p>
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1 p-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {status && (
            <p className="text-center text-sm text-muted-foreground">
              {status}
            </p>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`max-w-[85%] rounded-xl p-3 text-sm ${
                message.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "mr-auto bg-muted"
              }`}
            >
              {message.content}
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t p-4">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask Gilly anything..."
            disabled={!studentId}
            rows={2}
          />

          <Button
            onClick={handleSend}
            disabled={!studentId || !input.trim()}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
