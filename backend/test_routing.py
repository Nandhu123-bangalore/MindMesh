#!/usr/bin/env python3
"""
MindMesh V3 Agentic RAG — Routing Test Suite

Tests 10+ queries covering all routing paths.
Run with: python test_routing.py [--live]

  --live   Also hit /chat endpoint (requires running server + GROQ_API_KEY)
"""

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from router import route_query, route_heuristic

# (query, expected_route, active_files, description)
TEST_CASES = [
    ("Hi, how are you?", "CASUAL", None, "Greeting — no retrieval"),
    ("Hello!", "CASUAL", None, "Short greeting"),
    ("What's the weather today?", "UNRELATED", None, "Weather — out of scope"),
    ("Who won the football game last night?", "UNRELATED", None, "Sports — out of scope"),
    ("Explain the attention mechanism", "VECTOR_DB", None, "Stable ML concept"),
    ("What is backpropagation?", "VECTOR_DB", None, "Classic ML topic"),
    ("What is LoRA fine-tuning?", "VECTOR_DB", None, "Established technique"),
    ("What is the latest model released by OpenAI?", "WEB_SEARCH", None, "Time-sensitive AI news"),
    ("What new AI models came out in 2026?", "WEB_SEARCH", None, "Recent releases"),
    ("Summarize my uploaded document", "DOCUMENT", ["test_notes.txt"], "Document-specific query"),
    ("What does my pdf say about neural networks?", "DOCUMENT", ["research.pdf"], "Document reference"),
    ("Thanks for the help!", "CASUAL", None, "Gratitude"),
    ("Write me a recipe for pasta", "UNRELATED", None, "Recipe — unrelated"),
]

# Known misclassification cases (before fixes)
MISCLASSIFICATION_CASES = [
    (
        "Tell me the latest news about transformers",
        "WEB_SEARCH",
        "Was misclassified as VECTOR_DB because 'transformers' is an AI term",
    ),
    (
        "What's new in machine learning this week?",
        "WEB_SEARCH",
        "Time-sensitive but 'machine learning' triggers VECTOR_DB heuristics",
    ),
]


def test_heuristics():
    print("=" * 60)
    print("HEURISTIC ROUTING TESTS")
    print("=" * 60)
    passed = 0
    failed = 0

    for query, expected, files, desc in TEST_CASES:
        result = route_heuristic(query, files)
        # Heuristics may return None for ambiguous cases — that's OK
        status = "PASS" if (result == expected or result is None) else "FAIL"
        if result == expected:
            passed += 1
        elif result is None:
            passed += 1  # Will be handled by LLM
        else:
            failed += 1
        print(f"  [{status}] {desc}")
        print(f"         Query: {query[:60]}")
        print(f"         Expected: {expected}, Got: {result}")
        print()

    print(f"Heuristic results: {passed} ok, {failed} unexpected\n")
    return failed


def test_llm_routing():
    print("=" * 60)
    print("LLM ROUTING TESTS (requires GROQ_API_KEY)")
    print("=" * 60)

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("  SKIPPED — GROQ_API_KEY not set\n")
        return 0

    from dotenv import load_dotenv
    load_dotenv()
    from langchain_groq import ChatGroq

    llm = ChatGroq(model="llama-3.3-70b-versatile", api_key=api_key, temperature=0.0)

    passed = 0
    failed = 0
    results = []

    for query, expected, files, desc in TEST_CASES:
        result = route_query(query, llm=llm, active_filenames=files)
        route = result["route"]
        ok = route == expected
        status = "PASS" if ok else "FAIL"
        if ok:
            passed += 1
        else:
            failed += 1
        results.append({"query": query, "expected": expected, "got": route, "ok": ok, "desc": desc})
        print(f"  [{status}] {desc}")
        print(f"         Query: {query[:60]}")
        print(f"         Expected: {expected}, Got: {route} ({result.get('method', '?')})")
        print(f"         Reason: {result.get('reasoning', '')[:80]}")
        print()

    print(f"LLM routing: {passed}/{len(TEST_CASES)} passed, {failed} failed\n")
    return failed, results


def test_live_chat():
    print("=" * 60)
    print("LIVE /chat ENDPOINT TESTS")
    print("=" * 60)

    import urllib.request

    passed = 0
    failed = 0

    for query, expected, files, desc in TEST_CASES:
        payload = json.dumps({"question": query, "activeFiles": files or []}).encode()
        req = urllib.request.Request(
            "http://localhost:8000/chat",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = json.loads(resp.read())
            route = data.get("route", "?")
            ok = route == expected
            status = "PASS" if ok else "FAIL"
            if ok:
                passed += 1
            else:
                failed += 1
            print(f"  [{status}] {desc}")
            print(f"         Route: {route} (expected {expected})")
            print(f"         Response preview: {data.get('response', '')[:100]}...")
            print()
        except Exception as e:
            failed += 1
            print(f"  [ERROR] {desc}: {e}\n")

    print(f"Live chat: {passed}/{len(TEST_CASES)} passed, {failed} failed\n")
    return failed


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true", help="Run live /chat tests")
    args = parser.parse_args()

    from dotenv import load_dotenv
    load_dotenv()

    h_fail = test_heuristics()
    llm_fail, llm_results = test_llm_routing()

    if args.live:
        live_fail = test_live_chat()
    else:
        live_fail = 0
        print("(Skipping live tests. Use --live to test /chat endpoint)\n")

    # Report misclassifications
    if llm_results:
        misclassified = [r for r in llm_results if not r["ok"]]
        if misclassified:
            print("=" * 60)
            print("MISCLASSIFICATIONS FOUND")
            print("=" * 60)
            for m in misclassified:
                print(f"  Query: {m['query']}")
                print(f"  Expected: {m['expected']}, Got: {m['got']}")
                print()

    total_fail = h_fail + llm_fail + live_fail
    sys.exit(1 if total_fail > 0 else 0)
