#!/usr/bin/env node
/**
 * DeepWiki Full Content Downloader
 *
 * Uses Puppeteer to render DeepWiki pages and extract the actual markdown content
 * including mermaid diagrams and properly formatted code blocks.
 *
 * Usage: node download-with-puppeteer.js [owner/repo] [output-dir]
 * Example: node download-with-puppeteer.js rive-app/rive-runtime ./docs
 *
 * Prerequisites: npm install puppeteer
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

const REPO = process.argv[2] || 'rive-app/rive-runtime';
const OUTPUT_DIR = process.argv[3] || `./deepwiki-${REPO.replace('/', '-')}`;
const BASE_URL = `https://deepwiki.com/${REPO}`;

// Page structure for rive-app/rive-runtime
const PAGES = [
    { id: '1-rive-runtime-overview', title: '1. Rive Runtime Overview' },
    { id: '1.1-key-concepts-and-terminology', title: '1.1 Key Concepts and Terminology' },
    { id: '1.2-system-architecture', title: '1.2 System Architecture' },
    { id: '2-core-runtime-system', title: '2. Core Runtime System' },
    { id: '2.1-artboard-system', title: '2.1 Artboard System' },
    { id: '2.2-state-machine-system', title: '2.2 State Machine System' },
    { id: '2.3-layout-component-system', title: '2.3 Layout Component System' },
    { id: '2.4-nested-artboards-and-component-lists', title: '2.4 Nested Artboards and Component Lists' },
    { id: '2.5-component-dependency-and-update-system', title: '2.5 Component Dependency and Update System' },
    { id: '2.6-asynchronous-command-system', title: '2.6 Asynchronous Command System' },
    { id: '3-file-format-and-loading', title: '3. File Format and Loading' },
    { id: '3.1-binary-format-and-deserialization', title: '3.1 Binary Format and Deserialization' },
    { id: '3.2-core-registry-and-object-factory', title: '3.2 Core Registry and Object Factory' },
    { id: '3.3-asset-loading-system', title: '3.3 Asset Loading System' },
    { id: '4-animation-system', title: '4. Animation System' },
    { id: '4.1-linear-animation', title: '4.1 Linear Animation' },
    { id: '4.2-nested-animations', title: '4.2 Nested Animations' },
    { id: '4.3-animation-blending', title: '4.3 Animation Blending' },
    { id: '4.4-animation-events', title: '4.4 Animation Events' },
    { id: '5-shape-and-path-system', title: '5. Shape and Path System' },
    { id: '5.1-path-geometry', title: '5.1 Path Geometry' },
    { id: '5.2-shape-composition-and-pathcomposer', title: '5.2 Shape Composition and PathComposer' },
    { id: '5.3-hit-testing-and-interaction', title: '5.3 Hit Testing and Interaction' },
    { id: '5.4-path-measurement-and-analysis', title: '5.4 Path Measurement and Analysis' },
    { id: '5.5-math-and-transformations', title: '5.5 Math and Transformations' },
    { id: '6-text-rendering-system', title: '6. Text Rendering System' },
    { id: '6.1-font-system-and-text-shaping', title: '6.1 Font System and Text Shaping' },
    { id: '6.2-text-layout-and-line-breaking', title: '6.2 Text Layout and Line Breaking' },
    { id: '6.3-text-modifiers-and-styling', title: '6.3 Text Modifiers and Styling' },
    { id: '7-data-binding-system', title: '7. Data Binding System' },
    { id: '7.1-viewmodel-architecture', title: '7.1 ViewModel Architecture' },
    { id: '7.2-data-bind-implementation', title: '7.2 Data Bind Implementation' },
    { id: '7.3-data-converters', title: '7.3 Data Converters' },
    { id: '8-scripting-system', title: '8. Scripting System' },
    { id: '8.1-lua-vm-integration', title: '8.1 Lua VM Integration' },
    { id: '8.2-scripted-components', title: '8.2 Scripted Components' },
    { id: '8.3-lua-api-reference', title: '8.3 Lua API Reference' },
    { id: '9-rendering-system', title: '9. Rendering System' },
    { id: '9.1-renderer-abstraction', title: '9.1 Renderer Abstraction' },
    { id: '9.2-rendercontext-and-gpu-management', title: '9.2 RenderContext and GPU Management' },
    { id: '9.3-pls-renderer-architecture', title: '9.3 PLS Renderer Architecture' },
    { id: '9.4-specialized-rendering-pipelines', title: '9.4 Specialized Rendering Pipelines' },
    { id: '9.5-skia-renderer', title: '9.5 Skia Renderer' },
    { id: '9.6-shader-system-and-pipeline-management', title: '9.6 Shader System and Pipeline Management' },
    { id: '10-build-system', title: '10. Build System' },
    { id: '10.1-core-build-configuration', title: '10.1 Core Build Configuration' },
    { id: '10.2-renderer-build-configuration', title: '10.2 Renderer Build Configuration' },
    { id: '10.3-skia-build-system', title: '10.3 Skia Build System' },
    { id: '10.4-dependency-management', title: '10.4 Dependency Management' },
    { id: '11-testing-infrastructure', title: '11. Testing Infrastructure' },
    { id: '11.1-test-harness-system', title: '11.1 Test Harness System' },
    { id: '11.2-graphics-testing', title: '11.2 Graphics Testing' },
    { id: '11.3-cicd-pipeline', title: '11.3 CI/CD Pipeline' },
];

/**
 * Extract mermaid diagrams from raw HTML by finding page-specific content
 * @param {string} rawHTML - The raw HTML with JS disabled
 * @param {string[]} headings - Array of H2 heading texts from rendered page (used as markers)
 * @param {number} expectedCount - Number of mermaid SVGs found in rendered page
 * @returns {string[]} Array of mermaid diagram source code
 */
