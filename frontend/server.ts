import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// In-Memory Database structure (which gets persisted to disk to handle dev server restarts elegantly)
interface DBUser {
  username: string;
  files: Array<{
    id: string;
    name: string;
    size: string;
    type: string;
    uploadDate: string;
    status: 'Indexed' | 'Indexing';
  }>;
  sessions: Array<{
    id: string;
    title: string;
    createdAt: string;
    messages: Array<{
      id: string;
      role: 'user' | 'assistant';
      text: string;
      timestamp: string;
      sources?: string[];
      suggestions?: string[];
      route?: string;
      routingReason?: string;
    }>;
  }>;
  settings: {
    activeLlm: 'gemini' | 'local';
    activeConnections: string[];
    fontSize: 'small' | 'medium' | 'large';
    removeResearchMode?: boolean;
  };
}

const DB_FILE_PATH = path.join(process.cwd(), "user_persistent_db.json");

interface PersistentStore {
  passwordsDb: Record<string, string>;
  db: Record<string, DBUser>;
}

// Default initial state
const defaultStore: PersistentStore = {
  passwordsDb: {
    "alex": "password123",
    "nandhitha": "password123",
    "researcher": "password123"
  },
  db: {
    "alex": {
      username: "alex",
      files: [
        { id: "1", name: "attention_is_all_you_need.pdf", size: "2.4 MB", type: "PDF", uploadDate: "Oct 24, 2023", status: "Indexed" },
        { id: "2", name: "dataset_documentation.docx", size: "156 KB", type: "DOCX", uploadDate: "Nov 02, 2023", status: "Indexed" },
        { id: "3", name: "hyperparameter_tuning_log.txt", size: "45 KB", type: "TXT", uploadDate: "Nov 15, 2023", status: "Indexed" },
      ],
      sessions: [
        {
          id: "s1",
          title: "General Workspace Q&A",
          createdAt: "2026-06-22T09:42:00Z",
          messages: [
            {
              id: "m2",
              role: "assistant",
              text: "Hello! What are we talking about today?",
              timestamp: "10:43 AM",
              suggestions: ["What is dynamic programming?", "Explain SQL joins with examples"],
            }
          ]
        }
      ],
      settings: {
        activeLlm: "gemini",
        activeConnections: ["1", "2"],
        fontSize: "small"
      }
    }
  }
};

let storeState: PersistentStore = { ...defaultStore };

function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE_PATH, "utf-8"));
      if (parsed.passwordsDb && parsed.db) {
        storeState = parsed;
        // Make sure "nandhitha" and "researcher" are always populated as fallbacks just in case
        if (!storeState.passwordsDb["nandhitha"]) storeState.passwordsDb["nandhitha"] = "password123";
        if (!storeState.passwordsDb["researcher"]) storeState.passwordsDb["researcher"] = "password123";
        if (!storeState.passwordsDb["alex"]) storeState.passwordsDb["alex"] = "password123";
      }
    } else {
      saveDatabase();
    }
  } catch (error) {
    console.error("Error reading db file, resetting to defaults:", error);
    saveDatabase();
  }
}

function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(storeState, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing persistent DB file:", error);
  }
}

// Load initially
loadDatabase();

// Keep local references for older compatibility but point them dynamically to the store state
const passwordsDb = storeState.passwordsDb;
const db = storeState.db;

// Middleware to automatically persist the DB state on any mutating requests
app.use((req, res, next) => {
  res.on("finish", () => {
    if (["POST", "PUT", "DELETE"].includes(req.method)) {
      saveDatabase();
    }
  });
  next();
});

const defaultSettings = {
  activeLlm: "local" as const,
  activeConnections: [] as string[],
  fontSize: "medium" as const,
  removeResearchMode: false as boolean
};

