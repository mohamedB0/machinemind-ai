const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body && !(options.body instanceof FormData)
      ? { "Content-Type": "application/json" }
      : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null as T;
  return res.json();
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (email: string, password: string, full_name?: string) =>
    request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, full_name }),
    }),

  login: async (email: string, password: string): Promise<{ access_token: string }> => {
    const form = new URLSearchParams({ username: email, password });
    return request("/api/auth/login", {
      method: "POST",
      body: form,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  },

  me: (token: string) => request("/api/auth/me", {}, token),
};

// ── Machines ──────────────────────────────────────────────────────────────────
export const machinesApi = {
  list: (token: string) => request<Machine[]>("/api/machines", {}, token),
  get: (id: string, token: string) => request<Machine>(`/api/machines/${id}`, {}, token),
  create: (data: { name: string; manufacturer?: string; model_number?: string; description?: string }, token: string) =>
    request<Machine>("/api/machines", { method: "POST", body: JSON.stringify(data) }, token),

  listManuals: (machineId: string, token: string) =>
    request<Manual[]>(`/api/machines/${machineId}/manuals`, {}, token),

  uploadManual: (machineId: string, file: File, token: string) => {
    const form = new FormData();
    form.append("file", file);
    return request<Manual>(`/api/machines/${machineId}/manuals`, {
      method: "POST",
      body: form,
    }, token);
  },

  getManual: (machineId: string, manualId: string, token: string) =>
    request<Manual>(`/api/machines/${machineId}/manuals/${manualId}`, {}, token),
};

// ── Conversations ─────────────────────────────────────────────────────────────
export const conversationsApi = {
  list: (token: string) => request<Conversation[]>("/api/conversations", {}, token),
  create: (machineId: string, title: string, token: string) =>
    request<Conversation>("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ machine_id: machineId, title }),
    }, token),
  getMessages: (convId: string, token: string) =>
    request<Message[]>(`/api/conversations/${convId}/messages`, {}, token),
  sendMessage: (convId: string, question: string, manualId: string | undefined, token: string) =>
    request<ChatResponse>(`/api/conversations/${convId}/messages`, {
      method: "POST",
      body: JSON.stringify({ question, manual_id: manualId }),
    }, token),
};

// ── Help / guide chatbot (public, no auth) ────────────────────────────────────
export const helpApi = {
  send: (question: string, history: { role: "user" | "assistant"; content: string }[]) =>
    request<{ answer: string }>("/api/help/chat", {
      method: "POST",
      body: JSON.stringify({ question, history }),
    }),
};

// ── Manual page images (citations) ──────────────────────────────────────────
export const manualPageUrl = (manualId: string, page: number, token: string) =>
  `${API_BASE}/api/manuals/${manualId}/pages/${page}?token=${encodeURIComponent(token)}`;

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Machine {
  id: string;
  name: string;
  manufacturer?: string;
  model_number?: string;
  description?: string;
  owner_id: string;
  created_at: string;
  manual_count: number;
}

export interface Manual {
  id: string;
  machine_id: string;
  original_filename: string;
  file_size?: number;
  page_count?: number;
  language?: string;
  version?: string;
  status: "pending" | "processing" | "completed" | "error";
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  machine_id?: string;
  title?: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  created_at: string;
}

export interface Source {
  chunk_id: string;
  manual_id: string;
  page_start?: number;
  page_end?: number;
  section_title?: string;
  content_type?: string;
  score: number;
  excerpt: string;
}

export interface ChatResponse {
  message_id: string;
  answer: string;
  sources: Source[];
  confidence: "high" | "partial" | "none";
  chunks_used: number;
}
