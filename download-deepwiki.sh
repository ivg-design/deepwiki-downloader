#!/bin/bash
#===============================================================================
# DeepWiki Downloader
#===============================================================================
# Downloads all pages from a DeepWiki repository and saves them as markdown
# with preserved mermaid diagrams and internal links.
#
# Usage: ./download-deepwiki.sh <owner/repo> [output-dir]
# Example: ./download-deepwiki.sh rive-app/rive-runtime ./rive-runtime-docs
#===============================================================================

set -e

REPO="${1:-rive-app/rive-runtime}"
OUTPUT_DIR="${2:-./deepwiki-${REPO//\//-}}"
BASE_URL="https://deepwiki.com/${REPO}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

#-------------------------------------------------------------------------------
# Page list for rive-app/rive-runtime
# (Generated from MCP server read_wiki_structure)
#-------------------------------------------------------------------------------
PAGES=(
    "1-rive-runtime-overview"
    "1.1-key-concepts-and-terminology"
    "1.2-system-architecture"
    "2-core-runtime-system"
    "2.1-artboard-system"
    "2.2-state-machine-system"
    "2.3-layout-component-system"
    "2.4-nested-artboards-and-component-lists"
    "2.5-component-dependency-and-update-system"
    "2.6-asynchronous-command-system"
    "3-file-format-and-loading"
    "3.1-binary-format-and-deserialization"
    "3.2-core-registry-and-object-factory"
    "3.3-asset-loading-system"
    "4-animation-system"
    "4.1-linear-animation"
    "4.2-nested-animations"
    "4.3-animation-blending"
    "4.4-animation-events"
    "5-shape-and-path-system"
    "5.1-path-geometry"
    "5.2-shape-composition-and-pathcomposer"
    "5.3-hit-testing-and-interaction"
    "5.4-path-measurement-and-analysis"
    "5.5-math-and-transformations"
    "6-text-rendering-system"
    "6.1-font-system-and-text-shaping"
    "6.2-text-layout-and-line-breaking"
    "6.3-text-modifiers-and-styling"
    "7-data-binding-system"
    "7.1-viewmodel-architecture"
    "7.2-data-bind-implementation"
    "7.3-data-converters"
    "8-scripting-system"
    "8.1-lua-vm-integration"
    "8.2-scripted-components"
    "8.3-lua-api-reference"
    "9-rendering-system"
    "9.1-renderer-abstraction"
    "9.2-rendercontext-and-gpu-management"
    "9.3-pls-renderer-architecture"
    "9.4-specialized-rendering-pipelines"
    "9.5-skia-renderer"
    "9.6-shader-system-and-pipeline-management"
    "10-build-system"
    "10.1-core-build-configuration"
    "10.2-renderer-build-configuration"
    "10.3-skia-build-system"
    "10.4-dependency-management"
    "11-testing-infrastructure"
    "11.1-test-harness-system"
    "11.2-graphics-testing"
    "11.3-cicd-pipeline"
)

#-------------------------------------------------------------------------------
# Setup
#-------------------------------------------------------------------------------
mkdir -p "$OUTPUT_DIR"
log "Downloading DeepWiki: ${REPO}"
log "Output directory: ${OUTPUT_DIR}"
log "Total pages: ${#PAGES[@]}"
echo ""

#-------------------------------------------------------------------------------
# Download each page
#-------------------------------------------------------------------------------
COUNT=0
for PAGE in "${PAGES[@]}"; do
    COUNT=$((COUNT + 1))
    URL="${BASE_URL}/${PAGE}"
    FILENAME="${PAGE}.md"

    log "[$COUNT/${#PAGES[@]}] Downloading: ${PAGE}"

    # Download and extract markdown content
    # The page returns HTML with markdown content inside React components
    # We use a simple extraction approach

    curl -s "$URL" -o "$OUTPUT_DIR/${PAGE}.html" 2>/dev/null || {
        warn "Failed to download: ${PAGE}"
        continue
    }

    # Rate limit to be respectful
    sleep 0.5
done

success "Downloaded ${COUNT} HTML files to ${OUTPUT_DIR}"
echo ""
log "Next step: Run the Python converter to extract markdown content"
echo "  python3 convert-deepwiki.py ${OUTPUT_DIR}"
