/**
 * Cucumber NewsScraper — manual page logic.
 *
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Daniel Mengel
 *
 * Powers manual.html:
 *   - Theme init (mirrors the app's `theme` + `heise_color_theme` localStorage keys)
 *   - Table of contents + scroll-spy
 *   - Dependency-free full-text search over the manual's sections
 *   - "Ask the AI" — client-side retrieval over the same sections + AISummarizer.completePrompt
 *
 * Reuses window.AISummarizer (js/ai-summarizer.js) and its config from localStorage;
 * it adds no KI settings UI of its own.
 */
(function () {
    'use strict';

    // ---------------------------------------------------------------------
    // Small helpers
    // ---------------------------------------------------------------------
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function debounce(fn, ms) {
        let t = null;
        return function (...args) {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), ms);
        };
    }

    const STOPWORDS = new Set([
        'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'is', 'are',
        'do', 'i', 'my', 'it', 'how', 'what', 'why', 'with', 'this', 'that', 'you',
        'your', 'can', 'does', 'be', 'as', 'at', 'by', 'from', 'me'
    ]);

    function tokenize(str, keepStop) {
        return String(str || '')
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .filter((t) => t.length >= 2 && (keepStop || !STOPWORDS.has(t)));
    }

    // ---------------------------------------------------------------------
    // Theme (reuse the app's keys so the manual looks like the app)
    // ---------------------------------------------------------------------
    const THEME_KEY = 'theme';                 // app's shared key: 'system' | 'light' | 'dark'
    const MANUAL_THEME_KEY = 'manual_theme';   // page-local override so we never mutate the app's setting
    const ACCENT_KEY = 'heise_color_theme';    // one of the 8 accent presets (read-only here)
    const VALID_ACCENTS = new Set(['heise', 'ocean', 'forest', 'violet', 'amber', 'rose', 'slate', 'midnight']);
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    function readAppTheme() {
        try {
            const v = localStorage.getItem(THEME_KEY);
            return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
        } catch (_) { return 'system'; }
    }

    // The manual initializes from the app's theme but toggles into a local
    // override — reading docs must never flip the app's own saved preference.
    function readManualOverride() {
        try {
            const v = localStorage.getItem(MANUAL_THEME_KEY);
            return v === 'light' || v === 'dark' ? v : null;
        } catch (_) { return null; }
    }

    function readAccentPref() {
        try {
            const v = localStorage.getItem(ACCENT_KEY);
            return VALID_ACCENTS.has(v) ? v : 'heise';
        } catch (_) { return 'heise'; }
    }

    function effectiveDark() {
        const override = readManualOverride();
        if (override) return override === 'dark';
        const app = readAppTheme();
        return app === 'dark' || (app === 'system' && media.matches);
    }

    function applyTheme() {
        document.documentElement.setAttribute('data-theme', effectiveDark() ? 'dark' : 'light');
        document.documentElement.setAttribute('data-color-theme', readAccentPref());
    }

    function initTheme() {
        applyTheme();
        // Follow OS changes only when there is no local override and the app is on "system".
        if (media.addEventListener) {
            media.addEventListener('change', () => { if (!readManualOverride() && readAppTheme() === 'system') applyTheme(); });
        }
        const toggle = $('#themeToggle');
        if (toggle) {
            toggle.addEventListener('click', () => {
                const nowDark = document.documentElement.getAttribute('data-theme') === 'dark';
                try { localStorage.setItem(MANUAL_THEME_KEY, nowDark ? 'light' : 'dark'); } catch (_) { /* ignore */ }
                applyTheme();
            });
        }
    }

    // ---------------------------------------------------------------------
    // Index: one entry per leaf section
    // ---------------------------------------------------------------------
    /** @type {{id:string, chapterTitle:string, chapterId:string, sectionTitle:string, text:string, hay:string, tokenCounts:Map<string,number>}[]} */
    let INDEX = [];

    function buildIndex() {
        INDEX = $$('.manual-section[id]').map((el) => {
            const chapter = el.closest('.manual-chapter');
            const chapterTitle = (chapter && chapter.getAttribute('data-chapter')) || '';
            const chapterId = (chapter && chapter.id) || '';
            const sectionTitle = el.getAttribute('data-title') ||
                (el.querySelector('h3, h4') ? el.querySelector('h3, h4').textContent.trim() : el.id);
            const keywords = el.getAttribute('data-keywords') || '';
            const bodyText = (el.textContent || '').replace(/\s+/g, ' ').trim();
            // Weighted haystack: title + keywords repeated so they score higher.
            const weightedTitle = (sectionTitle + ' ') + (chapterTitle + ' ') + (keywords + ' ');
            const hay = (weightedTitle + weightedTitle + weightedTitle + bodyText).toLowerCase();

            const tokenCounts = new Map();
            for (const t of tokenize(hay, true)) {
                tokenCounts.set(t, (tokenCounts.get(t) || 0) + 1);
            }
            return { id: el.id, chapterTitle, chapterId, sectionTitle, text: bodyText, hay, tokenCounts };
        });
    }

    /**
     * Score a section against query tokens. Returns {score, matched} where
     * `matched` is the count of distinct query tokens present (used as the
     * primary ranking key so broader matches win).
     */
    function scoreSection(entry, tokens, phrase) {
        let score = 0;
        let matched = 0;
        for (const t of tokens) {
            const c = entry.tokenCounts.get(t) || 0;
            if (c > 0) {
                matched += 1;
                score += c;
            }
            // partial / prefix match (e.g. "install" vs "installation")
            if (c === 0) {
                for (const key of entry.tokenCounts.keys()) {
                    if (key.length > t.length && key.startsWith(t)) { score += 0.5; matched += 0.5; break; }
                }
            }
        }
        if (phrase && phrase.length >= 4 && entry.hay.includes(phrase)) score += 8;
        if (entry.sectionTitle.toLowerCase() === phrase) score += 12;
        return { score, matched };
    }

    function rankSections(query, limit) {
        const tokens = tokenize(query, false);
        const phrase = String(query || '').toLowerCase().trim();
        if (!tokens.length) return [];
        const scored = [];
        for (const entry of INDEX) {
            const { score, matched } = scoreSection(entry, tokens, phrase);
            if (score > 0) scored.push({ entry, score, matched });
        }
        scored.sort((a, b) => (b.matched - a.matched) || (b.score - a.score));
        return typeof limit === 'number' ? scored.slice(0, limit) : scored;
    }

    // ---------------------------------------------------------------------
    // Snippet with highlighting (safe: escape first, then wrap tokens)
    // ---------------------------------------------------------------------
    function makeSnippet(entry, tokens) {
        const text = entry.text;
        const lower = text.toLowerCase();
        let pos = -1;
        for (const t of tokens) {
            const p = lower.indexOf(t);
            if (p >= 0 && (pos === -1 || p < pos)) pos = p;
        }
        if (pos === -1) pos = 0;
        const start = Math.max(0, pos - 60);
        const end = Math.min(text.length, pos + 160);
        let snip = (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
        let html = escapeHtml(snip);
        // Highlight each token (case-insensitive) on the escaped string.
        const uniq = Array.from(new Set(tokens)).filter((t) => t.length >= 2)
            .sort((a, b) => b.length - a.length);
        for (const t of uniq) {
            const re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
            html = html.replace(re, '<mark>$1</mark>');
        }
        return html;
    }

    // ---------------------------------------------------------------------
    // Search UI
    // ---------------------------------------------------------------------
    function initSearch() {
        const input = $('#searchInput');
        const panel = $('#searchResults');
        if (!input || !panel) return;

        function render(query) {
            const q = query.trim();
            if (q.length < 2) { hide(); return; }
            const tokens = tokenize(q, false);
            const hits = rankSections(q, 12);
            if (!hits.length) {
                panel.innerHTML = '<div class="search-empty">No matches for “' + escapeHtml(q) +
                    '”. Try fewer or different words — or <button type="button" class="ai-example" data-open-ai>ask the AI</button>.</div>';
                show();
                return;
            }
            const parts = ['<div class="search-results__meta">' + hits.length +
                ' section' + (hits.length === 1 ? '' : 's') + ' found</div>'];
            for (const h of hits) {
                parts.push(
                    '<a class="search-hit" role="option" href="#' + h.entry.id + '" data-jump="' + h.entry.id + '">' +
                    '<span class="search-hit__crumb">' + escapeHtml(h.entry.chapterTitle) + '</span>' +
                    '<span class="search-hit__title">' + escapeHtml(h.entry.sectionTitle) + '</span>' +
                    '<span class="search-hit__snippet">' + makeSnippet(h.entry, tokens) + '</span>' +
                    '</a>'
                );
            }
            panel.innerHTML = parts.join('');
            show();
        }

        function show() { panel.hidden = false; input.setAttribute('aria-expanded', 'true'); }
        function hide() { panel.hidden = true; input.setAttribute('aria-expanded', 'false'); }

        input.addEventListener('input', debounce((e) => render(e.target.value), 110));
        input.addEventListener('focus', () => { if (input.value.trim().length >= 2) render(input.value); });

        panel.addEventListener('click', (e) => {
            const hit = e.target.closest('[data-jump]');
            if (hit) {
                e.preventDefault();
                jumpTo(hit.getAttribute('data-jump'));
                hide();
                input.blur();
                return;
            }
            if (e.target.closest('[data-open-ai]')) { openAi(input.value); hide(); }
        });

        // Keyboard: arrow navigation + escape.
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { hide(); return; }
            if ((e.key === 'ArrowDown' || e.key === 'Enter') && !panel.hidden) {
                const first = panel.querySelector('.search-hit');
                if (e.key === 'Enter' && first) { e.preventDefault(); jumpTo(first.getAttribute('data-jump')); hide(); input.blur(); }
                else if (first) { e.preventDefault(); first.focus(); }
            }
        });
        panel.addEventListener('keydown', (e) => {
            const items = $$('.search-hit', panel);
            const idx = items.indexOf(document.activeElement);
            if (e.key === 'ArrowDown') { e.preventDefault(); (items[idx + 1] || items[0]).focus(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); (items[idx - 1] || input).focus(); }
            else if (e.key === 'Escape') { hide(); input.focus(); }
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.appbar__search')) hide();
        });
    }

    function jumpTo(id) {
        const el = document.getElementById(id);
        if (!el) return;
        history.replaceState(null, '', '#' + id);
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.remove('section-flash');
        // reflow to restart the animation
        void el.offsetWidth;
        el.classList.add('section-flash');
        setTimeout(() => el.classList.remove('section-flash'), 1700);
    }

    // ---------------------------------------------------------------------
    // Table of contents + scroll-spy
    // ---------------------------------------------------------------------
    function initToc() {
        const list = $('#tocList');
        if (!list) return;
        const chapters = $$('.manual-chapter[id]');
        list.innerHTML = chapters.map((c) => {
            const title = c.getAttribute('data-chapter') || c.id;
            return '<a href="#' + c.id + '" data-toc="' + c.id + '">' + escapeHtml(title) + '</a>';
        }).join('');

        list.addEventListener('click', (e) => {
            const a = e.target.closest('a[data-toc]');
            if (a) { e.preventDefault(); jumpTo(a.getAttribute('data-toc')); }
        });

        if ('IntersectionObserver' in window) {
            const links = new Map($$('a[data-toc]', list).map((a) => [a.getAttribute('data-toc'), a]));
            let active = null;
            const obs = new IntersectionObserver((entries) => {
                for (const en of entries) {
                    if (en.isIntersecting) {
                        if (active) active.classList.remove('is-active');
                        active = links.get(en.target.id) || active;
                        if (active) active.classList.add('is-active');
                    }
                }
            }, { rootMargin: '-88px 0px -70% 0px', threshold: 0 });
            chapters.forEach((c) => obs.observe(c));
        }
    }

    // ---------------------------------------------------------------------
    // Copy buttons for code blocks
    // ---------------------------------------------------------------------
    function initCopyButtons() {
        $$('pre').forEach((pre) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'copy-btn';
            btn.textContent = 'Copy';
            btn.addEventListener('click', () => {
                const code = pre.querySelector('code');
                const text = (code ? code.innerText : pre.innerText).replace(/\s*Copy$/, '');
                const done = () => { btn.textContent = 'Copied'; btn.classList.add('copied'); setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1400); };
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
                } else { fallbackCopy(text, done); }
            });
            pre.appendChild(btn);
        });
    }
    function fallbackCopy(text, done) {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (_) { /* ignore */ }
        document.body.removeChild(ta);
    }

    // ---------------------------------------------------------------------
    // Minimal, safe markdown-lite renderer for AI answers.
    // Everything is escaped first; only known-safe tags are introduced.
    // ---------------------------------------------------------------------
    function renderMarkdownLite(src) {
        const text = String(src || '').replace(/\r\n/g, '\n').trim();
        // Split out fenced code blocks first.
        const blocks = text.split(/```/);
        let out = '';
        for (let i = 0; i < blocks.length; i++) {
            if (i % 2 === 1) {
                // code block
                const body = blocks[i].replace(/^[a-zA-Z0-9_-]*\n/, '');
                out += '<pre><code>' + escapeHtml(body.replace(/\n$/, '')) + '</code></pre>';
            } else {
                out += renderProse(blocks[i]);
            }
        }
        return out;
    }

    function inlineFormat(escaped) {
        // operate on already-escaped text
        return escaped
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    }

    function renderProse(chunk) {
        const lines = chunk.split('\n');
        let html = '';
        let listType = null; // 'ul' | 'ol'
        let para = [];

        const flushPara = () => {
            if (para.length) {
                html += '<p>' + inlineFormat(escapeHtml(para.join(' ').trim())) + '</p>';
                para = [];
            }
        };
        const closeList = () => { if (listType) { html += '</' + listType + '>'; listType = null; } };

        for (const raw of lines) {
            const line = raw.trim();
            if (!line) { flushPara(); closeList(); continue; }
            const ol = line.match(/^(\d+)[.)]\s+(.*)$/);
            const ul = line.match(/^[-*•]\s+(.*)$/);
            if (ol) {
                flushPara();
                if (listType !== 'ol') { closeList(); html += '<ol>'; listType = 'ol'; }
                // Preserve the model's own number so a list broken across a code
                // block doesn't visually restart at 1.
                html += '<li value="' + parseInt(ol[1], 10) + '">' + inlineFormat(escapeHtml(ol[2])) + '</li>';
            } else if (ul) {
                flushPara();
                if (listType !== 'ul') { closeList(); html += '<ul>'; listType = 'ul'; }
                html += '<li>' + inlineFormat(escapeHtml(ul[1])) + '</li>';
            } else {
                closeList();
                para.push(line);
            }
        }
        flushPara();
        closeList();
        return html;
    }

    // ---------------------------------------------------------------------
    // Ask the AI
    // ---------------------------------------------------------------------
    let summarizer = null;
    function getSummarizer() {
        if (!summarizer && typeof window.AISummarizer === 'function') {
            try { summarizer = new window.AISummarizer(); } catch (_) { summarizer = null; }
        }
        return summarizer;
    }

    const MODE_LABELS = { lm_rest_v1: 'LM Studio (local)', openai: 'OpenAI-compatible', anthropic: 'Anthropic' };
    function currentMode() {
        try {
            const m = localStorage.getItem('heise_ki_api_mode');
            return m === 'openai' || m === 'anthropic' ? m : 'lm_rest_v1';
        } catch (_) { return 'lm_rest_v1'; }
    }

    function buildContext(hits) {
        const CAP = 6200;
        let used = 0;
        const parts = [];
        const usedEntries = [];
        for (const h of hits) {
            const body = h.entry.text.length > 1400 ? h.entry.text.slice(0, 1400) + '…' : h.entry.text;
            const block = '### ' + h.entry.chapterTitle + ' › ' + h.entry.sectionTitle +
                ' (#' + h.entry.id + ')\n' + body + '\n';
            if (used + block.length > CAP && parts.length) break;
            parts.push(block);
            usedEntries.push(h.entry);
            used += block.length;
        }
        return { text: parts.join('\n'), entries: usedEntries };
    }

    function buildSystemPrompt(contextText) {
        return [
            'You are the built-in help assistant for the "Cucumber NewsScraper" app (a browser news dashboard with an optional AI summary layer and a Python dev server).',
            'Answer the user\'s question clearly and concisely in English. Prefer short paragraphs and numbered steps for instructions.',
            '',
            'Grounding rules:',
            '1. Use the MANUAL CONTEXT below as your primary source. When your answer relies on it, mention the relevant section title(s) in plain text.',
            '2. If the manual context does not fully cover the question, you MAY add general knowledge (e.g. basic Python, pip, virtual environments, Windows/PowerShell, LM Studio). When you do, explicitly flag it, e.g. "(general knowledge, not from the manual)".',
            '3. Do not invent app-specific settings, menu names, storage keys, or URLs that are not in the manual context. If unsure about an app specific, say so and point the user to the relevant chapter.',
            '4. Never output internal reasoning — only the final answer.',
            '',
            '=== MANUAL CONTEXT ===',
            contextText || '(no closely matching manual sections were found for this question)',
            '=== END MANUAL CONTEXT ==='
        ].join('\n');
    }

    function looksLikeNoBackend(msg) {
        const m = String(msg || '').toLowerCase();
        return m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed') ||
            m.includes('econnrefused') || m.includes('refused') || m.includes('abort') ||
            m.includes('timeout') || m.includes('csp') || m.includes('content security') ||
            m.includes('api-key') || m.includes('api key') || m.includes('401') || m.includes('403');
    }

    function initAi() {
        const modal = $('#aiModal');
        const form = $('#aiForm');
        const qInput = $('#aiQuestion');
        const statusEl = $('#aiStatus');
        const answerEl = $('#aiAnswer');
        const sourcesEl = $('#aiSources');
        const sourcesList = $('#aiSourcesList');
        const modeLabel = $('#aiModeLabel');
        const submitBtn = $('#aiSubmit');
        if (!modal || !form) return;

        function setStatus(html, kind) {
            statusEl.className = 'ai-status is-visible' + (kind === 'error' ? ' is-error' : '');
            statusEl.innerHTML = html;
        }
        function clearStatus() { statusEl.className = 'ai-status'; statusEl.innerHTML = ''; }

        window.openAi = function (prefill) {
            modal.hidden = false;
            document.body.style.overflow = 'hidden';
            if (modeLabel) modeLabel.textContent = 'Using: ' + (MODE_LABELS[currentMode()] || currentMode());
            if (typeof prefill === 'string' && prefill.trim() && !qInput.value.trim()) qInput.value = prefill.trim();
            setTimeout(() => qInput.focus(), 30);
        };
        function closeAi() { modal.hidden = true; document.body.style.overflow = ''; }

        $('#askAiBtn') && $('#askAiBtn').addEventListener('click', () => window.openAi());
        $$('[data-open-ai]').forEach((b) => b.addEventListener('click', () => window.openAi()));
        modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeAi(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeAi(); });

        $$('.ai-example').forEach((b) => b.addEventListener('click', () => {
            qInput.value = b.textContent.trim();
            qInput.focus();
        }));

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const question = qInput.value.trim();
            if (!question) { qInput.focus(); return; }

            answerEl.hidden = true; answerEl.innerHTML = '';
            sourcesEl.hidden = true; sourcesList.innerHTML = '';

            const ai = getSummarizer();
            if (!ai || typeof ai.completePrompt !== 'function') {
                setStatus('The AI engine could not be loaded. Please reload the page.', 'error');
                return;
            }

            const hits = rankSections(question, 8);
            const ctx = buildContext(hits);
            const system = buildSystemPrompt(ctx.text);

            // Deterministic "related sections" from our own retrieval (guaranteed
            // anchors). Shown immediately so they help even if the AI is unreachable.
            if (ctx.entries.length) {
                sourcesList.innerHTML = ctx.entries.map((en) =>
                    '<a href="#' + en.id + '" data-jump="' + en.id + '">' +
                    escapeHtml(en.sectionTitle) + '</a>').join('');
                sourcesEl.hidden = false;
            }

            submitBtn.disabled = true;
            setStatus('<span class="spinner"></span> Thinking… (using ' + (MODE_LABELS[currentMode()] || 'your KI settings') + ')');

            try {
                const raw = await ai.completePrompt(system, question);
                const answer = String(raw || '').trim();
                if (!answer) {
                    setStatus('The model returned an empty answer. Try rephrasing, or check your model in KI-Server.', 'error');
                } else {
                    clearStatus();
                    answerEl.innerHTML = renderMarkdownLite(answer);
                    answerEl.hidden = false;
                }
            } catch (err) {
                const msg = (err && err.message) ? err.message : String(err);
                if (looksLikeNoBackend(msg)) {
                    setStatus('Could not reach your AI backend. Make sure <strong>KI-Server</strong> is configured in the app ' +
                        '(LM Studio running with “REST via same origin”, or a valid Anthropic key). ' +
                        'See <a href="#chapter-ai" data-close>AI / KI Setup</a>.<br><span style="opacity:.7">Details: ' +
                        escapeHtml(msg) + '</span>', 'error');
                } else {
                    setStatus('AI error: ' + escapeHtml(msg), 'error');
                }
            } finally {
                submitBtn.disabled = false;
            }
        });

        // Jump links inside answer / sources.
        modal.addEventListener('click', (e) => {
            const j = e.target.closest('[data-jump]');
            if (j) { e.preventDefault(); closeAi(); jumpTo(j.getAttribute('data-jump')); }
        });
    }

    // ---------------------------------------------------------------------
    // Boot
    // ---------------------------------------------------------------------
    function boot() {
        initTheme();
        buildIndex();
        initToc();
        initSearch();
        initCopyButtons();
        initAi();
        // Flash a section if the page was opened with a hash.
        if (location.hash && location.hash.length > 1) {
            const id = location.hash.slice(1);
            if (document.getElementById(id)) setTimeout(() => jumpTo(id), 60);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
