"""
Agentic query router for MindMesh V3.

Uses a hybrid approach:
  1. Fast heuristics for obvious cases (greetings, clear out-of-scope)
  2. LLM classification for ambiguous queries
  3. Keyword fallback if the LLM call fails

Routes:
  CASUAL      — greetings, thanks, small talk (no retrieval)
  UNRELATED   — questions outside AI/ML scope
  WEB_SEARCH  — time-sensitive / current-events questions
  DOCUMENT    — questions about user-uploaded files
  VECTOR_DB   — stable AI/ML concepts from the knowledge base
"""

import json
import re
from typing import Optional

CASUAL_PATTERNS = [
    r"^(hi|hello|hey|howdy|yo|sup|thanks|thank you|bye|goodbye|good morning|good afternoon|good evening)\b",
    r"^how are you\b",
    r"^what'?s up\b",
    r"^nice to meet you\b",
]

UNRELATED_KEYWORDS = [
    "weather", "temperature", "forecast", "football", "soccer", "basketball",
    "recipe", "restaurant", "travel", "flight", "hotel", "stock price",
    "bitcoin price", "grocery", "shopping", "wedding", "birthday party",
    "movie review", "tv show", "celebrity gossip",
]

WEB_SEARCH_SIGNALS = [
    "latest", "recent", "newest", "just released", "released today",
    "announced today", "this week", "this month", "currently",
    "as of 202", "in 2025", "in 2026", "what is new",
    "most recent", "breaking", "update on", "news about",
]

DOCUMENT_SIGNALS = [
    "my document", "my file", "my pdf", "my upload", "uploaded file",
    "uploaded document", "the document i", "the file i", "this document",
    "this pdf", "this file", "in the pdf", "in my pdf", "from the pdf",
    "summarize the", "summary of the", "what does the document",
    "what does my", "according to my", "based on my upload",
]

AI_ML_TERMS = [
    "ai", "machine learning", "ml", "deep learning", "neural", "transformer",
    "attention", "llm", "gpt", "bert", "embedding", "vector", "rag",
    "fine-tun", "prompt", "langchain", "pytorch", "tensorflow", "gradient",
    "backprop", "loss function", "classification", "regression", "clustering",
    "reinforcement", "diffusion", "lora", "qlora", "openai", "anthropic",
    "gemini", "huggingface", "chroma", "retrieval",
]

VALID_ROUTES = {"CASUAL", "UNRELATED", "WEB_SEARCH", "DOCUMENT", "VECTOR_DB"}


def _matches_any(patterns: list[str], text: str) -> bool:
    for p in patterns:
        if re.search(p, text, re.IGNORECASE):
            return True
    return False


def _has_ai_terms(text: str) -> bool:
    lower = text.lower()
    return any(term in lower for term in AI_ML_TERMS)


def _has_document_signals(text: str) -> bool:
    lower = text.lower()
    return any(sig in lower for sig in DOCUMENT_SIGNALS)


def _has_web_search_signals(text: str) -> bool:
    lower = text.lower()
    return any(sig in lower for sig in WEB_SEARCH_SIGNALS)


def _has_unrelated_signals(text: str) -> bool:
    lower = text.lower()
    return any(kw in lower for kw in UNRELATED_KEYWORDS)


def _is_explanation_query(text: str) -> bool:
    """Queries asking to explain/describe a concept should prefer the knowledge base."""
    lower = text.lower().strip()
    explanation_starts = (
        "explain", "describe", "how does", "how do",
        "walk me through", "help me understand",
    )
    return any(lower.startswith(s) for s in explanation_starts)


def _is_factual_lookup_query(text: str) -> bool:
    """Queries asking for current facts (latest model, recent release)."""
    lower = text.lower()
    lookup_patterns = (
        "what is the latest", "what is the newest", "what is the most recent",
        "what are the latest", "what new", "what did .* announce",
        "who released", "when was .* released", "latest news", "recent news",
        "news about", "came out in 20", "released by",
    )
    return any(re.search(p, lower) for p in lookup_patterns)


