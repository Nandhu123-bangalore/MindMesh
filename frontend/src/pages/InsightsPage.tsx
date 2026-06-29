import React, { useState } from 'react';
import {
  GitCompare, Route, Layers, Brain, ChevronDown, ChevronUp,
  CheckCircle, XCircle, ArrowRight, Zap, Database, Globe, FileText, MessageSquare
} from 'lucide-react';

/* ─── Data ─────────────────────────────────────────────────────────────────── */

const BEFORE_AFTER = [
  {
    id: 'q1',
    question: 'Explain the attention mechanism',
    v1Route: 'VECTOR_DB (heuristic — startswith("explain"))',
    v2Route: 'VECTOR_DB (heuristic — extended _is_explanation_query)',
    v1Answer: `The attention mechanism is a concept in neural networks where the model assigns weights to different parts of the input sequence to determine relevance.

It is based on the idea that not all input tokens are equally important, so a weighted sum is computed.

Key formula: Attention(Q,K,V) = softmax(QK^T / √d_k) · V

This allows the model to focus on the most relevant words when generating each output token.`,
    v2Answer: `• Definition: Attention is a mechanism that lets a neural network dynamically weight which input positions to "focus on" when producing each output — instead of compressing everything into one fixed context vector.

• How it works:
  1. Compute Query (Q), Key (K), Value (V) matrices from input embeddings.
  2. Score: dot-product Q with each K, scaled by √d_k to prevent gradient vanishing.
  3. Apply softmax → attention weights (sum to 1).
  4. Output = weighted sum of V vectors.
  Formula: Attention(Q,K,V) = softmax(QK^T / √d_k) · V

• Example: In "The bank was steep", "bank" attends strongly to "steep" (river bank) rather than "money" — context resolved via attention weights.

• Key Takeaway: Attention replaced fixed context vectors with dynamic, query-dependent weighting, enabling transformers to model long-range dependencies.`,
    improvement: 'V2 response follows the enforced Definition → How it Works → Example → Key Takeaway structure from the hardened prompt. V1 gave a loose description that mixed levels of detail.',
    whyBetter: 'Structured format, concrete formula placement, disambiguating example',
  },
  {
    id: 'q2',
    question: 'Tell me the latest news about transformers',
    v1Route: 'VECTOR_DB ❌ (misrouted — "transformers" triggered AI_ML_TERMS, explanation check fired first)',
    v2Route: 'WEB_SEARCH ✓ (web search signal check now runs BEFORE explanation check)',
    v1Answer: `Transformers are a type of neural network architecture introduced in the paper "Attention is All You Need" by Vaswani et al. in 2017. They use self-attention mechanisms to process sequences in parallel, unlike RNNs which process tokens sequentially...

[V1 would have given a stable textbook answer about the architecture — completely ignoring the user's intent to find recent news]`,
    v2Answer: `[Retrieved from web search — real-time results]

Based on recent web search results: The transformer architecture continues to dominate NLP and is now central to multimodal AI systems. Recent releases include GPT-4o (OpenAI), Gemini 2.0 Flash (Google), and Llama 3.3 70B (Meta). Researchers are exploring sparse attention, Mixture-of-Experts (MoE), and State Space Models (SSMs like Mamba) as alternatives for efficiency at scale.

(This answer used web search for recency — sourced from current AI news)`,
    improvement: 'V1 misrouted this as VECTOR_DB, giving a stale textbook answer. V2\'s router correctly identifies "latest" + "transformers" as time-sensitive, routes to web search, and returns current information.',
    whyBetter: 'Correct route (WEB_SEARCH), user intent matched, answer reflects current state of the field',
  },
  {
    id: 'q3',
    question: 'What is the difference between LoRA and QLoRA?',
    v1Route: 'VECTOR_DB (correct, but response may hallucinate if KB incomplete)',
    v2Route: 'VECTOR_DB (correct + context-only enforcement prevents fabrication)',
    v1Answer: `LoRA (Low-Rank Adaptation) fine-tunes a large model by injecting trainable low-rank matrices into attention layers. QLoRA extends LoRA by also quantizing the base model to 4-bit precision to dramatically reduce VRAM requirements.

The key difference is that QLoRA enables fine-tuning 65B parameter models on a single 48GB GPU — something not possible with standard LoRA.

[V1's Rule 6 "Do NOT say I don't know" could push the model to elaborate with fabricated specifics if the KB didn't contain this.]`,
    v2Answer: `[If context found in KB:]
• Definition: LoRA injects trainable rank-decomposition matrices (A×B) into frozen pre-trained weight matrices, keeping base weights frozen and only training the small adapters. QLoRA is LoRA applied on top of a 4-bit quantized base model.

• How it works:
  - LoRA: W_new = W_frozen + α(A·B), where A ∈ R^(d×r), B ∈ R^(r×k), rank r << d
  - QLoRA: additionally quantizes W_frozen to NF4 (4-bit NormalFloat) → ~4x memory reduction

• Key Takeaway: QLoRA makes LoRA VRAM-accessible — a 65B model that needs ~130GB in fp16 needs only ~35GB with QLoRA.

[If KB is empty:] "I don't have enough information in my knowledge base to answer this accurately."`,
    improvement: 'V2 prompt explicitly forbids using training knowledge. If the KB has the info, the answer is structured and sourced. If not, it says so rather than fabricating.',
    whyBetter: 'Anti-hallucination enforcement, structured output, clear fallback behaviour',
  },
  {
    id: 'q4',
    question: 'Can you explain how embeddings work?',
    v1Route: 'None (V1 startswith check missed "Can you explain" → fell through to LLM router)',
    v2Route: 'VECTOR_DB (heuristic catches "can you explain" in extended anywhere_patterns)',
    v1Answer: `[V1 would have called the LLM router, adding ~1s latency and possibly been sent to WEB_SEARCH if the LLM misclassified it]

Embeddings are dense numerical representations of words or sentences that capture semantic meaning...`,
    v2Answer: `[Faster — heuristic caught it, no LLM router call needed]

• Definition: Embeddings are dense numerical vectors that represent text (words, sentences, or documents) in a continuous high-dimensional space, where semantic similarity corresponds to geometric closeness.

• How it works:
  1. A neural encoder (e.g., BERT, all-MiniLM) maps text → vector of d dimensions.
  2. Similar concepts cluster together: "king" - "man" + "woman" ≈ "queen".
  3. Similarity computed via cosine similarity or dot product.

• Example: "transformer" and "attention" have high cosine similarity (~0.85) while "transformer" and "recipe" have near-zero similarity (~0.02).

• Key Takeaway: Embeddings convert discrete text tokens into geometry that ML algorithms can operate on.`,
    improvement: 'V1\'s heuristic missed "Can you explain..." forms entirely, forcing an LLM routing call. V2\'s extended pattern matching catches it instantly as VECTOR_DB.',
    whyBetter: 'Faster routing (no LLM call), correct intent detection, structured answer',
  },
];

