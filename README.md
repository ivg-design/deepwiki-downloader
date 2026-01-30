# DeepWiki Downloader

Download documentation from [DeepWiki](https://deepwiki.com) and save it as a local markdown repository with preserved mermaid diagrams and internal links.

## Installation

```bash
git clone https://github.com/ivg-design/deepwiki-downloader.git
cd deepwiki-downloader
npm install
```

## Usage

```bash
# Download any public GitHub repo's DeepWiki documentation
node download-with-puppeteer.js <owner/repo> [output-dir]

# Example: Download Rive Runtime docs
node download-with-puppeteer.js rive-app/rive-runtime ./rive-runtime-docs
```

## Output Structure

```
output-dir/
├── index.md                    # Table of contents with links
├── 1-overview.md
├── 1.1-concepts.md
├── 2-core-system.md
│   ...
└── N-final-section.md
```

## Features Preserved

- ✅ **Mermaid diagrams** - Saved as fenced code blocks
- ✅ **Code snippets** - With language syntax hints
- ✅ **Tables** - Converted to markdown tables
- ✅ **Internal links** - Converted to relative `.md` paths
- ✅ **Heading hierarchy** - Proper markdown headers

## How It Works

1. Uses Puppeteer to render DeepWiki pages (React Server Components)
2. Waits for mermaid diagrams to render
3. Extracts content and converts to markdown
4. Fixes internal links to use relative paths
5. Generates an index.md with table of contents

## Alternative: MCP Server

DeepWiki provides an MCP server for programmatic access:

```bash
# Add to Claude Code
claude mcp add -s user -t http deepwiki https://mcp.deepwiki.com/mcp
```

Tools: `read_wiki_structure`, `read_wiki_contents`, `ask_question`

## Customization

Update the `PAGES` array in the script for different repositories. Get page IDs via MCP `read_wiki_structure` or from the DeepWiki sidebar.

## License

MIT
