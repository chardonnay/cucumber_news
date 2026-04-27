/**
 * Cucumber NewsScraper — client-side KI usage stats (tokens, duration); localStorage.
 *
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Daniel Mengel
 */

const KI_STATS_STORAGE_KEY = 'heise_ki_article_stats_v1';
const KI_STATS_MAX_ENTRIES = 500;

/**
 * @typedef {{ t: number, durationMs: number, totalTokens: number|null, promptTokens?: number, completionTokens?: number, model?: string }} KiStatsEntry
 */

/**
 * @typedef {{ count: number, totalTokens: number, tokenSamples: number, durationSumMs: number, durationSamples: number, modelCounts: Record<string, number> }} KiStatsDailyAggregate
 */

/**
 * @typedef {{ entries: KiStatsEntry[], daily: Record<string, KiStatsDailyAggregate> }} KiStatsStore
 */

class KiStats {
    /**
     * @returns {KiStatsStore}
     */
    static _createEmptyStore() {
        return {
            entries: [],
            daily: {}
        };
    }

    /**
     * @param {unknown} raw
     * @returns {'all'|'week'|'month'|'year'}
     */
    static _normalizePeriod(raw) {
        const s = String(raw || '').trim().toLowerCase();
        if (s === 'day') {
            return 'week';
        }
        if (s === 'week' || s === 'month' || s === 'year') {
            return s;
        }
        return 'all';
    }

    /**
     * @param {'all'|'week'|'month'|'year'} period
     * @param {number} [nowMs]
     * @returns {{ startMs: number, endMs: number }|null}
     */
    static _getPeriodBounds(period, nowMs) {
        if (period === 'all') {
            return null;
        }
        const now = Number.isFinite(nowMs) ? new Date(nowMs) : new Date();
        const endMs = now.getTime();
        const ref = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        if (period === 'week') {
            const start = new Date(ref);
            start.setDate(start.getDate() - 6);
            start.setHours(0, 0, 0, 0);
            return { startMs: start.getTime(), endMs };
        }
        if (period === 'month') {
            const start = new Date(ref);
            start.setDate(start.getDate() - 30);
            start.setHours(0, 0, 0, 0);
            return { startMs: start.getTime(), endMs };
        }
        const start = new Date(ref.getFullYear(), ref.getMonth() - 11, 1, 0, 0, 0, 0);
        return { startMs: start.getTime(), endMs };
    }

    /**
     * @param {KiStatsEntry[]} entries
     * @param {unknown} periodRaw
     * @param {number} [nowMs]
     * @returns {KiStatsEntry[]}
     */
    static _filterEntriesForPeriod(entries, periodRaw, nowMs) {
        const period = KiStats._normalizePeriod(periodRaw);
        const bounds = KiStats._getPeriodBounds(period, nowMs);
        if (!bounds) {
            return [...entries];
        }
        return entries.filter(
            (entry) =>
                entry &&
                typeof entry.t === 'number' &&
                entry.t >= bounds.startMs &&
                entry.t <= bounds.endMs
        );
    }