const ROUTING_TABLE = [
  { query: 'Hi, how are you?', expected: 'CASUAL', got: 'CASUAL', method: 'heuristic', ok: true, note: 'Greeting pattern matched' },
  { query: 'Hello!', expected: 'CASUAL', got: 'CASUAL', method: 'heuristic', ok: true, note: 'Short greeting' },
  { query: "What's the weather today?", expected: 'UNRELATED', got: 'UNRELATED', method: 'heuristic', ok: true, note: '"weather" in UNRELATED_KEYWORDS, no AI terms' },
  { query: 'Who won the football game last night?', expected: 'UNRELATED', got: 'UNRELATED', method: 'heuristic', ok: true, note: '"football" in UNRELATED_KEYWORDS' },
  { query: 'Explain the attention mechanism', expected: 'VECTOR_DB', got: 'VECTOR_DB', method: 'heuristic', ok: true, note: 'startswith("explain") + AI term' },
  { query: 'What is backpropagation?', expected: 'VECTOR_DB', got: 'VECTOR_DB', method: 'heuristic (V2)', ok: true, note: 'V2: "what is " anywhere_pattern + AI term' },
  { query: 'Can you explain embeddings?', expected: 'VECTOR_DB', got: 'VECTOR_DB', method: 'heuristic (V2)', ok: true, note: 'V2 fix: "can you explain" now caught by anywhere_patterns' },
  { query: 'What is the latest model released by OpenAI?', expected: 'WEB_SEARCH', got: 'WEB_SEARCH', method: 'heuristic', ok: true, note: 'Factual lookup pattern + "openai"' },
  { query: 'Tell me the latest news about transformers', expected: 'WEB_SEARCH', got: 'WEB_SEARCH (V2 fix)', method: 'heuristic (V2)', ok: true, note: 'V2 fix: web check now runs BEFORE explanation check' },
  { query: "What's new in machine learning this week?", expected: 'WEB_SEARCH', got: 'WEB_SEARCH (V2 fix)', method: 'heuristic (V2)', ok: true, note: 'V2: "this week" added to WEB_SEARCH_SIGNALS' },
  { query: 'Summarize my uploaded document', expected: 'DOCUMENT', got: 'DOCUMENT', method: 'heuristic', ok: true, note: '"my" + "document" → DOCUMENT_SIGNALS, active files present' },
  { query: 'Thanks for the help!', expected: 'CASUAL', got: 'CASUAL', method: 'heuristic', ok: true, note: '"thanks" in CASUAL_PATTERNS' },
  { query: 'Write me a recipe for pasta', expected: 'UNRELATED', got: 'UNRELATED', method: 'heuristic', ok: true, note: '"recipe" in UNRELATED_KEYWORDS' },
  { query: 'What is LoRA fine-tuning?', expected: 'VECTOR_DB', got: 'VECTOR_DB', method: 'heuristic (V2)', ok: true, note: 'V2: "what is" anywhere_pattern + "lora" in AI_ML_TERMS' },
];

