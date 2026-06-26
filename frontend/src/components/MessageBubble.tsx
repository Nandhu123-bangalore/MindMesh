import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// Use standard theme that compiles perfectly in ESM/TS
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Message } from '../types';
import { Copy, Check, Terminal, Bot, User } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  onClickSuggestion?: (text: string) => void;
  fontSize: 'small' | 'medium' | 'large';
}

export default function MessageBubble({ message, onClickSuggestion, fontSize }: MessageBubbleProps) {
  const [copiedCodes, setCopiedCodes] = useState<Record<string, boolean>>({});

  const copyToClipboard = (text: string, blockId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodes(prev => ({ ...prev, [blockId]: true }));
    setTimeout(() => {
      setCopiedCodes(prev => ({ ...prev, [blockId]: false }));
    }, 2000);
  };

  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'small': return 'text-xs md:text-sm';
      case 'large': return 'text-base md:text-lg';
      default: return 'text-sm md:text-base';
    }
  };

  const parseMessageText = (text: string) => {
    // Regex to capture markdown code blocks
    const regex = /```(\w*)\n([\s\S]*?)\n```/g;
    const segments: Array<{ type: 'text' | 'code'; content: string; language?: string; id?: string }> = [];
    let lastIndex = 0;
    let match;
    let index = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({
          type: 'text',
          content: text.slice(lastIndex, match.index)
        });
      }
      segments.push({
        type: 'code',
        language: match[1] || 'python',
        content: match[2],
        id: `code-${index++}`
      });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex)
      });
    }

    if (segments.length === 0) {
      return [{ type: 'text', content: text }];
    }

    return segments;
  };

  const isUser = message.role === 'user';
  const segments = parseMessageText(message.text);

  const routeLabels: Record<string, { label: string; color: string }> = {
    CASUAL: { label: 'Casual', color: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50' },
    UNRELATED: { label: 'Out of Scope', color: 'text-amber-400 bg-amber-950/40 border-amber-800/50' },
    WEB_SEARCH: { label: 'Web Search', color: 'text-sky-400 bg-sky-950/40 border-sky-800/50' },
    DOCUMENT: { label: 'Your Document', color: 'text-violet-400 bg-violet-950/40 border-violet-800/50' },
    VECTOR_DB: { label: 'Knowledge Base', color: 'text-indigo-400 bg-indigo-950/40 border-indigo-800/50' },
  };

  const routeInfo = message.route ? routeLabels[message.route] : null;

  return (
    <div className={`flex items-start gap-3 w-full my-4 message-fade-in ${isUser ? 'justify-end' : 'justify-start'}`}>
      
      {/* For Bot (Assistant): render Bot Avatar on the LEFT */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-slate-900 border border-zinc-800 flex items-center justify-center text-indigo-400 shrink-0 shadow-md select-none mt-1">
          <Bot size={15} />
        </div>
      )}

      {/* Speech bubble and metadata column */}
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[82%] md:max-w-[72%]`}>
        <div
          className={`rounded-lg relative shadow-md transition-all w-full ${
            isUser
              // Styled User message with Geometric Indigo look
              ? `bg-indigo-600 text-white rounded-tr-none px-4 py-3 border border-indigo-500`
              // AI bot bubble styled with slate-900 surface and crisp zinc-800 borders
              : `bg-slate-900 border border-zinc-800 rounded-tl-none text-slate-100`
          }`}
        >
          {/* Assistant Core Header */}
          {!isUser && (
            <div className="flex items-center gap-2 px-4 pt-3 pb-1 border-b border-zinc-800 mb-3 flex-wrap">
              <div className="flex items-center gap-2 text-indigo-400 font-mono text-[10px] tracking-widest uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                <span>Agentic RAG v3</span>
              </div>
              {routeInfo && (
                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wider ${routeInfo.color}`}>
                  {routeInfo.label}
                </span>
              )}
            </div>
          )}

          {/* Message Content Canvas */}
          <div className={`px-4 py-2 leading-relaxed space-y-3 ${getFontSizeClass()}`}>
            {segments.map((seg, i) => {
              if (seg.type === 'code') {
                return (
                  <div key={seg.id || i} className="my-3 rounded overflow-hidden border border-zinc-800 bg-[#09090b]">
                    {/* Code Toolbar */}
                    <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800">
                      <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
                        <Terminal size={11} className="text-indigo-400" />
                        <span>{seg.language || 'code'}</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(seg.content, seg.id!)}
                        className="flex items-center gap-1 font-mono text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        {copiedCodes[seg.id!] ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                        <span>{copiedCodes[seg.id!] ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    {/* Syntax highlighting implementation */}
                    <SyntaxHighlighter
                      language={seg.language || 'python'}
                      style={tomorrow}
                      customStyle={{
                        margin: 0,
                        padding: '12px',
                        background: '#09090b',
                        fontSize: '12px',
                        fontFamily: '"JetBrains Mono", monospace',
                      }}
                    >
                      {seg.content}
                    </SyntaxHighlighter>
                  </div>
                );
              }

              // Split lines for formatting
              return (
                <p key={i} className="whitespace-pre-line text-slate-200">
                  {seg.content}
                </p>
              );
            })}
          </div>
        </div>

        {/* Timestamp and routing info */}
        <div className="flex flex-col items-start gap-0.5 mt-1 px-2">
          <span className="text-[9px] text-slate-500 font-mono">
            {message.timestamp}
          </span>
          {!isUser && message.routingReason && (
            <span className="text-[8px] text-slate-600 font-mono italic max-w-xs">
              Route: {message.routingReason}
            </span>
          )}
          {!isUser && message.sources && message.sources.length > 0 && (
            <span className="text-[8px] text-slate-600 font-mono">
              Sources: {message.sources.slice(0, 3).join(', ')}
            </span>
          )}
        </div>

        {/* Interactive suggestions offered matching context */}
        {!isUser && message.suggestions && message.suggestions.length > 0 && onClickSuggestion && (
          <div className="flex flex-col items-start gap-1.5 mt-3 px-1">
            <p className="text-[9px] font-mono uppercase tracking-wider text-slate-500">Suggested Queries</p>
            <div className="flex flex-wrap gap-2">
              {message.suggestions.map((sugg, sIdx) => (
                <button
                  key={sIdx}
                  onClick={() => onClickSuggestion(sugg)}
                  className="text-left px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-zinc-800 text-slate-400 hover:text-indigo-400 hover:border-indigo-400 rounded-full text-[10px] transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  ✦ {sugg}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* For User: render User Avatar on the RIGHT */}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shrink-0 shadow-md select-none mt-1">
          <User size={14} />
        </div>
      )}

    </div>
  );
}
