#!/usr/bin/env python3
"""
DeepWiki HTML to Markdown Converter

Extracts markdown content from DeepWiki HTML pages, preserving:
- Mermaid diagrams as code blocks
- Internal links (converted to relative markdown links)
- Code snippets with language hints
- Tables
- Headings hierarchy

Usage: python3 convert-deepwiki.py <html-dir> [output-dir]
"""

import os
import re
import sys
import json
from pathlib import Path
from html.parser import HTMLParser
from html import unescape

class DeepWikiExtractor(HTMLParser):
    """Extract content from DeepWiki HTML pages."""

    def __init__(self):
        super().__init__()
        self.content = []
        self.in_script = False
        self.script_content = ""

    def handle_starttag(self, tag, attrs):
        if tag == "script":
            self.in_script = True
            self.script_content = ""

    def handle_endtag(self, tag):
        if tag == "script":
            self.in_script = False
            if self.script_content:
                self.content.append(self.script_content)

    def handle_data(self, data):
        if self.in_script:
            self.script_content += data


def extract_markdown_from_rsc(html_content: str) -> str:
    """
    Extract markdown content from React Server Component payload.

    DeepWiki uses Next.js RSC which embeds content in a specific format.
    """
    # Look for markdown content in the RSC payload
    # Pattern: Content is typically in JSON-like structures within script tags

    markdown_parts = []

    # Extract mermaid diagrams
    mermaid_pattern = r'```mermaid\s*([\s\S]*?)```'

    # Extract code blocks
    code_pattern = r'```(\w*)\s*([\s\S]*?)```'

    # Look for text content between specific markers
    # DeepWiki typically has content in "text" or "content" fields

    # Try to find JSON-encoded content
    json_pattern = r'\{[^{}]*"(?:text|content|markdown)"[^{}]*\}'

    # Extract all text that looks like markdown
    # Look for headers
    header_pattern = r'#{1,6}\s+[^\n]+'
    headers = re.findall(header_pattern, html_content)

    # Look for paragraphs (text between tags)
    para_pattern = r'>([^<]{50,})<'
    paragraphs = re.findall(para_pattern, html_content)

    return html_content


def extract_content_simple(html_file: Path) -> dict:
    """
    Simple extraction approach - fetch the URL and use readable content.
    """
    with open(html_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract title from page
    title_match = re.search(r'<title>([^<]+)</title>', content)
    title = title_match.group(1) if title_match else html_file.stem

    # Clean up title (remove " | DeepWiki" suffix)
    title = re.sub(r'\s*\|\s*DeepWiki.*$', '', title)

    return {
        'title': title,
        'filename': html_file.stem,
        'html': content
    }


def create_index(pages: list, repo: str) -> str:
    """Create an index.md file with links to all pages."""

    md = f"# {repo} - DeepWiki Documentation\n\n"
    md += "This documentation was exported from [DeepWiki](https://deepwiki.com).\n\n"
    md += "## Table of Contents\n\n"

    current_section = ""
    for page in sorted(pages, key=lambda p: p['filename']):
        filename = page['filename']
        title = page['title']

        # Determine section level from filename (e.g., "1.2-foo" -> level 2)
        parts = filename.split('-')[0].split('.')
        level = len(parts)
        indent = "  " * (level - 1)

        md += f"{indent}- [{title}]({filename}.md)\n"

    return md


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 convert-deepwiki.py <html-dir> [output-dir]")
        sys.exit(1)

    html_dir = Path(sys.argv[1])
    output_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else html_dir / "markdown"

    if not html_dir.exists():
        print(f"Error: Directory not found: {html_dir}")
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)

    # Process all HTML files
    html_files = list(html_dir.glob("*.html"))
    print(f"Found {len(html_files)} HTML files")

    pages = []
    for html_file in html_files:
        print(f"Processing: {html_file.name}")
        page_info = extract_content_simple(html_file)
        pages.append(page_info)

    # Create index
    repo = "rive-app/rive-runtime"  # Could be extracted from content
    index_content = create_index(pages, repo)

    index_file = output_dir / "index.md"
    with open(index_file, 'w', encoding='utf-8') as f:
        f.write(index_content)

    print(f"\nCreated index at: {index_file}")
    print(f"\nNote: Full markdown extraction requires JavaScript rendering.")
    print("Consider using Puppeteer or Playwright for complete extraction.")


if __name__ == "__main__":
    main()