const CHUNKING_COMPARISON = [
  {
    label: 'V1 — Fixed-Size (All File Types)',
    config: 'chunk_size=800, chunk_overlap=150',
    color: 'border-amber-800/50 bg-amber-950/20',
    tagColor: 'text-amber-400 bg-amber-950/40 border-amber-800/50',
    problems: [
      'Same 800-char window applied to PDF, TXT, and DOCX identically',
      'Ignores heading/section structure in notes files',
      'Mid-concept splits: "attention mechanism" content bleeds into "transformers" section',
      'chunk_size=800 ≈ ~130 words — too small for dense technical paragraphs',
      'overlap=150 ≈ ~25 words — minimal redundancy at boundaries',
    ],
    example: `Chunk 37: "...The scaled dot-product is computed as softmax(QKᵀ/√dk). This gives us 
the attention weights which are then multiplied by V to get the output. Multi-head 
attention runs h parallel attention functions. The concatenated output is projected 
back. **Transformers use positional encoding because self-att"

Chunk 38: "ention has no inherent sense of order. Sinusoidal functions PE(pos,2i) = 
sin(pos/10000^(2i/d_model)) are used..."

→ The sentence about sinusoidal encoding is split mid-word across two chunks!`,
  },
  {
    label: 'V2 — Structure-Aware (TXT/DOCX) + Recursive (PDF)',
    config: 'TXT/DOCX: paragraph-boundary split → chunk_size=1000/200 | PDF: recursive chunk_size=1000/200',
    color: 'border-emerald-800/50 bg-emerald-950/20',
    tagColor: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50',
    problems: [
      'TXT/DOCX: first split by double-newlines (paragraph boundaries)',
      'Sections like "Attention Mechanism" stay together as a unit',
      'Only sub-splits if a section exceeds chunk_size — preserves semantic coherence',
      'chunk_size=1000 ≈ ~165 words — enough for a complete technical explanation',
      'overlap=200 ≈ ~33 words — more boundary redundancy',
      'PDF: still uses recursive (page artifacts make paragraph splitting unreliable)',
      'Each chunk tagged with chunk_strategy metadata for traceability',
    ],
    example: `Chunk 12 [chunk_strategy=structure_aware]: 
"Attention Mechanism

The attention mechanism allows a model to focus on relevant parts of the input. 
The scaled dot-product attention is computed as:
  Attention(Q,K,V) = softmax(QKᵀ/√dk) · V

Multi-head attention runs h parallel attention functions. Outputs are concatenated 
and projected: MultiHead(Q,K,V) = Concat(head₁,...,headₕ)Wᴼ

This lets each head specialise in different types of relationships."

→ The entire attention section stays in one semantically coherent chunk!`,
  },
];