function getOrCreateUser(username: string): DBUser {
  const norm = username.toLowerCase().trim();
  if (!db[norm]) {
    db[norm] = {
      username: norm,
      files: [
        { id: "f1", name: "Sample_Neural_Networks.txt", size: "12 KB", type: "TXT", uploadDate: "Today", status: "Indexed" }
      ],
      sessions: [
        {
          id: "init-session",
          title: "New AI Chat Session",
          createdAt: new Date().toISOString(),
          messages: [
            {
              id: "init-m1",
              role: "assistant",
              text: "Hello! What are we talking about today?",
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              suggestions: ["What is dynamic programming?", "Explain SQL joins with examples"]
            }
          ]
        }
      ],
      settings: { ...defaultSettings }
    };
    saveDatabase();
  }
  return db[norm];
}

// Lazy Gemini API initialization
let aiClient: any = null;
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not defined");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}


// API: Auth
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }
  const norm = username.toLowerCase().trim();
  const storedPassword = passwordsDb[norm];

  if (!storedPassword) {
    return res.status(401).json({ error: "User not found, please sign up or check credentials" });
  }

  if (password !== storedPassword) {
    return res.status(401).json({ error: "Invalid password" });
  }

  const user = getOrCreateUser(norm);
  res.json({
    username: user.username,
    profilePic: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.username)}`
  });
});

app.post("/api/auth/signup", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }
  const norm = username.toLowerCase().trim();
  if (passwordsDb[norm]) {
    return res.status(400).json({ error: "User already exists. Please sign in." });
  }

  // Save registration
  passwordsDb[norm] = password;
  // Initialize user
  getOrCreateUser(norm);
  saveDatabase();

  res.json({ success: true, username: norm });
});

// API: Files Get
app.get("/api/files", (req, res) => {
  const username = (req.headers["x-user"] as string) || "alex";
  const user = getOrCreateUser(username);
  res.json(user.files);
});

// API: Files Upload (Mock/Simulate)
app.post("/api/files/upload", async (req, res) => {
  const username = (req.headers["x-user"] as string) || "alex";
  const { name, size, type, contentBase64 } = req.body;
  if (!name) {
    return res.status(400).json({ error: "File name is required" });
  }

  console.log(`Express upload received: ${name} (${type || 'unknown'}) for user ${username}`);
  console.log(`Express upload content length: ${contentBase64 ? contentBase64.length : 0}`);
  
  // Forward to python backend if contentBase64 is provided
  if (contentBase64) {
    try {
      const pythonRes = await fetch("http://localhost:8000/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contentBase64 })
      });
      const pythonText = await pythonRes.text();
      console.log(`Forwarded upload to Python backend: ${name} status=${pythonRes.status} body=${pythonText}`);
      if (!pythonRes.ok) {
        console.warn("Failed to forward file to Python backend", pythonText);
        return res.status(502).json({ error: "Python backend upload failed", detail: pythonText });
      }
    } catch (err) {
      console.error("Could not reach Python backend for file upload:", err);
      return res.status(502).json({ error: "Could not reach Python backend for file upload", detail: String(err) });
    }
  }

  const user = getOrCreateUser(username);
  const newFile = {
    id: Date.now().toString(),
    name,
    size: size || "1.2 MB",
    type: type || name.split('.').pop()?.toUpperCase() || "PDF",
    uploadDate: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    status: 'Indexed' as const
  };
  user.files.push(newFile);
  saveDatabase();
  res.json(newFile);
});

// API: Clear file uploads and reset file state
app.post("/api/files/clear", async (req, res) => {
  const username = (req.headers["x-user"] as string) || "alex";
  const user = getOrCreateUser(username);
  user.files = [];
  user.settings.activeConnections = [];
  try {
    const pythonRes = await fetch("http://localhost:8000/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!pythonRes.ok) {
      console.warn("Python backend clear failed:", await pythonRes.text());
    }
  } catch (err) {
    console.warn("Could not reach Python backend to clear persisted upload storage:", err);
  }
  saveDatabase();
  res.json({ success: true });
});

// API: Files Drop / Delete
app.delete("/api/files/:id", (req, res) => {
  const username = (req.headers["x-user"] as string) || "alex";
  const { id } = req.params;
  const user = getOrCreateUser(username);
  const initialLen = user.files.length;
  user.files = user.files.filter(f => f.id !== id);
  user.settings.activeConnections = user.settings.activeConnections.filter(cid => cid !== id);
  saveDatabase();
  if (user.files.length === initialLen) {
    return res.status(404).json({ error: "File not found" });
  }
  res.json({ success: true, files: user.files });
});

// API: Settings Get
app.get("/api/settings", (req, res) => {
  const username = (req.headers["x-user"] as string) || "alex";
  const user = getOrCreateUser(username);
  res.json(user.settings);
});

// API: Settings Post
app.post("/api/settings", (req, res) => {
  const username = (req.headers["x-user"] as string) || "alex";
  const { activeLlm, activeConnections, fontSize, removeResearchMode } = req.body;
  const user = getOrCreateUser(username);
  if (activeLlm) user.settings.activeLlm = activeLlm;
  if (activeConnections) user.settings.activeConnections = activeConnections;
  if (fontSize) user.settings.fontSize = fontSize;
  if (removeResearchMode !== undefined) user.settings.removeResearchMode = removeResearchMode;
  saveDatabase();
  res.json(user.settings);
});

// API: Sessions list
app.get("/api/sessions", (req, res) => {
  const username = (req.headers["x-user"] as string) || "alex";
  const user = getOrCreateUser(username);
  res.json(user.sessions.map(({ id, title, createdAt }) => ({ id, title, createdAt })));
});

// API: Create new session
app.post("/api/sessions", (req, res) => {
  const username = (req.headers["x-user"] as string) || "alex";
  const user = getOrCreateUser(username);
  const newSession = {
    id: "session-" + Date.now(),
    title: "New AI Chat Session",
    createdAt: new Date().toISOString(),
    messages: [
      {
        id: "init-m-" + Date.now(),
        role: "assistant" as const,
        text: "Hello! What are we talking about today?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestions: ["What is dynamic programming?", "Explain SQL joins with examples"]
      }
    ]
  };
  user.sessions.unshift(newSession);
  saveDatabase();
  res.json(newSession);
});

// API: Delete single session
app.delete("/api/sessions/:id", (req, res) => {
  const username = (req.headers["x-user"] as string) || "alex";
  const { id } = req.params;
  const user = getOrCreateUser(username);
  user.sessions = user.sessions.filter(s => s.id !== id);
  if (user.sessions.length === 0) {
    user.sessions.push({
      id: "session-" + Date.now(),
      title: "New AI Chat Session",
      createdAt: new Date().toISOString(),
      messages: [
        {
          id: "init-m-" + Date.now(),
          role: "assistant" as const,
          text: "Hello! What are we talking about today?",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestions: ["What is dynamic programming?", "Explain SQL joins with examples"]
        }
      ]
    });
  }
  saveDatabase();
  res.json({ success: true, sessions: user.sessions.map(({ id, title, createdAt }) => ({ id, title, createdAt })) });
});

// API: Session detail
app.get("/api/sessions/:id/messages", (req, res) => {
  const username = (req.headers["x-user"] as string) || "alex";
  const { id } = req.params;
  const user = getOrCreateUser(username);
  const session = user.sessions.find(s => s.id === id);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }
  res.json(session.messages);
});

// API: Clear Session / Delete Session
app.post("/api/sessions/clear", (req, res) => {
  const username = (req.headers["x-user"] as string) || "alex";
  const user = getOrCreateUser(username);
  user.sessions = [
    {
      id: "s-empty-" + Date.now(),
      title: "New Chat Conversation",
      createdAt: new Date().toISOString(),
      messages: [
        {
          id: "m-empty",
          role: "assistant",
          text: "All previous history cleared. What are we talking about today?",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestions: ["What is dynamic programming?", "Explain SQL joins with examples"]
        }
      ]
    }
  ];
  saveDatabase();
  res.json(user.sessions);
});

// Main endpoint for Chat RAG answering
app.post("/api/chat", async (req, res) => {
  const username = (req.headers["x-user"] as string) || "alex";
  const { question, sessionId, activeLlm, workspaceFiles, precomputedResponse, removeResearchMode } = req.body;

  if (!question) {
    return res.status(400).json({ error: "Question is required" });
  }

  const user = getOrCreateUser(username);
  let session = user.sessions.find(s => s.id === sessionId);
  if (!session) {
    session = {
      id: sessionId || "session-" + Date.now(),
      title: question.length > 25 ? question.slice(0, 25) + "..." : question,
      createdAt: new Date().toISOString(),
      messages: []
    };
    user.sessions.unshift(session);
  }

  // Update session title automatically if it was just created/default
  if (session.messages.length === 0 || session.title.startsWith("New AI Chat Session") || session.title.startsWith("New Research Conversation")) {
    session.title = question.length > 25 ? question.slice(0, 25) + "..." : question;
  }

  // Add User Message
  const userMsg = {
    id: "umsg-" + Date.now(),
    role: "user" as const,
    text: question,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
  session.messages.push(userMsg);



  // If local backend is selected (Local Python RAG Pipeline with agentic routing)
  if (activeLlm === "local") {
    try {
      const activeFileNames = (workspaceFiles || [])
        .filter((f: any) => user.settings.activeConnections.includes(f.id))
        .map((f: any) => f.name);

      const response = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, activeFiles: activeFileNames })
      });
      if (!response.ok) {
        throw new Error(`Python server returned status ${response.status}`);
      }
      const data: any = await response.json();
      
      const responseText = data.response || "No response received from Local Backend.";
      const assistantMsg = {
        id: "amsg-" + Date.now(),
        role: "assistant" as const,
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        route: data.route,
        routingReason: data.routingReason,
        sources: data.sources || [],
        suggestions: [
          `Further explain: ${question.slice(0, 30)}`,
          "Show a python code example"
        ]
      };
      session.messages.push(assistantMsg);
      return res.json({
        response: responseText,
        route: data.route,
        sessionTitle: session.title,
        messages: session.messages
      });
    } catch (err: any) {
      // Local Backend is selected but python backend is either not running or offline!
      console.error("Local Python backend request failed:", err.message);
      const errText = `⚠️ **Local RAG Backend Offline**: Could not connect to the Python backend running at \`http://localhost:8000/chat\`.
      
Please ensure your local Python RAG server is running with the following code:
\`\`\`python
# run on http://localhost:8000
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class ChatRequest(BaseModel):
    question: str

@app.post("/chat")
def chat(req: ChatRequest):
    return {"response": f"Your RAG response to: {req.question}"}
\`\`\``;
      
      const assistantMsg = {
        id: "amsg-err-" + Date.now(),
        role: "assistant" as const,
        text: errText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      session.messages.push(assistantMsg);
      return res.json({ response: errText, error: "Python Backend offline", sessionTitle: session.title, messages: session.messages });
    }
  }

  // Otherwise, use real Gemini API server-side
  try {
    const ai = getGeminiClient();
    
    // Read optional files context to customize the prompt
    let contextStr = "";
    if (workspaceFiles && workspaceFiles.length > 0) {
      contextStr = `\nContextual Knowledge Base (RAG Active Sources):\n` +
        workspaceFiles.map((f: any) => `- File: ${f.name} (type: ${f.type})`).join("\n") +
        `\nUtilize appropriate professional technical documentation standards. Please ground references in these files.`;
    }

    const activeResearchModeVal = removeResearchMode !== undefined ? removeResearchMode : !!(user.settings && user.settings.removeResearchMode);

    let systemInstruction = "";
    if (activeResearchModeVal) {
      systemInstruction = `You are ML Mentor, a direct assistant.
You have access to RAG knowledge sources.

CRITICAL PRECISION MANDATE:
- Provide highly precise, extremely compact, and very short direct answers.
- Answer ONLY exactly what the user asked. NEVER output extra, redundant, conversational, or unsolicited background information.
- Cut any preambles ("Sure, here is...", "Okay, I can explain...") and postambles. Jump directly into the exact answer.
- Keep the response extremely to-the-point. If a mathematical formula or a single sentence answers the question, output only that. Never write multi-paragraph lectures or general history segments unless the user explicitly requested a comprehensive essay.
- If the user asks for a code snippet, return ONLY the code block with minimal comments.
- If a query can be answered in one sentence, answer it in one sentence. Avoid unsolicited deep-dives.

Provide 2 logical follow-up contextual questions/suggestions as a separate line at the end in the exact format:
[SUGGESTIONS]: "First follow-up question?", "Second follow-up question?"`;
    } else {
      systemInstruction = `You are ML Mentor (Research Core), an expert AI and Machine Learning assistant designed to guide graduate-level ML researches.
You have access to RAG knowledge sources.

CRITICAL PRECISION MANDATE:
- Provide highly precise, crisp, and dense answers.
- Answer ONLY exactly what the user asked. NEVER output extra, redundant, conversational, or unsolicited background information.
- Cut any preambles ("Sure, here is...", "Okay, I can explain...") and postambles. Jump directly into the exact answer.
- If the user asks for a code snippet, return ONLY the code block with minimal comments.
- If a query can be answered in one sentence, answer it in one sentence. Avoid unsolicited deep-dives.

Always include beautiful code snippets in Python, Torch, or JS where helpful. Highlight equations using LaTeX notation $equation$ or bold terms where appropriate.
Provide 2 logical follow-up contextual questions/suggestions as a separate line at the end in the exact format:
[SUGGESTIONS]: "First follow-up question?", "Second follow-up question?"`;
    }

    const modelsToTry = [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-3.5-flash"
    ];

    let chatResponse: any = null;
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`[Gemini] Attempting generateContent with model: ${modelName}`);
        chatResponse = await ai.models.generateContent({
          model: modelName,
          contents: `${contextStr}\n\nQuestion: ${question}`,
          config: {
            systemInstruction,
            temperature: 0.2,
          }
        });
        if (chatResponse) {
          console.log(`[Gemini] Successfully generated content using model: ${modelName}`);
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini] Model ${modelName} failed. Error:`, err.message || err);
      }
    }

    if (!chatResponse) {
      throw lastError || new Error("All Gemini models failed to generate content.");
    }

    let text = chatResponse.text || "I was unable to synthesize a proper response.";
    
    // Extract suggestions from response if present
    let suggestions: string[] = [
      "Can you provide a PyTorch code block?",
      "How do we optimize hyperparameters for this?"
    ];
    
    const suggIndex = text.indexOf("[SUGGESTIONS]:");
    if (suggIndex !== -1) {
      const suggSegment = text.slice(suggIndex);
      text = text.slice(0, suggIndex).trim();
      const match = suggSegment.match(/"([^"]+)"/g);
      if (match) {
        suggestions = match.map(s => s.replace(/"/g, ''));
      }
    }

    const assistantMsg = {
      id: "amsg-" + Date.now(),
      role: "assistant" as const,
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestions
    };

    session.messages.push(assistantMsg);
    res.json({ response: text, sessionTitle: session.title, messages: session.messages });
  } catch (err: any) {
    console.error("Gemini GenAI Error:", err);
    const errMsg = `⚠️ **Gemini API Error**: ${err.message}. Ensure your \`GEMINI_API_KEY\` is configured in AI Studio Secrets section.`;
    const assistantMsg = {
      id: "amsg-err-" + Date.now(),
      role: "assistant" as const,
      text: errMsg,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    session.messages.push(assistantMsg);
    res.json({ response: errMsg, error: err.message, sessionTitle: session.title, messages: session.messages });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