def route_heuristic(question: str, active_filenames: Optional[list[str]] = None) -> Optional[str]:
    """Fast rule-based routing for obvious cases. Returns None if uncertain."""
    text = question.strip()
    if not text:
        return "VECTOR_DB"

    lower = text.lower()

    # Very short greetings
    if len(text.split()) <= 6 and _matches_any(CASUAL_PATTERNS, lower) and not _has_ai_terms(lower):
        return "CASUAL"

    # Clear out-of-scope (no AI terms)
    if _has_unrelated_signals(lower) and not _has_ai_terms(lower):
        return "UNRELATED"

    # Document-specific when files are active
    if active_filenames and _has_document_signals(lower):
        return "DOCUMENT"

    # Factual time-sensitive lookups → web search
    if _is_factual_lookup_query(lower) and (_has_ai_terms(lower) or "model" in lower):
        return "WEB_SEARCH"

    # Explanation queries about AI concepts → knowledge base
    if _is_explanation_query(lower) and _has_ai_terms(lower):
        return "VECTOR_DB"

    # Strong time-sensitivity signals with AI context
    if _has_web_search_signals(lower) and (_has_ai_terms(lower) or "model" in lower or "openai" in lower or "google" in lower):
        return "WEB_SEARCH"

    return None


def route_with_llm(question: str, llm, active_filenames: Optional[list[str]] = None) -> dict:
    """
    LLM-based routing. Returns {route, reasoning}.
    """
    files_context = ""
    if active_filenames:
        files_context = f"\nThe user has these documents uploaded and active: {', '.join(active_filenames)}"

    prompt = f"""You are a query router for MindMesh, an AI/ML knowledge assistant.

Classify the user query into exactly ONE route:

- CASUAL: Greetings, thanks, small talk, "how are you" — needs NO retrieval
- UNRELATED: Questions completely outside AI/ML/computing (weather, sports, recipes, travel)
- WEB_SEARCH: Time-sensitive questions needing current/recent info (latest models, recent releases, news, 2025/2026 events)
- DOCUMENT: Questions specifically about the user's uploaded documents/files
- VECTOR_DB: Stable, well-established AI/ML concepts answerable from a knowledge base (attention mechanism, backprop, LoRA, transformers, etc.)

{files_context}

User query: "{question}"

Respond with ONLY valid JSON (no markdown):
{{"route": "<ROUTE>", "reasoning": "<one sentence why>"}}"""

    try:
        response = llm.invoke(prompt).content.strip()
        # Extract JSON from response (handle markdown fences)
        json_match = re.search(r"\{[^{}]*\}", response, re.DOTALL)
        if json_match:
            parsed = json.loads(json_match.group())
            route = parsed.get("route", "VECTOR_DB").upper()
            reasoning = parsed.get("reasoning", "")
            if route not in VALID_ROUTES:
                route = "VECTOR_DB"
            return {"route": route, "reasoning": reasoning}
    except Exception as e:
        print(f"LLM routing failed: {e}")

    return {"route": "VECTOR_DB", "reasoning": "LLM routing unavailable; defaulting to knowledge base."}


def route_query(question: str, llm=None, active_filenames: Optional[list[str]] = None) -> dict:
    """
    Hybrid router: heuristics first, then LLM, with keyword fallback.
    Returns {route, reasoning, method}.
    """
    # Step 1: Fast heuristics
    heuristic_route = route_heuristic(question, active_filenames)
    if heuristic_route:
        return {
            "route": heuristic_route,
            "reasoning": f"Heuristic match for {heuristic_route.lower().replace('_', ' ')} pattern.",
            "method": "heuristic",
        }

    # Step 2: LLM classification
    if llm:
        llm_result = route_with_llm(question, llm, active_filenames)
        return {**llm_result, "method": "llm"}

    # Step 3: Keyword fallback
    lower = question.lower()
    if active_filenames and _has_document_signals(lower):
        return {"route": "DOCUMENT", "reasoning": "Document signal detected.", "method": "keyword"}
    if _has_web_search_signals(lower):
        return {"route": "WEB_SEARCH", "reasoning": "Time-sensitive keywords detected.", "method": "keyword"}
    if _has_ai_terms(lower):
        return {"route": "VECTOR_DB", "reasoning": "AI/ML topic detected.", "method": "keyword"}

    return {"route": "VECTOR_DB", "reasoning": "Default to knowledge base.", "method": "keyword"}


def should_fallback_to_web(route: str, docs_found: int, question: str) -> bool:
    """
    Detect misrouting: VECTOR_DB returned nothing but query looks time-sensitive.
    """
    if route != "VECTOR_DB":
        return False
    if docs_found > 0:
        return False
    return _has_web_search_signals(question)
