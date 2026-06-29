import { KnowledgeFile, ChatSession, Message, UserSettings, User } from "../types";

const getHeaders = (username: string) => {
  return {
    "Content-Type": "application/json",
    "x-user": username || "alex",
  };
};

export const api = {
  async login(username: string, password?: string): Promise<User> {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error("Login failed");
    return res.json();
  },

  async signup(username: string, password?: string): Promise<{ success: boolean; username: string }> {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "Signup failed");
    }
    return res.json();
  },

  async getFiles(username: string): Promise<KnowledgeFile[]> {
    const res = await fetch("/api/files", {
      headers: getHeaders(username),
    });
    if (!res.ok) throw new Error("Failed to load files");
    return res.json();
  },

  async uploadFile(username: string, file: { name: string; size: string; type: string; contentBase64?: string }): Promise<KnowledgeFile> {
    console.log("API uploading file to middleware:", file.name, { size: file.size, type: file.type, hasContent: !!file.contentBase64 });
    const res = await fetch("/api/files/upload", {
      method: "POST",
      headers: getHeaders(username),
      body: JSON.stringify(file),
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error("Upload failed with status", res.status, errorText);
      throw new Error("Failed to upload file");
    }
    return res.json();
  },

  async deleteFile(username: string, id: string): Promise<boolean> {
    const res = await fetch(`/api/files/${id}`, {
      method: "DELETE",
      headers: getHeaders(username),
    });
    if (!res.ok) throw new Error("Failed to delete file");
    return true;
  },

  async getSettings(username: string): Promise<UserSettings> {
    const res = await fetch("/api/settings", {
      headers: getHeaders(username),
    });
    if (!res.ok) throw new Error("Failed to get settings");
    return res.json();
  },

  async saveSettings(username: string, settings: Partial<UserSettings>): Promise<UserSettings> {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: getHeaders(username),
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error("Failed to update settings");
    return res.json();
  },

  async clearUploads(username: string): Promise<{ success: boolean }> {
    const res = await fetch("/api/files/clear", {
      method: "POST",
      headers: getHeaders(username),
    });
    if (!res.ok) throw new Error("Failed to clear uploaded files");
    return res.json();
  },

  async getSessions(username: string): Promise<ChatSession[]> {
    const res = await fetch("/api/sessions", {
      headers: getHeaders(username),
    });
    if (!res.ok) throw new Error("Failed to download active sessions");
    return res.json();
  },

  async getMessages(username: string, sessionId: string): Promise<Message[]> {
    const res = await fetch(`/api/sessions/${sessionId}/messages`, {
      headers: getHeaders(username),
    });
    if (!res.ok) throw new Error("Failed to fetch messages for session");
    return res.json();
  },

  async clearHistory(username: string): Promise<ChatSession[]> {
    const res = await fetch("/api/sessions/clear", {
      method: "POST",
      headers: getHeaders(username),
    });
    if (!res.ok) throw new Error("Failed to clear research session history");
    return res.json();
  },

  async sendMessage(
    username: string,
    payload: { question: string; sessionId: string; activeLlm: "gemini" | "local"; workspaceFiles: KnowledgeFile[]; precomputedResponse?: string; removeResearchMode?: boolean }
  ): Promise<{ response: string; sessionTitle: string; messages: Message[]; error?: string }> {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: getHeaders(username),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to deliver network query content");
    return res.json();
  },

  async createSession(username: string): Promise<ChatSession> {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: getHeaders(username),
    });
    if (!res.ok) throw new Error("Failed to create new session");
    return res.json();
  },

  async deleteSession(username: string, sessionId: string): Promise<{ success: boolean; sessions: ChatSession[] }> {
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: "DELETE",
      headers: getHeaders(username),
    });
    if (!res.ok) throw new Error("Failed to delete session");
    return res.json();
  }
};
