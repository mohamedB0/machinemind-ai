"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { conversationsApi, machinesApi, manualPageUrl, Message, Source, Machine, Manual } from "@/lib/api";

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const { token, isLoading } = useAuth();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [machine, setMachine] = useState<Machine | null>(null);
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [selectedManualId, setSelectedManualId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (!isLoading && !token) router.push("/login"); }, [token, isLoading]);

  useEffect(() => {
    if (!token || !id) return;
    Promise.all([
      conversationsApi.getMessages(id, token),
    ]).then(([msgs]) => {
      setMessages(msgs as Message[]);
    }).finally(() => setLoading(false));
  }, [token, id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const completedManuals = manuals.filter(m => m.status === "completed");

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || sending || !token) return;
    const q = question.trim();
    setQuestion("");
    setSending(true);
    setError("");

    const userMsg: Message = {
      id: crypto.randomUUID(),
      conversation_id: id,
      role: "user",
      content: q,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const resp = await conversationsApi.sendMessage(id, q, selectedManualId || undefined, token);
      const assistantMsg: Message = {
        id: resp.message_id,
        conversation_id: id,
        role: "assistant",
        content: resp.answer,
        sources: resp.sources,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setError(err.message || "Failed to get response");
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  };

  if (isLoading || loading) return <ChatSkeleton />;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 px-4 py-3 flex items-center gap-3 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
        <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors">
          ← Back
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-white text-sm truncate">Technical Assistant</h1>
          {completedManuals.length > 0 && (
            <select
              value={selectedManualId}
              onChange={e => setSelectedManualId(e.target.value)}
              className="text-xs text-gray-400 bg-transparent border-0 focus:outline-none cursor-pointer mt-0.5"
            >
              <option value="">All manuals</option>
              {completedManuals.map(m => (
                <option key={m.id} value={m.id}>{m.original_filename}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-xs text-gray-400">Groq llama-3.3-70b</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 max-w-3xl mx-auto w-full">
        {messages.length === 0 && !sending && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🤖</div>
            <h2 className="text-lg font-semibold text-gray-200 mb-2">MachineMind AI Ready</h2>
            <p className="text-gray-400 text-sm">Ask any question about your machine manuals.</p>
            <div className="mt-6 grid grid-cols-1 gap-2 text-left">
              {[
                "What are the technical specifications?",
                "How do I perform preventive maintenance?",
                "What does error code E04 mean?",
                "What tools are needed for this procedure?",
              ].map(s => (
                <button key={s} onClick={() => setQuestion(s)}
                  className="text-left px-4 py-2.5 rounded-xl glass hover:border-indigo-500/50 text-sm text-gray-300 hover:text-white transition-all">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`animate-msg flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 text-sm">
                ⚙️
              </div>
            )}
            <div className={`max-w-[80%] ${msg.role === "user" ? "order-1" : ""}`}>
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-tr-sm"
                  : "glass text-gray-100 rounded-tl-sm"
              }`}>
                {msg.content}
              </div>
              {/* Sources */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 space-y-1">
                  {msg.sources.slice(0, 3).map((s, i) => (
                    <SourceCard key={i} source={s} token={token ?? ""} />
                  ))}
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-xl bg-gray-700 flex items-center justify-center flex-shrink-0 text-sm">
                👤
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {sending && (
          <div className="animate-msg flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 text-sm">⚙️</div>
            <div className="glass rounded-2xl rounded-tl-sm px-4 py-4 flex gap-1.5 items-center">
              <div className="w-2 h-2 rounded-full bg-indigo-400 typing-dot" />
              <div className="w-2 h-2 rounded-full bg-indigo-400 typing-dot" />
              <div className="w-2 h-2 rounded-full bg-indigo-400 typing-dot" />
            </div>
          </div>
        )}

        {error && (
          <div className="text-center text-sm text-red-400 px-4 py-2 bg-red-900/20 rounded-xl border border-red-700/30">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 bg-gray-950/80 backdrop-blur-sm px-4 py-4">
        <form onSubmit={sendMessage} className="max-w-3xl mx-auto flex gap-3 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(e as any); }
              }}
              placeholder="Ask anything about your machine manuals… (Enter to send)"
              rows={1}
              disabled={sending}
              className="w-full resize-none px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 max-h-32"
              style={{ minHeight: "48px" }}
            />
          </div>
          <button
            type="submit"
            disabled={!question.trim() || sending}
            className="w-12 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white flex items-center justify-center flex-shrink-0 transition-colors"
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="text-lg">↑</span>
            )}
          </button>
        </form>
        <p className="text-center text-xs text-gray-600 mt-2">
          Answers are grounded in your uploaded manuals. Always verify critical procedures.
        </p>
      </div>
    </div>
  );
}

function SourceCard({ source, token }: { source: Source; token: string }) {
  const [open, setOpen] = useState(false);
  const pageImg = source.page_start
    ? manualPageUrl(source.manual_id, source.page_start, token)
    : null;
  const kindIcon = source.content_type === "figure" ? "🖼"
    : source.content_type === "table" ? "▦" : "📄";
  return (
    <button
      onClick={() => setOpen(!open)}
      className="w-full text-left px-3 py-2 rounded-lg bg-gray-900/70 border border-gray-700/50 hover:border-indigo-500/30 transition-all"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-indigo-400">{kindIcon}</span>
        <span className="text-xs text-gray-400 flex-1 truncate">
          {source.section_title || (source.content_type === "figure" ? "Figure" : source.content_type === "table" ? "Table" : "Section")} — p.{source.page_start}
          {source.page_end && source.page_end !== source.page_start ? `–${source.page_end}` : ""}
        </span>
        <span className="text-xs text-gray-600">{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div className="mt-2 space-y-2 border-t border-gray-700/50 pt-2">
          <p className="text-xs text-gray-400 leading-relaxed">{source.excerpt}</p>
          {pageImg && (
            <div>
              <img
                src={pageImg}
                alt={`Manual page ${source.page_start}`}
                loading="lazy"
                className="w-full max-h-72 object-contain object-top rounded-lg border border-gray-700/50 bg-white"
              />
              <a
                href={pageImg}
                target="_blank"
                rel="noreferrer"
                onClick={e => e.stopPropagation()}
                className="mt-1 inline-block text-xs text-indigo-400 hover:text-indigo-300"
              >
                View full page ↗
              </a>
            </div>
          )}
        </div>
      )}
    </button>
  );
}

function ChatSkeleton() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="border-b border-gray-800 h-14 px-4 flex items-center gap-3">
        <div className="skeleton w-16 h-4" />
        <div className="skeleton flex-1 h-4" />
      </div>
      <div className="flex-1 p-6 space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="skeleton h-16 rounded-2xl" />)}
      </div>
    </div>
  );
}
