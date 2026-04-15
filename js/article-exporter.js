/**
 * Cucumber NewsScraper — article export helpers (JSON, YAML, XML, Markdown, PDF).
 *
 * SPDX-License-Identifier: MIT
 */
(function articleExporterIife(global) {
    'use strict';

    class ArticleExporter {
        /**
         * @param {string} name
         * @returns {string}
         */
        static safeFilePart(name) {
            return String(name || 'export')
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9_-]+/g, '-')
                .replace(/^-+|-+$/g, '') || 'export';
        }

        /**
         * @param {string} baseName
         * @param {string} ext
         * @returns {string}
         */
        static buildFileName(baseName, ext) {
            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            return `${ArticleExporter.safeFilePart(baseName)}-${ts}.${ext}`;
        }

        /**
         * @param {BlobPart} content
         * @param {string} type
         * @param {string} fileName
         */
        static download(content, type, fileName) {
            const blob = new Blob([content], { type });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        }

        /**
         * @param {unknown} value
         * @returns {string}
         */
        static toYaml(value) {
            const esc = (v) =>
                String(v)
                    .replace(/\\/g, '\\\\')
                    .replace(/"/g, '\\"')
                    .replace(/\n/g, '\\n');
            const isPlain = (v) => /^[a-zA-Z0-9_.-]+$/.test(v);
            const walk = (v, indent) => {
                const pad = '  '.repeat(indent);
                if (v == null) {
                    return 'null';
                }
                if (typeof v === 'number' || typeof v === 'boolean') {
                    return String(v);
                }
                if (typeof v === 'string') {
                    if (v === '' || !isPlain(v)) {
                        return `"${esc(v)}"`;
                    }
                    return v;
                }
                if (Array.isArray(v)) {
                    if (v.length === 0) {
                        return '[]';
                    }
                    return `\n${v
                        .map((item) => {
                            const r = walk(item, indent + 1);
                            if (r.startsWith('\n')) {
                                return `${pad}- ${r.slice(1)}`;
                            }
                            return `${pad}- ${r}`;
                        })
                        .join('\n')}`;
                }
                if (typeof v === 'object') {
                    const entries = Object.entries(v);
                    if (entries.length === 0) {
                        return '{}';
                    }
                    return `\n${entries
                        .map(([k, val]) => {
                            const r = walk(val, indent + 1);
                            if (r.startsWith('\n')) {
                                return `${pad}${k}:${r}`;
                            }
                            return `${pad}${k}: ${r}`;
                        })
                        .join('\n')}`;
                }
                return `"${esc(String(v))}"`;
            };
            const out = walk(value, 0);
            return out.startsWith('\n') ? out.slice(1) : out;
        }

        /**
         * @param {string} s
         * @returns {string}
         */
        static xmlEscape(s) {
            return String(s || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        }

        /**
         * @param {Record<string, unknown>} payload
         * @returns {string}
         */
        static toXml(payload) {
            const walk = (key, value) => {
                if (value == null) {
                    return `<${key}/>`;
                }
                if (Array.isArray(value)) {
                    return `<${key}>${value.map((x) => walk('item', x)).join('')}</${key}>`;
                }
                if (typeof value === 'object') {
                    const body = Object.entries(value)
                        .map(([k, v]) => walk(k, v))
                        .join('');
                    return `<${key}>${body}</${key}>`;
                }
                return `<${key}>${ArticleExporter.xmlEscape(String(value))}</${key}>`;
            };
            return `<?xml version="1.0" encoding="UTF-8"?>\n${walk('newsExport', payload)}`;
        }

        /**
         * @param {Record<string, unknown>} payload
         * @returns {string}
         */
        static toMarkdown(payload) {
            const lines = [];
            lines.push('# News Export');
            lines.push('');
            if (payload.meta && typeof payload.meta === 'object') {
                const meta = payload.meta;
                lines.push('## Meta');
                lines.push('');
                for (const [k, v] of Object.entries(meta)) {
                    lines.push(`- **${k}**: ${String(v)}`);
                }
                lines.push('');
            }
            const articles = Array.isArray(payload.articles) ? payload.articles : [];
            lines.push(`## Articles (${articles.length})`);
            lines.push('');
            articles.forEach((a, idx) => {
                const article = a && typeof a === 'object' ? a : {};
                lines.push(`### ${idx + 1}. ${String(article.title || 'Untitled')}`);
                lines.push('');
                if (article.url) {
                    lines.push(`- URL: ${String(article.url)}`);
                }
                if (article.source) {
                    lines.push(`- Source: ${String(article.source)}`);
                }
                if (article.category) {
                    lines.push(`- Category: ${String(article.category)}`);
                }
                if (article.publishedAt) {
                    lines.push(`- Published: ${String(article.publishedAt)}`);
                }
                if (article.summary) {
                    lines.push('');
                    lines.push('#### Summary');
                    lines.push('');
                    lines.push(String(article.summary));
                }
                if (Array.isArray(article.alternativeLinks) && article.alternativeLinks.length > 0) {
                    lines.push('');
                    lines.push('#### Alternative Links');
                    lines.push('');
                    article.alternativeLinks.forEach((x) => {
                        const t = String((x && x.title) || (x && x.url) || '');
                        const u = String((x && x.url) || '');
                        lines.push(`- [${t}](${u})`);
                    });
                }
                if (Array.isArray(article.redditThreads) && article.redditThreads.length > 0) {
                    lines.push('');
                    lines.push('#### Reddit Threads');
                    lines.push('');
                    article.redditThreads.forEach((x) => {
                        const t = String((x && x.title) || (x && x.url) || '');
                        const u = String((x && x.url) || '');
                        lines.push(`- [${t}](${u})`);
                    });
                }
                if (article.kiMeta && typeof article.kiMeta === 'object') {
                    lines.push('');
                    lines.push('#### KI Meta');
                    lines.push('');
                    for (const [k, v] of Object.entries(article.kiMeta)) {
                        lines.push(`- ${k}: ${String(v)}`);
                    }
                }
                lines.push('');
            });
            return lines.join('\n');
        }

        /**
         * @param {Record<string, unknown>} payload
         * @param {string} fileName
         * @returns {boolean}
         */
        static toPdf(payload, fileName) {
            const jspdfNs = global.jspdf;
            if (!jspdfNs || !jspdfNs.jsPDF) {
                return false;
            }
            const md = ArticleExporter.toMarkdown(payload);
            const doc = new jspdfNs.jsPDF({ unit: 'pt', format: 'a4' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            const margin = 40;
            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();
            const lineH = 14;
            const maxW = pageW - margin * 2;
            const wrapped = doc.splitTextToSize(md, maxW);
            let y = margin;
            wrapped.forEach((line) => {
                if (y > pageH - margin) {
                    doc.addPage();
                    y = margin;
                }
                doc.text(line, margin, y);
                y += lineH;
            });
            doc.save(fileName);
            return true;
        }
    }

    global.ArticleExporter = ArticleExporter;
})(typeof window !== 'undefined' ? window : globalThis);

