/**
 * Article translation: outbound link wrappers (Google / Microsoft) + in-place text via MyMemory API.
 *
 * SPDX-License-Identifier: MIT
 */
(function articleTranslationIife(global) {
    'use strict';

    const myMemoryCache = new Map();

    /**
     * @param {unknown} s
     * @returns {string}
     */
    function normalizeTargetLang(s) {
        const t = String(s || '')
            .trim()
            .replace(/_/g, '-');
        if (!t) {
            return 'de';
        }
        if (/^[a-z]{2}$/i.test(t)) {
            return t.toLowerCase();
        }
        if (/^[a-z]{2}-[a-z]{2}$/i.test(t)) {
            return `${t.slice(0, 2).toLowerCase()}-${t.slice(3, 5).toUpperCase()}`;
        }
        return 'de';
    }

    /**
     * @param {unknown} s
     * @returns {'google'|'google_classic'|'bing'}
     */
    function normalizeLinkProvider(s) {
        const v = String(s || '')
            .trim()
            .toLowerCase();
        if (v === 'bing') {
            return 'bing';
        }
        if (v === 'google_classic' || v === 'google_legacy' || v === 'translate_google_com') {
            return 'google_classic';
        }
        return 'google';
    }

    /**
     * @param {string} fromTag
     * @param {string} toTag
     * @returns {boolean}
     */
    function shouldMachineTranslateInPlace(fromTag, toTag) {
        const f = String(fromTag || '')
            .trim()
            .toLowerCase();
        const t = String(toTag || '')
            .trim()
            .toLowerCase();
        if (!f || !t) {
            return false;
        }
        if (f === t) {
            return false;
        }
        const fp = f.split('-')[0];
        const tp = t.split('-')[0];
        return fp !== tp;
    }

    /**
     * @param {string} url
     * @returns {boolean}
     */
    function isTranslationServiceUrl(url) {
        try {
            const u = new URL(url);
            const h = u.hostname.toLowerCase();
            if (h === 'translate.google.com' || h.endsWith('.translate.google.com')) {
                return true;
            }
            if (h === 'translate.goog' || h.endsWith('.translate.goog')) {
                return true;
            }
            if (h === 'www.microsofttranslator.com' || h === 'microsofttranslator.com') {
                return true;
            }
            if (h.endsWith('.bing.com') || h === 'bing.com') {
                if (u.pathname.toLowerCase().includes('translator')) {
                    return true;
                }
            }
            return false;
        } catch (_) {
            return true;
        }
    }

    /**
     * @param {string} url
     * @returns {boolean}
     */
    function isSkippableForTranslation(url) {
        try {
            const u = new URL(url);
            if (u.protocol !== 'http:' && u.protocol !== 'https:') {
                return true;
            }
            const h = u.hostname.toLowerCase();
            if (h === 'youtu.be' || h === 'www.youtube.com' || h === 'youtube.com' || h === 'm.youtube.com') {
                return true;
            }
            if (typeof global.location !== 'undefined' && global.location && global.location.origin) {
                if (u.origin === global.location.origin) {
                    return true;
                }
            }
            return false;
        } catch (_) {
            return true;
        }
    }

    /**
     * Google “Website Translator” style URL (hostname as www-example-com.translate.goog).
     * Often works better for JS-heavy news sites than translate.google.com/translate?u=…
     * @param {string} originalUrl
     * @param {string} targetLang
     * @returns {string}
     */
    function googleTranslateGoogProxyUrl(originalUrl, targetLang) {
        let u;
        try {
            u = new URL(originalUrl);
        } catch (_) {
            return originalUrl;
        }
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
            return originalUrl;
        }
        const tl = normalizeTargetLang(targetLang);
        const hl = tl;
        const hostSlug = u.hostname.replace(/\./g, '-').toLowerCase();
        const pathQS = (u.pathname || '/') + u.search;
        const glue = pathQS.includes('?') ? '&' : '?';
        return `https://${hostSlug}.translate.goog${pathQS}${glue}_x_tr_sl=auto&_x_tr_tl=${encodeURIComponent(tl)}&_x_tr_hl=${encodeURIComponent(hl)}`;
    }

    /**
     * @param {string} url
     * @param {string} targetLang
     * @param {'google'|'google_classic'|'bing'} provider
     * @returns {string}
     */
    function wrapUrlForTranslatedView(url, targetLang, provider) {
        const raw = String(url || '').trim();
        if (!raw || isSkippableForTranslation(raw) || isTranslationServiceUrl(raw)) {
            return raw;
        }
        const tl = normalizeTargetLang(targetLang);
        const p = normalizeLinkProvider(provider);
        const enc = encodeURIComponent(raw);
        if (p === 'bing') {
            const bingTo = tl.includes('-') ? tl.split('-')[0].toLowerCase() : tl.toLowerCase();
            return `https://www.microsofttranslator.com/bv.aspx?from=&to=${encodeURIComponent(bingTo)}&a=${enc}`;
        }
        if (p === 'google_classic') {
            return `https://translate.google.com/translate?sl=auto&tl=${encodeURIComponent(tl)}&u=${enc}`;
        }
        return googleTranslateGoogProxyUrl(raw, tl);
    }

    /**
     * @param {string} text
     * @param {string} fromTag
     * @param {string} toTag
     * @returns {Promise<string>}
     */
    async function translateTextMyMemory(text, fromTag, toTag) {
        const q = String(text ?? '').trim();
        if (!q) {
            return '';
        }
        const fp = String(fromTag || 'en').trim();
        const tp = String(toTag || 'de').trim();
        const cacheKey = `${fp}|${tp}::${q}`;
        if (myMemoryCache.has(cacheKey)) {
            return /** @type {string} */ (myMemoryCache.get(cacheKey));
        }
        const chunk = q.length > 480 ? `${q.slice(0, 477)}…` : q;
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${encodeURIComponent(fp)}|${encodeURIComponent(tp)}`;
        const r = await fetch(url, { method: 'GET', cache: 'no-store' });
        if (!r.ok) {
            throw new Error(`mymemory_http_${r.status}`);
        }
        let j;
        try {
            j = await r.json();
        } catch (_) {
            throw new Error('mymemory_invalid_json');
        }
        if (j.quotaFinished === true) {
            throw new Error('mymemory_quota');
        }
        if (Number(j.responseStatus) !== 200) {
            const det = j.responseDetails ? String(j.responseDetails) : '';
            throw new Error(det || `mymemory_${j.responseStatus}`);
        }
        const out =
            j.responseData && typeof j.responseData.translatedText === 'string'
                ? String(j.responseData.translatedText).trim()
                : '';
        const finalText = out || q;
        myMemoryCache.set(cacheKey, finalText);
        return finalText;
    }

    /**
     * @param {string} text
     * @param {string} fromTag
     * @param {string} toTag
     * @returns {Promise<string>}
     */
    async function translateLongTextMyMemory(text, fromTag, toTag) {
        const full = String(text ?? '').trim();
        if (!full) {
            return '';
        }
        const size = 420;
        if (full.length <= size) {
            return translateTextMyMemory(full, fromTag, toTag);
        }
        const parts = [];
        for (let i = 0; i < full.length; i += size) {
            const piece = full.slice(i, i + size);
            /* eslint-disable no-await-in-loop */
            parts.push(await translateTextMyMemory(piece, fromTag, toTag));
            await new Promise((res) => {
                global.setTimeout(res, 380);
            });
        }
        return parts.join('');
    }

    global.ArticleTranslation = {
        normalizeTargetLang,
        normalizeLinkProvider,
        googleTranslateGoogProxyUrl,
        wrapUrlForTranslatedView,
        isTranslationServiceUrl,
        isSkippableForTranslation,
        shouldMachineTranslateInPlace,
        translateTextMyMemory,
        translateLongTextMyMemory
    };
})(typeof window !== 'undefined' ? window : globalThis);
