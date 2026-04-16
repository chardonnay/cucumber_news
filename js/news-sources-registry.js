/**
 * Cucumber NewsScraper — canonical news source ids and site URLs (registry).
 *
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Daniel Mengel
 */
(function (global) {
    /** @type {readonly { id: string, siteUrl: string }[]} */
    const REG = [
        { id: 'heise', siteUrl: 'https://www.heise.de' },
        { id: 'bild', siteUrl: 'https://www.bild.de' },
        { id: 'telepolis', siteUrl: 'https://www.telepolis.de' },
        { id: 'golem', siteUrl: 'https://www.golem.de' },
        { id: 'computerbase', siteUrl: 'https://www.computerbase.de' },
        { id: 't3n', siteUrl: 'https://t3n.de' },
        { id: 'it_administrator', siteUrl: 'https://www.it-administrator.de' },
        { id: 'verge', siteUrl: 'https://www.theverge.com' }
    ];
    global.NEWS_SOURCES_REGISTRY = Object.freeze(REG.map((x) => Object.freeze({ ...x })));
    global.NEWS_SOURCE_IDS = Object.freeze(REG.map((r) => r.id));
})(typeof window !== 'undefined' ? window : globalThis);