    /**
     * @param {unknown} periodRaw
     * @param {number} [nowMs]
     * @returns {string[]}
     */
    static _buildBucketKeysForPeriod(periodRaw, nowMs) {
        const period = KiStats._normalizePeriod(periodRaw);
        const bounds = KiStats._getPeriodBounds(period, nowMs);
        if (!bounds) {
            return [];
        }
        const end = Number.isFinite(nowMs) ? new Date(nowMs) : new Date();
        const keys = [];
        if (period === 'year') {
            const start = new Date(bounds.startMs);
            const cursor = new Date(start.getFullYear(), start.getMonth(), 1, 0, 0, 0, 0);
            const last = new Date(end.getFullYear(), end.getMonth(), 1, 0, 0, 0, 0);
            while (cursor.getTime() <= last.getTime()) {
                keys.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
                cursor.setMonth(cursor.getMonth() + 1);
            }
            return keys;
        }
        const cursor = new Date(bounds.startMs);
        const last = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0, 0);
        while (cursor.getTime() <= last.getTime()) {
            keys.push(
                `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(
                    cursor.getDate()
                ).padStart(2, '0')}`
            );
            cursor.setDate(cursor.getDate() + 1);
        }
        return keys;
    }

    static _emitUpdated() {
        try {
            if (typeof document !== 'undefined' && typeof document.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
                document.dispatchEvent(new CustomEvent('ki-stats-updated'));
            }
        } catch (_) {
            /* ignore */
        }
    }

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
     * @param {number} timestampMs
     * @returns {string}
     */
    static _formatDayKey(timestampMs) {
        const date = new Date(timestampMs);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
            date.getDate()
        ).padStart(2, '0')}`;
    }

    /**
     * @param {string} key
     * @returns {number|null}
     */
    static _parseDayKeyToTimestampMs(key) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || '').trim());
        if (!match) {
            return null;
        }
        const year = Number(match[1]);
        const monthIndex = Number(match[2]) - 1;
        const day = Number(match[3]);
        const ts = new Date(year, monthIndex, day, 0, 0, 0, 0).getTime();
        return Number.isFinite(ts) ? ts : null;
    }

    /**
     * @returns {KiStatsDailyAggregate}
     */
    static _createEmptyDailyAggregate() {
        return {
            count: 0,
            totalTokens: 0,
            tokenSamples: 0,
            durationSumMs: 0,
            durationSamples: 0,
            modelCounts: {}
        };
    }

    /**
     * @param {unknown} raw
     * @returns {string}
     */
    static _normalizeModelName(raw) {
        const model = String(raw || '').trim();
        return model ? model : '';
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
        const model = KiStats._normalizeModelName(row.model ?? row.modelName ?? row.model_name);
        if (model) {
            out.model = model;
        }
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
     * @param {unknown} raw
     * @returns {KiStatsDailyAggregate|null}
     */
    static _normalizeStoredDailyAggregate(raw) {
        if (!raw || typeof raw !== 'object') {
            return null;
        }
        const row = /** @type {Record<string, unknown>} */ (raw);
        const count = KiStats._coercePositiveInt(row.count) ?? 0;
        const totalTokens = KiStats._coercePositiveInt(row.totalTokens ?? row.total_tokens) ?? 0;
        const tokenSamples = KiStats._coercePositiveInt(row.tokenSamples ?? row.token_samples) ?? 0;
        const durationSumMs =
            KiStats._coercePositiveInt(row.durationSumMs ?? row.duration_sum_ms ?? row.durationTotalMs) ?? 0;
        const durationSamples =
            KiStats._coercePositiveInt(row.durationSamples ?? row.duration_samples) ?? 0;
        /** @type {Record<string, number>} */
        const modelCounts = {};
        if (row.modelCounts && typeof row.modelCounts === 'object' && !Array.isArray(row.modelCounts)) {
            for (const [modelName, modelCountRaw] of Object.entries(row.modelCounts)) {
                const normalizedModel = KiStats._normalizeModelName(modelName);
                const normalizedCount = KiStats._coercePositiveInt(modelCountRaw) ?? 0;
                if (normalizedModel && normalizedCount > 0) {
                    modelCounts[normalizedModel] = normalizedCount;
                }
            }
        }

        return {
            count,
            totalTokens,
            tokenSamples: Math.min(tokenSamples, count),
            durationSumMs,
            durationSamples: Math.min(durationSamples, count),
            modelCounts
        };
    }

    /**
     * @param {unknown} raw
     * @returns {Record<string, KiStatsDailyAggregate>}
     */
    static _normalizeStoredDailyAggregates(raw) {
        /** @type {Record<string, KiStatsDailyAggregate>} */
        const out = {};
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            return out;
        }
        for (const [key, value] of Object.entries(raw)) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key).trim())) {
                continue;
            }
            const normalized = KiStats._normalizeStoredDailyAggregate(value);
            if (normalized) {
                out[String(key).trim()] = normalized;
            }
        }
        return out;
    }

    /**
     * @param {KiStatsEntry[]} entries
     * @returns {Record<string, KiStatsDailyAggregate>}
     */
    static _buildDailyAggregatesFromEntries(entries) {
        /** @type {Record<string, KiStatsDailyAggregate>} */
        const daily = {};
        for (const entry of entries) {
            if (!entry || typeof entry.t !== 'number' || !Number.isFinite(entry.t) || entry.t <= 0) {
                continue;
            }
            const key = KiStats._formatDayKey(entry.t);
            if (!daily[key]) {
                daily[key] = KiStats._createEmptyDailyAggregate();
            }
            const aggregate = daily[key];
            aggregate.count += 1;

            if (typeof entry.totalTokens === 'number' && entry.totalTokens > 0) {
                aggregate.totalTokens += entry.totalTokens;
                aggregate.tokenSamples += 1;
            }

            if (typeof entry.durationMs === 'number' && Number.isFinite(entry.durationMs) && entry.durationMs >= 0) {
                aggregate.durationSumMs += Math.round(entry.durationMs);
                if (entry.durationMs > 0) {
                    aggregate.durationSamples += 1;
                }
            }
            if (entry.model) {
                aggregate.modelCounts[entry.model] = (aggregate.modelCounts[entry.model] || 0) + 1;
            }
        }
        return daily;
    }

    /**
     * @param {unknown} raw
     * @returns {KiStatsStore}
     */
    static _normalizeStoredStore(raw) {
        const entries = KiStats._normalizeStoredEntries(raw);
        let daily = {};
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
            const obj = /** @type {Record<string, unknown>} */ (raw);
            daily = KiStats._normalizeStoredDailyAggregates(obj.daily);
        }
        if (entries.length > 0) {
            const derivedDaily = KiStats._buildDailyAggregatesFromEntries(entries);
            if (Object.keys(daily).length === 0) {
                daily = derivedDaily;
            } else {
                for (const [dayKey, derivedAggregate] of Object.entries(derivedDaily)) {
                    if (!daily[dayKey]) {
                        daily[dayKey] = derivedAggregate;
                        continue;
                    }
                    const currentAggregate = daily[dayKey];
                    if (
                        Object.keys(currentAggregate.modelCounts || {}).length === 0 &&
                        Object.keys(derivedAggregate.modelCounts || {}).length > 0
                    ) {
                        daily[dayKey] = {
                            ...currentAggregate,
                            modelCounts: { ...derivedAggregate.modelCounts }
                        };
                    }
                }
            }
        }
        return { entries, daily };
    }

    /**
     * @returns {KiStatsStore}
     */
    static _getMemoryFallbackStore() {
        if (!KiStats._memoryFallback) {
            return KiStats._createEmptyStore();
        }
        if (Array.isArray(KiStats._memoryFallback)) {
            return KiStats._normalizeStoredStore(KiStats._memoryFallback);
        }
        return KiStats._normalizeStoredStore(KiStats._memoryFallback);
    }

    /**
     * @param {KiStatsStore} store
     * @param {KiStatsEntry} entry
     * @returns {KiStatsStore}
     */
    static _appendEntryToStore(store, entry) {
        const entries = Array.isArray(store.entries) ? [...store.entries, entry] : [entry];
        if (entries.length > KI_STATS_MAX_ENTRIES) {
            entries.splice(0, entries.length - KI_STATS_MAX_ENTRIES);
        }

        const daily = { ...(store.daily || {}) };
        const dayKey = KiStats._formatDayKey(entry.t);
        const previousAggregate = daily[dayKey]
            ? {
                  ...daily[dayKey],
                  modelCounts: { ...(daily[dayKey].modelCounts || {}) }
              }
            : KiStats._createEmptyDailyAggregate();

        previousAggregate.count += 1;
        if (typeof entry.totalTokens === 'number' && entry.totalTokens > 0) {
            previousAggregate.totalTokens += entry.totalTokens;
            previousAggregate.tokenSamples += 1;
        }
        if (typeof entry.durationMs === 'number' && Number.isFinite(entry.durationMs) && entry.durationMs >= 0) {
            previousAggregate.durationSumMs += Math.round(entry.durationMs);
            if (entry.durationMs > 0) {
                previousAggregate.durationSamples += 1;
            }
        }
        if (entry.model) {
            previousAggregate.modelCounts[entry.model] = (previousAggregate.modelCounts[entry.model] || 0) + 1;
        }

        daily[dayKey] = previousAggregate;
        return { entries, daily };
    }

    /**
     * @param {Record<string, number>} target
     * @param {Record<string, number>|null|undefined} source
     */
    static _mergeModelCounts(target, source) {
        if (!source || typeof source !== 'object') {
            return;
        }
        for (const [modelName, countRaw] of Object.entries(source)) {
            const normalizedModel = KiStats._normalizeModelName(modelName);
            const normalizedCount = KiStats._coercePositiveInt(countRaw) ?? 0;
            if (!normalizedModel || normalizedCount <= 0) {
                continue;
            }
            target[normalizedModel] = (target[normalizedModel] || 0) + normalizedCount;
        }
    }

    /**
     * @param {Record<string, number>|null|undefined} modelCounts
     * @returns {string|null}
     */
    static _getTopModelFromCounts(modelCounts) {
        if (!modelCounts || typeof modelCounts !== 'object') {
            return null;
        }
        let topModel = '';
        let topCount = 0;
        for (const [modelName, countRaw] of Object.entries(modelCounts)) {
            const normalizedModel = KiStats._normalizeModelName(modelName);
            const normalizedCount = KiStats._coercePositiveInt(countRaw) ?? 0;
            if (!normalizedModel || normalizedCount <= 0) {
                continue;
            }
            if (normalizedCount > topCount || (normalizedCount === topCount && (!topModel || normalizedModel.localeCompare(topModel) < 0))) {
                topModel = normalizedModel;
                topCount = normalizedCount;
            }
        }
        return topModel || null;
    }

    /**
     * @param {Record<string, KiStatsDailyAggregate>} daily
     * @param {unknown} periodRaw
     * @param {number} [nowMs]
     * @returns {{ count: number, totalTokens: number, tokenSamples: number, durationSumMs: number, durationSamples: number }}
     */
    static _getAggregatedTotalsForPeriod(daily, periodRaw, nowMs) {
        const period = KiStats._normalizePeriod(periodRaw);
        const bounds = KiStats._getPeriodBounds(period, nowMs);
        let count = 0;
        let totalTokens = 0;
        let tokenSamples = 0;
        let durationSumMs = 0;
        let durationSamples = 0;

        for (const [dayKey, aggregate] of Object.entries(daily || {})) {
            if (bounds) {
                const dayMs = KiStats._parseDayKeyToTimestampMs(dayKey);
                if (dayMs == null || dayMs < bounds.startMs || dayMs > bounds.endMs) {
                    continue;
                }
            }
            count += aggregate.count || 0;
            totalTokens += aggregate.totalTokens || 0;
            tokenSamples += aggregate.tokenSamples || 0;
            durationSumMs += aggregate.durationSumMs || 0;
            durationSamples += aggregate.durationSamples || 0;
        }

        return {
            count,
            totalTokens,
            tokenSamples,
            durationSumMs,
            durationSamples
        };
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
     * @param {{ durationMs: number, usage: { totalTokens: number, promptTokens: number, completionTokens: number } | null, model?: string }} payload
     */
    static recordArticleSummary(payload) {
        const durationMs = Math.max(0, Math.round(Number(payload.durationMs) || 0));
        const usage = payload.usage;
        const model = KiStats._normalizeModelName(payload.model);
        /** @type {KiStatsEntry} */
        const entry = {
            t: Date.now(),
            durationMs,
            totalTokens: usage && typeof usage.totalTokens === 'number' ? usage.totalTokens : null,
            promptTokens: usage && typeof usage.promptTokens === 'number' ? usage.promptTokens : undefined,
            completionTokens:
                usage && typeof usage.completionTokens === 'number' ? usage.completionTokens : undefined
        };
        if (model) {
            entry.model = model;
        }

        // Robust localStorage handling with fallback strategy
        try {
            const nextStore = KiStats._appendEntryToStore(KiStats.loadStore(), entry);
            const serialized = JSON.stringify(nextStore);
            try {
                localStorage.setItem(KI_STATS_STORAGE_KEY, serialized);
                KiStats._memoryFallback = nextStore;
            } catch (storageError) {
                // Fallback: In-memory cache if localStorage fails (private mode/full disk)
                console.warn('KiStats: localStorage write failed, using memory fallback');
                KiStats._memoryFallback = nextStore;
            }
        } catch (e) {
            console.warn('KiStats: persist failed', e);
            // Memory fallback as last resort
            KiStats._memoryFallback = KiStats._appendEntryToStore(KiStats._getMemoryFallbackStore(), entry);
        }
        KiStats._emitUpdated();
    }

    static clear() {
        try {
            localStorage.removeItem(KI_STATS_STORAGE_KEY);
        } catch (e) {
            console.warn('KiStats: clear failed', e);
        }
        // Also clear memory fallback
        KiStats._memoryFallback = KiStats._createEmptyStore();
        KiStats._emitUpdated();
    }

    /** In-memory fallback when localStorage unavailable */
    static _memoryFallback = null;

    /**
     * @returns {KiStatsStore}
     */
    static loadStore() {
        try {
            const raw = localStorage.getItem(KI_STATS_STORAGE_KEY);
            if (!raw) {
                return KiStats._getMemoryFallbackStore();
            }
            const parsed = JSON.parse(raw);
            const normalized = KiStats._normalizeStoredStore(parsed);
            if (
                normalized.entries.length > 0 ||
                Object.keys(normalized.daily).length > 0 ||
                Array.isArray(parsed) ||
                (parsed && typeof parsed === 'object')
            ) {
                return normalized;
            }
            console.warn('KiStats: Invalid stored format');
            return KiStats._getMemoryFallbackStore();
        } catch {
            return KiStats._getMemoryFallbackStore();
        }
    }

    /**
     * @returns {KiStatsEntry[]}
     */
    static loadEntries() {
        return KiStats.loadStore().entries;
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
    static getSnapshot(period) {
        const store = KiStats.loadStore();
        const entries = KiStats._filterEntriesForPeriod(store.entries, period);
        const hasDailyAggregates = Object.keys(store.daily || {}).length > 0;
        const totals = hasDailyAggregates
            ? KiStats._getAggregatedTotalsForPeriod(store.daily, period)
            : null;
        const count = totals ? totals.count : entries.length;
        const totalTokens = totals ? totals.totalTokens : entries.reduce((sum, entry) => {
            if (entry && typeof entry.totalTokens === 'number' && entry.totalTokens > 0) {
                return sum + entry.totalTokens;
            }
            return sum;
        }, 0);
        const tokenSamples = totals ? totals.tokenSamples : entries.reduce((sum, entry) => {
            if (entry && typeof entry.totalTokens === 'number' && entry.totalTokens > 0) {
                return sum + 1;
            }
            return sum;
        }, 0);
        const avgTokens = tokenSamples > 0 ? Math.round(totalTokens / tokenSamples) : null;
        let sumDur = 0;
        if (totals) {
            sumDur = totals.durationSumMs;
        } else {
            for (const e of entries) {
                if (e && typeof e.durationMs === 'number') {
                    sumDur += e.durationMs;
                }
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
     *   summaryCount: number,
     *   topModel?: string|null
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
     * @param {'week'|'month'|'year'|'day'} resolution
     * @param {string} [locale]
     * @returns {KiStatsChartBucket[]}
     */
    static getChartBucketsThreeLines(resolution, locale) {
        const loc = locale && String(locale).trim() ? String(locale) : 'de-DE';
        const period = KiStats._normalizePeriod(resolution);
        if (period === 'all') {
            return [];
        }
        const nowMs = Date.now();
        const store = KiStats.loadStore();
        const hasDailyAggregates = Object.keys(store.daily || {}).length > 0;

        /** @type {Map<string, { summaryCount: number, tokenSum: number, tokenCount: number, durationSum: number, durationCount: number, modelCounts: Record<string, number> }>} */
        const perBucket = new Map();
        const bucketKeys = KiStats._buildBucketKeysForPeriod(period, nowMs);
        const bucketResolution = period === 'year' ? 'month' : 'day';
        for (const key of bucketKeys) {
            perBucket.set(key, {
                summaryCount: 0,
                tokenSum: 0,
                tokenCount: 0,
                durationSum: 0,
                durationCount: 0,
                modelCounts: {}
            });
        }

        if (hasDailyAggregates) {
            const bounds = KiStats._getPeriodBounds(period, nowMs);
            for (const [dayKey, dayAggregate] of Object.entries(store.daily)) {
                const dayMs = KiStats._parseDayKeyToTimestampMs(dayKey);
                if (bounds && (dayMs == null || dayMs < bounds.startMs || dayMs > bounds.endMs)) {
                    continue;
                }
                const bucketKey = bucketResolution === 'month' ? dayKey.slice(0, 7) : dayKey;
                let agg = perBucket.get(bucketKey);
                if (!agg) {
                    agg = {
                        summaryCount: 0,
                        tokenSum: 0,
                        tokenCount: 0,
                        durationSum: 0,
                        durationCount: 0,
                        modelCounts: {}
                    };
                    perBucket.set(bucketKey, agg);
                }
                agg.summaryCount += dayAggregate.count || 0;
                agg.tokenSum += dayAggregate.totalTokens || 0;
                agg.tokenCount += dayAggregate.tokenSamples || 0;
                agg.durationSum += dayAggregate.durationSumMs || 0;
                agg.durationCount += dayAggregate.durationSamples || 0;
                KiStats._mergeModelCounts(agg.modelCounts, dayAggregate.modelCounts);
            }
        } else {
            const entries = KiStats._filterEntriesForPeriod(
                store.entries.filter((e) => e && typeof e.t === 'number'),
                period,
                nowMs
            );
            for (const e of entries) {
                const d = new Date(e.t);
                let bucketKey = '';

                if (bucketResolution === 'month') {
                    bucketKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                } else {
                    bucketKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                }

                let agg = perBucket.get(bucketKey);
                if (!agg) {
                    agg = {
                        summaryCount: 0,
                        tokenSum: 0,
                        tokenCount: 0,
                        durationSum: 0,
                        durationCount: 0,
                        modelCounts: {}
                    };
                    perBucket.set(bucketKey, agg);
                }

                agg.summaryCount += 1;
                const tt = e.totalTokens;
                if (typeof tt === 'number' && tt > 0) {
                    agg.tokenSum += tt;
                    agg.tokenCount += 1;
                }
                if (Number.isFinite(e.durationMs) && e.durationMs > 0) {
                    agg.durationSum += e.durationMs;
                    agg.durationCount += 1;
                }
                if (e.model) {
                    agg.modelCounts[e.model] = (agg.modelCounts[e.model] || 0) + 1;
                }
            }
        }

        const keys = bucketKeys.length > 0 ? bucketKeys : [...perBucket.keys()].sort();

        return keys.map((key) => {
            const agg = perBucket.get(key);
            const tokenSamples = agg ? agg.tokenCount : 0;
            const totalTokens = agg ? agg.tokenSum : 0;
            const avgTokens =
                agg && agg.tokenCount > 0 ? Math.round(agg.tokenSum / agg.tokenCount) : null;
            const avgDurationMs =
                agg && agg.durationCount > 0 ? Math.round(agg.durationSum / agg.durationCount) : null;
            const topModel = agg ? KiStats._getTopModelFromCounts(agg.modelCounts) : null;
            return {
                key,
                label: KiStats._formatBucketLabel(key, bucketResolution, loc),
                avgTokens,
                totalTokens,
                tokenSamples,
                summaryCount: agg ? agg.summaryCount : 0,
                avgDurationMs,
                topModel
            };
        });
    }
}

window.KiStats = KiStats;
