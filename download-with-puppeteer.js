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
 * Extract markdown content from a rendered DeepWiki page
 */
async function extractMarkdown(page) {
    return await page.evaluate(() => {
        const content = [];

        // Find the main content area
        const mainContent = document.querySelector('article') ||
                           document.querySelector('main') ||
                           document.querySelector('[class*="content"]') ||
                           document.body;

        if (!mainContent) return '';

        // Helper to convert element to markdown
        function elementToMarkdown(el, depth = 0) {
            if (!el || el.nodeType !== 1) return '';

            const tag = el.tagName.toLowerCase();
            const text = el.textContent?.trim() || '';

            // Skip navigation, headers, footers
            if (['nav', 'header', 'footer', 'script', 'style'].includes(tag)) {
                return '';
            }

            // Skip elements with specific classes
            const className = el.className || '';
            if (className.includes('sidebar') || className.includes('nav') || className.includes('menu')) {
                return '';
            }

            switch (tag) {
                case 'h1': return `# ${text}\n\n`;
                case 'h2': return `## ${text}\n\n`;
                case 'h3': return `### ${text}\n\n`;
                case 'h4': return `#### ${text}\n\n`;
                case 'h5': return `##### ${text}\n\n`;
                case 'h6': return `###### ${text}\n\n`;

                case 'p':
                    return text ? `${text}\n\n` : '';

                case 'pre':
                    const code = el.querySelector('code');
                    const lang = code?.className?.match(/language-(\w+)/)?.[1] || '';
                    const codeText = code?.textContent || el.textContent;
                    return `\`\`\`${lang}\n${codeText}\n\`\`\`\n\n`;

                case 'code':
                    // Inline code (not inside pre)
                    if (el.parentElement?.tagName.toLowerCase() !== 'pre') {
                        return `\`${text}\``;
                    }
                    return '';

                case 'ul':
                case 'ol':
                    let listMd = '';
                    el.querySelectorAll(':scope > li').forEach((li, i) => {
                        const prefix = tag === 'ol' ? `${i + 1}. ` : '- ';
                        listMd += `${prefix}${li.textContent.trim()}\n`;
                    });
                    return listMd + '\n';

                case 'table':
                    let tableMd = '';
                    const rows = el.querySelectorAll('tr');
                    rows.forEach((row, rowIndex) => {
                        const cells = row.querySelectorAll('th, td');
                        const rowContent = Array.from(cells).map(c => c.textContent.trim()).join(' | ');
                        tableMd += `| ${rowContent} |\n`;
                        if (rowIndex === 0) {
                            tableMd += '|' + Array.from(cells).map(() => '---').join('|') + '|\n';
                        }
                    });
                    return tableMd + '\n';

                case 'a':
                    const href = el.getAttribute('href') || '';
                    return `[${text}](${href})`;

                case 'strong':
                case 'b':
                    return `**${text}**`;

                case 'em':
                case 'i':
                    return `*${text}*`;

                case 'img':
                    const src = el.getAttribute('src') || '';
                    const alt = el.getAttribute('alt') || 'image';
                    return `![${alt}](${src})\n\n`;

                case 'blockquote':
                    return `> ${text}\n\n`;

                case 'hr':
                    return '---\n\n';

                case 'br':
                    return '\n';

                case 'div':
                case 'section':
                case 'article':
                    // Check for mermaid
                    if (className.includes('mermaid') || el.querySelector('.mermaid')) {
                        const mermaidCode = el.textContent.trim();
                        return `\`\`\`mermaid\n${mermaidCode}\n\`\`\`\n\n`;
                    }
                    // Recursively process children
                    let childMd = '';
                    el.childNodes.forEach(child => {
                        if (child.nodeType === 1) {
                            childMd += elementToMarkdown(child, depth + 1);
                        } else if (child.nodeType === 3) {
                            const nodeText = child.textContent?.trim();
                            if (nodeText) childMd += nodeText + ' ';
                        }
                    });
                    return childMd;

                default:
                    // For unknown tags, just return text content
                    return text ? text + ' ' : '';
            }
        }

        return elementToMarkdown(mainContent);
    });
}

/**
 * Fix internal links to use relative markdown paths
 */
function fixInternalLinks(markdown, currentPageId) {
    // Convert DeepWiki URLs to relative markdown links
    const linkPattern = /\]\(https:\/\/deepwiki\.com\/rive-app\/rive-runtime\/([^)]+)\)/g;
    return markdown.replace(linkPattern, (match, pageId) => {
        return `](./${pageId}.md)`;
    });
}

/**
 * Create index.md with table of contents
 */
function createIndex() {
    let md = `# Rive Runtime Documentation

> Exported from [DeepWiki](https://deepwiki.com/rive-app/rive-runtime)

## Table of Contents

`;

    let currentSection = '';
    for (const page of PAGES) {
        const sectionNum = page.id.split('-')[0];
        const isMainSection = !sectionNum.includes('.');
        const indent = isMainSection ? '' : '  ';

        md += `${indent}- [${page.title}](./${page.id}.md)\n`;
    }

    md += `
---

*This documentation was automatically exported from DeepWiki.*
*Source: https://deepwiki.com/rive-app/rive-runtime*
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

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Download each page
    let successCount = 0;
    for (let i = 0; i < PAGES.length; i++) {
        const pageInfo = PAGES[i];
        const url = `${BASE_URL}/${pageInfo.id}`;
        const outputFile = path.join(OUTPUT_DIR, `${pageInfo.id}.md`);

        process.stdout.write(`[${i + 1}/${PAGES.length}] ${pageInfo.title}... `);

        try {
            await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

            // Wait for content to render
            await page.waitForSelector('article, main, [class*="content"]', { timeout: 10000 });
            await new Promise(r => setTimeout(r, 2000)); // Extra wait for mermaid

            // Extract markdown
            let markdown = await extractMarkdown(page);

            // Add title if not present
            if (!markdown.startsWith('#')) {
                markdown = `# ${pageInfo.title}\n\n${markdown}`;
            }

            // Fix internal links
            markdown = fixInternalLinks(markdown, pageInfo.id);

            // Add source reference
            markdown += `\n\n---\n*Source: [DeepWiki](${url})*\n`;

            // Save
            await fs.writeFile(outputFile, markdown, 'utf-8');
            successCount++;
            console.log('✓');

        } catch (error) {
            console.log(`✗ (${error.message})`);
        }

        // Rate limiting
        await new Promise(r => setTimeout(r, 500));
    }

    // Create index
    const indexContent = createIndex();
    await fs.writeFile(path.join(OUTPUT_DIR, 'index.md'), indexContent, 'utf-8');
    console.log('\n📋 Created index.md');

    await browser.close();

    console.log(`\n✅ Downloaded ${successCount}/${PAGES.length} pages to ${OUTPUT_DIR}`);
    console.log(`\n📁 Files:`);
    console.log(`   ${OUTPUT_DIR}/index.md`);
    console.log(`   ${OUTPUT_DIR}/*.md`);
}

main().catch(console.error);
