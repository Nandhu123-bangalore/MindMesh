import React, { useState, useRef } from 'react';
import { KnowledgeFile } from '../types';
import { UploadCloud, FileText, Trash2, Search, CheckCircle2, AlertCircle, FileCode, Check, HelpCircle } from 'lucide-react';

interface KnowledgeBaseProps {
  files: KnowledgeFile[];
  onUploadFile: (file: { name: string; size: string; type: string; contentBase64?: string }) => void;
  onDeleteFile: (id: string) => void;
  fontSize: 'small' | 'medium' | 'large';
}

export default function KnowledgeBase({
  files,
  onUploadFile,
  onDeleteFile,
  fontSize
}: KnowledgeBaseProps) {
  const [dragActive, setDragActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState<'ALL' | 'PDF' | 'CODE' | 'OTHER'>('ALL');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop events logic
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleManualSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (fileList: FileList) => {
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      const sizeMB = (f.size / (1024 * 1024)).toFixed(1);
      const suffix = f.name.split('.').pop()?.toUpperCase() || 'PDF';
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const contentBase64 = event.target?.result?.toString().split(',')[1];
        onUploadFile({
          name: f.name,
          size: `${sizeMB} MB`,
          type: suffix,
          contentBase64
        });
      };
      reader.readAsDataURL(f);
    }
  };

  // Filter datasets
  const filteredFiles = files.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (fileTypeFilter === 'ALL') return matchesSearch;
    if (fileTypeFilter === 'PDF') return matchesSearch && file.type === 'PDF';
    if (fileTypeFilter === 'CODE') return matchesSearch && ['PY', 'JS', 'TS', 'JSON', 'CPP'].includes(file.type);
    return matchesSearch && !['PDF', 'PY', 'JS', 'TS', 'JSON', 'CPP'].includes(file.type);
  });

  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'small': return 'text-xs';
      case 'large': return 'text-base';
      default: return 'text-sm';
    }
  };

  const getFileIcon = (type: string) => {
    const norm = type.toUpperCase();
    if (norm === 'PDF') {
      return <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20"><FileText size={18} /></div>;
    }
    if (['PY', 'JS', 'TS', 'JSON', 'CPP', 'PY'].includes(norm)) {
      return <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20"><FileCode size={18} /></div>;
    }
    return <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20"><FileText size={18} /></div>;
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 bg-[#09090b] h-full custom-scrollbar selection:bg-indigo-500/25 select-text pb-20">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header Layout Section */}
        <div>
          <h2 className="text-lg md:text-xl font-bold text-slate-100 tracking-tight">Knowledge Base Core</h2>
          <p className="text-slate-400 text-xs mt-1 leading-relaxed">
            Manage your specialized neural network datasets, weights logs, and paper digests to construct a targeted context schema.
          </p>
        </div>

        {/* Bento Stats Filter Row */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 p-4 rounded border border-zinc-800 flex flex-col justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">Total Indexed Sources</span>
            <p className="text-lg font-bold text-indigo-400 mt-1">{files.length} Documents</p>
          </div>
          <div className="bg-slate-900 p-4 rounded border border-zinc-800 flex flex-col justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">Estimated Space Used</span>
            <p className="text-lg font-bold text-slate-200 mt-1">1.4 GB / 5.0 GB</p>
          </div>
          <div className="bg-slate-900 p-4 rounded border border-zinc-800 flex flex-col justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">Sync Pipeline Status</span>
            <div className="flex items-center gap-1.5 mt-1 text-emerald-400 font-mono text-xs font-semibold">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
              <span>Online / Synced</span>
            </div>
          </div>
        </section>

        {/* Upload Container Area with Drag & Drop */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative p-8 border-2 border-dashed rounded bg-slate-900/60 transition-all duration-200 flex flex-col items-center justify-center cursor-pointer group text-center ${
            dragActive
              ? 'border-indigo-500 bg-indigo-500/5 scale-[0.99]'
              : 'border-zinc-800 hover:border-indigo-500 hover:bg-slate-950'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleManualSelect}
            className="hidden"
          />

          <div className="w-10 h-10 rounded bg-slate-900 flex items-center justify-center text-indigo-400 mb-3 border border-zinc-800 group-hover:scale-105 transition-transform">
            <UploadCloud size={20} />
          </div>
          <p className="font-bold text-xs text-slate-200 mb-0.5">Drag & drop files here to index</p>
          <p className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">Supports PDF, TXT, DOCX, and Markdown (Max 50MB)</p>
        </div>

        {/* Filters & Dataset Listing Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-zinc-800 pt-6">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
              <Search size={13} />
            </span>
            <input
              type="text"
              placeholder="Query specialized datasets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 text-xs text-slate-200 placeholder-slate-500 rounded py-2 pl-8 pr-3 border border-zinc-800 focus:outline-none focus:border-indigo-500 transition-all font-sans"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto shrink-0 pb-1">
            {(['ALL', 'PDF', 'CODE', 'OTHER'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFileTypeFilter(tab)}
                className={`px-3 py-1 text-[10px] uppercase font-mono tracking-wider font-bold border transition-all cursor-pointer rounded ${
                  fileTypeFilter === tab
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                    : 'bg-slate-900 text-slate-400 border-zinc-800 hover:border-slate-500'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Document Listing Tables */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-widest text-slate-500 px-3 pb-1.5 border-b border-zinc-800 font-bold">
            <span className="w-1/2">Filename</span>
            <span className="w-1/4 text-center hidden md:inline">Format</span>
            <span className="w-1/4 text-right">Actions</span>
          </div>

          {filteredFiles.length === 0 ? (
            <div className="text-center py-12 rounded border border-dashed border-zinc-850 bg-slate-950">
              <p className="text-xs text-slate-500 italic font-sans animate-fade-in">No indexed documents match the query filter</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-850">
              {filteredFiles.map(file => (
                <div
                  key={file.id}
                  className="flex items-center justify-between py-3 px-3 hover:bg-slate-900/60 rounded transition-all group"
                >
                  <div className="flex items-center gap-3 w-1/2 min-w-0">
                    {getFileIcon(file.type)}
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-medium text-slate-200 truncate pr-2">{file.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5">{file.size}</span>
                    </div>
                  </div>

                  <div className="w-1/4 text-center hidden md:flex items-center justify-center">
                    <span className="px-2 py-0.5 rounded bg-zinc-900 text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400 border border-zinc-800">
                      {file.type}
                    </span>
                  </div>

                  <div className="w-1/4 flex justify-end items-center gap-2">
                    <div className="flex items-center gap-1 text-indigo-400 text-[10px] font-mono font-semibold uppercase tracking-wide">
                      <CheckCircle2 size={11} className="text-indigo-400" />
                      <span className="hidden sm:inline">Indexed</span>
                    </div>

                    <button
                      onClick={() => onDeleteFile(file.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded transition-all cursor-pointer"
                      title="De-index file"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Subtle Guidelines Callout */}
        <div className="p-4 rounded border border-zinc-800 bg-slate-900/80 flex gap-4 mt-8">
          <div className="p-1.5 rounded bg-indigo-500/10 text-indigo-400 h-fit"><HelpCircle size={14} /></div>
          <div>
            <h4 className="text-xs font-bold text-slate-200">Vector Embeddings Context</h4>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              ML Mentor generates semantic chunk integrations with OpenAI or Gemini token layers on these documents. When active in connections schema, context is transparently fused during chat generations. Deleting documents cleanly de-indexes them from backend pipelines.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
