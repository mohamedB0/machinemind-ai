"use client";
import { useEffect, useRef, useState } from "react";
import { IconMark, IconChat, IconArrowUp } from "@/lib/icons";
import { helpApi } from "@/lib/api";

type Msg = { role: "user" | "assistant"; content: string };

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} className="font-mono text-[12px] text-accent">{part.slice(1, -1)}</code>;
    return <span key={i}>{part}</span>;
  });
}

const SUGGESTIONS = [
  "What does this app do?",
  "How do I get started?",
  "How are answers verified?",
  "What happens when I upload a manual?",
];

const WELCOME: Msg = {
  role: "assistant",
  content:
    "Hello — I'm the MachineMind guide.\n\n" +
    "I can explain what this app does and how to use it: creating a machine, " +
    "uploading a manual, asking questions, understanding sources & confidence.\n\n" +
    "Pick a question below or ask me anything about the app itself.",
};

export default function HelpChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) setMessages([WELCOME]);
  }, [open, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, open]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || sending) return;
    setQuestion("");
    setError("");
    setSending(true);

    const history = [...messages, { role: "user" as const, content: q }];
    setMessages(history);

    try {
      const resp = await helpApi.send(q, messages);
      setMessages([...history, { role: "assistant", content: resp.answer }]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Guide unavailable";
      setError(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 print:hidden">
      {open && (
        <div className="animate-msg bg-panel border border-line shadow-xl w-[min(380px,calc(100vw-40px))] h-[min(560px,calc(100vh-120px))] flex flex-col mb-3 rounded-xs overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-line bg-raise">
            <IconMark className="w-4 h-4 text-accent" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-ink tracking-wide">MachineMind Guide</div>
              <div className="font-mono text-[10px] text-faint uppercase tracking-wider">
                What this app does · how to use it
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close guide"
              className="font-mono text-xs text-lo hover:text-ink px-1.5"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`animate-msg flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap rounded-xs border ${
                    m.role === "user"
                      ? "bg-accent/10 border-accent/40 text-ink"
                      : "bg-raise border-line text-ink"
                  }`}
                >
                  {m.role === "assistant" ? renderInline(m.content) : m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-raise border border-line rounded-xs px-3 py-2.5 flex gap-1">
                  <span className="typing-dot w-1.5 h-1.5 bg-accent" />
                  <span className="typing-dot w-1.5 h-1.5 bg-accent" />
                  <span className="typing-dot w-1.5 h-1.5 bg-accent" />
                </div>
              </div>
            )}
            {error && (
              <div className="font-mono text-[11px] text-fault border border-fault/40 bg-fault/10 px-2 py-1 rounded-xs">
                {error}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          <div className="px-3 pb-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                disabled={sending}
                className="font-mono text-[10px] text-mid border border-line hover:border-accent hover:text-accent disabled:opacity-40 px-2 py-1 rounded-xs"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(question);
            }}
            className="border-t border-line p-2.5 flex items-end gap-2 bg-bg"
          >
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(question);
                }
              }}
              placeholder="Ask about the app..."
              rows={1}
              className="input flex-1 resize-none max-h-24"
            />
            <button
              type="submit"
              disabled={sending || !question.trim()}
              aria-label="Send"
              className="bg-accent hover:bg-accent-hi disabled:opacity-40 text-black rounded-xs p-2.5 shrink-0"
            >
              <IconArrowUp className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Floating launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="What does MachineMind AI do?"
        aria-label="Open MachineMind guide"
        className="bg-accent hover:bg-accent-hi text-black rounded-xs w-12 h-12 flex items-center justify-center shadow-lg relative"
      >
        {!open && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-ok border border-bg" />}
        {open ? (
          <span className="font-mono text-lg leading-none">✕</span>
        ) : (
          <IconChat className="w-5 h-5" />
        )}
      </button>
    </div>
  );
}
