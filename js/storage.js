/**
 * Cucumber NewsScraper — IndexedDB storage for news items, summaries, and settings.
 *
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Daniel Mengel
 */

class NewsStorage {
    constructor() {
        this.dbName = 'HeiseNewsDashboard';
        this.dbVersion = 4;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('IndexedDB error:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB initialized successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // News store: array of news articles
                if (!db.objectStoreNames.contains('news')) {
                    const newsStore = db.createObjectStore('news', { keyPath: 'id' });
                    newsStore.createIndex('timestamp', 'timestamp', { unique: false });
                    newsStore.createIndex('category', 'category', { unique: false });
                }

                // Summaries store: AI-generated summaries
                if (!db.objectStoreNames.contains('summaries')) {
                    const summaryStore = db.createObjectStore('summaries', { keyPath: 'url' });
                }

                // YouTube-related videos store
                if (!db.objectStoreNames.contains('youtubeRelated')) {
                    const youtubeStore = db.createObjectStore('youtubeRelated', { keyPath: 'articleKey' });
                }

                // Per-article UI flags (favorite/hidden/read state)
                if (!db.objectStoreNames.contains('articleFlags')) {
                    db.createObjectStore('articleFlags', { keyPath: 'articleKey' });
                }

                // Reddit threads per article
                if (!db.objectStoreNames.contains('redditThreads')) {
                    db.createObjectStore('redditThreads', { keyPath: 'articleKey' });
                }

                // Settings store: user preferences
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };
        });
    }

    // Save news articles to IndexedDB
    async saveNews(articles) {
        const rows = Array.isArray(articles) ? articles : [];
        const sources = [
            ...new Set(
                rows
                    .map((article) => String(article && article.newsSource ? article.newsSource : '').trim())
                    .filter(Boolean)
            )
        ];
        if (sources.length === 1) {
            return this.replaceNewsForSource(sources[0], rows);
        }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['news'], 'readwrite');
            const store = transaction.objectStore('news');

            // Clear existing news and add new ones
            const clearRequest = store.clear();
            
            clearRequest.onsuccess = () => {
                // addAll() is not supported in Safari and some browsers — use put() per item
                if (!articles || articles.length === 0) {
                    resolve(0);
                    return;
                }
                let pending = articles.length;
                let hadError = null;
                articles.forEach((article) => {
                    const req = store.put(article);
                    req.onsuccess = () => {
                        pending -= 1;
                        if (pending === 0 && !hadError) {
                            console.log(`Saved ${articles.length} articles to IndexedDB`);
                            resolve(articles.length);
                        }
                    };
                    req.onerror = () => {
                        hadError = req.error;
                        console.error('Error saving article:', req.error);
                        reject(req.error);
                    };
                });
            };

            transaction.onerror = () => {
                console.error('Transaction error:', transaction.error);
                reject(transaction.error);
            };
        });
    }

    /**
     * Replace only one source's articles in IndexedDB and keep the others intact.
     * @param {string} sourceId
     * @param {Array<Record<string, unknown>>} articles
     */
    async replaceNewsForSource(sourceId, articles) {
        const targetSource = String(sourceId || '').trim();
        const rows = Array.isArray(articles) ? articles : [];
        if (!targetSource) {
            return 0;
        }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['news'], 'readwrite');
            const store = transaction.objectStore('news');
            /** @type {Array<string|number|Date|IDBValidKey>} */
            const keysToDelete = [];

            const writeRows = () => {
                if (rows.length === 0) {
                    resolve(0);
                    return;
                }
                let pending = rows.length;
                let failed = false;
                rows.forEach((article) => {
                    const data = {
                        ...article,
                        newsSource: targetSource
                    };
                    const req = store.put(data);
                    req.onsuccess = () => {
                        pending -= 1;
                        if (pending === 0 && !failed) {
                            resolve(rows.length);
                        }
                    };
                    req.onerror = () => {
                        if (failed) {
                            return;
                        }
                        failed = true;
                        reject(req.error);
                    };
                });
            };

            const deleteCollected = () => {
                if (keysToDelete.length === 0) {
                    writeRows();
                    return;
                }
                let index = 0;
                const deleteNext = () => {
                    if (index >= keysToDelete.length) {
                        writeRows();
                        return;
                    }
                    const key = keysToDelete[index];
                    index += 1;
                    const req = store.delete(key);
                    req.onsuccess = () => deleteNext();
                    req.onerror = () => reject(req.error);
                };
                deleteNext();
            };

            const cursorRequest = store.openCursor();
            cursorRequest.onsuccess = () => {
                const cursor = cursorRequest.result;
                if (cursor) {
                    const row = cursor.value;
                    const rowSource = String(row && row.newsSource ? row.newsSource : '').trim();
                    if (rowSource === targetSource) {
                        keysToDelete.push(cursor.primaryKey);
                    }
                    cursor.continue();
                    return;
                }
                deleteCollected();
            };
            cursorRequest.onerror = () => reject(cursorRequest.error);

            transaction.onerror = () => {
                reject(transaction.error);
            };
        });
    }

    /**
     * Save or update one article in the persistent news cache without touching other source rows.
     * @param {Record<string, unknown>} article
     * @returns {Promise<boolean>}
     */
    async saveNewsArticle(article) {
        if (!article || article.id == null || String(article.id).trim() === '') {
            return false;
        }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['news'], 'readwrite');
            const store = transaction.objectStore('news');
            const request = store.put(article);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Remove one article from the persistent news cache by its store key.
     * @param {IDBValidKey|string|number|Date} articleId
     * @returns {Promise<boolean>}
     */
    async deleteNewsArticle(articleId) {
        if (articleId == null || String(articleId).trim() === '') {
            return false;
        }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['news'], 'readwrite');
            const store = transaction.objectStore('news');
            const request = store.delete(articleId);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // Get all news from IndexedDB
    async getAllNews() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['news'], 'readonly');
            const store = transaction.objectStore('news');
            const request = store.getAll();

            request.onsuccess = () => {
                const rows = request.result || [];
                // timestamp may be human text ("vor 3 Stunden") — sort by fetchedAt when present
                const news = [...rows].sort((a, b) => {
                    const ta = a.fetchedAt ? new Date(a.fetchedAt).getTime() : 0;
                    const tb = b.fetchedAt ? new Date(b.fetchedAt).getTime() : 0;
                    return tb - ta;
                });
                resolve(news);
            };

            request.onerror = () => {
                console.error('Error getting news:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * @param {string} url
     * @param {string} summary
     * @param {Array<{ title: string, url: string, source?: string }>} [alternativeLinks]
     */
    async saveSummary(url, summary, alternativeLinks) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['summaries'], 'readwrite');
            const store = transaction.objectStore('summaries');

            const data = {
                url: url,
                summary: summary,
                timestamp: new Date().toISOString()
            };
            if (alternativeLinks != null && Array.isArray(alternativeLinks)) {
                if (alternativeLinks.length > 0) {
                    data.alternativeLinks = alternativeLinks;
                }
                /* empty array: omit field so stored entry has no stale links */
            }

            const request = store.put(data);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // Get AI summary from IndexedDB (text only — use getSummaryWithMeta for TTL)
    async getSummary(url) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['summaries'], 'readonly');
            const store = transaction.objectStore('summaries');
            const request = store.get(url);

            request.onsuccess = () => {
                resolve(request.result ? request.result.summary : null);
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * @returns {Promise<{ summary: string, cachedAt: string, alternativeLinks?: Array<{ title: string, url: string, source?: string }> } | null>}
     */
    async getSummaryWithMeta(url) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['summaries'], 'readonly');
            const store = transaction.objectStore('summaries');
            const request = store.get(url);

            request.onsuccess = () => {
                const r = request.result;
                if (!r || typeof r.summary !== 'string') {
                    resolve(null);
                    return;
                }
                const out = {
                    summary: r.summary,
                    cachedAt: r.timestamp || new Date(0).toISOString()
                };
                if (Array.isArray(r.alternativeLinks) && r.alternativeLinks.length > 0) {
                    out.alternativeLinks = r.alternativeLinks;
                }
                resolve(out);
            };

            request.onerror = () => reject(request.error);
        });
    }

    /** Remove cached summary (e.g. force regeneration). */
    async deleteSummary(url) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['summaries'], 'readwrite');
            const store = transaction.objectStore('summaries');
            const request = store.delete(url);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // Save user settings
    async saveSettings(settings) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');

            Object.entries(settings).forEach(([key, value]) => {
                if (value === undefined) {
                    return;
                }
                store.put({ key, value });
            });

            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
        });
    }

    // Get user settings
    async getSettings() {
        const defaults = {
            updateInterval: 60,
            customInterval: 60,
            disabledCategoriesBySource: {},
            favoriteNewsSources: [],
            selectedCategories: [
                'it',
                'security',
                'ki',
                'wissenschaft',
                'mobiles',
                'entertainment',
                'wirtschaft',
                'netzpolitik',
                'journal',
                'heise_ix',
                'heise_ct',
                'heise_foto',
                'heise_mac',
                'heise_make',
                'heise_autos',
                'telepolis'
            ],
            /** Bump when new category filter keys are added (migration in App.loadSettings). */
            categoryFilterSchemaVersion: 2,
            /** Heise magazine subsection feed ids (ix, ct, …) merged into heise.de when non-empty. */
            enabledHeiseMagazines: [],
            theme: 'system',
            /** Per-mode surface overrides (optional hex per key); merged with built-in defaults in App.applyThemeSurfaceVariables */
            themeCustomColors: { light: {}, dark: {} },
            /** Optional overrides for --header-surface, --header-text, --header-border per mode */
            themeCustomHeaderColors: { light: {}, dark: {} },
            /** Surface brightness 0–100 (50 = default); applied to bg/secondary/card/border per mode */
            themeSurfaceBrightness: { light: 50, dark: 50, version: 2 },
            /** Header transparency 0–100 (0 = opaque, 100 = fully transparent) per mode */
            themeHeaderTransparency: { light: 0, dark: 0, version: 1 },
            /** Accent palette: heise | ocean | forest | violet | amber | rose | slate | midnight */
            colorTheme: 'slate',
            /** Badge/highlight colors for article states: new, seen, read */
            articleStateColors: { new: '#2d8a3e', seen: '#d9a20b', read: '#6b7280' },
            /** OpenAI-compatible API base including /v1, e.g. http://127.0.0.1:1234/v1 */
            apiBaseUrl: 'http://127.0.0.1:1234/v1',
            /** LM Studio 0.4+ native REST: server root only, e.g. http://127.0.0.1:1234 */
            lmRestRoot: 'http://127.0.0.1:1234',
            /** Anthropic Messages API base including /v1, e.g. https://api.anthropic.com/v1 */
            anthropicApiBaseUrl: 'https://api.anthropic.com/v1',
            /** openai | lm_rest_v1 | anthropic */
            kiApiMode: 'lm_rest_v1',
            /** Optional Bearer token for LM/OpenAI-compatible APIs; required x-api-key for Anthropic */
            lmApiToken: '',
            /** REST calls to same origin as page (dev_server.py) — avoids browser OPTIONS to LM Studio */
            restSameOrigin: false,
            /** LM Studio / local model id when lmModelSelectionMode is manual; empty = use loaded model */
            lmModel: '',
            /** auto = use currently loaded LM Studio model, manual = use lmModel exactly */
            lmModelSelectionMode: 'auto',
            /** Days to keep AI summary in IndexedDB cache (0 = unlimited age) */
            summaryCacheDays: 14,
            /** Max parallel AI summary requests for batch / auto-summarize (1–16) */
            summaryConcurrency: 4,
            /** Per-request HTTP timeout for KI calls (seconds); LM REST includes model resolve + chat in one controller */
            summaryRequestTimeoutSeconds: 120,
            /** Selected reasoning level for LM Studio REST: off | low | medium | high | on */
            reasoning: 'off',
            /** Whether the LM Studio REST `reasoning` field should be sent at all. */
            reasoningEnabled: false,
            /** How many alternative article URLs the KI may suggest (0 = off) */
            alternativeLinksCount: 5,
            /** expanded = show links under summary; collapsed = show after “Weitere Quellen” */
            alternativeLinksDisplayMode: 'expanded',
            /** Forum discovery: click = only when user clicks forum button; always = auto-fetch under article sources */
            forumEntriesDiscoveryMode: 'click',
            /** Newline/comma-separated hostnames that must not appear in alternative links */
            alternativeLinksDomainBlacklist: '',
            /** duckduckgo | google | bing — for “Weitere Artikel” web search button */
            webSearchEngine: 'duckduckgo',
            /** KI summary language: site = match article site (de/en), browser = navigator language */
            summaryLangMode: 'site',
            /** KI summary writing style / tone: factual | professional | casual */
            summaryStyle: 'factual',
            /** Optional free-text style wish appended on top of the chosen summaryStyle (empty = none) */
            summaryStyleCustom: '',
            /** Machine-translate article area (titles, summaries, links text) via Google Translate widget */
            articleTranslationEnabled: false,
            /** BCP 47 / Google Translate target language (e.g. de, en, fr, zh-CN) */
            articleTranslationTargetLang: 'de',
            /** Wrap outgoing article links: google (translate.goog) | google_classic | bing */
            articleTranslationLinkProvider: 'google',
            /** Article list sort: recency | date_day | date_range | comments | green | red */
            sortMode: 'recency',
            sortDateSingle: '',
            sortDateFrom: '',
            sortDateTo: '',
            /** Header: show remote heise logo vs. text wordmark */
            headerBrandMode: 'logo',
            /** Show feed-provided article thumbnails in dashboard cards when available */
            articleThumbnailsEnabled: true,
            /** News source: heise | telepolis | golem | computerbase | t3n | it_administrator | verge */
            newsSource: 'heise',
            /**
             * Subset of catalog sources shown in the header “Quelle” dropdown; empty array = all (see App.normalizeEnabledNewsSourcesArray).
             * @type {string[]}
             */
            enabledNewsSources: [],
            /** Refresh all enabled article sources on the header timer and prewarm KI/links/Reddit in the background. */
            backgroundSelectedSourcesRefreshEnabled: false,
            /** Which sources the background refresh covers: 'favorites' (only starred) or 'enabled' (all enabled). */
            backgroundSelectedSourcesRefreshScope: 'favorites',
            /** Bumped when catalog migrations run (see App.loadSettings); v2 Telepolis, v3 IT-Administrator. */
            newsSourcesCatalogMigrationVersion: 0
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const keys = Object.keys(defaults);
            const settings = { ...defaults };

            let completed = 0;
            keys.forEach((key) => {
                const request = store.get(key);
                request.onsuccess = () => {
                    const row = request.result;
                    if (!row) {
                        settings[key] = defaults[key];
                    } else {
                        const v = row.value;
                        settings[key] = v === undefined ? defaults[key] : v;
                    }
                    completed += 1;
                    if (completed === keys.length) {
                        resolve(settings);
                    }
                };
                request.onerror = () => reject(request.error);
            });
        });
    }

    // Clear all news data
    async clearNews() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['news'], 'readwrite');
            const store = transaction.objectStore('news');
            const request = store.clear();

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // Get news count
    async getNewsCount() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['news'], 'readonly');
            const store = transaction.objectStore('news');
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // YouTube-related videos: save
    async saveYoutubeRelated(articleKey, payload) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['youtubeRelated'], 'readwrite');
            const store = transaction.objectStore('youtubeRelated');
            const data = {
                articleKey: articleKey,
                cachedAt: new Date().toISOString(),
                ...payload
            };
            const request = store.put(data);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // YouTube-related videos: get with metadata (for TTL check)
    async getYoutubeRelatedWithMeta(articleKey) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['youtubeRelated'], 'readonly');
            const store = transaction.objectStore('youtubeRelated');
            const request = store.get(articleKey);
            request.onsuccess = () => {
                const r = request.result;
                if (!r || !Array.isArray(r.items)) {
                    resolve(null);
                    return;
                }
                resolve({
                    cachedAt: r.cachedAt || new Date(0).toISOString(),
                    items: r.items,
                    searchQueryUsed: r.searchQueryUsed || null
                });
            };
            request.onerror = () => reject(request.error);
        });
    }

    // YouTube-related videos: get text only (items array)
    async getYoutubeRelated(articleKey) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['youtubeRelated'], 'readonly');
            const store = transaction.objectStore('youtubeRelated');
            const request = store.get(articleKey);
            request.onsuccess = () => {
                resolve(request.result ? (request.result.items || []) : []);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // YouTube-related videos: delete
    async deleteYoutubeRelated(articleKey) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['youtubeRelated'], 'readwrite');
            const store = transaction.objectStore('youtubeRelated');
            const request = store.delete(articleKey);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * @param {string} articleKey
     * @param {Array<{ title: string, url: string }>} threads
     * @param {string[]} [aiQueries]
     */
    async saveRedditThreads(articleKey, threads, aiQueries) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['redditThreads'], 'readwrite');
            const store = transaction.objectStore('redditThreads');
            const data = {
                articleKey,
                threads: threads || [],
                cachedAt: new Date().toISOString()
            };
            if (Array.isArray(aiQueries) && aiQueries.length > 0) {
                data.aiQueries = aiQueries;
            }
            const request = store.put(data);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    /** @returns {Promise<{ threads: Array<{ title: string, url: string }>, cachedAt: string, aiQueries?: string[] } | null>} */
    async getRedditThreadsWithMeta(articleKey) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['redditThreads'], 'readonly');
            const store = transaction.objectStore('redditThreads');
            const request = store.get(articleKey);
            request.onsuccess = () => {
                const r = request.result;
                if (!r || !Array.isArray(r.threads)) {
                    resolve(null);
                    return;
                }
                const out = {
                    threads: r.threads,
                    cachedAt: r.cachedAt || new Date(0).toISOString()
                };
                if (Array.isArray(r.aiQueries) && r.aiQueries.length > 0) {
                    out.aiQueries = r.aiQueries;
                }
                resolve(out);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async deleteRedditThreads(articleKey) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['redditThreads'], 'readwrite');
            const store = transaction.objectStore('redditThreads');
            const request = store.delete(articleKey);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // Article flags: save
    async saveArticleFlag(articleKey, patch) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['articleFlags'], 'readwrite');
            const store = transaction.objectStore('articleFlags');
            const getReq = store.get(articleKey);
            getReq.onsuccess = () => {
                const prev = getReq.result || { articleKey };
                const data = {
                    ...prev,
                    ...patch,
                    articleKey,
                    updatedAt: new Date().toISOString()
                };
                const putReq = store.put(data);
                putReq.onsuccess = () => resolve(true);
                putReq.onerror = () => reject(putReq.error);
            };
            getReq.onerror = () => reject(getReq.error);
        });
    }

    // Article flags: get one
    async getArticleFlag(articleKey) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['articleFlags'], 'readonly');
            const store = transaction.objectStore('articleFlags');
            const request = store.get(articleKey);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    // Article flags: get all
    async getAllArticleFlags() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['articleFlags'], 'readonly');
            const store = transaction.objectStore('articleFlags');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }
}

// Export for use in other modules
window.NewsStorage = NewsStorage;
