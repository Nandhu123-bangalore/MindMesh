import React, { useRef, useState, useEffect } from 'react';
import { Message, KnowledgeFile } from '../types';
import MessageBubble from './MessageBubble';
import Loader from './Loader';
import { Send, Mic, MicOff, ArrowDown, HelpCircle, AlertTriangle, Sparkles, Paperclip } from 'lucide-react';

interface ChatBoxProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  activeLlm: 'gemini' | 'local';
  workspaceFiles: KnowledgeFile[];
  fontSize: 'small' | 'medium' | 'large';
  removeResearchMode: boolean;
  onToggleResearchMode: (val: boolean) => void;
  onUploadFile: (file: { name: string; size: string; type: string; contentBase64?: string }) => void;
}

export default function ChatBox({
  messages,
  onSendMessage,
  isLoading,
  activeLlm,
  workspaceFiles,
  fontSize,
  removeResearchMode,
  onToggleResearchMode,
  onUploadFile
}: ChatBoxProps) {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef<number>(0);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shouldAutoScrollRef = useRef<boolean>(true);
  const prevMessagesLengthRef = useRef<number>(0);
  const prevLoadingRef = useRef<boolean>(isLoading);
  const userSentMessageRef = useRef<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Rotating general non-transformer recommendations
  useEffect(() => {
    const pool = [
      "What is RAG?",
      "Explain linear regression vs logistic regression",
      "How does k-means clustering work?",
      "Explain attention mechanism",
      "Difference between LoRA and QLoRA",
      "What is the difference between concurrency and parallelism?",
      "What is vector database?",
      "Explain the time complexity of QuickSort",
      "Explain transformers",
      "Explain transformer architecture",
      "How do embeddings work?",
      "What is fine-tuning",
      "What is a vector database?"
    ];
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    setDynamicSuggestions(shuffled.slice(0, 3));
  }, [messages.length]);

  const handleAttachmentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileList = e.target.files;
      const uploadedNames: string[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const f = fileList[i];
        console.log("Uploading file:", f.name, { type: f.type, size: f.size });
        const sizeMB = (f.size / (1024 * 1024)).toFixed(1);
        const suffix = f.name.split('.').pop()?.toUpperCase() || 'PDF';
        
        const reader = new FileReader();
        reader.onload = (event) => {
          const contentBase64 = event.target?.result?.toString().split(',')[1];
          console.log("Upload payload prepared:", {
            name: f.name,
            size: `${sizeMB} MB`,
            type: suffix,
            contentLength: contentBase64?.length,
          });
          onUploadFile({
            name: f.name,
            size: `${sizeMB} MB`,
            type: suffix,
            contentBase64
          });
        };
        reader.readAsDataURL(f);
        
        uploadedNames.push(f.name);
      }
      setUploadFeedback(`Attached and synchronized: ${uploadedNames.join(", ")}`);
      setTimeout(() => {
        setUploadFeedback(null);
      }, 4000);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText(prev => prev ? prev + ' ' + transcript : transcript);
        }
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.onerror = (err: any) => {
        console.error("Speech recognition error:", err);
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  const handleToggleListening = () => {
    if (!recognitionRef.current) {
      alert("Voice speech recognition is not supported in this browser environment. Please open in a new tab for Web Speech functionality.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  // Keep track of scroll positions to enable auto-scroll ONLY when the user is at the bottom
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollBottomBtn(!isAtBottom && scrollHeight > clientHeight);
    shouldAutoScrollRef.current = isAtBottom;
    lastScrollTopRef.current = scrollTop;
  };

  // Smooth scroll to messagesEndRef
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end"
      });
    }
  }, [messages.length]);

  const handleSuggestionClick = (text: string) => {
    setInputText(text);
    if (!isLoading) {
      userSentMessageRef.current = true;
      onSendMessage(text);
      setInputText('');
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    userSentMessageRef.current = true;
    onSendMessage(inputText);
    setInputText('');
  };

  const activeRagList = workspaceFiles.filter(f => f.status === 'Indexed');

  return (
    <div className="flex-1 flex flex-col h-full bg-[#09090b] relative overflow-hidden select-text">

      {/* Main Stream chat container element */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-6 py-6 space-y-5 relative custom-scrollbar pb-24"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-4">
            <div className="w-12 h-12 rounded bg-slate-900 border border-zinc-800 flex items-center justify-center text-indigo-400 mb-6 shadow-md shadow-indigo-600/5 animate-pulse">
              <Sparkles size={20} />
            </div>
            <h3 className="font-semibold text-sm tracking-tight text-slate-200">Welcome to Chats</h3>
            <p className="text-[11px] text-slate-400 max-w-sm mt-2 leading-relaxed">
              Ask any question, solve complex challenges, or explore your knowledge base with zero friction.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mt-8 text-left w-full">
              <div
                onClick={() => handleSuggestionClick("What is dynamic programming?")}
                className="p-3 bg-slate-900 border border-zinc-800 hover:border-indigo-500/50 rounded transition-all cursor-pointer text-[11px] group/card hover:bg-slate-900/50"
              >
                <p className="font-semibold text-indigo-400 group-hover/card:text-indigo-300">✦ Dynamic Programming</p>
                <p className="text-slate-400 mt-1">Optimal substructures and overlapping subproblems.</p>
              </div>
              <div
                onClick={() => handleSuggestionClick("Explain SQL joins with examples")}
                className="p-3 bg-slate-900 border border-zinc-805 hover:border-indigo-500/50 rounded transition-all cursor-pointer text-[11px] group/card hover:bg-slate-900/50"
              >
                 <p className="font-semibold text-indigo-400 group-hover/card:text-indigo-300">✦ SQL Relational Joins</p>
                 <p className="text-slate-400 mt-1">Cross-referencing multiple structured collections.</p>
              </div>
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <MessageBubble
              key={msg.id}
              message={msg}
              fontSize={fontSize}
              onClickSuggestion={(suggText) => {
                handleSuggestionClick(suggText);
              }}
            />
          ))
        )}

        {/* Typing Loader indication */}
        {isLoading && (
          <div className="flex items-start gap-4 message-fade-in">
            <div className="bg-slate-900 border border-zinc-800 rounded p-4">
              <Loader label={activeLlm === 'gemini' ? 'Gemini reasoning...' : 'Routing query & retrieving...'} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll to Bottom button */}
      {showScrollBottomBtn && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute bottom-20 right-6 bg-zinc-805 hover:bg-zinc-700 text-white p-2 rounded-full shadow-2xl border border-zinc-800 hover:scale-105 active:scale-95 transition-all z-40 flex items-center justify-center"
          title="Scroll to Bottom"
        >
          <ArrowDown size={12} className="text-slate-300" />
        </button>
      )}

      {/* Sticky Bottom Form bar */}
      <footer className="absolute bottom-0 left-0 right-0 bg-[#09090b]/95 backdrop-blur border-t border-zinc-900 py-2.5 px-4 z-20">
        <div className="max-w-xl mx-auto w-full">
          {/* Animated successful upload feedback */}
          {uploadFeedback && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-950/40 border border-indigo-900/50 rounded text-[9px] text-indigo-300 mb-2 max-w-fit mx-auto animate-fade-in font-mono">
              <Sparkles size={8} className="text-indigo-400 animate-pulse" />
              <span>{uploadFeedback}</span>
            </div>
          )}

          {/* Dynamic Suggestions List styled as clean geometric chips */}
          <div className="flex gap-1.5 mb-2 overflow-x-auto pb-0.5 no-scrollbar select-none justify-center">
            {dynamicSuggestions.map((sugg, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSuggestionClick(sugg)}
                className="px-2 py-0.5 bg-slate-950 border border-zinc-850 rounded text-[9px] text-slate-400 hover:text-indigo-400 hover:border-indigo-500/40 transition-all shrink-0 cursor-pointer"
              >
                {sugg.length > 28 ? sugg.slice(0, 28) + "..." : sugg}
              </button>
            ))}
          </div>

          <form onSubmit={handleFormSubmit} className="relative flex items-center bg-slate-950 border border-zinc-850 rounded px-2 py-1 shadow-lg focus-within:border-indigo-500/60 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all w-full">
            {/* Attach File Option */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach files to conversation"
              className="p-1.5 rounded flex items-center justify-center text-slate-500 hover:text-indigo-400 hover:bg-slate-900 transition-all cursor-pointer shrink-0"
            >
              <Paperclip size={11} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleAttachmentSelect}
              className="hidden"
            />

            {/* Voice Input button styled inside */}
            <button
              type="button"
              onClick={handleToggleListening}
              title="Dictate research query"
              className={`p-1.5 rounded flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                isListening
                  ? 'bg-rose-950/80 text-rose-300'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'
              }`}
            >
              {isListening ? <MicOff size={11} className="animate-pulse" /> : <Mic size={11} />}
            </button>

            {/* Input Field */}
            <input
              type="text"
              placeholder={
                isListening
                  ? "Dictating query... speak now..."
                  : "Ask a direct query..."
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 px-2 py-0.5 text-xs text-slate-100 placeholder-slate-600 font-sans disabled:opacity-50"
              disabled={isLoading}
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="bg-indigo-600 hover:bg-indigo-550 disabled:opacity-30 p-1.5 rounded text-white transition-all cursor-pointer active:scale-95 shrink-0 flex items-center justify-center"
            >
              <Send size={10} />
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}