function extractMermaidFromHTML(rawHTML, headings, expectedCount) {
    if (expectedCount === 0) return [];

    const diagrams = [];

    // Find the first H2 heading in the markdown content (has ```mermaid nearby)
    let contentStart = -1;
    for (const heading of headings) {
        // Find all occurrences of this heading
        let searchStart = 0;
        while (true) {
            const idx = rawHTML.indexOf(heading, searchStart);
            if (idx === -1) break;

            // Check if this occurrence has mermaid code nearby (within 3000 chars)
            const nearbyContent = rawHTML.substring(idx, idx + 3000);
            if (nearbyContent.includes('```mermaid')) {
                contentStart = idx;
                break;
            }
            searchStart = idx + 1;
        }
        if (contentStart !== -1) break;
    }

    if (contentStart === -1) {
        // Fallback: just take the first N mermaid blocks
        const mermaidBlockPattern = /```mermaid\\n([\s\S]*?)\\n```/g;
        let m;
        while ((m = mermaidBlockPattern.exec(rawHTML)) !== null && diagrams.length < expectedCount) {
            diagrams.push(unescapeMermaid(m[1]));
        }
        return diagrams;
    }

    // Find end of page content - look for section end or limit search
    let contentEnd = rawHTML.length;
    // Try to find the last heading marker to bound our search
    const lastHeading = headings[headings.length - 1];
    if (lastHeading) {
        const lastIdx = rawHTML.indexOf(lastHeading, contentStart);
        if (lastIdx !== -1) {
            // Include content after last heading (add 5000 chars for final section)
            contentEnd = Math.min(lastIdx + 5000, rawHTML.length);
        }
    }

    // Extract mermaid blocks from this section
    const section = rawHTML.substring(contentStart, contentEnd);
    const mermaidBlockPattern = /```mermaid\\n([\s\S]*?)\\n```/g;
    let m;
    while ((m = mermaidBlockPattern.exec(section)) !== null && diagrams.length < expectedCount) {
        diagrams.push(unescapeMermaid(m[1]));
    }

    return diagrams;
}

