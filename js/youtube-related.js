/**
 * Cucumber NewsScraper — YouTube search suggestions via KI JSON (no Data API required by default).
 *
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Daniel Mengel
 */

class YoutubeRelated {
    constructor() {
        this.storage = null;
        /** @type {AISummarizer|null} */
        this.summarizer = null;
    }

    setStorage(storage) {
        this.storage = storage;
    }

    setSummarizer(summarizer) {
        this.summarizer = summarizer;
    }

    /**
     * @param {string} articleUrl
     * @returns {string}
     */
    static normalizeArticleKey(articleUrl) {
        if (!articleUrl || typeof articleUrl !== 'string') return '';
        const s = String(articleUrl).trim();
        const q = s.indexOf('?');
        const h = s.indexOf('#');
        let cut = s.length;
        if (q >= 0) cut = Math.min(cut, q);
        if (h >= 0) cut = Math.min(cut, h);
        let out = s.slice(0, cut);
        if (out.length > 1 && out.endsWith('/')) {
            out = out.slice(0, -1);
        }
        return out;
    }

    /**
     * Fix common JSON mistakes from LLMs (missing commas between objects/arrays, trailing commas).
     * @param {string} s
     * @returns {string}
     */
    static repairModelJsonLoose(s) {
        let out = String(s);
        // Adjacent objects: `}{` or `} {` → `},{` (very common when models omit commas in "items")
        out = out.replace(/}\s*{/g, '},{');
        // Adjacent arrays: `][` → `],[`
        out = out.replace(/]\s*\[/g, '],[');
        // Trailing comma before } or ]
        out = out.replace(/,(\s*[}\]])/g, '$1');
        return out;
    }

    /**
     * Strip markdown fences and extract the first JSON object from model output.
     * @param {string} raw
     * @returns {object|null}
     */
    static parseSuggestionsJson(raw) {
        if (!raw || typeof raw !== 'string') {
            return null;
        }
        let t = raw.trim();
        const fence = /^```(?:json)?\s*([\s\S]*?)```/im.exec(t);
        if (fence && fence[1]) {
            t = fence[1].trim();
        }
        const start = t.indexOf('{');
        if (start === -1) {
            return null;
        }
        let depth = 0;
        let end = -1;
        for (let i = start; i < t.length; i++) {
            const c = t[i];
            if (c === '{') depth++;
            else if (c === '}') {
                depth--;
                if (depth === 0) {
                    end = i;
                    break;
                }
            }
        }
        if (end === -1) {
            return null;
        }
        const slice = t.slice(start, end + 1);
        const tryParse = (jsonStr) => {
            try {
                return JSON.parse(jsonStr);
            } catch {
                return null;
            }
        };
        let parsed = tryParse(slice);
        if (parsed) {
            return parsed;
        }
        parsed = tryParse(YoutubeRelated.repairModelJsonLoose(slice));
        return parsed;
    }

    /**
     * @param {{ url?: string, title?: string, description?: string }} ctx
     * @returns {Promise<{ items: Array<{videoId: string, title: string, channelTitle: string, watchUrl: string, thumbUrl: string, summary: string}>, searchQueryUsed?: string }>}
     */
    async fetchAndSummarize(ctx) {
        const summarizer = this.summarizer;
        if (!summarizer) {
            throw new Error('AISummarizer nicht initialisiert.');
        }

        const urlKey = YoutubeRelated.normalizeArticleKey(ctx.url || '');
        if (!urlKey) {
            throw new Error('Keine gültige Artikel-URL.');
        }

        const title = (ctx.title || '').trim();
        const description = (ctx.description || '').trim();

        const systemPrompt = `You are a careful assistant. Respond with ONLY valid JSON (one object). No markdown code fences, no text before or after the JSON.`;

        const userPrompt = `Article context:
Title: ${title || '(none)'}
Description: ${description || '(none)'}
Canonical URL: ${urlKey}

Task: Suggest YouTube **search directions** for a reader who wants to explore this topic on YouTube. You do **not** have access to YouTube or the internet — infer plausible search topics only from the article text above.

**Important rules:**
- Do **not** invent video IDs, watch URLs, or claim specific videos exist.
- Each suggestion must use a **search query** that will be opened as: https://www.youtube.com/results?search_query=…
- Write \`title\` (card headline) and \`summary\` in **German**.
- \`searchQuery\` can be German or English (whatever matches YouTube search habits best), max 80 characters each.
- Return between 3 and 10 items.

Return exactly this JSON shape:
{"overview":"one short German line (max 120 chars) describing the overall angle","items":[{"title":"…","summary":"2–4 German sentences explaining why this search helps","searchQuery":"…"}]}`;

        let rawText;
        try {
            rawText = await summarizer.completePrompt(systemPrompt, userPrompt);
        } catch (e) {
            throw new Error(e.message || String(e));
        }

        const parsed = YoutubeRelated.parseSuggestionsJson(rawText);
        const list = parsed && Array.isArray(parsed.items) ? parsed.items : null;
        if (!list || list.length === 0) {
            throw new Error(
                'Die KI lieferte keine verwertbare JSON-Liste. Bitte erneut versuchen oder ein anderes Modell wählen.'
            );
        }

        const overview =
            typeof parsed.overview === 'string' ? parsed.overview.trim().slice(0, 200) : '';

        const items = list.slice(0, 10).map((row, i) => {
            const q = String(row.searchQuery || row.query || '').trim().slice(0, 200);
            const enc = encodeURIComponent(q);
            const watchUrl = q
                ? `https://www.youtube.com/results?search_query=${enc}`
                : 'https://www.youtube.com/';
            const vidKey = q ? `q-${i}-${q.slice(0, 24)}` : `row-${i}`;
            return {
                videoId: `yt-suggest-${i}-${vidKey.replace(/[^a-zA-Z0-9_-]/g, '')}`,
                title: String(row.title || q || `Vorschlag ${i + 1}`).trim().slice(0, 200),
                channelTitle: '',
                watchUrl,
                thumbUrl: '',
                summary: String(row.summary || '').trim().slice(0, 1200) || '(keine Kurzbeschreibung)'
            };
        });

        const searchQueryUsed = overview || (items[0] && items[0].title) || title.slice(0, 80);

        return { items, searchQueryUsed };
    }

    /**
     * Optional: legacy path if a server exposes `/api/youtube-search` with API key (not required).
     * @param {string} query
     * @returns {Promise<{ok: boolean, items?: unknown[], error?: string}>}
     */
    async fetchYoutubeVideos(query) {
        if (!query || query.length > 500) {
            return { ok: false, error: 'Ungültiger Suchbegriff.' };
        }
        try {
            const origin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
            const url = `${origin}/api/youtube-search?q=${encodeURIComponent(query)}`;
            const resp = await fetch(url, { method: 'GET', mode: 'cors', credentials: 'omit' });
            const rawText = await resp.text();
            let data;
            try {
                data = JSON.parse(rawText.trim());
            } catch {
                return { ok: false, error: 'Ungültige Antwort vom Server.' };
            }
            if (!resp.ok || !data.ok) {
                return { ok: false, error: data.error || 'YouTube-Suche fehlgeschlagen.' };
            }
            return { ok: true, items: data.items || [] };
        } catch (e) {
            return { ok: false, error: e.message || 'Netzwerkfehler.' };
        }
    }

    /**
     * @param {{ url?: string, title?: string, description?: string }} ctx
     * @returns {Promise<{ cachedAt: string, items: Array<{videoId: string, title: string, channelTitle: string, watchUrl: string, thumbUrl: string, summary: string}>, searchQueryUsed?: string } | null>}
     */
    async getCached(ctx) {
        if (!this.storage) throw new Error('Storage nicht initialisiert.');
        const urlKey = YoutubeRelated.normalizeArticleKey(ctx.url || '');
        if (!urlKey) return null;

        const entry = await this.storage.getYoutubeRelatedWithMeta(urlKey);
        if (!entry || !Array.isArray(entry.items)) return null;

        let maxAgeMs = Infinity;
        try {
            const raw = localStorage.getItem('heise_summary_cache_days');
            const days = raw !== null && raw !== '' ? parseInt(raw, 10) : 14;
            if (Number.isFinite(days) && days >= 0 && days <= 3650) {
                maxAgeMs = days === 0 ? Infinity : days * 86400000;
            }
        } catch (_) {
            /* ignore */
        }

        const cachedAtMs = new Date(entry.cachedAt || 0).getTime();
        if (maxAgeMs !== Infinity && Date.now() - cachedAtMs > maxAgeMs) {
            return null;
        }

        return entry;
    }

    /**
     * @param {{ url?: string, title?: string, description?: string }} ctx
     * @param {Array<{videoId: string, title: string, channelTitle: string, watchUrl: string, thumbUrl: string, summary: string}>} items
     * @param {string?} searchQueryUsed
     */
    async save(ctx, items, searchQueryUsed) {
        if (!this.storage) throw new Error('Storage nicht initialisiert.');
        const urlKey = YoutubeRelated.normalizeArticleKey(ctx.url || '');
        await this.storage.saveYoutubeRelated(urlKey, { items, searchQueryUsed });
    }

    /** Cache leeren für einen Artikel. */
    async invalidate(ctx) {
        if (!this.storage) return;
        const urlKey = YoutubeRelated.normalizeArticleKey(ctx.url || '');
        await this.storage.deleteYoutubeRelated(urlKey);
    }
}

window.YoutubeRelated = YoutubeRelated;
