import os
import re
from typing import List, Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup


DEFAULT_USER_AGENT = "Mozilla/5.0"
MAX_PAGES = 10
DEFAULT_ALLOWED_DOMAINS = [
    "deeplearning.ai",
    "huggingface.co",
    "openai.com",
    "anthropic.com",
    "google.com",
    "pytorch.org",
    "tensorflow.org",
    "keras.io",
    "medium.com",
    "towardsdatascience.com",
    "machinelearningmastery.com",
    "towardsai.net",
]


def clean_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text or "")
    return text.strip()


def extract_text_from_html(html: str, url: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    for selector in ["header", "nav", "footer", "aside"]:
        for elem in soup.select(selector):
            elem.decompose()

    text_parts = []
    for node in soup.find_all(["h1", "h2", "h3", "p", "li", "code", "pre"]):
        text = clean_text(node.get_text(" ", strip=True))
        if text:
            text_parts.append(text)

    if not text_parts:
        text_parts.append(clean_text(soup.get_text(" ", strip=True)))

    joined = "\n".join(text_parts)
    return f"Source URL: {url}\n\n{joined}"


def fetch_page(url: str) -> Optional[str]:
    headers = {"User-Agent": DEFAULT_USER_AGENT}
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        return response.text
    except Exception as exc:
        print(f"Failed to fetch {url}: {exc}")
        return None


def discover_links(html: str, base_url: str, allowed_domains: Optional[List[str]] = None) -> List[str]:
    soup = BeautifulSoup(html, "html.parser")
    links = []
    allowed_domains = allowed_domains or DEFAULT_ALLOWED_DOMAINS
    base_netloc = urlparse(base_url).netloc.lower()

    for anchor in soup.find_all("a", href=True):
        href = anchor["href"].strip()
        if not href or href.startswith(("mailto:", "tel:", "javascript:")):
            continue
        absolute = urljoin(base_url, href)
        parsed = urlparse(absolute)
        if parsed.scheme not in {"http", "https"}:
            continue

        netloc = parsed.netloc.lower()
        allowed = any(
            netloc == domain.lower() or netloc.endswith(f".{domain.lower()}")
            for domain in allowed_domains
        )
        if not allowed:
            continue

        if netloc != base_netloc:
            same_domain = any(
                netloc == domain.lower() or netloc.endswith(f".{domain.lower()}")
                for domain in allowed_domains
            )
            if not same_domain:
                continue

        links.append(absolute)
    return links


def scrape_site(start_url: str, max_pages: int = MAX_PAGES, allowed_domains: Optional[List[str]] = None) -> List[dict]:
    visited = set()
    queue = [start_url]
    pages = []

    while queue and len(pages) < max_pages:
        current_url = queue.pop(0)
        if current_url in visited:
            continue
        visited.add(current_url)

        html = fetch_page(current_url)
        if not html:
            continue

        content = extract_text_from_html(html, current_url)
        if content.strip():
            pages.append({"url": current_url, "content": content})

        for link in discover_links(html, current_url, allowed_domains=allowed_domains):
            if link not in visited and link not in queue:
                queue.append(link)

    return pages


def build_documents_from_urls(
    urls: List[str],
    max_pages: int = MAX_PAGES,
    allowed_domains: Optional[List[str]] = None,
) -> List[dict]:
    documents = []
    for url in urls:
        scraped_pages = scrape_site(url, max_pages=max_pages, allowed_domains=allowed_domains)
        for page in scraped_pages:
            documents.append(page)
    return documents
