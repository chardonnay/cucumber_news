/**
 * Cucumber NewsScraper — comment statistics UI (Heise, Telepolis, Golem via dev_server; stubs for other sources).
 *
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Daniel Mengel
 */

/** Mirrors the `comments` section of locales/de.json and en.json when fetch fails or keys are missing. */
const COMMENTS_I18N_FALLBACK = {
    de: {
        loading: 'Kommentare …',
        unavailable: 'Kommentar-Statistik nicht verfügbar (bitte scripts/dev_server.py starten).',
        unavailable_file: 'Kommentar-Statistik: Seite per file:// — bitte über den Dev-Server öffnen.',
        total: 'Kommentare gesamt: {count}',
        total_label: 'Kommentare gesamt:',
        total_unknown: 'Kommentare: —',
        total_hint: 'Aus dem Artikel (schema.org commentCount)',
        volume_badge_100: 'Sehr hohe Diskussion: über 100 Kommentare (Forum gesamt, schema.org)',
        volume_badge_300: 'Extrem hohe Diskussion: über 300 Kommentare',
        volume_badge_500: 'Außergewöhnlich viele Kommentare: über 500',
        green_hint: 'Sichtbare Beiträge mit Bewertung: Anteil positiv > 50 %',
        red_hint: 'Sichtbare Beiträge mit Bewertung: Anteil positiv ≤ 50 %',
        green_short: 'grün {n}',
        red_short: 'rot {n}',
        unrated_hint: 'Beiträge ohne sichtbare Bewertungsgrafik auf dieser Seite',
        unrated_short: 'ohne Bewertung {n}',
        max_link: '{n} direkte Antworten',
        max_link_title: 'Forenbeitrag mit den meisten direkten Antworten (aktuelle Ansicht)',
        max_replies_standalone_label: 'Meiste Antworten (Forenbeitrag)',
        max_replies_standalone_aria: 'Forenbeitrag mit den meisten direkten Antworten öffnen: {n} Antworten',
        max_replies_open_action: '↗ Öffnen',
        partial: 'Bewertungen/Antworten nur erste Seite',
        no_comments: 'Keine Kommentare',
        login_wall: 'Forum nur eingeschränkt sichtbar — im Browser öffnen.',
        rate_limited_hint:
            'Forum-Daten vorübergehend nicht verfügbar (zu viele Anfragen). Bitte kurz warten und erneut versuchen.',
        rate_limited_retry: 'Erneut laden',
        forum_mood_label: 'Forum-Laune',
        forum_mood_happy_title: 'Deutlich mehr positive Bewertungen (grün) als negative (rot)',
        forum_mood_unhappy_title: 'Deutlich mehr negative Bewertungen (rot) als positive (grün)',
        rss_only_note:
            'Golem: Kommentarzahl und Forum-Link stammen aus dem RSS-Feed; grün/rot-Bewertungen wie bei Heise sind hier nicht verfügbar.',
        rss_not_in_feed: 'Artikel nicht im aktuellen RSS-Fenster (nur neuere Meldungen).',
        golem_forum_link: 'Forum',
        rss_stub_note:
            'Für diese Quelle liefert der Feed keine Kommentarzahlen für die API — Diskussion siehe Artikelseite.',
        rss_stub_verge:
            'The Verge: Kommentare (Coral) laden nur auf der Artikelseite; keine öffentliche Zähl-API — Link springt zur Kommentarsektion.',
        article_open_link: 'Zum Artikel',
        warn_no_discussion_url:
            'Für diesen Artikel liefern heise.de bzw. telepolis.de keinen Forum-Link in den Metadaten (z. B. manche Bestenlisten). Grün/rot-Statistik entfällt.'
    },
    en: {
        loading: 'Comments …',
        unavailable: 'Comment stats unavailable (start scripts/dev_server.py).',
        unavailable_file: 'Comment stats: open the app via the dev server, not file://.',
        total: 'Comments total: {count}',
        total_label: 'Comments total:',
        total_unknown: 'Comments: —',
        total_hint: 'From the article (schema.org commentCount)',
        volume_badge_100: 'Very active discussion: over 100 comments (forum total, schema.org)',
        volume_badge_300: 'Extremely high discussion: over 300 comments',
        volume_badge_500: 'Exceptionally many comments: over 500',
        green_hint: 'Visible posts with rating: positive share > 50%',
        red_hint: 'Visible posts with rating: positive share ≤ 50%',
        green_short: 'green {n}',
        red_short: 'red {n}',
        unrated_hint: 'Posts without a visible rating bar on this page',
        unrated_short: 'unrated {n}',
        max_link: '{n} direct replies',
        max_link_title: 'Forum post with the most direct replies (current view)',
        max_replies_standalone_label: 'Most replies (forum thread)',
        max_replies_standalone_aria: 'Open forum thread with the most direct replies: {n} replies',
        max_replies_open_action: '↗ Open',
        partial: 'Ratings/replies: first page only',
        no_comments: 'No comments',
        login_wall: 'Forum may require login — open in browser.',
        rate_limited_hint:
            'Forum data temporarily unavailable (too many requests). Please wait and try again.',
        rate_limited_retry: 'Reload',
        forum_mood_label: 'Forum mood',
        forum_mood_happy_title: 'Clearly more positive ratings (green) than negative (red)',
        forum_mood_unhappy_title: 'Clearly more negative ratings (red) than positive (green)',
        rss_only_note:
            'Golem: comment count and forum link come from the RSS feed; green/red ratings (like Heise) are not available here.',
        rss_not_in_feed: 'Article not in the current RSS window (only recent items).',
        golem_forum_link: 'Forum',
        rss_stub_note:
            'This source does not expose comment counts via the feed API — see the article page for discussion.',
        rss_stub_verge:
            'The Verge: Coral comments load on the article page only; there is no public comment-count API — link jumps to the comments section.',
        article_open_link: 'Open article',
        warn_no_discussion_url:
            'heise.de or telepolis.de did not provide a forum link in metadata for this article (e.g. some best-of lists). Green/red stats are unavailable.'
    }
};