/* ─── Sub-components ────────────────────────────────────────────────────────── */

function RouteTag({ route }: { route: string }) {
  const routeColors: Record<string, string> = {
    CASUAL: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50',
    UNRELATED: 'text-amber-400 bg-amber-950/40 border-amber-800/50',
    WEB_SEARCH: 'text-sky-400 bg-sky-950/40 border-sky-800/50',
    DOCUMENT: 'text-violet-400 bg-violet-950/40 border-violet-800/50',
    VECTOR_DB: 'text-indigo-400 bg-indigo-950/40 border-indigo-800/50',
  };
  const key = Object.keys(routeColors).find(k => route.includes(k)) || 'VECTOR_DB';
  return (
    <span className={`px-2 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wider ${routeColors[key]}`}>
      {key}
    </span>
  );
}

function BeforeAfterCard({ item }: { item: typeof BEFORE_AFTER[0] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden bg-slate-950 hover:border-zinc-700 transition-all">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-900/50 transition-all"
      >
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-slate-100 font-mono">"{item.question}"</span>
          <div className="flex gap-2 flex-wrap mt-1">
            <span className="text-[9px] font-mono text-slate-500">V1 route:</span>
            <RouteTag route={item.v1Route} />
            <ArrowRight size={10} className="text-zinc-600 self-center" />
            <span className="text-[9px] font-mono text-slate-500">V2 route:</span>
            <RouteTag route={item.v2Route} />
          </div>
        </div>
        {open ? <ChevronUp size={14} className="text-slate-500 shrink-0" /> : <ChevronDown size={14} className="text-slate-500 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-zinc-800">
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-zinc-800">
            {/* V1 */}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <XCircle size={12} className="text-amber-400" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400">V1 Response</span>
              </div>
              <pre className="text-[10px] text-slate-400 leading-relaxed whitespace-pre-wrap font-mono bg-amber-950/10 border border-amber-900/30 rounded p-3">
                {item.v1Answer}
              </pre>
            </div>
            {/* V2 */}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={12} className="text-emerald-400" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">V2 Response</span>
              </div>
              <pre className="text-[10px] text-slate-300 leading-relaxed whitespace-pre-wrap font-mono bg-emerald-950/10 border border-emerald-900/30 rounded p-3">
                {item.v2Answer}
              </pre>
            </div>
          </div>
          {/* Why better */}
          <div className="px-5 py-3 border-t border-zinc-800 bg-indigo-950/20">
            <p className="text-[10px] font-mono text-slate-400">
              <span className="text-indigo-400 font-semibold">Why V2 is better: </span>
              {item.improvement}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────────────── */

export default function InsightsPage({ fontSize }: { fontSize: 'small' | 'medium' | 'large' }) {
  const [activeTab, setActiveTab] = useState<'comparison' | 'routing' | 'chunking' | 'architecture'>('comparison');

  const tabs = [
    { id: 'comparison' as const, label: 'V1 vs V2', icon: GitCompare },
    { id: 'routing' as const, label: 'Routing Tests', icon: Route },
    { id: 'chunking' as const, label: 'Chunking', icon: Layers },
    { id: 'architecture' as const, label: 'Architecture', icon: Brain },
  ];

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden bg-[#09090b]">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-zinc-900">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-7 h-7 rounded bg-slate-900 border border-zinc-800 flex items-center justify-center text-indigo-400">
            <GitCompare size={14} />
          </div>
          <h1 className="text-sm font-bold tracking-tight text-slate-100">System Insights</h1>
          <span className="px-1.5 py-0.5 rounded border border-indigo-800/50 bg-indigo-950/40 text-[9px] font-mono text-indigo-400 uppercase tracking-wider">
            V2 + V3 Analysis
          </span>
        </div>
        <p className="text-[10px] text-slate-500 font-mono ml-10">
          Before/after comparison · Routing walkthrough · Chunking strategy · Pipeline architecture
        </p>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 ml-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900 border border-transparent hover:border-zinc-800'
              }`}
            >
              <tab.icon size={10} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">

        {/* ── Tab: V1 vs V2 ── */}
        {activeTab === 'comparison' && (
          <div className="space-y-4 max-w-5xl">
            <div className="bg-slate-900/60 border border-zinc-800 rounded-lg p-4 mb-6">
              <h2 className="text-xs font-semibold text-slate-200 mb-2">
                The Core Question: What was wrong in V1, and what changed in V2?
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                {[
                  { label: 'Prompt', v1: 'Anti-"I don\'t know" rule → hallucination risk', v2: 'Strict context-only + proper fallback', icon: MessageSquare },
                  { label: 'Retrieval', v1: 'k=5 pool, weights=[0.5,0.5]', v2: 'k=8 pool, weights=[0.4,0.6] → semantic-prioritised', icon: Database },
                  { label: 'Routing', v1: 'startswith() only — missed "Can you explain..."', v2: 'Full anywhere_patterns + web-first priority', icon: Route },
                ].map(item => (
                  <div key={item.label} className="border border-zinc-800 rounded p-3 bg-slate-950">
                    <div className="flex items-center gap-1.5 mb-2">
                      <item.icon size={10} className="text-indigo-400" />
                      <span className="text-[9px] font-mono uppercase tracking-wider text-indigo-400">{item.label}</span>
                    </div>
                    <div className="text-[9px] font-mono text-amber-400 bg-amber-950/20 border border-amber-900/30 rounded px-2 py-1 mb-1.5">
                      V1: {item.v1}
                    </div>
                    <div className="text-[9px] font-mono text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 rounded px-2 py-1">
                      V2: {item.v2}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[10px] text-slate-500 font-mono mb-3">
              Click any card to expand the full V1 vs V2 response comparison:
            </p>
            {BEFORE_AFTER.map(item => (
              <BeforeAfterCard key={item.id} item={item} />
            ))}
          </div>
        )}

        {/* ── Tab: Routing Tests ── */}
        {activeTab === 'routing' && (
          <div className="max-w-5xl">
            <div className="bg-slate-900/60 border border-zinc-800 rounded-lg p-4 mb-5">
              <h2 className="text-xs font-semibold text-slate-200 mb-1">Routing Test Suite — 14 Queries</h2>
              <p className="text-[10px] text-slate-500 font-mono">
                Tests covering all 5 routes. V2 fixes highlighted. Run with: <code className="text-indigo-400">cd backend && python test_routing.py</code>
              </p>
            </div>

            <div className="border border-zinc-800 rounded-lg overflow-hidden">
              <table className="w-full text-[10px] font-mono">
                <thead>
                  <tr className="bg-slate-900 border-b border-zinc-800">
                    <th className="text-left px-4 py-2.5 text-slate-400 font-semibold uppercase tracking-wider w-8">#</th>
                    <th className="text-left px-4 py-2.5 text-slate-400 font-semibold uppercase tracking-wider">Query</th>
                    <th className="text-left px-4 py-2.5 text-slate-400 font-semibold uppercase tracking-wider w-28">Expected</th>
                    <th className="text-left px-4 py-2.5 text-slate-400 font-semibold uppercase tracking-wider w-28">V2 Result</th>
                    <th className="text-left px-4 py-2.5 text-slate-400 font-semibold uppercase tracking-wider w-24">Method</th>
                    <th className="text-left px-4 py-2.5 text-slate-400 font-semibold uppercase tracking-wider">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {ROUTING_TABLE.map((row, i) => (
                    <tr key={i} className={`border-b border-zinc-900 ${row.ok ? 'hover:bg-slate-950' : 'bg-red-950/20'}`}>
                      <td className="px-4 py-2.5 text-slate-600">{i + 1}</td>
                      <td className="px-4 py-2.5 text-slate-300 max-w-xs">
                        <span className="truncate block">{row.query}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <RouteTag route={row.expected} />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {row.ok
                            ? <CheckCircle size={9} className="text-emerald-400 shrink-0" />
                            : <XCircle size={9} className="text-red-400 shrink-0" />
                          }
                          <RouteTag route={row.got} />
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{row.method}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-[9px]">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Misclassification analysis */}
            <div className="mt-6 border border-amber-900/40 bg-amber-950/10 rounded-lg p-4">
              <h3 className="text-[10px] font-mono font-semibold text-amber-400 uppercase tracking-wider mb-3">
                Known Misclassifications (V1) → Fixed in V2
              </h3>
              <div className="space-y-3">
                {[
                  {
                    query: 'Tell me the latest news about transformers',
                    v1: 'VECTOR_DB — "transformers" is in AI_ML_TERMS, explanation check fired first',
                    v2: 'WEB_SEARCH — web signal check now runs BEFORE explanation check in route_heuristic()',
                    fix: 'Reordered priority in route_heuristic(): web signals checked ahead of explanation patterns when both AI terms AND time signals present',
                  },
                  {
                    query: "What's new in machine learning this week?",
                    v1: 'VECTOR_DB — "this week" was not in WEB_SEARCH_SIGNALS list',
                    v2: 'WEB_SEARCH — "this week", "this month" added to WEB_SEARCH_SIGNALS',
                    fix: 'Extended WEB_SEARCH_SIGNALS list with temporal phrases',
                  },
                  {
                    query: 'Can you explain attention mechanism?',
                    v1: 'Fell through heuristics (startswith check missed it) → called LLM router → +1s latency',
                    v2: 'VECTOR_DB via heuristic — "can you explain" now in anywhere_patterns',
                    fix: 'Extended _is_explanation_query() with anywhere_patterns matching mid-sentence forms',
                  },
                ].map((m, i) => (
                  <div key={i} className="border border-zinc-800 rounded p-3 bg-slate-950">
                    <p className="text-slate-200 mb-2">"{m.query}"</p>
                    <div className="text-[9px] space-y-1">
                      <p><span className="text-amber-400">V1 (wrong): </span>{m.v1}</p>
                      <p><span className="text-emerald-400">V2 (fixed): </span>{m.v2}</p>
                      <p><span className="text-indigo-400">How fixed: </span>{m.fix}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Chunking ── */}
        {activeTab === 'chunking' && (
          <div className="max-w-4xl space-y-6">
            <div className="bg-slate-900/60 border border-zinc-800 rounded-lg p-4">
              <h2 className="text-xs font-semibold text-slate-200 mb-2">Chunking Strategy: V1 vs V2</h2>
              <p className="text-[10px] text-slate-500 font-mono">
                Chunking determines the granularity and semantic coherence of what gets stored in ChromaDB and retrieved at query time.
                The right strategy depends on file type and content structure.
              </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {CHUNKING_COMPARISON.map((strategy, i) => (
                <div key={i} className={`border rounded-lg overflow-hidden ${strategy.color}`}>
                  <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                    <h3 className="text-[10px] font-mono font-semibold text-slate-200">{strategy.label}</h3>
                    <span className={`px-2 py-0.5 rounded border text-[8px] font-mono ${strategy.tagColor}`}>
                      {strategy.config}
                    </span>
                  </div>
                  <div className="p-4 space-y-3">
                    <ul className="space-y-1.5">
                      {strategy.problems.map((p, j) => (
                        <li key={j} className="flex items-start gap-2 text-[10px] font-mono text-slate-400">
                          <span className="text-slate-600 mt-0.5 shrink-0">{i === 0 ? '✗' : '✓'}</span>
                          {p}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3">
                      <p className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">Example chunk output:</p>
                      <pre className={`text-[9px] font-mono rounded p-3 border leading-relaxed whitespace-pre-wrap ${
                        i === 0
                          ? 'bg-amber-950/10 border-amber-900/30 text-amber-200/70'
                          : 'bg-emerald-950/10 border-emerald-900/30 text-emerald-200/70'
                      }`}>
                        {strategy.example}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Why it matters */}
            <div className="border border-indigo-800/40 bg-indigo-950/10 rounded-lg p-4">
              <h3 className="text-[10px] font-mono font-semibold text-indigo-400 uppercase tracking-wider mb-3">
                Why Chunking Matters for Retrieval Quality
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10px] font-mono">
                {[
                  { title: 'Too small chunks', problem: 'Lose context — "softmax" chunk doesn\'t mention "attention" at all. Retrieval brings back isolated fragments.' },
                  { title: 'Too large chunks', problem: 'Multiple concepts bundled together. Top-k retrieves one huge chunk that\'s 80% irrelevant noise.' },
                  { title: 'V2 approach', problem: 'Sections align with natural knowledge units. Each chunk is one coherent concept — better precision for the reranker to work with.' },
                ].map((item, i) => (
                  <div key={i} className={`border rounded p-3 ${i < 2 ? 'border-zinc-800 bg-slate-950' : 'border-indigo-800/40 bg-indigo-950/20'}`}>
                    <p className={`font-semibold mb-1.5 ${i < 2 ? 'text-slate-400' : 'text-indigo-300'}`}>{item.title}</p>
                    <p className="text-slate-500 leading-relaxed">{item.problem}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Architecture ── */}
        {activeTab === 'architecture' && (
          <div className="max-w-4xl space-y-6">
            <div className="bg-slate-900/60 border border-zinc-800 rounded-lg p-4">
              <h2 className="text-xs font-semibold text-slate-200 mb-2">MindMesh V3 — Agentic RAG Pipeline</h2>
              <p className="text-[10px] text-slate-500 font-mono">
                Full end-to-end architecture with routing, retrieval, generation, and fallback mechanisms.
              </p>
            </div>

            {/* Pipeline Flow */}
            <div className="border border-zinc-800 rounded-lg p-5 bg-slate-950">
              <p className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-5">End-to-End Flow</p>
              <div className="space-y-2">
                {[
                  {
                    step: '1', label: 'User Query', detail: 'Text / Voice / File upload',
                    color: 'border-slate-700 bg-slate-900 text-slate-300', icon: MessageSquare,
                  },
                  {
                    step: '2', label: 'Hybrid Router', detail: 'Heuristics → LLM → Keyword fallback',
                    color: 'border-violet-800/60 bg-violet-950/30 text-violet-300', icon: Route,
                  },
                  {
                    step: '3a', label: 'CASUAL / UNRELATED', detail: 'No retrieval — direct LLM response or polite deflection',
                    color: 'border-zinc-700 bg-zinc-900 text-zinc-400', icon: MessageSquare,
                  },
                  {
                    step: '3b', label: 'WEB_SEARCH', detail: 'DuckDuckGo search (no API key) → context → LLM',
                    color: 'border-sky-800/60 bg-sky-950/30 text-sky-300', icon: Globe,
                  },
                  {
                    step: '3c', label: 'DOCUMENT / VECTOR_DB', detail: 'ChromaDB retrieval pipeline (below)',
                    color: 'border-indigo-800/60 bg-indigo-950/30 text-indigo-300', icon: Database,
                  },
                  {
                    step: '4', label: 'V2 Retrieval Pipeline', detail: 'Multi-Query → Hybrid BM25+Semantic [0.4/0.6] → Cross-Encoder Reranker (k=8→top5)',
                    color: 'border-indigo-800/60 bg-indigo-950/20 text-indigo-300', icon: Database,
                  },
                  {
                    step: '5', label: 'Fallback Detection', detail: 'If VECTOR_DB returns 0 docs AND time-sensitive signals → auto-redirect to WEB_SEARCH',
                    color: 'border-amber-800/60 bg-amber-950/20 text-amber-300', icon: Zap,
                  },
                  {
                    step: '6', label: 'V2 Hardened Generation', detail: 'Context-only prompt · Structured format · "I don\'t know" fallback enforced',
                    color: 'border-emerald-800/60 bg-emerald-950/20 text-emerald-300', icon: Brain,
                  },
                ].map((node, i, arr) => (
                  <div key={node.step} className="relative">
                    <div className={`border rounded-lg px-4 py-3 flex items-center gap-3 ${node.color}`}>
                      <div className="w-6 h-6 rounded border border-current/30 flex items-center justify-center shrink-0">
                        <node.icon size={10} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] font-mono opacity-50">Step {node.step}</span>
                          <span className="text-[10px] font-semibold font-mono">{node.label}</span>
                        </div>
                        <p className="text-[9px] font-mono opacity-70 mt-0.5">{node.detail}</p>
                      </div>
                    </div>
                    {i < arr.length - 1 && (
                      <div className="flex justify-center my-1">
                        <div className="w-px h-4 bg-zinc-800" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* V2 Retrieval Pipeline Detail */}
            <div className="border border-indigo-800/40 bg-indigo-950/10 rounded-lg p-4">
              <h3 className="text-[10px] font-mono font-semibold text-indigo-400 uppercase tracking-wider mb-4">
                V2 Retrieval Pipeline — Detail
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    title: '1. Multi-Query Retrieval',
                    detail: 'LLM decomposes the question into 3 sub-questions. Each sub-question retrieves independently → union of results. Catches concepts a single query might miss.',
                    tag: 'Coverage',
                    tagColor: 'text-violet-400 border-violet-800/50',
                  },
                  {
                    title: '2. Hybrid Search',
                    detail: 'BM25 (keyword) + Semantic (embedding) combined with EnsembleRetriever. Weights: [0.4 BM25, 0.6 Semantic]. BM25 catches exact technical terms like "BLEU score", semantic handles paraphrases.',
                    tag: 'Precision',
                    tagColor: 'text-sky-400 border-sky-800/50',
                  },
                  {
                    title: '3. Cross-Encoder Reranker',
                    detail: 'BAAI/bge-reranker-base scores each (query, chunk) pair jointly — not just embedding similarity. Top 5 from 8 candidates selected. Eliminates false-positive semantic matches.',
                    tag: 'Relevance',
                    tagColor: 'text-emerald-400 border-emerald-800/50',
                  },
                ].map((item, i) => (
                  <div key={i} className="border border-zinc-800 rounded-lg p-3 bg-slate-950">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-mono font-semibold text-slate-200">{item.title}</p>
                      <span className={`px-1.5 py-0.5 rounded border text-[8px] font-mono ${item.tagColor}`}>{item.tag}</span>
                    </div>
                    <p className="text-[9px] font-mono text-slate-500 leading-relaxed">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tech Stack */}
            <div className="border border-zinc-800 rounded-lg p-4">
              <h3 className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-3">Tech Stack</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[9px] font-mono">
                {[
                  ['Embeddings', 'all-MiniLM-L6-v2', 'text-indigo-400'],
                  ['Vector DB', 'ChromaDB (persistent)', 'text-violet-400'],
                  ['LLM', 'Llama-3.3-70B via Groq', 'text-sky-400'],
                  ['Reranker', 'BAAI/bge-reranker-base', 'text-emerald-400'],
                  ['Keyword Search', 'BM25 (rank_bm25)', 'text-amber-400'],
                  ['Web Search', 'DuckDuckGo (no API key)', 'text-rose-400'],
                  ['Backend', 'FastAPI + Python', 'text-slate-400'],
                  ['Frontend', 'React + TypeScript + Vite', 'text-slate-400'],
                ].map(([k, v, c]) => (
                  <div key={k} className="border border-zinc-800 rounded p-2 bg-slate-950">
                    <p className={`font-semibold mb-0.5 ${c}`}>{k}</p>
                    <p className="text-slate-500">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
