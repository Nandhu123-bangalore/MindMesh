import React from 'react';
import { UserSettings, KnowledgeFile, ChatSession } from '../types';
import { Save, AlertTriangle, Download, Trash2, Cpu, Settings as SettingsIcon, Sliders, Type, HelpCircle, HardDrive } from 'lucide-react';

interface SettingsProps {
  settings: UserSettings;
  files: KnowledgeFile[];
  onSaveSettings: (settings: Partial<UserSettings>) => void;
  onClearHistory: () => void;
  currentSessionMessages: any[];
  fontSize: 'small' | 'medium' | 'large';
}

export default function Settings({
  settings,
  files,
  onSaveSettings,
  onClearHistory,
  currentSessionMessages,
  fontSize
}: SettingsProps) {

  const handleLlmChange = (llm: 'gemini' | 'local') => {
    onSaveSettings({ activeLlm: llm });
  };

  const handleFontSizeChange = (size: 'small' | 'medium' | 'large') => {
    onSaveSettings({ fontSize: size });
  };

  const handleToggleConnection = (fileId: string) => {
    const current = [...settings.activeConnections];
    if (current.includes(fileId)) {
      onSaveSettings({ activeConnections: current.filter(id => id !== fileId) });
    } else {
      onSaveSettings({ activeConnections: [...current, fileId] });
    }
  };

  // 'Download Chat' export feature in Markdown and JSON formats
  const downloadChatAsJson = () => {
    if (currentSessionMessages.length === 0) {
      alert("No messages to download in current active session.");
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentSessionMessages, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `chat_history_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const downloadChatAsMarkdown = () => {
    if (currentSessionMessages.length === 0) {
      alert("No messages to download in current active session.");
      return;
    }

    let markdown = `# MindMesh AI Chat Conversation History\n*Export Date: ${new Date().toLocaleDateString()}*\n\n---\n\n`;
    currentSessionMessages.forEach((msg) => {
      const roleName = msg.role === 'user' ? '🧑‍💻 User' : '🤖 ML Mentor Assistant';
      markdown += `### ${roleName} (${msg.timestamp})\n${msg.text}\n\n`;
      if (msg.sources && msg.sources.length > 0) {
        markdown += `*Sources: ${msg.sources.join(', ')}*\n\n`;
      }
      markdown += `---\n\n`;
    });

    const dataStr = "data:text/markdown;charset=utf-8," + encodeURIComponent(markdown);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `chat_history_${Date.now()}.md`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 bg-[#09090b] h-full custom-scrollbar selection:bg-indigo-500/25 select-text pb-24">
      <div className="max-w-3xl mx-auto space-y-6 font-sans">
        
        {/* Title */}
        <div>
          <h2 className="text-lg md:text-xl font-bold text-slate-100 tracking-tight">Workspace Settings</h2>
          <p className="text-slate-400 text-xs mt-1">
            Configure active compiler targets and customized interface preferences.
          </p>
        </div>

        {/* Model info & Active LLM target selective pipeline */}
        <div className="p-5 rounded border border-zinc-800 bg-slate-900 space-y-4">
          <div className="flex items-center gap-2.5 text-indigo-400">
            <Cpu size={15} />
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold">LLM Execution Model Target</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Choose whether to proxy query requests directly through your local Django/Python RAG setup.
          </p>

          <div className="space-y-4 pt-1">
            <div
              onClick={() => handleLlmChange('local')}
              className={`p-4 rounded border transition-all cursor-pointer ${
                settings.activeLlm === 'local'
                  ? 'border-indigo-500 bg-indigo-500/5'
                  : 'border-zinc-800 bg-slate-950/40 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-200">Local Python RAG Pipeline</span>
                {settings.activeLlm === 'local' && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>}
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">Queries <code className="bg-zinc-950 px-1 text-indigo-400 rounded">http://localhost:8000/chat</code> recursively. Fits custom pipelines.</p>
            </div>
          </div>
        </div>

        {/* FONT SIZE CUSTOM OPTIONS CHECK */}
        <div className="p-5 rounded border border-zinc-800 bg-slate-900 space-y-4">
          <div className="flex items-center gap-2.5 text-indigo-400">
            <Type size={15} />
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold">Chat Workspace Font Size</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Adjust the typography weight and readability of our workspace components.
          </p>

          <div className="flex gap-2 pt-1">
            {(['small', 'medium', 'large'] as const).map(size => (
              <button
                key={size}
                onClick={() => handleFontSizeChange(size)}
                className={`flex-1 py-1.5 hover:text-white border transition-all cursor-pointer rounded text-[11px] font-mono uppercase font-bold ${
                  settings.fontSize === size
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                    : 'bg-slate-950 text-slate-400 border-zinc-800 hover:border-slate-500'
                }`}
              >
                {size}
              </button>
            ))}
          </div>

          <div className="space-y-2 pt-2 border-t border-zinc-850">
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>Decrease Size (A-)</span>
              <span>Increase Size (A+)</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="1"
              value={settings.fontSize === 'small' ? 0 : settings.fontSize === 'medium' ? 1 : 2}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                const sizeMap: ('small' | 'medium' | 'large')[] = ['small', 'medium', 'large'];
                handleFontSizeChange(sizeMap[val]);
              }}
              className="w-full accent-indigo-500 bg-slate-950 h-1.5 rounded cursor-pointer"
            />
          </div>
        </div>

        {/* DOWNLOAD & RESET ACTIONS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Download Chat Session utility */}
          <div className="p-4 rounded border border-zinc-800 bg-slate-900 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-slate-300">
                <Download size={14} />
                <span className="text-[11px] font-mono uppercase tracking-wider font-bold">Offline Backup Tool</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Export and download active conversation histories as formatted Markdown (.md) or parsed JSON data chunks for future reference.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={downloadChatAsMarkdown}
                className="flex-1 py-1.5 px-2 bg-indigo-500/10 hover:bg-indigo-550 border border-indigo-500/30 text-indigo-400 hover:text-white rounded text-[10px] uppercase tracking-wider font-bold transition-all cursor-pointer active:scale-95"
              >
                Markdown
              </button>
              <button
                onClick={downloadChatAsJson}
                className="flex-1 py-1.5 px-2 bg-indigo-500/10 hover:bg-indigo-550 border border-indigo-500/30 text-indigo-400 hover:text-white rounded text-[10px] uppercase tracking-wider font-bold transition-all cursor-pointer active:scale-95"
              >
                JSON Data
              </button>
            </div>
          </div>

          {/* Reset discussion logs */}
          <div className="p-4 rounded border border-zinc-800 bg-slate-900 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-rose-400">
                <Trash2 size={14} />
                <span className="text-[11px] font-mono uppercase tracking-wider font-bold">Clear History Logs</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Destructively clear all current conversation files, thread databases, and research history. This operation is irreversible.
              </p>
            </div>
            <button
              onClick={() => {
                if (confirm("Are you sure you want to clear your current conversation history? This is irreversible.")) {
                  onClearHistory();
                }
              }}
              className="w-full py-1.5 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500 text-rose-400 hover:text-white rounded text-[10px] uppercase tracking-wider font-bold transition-all cursor-pointer active:scale-95"
            >
              Flush History
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