/**
 * Article URL for comment UI and prefetch (aligned with news cards: prefer `url`, else `link`).
 * @param {{ url?: string, link?: string }|null|undefined} item
 * @returns {string}
 */
function articleUrlFromFeedItem(item) {
    if (!item) {
        return '';
    }
    const u = item.url != null && String(item.url).trim() ? String(item.url).trim() : '';
    if (u) {
        return u;
    }
    return item.link != null && String(item.link).trim() ? String(item.link).trim() : '';
}

/**
 * Whether stats are loaded via GET /api/heise-comments (shared Heise + Telepolis forum stack).
 * @param {string} u
 * @returns {boolean}
 */
function isHeiseCommentsApiArticleUrl(u) {
    const s = String(u || '').trim();
    if (!s) {
        return false;
    }
    return (
        s.startsWith('https://www.heise.de/') ||
        s.startsWith('https://heise.de/') ||
        s.startsWith('https://www.telepolis.de/') ||
        s.startsWith('https://telepolis.de/') ||
        s.startsWith('http://www.heise.de/') ||
        s.startsWith('http://heise.de/') ||
        s.startsWith('http://www.telepolis.de/') ||
        s.startsWith('http://telepolis.de/')
    );
}

function resolveLocalesJsonUrl(file) {
    try {
        const path = window.location.pathname || '/';
        const basePath = path.endsWith('/') ? path : path.replace(/\/[^/]*$/, '/');
        return new URL(`locales/${file}.json`, window.location.origin + basePath).href;
    } catch (_) {
        return `locales/${file}.json`;
    }
}

/**
 * Primary URL (relative to current path) and site-root fallback (works if the app lives in a subpath).
 * @param {string} file
 * @returns {string[]}
 */
function localesJsonCandidateUrls(file) {
    const primary = resolveLocalesJsonUrl(file);
    const root = `${window.location.origin}/locales/${file}.json`;
    return primary === root ? [primary] : [primary, root];
}

