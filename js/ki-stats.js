/**
 * Cucumber NewsScraper — client-side KI usage stats (tokens, duration); localStorage.
 *
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Daniel Mengel
 */

const KI_STATS_STORAGE_KEY = 'heise_ki_article_stats_v1';
const KI_STATS_MAX_ENTRIES = 500;

/**
 * @typedef {{ t: number, durationMs: number, totalTokens: number|null, promptTokens?: number, completionTokens?: number }} KiStatsEntry
 */

class KiStats {
    /**
     * @param {unknown} raw
     * @returns {number|null}
     */
    static _coercePositiveInt(raw) {
        if (raw === null || raw === undefined || raw === '') {
            return null;
        }
        const n = typeof raw === 'number' ? raw : Number(raw);
        if (!Number.isFinite(n) || n < 0) {
            return null;
        }
        return Math.round(n);
    }

    /**
     * @param {unknown} raw
     * @returns {number|null}
     */
    static _coerceTimestampMs(raw) {
        if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
            return Math.round(raw);
        }
        if (typeof raw === 'string' && raw.trim()) {
            const trimmed = raw.trim();
            const direct = Number(trimmed);
            if (Number.isFinite(direct) && direct > 0) {
                return Math.round(direct);
            }
            const parsed = Date.parse(trimmed);
            if (Number.isFinite(parsed) && parsed > 0) {
                return Math.round(parsed);
            }
        }
        return null;
    }

    /**
     * @param {unknown} raw
     * @returns {KiStatsEntry|null}
     */
    static _normalizeStoredEntry(raw) {
        if (!raw || typeof raw !== 'object') {
            return null;
        }
        const row = /** @type {Record<string, unknown>} */ (raw);
        const usage =
            row.usage && typeof row.usage === 'object'
                ? /** @type {Record<string, unknown>} */ (row.usage)
                : null;
        const t =
            KiStats._coerceTimestampMs(
                row.t ??
                    row.ts ??
                    row.time ??
                    row.timestamp ??
                    row.createdAt ??
                    row.created_at ??
                    row.date
            ) ?? null;
        if (!(t && t > 0)) {
            return null;
        }
        const durationMs =
            KiStats._coercePositiveInt(
                row.durationMs ??
                    row.duration_ms ??
                    row.duration ??
                    row.elapsedMs ??
                    row.elapsed_ms
            ) ?? 0;
        const totalTokens =
            KiStats._coercePositiveInt(
                row.totalTokens ??
                    row.total_tokens ??
                    row.tokens ??
                    (usage
                        ? usage.totalTokens ??
                          usage.total_tokens ??
                          usage.total ??
                          usage.tokens
                        : null)
            );
        const promptTokens =
            KiStats._coercePositiveInt(
                row.promptTokens ??
                    row.prompt_tokens ??
                    row.inputTokens ??
                    row.input_tokens ??
                    (usage
                        ? usage.promptTokens ??
                          usage.prompt_tokens ??
                          usage.inputTokens ??
                          usage.input_tokens
                        : null)
            );
        const completionTokens =
            KiStats._coercePositiveInt(
                row.completionTokens ??
                    row.completion_tokens ??
                    row.outputTokens ??
                    row.output_tokens ??
                    (usage
                        ? usage.completionTokens ??
                          usage.completion_tokens ??
                          usage.outputTokens ??
                          usage.output_tokens
                        : null)
            );

        /** @type {KiStatsEntry} */
        const out = {
            t,
            durationMs,
            totalTokens: totalTokens != null ? totalTokens : null
        };
        if (promptTokens != null) {
            out.promptTokens = promptTokens;
        }
        if (completionTokens != null) {
            out.completionTokens = completionTokens;
        }
        return out;
    }

    /**
     * @param {unknown} raw
     * @returns {KiStatsEntry[]}
     */
    static _normalizeStoredEntries(raw) {
        let rows = [];
        if (Array.isArray(raw)) {
            rows = raw;
        } else if (raw && typeof raw === 'object') {
            const obj = /** @type {Record<string, unknown>} */ (raw);
            if (Array.isArray(obj.entries)) {
                rows = obj.entries;
            } else {
                rows = [obj];
            }
        }
        return rows
            .map((row) => KiStats._normalizeStoredEntry(row))
            .filter((row) => !!row);
    }

    /**
     * OpenAI-style `usage` on chat completions.
     * @param {unknown} data
     * @returns {{ totalTokens: number, promptTokens: number, completionTokens: number } | null}
     */
    static _extractOpenAiUsage(data) {
        if (!data || typeof data !== 'object') {
            return null;
        }
        const u = /** @type {Record<string, unknown>} */ (data).usage;
        if (!u || typeof u !== 'object') {
            return null;
        }
        const uo = /** @type {Record<string, unknown>} */ (u);
        const pt =
            Number(uo.prompt_tokens ?? uo.promptTokens ?? uo.input_tokens ?? uo.inputTokens ?? 0) || 0;
        const ct =
            Number(
                uo.completion_tokens ?? uo.completionTokens ?? uo.output_tokens ?? uo.outputTokens ?? 0
            ) || 0;
        let tt = Number(uo.total_tokens ?? uo.totalTokens ?? 0) || 0;
        if (!tt && (pt || ct)) {
            tt = pt + ct;
        }
        if (!(tt > 0) && !(pt > 0) && !(ct > 0)) {
            return null;
        }
        return {
            totalTokens: Math.round(tt),
            promptTokens: Math.round(pt),
            completionTokens: Math.round(ct)
        };
    }

    /**
     * LM Studio native REST (`/api/v1/chat`): token counts in `stats`, not `usage`.
     * @see LM Studio log: stats.input_tokens, stats.total_output_tokens, stats.reasoning_output_tokens
     * @param {unknown} data
     * @returns {{ totalTokens: number, promptTokens: number, completionTokens: number } | null}
     */
    static _extractLmStudioStatsUsage(data) {
        if (!data || typeof data !== 'object') {
            return null;
        }
        const d = /** @type {Record<string, unknown>} */ (data);
        const s = d.stats;
        if (!s || typeof s !== 'object') {
            return null;
        }
        const so = /** @type {Record<string, unknown>} */ (s);
        const input =
            Number(so.input_tokens ?? so.prompt_tokens ?? so.promptTokens ?? 0) || 0;
        let out =
            Number(
                so.total_output_tokens ??
                    so.output_tokens ??
                    so.completion_tokens ??
                    so.completionTokens ??
                    0
            ) || 0;
        const reasoning =
            Number(so.reasoning_output_tokens ?? so.reasoningTokens ?? 0) || 0;
        if (out <= 0 && reasoning > 0) {
            out = reasoning;
        }
        let tt = Number(so.total_tokens ?? so.totalTokens ?? 0) || 0;
        if (!tt && (input || out)) {
            tt = input + out;
        }
        if (!(tt > 0) && !(input > 0) && !(out > 0)) {
            return null;
        }
        if (!tt) {
            tt = input + out;
        }
        return {
            totalTokens: Math.round(tt),
            promptTokens: Math.round(input),
            completionTokens: Math.round(out)
        };
    }

    /**
     * @param {unknown} data — OpenAI-compatible (`usage`) or LM Studio REST (`stats`)
     * @returns {{ totalTokens: number, promptTokens: number, completionTokens: number } | null}
     */
    static extractUsageFromChatResponse(data) {
        return KiStats._extractOpenAiUsage(data) || KiStats._extractLmStudioStatsUsage(data);
    }

    /**
     * @param {{ durationMs: number, usage: { totalTokens: number, promptTokens: number, completionTokens: number } | null }} payload
     */
    static recordArticleSummary(payload) {
        const durationMs = Math.max(0, Math.round(Number(payload.durationMs) || 0));
        const usage = payload.usage;
        /** @type {KiStatsEntry} */
        const entry = {
            t: Date.now(),
            durationMs,
            totalTokens: usage && typeof usage.totalTokens === 'number' ? usage.totalTokens : null,
            promptTokens: usage && typeof usage.promptTokens === 'number' ? usage.promptTokens : undefined,
            completionTokens:
                usage && typeof usage.completionTokens === 'number' ? usage.completionTokens : undefined
        };

        // Robust localStorage handling with fallback strategy
        try {
            let list = KiStats.loadEntries();
            list.push(entry);
            
            // Safety limit to prevent localStorage overflow
            if (list.length > KI_STATS_MAX_ENTRIES) {
                list = list.slice(-KI_STATS_MAX_ENTRIES);
            }

            const serialized = JSON.stringify(list);
            try {
                localStorage.setItem(KI_STATS_STORAGE_KEY, serialized);
            } catch (storageError) {
                // Fallback: In-memory cache if localStorage fails (private mode/full disk)
                console.warn('KiStats: localStorage write failed, using memory fallback');
                if (!KiStats._memoryFallback) {
                    KiStats._memoryFallback = [];
                }
                KiStats._memoryFallback.push(entry);
                if (KiStats._memoryFallback.length > KI_STATS_MAX_ENTRIES) {
                    KiStats._memoryFallback = KiStats._memoryFallback.slice(-KI_STATS_MAX_ENTRIES);
                }
            }
        } catch (e) {
            console.warn('KiStats: persist failed', e);
            // Memory fallback as last resort
            if (!KiStats._memoryFallback) {
                KiStats._memoryFallback = [];
            }
            KiStats._memoryFallback.push(entry);
        }
    }

    static clear() {
        try {
            localStorage.removeItem(KI_STATS_STORAGE_KEY);
        } catch (e) {
            console.warn('KiStats: clear failed', e);
        }
        // Also clear memory fallback
        if (KiStats._memoryFallback) {
            KiStats._memoryFallback = [];
        }
    }

    /** In-memory fallback when localStorage unavailable */
    static _memoryFallback = null;

    /**
     * @returns {KiStatsEntry[]}
     */
    static loadEntries() {
        try {
            const raw = localStorage.getItem(KI_STATS_STORAGE_KEY);
            if (!raw) {
                // Fall back to memory cache if localStorage unavailable
                if (KiStats._memoryFallback && Array.isArray(KiStats._memoryFallback)) {
                    return KiStats._memoryFallback;
                }
                return [];
            }
            const parsed = JSON.parse(raw);
            const normalized = KiStats._normalizeStoredEntries(parsed);
            if (normalized.length > 0) {
                return normalized;
            }
            if (Array.isArray(parsed) && parsed.length === 0) {
                return [];
            }
            if (parsed && typeof parsed === 'object' && Array.isArray(parsed.entries) && parsed.entries.length === 0) {
                return [];
            }
            {
                console.warn('KiStats: Invalid stored format');
                // Fall back to memory cache
                if (KiStats._memoryFallback && Array.isArray(KiStats._memoryFallback)) {
                    return KiStats._memoryFallback;
                }
                return [];
            }
        } catch {
            // Fall back to memory cache
            if (KiStats._memoryFallback && Array.isArray(KiStats._memoryFallback)) {
                return KiStats._memoryFallback;
            }
            return [];
        }
    }

    /**
     * @returns {{
     *   entries: KiStatsEntry[],
     *   count: number,
     *   totalTokens: number,
     *   tokenSamples: number,
     *   avgTokens: number|null,
     *   avgDurationMs: number|null
     * }}
     */
    static getSnapshot() {
        const entries = KiStats.loadEntries();
        const count = entries.length;
        let totalTokens = 0;
        let tokenSamples = 0;
        for (const e of entries) {
            if (e && typeof e.totalTokens === 'number' && e.totalTokens > 0) {
                totalTokens += e.totalTokens;
                tokenSamples += 1;
            }
        }
        const avgTokens = tokenSamples > 0 ? Math.round(totalTokens / tokenSamples) : null;
        let sumDur = 0;
        for (const e of entries) {
            if (e && typeof e.durationMs === 'number') {
                sumDur += e.durationMs;
            }
        }
        const avgDurationMs = count > 0 ? Math.round(sumDur / count) : null;
        return {
            entries,
            count,
            totalTokens,
            tokenSamples,
            avgTokens,
            avgDurationMs
        };
    }

    /** Max buckets shown (oldest dropped when over). */
    static _maxBuckets(period) {
        if (period === 'day') {
            return 31;
        }
        if (period === 'month') {
            return 24;
        }
        return 12;
    }

    /**
     * @typedef {{
     *   key: string,
     *   label: string,
     *   avgTokens: number|null,
     *   totalTokens: number,
     *   tokenSamples: number,
     *   summaryCount: number
     * }} KiStatsTokenCompareBucket
     */

    /**
     * Chart buckets: per calendar month — average tokens per article (among entries with token data)
     * and sum of tokens in that month. Compares “intensity per request” vs “volume”.
     * @param {'month'} resolution
     * @param {string} [locale]
     * @returns {KiStatsTokenCompareBucket[]}
     */
    static getChartBucketsAvgVsTotalTokens(resolution, locale) {
        const loc = locale && String(locale).trim() ? String(locale) : 'de-DE';
        const entries = KiStats.loadEntries().filter((e) => e && typeof e.t === 'number');

        if (resolution !== 'month') {
            return [];
        }

        /** @type {Map<string, { summaryCount: number, tokenSum: number, tokenCount: number }>} */
        const perMonth = new Map();
        for (const e of entries) {
            const d = new Date(e.t);
            const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            let agg = perMonth.get(mk);
            if (!agg) {
                agg = { summaryCount: 0, tokenSum: 0, tokenCount: 0 };
                perMonth.set(mk, agg);
            }
            agg.summaryCount += 1;
            const tt = e.totalTokens;
            if (typeof tt === 'number' && tt > 0) {
                agg.tokenSum += tt;
                agg.tokenCount += 1;
            }
        }

        let keys = [...perMonth.keys()].sort();
        const maxB = KiStats._maxBuckets('month');
        if (keys.length > maxB) {
            keys = keys.slice(-maxB);
        }

        return keys.map((key) => {
            const agg = perMonth.get(key);
            const tokenSamples = agg ? agg.tokenCount : 0;
            const totalTokens = agg ? agg.tokenSum : 0;
            const avgTokens =
                agg && agg.tokenCount > 0 ? Math.round(agg.tokenSum / agg.tokenCount) : null;
            return {
                key,
                label: KiStats._formatBucketLabel(key, 'month', loc),
                avgTokens,
                totalTokens,
                tokenSamples,
                summaryCount: agg ? agg.summaryCount : 0
            };
        });
    }

    /**
     * @param {string} key
     * @param {'day'|'month'|'year'} period
     * @param {string} locale
     */
    static _formatBucketLabel(key, period, locale) {
        if (period === 'year' && /^\d{4}$/.test(String(key).trim())) {
            return String(key).trim();
        }
        const parts = key.split('-').map((x) => parseInt(x, 10));
        if (period === 'month' && parts.length >= 2) {
            const d = new Date(parts[0], parts[1] - 1, 1);
            return d.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
        }
        if (parts.length >= 3) {
            const d = new Date(parts[0], parts[1] - 1, parts[2]);
            return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
        }
        return key;
    }

    /**
     * Chart buckets für die neue Diagramm-Darstellung mit drei Kurven:
     * - Gesamttokens (totalTokens)
     * - Durchschnittliche Tokens pro Artikel (avgTokens)
     * - Durchschnittliche Verarbeitungszeit (avgDurationMs)
     * 
     * @param {'day'|'month'|'year'} resolution
     * @param {string} [locale]
     * @returns {KiStatsChartBucket[]}
     */
    static getChartBucketsThreeLines(resolution, locale) {
        const loc = locale && String(locale).trim() ? String(locale) : 'de-DE';
        const entries = KiStats.loadEntries().filter((e) => e && typeof e.t === 'number');
        
        if (resolution !== 'day' && resolution !== 'month' && resolution !== 'year') {
            return [];
        }

        /** @type {Map<string, { summaryCount: number, tokenSum: number, tokenCount: number, durationSum: number, durationCount: number }>} */
        const perBucket = new Map();
        
        for (const e of entries) {
            const d = new Date(e.t);
            let bucketKey = '';
            
            if (resolution === 'year') {
                bucketKey = String(d.getFullYear());
            } else if (resolution === 'month') {
                bucketKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            } else {
                // day
                bucketKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }
            
            let agg = perBucket.get(bucketKey);
            if (!agg) {
                agg = { summaryCount: 0, tokenSum: 0, tokenCount: 0, durationSum: 0, durationCount: 0 };
                perBucket.set(bucketKey, agg);
            }
            
            agg.summaryCount += 1;
            const tt = e.totalTokens;
            if (typeof tt === 'number' && tt > 0) {
                agg.tokenSum += tt;
                agg.tokenCount += 1;
            }
            // Only add duration when it's a positive number
            if (Number.isFinite(e.durationMs) && e.durationMs > 0) {
                agg.durationSum += e.durationMs;
                agg.durationCount += 1;
            }
        }

        let keys = [...perBucket.keys()].sort();
        const maxB = KiStats._maxBuckets(resolution);
        if (keys.length > maxB) {
            keys = keys.slice(-maxB);
        }

        return keys.map((key) => {
            const agg = perBucket.get(key);
            const tokenSamples = agg ? agg.tokenCount : 0;
            const totalTokens = agg ? agg.tokenSum : 0;
            const avgTokens =
                agg && agg.tokenCount > 0 ? Math.round(agg.tokenSum / agg.tokenCount) : null;
            const avgDurationMs =
                agg && agg.durationCount > 0 ? Math.round(agg.durationSum / agg.durationCount) : null;
            return {
                key,
                label: KiStats._formatBucketLabel(key, resolution, loc),
                avgTokens,
                totalTokens,
                tokenSamples,
                summaryCount: agg ? agg.summaryCount : 0,
                avgDurationMs
            };
        });
    }
}

window.KiStats = KiStats;
