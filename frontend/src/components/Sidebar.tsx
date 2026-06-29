import React, { useState } from 'react';
import { ChatSession, User } from '../types';
import { 
  Search, MessageSquare, Library, RotateCcw,
  Settings as SettingsIcon, Database, Plus, Trash2, Sparkles,
  User as UserIcon, BarChart2
} from 'lucide-react';

interface SidebarProps {
  user: User | null;
  sessions: ChatSession[];
  selectedSessionId: string;
  onSelectSession: (id: string) => void;
  currentPage: 'chat' | 'knowledge' | 'settings' | 'insights';
  onChangePage: (page: 'chat' | 'knowledge' | 'settings' | 'insights') => void;
  onLogout: () => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
}

export default function Sidebar({
  user,
  sessions,
  selectedSessionId,
  onSelectSession,
  currentPage,
  onChangePage,
  onLogout,
  onCreateSession,
  onDeleteSession
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filtering chat sessions by keyword
  const filteredSessions = sessions.filter(session => {
    return session.title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <aside className="w-[240px] bg-[#0c0c0e] border-r border-zinc-900 flex flex-col py-5 shrink-0 h-full relative font-sans select-none">
      {/* Brand Header */}
      <div className="px-5 pb-5 border-b border-zinc-900">
        <div className="flex items-center gap-3">
          {/* Custom SVG logo: Brain on left, network nodes on right */}
          <svg className="w-8 h-8 rounded-full shrink-0 shadow-lg shadow-indigo-500/10" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="meshGradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="60%" stopColor="#4f46e5" />
                <stop offset="100%" stopColor="#0c0a21" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="46" fill="url(#meshGradient)" stroke="#4338ca" strokeWidth="2.5" />
            
            {/* Brain Left half */}
            <path d="M48 26 C39 26, 31 31, 29 42 C27 49, 32 57, 30 63 C28 69, 37 74, 45 74 C47 74, 48 69, 48 63" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" />
            <path d="M48 36 C42 36, 37 39, 37 45 C37 49, 42 51, 43 56 C44 60, 41 64, 48 66" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
            
            {/* Network right half nodes */}
            <circle cx="66" cy="36" r="4.5" fill="#67e8f9" />
            <circle cx="77" cy="48" r="4.5" fill="#a5b4fc" />
            <circle cx="67" cy="63" r="4.5" fill="#67e8f9" />
            <circle cx="54" cy="50" r="3.5" fill="#ffffff" />
            
            {/* Connecting pathways */}
            <line x1="54" y1="50" x2="66" y2="36" stroke="#ffffff" strokeWidth="2" opacity="0.6" />
            <line x1="54" y1="50" x2="77" y2="48" stroke="#ffffff" strokeWidth="2" opacity="0.6" />
            <line x1="54" y1="50" x2="67" y2="63" stroke="#ffffff" strokeWidth="2" opacity="0.6" />
            <line x1="66" y1="36" x2="77" y2="48" stroke="#67e8f9" strokeWidth="1.5" opacity="0.7" />
            <line x1="67" y1="63" x2="77" y2="48" stroke="#a5b4fc" strokeWidth="1.5" opacity="0.7" />
          </svg>
          
          <div className="flex flex-col leading-none">
            <span className="font-semibold text-sm tracking-tight text-slate-100">MindMesh</span>
          </div>
        </div>
      </div>

      {/* Internal Navigation Router Options */}
      <nav className="p-3 flex flex-col gap-1.5 border-b border-zinc-900">
        <button
          onClick={() => onChangePage('chat')}
          className={`flex items-center justify-between px-3 py-2 rounded transition-all cursor-pointer ${
            currentPage === 'chat'
              ? 'bg-slate-900 border border-zinc-800 text-white font-medium border-l-2 border-indigo-500'
              : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200 border border-transparent'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <MessageSquare size={13} className={currentPage === 'chat' ? 'text-indigo-400' : 'text-slate-500'} />
            <span className="text-[11px]">Chats</span>
          </div>
          {currentPage === 'chat' && <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>}
        </button>

        <button
          onClick={() => onChangePage('knowledge')}
          className={`flex items-center justify-between px-3 py-2 rounded transition-all cursor-pointer ${
            currentPage === 'knowledge'
              ? 'bg-slate-900 border border-zinc-800 text-white font-medium border-l-2 border-indigo-500'
              : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200 border border-transparent'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Library size={13} className={currentPage === 'knowledge' ? 'text-indigo-400' : 'text-slate-500'} />
            <span className="text-[11px]">Knowledge Base</span>
          </div>
          {currentPage === 'knowledge' && <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>}
        </button>


        <button
          onClick={() => onChangePage('settings')}
          className={`flex items-center justify-between px-3 py-2 rounded transition-all cursor-pointer ${
            currentPage === 'settings'
              ? 'bg-slate-900 border border-zinc-800 text-white font-medium border-l-2 border-indigo-500'
              : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200 border border-transparent'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <SettingsIcon size={13} className={currentPage === 'settings' ? 'text-indigo-400' : 'text-slate-500'} />
            <span className="text-[11px]">Workspace Settings</span>
          </div>
          {currentPage === 'settings' && <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>}
        </button>

        <button
          onClick={() => onChangePage('insights')}
          className={`flex items-center justify-between px-3 py-2 rounded transition-all cursor-pointer ${
            currentPage === 'insights'
              ? 'bg-slate-900 border border-zinc-800 text-white font-medium border-l-2 border-indigo-500'
              : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200 border border-transparent'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <BarChart2 size={13} className={currentPage === 'insights' ? 'text-indigo-400' : 'text-slate-500'} />
            <span className="text-[11px]">System Insights</span>
          </div>
          {currentPage === 'insights' && <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>}
        </button>
      </nav>

      {/* Active Conversation Navigation */}
      <div className="flex-1 flex flex-col overflow-hidden px-3 py-4">
        <div className="px-2 mb-3 flex justify-between items-center text-[9px] font-mono tracking-widest uppercase text-slate-500 font-bold">
          <span>Recent Chats</span>
          <button 
            type="button"
            onClick={onCreateSession}
            title="Create new conversation thread"
            className="p-1 hover:text-indigo-400 text-slate-400 bg-slate-900 border border-zinc-800 rounded flex items-center justify-center gap-1 transition-all cursor-pointer hover:bg-slate-800 active:scale-95"
          >
            <Plus size={10} />
            <span className="text-[8px] font-mono font-bold tracking-normal leading-none pr-0.5">NEW CHAT</span>
          </button>
        </div>

        {/* Filter Past Chat Sessions by Keyword */}
        <div className="px-1 mb-4 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            <Search size={11} />
          </span>
          <input
            type="text"
            placeholder="Search history..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 text-[11px] text-slate-200 placeholder-slate-600 rounded px-2.5 py-1.5 pl-6 border border-zinc-900 focus:outline-none focus:border-zinc-800 focus:bg-slate-900 transition-all font-sans"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 px-1 custom-scrollbar">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-6 text-[10px] text-slate-600 font-sans italic">
              No matching sessions
            </div>
          ) : (
            filteredSessions.map(session => {
              const isActive = session.id === selectedSessionId;
              return (
                <div
                  key={session.id}
                  className={`w-full group/item flex items-center justify-between rounded transition-all text-[11px] ${
                    isActive
                      ? 'bg-slate-900 border border-zinc-850 text-slate-200 font-medium'
                      : 'text-slate-400 hover:bg-slate-950 hover:text-slate-200'
                  }`}
                >
                  <button
                    onClick={() => {
                      onSelectSession(session.id);
                      onChangePage('chat');
                    }}
                    className="flex-1 flex items-center gap-2 px-2.5 py-2 text-left cursor-pointer truncate min-w-0"
                  >
                    <MessageSquare size={12} className={isActive ? 'text-indigo-400' : 'text-slate-500'} />
                    <span className="truncate">{session.title}</span>
                  </button>
                  
                  {/* Delete Option with hover display */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    title="Delete session"
                    className="p-1 px-2 opacity-0 group-hover/item:opacity-100 hover:text-rose-400 text-slate-500 rounded transition-all mr-1 cursor-pointer hover:bg-slate-800"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* User Section at the bottom */}
      <div className="mt-auto px-4 pt-4 border-t border-zinc-900 bg-[#070709]">
        <div className="flex items-center justify-between mb-3 bg-zinc-950 p-2.5 rounded border border-zinc-900">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center overflow-hidden shrink-0">
              {user?.profilePic ? (
                <img src={user.profilePic} alt={user.username} className="w-full h-full object-cover" />
              ) : (
                <UserIcon size={14} className="text-white" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
               <span className="text-[11px] font-medium text-slate-200 truncate capitalize">{user?.username || 'Guest user'}</span>
            </div>
          </div>
          <button
            onClick={onLogout}
            title="Reset Workspace"
            className="p-1.5 text-slate-500 hover:text-indigo-400 transition-all cursor-pointer active:scale-95 hover:bg-slate-900 rounded"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}