/** Inline SVG: thread / replies symbol (replaces the old text label on the “most replies” link). */
const NEWS_COMMENTS_MAX_REPLIES_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="news-comments-max-link__icon-svg" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M9 10h6"/><path d="M9 14h4"/></svg>`;

/**
 * @param {string} url
 * @returns {string}
 */
function heiseCommentsWrapArticleUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) {
        return raw;
    }
    try {
        const app = typeof window !== 'undefined' ? window.app : null;
        if (app && typeof app.maybeWrapUrlForArticleTranslation === 'function') {
            return app.maybeWrapUrlForArticleTranslation(raw);
        }
    } catch (_) {
        /* ignore */
    }
    return raw;
}

const HeiseComments = {
    /** @type {Record<string, string>|undefined} */
    _strings: undefined,
    /** @type {Promise<void>|null} */
    _stringsLoadPromise: null,
    _cache: new Map(),
    _ttlMs: 5 * 60 * 1000,

    _commentsLocaleFile() {
        const lang = (document.documentElement && document.documentElement.lang) || 'de';
        return lang.toLowerCase().startsWith('en') ? 'en' : 'de';
    },

    /**
     * Map dev_server English warnings to locale strings where possible.
     * @param {string} w
     * @returns {string}
     */
    localizeCommentWarning(w) {
        const s = String(w || '');
        if (/No discussionUrl in JSON-LD|forum stats omitted/i.test(s)) {
            return this.t('warn_no_discussion_url');
        }
        return s;
    },

    /**
     * @returns {Promise<Record<string, string>>}
     */
    async loadStrings() {
        if (this._strings !== undefined) {
            return this._strings;
        }
        if (!this._stringsLoadPromise) {
            const self = this;
            this._stringsLoadPromise = (async () => {
                const file = self._commentsLocaleFile();
                const fallback = COMMENTS_I18N_FALLBACK[file] || COMMENTS_I18N_FALLBACK.de;
                let remote = {};
                try {
                    for (const url of localesJsonCandidateUrls(file)) {
                        try {
                            const r = await fetch(url, { cache: 'no-store' });
                            if (!r.ok) {
                                continue;
                            }
                            const data = await r.json();
                            const c = data && data.comments;
                            if (c && typeof c === 'object' && !Array.isArray(c)) {
                                remote = c;
                                break;
                            }
                        } catch (_) {
                            /* try next candidate */
                        }
                    }
                } catch (_) {
                    /* use fallback only */
                }
                self._strings = { ...fallback, ...remote };
            })().catch(() => {
                const file = self._commentsLocaleFile();
                self._strings = { ...(COMMENTS_I18N_FALLBACK[file] || COMMENTS_I18N_FALLBACK.de) };
            });
        }
        await this._stringsLoadPromise;
        if (this._strings === undefined) {
            const file = this._commentsLocaleFile();
            this._strings = { ...(COMMENTS_I18N_FALLBACK[file] || COMMENTS_I18N_FALLBACK.de) };
        }
        return this._strings;
    },

    t(key, vars) {
        const fb = COMMENTS_I18N_FALLBACK[this._commentsLocaleFile()] || COMMENTS_I18N_FALLBACK.de;
        const raw = (this._strings && this._strings[key]) || fb[key] || key;
        if (!vars) {
            return raw;
        }
        return raw.replace(/\{(\w+)\}/g, (_, k) =>
            vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : ''
        );
    },

    /**
     * Schema.org total comment line; the numeric count is blue when it is greater than zero.
     * @param {unknown} total
     * @returns {string}
     */
    buildCommentTotalHtml(total) {
        const hint = this.escapeHtml(this.t('total_hint'));
        if (total === null || total === undefined) {
            return `<span class="heise-comment-total" title="${hint}">${this.escapeHtml(this.t('total_unknown'))}</span>`;
        }
        const n = typeof total === 'number' ? total : parseInt(String(total).trim(), 10);
        if (!Number.isFinite(n)) {
            return `<span class="heise-comment-total" title="${hint}">${this.escapeHtml(this.t('total', { count: total }))}</span>`;
        }
        if (n > 0) {
            const label = this.escapeHtml(this.t('total_label'));
            const num = this.escapeHtml(String(n));
            return `<span class="heise-comment-total heise-comment-total--positive" title="${hint}"><span class="heise-comment-total__label">${label}</span><span class="heise-comment-total__value">${num}</span></span>`;
        }
        return `<span class="heise-comment-total" title="${hint}">${this.escapeHtml(this.t('total', { count: n }))}</span>`;
    },

    /**
     * @param {string} articleUrl
     * @returns {Promise<object>}
     */
    async fetchStats(articleUrl) {
        const u = String(articleUrl || '').trim();
        let apiPath = '/api/heise-comments';
        if (u.startsWith('https://www.golem.de/') || u.startsWith('https://golem.de/')) {
            apiPath = '/api/golem-comments';
        } else if (u.startsWith('https://www.computerbase.de/') || u.startsWith('https://computerbase.de/')) {
            apiPath = '/api/computerbase-comments';
        } else if (u.startsWith('https://t3n.de/')) {
            apiPath = '/api/t3n-comments';
        } else if (u.startsWith('https://www.theverge.com/') || u.startsWith('https://theverge.com/')) {
            apiPath = '/api/verge-comments';
        } else if (isHeiseCommentsApiArticleUrl(u)) {
            apiPath = '/api/heise-comments';
        } else {
            return { ok: false, error: 'not_heise' };
        }
        const hit = this._cache.get(u);
        if (hit && Date.now() - hit.t < this._ttlMs && hit.data && hit.data.ok !== false) {
            return hit.data;
        }
        if (typeof window === 'undefined' || !window.location || window.location.protocol === 'file:') {
            return { ok: false, error: 'file_protocol' };
        }
        const origin = window.location.origin;
        const api = `${origin}${apiPath}?url=${encodeURIComponent(u)}`;
        const ctrl = new AbortController();
        const to = window.setTimeout(() => ctrl.abort(), 22000);
        try {
            const r = await fetch(api, { method: 'GET', cache: 'no-store', signal: ctrl.signal });
            const data = await r.json();
            if (data && data.ok !== false) {
                const rateLimited = this.isForumRateLimited(data);
                if (!rateLimited) {
                    this._cache.set(u, { t: Date.now(), data });
                }
            }
            return data;
        } catch (e) {
            return { ok: false, error: String(e && e.name === 'AbortError' ? 'timeout' : e) };
        } finally {
            window.clearTimeout(to);
        }
    },

    /**
 * Escape HTML for simple string insertions into textContent or attributes.
 */
escapeHtml(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    },

/**
 * Sanitize complex HTML templates with DOMPurify (recommended for innerHTML).
 * Blocks inline scripts, event handlers, and dangerous tags.
 */
sanitizeHtml(html) {
        if (typeof DOMPurify === 'undefined') {
            // Fallback to basic escape if DOMPurify not loaded
            const d = document.createElement('div');
            d.innerHTML = html;
            return d.textContent || '';
        }
        return DOMPurify.sanitize(html, {
            ALLOWED_TAGS: ['a', 'span', 'p', 'div'],
            ALLOWED_ATTR: ['href', 'title', 'aria-label', 'class', 'role']
        });
    },

    /**
     * Right-aligned badge when commentCount (schema.org total) exceeds thresholds.
     * @param {unknown} totalRaw
     * @returns {string} HTML fragment or empty
     */
    getCommentVolumeIndicatorHtml(totalRaw) {
        const n =
            typeof totalRaw === 'number' && Number.isFinite(totalRaw)
                ? totalRaw
                : parseInt(String(totalRaw ?? '').trim(), 10);
        if (!Number.isFinite(n) || n <= 100) {
            return '';
        }
        let level;
        let symbol;
        let titleKey;
        if (n > 500) {
            level = 'explode';
            symbol = '🤯';
            titleKey = 'volume_badge_500';
        } else if (n > 300) {
            level = 'scream';
            symbol = '😱';
            titleKey = 'volume_badge_300';
        } else {
            level = 'alert';
            symbol = '❗';
            titleKey = 'volume_badge_100';
        }
        const title = this.escapeHtml(this.t(titleKey));
        return `<span class="news-comments-volume-indicator news-comments-volume-indicator--${level}" title="${title}" role="img" aria-label="${title}">${symbol}</span>`;
    },

    /**
     * Forum fetch hit HTTP 429 (or legacy warning text).
     * @param {object} data
     * @returns {boolean}
     */
    isForumRateLimited(data) {
        if (!data || data.ok === false) {
            return false;
        }
        if (data.forum && data.forum.error === 'rate_limited') {
            return true;
        }
        if (!data.forum && Array.isArray(data.warnings)) {
            return data.warnings.some((s) => /429|Too Many Requests/i.test(String(s)));
        }
        return false;
    },

    invalidateCache(articleUrl) {
        const u = String(articleUrl || '').trim();
        this._cache.delete(u);
    },

    clearCommentCache() {
        this._cache.clear();
    },

    /**
     * @param {number|string} g
     * @param {number|string} r
     * @returns {'happy'|'unhappy'|null} Only when clearly skewed (≥2×); otherwise hidden.
     */
    computeForumMood(g, r) {
        const gi = Math.max(0, Number(g) || 0);
        const ri = Math.max(0, Number(r) || 0);
        if (gi === 0 && ri === 0) {
            return null;
        }
        if (gi >= 2 * ri) {
            return 'happy';
        }
        if (ri >= 2 * gi) {
            return 'unhappy';
        }
        return null;
    },

    /**
     * @param {HTMLElement} row
     */
    clearForumMoodDisplay(row) {
        const card = row && row.closest ? row.closest('.news-card') : null;
        if (!card) {
            return;
        }
        const wrap = card.querySelector('.forum-mood-wrap');
        if (wrap) {
            wrap.hidden = true;
            wrap.removeAttribute('title');
            wrap.removeAttribute('aria-label');
        }
    },

    /**
     * @param {HTMLElement} row
     * @param {number|string} g
     * @param {number|string} r
     */
    updateForumMoodDisplay(row, g, r) {
        const card = row && row.closest ? row.closest('.news-card') : null;
        if (!card) {
            return;
        }
        const wrap = card.querySelector('.forum-mood-wrap');
        const emojiEl = card.querySelector('.forum-mood-emoji');
        const labelEl = card.querySelector('.forum-mood-label');
        if (!wrap || !emojiEl) {
            return;
        }
        const mood = this.computeForumMood(g, r);
        if (mood === null) {
            wrap.hidden = true;
            return;
        }
        const emoji = mood === 'happy' ? '😊' : '💩';
        const titleKey = mood === 'happy' ? 'forum_mood_happy_title' : 'forum_mood_unhappy_title';
        emojiEl.textContent = emoji;
        if (labelEl) {
            labelEl.textContent = this.t('forum_mood_label');
        }
        wrap.setAttribute('title', this.t(titleKey));
        wrap.setAttribute('aria-label', `${this.t('forum_mood_label')}: ${this.t(titleKey)}`);
        wrap.hidden = false;
    },

    /**
     * @param {HTMLElement} row
     * @param {string} articleUrl
     * @param {object} data
     */
    /**
     * ComputerBase / t3n / The Verge: no server-side comment count — link to article (Verge: #comments).
     * @param {HTMLElement} row
     * @param {string} articleUrl
     * @param {object} data
     */
    async renderStubCommentsRow(row, articleUrl, data) {
        await this.loadStrings();
        const du = (data && data.discussionUrl) || articleUrl;
        const hintKey =
            data && typeof data.stubHintKey === 'string' && data.stubHintKey.trim()
                ? data.stubHintKey.trim()
                : 'rss_stub_note';
        const note = this.escapeHtml(this.t(hintKey));
        const open = this.escapeHtml(this.t('article_open_link'));
        const href = this.escapeHtml(heiseCommentsWrapArticleUrl(du));
        row.innerHTML = `
<div class="news-comments-inner news-comments-stub">
  <p class="news-comments-rss-note">${note}</p>
  <p><a class="news-comments-max-link" href="${href}" target="_blank" rel="noopener noreferrer">${open}</a></p>
</div>`;
    },

    /**
     * Golem: RSS-only forum metadata (counts + link); no green/red from server.
     * @param {HTMLElement} row
     * @param {object} data
     */
    async renderGolemRssRow(row, data) {
        await this.loadStrings();
        const forum = data.forum || {};
        const bad = forum.error === 'not_in_feed';
        const total = data.commentCount;
        const du = data.discussionUrl;
        const forumLabel = this.escapeHtml(this.t('golem_forum_link'));
        const note = this.escapeHtml(this.t('rss_only_note'));
        const notInFeed = this.escapeHtml(this.t('rss_not_in_feed'));
        const linkHtml =
            du && !bad
                ? ` <a class="news-comments-max-link" href="${this.escapeHtml(heiseCommentsWrapArticleUrl(du))}" target="_blank" rel="noopener noreferrer">${forumLabel}</a>`
                : '';
        const warn = bad ? ` <span class="news-comments-note">${notInFeed}</span>` : '';
        const volHtml = this.getCommentVolumeIndicatorHtml(total);
        const totalHtml = !bad ? this.buildCommentTotalHtml(total) : this.buildCommentTotalHtml(null);
        row.innerHTML = `
<div class="news-comments-inner">
  <div class="news-comments-row-primary news-comments-row-primary--with-volume">
    <div class="news-comments-badges-cluster">
      <span class="news-comments-badges">
        ${totalHtml}
        ${linkHtml}${warn}
      </span>
    </div>
    ${volHtml}
  </div>
  <p class="news-comments-rss-note">${note}</p>
</div>`;
    },

    async renderRateLimitedRow(row, articleUrl, data) {
        await this.loadStrings();
        const total = data.commentCount;
        const hint = this.escapeHtml(this.t('rate_limited_hint'));
        const retry = this.escapeHtml(this.t('rate_limited_retry'));
        const small =
            total !== null && total !== undefined ? this.buildCommentTotalHtml(total) : '';
        const volHtml = this.getCommentVolumeIndicatorHtml(total);
        row.innerHTML = `
<div class="news-comments-inner news-comments-rate-limited">
  <div class="news-comments-row-primary news-comments-row-primary--with-volume">
    <div class="news-comments-badges-cluster"><span class="news-comments-badges">${small}</span></div>
    ${volHtml}
  </div>
  <p class="news-comments-rate-msg">${hint}</p>
  <button type="button" class="news-comments-retry-btn">${retry}</button>
</div>`;
        const btn = row.querySelector('.news-comments-retry-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                this.invalidateCache(articleUrl);
                void this.fillRow(row, articleUrl);
            });
        }
    },

    /**
     * @param {HTMLElement} row
     * @param {string} articleUrl
     */
    async fillRow(row, articleUrl) {
        await this.loadStrings();
        this.clearForumMoodDisplay(row);
        const loading = this.t('loading');
        row.innerHTML = this.sanitizeHtml(`<span class="news-comments-loading">${this.escapeHtml(loading)}</span>`);

        const data = await this.fetchStats(articleUrl);
        if (!data || data.ok === false) {
            if (data && data.error === 'not_heise') {
                row.innerHTML = '';
                row.setAttribute('hidden', 'hidden');
                return;
            }
            let msg =
                data && data.error === 'file_protocol'
                    ? this.t('unavailable_file')
                    : this.t('unavailable');
            if (data && data.error && data.error !== 'file_protocol') {
                msg = `${msg} (${this.escapeHtml(String(data.error))})`;
            }
            row.innerHTML = this.sanitizeHtml(`<span class="news-comments-error">${msg}</span>`);
            return;
        }

        if (this.isForumRateLimited(data)) {
            await this.renderRateLimitedRow(row, articleUrl, data);
            return;
        }

        const forumPre = data.forum;
        if (forumPre && forumPre.rss_only) {
            if (forumPre.stub) {
                await this.renderStubCommentsRow(row, articleUrl, data);
            } else {
                await this.renderGolemRssRow(row, data);
            }
            return;
        }

        const total = data.commentCount;

        const forum = data.forum;
        let badges = '';
        let maxStandalone = '';

        if (forum && !forum.error && !forum.empty) {
            const g = forum.green_count ?? 0;
            const r = forum.red_count ?? 0;
            const maxR = forum.max_replies;
            const maxU = forum.max_replies_url;
            const maxTitleRaw =
                forum.max_replies_title != null && String(forum.max_replies_title).trim()
                    ? String(forum.max_replies_title).trim()
                    : '';

            badges += `<span class="news-comments-badges">`;
            badges += this.buildCommentTotalHtml(total);
            badges += ` <span class="heise-comment-green" title="${this.escapeHtml(this.t('green_hint'))}">${this.escapeHtml(this.t('green_short', { n: g }))}</span>`;
            badges += ` <span class="heise-comment-red" title="${this.escapeHtml(this.t('red_hint'))}">${this.escapeHtml(this.t('red_short', { n: r }))}</span>`;
            if (forum.unrated_count > 0) {
                badges += ` <span class="heise-comment-neutral" title="${this.escapeHtml(this.t('unrated_hint'))}">${this.escapeHtml(this.t('unrated_short', { n: forum.unrated_count }))}</span>`;
            }
            badges += `</span>`;

            if (maxU && maxR !== null && maxR !== undefined) {
                const maxText = this.escapeHtml(this.t('max_link', { n: maxR }));
                const combinedTooltip = maxTitleRaw
                    ? `${this.t('max_link_title')} — ${maxTitleRaw}`
                    : this.t('max_link_title');
                const maxLinkTooltip = this.escapeHtml(combinedTooltip);
                let maxAria = this.t('max_replies_standalone_aria', { n: maxR });
                if (maxTitleRaw) {
                    maxAria = `${maxAria} — ${maxTitleRaw}`;
                }
                const maxAriaEsc = this.escapeHtml(maxAria);
                const subjectBlock = maxTitleRaw
                    ? `<span class="news-comments-max-link__subject">${this.escapeHtml(maxTitleRaw)}</span>`
                    : '';
                maxStandalone = `
<div class="news-comments-max-standalone">
  <a class="news-comments-max-link news-comments-max-link--standalone"
     href="${this.escapeHtml(heiseCommentsWrapArticleUrl(maxU))}"
     target="_blank"
     rel="noopener noreferrer"
     title="${maxLinkTooltip}"
     aria-label="${maxAriaEsc}">
    <span class="news-comments-max-link__icon" aria-hidden="true">${NEWS_COMMENTS_MAX_REPLIES_ICON_SVG}</span>
    <div class="news-comments-max-link__main">
      ${subjectBlock}
      <span class="news-comments-max-link__text">${maxText}</span>
    </div>
    <span class="news-comments-max-link__action" aria-hidden="true">${this.escapeHtml(this.t('max_replies_open_action'))}</span>
  </a>
</div>`;
            }

            if (forum.partial || (Array.isArray(data.warnings) && data.warnings.length)) {
                badges += ` <span class="news-comments-partial" title="${this.escapeHtml((data.warnings || []).join(' '))}">${this.escapeHtml(this.t('partial'))}</span>`;
            }
            const volHtmlMain = this.getCommentVolumeIndicatorHtml(total);
            badges = `<div class="news-comments-row-primary news-comments-row-primary--with-volume">
  <div class="news-comments-badges-cluster">${badges}</div>
  ${volHtmlMain}
</div>`;
        } else if (forum && forum.empty && (total === 0 || total === null)) {
            badges = `<span class="news-comments-badges">${this.escapeHtml(this.t('no_comments'))}</span>`;
        } else {
            badges = `<span class="news-comments-badges">${this.buildCommentTotalHtml(total)}</span>`;
            if (forum && forum.login) {
                badges += ` <span class="news-comments-note">${this.escapeHtml(this.t('login_wall'))}</span>`;
            } else if (Array.isArray(data.warnings) && data.warnings.length) {
                badges += ` <span class="news-comments-note">${this.escapeHtml(this.localizeCommentWarning(data.warnings[0]))}</span>`;
            }
            const volHtmlElse = this.getCommentVolumeIndicatorHtml(data.commentCount);
            badges = `<div class="news-comments-row-primary news-comments-row-primary--with-volume">
  <div class="news-comments-badges-cluster">${badges}</div>
  ${volHtmlElse}
</div>`;
        }

        row.innerHTML = `<div class="news-comments-inner">${badges}${maxStandalone}</div>`;
        if (forum && !forum.error && !forum.empty) {
            const g = forum.green_count ?? 0;
            const r = forum.red_count ?? 0;
            this.updateForumMoodDisplay(row, g, r);
        }
    },

    /**
     * @param {ParentNode} root
     */
    async hydrate(root) {
        const rows = root.querySelectorAll('.news-comments-row[data-article-url]');
        await Promise.all(
            Array.from(rows).map((row) => {
                const url = row.getAttribute('data-article-url') || '';
                return this.fillRow(row, url);
            })
        );
    },

    /**
     * Normalize API payload for sorting (total = schema.org commentCount; green/red from forum parse).
     * @param {object} data
     * @returns {{ ok: boolean, total: number, green: number, red: number }}
     */
    normalizeForSort(data) {
        if (!data || !data.ok) {
            return { ok: false, total: -1, green: -1, red: -1 };
        }
        if (this.isForumRateLimited(data)) {
            const raw = data.commentCount;
            let total = -1;
            if (raw !== null && raw !== undefined && raw !== '') {
                const n = Number(raw);
                total = Number.isFinite(n) ? n : -1;
            }
            return {
                ok: true,
                total,
                green: -1,
                red: -1,
                rateLimited: true
            };
        }
        const f = data.forum || {};
        const raw = data.commentCount;
        let total = -1;
        if (raw !== null && raw !== undefined && raw !== '') {
            const n = Number(raw);
            total = Number.isFinite(n) ? n : -1;
        }
        return {
            ok: true,
            total,
            green: Number(f.green_count) || 0,
            red: Number(f.red_count) || 0
        };
    },

    /**
     * Fetch comment stats for many items (used for sorting). Uses fetchStats cache.
     * @param {Array<{ url?: string }>} items
     * @param {(done: number, total: number) => void} [onProgress]
     * @param {number} [concurrency]
     */
    /**
     * @returns {Promise<{ rateLimited: boolean }>}
     */
    async prefetchForItems(items, onProgress, concurrency = 4) {
        const targets = (items || []).filter((i) => {
            const u = articleUrlFromFeedItem(i);
            return (
                isHeiseCommentsApiArticleUrl(u) ||
                u.startsWith('https://www.golem.de/') ||
                u.startsWith('https://golem.de/') ||
                u.startsWith('https://www.computerbase.de/') ||
                u.startsWith('https://computerbase.de/') ||
                u.startsWith('https://t3n.de/') ||
                u.startsWith('https://www.theverge.com/') ||
                u.startsWith('https://theverge.com/')
            );
        });
        const total = targets.length;
        let done = 0;
        let rateLimited = false;
        for (let i = 0; i < targets.length; i += concurrency) {
            const batch = targets.slice(i, i + concurrency);
            await Promise.all(
                batch.map(async (item) => {
                    const data = await this.fetchStats(articleUrlFromFeedItem(item));
                    if (this.isForumRateLimited(data)) {
                        rateLimited = true;
                    }
                    item.commentStats = this.normalizeForSort(data);
                    done += 1;
                    if (typeof onProgress === 'function') {
                        onProgress(done, total);
                    }
                })
            );
        }
        return { rateLimited };
    }
};
