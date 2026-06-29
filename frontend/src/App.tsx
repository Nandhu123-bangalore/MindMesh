import React, { useState, useEffect, useRef } from 'react';
import { api } from './services/api';
import { ChatSession, KnowledgeFile, Message, User, UserSettings } from './types';
import Sidebar from './components/Sidebar';
import ChatPage from './pages/Chat';
import KnowledgeBasePage from './pages/KnowledgeBase';
import SettingsPage from './pages/Settings';
import InsightsPage from './pages/InsightsPage';
import Loader from './components/Loader';
import { Menu, Sparkles, BookOpen, User as UserIcon, LogIn, HelpCircle } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>({ username: 'nandhitha' });
  const [loginInput, setLoginInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [settings, setSettings] = useState<UserSettings>({
    activeLlm: 'local',
    activeConnections: [],
    fontSize: 'small'
  });

  const [currentPage, setCurrentPage] = useState<'chat' | 'knowledge' | 'settings' | 'insights'>('chat');
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Check local storage for persistent login
  useEffect(() => {
    const savedUser = localStorage.getItem('mindmesh_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // When user is authenticated, download corresponding workspace datasets
  useEffect(() => {
    if (!user) return;

    const loadWorkspaceData = async () => {
      try {
        // Fetch files, settings, sessions
            const fetchedFiles = await api.getFiles(user.username);
        setFiles(fetchedFiles);

        const fetchedSettings = await api.getSettings(user.username);
        const validConnections = fetchedSettings.activeConnections.filter((id) => fetchedFiles.some((file) => file.id === id));
        if (validConnections.length !== fetchedSettings.activeConnections.length) {
          const updatedSettings = { ...fetchedSettings, activeConnections: validConnections };
          await api.saveSettings(user.username, updatedSettings);
          setSettings(updatedSettings);
        } else {
          setSettings(fetchedSettings);
        }

        const fetchedSessions = await api.getSessions(user.username);
        setSessions(fetchedSessions);

        if (fetchedSessions.length > 0) {
          const firstSessionId = fetchedSessions[0].id;
          setSelectedSessionId(firstSessionId);
          
          setIsLoadingMessages(true);
          const firstMsgs = await api.getMessages(user.username, firstSessionId);
          setMessages(firstMsgs);
          setIsLoadingMessages(false);
        } else {
          // pre-seed clear session description
          setMessages([]);
        }
      } catch (err) {
        console.error("Failed to load user workspace data:", err);
      }
    };

    loadWorkspaceData();
  }, [user]);

  const ignoreNextSessionLoadRef = useRef<boolean>(false);

  // Load messages whenever selected session ID changes
  useEffect(() => {
    if (!user || !selectedSessionId) return;

    if (ignoreNextSessionLoadRef.current) {
      ignoreNextSessionLoadRef.current = false;
      return;
    }

    const loadMessagesOfSession = async () => {
      try {
        setIsLoadingMessages(true);
        const msgs = await api.getMessages(user.username, selectedSessionId);
        setMessages(msgs);
        setIsLoadingMessages(false);
      } catch (err) {
        console.error("Failed to load messages:", err);
        setIsLoadingMessages(false);
      }
    };

    loadMessagesOfSession();
  }, [selectedSessionId, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginInput.trim() || !passwordInput.trim()) {
      setAuthError("Both username and password are required.");
      return;
    }

    setAuthError(null);
    setAuthSuccess(null);
    try {
      const loggedUser = await api.login(loginInput.trim(), passwordInput.trim());
      setUser(loggedUser);
      localStorage.setItem('mindmesh_user', JSON.stringify(loggedUser));
    } catch (err: any) {
      setAuthError("Sign In failed. Invalid username or password.");
    }
  };

  const handleSignUp = async () => {
    if (!loginInput.trim() || !passwordInput.trim()) {
      setAuthError("Both username and password are required to Sign Up.");
      return;
    }

    setAuthError(null);
    setAuthSuccess(null);
    try {
      await api.signup(loginInput.trim(), passwordInput.trim());
      setAuthSuccess("Sign Up successful! Auto-logging in...");
      setTimeout(async () => {
        try {
          const loggedUser = await api.login(loginInput.trim(), passwordInput.trim());
          setUser(loggedUser);
          localStorage.setItem('mindmesh_user', JSON.stringify(loggedUser));
        } catch (e) {
          setAuthError("Sign Up OK but login failed. Please Sign In manually.");
        }
      }, 1200);
    } catch (err: any) {
      setAuthError(err.message || "Failed to Sign Up. Username may already be taken.");
    }
  };

  const handleLogout = async () => {
    if (!user) return;
    try {
      setIsLoadingMessages(true);
      // Clear sessions and reload fresh defaults/pre-seeded state
      const clearedSessions = await api.clearHistory(user.username);
      setSessions(clearedSessions);
      if (clearedSessions.length > 0) {
        setSelectedSessionId(clearedSessions[0].id);
        const msgs = await api.getMessages(user.username, clearedSessions[0].id);
        setMessages(msgs);
      } else {
        setSelectedSessionId('');
        setMessages([]);
      }
      // Reload fresh mock documents
      const fetchedFiles = await api.getFiles(user.username);
        setFiles(fetchedFiles);

        const fetchedSettings = await api.getSettings(user.username);
        const validConnections = fetchedSettings.activeConnections.filter((id) => fetchedFiles.some((file) => file.id === id));
        if (validConnections.length !== fetchedSettings.activeConnections.length) {
          const updatedSettings = { ...fetchedSettings, activeConnections: validConnections };
          await api.saveSettings(user.username, updatedSettings);
          setSettings(updatedSettings);
        } else {
          setSettings(fetchedSettings);
        }
      
      setCurrentPage('chat');
    } catch (err) {
      console.error("Failed to soft-reset workspace data:", err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Upload document
  const handleUploadFile = async (specs: { name: string; size: string; type: string; contentBase64?: string }) => {
    if (!user) return;
    try {
      const file = await api.uploadFile(user.username, specs);
      setFiles(prev => [...prev, file]);

      // Automatically connect the new uploaded file
      const updatedConnections = [...settings.activeConnections, file.id];
      const savedSettings = await api.saveSettings(user.username, { activeConnections: updatedConnections });
      setSettings(savedSettings);
    } catch (err) {
      console.error("Failed to upload file:", err);
    }
  };

  // Delete/De-index document (and ensure it doesn't reappear on reload!)
  const handleDeleteFile = async (id: string) => {
    if (!user) return;
    try {
      await api.deleteFile(user.username, id);
      setFiles(prev => prev.filter(f => f.id !== id));
      
      const updatedConnections = settings.activeConnections.filter(cid => cid !== id);
      const savedSettings = await api.saveSettings(user.username, { activeConnections: updatedConnections });
      setSettings(savedSettings);
    } catch (err) {
      console.error("Failed to delete file:", err);
    }
  };

  // Create individual chat sessions
  const handleCreateSession = async () => {
    if (!user) return;
    try {
      await api.clearUploads(user.username);
      const newSess = await api.createSession(user.username);
      setSessions(prev => [newSess, ...prev]);
      setSelectedSessionId(newSess.id);
      setMessages(newSess.messages || []);
      setFiles([]);
      setSettings(prev => ({ ...prev, activeConnections: [] }));
      setCurrentPage('chat');
    } catch (err) {
      console.error("Failed to create new session:", err);
    }
  };

  // Delete individual chat sessions
  const handleDeleteSession = async (sessionIdToDelete: string) => {
    if (!user) return;
    try {
      const result = await api.deleteSession(user.username, sessionIdToDelete);
      
      const currentSessions = await api.getSessions(user.username);
      setSessions(currentSessions);
      
      // If deleted session was selected, select the first remaining or reset
      if (selectedSessionId === sessionIdToDelete) {
        if (currentSessions.length > 0) {
          const nextId = currentSessions[0].id;
          setSelectedSessionId(nextId);
          const nextMsgs = await api.getMessages(user.username, nextId);
          setMessages(nextMsgs);
        } else {
          setSelectedSessionId('');
          setMessages([]);
        }
      }
    } catch (err) {
      console.error("Failed to delete chat session:", err);
    }
  };

  // Update Settings
  const handleSaveSettings = async (updatedSettings: Partial<UserSettings>) => {
    if (!user) return;
    try {
      const saved = await api.saveSettings(user.username, updatedSettings);
      setSettings(saved);
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  };

  // Reset conversation logs
  const handleClearHistory = async () => {
    if (!user) return;
    try {
      await api.clearUploads(user.username);
      const clearedSessions = await api.clearHistory(user.username);
      setSessions(clearedSessions);
      setFiles([]);
      setSettings(prev => ({ ...prev, activeConnections: [] }));
      if (clearedSessions.length > 0) {
        setSelectedSessionId(clearedSessions[0].id);
        setMessages(clearedSessions[0].messages || []);
      }
      setCurrentPage('chat');
    } catch (err) {
      console.error("Failed to clear chat logs:", err);
    }
  };

  // Send RAG chat query
  const handleSendMessage = async (text: string) => {
    if (!user || isSendingMessage) return;

    setIsSendingMessage(true);
    
    // Add user message immediately
    const tempUserMsg: Message = {
      id: "temp-user-" + Date.now(),
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const connectedFiles = files.filter(f => settings.activeConnections.includes(f.id));

      const chatResponse = await api.sendMessage(user.username, {
        question: text,
        sessionId: selectedSessionId,
        activeLlm: settings.activeLlm,
        workspaceFiles: connectedFiles,
        removeResearchMode: settings.removeResearchMode
      });

      // Update local state matching chatResponse messages payload
      setMessages(chatResponse.messages);

      // Reload sessions to update title updates dynamically!
      const currentSessions = await api.getSessions(user.username);
      setSessions(currentSessions);
      
      // If we had no session selected, select the top one
      const match = currentSessions.find(s => s.title === chatResponse.sessionTitle);
      if (match) {
        if (selectedSessionId !== match.id) {
          ignoreNextSessionLoadRef.current = true;
          setSelectedSessionId(match.id);
        }
      } else if (currentSessions.length > 0 && !selectedSessionId) {
        ignoreNextSessionLoadRef.current = true;
        setSelectedSessionId(currentSessions[0].id);
      }
    } catch (err) {
      console.error("Send message error:", err);
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Loading indicator for background sync updates
  const isLoadingSessionDetail = isLoadingMessages && messages.length === 0;

  return (
    <div className="min-h-screen bg-[#09090b] text-on-surface flex flex-col overflow-hidden h-screen selection:bg-indigo-500/25">
      {/* Mobile AppBar */}
      <header className="md:hidden flex items-center justify-between px-md h-16 border-b border-zinc-800 bg-[#0c0c0e]/90 shrink-0 relative z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-indigo-400 hover:bg-slate-800/40 rounded-lg"
            title="Open navigation drawers"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-tight text-white">MindMesh</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Nav shortcut links */}
          <button
            onClick={() => setCurrentPage('chat')}
            className={`p-1.5 rounded-lg text-xs font-mono uppercase tracking-wider font-semibold ${
              currentPage === 'chat' ? 'text-primary bg-primary/10' : 'text-on-surface-variant'
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setCurrentPage('knowledge')}
            className={`p-1.5 rounded-lg text-xs font-mono uppercase tracking-wider font-semibold ${
              currentPage === 'knowledge' ? 'text-primary bg-primary/10' : 'text-on-surface-variant'
            }`}
          >
            Docs
          </button>
        </div>
      </header>

      {/* Main Workspace Frame container */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar Navigation Drawer */}
        <div className="hidden md:block">
          <Sidebar
            user={user}
            sessions={sessions}
            selectedSessionId={selectedSessionId}
            onSelectSession={setSelectedSessionId}
            currentPage={currentPage}
            onChangePage={(p) => {
              setCurrentPage(p);
              setIsSidebarOpen(false);
            }}
            onLogout={handleLogout}
            onCreateSession={handleCreateSession}
            onDeleteSession={handleDeleteSession}
          />
        </div>

        {/* Mobile Swipe out Drawer Overlay */}
        {isSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            {/* Click-out backdrop */}
            <div
              className="absolute inset-0 bg-black/60 transition-opacity"
              onClick={() => setIsSidebarOpen(false)}
            />
            {/* Drawer body */}
            <div className="relative flex flex-col w-[240px] bg-[#0c0c0e] h-full shadow-2xl transition-transform animate-slide-in">
              <Sidebar
                user={user}
                sessions={sessions}
                selectedSessionId={selectedSessionId}
                onSelectSession={setSelectedSessionId}
                currentPage={currentPage}
                onChangePage={(p) => {
                  setCurrentPage(p);
                  setIsSidebarOpen(false);
                }}
                onLogout={handleLogout}
                onCreateSession={handleCreateSession}
                onDeleteSession={handleDeleteSession}
              />
            </div>
          </div>
        )}

        {/* Content Page Switch Router Frame */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative h-full">
          {isLoadingSessionDetail ? (
            <div className="flex-1 flex items-center justify-center p-md">
              <Loader label="Downloading neural index caches..." />
            </div>
          ) : (
            <>
              {currentPage === 'chat' && (
                <ChatPage
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  isLoading={isSendingMessage}
                  activeLlm={settings.activeLlm}
                  workspaceFiles={files}
                  fontSize={settings.fontSize}
                  removeResearchMode={settings.removeResearchMode || false}
                  onToggleResearchMode={(val) => handleSaveSettings({ removeResearchMode: val })}
                  onUploadFile={handleUploadFile}
                />
              )}

              {currentPage === 'knowledge' && (
                <KnowledgeBasePage
                  files={files}
                  onUploadFile={handleUploadFile}
                  onDeleteFile={handleDeleteFile}
                  fontSize={settings.fontSize}
                />
              )}

              {currentPage === 'settings' && (
                <SettingsPage
                  settings={settings}
                  files={files}
                  onSaveSettings={handleSaveSettings}
                  onClearHistory={handleClearHistory}
                  currentSessionMessages={messages}
                  fontSize={settings.fontSize}
                />
              )}

              {currentPage === 'insights' && (
                <InsightsPage fontSize={settings.fontSize} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
