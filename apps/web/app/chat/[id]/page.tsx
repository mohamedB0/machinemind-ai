"use client";
import { Suspense, useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { conversationsApi, machinesApi, manualPageUrl, Message, Source, Machine, Manual } from "@/lib/api";
import { IconBack, IconArrowUp, IconChevron } from "@/lib/icons";

const pad3 = (n: number) => String(n).padStart(3, "0");
const kindGlyph = (t?: string) => (t === "figure" ? "FIG" : t === "table" ? "TBL" : "TXT");
const kindFallback = (t?: string) => (t === "figure" ? "Figure" : t === "table" ? "Table" : "Section");
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour12: false });

function ChatPage() {
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

  useEffect(() => { if (!isLoading && !token) router.push("/login"); }, [token, isLoading, router]);

  useEffect(() => {
    if (!token || !id) return;
    Promise.all([
      conversationsApi.getMessages(id, token),
    ]).then(([msgs]) => {
      setMessages(msgs);
    }).finally(() => setLoading(false));
  }, [token, id]);

  useEffect(() => {
    if (!token || !id) return;
    let active = true;
    conversationsApi.list(token)
      .then(convs => {
        if (!active) return;
        const conv = convs.find(c => c.id === id);
        if (conv?.machine_id) {
          machinesApi.get(conv.machine_id, token)
            .then(m => { if (active) setMachine(m); })
            .catch(() => {});
          machinesApi.listManuals(conv.machine_id, token)
            .then(mans => { if (active) setManuals(mans); })
            .catch(() => {});
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [token, id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const completedManuals = manuals.filter(m => m.status === "completed");

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get response");
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  };

  if (isLoading || loading) return <ChatSkeleton />;

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <div className="border-b border-line px-4 py-3 flex items-center gap-3 bg-bg sticky top-0 z-10">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 font-mono text-xs text-lo hover:text-ink uppercase tracking-wider shrink-0"
        >
          <IconBack className="w-3.5 h-3.5" /> Dashboard
        </Link>
        <span className="h-4 w-px bg-line" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2.5">
            <h1 className="text-sm font-semibold text-ink truncate">{machine?.name ?? "Technical Assistant"}</h1>
            <span className="font-mono text-[10px] text-faint tracking-wider hidden sm:inline">
              SESSION {id.slice(0, 8).toUpperCase()}
            </span>
          </div>
          {completedManuals.length > 0 && (
            <select
              value={selectedManualId}
              onChange={e => setSelectedManualId(e.target.value)}
              className="font-mono text-[11px] text-lo hover:text-mid bg-bg border border-line rounded-xs px-1.5 py-0.5 mt-1 focus:outline-none focus:border-line-hi cursor-pointer max-w-full"
            >
              <option value="">ALL MANUALS</option>
              {completedManuals.map(m => (
                <option key={m.id} value={m.id}>{m.original_filename}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-1.5 h-1.5 bg-ok" />
          <span className="font-mono text-[10px] text-faint tracking-wider hidden sm:inline">GROQ · GPT-OSS-120B</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 max-w-3xl mx-auto w-full">
        {messages.length === 0 && !sending && (
          <div className="py-14">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent mb-3">System Ready</div>
            <h2 className="text-xl font-semibold text-ink mb-2">Ask your manuals.</h2>
            <p className="text-sm text-lo mb-8">
              Every answer is pulled from your uploaded documentation, with page-level citations.
            </p>
            <div className="border border-line rounded-xs divide-y divide-line bg-panel">
              {[
                "What are the technical specifications?",
                "How do I perform preventive maintenance?",
                "What does error code E04 mean?",
                "What tools are needed for this procedure?",
              ].map(s => (
                <button
                  key={s}
                  onClick={() => setQuestion(s)}
                  className="w-full text-left px-4 py-2.5 text-sm text-mid hover:text-ink hover:bg-raise flex items-center gap-3"
                >
                  <span className="font-mono text-xs text-accent">&gt;</span>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg =>
          msg.role === "user" ? (
            <div key={msg.id} className="animate-msg flex flex-col items-end">
              <div className="font-mono text-[10px] uppercase tracking-widest text-faint mb-1.5">
                Operator · {timeOf(msg.created_at)}
              </div>
              <div className="max-w-[80%] bg-raise border border-line rounded-xs px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-ink">
                {msg.content}
              </div>
            </div>
          ) : (
            <div key={msg.id} className="animate-msg">
              <div className="font-mono text-[10px] uppercase tracking-widest text-faint mb-1.5">
                Assistant · {timeOf(msg.created_at)}
              </div>
              <div className="max-w-[90%] border border-line rounded-xs bg-panel px-4 py-3">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink">{msg.content}</p>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="border-t border-line mt-3 pt-2">
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-lo mb-1">
                      Sources · {msg.sources.length}
                    </div>
                    <div className="divide-y divide-line/60">
                      {msg.sources.slice(0, 3).map((s, i) => (
                        <SourceCard key={i} source={s} index={i} token={token ?? ""} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {/* Typing indicator */}
        {sending && (
          <div className="animate-msg">
            <div className="font-mono text-[10px] uppercase tracking-widest text-faint mb-1.5">
              Assistant · {timeOf(new Date().toISOString())}
            </div>
            <div className="w-fit border border-line rounded-xs bg-panel px-4 py-3.5 flex gap-1.5 items-center">
              <span className="typing-dot w-1.5 h-1.5 bg-accent" />
              <span className="typing-dot w-1.5 h-1.5 bg-accent" />
              <span className="typing-dot w-1.5 h-1.5 bg-accent" />
            </div>
          </div>
        )}

        {error && (
          <div className="text-center text-sm text-fault px-4 py-2 border border-fault/40 bg-fault/10 rounded-xs">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-line bg-bg px-4 py-4">
        <form onSubmit={sendMessage} className="max-w-3xl mx-auto flex gap-2.5 items-end">
          <textarea
            ref={textareaRef}
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); }
            }}
            placeholder="Ask anything about your machine manuals… (Enter to send)"
            rows={1}
            disabled={sending}
            className="flex-1 resize-none px-3.5 py-3 rounded-xs bg-panel border border-line text-sm text-ink placeholder:text-faint focus:outline-none focus:border-accent disabled:opacity-50 max-h-32"
            style={{ minHeight: "48px" }}
          />
          <button
            type="submit"
            disabled={!question.trim() || sending}
            className="w-12 h-12 rounded-xs bg-accent hover:bg-accent-hi disabled:opacity-40 text-bg flex items-center justify-center shrink-0"
          >
            {sending ? (
              <span className="typing-dot w-3 h-3 bg-bg" />
            ) : (
              <IconArrowUp className="w-5 h-5" />
            )}
          </button>
        </form>
        <p className="text-center font-mono text-[10px] uppercase tracking-widest text-faint mt-2.5">
          Answers are grounded in your uploaded manuals. Always verify critical procedures.
        </p>
      </div>
    </div>
  );
}

function SourceCard({ source, index, token }: { source: Source; index: number; token: string }) {
  const [open, setOpen] = useState(false);
  const pageImg = source.page_start
    ? manualPageUrl(source.manual_id, source.page_start, token)
    : null;
  const pageRange = source.page_end && source.page_end !== source.page_start
    ? `p.${source.page_start}–${source.page_end}`
    : `p.${source.page_start}`;
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left py-2 flex items-center gap-2 font-mono text-xs text-mid hover:text-ink group"
      >
        <span className="text-accent shrink-0">SRC {pad3(index + 1)}</span>
        <span className="text-faint">·</span>
        <span className="text-lo group-hover:text-mid shrink-0">{kindGlyph(source.content_type)}</span>
        <span className="text-faint">·</span>
        <span className="text-mid group-hover:text-ink flex-1 min-w-0 truncate">
          {source.section_title || kindFallback(source.content_type)}
        </span>
        <span className="shrink-0">{pageRange}</span>
        <span className="text-faint shrink-0">↗</span>
        <IconChevron className={`w-3 h-3 text-faint shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="py-2 space-y-2.5">
          <p className="text-xs text-lo leading-relaxed">{source.excerpt}</p>
          {pageImg && (
            <div>
              <div className="border border-line rounded-xs bg-white p-0 w-fit max-w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pageImg}
                  alt={`Manual page ${source.page_start}`}
                  loading="lazy"
                  className="w-full max-w-96 max-h-72 object-contain object-top block"
                />
              </div>
              <a
                href={pageImg}
                target="_blank"
                rel="noreferrer"
                onClick={e => e.stopPropagation()}
                className="mt-1.5 inline-block font-mono text-[11px] text-accent hover:text-accent-hi"
              >
                Open full page ↗
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChatSkeleton() {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <div className="border-b border-line h-14 px-4 flex items-center gap-3">
        <div className="skeleton w-16 h-4" />
        <div className="skeleton flex-1 h-4" />
      </div>
      <div className="flex-1 p-6 space-y-4 max-w-3xl mx-auto w-full">
        {[1, 2, 3].map(i => <div key={i} className="skeleton h-16" />)}
      </div>
    </div>
  );
}

export default function ChatPageRoute() {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ChatPage />
    </Suspense>
  );
}
