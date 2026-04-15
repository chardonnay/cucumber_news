/**
 * Cucumber NewsScraper — article export helpers (JSON, YAML, XML, AsciiDoc, PDF).
 *
 * SPDX-License-Identifier: MIT
 */
(function articleExporterIife(global) {
    'use strict';

    class ArticleExporter {
        /**
         * @returns {string}
         */
        static exportAttribution() {
            return 'Created with Cucumber NewsScraper';
        }

        /**
         * @param {unknown} value
         * @returns {string}
         */
        static exportAttributionDate(value) {
            const raw = ArticleExporter.cleanText(value) || new Date().toISOString();
            const ts = Date.parse(raw);
            if (!Number.isFinite(ts)) {
                return raw;
            }
            try {
                return new Intl.DateTimeFormat('de-DE', {
                    dateStyle: 'medium'
                }).format(new Date(ts));
            } catch (_) {
                return new Date(ts).toLocaleDateString('de-DE');
            }
        }

        /**
         * @param {unknown} createdAt
         * @returns {string}
         */
        static exportWatermarkText(createdAt) {
            const dateLabel = ArticleExporter.exportAttributionDate(createdAt);
            return dateLabel
                ? `${ArticleExporter.exportAttribution()} ${dateLabel}`
                : ArticleExporter.exportAttribution();
        }

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
        static toAsciiDoc(payload) {
            const safePayload = payload && typeof payload === 'object' ? payload : {};
            const meta = safePayload.meta && typeof safePayload.meta === 'object'
                ? safePayload.meta
                : {};
            const articles = Array.isArray(safePayload.articles) ? safePayload.articles : [];
            const lines = [];
            const articleAnchorId = (index) => `artikel-${String(index + 1).padStart(2, '0')}`;
            const hasNonNegativeNumber = (value) => {
                const num = Number(value);
                return Number.isFinite(num) && num >= 0;
            };
            const pushTable = (rows) => {
                const tableRows = rows.filter((row) => row && row.label && row.value);
                if (tableRows.length === 0) {
                    return;
                }
                lines.push('[cols="1,3",options="header"]');
                lines.push('|===');
                lines.push('| Feld | Wert');
                tableRows.forEach((row) => {
                    lines.push(`| ${ArticleExporter.asciiDocText(row.label)} | ${ArticleExporter.asciiDocTableCell(row.value)}`);
                });
                lines.push('|===');
                lines.push('');
            };
            const pushLinkList = (title, items) => {
                const resources = Array.isArray(items)
                    ? items.filter((item) => item && typeof item === 'object')
                    : [];
                if (resources.length === 0) {
                    return;
                }
                lines.push(`==== ${ArticleExporter.asciiDocTitle(title)}`);
                lines.push('');
                resources.forEach((item, index) => {
                    const itemTitle = ArticleExporter.cleanText(item.title || item.url || `Eintrag ${index + 1}`);
                    const itemUrl = String(item.url || '').trim();
                    if (itemUrl) {
                        lines.push(`. ${ArticleExporter.asciiDocUrl(itemUrl)}[${ArticleExporter.asciiDocLinkText(itemTitle)}]`);
                    } else {
                        lines.push(`. ${ArticleExporter.asciiDocText(itemTitle)}`);
                    }
                    const detailLines = [];
                    if (item.source) {
                        detailLines.push(`Quelle: ${ArticleExporter.asciiDocText(item.source)}`);
                    }
                    if (itemUrl) {
                        detailLines.push(`Link: ${ArticleExporter.asciiDocText(ArticleExporter.formatUrlLabel(itemUrl))}`);
                    }
                    if (detailLines.length > 0) {
                        lines.push('+');
                        detailLines.forEach((detailLine) => lines.push(detailLine));
                    }
                    lines.push('');
                });
            };

            lines.push('= News Export');
            lines.push(':sectanchors:');
            lines.push(':sectlinks:');
            lines.push('');
            lines.push('Kompakter Export mit strukturierter Uebersicht und lesbaren Artikelkapiteln.');
            lines.push('');

            pushTable([
                { label: 'Quelle', value: meta.newsSource || 'Nicht gesetzt' },
                { label: 'Umfang', value: ArticleExporter.formatScopeLabel(meta.scope) },
                { label: 'Artikel', value: meta.articleCount || articles.length },
                { label: 'Erstellt', value: ArticleExporter.formatDate(meta.createdAt) || 'Keine Zeitangabe' }
            ]);

            if (articles.length > 0) {
                lines.push('== Uebersicht');
                lines.push('');
                articles.forEach((item, index) => {
                    const article = item && typeof item === 'object' ? item : {};
                    const infoParts = [];
                    const category = ArticleExporter.cleanText(article.categoryName || article.category);
                    const articleDate = ArticleExporter.formatArticleDate(article);
                    if (category) {
                        infoParts.push(`Kategorie: ${ArticleExporter.asciiDocText(category)}`);
                    }
                    if (articleDate) {
                        infoParts.push(`Zeitpunkt: ${ArticleExporter.asciiDocText(articleDate)}`);
                    }
                    lines.push(`* <<${articleAnchorId(index)},${ArticleExporter.asciiDocLinkText(article.title || 'Ohne Titel')}>>`);
                    if (infoParts.length > 0) {
                        lines.push('+');
                        lines.push(infoParts.join(' | '));
                    }
                    lines.push('');
                });
            }

            articles.forEach((item, index) => {
                const article = item && typeof item === 'object' ? item : {};
                const articleDate = ArticleExporter.formatArticleDate(article);
                lines.push(`[#${articleAnchorId(index)}]`);
                lines.push(`== Artikel ${String(index + 1).padStart(2, '0')}`);
                lines.push('');
                lines.push(`=== ${ArticleExporter.asciiDocTitle(article.title || 'Ohne Titel')}`);
                lines.push('');

                const detailRows = [];
                if (article.source) {
                    detailRows.push({ label: 'Quelle', value: article.source });
                }
                if (article.categoryName || article.category) {
                    detailRows.push({ label: 'Kategorie', value: article.categoryName || article.category });
                }
                if (articleDate) {
                    detailRows.push({ label: 'Veroeffentlicht', value: articleDate });
                }
                if (article.url) {
                    detailRows.push({ label: 'URL', value: ArticleExporter.asciiDocUrl(article.url) });
                }
                pushTable(detailRows);

                if (article.summary) {
                    lines.push('==== Zusammenfassung');
                    lines.push('');
                    lines.push('[quote]');
                    lines.push('____');
                    ArticleExporter.cleanText(article.summary)
                        .split('\n')
                        .filter(Boolean)
                        .forEach((line) => {
                            lines.push(ArticleExporter.asciiDocText(line));
                        });
                    lines.push('____');
                    lines.push('');
                }

                pushLinkList('Alternative Links', article.alternativeLinks);
                pushLinkList('Reddit Threads', article.redditThreads);

                if (article.commentStats && typeof article.commentStats === 'object') {
                    lines.push('==== Kommentar-Metadaten');
                    lines.push('');
                    pushTable([
                        {
                            label: 'Status',
                            value: article.commentStats.ok
                                ? (article.commentStats.rateLimited ? 'Rate-limitiert' : 'Verfuegbar')
                                : 'Nicht verfuegbar'
                        },
                        {
                            label: 'Kommentare',
                            value: hasNonNegativeNumber(article.commentStats.total)
                                ? String(article.commentStats.total)
                                : 'Keine Daten'
                        },
                        {
                            label: 'Positiv',
                            value: hasNonNegativeNumber(article.commentStats.green)
                                ? String(article.commentStats.green)
                                : 'Keine Daten'
                        },
                        {
                            label: 'Negativ',
                            value: hasNonNegativeNumber(article.commentStats.red)
                                ? String(article.commentStats.red)
                                : 'Keine Daten'
                        }
                    ]);
                }

                if (article.kiMeta && typeof article.kiMeta === 'object') {
                    lines.push('==== KI-Metadaten');
                    lines.push('');
                    pushTable([
                        { label: 'Modell', value: article.kiMeta.model },
                        { label: 'Modus', value: article.kiMeta.apiMode },
                        { label: 'Reasoning', value: article.kiMeta.reasoning },
                        {
                            label: 'Cache-Zeit',
                            value: ArticleExporter.formatDate(article.kiMeta.summaryCachedAt) || 'Keine Zeitangabe'
                        }
                    ]);
                }
            });

            if (articles.length === 0) {
                lines.push('== Artikel');
                lines.push('');
                lines.push('Keine Artikel im Export enthalten.');
                lines.push('');
            }

            lines.push(ArticleExporter.exportAttribution());

            return lines.join('\n');
        }

        /**
         * @param {unknown} value
         * @returns {string}
         */
        static asciiDocText(value) {
            return ArticleExporter.cleanText(value)
                .replace(/\\/g, '\\\\')
                .replace(/([*_`\[\]#|])/g, '\\$1')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        }

        /**
         * @param {unknown} value
         * @returns {string}
         */
        static asciiDocTitle(value) {
            return ArticleExporter.cleanText(value)
                .replace(/\\/g, '\\\\')
                .replace(/([*_`\[\]#])/g, '\\$1');
        }

        /**
         * @param {unknown} value
         * @returns {string}
         */
        static asciiDocLinkText(value) {
            return ArticleExporter.cleanText(value)
                .replace(/\\/g, '\\\\')
                .replace(/([\[\],])/g, '\\$1');
        }

        /**
         * @param {unknown} value
         * @returns {string}
         */
        static asciiDocTableCell(value) {
            const clean = ArticleExporter.cleanText(value);
            if (!clean) {
                return 'Keine Daten';
            }
            return clean
                .replace(/\|/g, '\\|')
                .replace(/\n/g, ' +\n');
        }

        /**
         * @param {unknown} value
         * @returns {string}
         */
        static asciiDocUrl(value) {
            return ArticleExporter.cleanText(value)
                .replace(/\[/g, '%5B')
                .replace(/\]/g, '%5D')
                .replace(/ /g, '%20');
        }

        /**
         * @param {unknown} value
         * @returns {string}
         */
        static cleanText(value) {
            return String(value == null ? '' : value)
                .replace(/\r\n?/g, '\n')
                .replace(/\u00a0/g, ' ')
                .split('\n')
                .map((line) => line.replace(/[ \t]+/g, ' ').trim())
                .join('\n')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        }

        /**
         * jsPDF with the built-in Helvetica font cannot reliably render all
         * Unicode symbols from live headlines (emoji, zero-width chars, smart
         * punctuation). Normalize aggressively for stable PDF layout.
         *
         * @param {unknown} value
         * @returns {string}
         */
        static cleanPdfText(value) {
            const base = ArticleExporter.cleanText(value);
            if (!base) {
                return '';
            }
            const normalized = typeof base.normalize === 'function'
                ? base.normalize('NFKD')
                : base;
            return normalized
                .replace(/\u00ad/g, '')
                .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
                .replace(/[‐‑‒–—−]/g, '-')
                .replace(/[“”„‟«»]/g, '"')
                .replace(/[‘’‚‛‹›]/g, '\'')
                .replace(/…/g, '...')
                .replace(/[•·]/g, '-')
                .replace(/→/g, '->')
                .replace(/←/g, '<-')
                .replace(/↔/g, '<->')
                .replace(/×/g, 'x')
                .replace(/≤/g, '<=')
                .replace(/≥/g, '>=')
                .replace(/\u2122/g, 'TM')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^\n\x20-\x7E\xA0-\xFF]/g, ' ')
                .split('\n')
                .map((line) => line.replace(/[ \t]+/g, ' ').trim())
                .join('\n')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        }

        /**
         * @param {string} value
         * @returns {number[] | null}
         */
        static parseCssColor(value) {
            const raw = String(value || '').trim();
            if (!raw) {
                return null;
            }
            const hexMatch = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
            if (hexMatch) {
                const hex = hexMatch[1];
                const full = hex.length === 3
                    ? hex.split('').map((part) => `${part}${part}`).join('')
                    : hex;
                return [
                    parseInt(full.slice(0, 2), 16),
                    parseInt(full.slice(2, 4), 16),
                    parseInt(full.slice(4, 6), 16)
                ];
            }
            const rgbMatch = raw.match(/^rgba?\(([^)]+)\)$/i);
            if (!rgbMatch) {
                return null;
            }
            const parts = rgbMatch[1]
                .split(',')
                .slice(0, 3)
                .map((part) => Math.max(0, Math.min(255, Number.parseInt(part.trim(), 10) || 0)));
            return parts.length === 3 ? parts : null;
        }

        /**
         * @param {number[]} base
         * @param {number[]} target
         * @param {number} weight
         * @returns {number[]}
         */
        static mixRgb(base, target, weight) {
            const ratio = Math.max(0, Math.min(1, Number(weight) || 0));
            return [0, 1, 2].map((index) =>
                Math.round(base[index] + (target[index] - base[index]) * ratio)
            );
        }

        /**
         * @returns {number[]}
         */
        static getPdfAccentColor() {
            const fallback = [255, 107, 0];
            if (
                typeof document === 'undefined' ||
                !document.documentElement ||
                typeof getComputedStyle !== 'function'
            ) {
                return fallback;
            }
            const raw = getComputedStyle(document.documentElement)
                .getPropertyValue('--primary-color')
                .trim();
            return ArticleExporter.parseCssColor(raw) || fallback;
        }

        /**
         * @param {unknown} value
         * @returns {string}
         */
        static formatDate(value) {
            const raw = ArticleExporter.cleanText(value);
            if (!raw) {
                return '';
            }
            const ts = Date.parse(raw);
            if (!Number.isFinite(ts)) {
                return raw;
            }
            try {
                return new Intl.DateTimeFormat('de-DE', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                }).format(new Date(ts));
            } catch (_) {
                return new Date(ts).toLocaleString('de-DE');
            }
        }

        /**
         * @param {unknown} value
         * @returns {string}
         */
        static formatScopeLabel(value) {
            const raw = ArticleExporter.cleanText(value);
            if (raw === 'selected') {
                return 'Ausgewählte Artikel';
            }
            if (raw === 'period') {
                return 'Zeitbereich';
            }
            return raw || 'Unbekannt';
        }

        /**
         * @param {unknown} value
         * @returns {string}
         */
        static formatMetricValue(value) {
            if (typeof value === 'boolean') {
                return value ? 'Ja' : 'Nein';
            }
            const raw = ArticleExporter.cleanText(value);
            return raw || 'Keine Daten';
        }

        /**
         * @param {unknown} value
         * @returns {string}
         */
        static formatUrlLabel(value) {
            const raw = ArticleExporter.cleanText(value);
            if (!raw) {
                return '';
            }
            try {
                const url = new URL(raw);
                return `${url.hostname}${url.pathname === '/' ? '' : url.pathname}`;
            } catch (_) {
                return raw;
            }
        }

        /**
         * @param {{ publishedAt?: unknown, timestamp?: unknown, fetchedAt?: unknown }} article
         * @returns {string}
         */
        static formatArticleDate(article) {
            return (
                ArticleExporter.formatDate(article && article.publishedAt) ||
                ArticleExporter.cleanText(article && article.timestamp) ||
                ArticleExporter.formatDate(article && article.fetchedAt)
            );
        }

        /**
         * @param {unknown} value
         * @returns {string}
         */
        static normalizePdfImageUrl(value) {
            const raw = ArticleExporter.cleanText(value);
            if (!raw) {
                return '';
            }
            const withProtocol = raw.startsWith('//') ? `https:${raw}` : raw;
            try {
                const url = new URL(withProtocol, typeof window !== 'undefined' ? window.location.href : undefined);
                if (url.protocol !== 'https:' && url.protocol !== 'http:') {
                    return '';
                }
                url.hash = '';
                return url.toString();
            } catch (_) {
                return '';
            }
        }

        /**
         * @param {string} url
         * @returns {string}
         */
        static buildPdfImageProxyUrl(url) {
            const normalizedUrl = ArticleExporter.normalizePdfImageUrl(url);
            if (!normalizedUrl || typeof window === 'undefined' || !window.location) {
                return '';
            }
            try {
                const pageUrl = new URL(window.location.href);
                if (pageUrl.protocol !== 'http:' && pageUrl.protocol !== 'https:') {
                    return '';
                }
                return `${pageUrl.origin}/api/article-image?url=${encodeURIComponent(normalizedUrl)}`;
            } catch (_) {
                return '';
            }
        }

        /**
         * @param {string} url
         * @returns {{ url: string, useCors: boolean }[]}
         */
        static buildPdfImageLoadTargets(url) {
            const normalizedUrl = ArticleExporter.normalizePdfImageUrl(url);
            if (!normalizedUrl) {
                return [];
            }
            const targets = [];
            const proxyUrl = ArticleExporter.buildPdfImageProxyUrl(normalizedUrl);
            if (proxyUrl) {
                targets.push({ url: proxyUrl, useCors: false });
            }
            targets.push({ url: normalizedUrl, useCors: true });
            return targets.filter((target, index, allTargets) =>
                target.url &&
                allTargets.findIndex((candidate) => candidate.url === target.url) === index
            );
        }

        /**
         * @param {string} url
         * @returns {Promise<{ dataUrl: string, format: 'JPEG', width: number, height: number } | null>}
         */
        static loadPdfImageAsset(url) {
            const loadTargets = ArticleExporter.buildPdfImageLoadTargets(url);
            if (loadTargets.length === 0) {
                return Promise.resolve(null);
            }
            if (typeof document === 'undefined' || typeof Image === 'undefined') {
                return Promise.resolve(null);
            }
            return new Promise((resolve) => {
                const tryLoad = (targetIndex) => {
                    if (targetIndex >= loadTargets.length) {
                        resolve(null);
                        return;
                    }
                    const target = loadTargets[targetIndex];
                    const img = new Image();
                    img.decoding = 'async';
                    img.loading = 'eager';
                    img.referrerPolicy = 'no-referrer';
                    if (target.useCors) {
                        img.crossOrigin = 'anonymous';
                    }

                    img.onload = () => {
                        try {
                            const naturalWidth = img.naturalWidth || img.width;
                            const naturalHeight = img.naturalHeight || img.height;
                            if (!naturalWidth || !naturalHeight) {
                                tryLoad(targetIndex + 1);
                                return;
                            }
                            const maxEdge = 1800;
                            const scale = Math.min(1, maxEdge / Math.max(naturalWidth, naturalHeight));
                            const canvas = document.createElement('canvas');
                            canvas.width = Math.max(1, Math.round(naturalWidth * scale));
                            canvas.height = Math.max(1, Math.round(naturalHeight * scale));
                            const ctx = canvas.getContext('2d');
                            if (!ctx) {
                                tryLoad(targetIndex + 1);
                                return;
                            }
                            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                            resolve({
                                dataUrl: canvas.toDataURL('image/jpeg', 0.9),
                                format: 'JPEG',
                                width: canvas.width,
                                height: canvas.height
                            });
                        } catch (_) {
                            tryLoad(targetIndex + 1);
                        }
                    };
                    img.onerror = () => tryLoad(targetIndex + 1);
                    img.src = target.url;
                };

                tryLoad(0);
            });
        }

        /**
         * @param {Record<string, unknown>} payload
         * @param {string} fileName
         * @returns {Promise<boolean>}
         */
        static async toPdf(payload, fileName) {
            const jspdfNs = global.jspdf;
            if (!jspdfNs || !jspdfNs.jsPDF) {
                return false;
            }
            const safePayload = payload && typeof payload === 'object' ? payload : {};
            const meta = safePayload.meta && typeof safePayload.meta === 'object'
                ? safePayload.meta
                : {};
            const articles = Array.isArray(safePayload.articles)
                ? safePayload.articles.filter((article) => article && typeof article === 'object')
                : [];
            const doc = new jspdfNs.jsPDF({ unit: 'pt', format: 'a4', compress: true });
            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();
            const layout = {
                marginX: 46,
                top: 44,
                bottom: 42
            };
            layout.contentW = pageW - layout.marginX * 2;
            layout.pageBottom = pageH - layout.bottom - 8;

            const accent = ArticleExporter.getPdfAccentColor();
            const theme = {
                accent,
                accentDark: ArticleExporter.mixRgb(accent, [14, 23, 38], 0.28),
                accentSoft: ArticleExporter.mixRgb(accent, [255, 255, 255], 0.82),
                accentSurface: ArticleExporter.mixRgb(accent, [255, 255, 255], 0.92),
                watermark: ArticleExporter.mixRgb(accent, [245, 247, 250], 0.88),
                coverWatermark: ArticleExporter.mixRgb([255, 255, 255], [18, 26, 39], 0.68),
                page: [245, 247, 250],
                surface: [255, 255, 255],
                border: [224, 229, 237],
                ink: [20, 28, 45],
                muted: [97, 112, 130],
                coverBg: [18, 26, 39],
                coverPanel: [31, 41, 58],
                coverGlowPrimary: ArticleExporter.mixRgb(accent, [255, 255, 255], 0.24),
                coverGlowSecondary: ArticleExporter.mixRgb(accent, [18, 26, 39], 0.38)
            };
            const imageCache = new Map();

            let cursorY = layout.top;
            let currentHeader = null;
            const pdfWatermark = ArticleExporter.exportWatermarkText(meta.createdAt);

            const setFill = (rgb) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
            const setDraw = (rgb) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
            const setText = (rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);

            const linesFor = (text, maxWidth) => {
                const clean = ArticleExporter.cleanPdfText(text);
                if (!clean) {
                    return [];
                }
                return doc
                    .splitTextToSize(clean, maxWidth)
                    .map((line) => ArticleExporter.cleanPdfText(line))
                    .filter(Boolean);
            };

            const fitSingleLine = (text, maxWidth) => {
                const clean = ArticleExporter.cleanPdfText(text);
                if (!clean) {
                    return '';
                }
                if (doc.getTextWidth(clean) <= maxWidth) {
                    return clean;
                }
                let out = clean;
                while (out.length > 4 && doc.getTextWidth(`${out}...`) > maxWidth) {
                    out = out.slice(0, -1);
                }
                return `${out}...`;
            };

            const drawLines = (lines, x, y, lineHeight) => {
                lines.forEach((line, index) => {
                    doc.text(String(line), x, y + index * lineHeight);
                });
                return y + Math.max(0, lines.length - 1) * lineHeight;
            };

            const drawWatermark = (rgb) => {
                if (!pdfWatermark) {
                    return;
                }
                setText(rgb);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(26);
                doc.text(
                    fitSingleLine(pdfWatermark, pageW * 0.76),
                    pageW / 2,
                    pageH / 2,
                    {
                        align: 'center',
                        angle: -28
                    }
                );
            };

            const paintStandardPage = () => {
                setFill(theme.page);
                doc.rect(0, 0, pageW, pageH, 'F');
                setFill(theme.accent);
                doc.rect(0, 0, pageW, 6, 'F');
                drawWatermark(theme.watermark);
                setDraw(theme.border);
                doc.setLineWidth(1);
                doc.line(layout.marginX, pageH - 28, pageW - layout.marginX, pageH - 28);
            };

            const drawPageHeader = (header) => {
                if (!header) {
                    cursorY = layout.top;
                    return;
                }
                setText(theme.muted);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.text(String(header.left || ''), layout.marginX, 26);
                doc.setFont('helvetica', 'normal');
                const rightText = fitSingleLine(String(header.right || ''), 220);
                if (rightText) {
                    doc.text(rightText, pageW - layout.marginX, 26, { align: 'right' });
                }
                cursorY = 58;
            };

            const startStandardPage = (header, addNewPage) => {
                if (addNewPage) {
                    doc.addPage();
                }
                doc.setPage(doc.getNumberOfPages());
                currentHeader = header || currentHeader;
                paintStandardPage();
                drawPageHeader(currentHeader);
            };

            const ensureSpace = (heightNeeded) => {
                if (cursorY + heightNeeded <= layout.pageBottom) {
                    return;
                }
                startStandardPage(currentHeader, true);
            };

            const drawSectionHeading = (title) => {
                ensureSpace(28);
                setDraw(theme.accent);
                doc.setLineWidth(1.5);
                doc.line(layout.marginX, cursorY + 5, layout.marginX + 22, cursorY + 5);
                setText(theme.ink);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.text(String(title || ''), layout.marginX + 30, cursorY + 9);
                cursorY += 24;
            };

            const drawSectionHeadingWithBody = (title, minBodyHeight) => {
                drawSectionHeading(title);
                if (cursorY + minBodyHeight <= layout.pageBottom) {
                    return;
                }
                startStandardPage(currentHeader, true);
                drawSectionHeading(title);
            };

            const hasNonNegativeNumber = (value) => {
                const num = Number(value);
                return Number.isFinite(num) && num >= 0;
            };

            const drawMetaPills = (items) => {
                const pills = items.filter((item) => ArticleExporter.cleanText(item && item.text));
                if (pills.length === 0) {
                    return;
                }
                const pillHeight = 22;
                const gap = 8;
                let x = layout.marginX;
                let y = cursorY;
                pills.forEach((pill) => {
                    doc.setFont('helvetica', pill.emphasis ? 'bold' : 'normal');
                    doc.setFontSize(9);
                    const label = ArticleExporter.cleanText(pill.text);
                    const width = Math.min(layout.contentW, doc.getTextWidth(label) + 20);
                    if (x + width > layout.marginX + layout.contentW) {
                        x = layout.marginX;
                        y += pillHeight + gap;
                    }
                    if (y + pillHeight > layout.pageBottom) {
                        startStandardPage(currentHeader, true);
                        x = layout.marginX;
                        y = cursorY;
                    }
                    setFill(pill.emphasis ? theme.accentSoft : [235, 240, 246]);
                    doc.roundedRect(x, y, width, pillHeight, 11, 11, 'F');
                    setText(pill.emphasis ? theme.accentDark : theme.muted);
                    doc.text(
                        fitSingleLine(label, width - 18),
                        x + 10,
                        y + 14
                    );
                    x += width + gap;
                });
                cursorY = y + pillHeight + 12;
            };

            const drawDivider = () => {
                ensureSpace(14);
                setDraw(theme.border);
                doc.setLineWidth(1);
                doc.line(layout.marginX, cursorY, pageW - layout.marginX, cursorY);
                cursorY += 18;
            };

            const getPdfImageAsset = async (url) => {
                const normalizedUrl = ArticleExporter.normalizePdfImageUrl(url);
                if (!normalizedUrl) {
                    return null;
                }
                if (!imageCache.has(normalizedUrl)) {
                    imageCache.set(normalizedUrl, ArticleExporter.loadPdfImageAsset(normalizedUrl));
                }
                try {
                    return await imageCache.get(normalizedUrl);
                } catch (_) {
                    return null;
                }
            };

            const drawCover = () => {
                doc.setPage(1);
                setFill(theme.coverBg);
                doc.rect(0, 0, pageW, pageH, 'F');

                setFill(theme.coverGlowSecondary);
                doc.circle(pageW + 24, 84, 132, 'F');
                setFill(theme.coverGlowPrimary);
                doc.circle(-26, pageH - 48, 128, 'F');
                drawWatermark(theme.coverWatermark);

                setText([255, 255, 255]);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.text('NEWS EXPORT', layout.marginX, 72);

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(30);
                const coverTitle = linesFor(
                    ArticleExporter.cleanText(meta.newsSource) || 'Artikel Export',
                    layout.contentW * 0.78
                );
                const titleBaseline = 120;
                drawLines(coverTitle, layout.marginX, titleBaseline, 34);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(12);
                setText([221, 230, 239]);
                const subtitle = linesFor(
                    'Exportierte Artikel in einem lesbaren Editorial-Layout mit klarer Typografie, Metadaten und strukturierten Zusatzinformationen.',
                    layout.contentW * 0.72
                );
                const subtitleY = titleBaseline + coverTitle.length * 34 + 8;
                drawLines(subtitle, layout.marginX, subtitleY, 16);

                const panelY = pageH - 222;
                const panelHeight = 150;
                setFill(theme.coverPanel);
                doc.roundedRect(layout.marginX, panelY, layout.contentW, panelHeight, 24, 24, 'F');

                const coverItems = [
                    { label: 'Quelle', value: ArticleExporter.cleanText(meta.newsSource) || 'Nicht gesetzt' },
                    { label: 'Umfang', value: ArticleExporter.formatScopeLabel(meta.scope) },
                    { label: 'Artikel', value: String(articles.length) },
                    { label: 'Erstellt', value: ArticleExporter.formatDate(meta.createdAt) || 'Keine Zeitangabe' }
                ];
                const cellGap = 12;
                const cellWidth = (layout.contentW - cellGap) / 2;
                coverItems.forEach((item, index) => {
                    const col = index % 2;
                    const row = Math.floor(index / 2);
                    const x = layout.marginX + col * (cellWidth + cellGap);
                    const y = panelY + 22 + row * 56;
                    setFill(theme.coverBg);
                    doc.roundedRect(x, y, cellWidth, 44, 16, 16, 'F');
                    setText([177, 188, 204]);
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(8);
                    doc.text(String(item.label), x + 14, y + 14);
                    setText([255, 255, 255]);
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(11);
                    doc.text(
                        fitSingleLine(String(item.value), cellWidth - 28),
                        x + 14,
                        y + 30
                    );
                });
            };

            const drawArticleThumbnail = async (article) => {
                const thumbnailUrl = ArticleExporter.normalizePdfImageUrl(article && article.thumbnailUrl);
                if (!thumbnailUrl) {
                    return;
                }
                const asset = await getPdfImageAsset(thumbnailUrl);
                if (!asset) {
                    return;
                }
                const framePadding = 14;
                const labelGap = 18;
                const maxImageWidth = layout.contentW - framePadding * 2;
                const maxImageHeight = 208;
                const scale = Math.min(
                    maxImageWidth / asset.width,
                    maxImageHeight / asset.height,
                    1
                );
                const drawWidth = Math.max(1, Math.round(asset.width * scale));
                const drawHeight = Math.max(1, Math.round(asset.height * scale));
                const frameHeight = drawHeight + framePadding * 2 + labelGap;
                ensureSpace(frameHeight + 12);

                setFill(theme.surface);
                setDraw(theme.border);
                doc.setLineWidth(1);
                doc.roundedRect(layout.marginX, cursorY, layout.contentW, frameHeight, 18, 18, 'FD');

                setText(theme.muted);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.text('VORSCHAU', layout.marginX + framePadding, cursorY + 16);

                const imageX = layout.marginX + Math.max(framePadding, Math.round((layout.contentW - drawWidth) / 2));
                const imageY = cursorY + labelGap;
                doc.addImage(asset.dataUrl, asset.format, imageX, imageY, drawWidth, drawHeight, undefined, 'FAST');

                cursorY += frameHeight + 14;
            };

            const drawCalloutSection = (title, text) => {
                const allLines = linesFor(text, layout.contentW - 34);
                if (allLines.length === 0) {
                    return;
                }
                let remaining = [...allLines];
                let isContinuation = false;
                while (remaining.length > 0) {
                    const sectionTitle = isContinuation ? `${title} - Fortsetzung` : title;
                    drawSectionHeadingWithBody(sectionTitle, 68);
                    const availableLines = Math.max(
                        1,
                        Math.floor((layout.pageBottom - cursorY - 26) / 14)
                    );
                    const chunk = remaining.splice(0, Math.max(1, availableLines));
                    const boxHeight = 24 + chunk.length * 14;
                    setFill(theme.accentSurface);
                    doc.roundedRect(layout.marginX, cursorY, layout.contentW, boxHeight, 18, 18, 'F');
                    setFill(theme.accent);
                    doc.roundedRect(layout.marginX, cursorY, 6, boxHeight, 3, 3, 'F');
                    setText(theme.ink);
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(11);
                    drawLines(chunk, layout.marginX + 18, cursorY + 18, 14);
                    cursorY += boxHeight + 14;
                    isContinuation = true;
                }
            };

            const drawResourceList = (title, items) => {
                const resources = Array.isArray(items)
                    ? items.filter((item) => item && typeof item === 'object')
                    : [];
                if (resources.length === 0) {
                    return;
                }
                const cards = resources.map((item, index) => {
                    const primary = ArticleExporter.cleanText(item.title || item.url || `Eintrag ${index + 1}`);
                    const secondaryParts = [];
                    const source = ArticleExporter.cleanText(item.source);
                    const url = ArticleExporter.formatUrlLabel(item.url);
                    if (source) {
                        secondaryParts.push(source);
                    }
                    if (url) {
                        secondaryParts.push(url);
                    }
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(11);
                    const titleLines = linesFor(primary, layout.contentW - 96);
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(9);
                    const metaLines = linesFor(secondaryParts.join(' | '), layout.contentW - 96);
                    const effectiveTitleLines = titleLines.length > 0
                        ? titleLines
                        : linesFor(item.url || `Eintrag ${index + 1}`, layout.contentW - 96);
                    const cardHeight = Math.max(
                        52,
                        24 + effectiveTitleLines.length * 13 + (metaLines.length > 0 ? metaLines.length * 11 + 6 : 0)
                    );
                    return {
                        index,
                        cardHeight,
                        titleLines: effectiveTitleLines,
                        metaLines
                    };
                });
                drawSectionHeadingWithBody(title, cards[0].cardHeight + 10);
                cards.forEach((card) => {
                    if (cursorY + card.cardHeight + 10 > layout.pageBottom) {
                        startStandardPage(currentHeader, true);
                        drawSectionHeadingWithBody(`${title} - Fortsetzung`, card.cardHeight + 10);
                    }

                    setFill(theme.surface);
                    setDraw(theme.border);
                    doc.setLineWidth(1);
                    doc.roundedRect(layout.marginX, cursorY, layout.contentW, card.cardHeight, 16, 16, 'FD');

                    setFill(theme.accentSoft);
                    doc.roundedRect(layout.marginX + 14, cursorY + 14, 28, 20, 10, 10, 'F');
                    setText(theme.accentDark);
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(9);
                    doc.text(String(card.index + 1).padStart(2, '0'), layout.marginX + 28, cursorY + 28, {
                        align: 'center'
                    });

                    setText(theme.ink);
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(11);
                    drawLines(card.titleLines, layout.marginX + 56, cursorY + 24, 13);

                    if (card.metaLines.length > 0) {
                        setText(theme.muted);
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(9);
                        drawLines(
                            card.metaLines,
                            layout.marginX + 56,
                            cursorY + 24 + card.titleLines.length * 13 + 4,
                            11
                        );
                    }

                    cursorY += card.cardHeight + 10;
                });
            };

            const drawMetricTiles = (title, entries) => {
                const metrics = entries
                    .map((entry) => ({
                        label: ArticleExporter.cleanText(entry && entry.label),
                        value: ArticleExporter.formatMetricValue(entry && entry.value)
                    }))
                    .filter((entry) => entry.label && entry.value);
                if (metrics.length === 0) {
                    return;
                }
                const gap = 12;
                const columnWidth = (layout.contentW - gap) / 2;
                const rows = [];
                for (let index = 0; index < metrics.length; index += 2) {
                    const pair = metrics.slice(index, index + 2).map((entry) => {
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(8);
                        const labelLines = linesFor(entry.label, columnWidth - 24);
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(11);
                        const valueLines = linesFor(entry.value, columnWidth - 24);
                        return {
                            label: entry.label,
                            value: entry.value,
                            labelLines,
                            valueLines,
                            height: Math.max(58, 20 + labelLines.length * 9 + valueLines.length * 13)
                        };
                    });
                    rows.push({
                        rowHeight: Math.max(...pair.map((item) => item.height)),
                        pair
                    });
                }
                drawSectionHeadingWithBody(title, rows[0].rowHeight + gap);
                rows.forEach((row, rowIndex) => {
                    if (rowIndex > 0 && cursorY + row.rowHeight + gap > layout.pageBottom) {
                        startStandardPage(currentHeader, true);
                        drawSectionHeadingWithBody(`${title} - Fortsetzung`, row.rowHeight + gap);
                    }
                    row.pair.forEach((entry, colIndex) => {
                        const x = layout.marginX + colIndex * (columnWidth + gap);
                        setFill(theme.surface);
                        setDraw(theme.border);
                        doc.setLineWidth(1);
                        doc.roundedRect(x, cursorY, columnWidth, row.rowHeight, 16, 16, 'FD');
                        setText(theme.muted);
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(8);
                        drawLines(entry.labelLines, x + 12, cursorY + 16, 9);
                        setText(theme.ink);
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(11);
                        drawLines(
                            entry.valueLines,
                            x + 12,
                            cursorY + 34,
                            13
                        );
                    });
                    cursorY += row.rowHeight + gap;
                });
            };

            const buildOverviewEntries = () => {
                if (articles.length === 0) {
                    return [];
                }
                const textWidth = layout.contentW - 128;
                return articles.map((article, index) => {
                    const title = ArticleExporter.cleanText(article && article.title) || 'Ohne Titel';
                    const metaParts = [];
                    const source = ArticleExporter.cleanText(article && (article.source || meta.newsSource));
                    const category = ArticleExporter.cleanText(article && (article.categoryName || article.category));
                    const articleDate = ArticleExporter.formatArticleDate(article);
                    if (source) {
                        metaParts.push(source);
                    }
                    if (category) {
                        metaParts.push(category);
                    }
                    if (articleDate) {
                        metaParts.push(articleDate);
                    }
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(12);
                    const titleLines = linesFor(title, textWidth);
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(9);
                    const metaLines = linesFor(metaParts.join(' | '), textWidth);
                    const rowHeight = Math.max(
                        58,
                        24 + titleLines.length * 14 + (metaLines.length > 0 ? metaLines.length * 11 + 6 : 0)
                    );
                    return {
                        index,
                        rowHeight,
                        titleLines,
                        metaLines
                    };
                });
            };

            const paginateOverviewEntries = (entries) => {
                if (!Array.isArray(entries) || entries.length === 0) {
                    return [];
                }
                const firstPageStartY = 158;
                const continuationStartY = 112;
                const cardGap = 10;
                const pages = [];
                let current = [];
                let y = firstPageStartY;

                entries.forEach((entry) => {
                    const pageStartY = pages.length === 0 ? firstPageStartY : continuationStartY;
                    if (current.length === 0) {
                        y = pageStartY;
                    }
                    if (y + entry.rowHeight > layout.pageBottom) {
                        pages.push(current);
                        current = [];
                        y = continuationStartY;
                    }
                    current.push(entry);
                    y += entry.rowHeight + cardGap;
                });

                if (current.length > 0) {
                    pages.push(current);
                }
                return pages;
            };

            const renderOverviewPages = (pageNumbers, pagedEntries, destinations) => {
                if (!Array.isArray(pageNumbers) || pageNumbers.length === 0) {
                    return;
                }
                pageNumbers.forEach((pageNumber, pageIndex) => {
                    const pageEntries = pagedEntries[pageIndex] || [];
                    const headerLabel = pageIndex === 0 ? 'UEBERSICHT' : 'UEBERSICHT - FORTSETZUNG';
                    doc.setPage(pageNumber);
                    paintStandardPage();
                    drawPageHeader({
                        left: headerLabel,
                        right: ArticleExporter.cleanText(meta.newsSource || 'News Export')
                    });

                    let overviewY = pageIndex === 0 ? 90 : 82;

                    setText(theme.ink);
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(pageIndex === 0 ? 20 : 16);
                    doc.text('Uebersicht', layout.marginX, overviewY);
                    overviewY += pageIndex === 0 ? 18 : 14;

                    if (pageIndex === 0) {
                        setText(theme.muted);
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(10);
                        const introLines = linesFor(
                            'Klick auf einen Eintrag springt direkt zum passenden Artikel im PDF.',
                            layout.contentW
                        );
                        drawLines(introLines, layout.marginX, overviewY, 13);
                        overviewY += introLines.length * 13 + 18;
                    } else {
                        overviewY += 18;
                    }

                    pageEntries.forEach((entry) => {
                        const destination = Array.isArray(destinations) ? destinations[entry.index] : null;
                        const rowX = layout.marginX;
                        const rowY = overviewY;
                        const rowW = layout.contentW;
                        const pageLabel = destination
                            ? `S. ${String(destination.pageNumber).padStart(2, '0')}`
                            : '--';

                        setFill(theme.surface);
                        setDraw(theme.border);
                        doc.setLineWidth(1);
                        doc.roundedRect(rowX, rowY, rowW, entry.rowHeight, 16, 16, 'FD');

                        setFill(theme.accentSoft);
                        doc.roundedRect(rowX + 14, rowY + 16, 32, 22, 11, 11, 'F');
                        setText(theme.accentDark);
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(9);
                        doc.text(String(entry.index + 1).padStart(2, '0'), rowX + 30, rowY + 31, {
                            align: 'center'
                        });

                        setText(theme.accentDark);
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(12);
                        drawLines(entry.titleLines, rowX + 58, rowY + 24, 14);

                        if (entry.metaLines.length > 0) {
                            setText(theme.muted);
                            doc.setFont('helvetica', 'normal');
                            doc.setFontSize(9);
                            drawLines(
                                entry.metaLines,
                                rowX + 58,
                                rowY + 24 + entry.titleLines.length * 14 + 4,
                                11
                            );
                        }

                        setText(theme.muted);
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(9);
                        doc.text(pageLabel, rowX + rowW - 16, rowY + 24, { align: 'right' });

                        if (destination) {
                            doc.link(rowX, rowY, rowW, entry.rowHeight, {
                                pageNumber: destination.pageNumber,
                                top: destination.top
                            });
                        }

                        overviewY += entry.rowHeight + 10;
                    });
                });
            };

            const overviewEntries = buildOverviewEntries();
            const overviewPages = paginateOverviewEntries(overviewEntries);
            const overviewPageNumbers = [];
            const articleDestinations = new Array(articles.length);

            drawCover();
            overviewPages.forEach(() => {
                doc.addPage();
                overviewPageNumbers.push(doc.getNumberOfPages());
            });

            for (let index = 0; index < articles.length; index += 1) {
                const article = articles[index];
                const articleTitle = ArticleExporter.cleanText(article.title) || 'Ohne Titel';
                startStandardPage(
                    {
                        left: `ARTIKEL ${String(index + 1).padStart(2, '0')} / ${String(articles.length).padStart(2, '0')}`,
                        right: ArticleExporter.cleanText(article.source || meta.newsSource || 'News Export')
                    },
                    true
                );
                articleDestinations[index] = {
                    pageNumber: doc.getNumberOfPages(),
                    top: 0
                };

                setText(theme.ink);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(22);
                const titleLines = linesFor(articleTitle, layout.contentW);
                drawLines(titleLines, layout.marginX, cursorY, 26);
                cursorY += titleLines.length * 26 + 2;

                const metaPills = [
                    { text: ArticleExporter.cleanText(article.source), emphasis: true },
                    { text: ArticleExporter.cleanText(article.categoryName || article.category) },
                    { text: ArticleExporter.formatArticleDate(article) }
                ];
                drawMetaPills(metaPills);

                const urlLabel = ArticleExporter.formatUrlLabel(article.url);
                if (urlLabel) {
                    setText(theme.accentDark);
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(9);
                    const urlLines = linesFor(urlLabel, layout.contentW);
                    drawLines(urlLines, layout.marginX, cursorY, 11);
                    cursorY += urlLines.length * 11 + 8;
                }

                await drawArticleThumbnail(article);
                drawDivider();

                drawCalloutSection('Zusammenfassung', article.summary);
                drawResourceList('Alternative Links', article.alternativeLinks);
                drawResourceList('Reddit Threads', article.redditThreads);

                if (article.commentStats && typeof article.commentStats === 'object') {
                    drawMetricTiles('Kommentar-Metadaten', [
                        {
                            label: 'Status',
                            value: article.commentStats.ok
                                ? (article.commentStats.rateLimited ? 'Rate-limitiert' : 'Verfuegbar')
                                : 'Nicht verfuegbar'
                        },
                        {
                            label: 'Kommentare',
                            value: hasNonNegativeNumber(article.commentStats.total)
                                ? String(article.commentStats.total)
                                : 'Keine Daten'
                        },
                        {
                            label: 'Positiv',
                            value: hasNonNegativeNumber(article.commentStats.green)
                                ? String(article.commentStats.green)
                                : 'Keine Daten'
                        },
                        {
                            label: 'Negativ',
                            value: hasNonNegativeNumber(article.commentStats.red)
                                ? String(article.commentStats.red)
                                : 'Keine Daten'
                        }
                    ]);
                }

                if (article.kiMeta && typeof article.kiMeta === 'object') {
                    drawMetricTiles('KI-Metadaten', [
                        { label: 'Modell', value: article.kiMeta.model },
                        { label: 'Modus', value: article.kiMeta.apiMode },
                        { label: 'Reasoning', value: article.kiMeta.reasoning },
                        { label: 'Cache-Zeit', value: ArticleExporter.formatDate(article.kiMeta.summaryCachedAt) }
                    ]);
                }
            }

            renderOverviewPages(overviewPageNumbers, overviewPages, articleDestinations);

            const totalPages = doc.getNumberOfPages();
            for (let page = 1; page <= totalPages; page += 1) {
                doc.setPage(page);
                setText(page === 1 ? [209, 218, 228] : theme.muted);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.text(
                    fitSingleLine(
                        ArticleExporter.cleanText(meta.newsSource) || 'News Export',
                        220
                    ),
                    layout.marginX,
                    pageH - 16
                );
                if (page === totalPages) {
                    doc.text(
                        fitSingleLine(ArticleExporter.exportAttribution(), 220),
                        pageW / 2,
                        pageH - 16,
                        { align: 'center' }
                    );
                }
                doc.text(`Seite ${page} / ${totalPages}`, pageW - layout.marginX, pageH - 16, {
                    align: 'right'
                });
            }

            doc.save(fileName);
            return true;
        }
    }

    global.ArticleExporter = ArticleExporter;
})(typeof window !== 'undefined' ? window : globalThis);