/**
 * Unescape mermaid code from RSC payload
 */
function unescapeMermaid(code) {
    return code
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '    ')
        .replace(/\\"/g, '"')
        .replace(/\\u003c/g, '<')
        .replace(/\\u003e/g, '>')
        .replace(/\u003c/g, '<')
        .replace(/\u003e/g, '>')
        .trim();
}

/**
 * Extract markdown content from a rendered DeepWiki page
 */
async function extractMarkdown(page, mermaidDiagrams) {
    const rawMarkdown = await page.evaluate(() => {
        // DeepWiki uses .prose class for main content
        const mainContent = document.querySelector('.prose');
        if (!mainContent) return '';

        const results = [];
        let mermaidIndex = 0;

        function processNode(node, depth = 0) {
            if (!node) return;

            // Handle text nodes
            if (node.nodeType === 3) {
                const text = node.textContent;
                if (text && text.trim()) {
                    results.push(text);
                }
                return;
            }

            // Only process element nodes
            if (node.nodeType !== 1) return;

            const el = node;
            const tag = el.tagName.toLowerCase();
            const className = el.className || '';

            // Skip unwanted elements
            if (['script', 'style', 'nav', 'button'].includes(tag)) return;
            if (className.includes('sr-only')) return;

            // Handle SVG - this is likely a rendered mermaid diagram
            if (tag === 'svg') {
                // Insert placeholder for mermaid diagram
                results.push('\n%%MERMAID_PLACEHOLDER%%\n');
                return;
            }

            // Handle specific elements
            switch (tag) {
                case 'h1':
                    results.push(`\n# ${el.textContent.trim()}\n\n`);
                    return;
                case 'h2':
                    results.push(`\n## ${el.textContent.trim()}\n\n`);
                    return;
                case 'h3':
                    results.push(`\n### ${el.textContent.trim()}\n\n`);
                    return;
                case 'h4':
                    results.push(`\n#### ${el.textContent.trim()}\n\n`);
                    return;
                case 'h5':
                    results.push(`\n##### ${el.textContent.trim()}\n\n`);
                    return;
                case 'h6':
                    results.push(`\n###### ${el.textContent.trim()}\n\n`);
                    return;

                case 'p':
                    const text = el.textContent.trim();
                    // Skip if it looks like mermaid CSS
                    if (text.startsWith('#mermaid-') || text.includes('font-family:ui-sans-serif')) {
                        return;
                    }
                    results.push(`\n${text}\n\n`);
                    return;

                case 'pre':
                    // Code block - check for mermaid
                    const codeEl = el.querySelector('code');
                    const codeClass = codeEl?.className || '';
                    let lang = '';

                    if (codeClass.includes('mermaid') || className.includes('mermaid')) {
                        lang = 'mermaid';
                    } else {
                        const langMatch = codeClass.match(/language-(\w+)/);
                        lang = langMatch ? langMatch[1] : '';
                    }

                    let codeText = codeEl?.textContent || el.textContent;

                    // Skip if it looks like rendered mermaid CSS
                    if (codeText.includes('#mermaid-') && codeText.includes('font-family')) {
                        results.push('\n%%MERMAID_PLACEHOLDER%%\n');
                        return;
                    }

                    results.push(`\n\`\`\`${lang}\n${codeText.trim()}\n\`\`\`\n\n`);
                    return;

                case 'code':
                    // Inline code (skip if parent is pre)
                    if (el.parentElement?.tagName.toLowerCase() === 'pre') return;
                    results.push(`\`${el.textContent}\``);
                    return;

                case 'ul':
                    results.push('\n');
                    el.querySelectorAll(':scope > li').forEach(li => {
                        results.push(`- ${li.textContent.trim()}\n`);
                    });
                    results.push('\n');
                    return;

                case 'ol':
                    results.push('\n');
                    el.querySelectorAll(':scope > li').forEach((li, i) => {
                        results.push(`${i + 1}. ${li.textContent.trim()}\n`);
                    });
                    results.push('\n');
                    return;

                case 'table':
                    results.push('\n');
                    const rows = el.querySelectorAll('tr');
                    rows.forEach((row, rowIndex) => {
                        const cells = row.querySelectorAll('th, td');
                        const rowContent = Array.from(cells).map(c => c.textContent.trim()).join(' | ');
                        results.push(`| ${rowContent} |\n`);
                        if (rowIndex === 0) {
                            results.push('|' + Array.from(cells).map(() => '---').join('|') + '|\n');
                        }
                    });
                    results.push('\n');
                    return;

                case 'blockquote':
                    const lines = el.textContent.trim().split('\n');
                    lines.forEach(line => {
                        results.push(`> ${line.trim()}\n`);
                    });
                    results.push('\n');
                    return;

                case 'a':
                    const href = el.getAttribute('href') || '';
                    results.push(`[${el.textContent.trim()}](${href})`);
                    return;

                case 'strong':
                case 'b':
                    results.push(`**${el.textContent}**`);
                    return;

                case 'em':
                case 'i':
                    results.push(`*${el.textContent}*`);
                    return;

                case 'hr':
                    results.push('\n---\n\n');
                    return;

                case 'br':
                    results.push('\n');
                    return;

                case 'img':
                    const src = el.getAttribute('src') || '';
                    const alt = el.getAttribute('alt') || 'image';
                    results.push(`\n![${alt}](${src})\n\n`);
                    return;

                default:
                    // For divs and other containers, process children
                    if (['div', 'section', 'article', 'span', 'main'].includes(tag)) {
                        // Check for mermaid diagram container
                        if (className.includes('mermaid')) {
                            results.push('\n%%MERMAID_PLACEHOLDER%%\n');
                            return;
                        }
                        // Process children
                        el.childNodes.forEach(child => processNode(child, depth + 1));
                    }
            }
        }

        processNode(mainContent);

        // Clean up the result
        let markdown = results.join('');

        // Fix multiple newlines
        markdown = markdown.replace(/\n{4,}/g, '\n\n\n');

        // Fix spacing around headers
        markdown = markdown.replace(/\n+(#{1,6})/g, '\n\n$1');

        return markdown.trim();
    });

    // Return raw markdown with placeholders (replacement done in main loop)
    return rawMarkdown;
}

/**
 * Fix internal links to use relative markdown paths
 */
function fixInternalLinks(markdown, repo) {
    // Convert DeepWiki URLs to relative markdown links
    const linkPattern = new RegExp(`\\]\\(https://deepwiki\\.com/${repo.replace('/', '\\/')}/([^)]+)\\)`, 'g');
    return markdown.replace(linkPattern, (match, pageId) => {
        return `](./${pageId}.md)`;
    });
}

/**
 * Create index.md with table of contents
 */
function createIndex(repo) {
    let md = `# ${repo} Documentation

> Exported from [DeepWiki](https://deepwiki.com/${repo})

## Table of Contents

`;

    for (const page of PAGES) {
        const sectionNum = page.id.split('-')[0];
        const isMainSection = !sectionNum.includes('.');
        const indent = isMainSection ? '' : '  ';

        md += `${indent}- [${page.title}](./${page.id}.md)\n`;
    }

    md += `
---

*This documentation was automatically exported from DeepWiki.*
*Source: https://deepwiki.com/${repo}*
`;

    return md;
}

async function main() {
    console.log(`\n📚 DeepWiki Downloader`);
    console.log(`   Repository: ${REPO}`);
    console.log(`   Output: ${OUTPUT_DIR}`);
    console.log(`   Pages: ${PAGES.length}\n`);

    // Create output directory
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // Launch browser
    console.log('🚀 Launching browser...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // Download each page
    let successCount = 0;
    for (let i = 0; i < PAGES.length; i++) {
        const pageInfo = PAGES[i];
        const url = `${BASE_URL}/${pageInfo.id}`;
        const outputFile = path.join(OUTPUT_DIR, `${pageInfo.id}.md`);

        process.stdout.write(`[${i + 1}/${PAGES.length}] ${pageInfo.title}... `);

        try {
            // First pass: Get rendered page to count mermaid SVGs and get headings
            const renderedPage = await browser.newPage();
            await renderedPage.setViewport({ width: 1280, height: 800 });
            await renderedPage.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            await renderedPage.waitForSelector('.prose', { timeout: 15000 });
            await new Promise(r => setTimeout(r, 2000));

            // Get page info for mermaid extraction
            const pageMetadata = await renderedPage.evaluate(() => {
                const prose = document.querySelector('.prose');
                if (!prose) return { svgCount: 0, headings: [] };

                const svgs = prose.querySelectorAll('svg[id^="mermaid-"]');
                const headings = Array.from(prose.querySelectorAll('h2, h3'))
                    .map(h => h.textContent.trim());

                return { svgCount: svgs.length, headings };
            });

            // Extract markdown content
            let markdown = await extractMarkdown(renderedPage, []);
            await renderedPage.close();

            // Second pass: Get raw HTML to extract mermaid source code
            let mermaidDiagrams = [];
            if (pageMetadata.svgCount > 0) {
                const rawPage = await browser.newPage();
                await rawPage.setJavaScriptEnabled(false);
                await rawPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                const rawHTML = await rawPage.content();
                mermaidDiagrams = extractMermaidFromHTML(rawHTML, pageMetadata.headings, pageMetadata.svgCount);
                await rawPage.close();

                // Replace mermaid placeholders with extracted diagrams
                let diagramIndex = 0;
                while (markdown.includes('%%MERMAID_PLACEHOLDER%%') && diagramIndex < mermaidDiagrams.length) {
                    markdown = markdown.replace('%%MERMAID_PLACEHOLDER%%',
                        `\n\`\`\`mermaid\n${mermaidDiagrams[diagramIndex]}\n\`\`\`\n`);
                    diagramIndex++;
                }
            }

            // Remove any remaining placeholders
            markdown = markdown.replace(/%%MERMAID_PLACEHOLDER%%/g, '');
            // Clean up any mermaid CSS that leaked through
            markdown = markdown.replace(/```\n#mermaid-[\s\S]*?```\n/g, '');
            markdown = markdown.replace(/\n#mermaid-[^\n]+\n/g, '\n');

            if (!markdown || markdown.length < 100) {
                throw new Error('Content too short or empty');
            }

            // Add title if not present
            if (!markdown.startsWith('#')) {
                markdown = `# ${pageInfo.title}\n\n${markdown}`;
            }

            // Fix internal links
            markdown = fixInternalLinks(markdown, REPO);

            // Add source reference
            markdown += `\n\n---\n*Source: [DeepWiki](${url})*\n`;

            // Save
            await fs.writeFile(outputFile, markdown, 'utf-8');
            successCount++;
            const diagramCount = mermaidDiagrams.length;
            console.log(`✓ (${Math.round(markdown.length / 1024)}KB, ${diagramCount} diagrams)`);

        } catch (error) {
            console.log(`✗ (${error.message})`);
        }

        // Rate limiting
        await new Promise(r => setTimeout(r, 500));
    }

    // Create index
    const indexContent = createIndex(REPO);
    await fs.writeFile(path.join(OUTPUT_DIR, 'index.md'), indexContent, 'utf-8');
    console.log('\n📋 Created index.md');

    await browser.close();

    console.log(`\n✅ Downloaded ${successCount}/${PAGES.length} pages to ${OUTPUT_DIR}`);
    console.log(`\n📁 Files:`);
    console.log(`   ${OUTPUT_DIR}/index.md`);
    console.log(`   ${OUTPUT_DIR}/*.md`);
}

main().catch(console.error);
