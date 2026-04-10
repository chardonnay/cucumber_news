/**
 * Cucumber NewsScraper — main application (UI, feeds orchestration, KI batch jobs, settings).
 *
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Daniel Mengel
 */

/** Remote favicon/SVG from heise.de — not bundled in the app (see README). */
const HEISE_BRAND_LOGO_URL = 'https://www.heise.de/icons/ho/favicon/favicon.svg';
/** Remote wordmark asset from golem.de — not bundled (see README). */
const GOLEM_BRAND_LOGO_URL = 'https://www.golem.de/staticrl/images/Golem-Logo-black-small.png';
/** Remote SVG from computerbase.de — not bundled (see README). */
const COMPUTERBASE_BRAND_LOGO_URL = 'https://www.computerbase.de/img/logo-blue.svg';
/** Remote icon from t3n CDN — not bundled (see README). */
const T3N_BRAND_LOGO_URL = 'https://cdn.t3n.de/global/images/icons/t3n-favicon-96x96.png';
/** Remote favicon from The Verge — not bundled (see README). */
const VERGE_BRAND_LOGO_URL = 'https://www.theverge.com/static-assets/icons/favicon-32x32.png';
/** Telepolis (heise medien) — favicon */
const TELEPOLIS_BRAND_LOGO_URL = 'https://www.telepolis.de/favicon.ico';
/** IT-Administrator — favicon */
const IT_ADMINISTRATOR_BRAND_LOGO_URL = 'https://www.it-administrator.de/favicon.ico';

/** Accent color themes (must match `data-color-theme` in index.html). */
const COLOR_THEME_IDS = ['heise', 'ocean', 'forest', 'violet', 'amber', 'rose', 'slate', 'midnight'];

class App {
    constructor() {
        this.storage = new NewsStorage();
        this.scraper = new NewsScraper();
        this.summarizer = new AISummarizer();
        this.youtubeRelated = new YoutubeRelated();
        
        // State
        this.newsItems = [];
        this.filteredNewsItems = [];
        this.selectedCategories = [];
        this.currentPage = 1;
        const itemsPerPage = 15;
        this.itemsPerPage = itemsPerPage;

        /** Article IDs that appeared since the previous fetch (cleared after 3s hover or highlight removal). */
        this._newArticleIds = new Set();

        /** Background KI run for new articles after refresh (avoid overlap with „Alle Zusammenfassungen“). */
        this._autoSummarizeNewInProgress = false;
        /** @type {Map<string, {isFavorite?: boolean, isHidden?: boolean}>} */
        this._articleFlags = new Map();

        // DOM Elements
        this.elements = {
            newsGrid: document.getElementById('newsGrid'),
            categoryFilters: document.getElementById('categoryFilters'),
            loadMoreBtn: document.getElementById('loadMoreBtn'),
            showAllNewsBtn: document.getElementById('showAllNewsBtn'),
            themeToggle: document.getElementById('themeToggle'),
            refreshBtn: document.getElementById('refreshBtn'),
            summarizeAllBtn: document.getElementById('summarizeAllBtn'),
            summarizeAllRefreshBtn: document.getElementById('summarizeAllRefreshBtn'),
            settingsBtn: document.getElementById('settingsBtn'),
            dashboardSettingsBtn: document.getElementById('dashboardSettingsBtn'),
            dashboardSettingsModal: document.getElementById('dashboardSettingsModal'),
            cancelDashboardSettings: document.getElementById('cancelDashboardSettings'),
            saveDashboardSettings: document.getElementById('saveDashboardSettings'),
            dashboardOpenKiLangBtn: document.getElementById('dashboardOpenKiLangBtn'),
            newsSourcesFilterInput: document.getElementById('newsSourcesFilterInput'),
            newsSourcesSettingsList: document.getElementById('newsSourcesSettingsList'),
            newsSourcesToggleVisibleBtn: document.getElementById('newsSourcesToggleVisibleBtn'),
            settingsModal: document.getElementById('settingsModal'),
            refreshIntervalSelect: document.getElementById('refreshIntervalSelect'),
            headerCustomIntervalWrap: document.getElementById('headerCustomIntervalWrap'),
            headerCustomInterval: document.getElementById('headerCustomInterval'),
            apiBaseUrl: document.getElementById('apiBaseUrl'),
            kiApiMode: document.getElementById('kiApiMode'),
            lmApiToken: document.getElementById('lmApiToken'),
            serverUrlHint: document.getElementById('serverUrlHint'),
            restSameOrigin: document.getElementById('restSameOrigin'),
            lmModel: document.getElementById('lmModel'),
            summaryLangMode: document.getElementById('summaryLangMode'),
            summaryCacheDays: document.getElementById('summaryCacheDays'),
            summaryConcurrency: document.getElementById('summaryConcurrency'),
            kiRequestTimeoutSeconds: document.getElementById('kiRequestTimeoutSeconds'),
            reasoningSelect: document.getElementById('reasoningSelect'),
            alternativeLinksCount: document.getElementById('alternativeLinksCount'),
            alternativeLinksDisplayMode: document.getElementById('alternativeLinksDisplayMode'),
            alternativeLinksBlacklist: document.getElementById('alternativeLinksBlacklist'),
            webSearchEngine: document.getElementById('webSearchEngine'),
            cancelSettings: document.getElementById('cancelSettings'),
            saveSettings: document.getElementById('saveSettings'),
            openKiStatsBtn: document.getElementById('openKiStatsBtn'),
            kiStatsModal: document.getElementById('kiStatsModal'),
            clearKiStatsBtn: document.getElementById('clearKiStatsBtn'),
            cancelKiStatsBtn: document.getElementById('cancelKiStatsBtn'),
            statusBar: document.getElementById('statusBar'),
            lastUpdate: document.getElementById('lastUpdate'),
            newsCount: document.getElementById('newsCount'),
            kiStatusDot: document.getElementById('kiStatusDot'),
            sortSelect: document.getElementById('sortSelect'),
            sortDateSingle: document.getElementById('sortDateSingle'),
            sortDateFrom: document.getElementById('sortDateFrom'),
            sortDateTo: document.getElementById('sortDateTo'),
            sortDateSingleWrap: document.getElementById('sortDateSingleWrap'),
            sortDateRangeWrap: document.getElementById('sortDateRangeWrap'),
            sortApplyBtn: document.getElementById('sortApplyBtn'),
            sortProgress: document.getElementById('sortProgress'),
            headerBrandToggle: document.getElementById('headerBrandToggle'),
            heiseBrandLogo: document.getElementById('heiseBrandLogo'),
            headerBrandText: document.getElementById('headerBrandText'),
            headerSubtitle: document.getElementById('headerSubtitle'),
            newsSourceSelect: document.getElementById('newsSourceSelect'),
            colorThemeSelect: document.getElementById('colorThemeSelect'),
            headerColorThemeWrap: document.getElementById('headerColorThemeWrap'),
            youtubeModal: document.getElementById('youtubeModal')
        };

        // Timer reference
        this.updateTimer = null;

        /** Wall-clock when the tab became hidden (Page Visibility); used to resume refresh when visible again. */
        this._tabBecameHiddenAt = null;
        /** Debounced fetch after returning to the tab. */
        this._visibilityResumeFetchTimer = null;
        /** @type {(() => void) | null} */
        this._onDocumentVisibilityChange = null;

        /**
         * Incremented at the start of each fetchNews run so a slow response from a
         * previous news source cannot overwrite the list after the user switches (e.g. Heise → Verge).
         */
        this._newsFetchGeneration = 0;

        /** @type {Record<string, string>} Localized short names for source ids (header `news_source_*`). */
        this._i18nNewsSourceLabels = {};
        this._i18nDashboardSaved = '';
        this._i18nDashboardNeedOne = '';
        this._i18nToggleVisibleEnable = '';
        this._i18nToggleVisibleDisable = '';
        this._i18nHeiseMagazineHeading = '';
        /** @type {Record<string, string>} */
        this._i18nHeiseMagazineById = {};
        this._i18nBatchSummarizeProgress = '';
        this._i18nBatchSummarizeProgressRefresh = '';
        this._i18nKiStatsTokenNa = '—';
        this._i18nKiStatsTokenHint = '';
        this._i18nKiStatsChartTpl = '';
        this._i18nKiStatsClearConfirm = '';
        this._i18nKiStatsChartAvgLegend = '';
        this._i18nKiStatsChartTotalLegend = '';
        this._i18nKiStatsTokensUnavailable = '';
        this._i18nKiStatsChartYTitle = '';
        this._i18nAltLinksCount = '{count} alternative sources';
        this._i18nAltLinksBtnShow = 'Show alternative links';
        this._i18nAltLinksBtnHide = 'Hide alternative links';
        this._i18nAltLinksRefresh = 'Refresh alternative links';
        this._i18nAltLinksRefreshDone = 'Alternative links updated.';
        this._i18nAltLinksErrNoUrl = 'No article URL for alternative link search.';
        this._i18nAltLinksErrNoSummary = 'No summary yet — load or generate one first.';
        this._i18nAltLinksRefreshNone = 'No alternative links returned (search or probe).';
        this._i18nWebSearchBtn = '🔍 Weitere Artikel';
        this._i18nWebSearchTitle = 'Gleiches Thema per Suchmaschine finden';
        this._i18nRedditSearchBtn = 'Reddit';
        this._i18nRedditSearchTitle = 'Search Reddit for threads on this topic (up to 5)';
        this._i18nRedditNone = 'No matching Reddit threads found.';
        this._i18nRedditError = 'Reddit search failed.';
        this._i18nRedditNoTitle = 'No article title for Reddit search.';
        this._i18nRedditFound = '{count} Reddit thread(s)';
        this._i18nRedditFoundAi = 'Reddit (KI): {count} Thread(s) — Suche: {queries}';
        this._i18nNewsCountLoaded = '{count} Nachrichten geladen';

        // Initialize
        this.init();
    }

    /**
     * All known news source ids (catalog). Populated by `news-sources-registry.js` before `app.js`.
     * @returns {string[]}
     */
    static newsCatalogIds() {
        if (typeof window !== 'undefined' && Array.isArray(window.NEWS_SOURCE_IDS)) {
            return [...window.NEWS_SOURCE_IDS];
        }
        return ['heise', 'telepolis', 'golem', 'computerbase', 't3n', 'it_administrator', 'verge'];
    }

    /**
     * @param {unknown} raw
     * @returns {string[]}
     */
    static normalizeEnabledNewsSourcesArray(raw) {
        const order = App.newsCatalogIds();
        const known = new Set(order);
        if (!Array.isArray(raw) || raw.length === 0) {
            return order.slice();
        }
        const picked = new Set(
            raw.map((x) => String(x).trim()).filter((id) => known.has(id))
        );
        if (picked.size === 0) {
            return order.slice();
        }
        return order.filter((id) => picked.has(id));
    }

    /**
     * @param {string} raw
     * @param {string[]} enabledOrderedIds
     * @returns {string}
     */
    static normalizeNewsSourceWithEnabled(raw, enabledOrderedIds) {
        const s = String(raw || '').trim();
        const enabled = new Set(enabledOrderedIds);
        if (enabled.has(s)) {
            return s;
        }
        return enabledOrderedIds.length > 0 ? enabledOrderedIds[0] : 'heise';
    }

    /** Shared rubric keys (no heise magazines) — used by Golem, ComputerBase, t3n, The Verge, etc. */
    static genericRubricCategorySet() {
        return new Set([
            'it',
            'security',
            'ki',
            'wissenschaft',
            'mobiles',
            'entertainment',
            'wirtschaft',
            'netzpolitik',
            'journal'
        ]);
    }

    /** @returns {Set<string>} */
    static genericRubricNewsSourceSet() {
        return new Set(App.newsCatalogIds().filter((id) => id !== 'heise' && id !== 'telepolis'));
    }

    /**
     * @param {string} source
     * @returns {boolean}
     */
    static isGenericRubricNewsSource(source) {
        return App.genericRubricNewsSourceSet().has(String(source || '').trim());
    }

    /** Rubrics + heise magazine keys shown in the heise.de-only filter group. */
    static heiseCategoryFilterValueSet() {
        const rub = App.genericRubricCategorySet();
        return new Set([
            ...rub,
            'heise_ix',
            'heise_ct',
            'heise_foto',
            'heise_mac',
            'heise_make',
            'heise_autos'
        ]);
    }

    /**
     * Category values tied to visible filter checkboxes for the active news source.
     * @param {string} source
     * @returns {Set<string>}
     */
    static visibleCategoryValuesForSource(source) {
        const s = String(source || 'heise').trim();
        if (s === 'heise') {
            return App.heiseCategoryFilterValueSet();
        }
        if (s === 'telepolis') {
            return new Set(['telepolis']);
        }
        if (App.isGenericRubricNewsSource(s)) {
            return App.genericRubricCategorySet();
        }
        return new Set();
    }

    /** Categories used by Telepolis articles (see NewsScraper.inferCategoryTelepolis). */
    static telepolisFeedCategorySet() {
        return new Set(['telepolis', 'ki', 'wissenschaft', 'wirtschaft', 'netzpolitik', 'entertainment']);
    }

    async init() {
        try {
            // Initialize IndexedDB (single shared instance — AISummarizer must use the same DB)
            await this.storage.init();
            this.summarizer.storage = this.storage;
            this.youtubeRelated.setStorage(this.storage);
            this.youtubeRelated.setSummarizer(this.summarizer);

            // Load user settings
            await this.loadSettings();
            await this.loadArticleFlags();

            await this.applySortLabelsFromLocale();

            await this.maybeDetectDevServerRestOrigin();
            this.syncRestSameOriginCheckboxFromStorage();

            // Set up event listeners
            this.setupEventListeners();

            this.applyColorTheme();
            // Apply theme
            this.applyTheme();

            this.initHeaderBrand();

            // Initial news fetch
            await this.fetchNews();

            // Start auto-update timer
            this.startAutoUpdateTimer();

            // Initial KI-Verbindungstest (GET /v1/models oder Test-Anfrage)
            await this.testKiConnection();

            console.log('Application initialized successfully');

        } catch (error) {
            console.error('Initialization error:', error);
            this.showStatus('Fehler beim Laden der Anwendung', true);
        }
    }

    setupEventListeners() {
        // Category filters
        const categoryCheckboxes = document.querySelectorAll('.category-checkbox');
        categoryCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => this.handleCategoryChange());
        });

        if (this.elements.sortSelect) {
            this.elements.sortSelect.addEventListener('change', () => this.syncSortDateVisibility());
        }
        if (this.elements.sortApplyBtn) {
            this.elements.sortApplyBtn.addEventListener('click', () => void this.applySortPipeline({ render: true }));
        }

        const sortPanelToggle = document.getElementById('sortPanelToggle');
        if (sortPanelToggle) {
            sortPanelToggle.addEventListener('click', () => this.toggleSortPanel());
        }

        const categorySelectAllBtn = document.getElementById('categorySelectAllBtn');
        if (categorySelectAllBtn) {
            categorySelectAllBtn.addEventListener('click', () => this.setAllCategoriesChecked(true));
        }
        const categorySelectNoneBtn = document.getElementById('categorySelectNoneBtn');
        if (categorySelectNoneBtn) {
            categorySelectNoneBtn.addEventListener('click', () => this.setAllCategoriesChecked(false));
        }

        this._onDocumentVisibilityChange = () => {
            if (typeof document === 'undefined') {
                return;
            }
            if (document.visibilityState === 'hidden') {
                this._tabBecameHiddenAt = Date.now();
                return;
            }
            if (this._tabBecameHiddenAt == null) {
                return;
            }
            const hiddenMs = Date.now() - this._tabBecameHiddenAt;
            this._tabBecameHiddenAt = null;
            if (hiddenMs < 2000) {
                return;
            }
            if (this._visibilityResumeFetchTimer) {
                clearTimeout(this._visibilityResumeFetchTimer);
            }
            this._visibilityResumeFetchTimer = setTimeout(() => {
                this._visibilityResumeFetchTimer = null;
                if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
                    return;
                }
                void this.fetchNews(true);
            }, 400);
        };
        document.addEventListener('visibilitychange', this._onDocumentVisibilityChange);

        const sortRateLimitRetryBtn = document.getElementById('sortRateLimitRetryBtn');
        if (sortRateLimitRetryBtn) {
            sortRateLimitRetryBtn.addEventListener('click', () => {
                if (typeof HeiseComments !== 'undefined') {
                    HeiseComments.clearCommentCache();
                }
                void this.applySortPipeline({ render: true });
            });
        }

        // Load more button
        this.elements.loadMoreBtn.addEventListener('click', () => this.loadMoreNews());
        if (this.elements.showAllNewsBtn) {
            this.elements.showAllNewsBtn.addEventListener('click', () => this.showAllNews());
        }

        // Theme toggle
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());

        if (this.elements.colorThemeSelect) {
            this.elements.colorThemeSelect.addEventListener('change', () => void this.persistColorTheme());
        }

        // Refresh button
        this.elements.refreshBtn.addEventListener('click', () => this.fetchNews(true));

        // Batch: all summaries for current filter
        if (this.elements.summarizeAllBtn) {
            this.elements.summarizeAllBtn.addEventListener('click', () => this.summarizeAllFilteredNews({ forceRefresh: false }));
        }
        if (this.elements.summarizeAllRefreshBtn) {
            this.elements.summarizeAllRefreshBtn.addEventListener('click', () => this.confirmAndSummarizeAllRegenerate());
        }

        // KI / LM Studio modal
        this.elements.settingsBtn.addEventListener('click', () => this.openSettingsModal());
        this.elements.cancelSettings.addEventListener('click', () => this.closeSettingsModal());
        this.elements.saveSettings.addEventListener('click', () => this.saveSettings());
        if (this.elements.openKiStatsBtn) {
            this.elements.openKiStatsBtn.addEventListener('click', () => this.openKiStatsModal());
        }
        if (this.elements.cancelKiStatsBtn) {
            this.elements.cancelKiStatsBtn.addEventListener('click', () => this.closeKiStatsModal());
        }
        if (this.elements.clearKiStatsBtn) {
            this.elements.clearKiStatsBtn.addEventListener('click', () => this.confirmClearKiStats());
        }

        if (this.elements.dashboardSettingsBtn) {
            this.elements.dashboardSettingsBtn.addEventListener('click', () =>
                void this.openDashboardSettingsModal()
            );
        }
        if (this.elements.cancelDashboardSettings) {
            this.elements.cancelDashboardSettings.addEventListener('click', () =>
                this.closeDashboardSettingsModal()
            );
        }
        if (this.elements.saveDashboardSettings) {
            this.elements.saveDashboardSettings.addEventListener('click', () =>
                void this.saveDashboardSettings()
            );
        }
        if (this.elements.dashboardOpenKiLangBtn) {
            this.elements.dashboardOpenKiLangBtn.addEventListener('click', () =>
                void this.openKiLanguageFromDashboard()
            );
        }
        if (this.elements.dashboardSettingsModal) {
            this.elements.dashboardSettingsModal.addEventListener('click', (e) => {
                if (e.target === this.elements.dashboardSettingsModal) {
                    this.closeDashboardSettingsModal();
                }
            });
        }
        if (this.elements.newsSourcesFilterInput) {
            this.elements.newsSourcesFilterInput.addEventListener('input', () =>
                this.filterNewsSourcesSettingsList()
            );
        }
        if (this.elements.newsSourcesToggleVisibleBtn) {
            this.elements.newsSourcesToggleVisibleBtn.addEventListener('click', () => {
                this.toggleVisibleNewsSourcesBulk();
            });
        }

        if (this.elements.kiApiMode) {
            this.elements.kiApiMode.addEventListener('change', () => this.onKiApiModeChange());
        }
        if (this.elements.restSameOrigin) {
            this.elements.restSameOrigin.addEventListener('change', () => this.onRestSameOriginChange());
        }
        if (this.elements.apiBaseUrl) {
            this.elements.apiBaseUrl.addEventListener('input', () => this.onApiBaseUrlUserInput());
        }

        // Aktualisierungsintervall (Header)
        this.elements.refreshIntervalSelect.addEventListener('change', () => {
            this.toggleHeaderCustomIntervalVisibility();
            this.persistRefreshInterval();
        });
        this.elements.headerCustomInterval.addEventListener('change', () => this.persistRefreshInterval());

        if (this.elements.newsSourceSelect) {
            this.elements.newsSourceSelect.addEventListener('change', () => void this.onNewsSourceChange());
        }

        // YouTube button handler for all cards
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.youtube-toggle');
            if (!btn) return;
            e.preventDefault();
            const rawUrl = btn.getAttribute('data-url') || '';
            let url = '';
            try {
                url = decodeURIComponent(rawUrl).trim();
            } catch (_) {
                url = rawUrl.trim();
            }
            if (!url) return;

            // Resolve article metadata
            const card = e.target.closest('.news-card');
            const cardId = card ? card.dataset.id : '';
            let item;
            if (cardId) {
                item = this.newsItems.find((n) => n && n.id === cardId);
                if (!item) item = this.filteredNewsItems.find((n) => n && n.id === cardId);
            }
            if (!item) {
                const normUrl = App.normalizeNewsUrl(url);
                if (normUrl) {
                    item = [...this.newsItems, ...this.filteredNewsItems].find((n) => {
                        const nu = App.normalizeNewsUrl(n.url || n.link || '');
                        return nu === normUrl;
                    });
                }
            }

            const ctx = { url: item?.url || url, title: item?.title || '', description: item?.description || '' };
            void this.openYoutubeModalForArticle(ctx);
        });

        document.addEventListener('click', (e) => {
            const wbtn = e.target.closest('.article-web-search-btn');
            if (!wbtn) {
                return;
            }
            e.preventDefault();
            const card = wbtn.closest('.news-card');
            const cardId = card && card.dataset ? card.dataset.id : '';
            if (!cardId) {
                return;
            }
            const item = this.resolveNewsItemForSummary(cardId, '');
            const title = (item && item.title ? String(item.title) : '').trim();
            if (!title) {
                this.showStatus('Kein Artikeltitel für die Websuche.', true);
                return;
            }
            const surl = App.buildWebSearchUrl(title, this.getWebSearchEngine());
            if (surl) {
                window.open(surl, '_blank', 'noopener,noreferrer');
            }
        });

        document.addEventListener('click', (e) => {
            const rbtn = e.target.closest('.article-reddit-search-btn');
            if (!rbtn) {
                return;
            }
            e.preventDefault();
            const card = rbtn.closest('.news-card');
            const cardId = card && card.dataset ? card.dataset.id : '';
            if (!cardId) {
                return;
            }
            void this.searchRedditForArticle(cardId, rbtn);
        });

        // Modal close on overlay click
        this.elements.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.elements.settingsModal) {
                this.closeSettingsModal();
            }
        });
        if (this.elements.kiStatsModal) {
            this.elements.kiStatsModal.addEventListener('click', (e) => {
                if (e.target === this.elements.kiStatsModal) {
                    this.closeKiStatsModal();
                }
            });
        }

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (
                    this.elements.kiStatsModal &&
                    this.elements.kiStatsModal.classList.contains('active')
                ) {
                    this.closeKiStatsModal();
                } else if (this.elements.settingsModal.classList.contains('active')) {
                    this.closeSettingsModal();
                } else if (
                    this.elements.dashboardSettingsModal &&
                    this.elements.dashboardSettingsModal.classList.contains('active')
                ) {
                    this.closeDashboardSettingsModal();
                } else if (this.elements.youtubeModal && this.elements.youtubeModal.classList.contains('active')) {
                    this.closeYoutubeModal();
                }
            }
        });

        // YouTube modal: close on overlay click and on "Close" button
        document.addEventListener('click', (e) => {
            const refreshBtn = e.target.closest('.summary-alt-links-refresh-btn');
            if (refreshBtn) {
                e.preventDefault();
                const summaryDiv = refreshBtn.closest('.news-summary');
                if (summaryDiv) {
                    void this.refreshAlternativeLinksForCard(summaryDiv, refreshBtn);
                }
                return;
            }
            const altBtn = e.target.closest('.summary-alt-links-toggle-btn');
            if (!altBtn) {
                return;
            }
            e.preventDefault();
            const summaryDiv = altBtn.closest('.news-summary');
            const list = summaryDiv ? summaryDiv.querySelector('.summary-alt-links-list') : null;
            if (!list || list.hidden === undefined) {
                return;
            }
            const exp = altBtn.getAttribute('aria-expanded') === 'true';
            const nextExpanded = !exp;
            altBtn.setAttribute('aria-expanded', String(nextExpanded));
            list.hidden = !nextExpanded;
            altBtn.textContent = nextExpanded ? '▲' : '▼';
            altBtn.title = nextExpanded ? this._i18nAltLinksBtnHide : this._i18nAltLinksBtnShow;
            altBtn.setAttribute('aria-label', nextExpanded ? this._i18nAltLinksBtnHide : this._i18nAltLinksBtnShow);
        });

        if (this.elements.youtubeModal) {
            this.elements.youtubeModal.addEventListener('click', (e) => {
                if (e.target === this.elements.youtubeModal) {
                    this.closeYoutubeModal();
                }
            });
            const ytCloseBtn = this.elements.youtubeModal.querySelector('#youtubeCloseBtn');
            if (ytCloseBtn) {
                ytCloseBtn.addEventListener('click', () => this.closeYoutubeModal());
            }
            const ytRegenBtn = this.elements.youtubeModal.querySelector('#youtubeRegenerateBtn');
            if (ytRegenBtn) {
                ytRegenBtn.addEventListener('click', () => void this.regenerateYoutubeModalSuggestions());
            }
        }
    }

    /**
     * Inline YouTube logo SVG (placeholder thumbnails; same artwork as modal title).
     * @param {string} className
     * @returns {string}
     */
    static youtubeLogoSvgHtml(className) {
        const c = String(className || 'video-thumb__yt-logo');
        return `<svg class="${c}" viewBox="0 0 24 24" width="48" height="48" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><path fill="#FF0000" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/><path fill="#fff" d="M9.75 15.02l6.5-3.51-6.5-3.51v7.02z"/></svg>`;
    }

    /** Open YouTube-related videos modal for a given article. */
    async openYoutubeModalForArticle(ctx, options = {}) {
        const forceRefresh = options.forceRefresh === true;
        const modal = this.elements.youtubeModal;
        if (!modal) return;

        this._youtubeModalCtx = ctx;

        const container = modal.querySelector('.youtube-results');
        const loadingEl = modal.querySelector('.youtube-loading');
        const errorEl = modal.querySelector('.youtube-error');
        const closeBtn = modal.querySelector('#youtubeCloseBtn');
        const searchHint = modal.querySelector('#youtubeSearchQuery');

        // Reset UI
        container.innerHTML = '';
        if (loadingEl) loadingEl.hidden = false;
        if (errorEl) errorEl.hidden = true;
        if (searchHint) searchHint.textContent = '';

        modal.classList.add('active');
        if (!forceRefresh) {
            closeBtn?.focus();
        }

        try {
            if (forceRefresh) {
                await this.youtubeRelated.invalidate(ctx);
            }

            // Try cache first (unless regenerating)
            let entry = forceRefresh ? null : await this.youtubeRelated.getCached(ctx);
            let items = [];
            let searchQueryUsed = null;

            if (entry && Array.isArray(entry.items) && entry.items.length > 0) {
                items = entry.items;
                searchQueryUsed = entry.searchQueryUsed || null;
                const topicLab = this._i18nYoutubeTopicLabel || 'Focus:';
                if (searchHint) {
                    searchHint.textContent = `${topicLab} ${this.escapeHtml(searchQueryUsed || '—')}`;
                }
            } else {
                // KI-only: JSON suggestions + YouTube search links (no YouTube Data API)
                const result = await this.youtubeRelated.fetchAndSummarize(ctx);
                items = result.items || [];
                searchQueryUsed = result.searchQueryUsed || null;

                // Save to cache
                if (items.length > 0) {
                    await this.youtubeRelated.save(ctx, items, searchQueryUsed);
                }

                const topicLab2 = this._i18nYoutubeTopicLabel || 'Focus:';
                if (searchHint) {
                    searchHint.textContent = `${topicLab2} ${this.escapeHtml(searchQueryUsed || '—')}`;
                }
            }

            // Render results
            if (loadingEl) loadingEl.hidden = true;
            if (items.length === 0) {
                const msgEl = document.createElement('div');
                msgEl.className = 'youtube-error';
                msgEl.textContent = this._i18nYoutubeNoResults || 'No suggestions received.';
                container.appendChild(msgEl);
                return;
            }

            for (const it of items) {
                const card = this.createYoutubeVideoCard(it);
                container.appendChild(card);
            }
        } catch (e) {
            if (loadingEl) loadingEl.hidden = true;
            if (errorEl) errorEl.hidden = false;
            const raw = e.message || String(e);
            const tpl = this._i18nYoutubeError || 'Error: {error}';
            errorEl.textContent = tpl.replace('{error}', this.escapeHtml(raw));
        }
    }

    /** Re-run KI + drop cache for the article whose YouTube modal is open. */
    async regenerateYoutubeModalSuggestions() {
        const ctx = this._youtubeModalCtx;
        if (!ctx) {
            return;
        }
        await this.openYoutubeModalForArticle(ctx, { forceRefresh: true });
    }

    closeYoutubeModal() {
        const modal = this.elements.youtubeModal;
        if (!modal) return;
        modal.classList.remove('active');
        this._youtubeModalCtx = null;
    }

    createYoutubeVideoCard(it) {
        const div = document.createElement('div');
        div.className = 'youtube-video-card';
        const ph = this.escapeHtml(this._i18nYoutubeThumbPlaceholder || 'YouTube');
        const thumbHtml = it.thumbUrl
            ? `<img src="${this.escapeHtml(it.thumbUrl)}" alt="" class="video-thumb" loading="lazy">`
            : `<div class="video-thumb video-thumb--placeholder" role="img" aria-label="${ph}" title="${ph}">${App.youtubeLogoSvgHtml('video-thumb__yt-logo')}</div>`;
        const summaryText = this.escapeHtml(it.summary || '(keine Kurzbeschreibung)');
        const channelRaw = (it.channelTitle || '').trim();
        const channelHtml = channelRaw
            ? `<div class="video-channel">${this.escapeHtml(channelRaw)}</div>`
            : `<div class="video-channel video-channel--muted">${this.escapeHtml(
                  this._i18nYoutubeChannelAi || 'Search suggestion (AI)'
              )}</div>`;
        const linkAria = this.escapeHtml(this._i18nYoutubeLinkSearch || 'Search on YouTube');
        const titleEsc = this.escapeHtml(it.title);
        div.innerHTML = `
            <div class="video-row">
                ${thumbHtml}
                <div class="video-info">
                    <a href="${this.escapeHtml(it.watchUrl)}" target="_blank" rel="noopener noreferrer" class="video-title" aria-label="${linkAria}: ${titleEsc}">${titleEsc}</a>
                    ${channelHtml}
                    <p class="video-summary">${summaryText}</p>
                </div>
            </div>
        `;
        return div;
    }

    /** Show YouTube modal (deprecated: use openYoutubeModalForArticle). */
    showYoutubeModal() {
        const modal = this.elements.youtubeModal;
        if (modal) modal.classList.add('active');
    }

    /**
     * If this page is served by scripts/dev_server.py, GET /.well-known/lmstudio-dev-server returns 200.
     * Then enable REST same-origin so fetch targets this host (no OPTIONS to LM Studio on :1234).
     * Skips if the user explicitly saved "REST über dieselbe Origin" off (manual + '0').
     */
    async maybeDetectDevServerRestOrigin() {
        if (typeof window === 'undefined' || !window.location?.origin) {
            return;
        }
        if (window.location.protocol === 'file:') {
            return;
        }
        try {
            if (
                localStorage.getItem('heise_rest_same_origin_manual') === '1' &&
                localStorage.getItem('heise_rest_same_origin') === '0'
            ) {
                return;
            }
        } catch (_) {
            /* ignore */
        }

        const ctrl = new AbortController();
        const t = window.setTimeout(() => ctrl.abort(), 4000);
        try {
            const url = `${window.location.origin}/.well-known/lmstudio-dev-server`;
            const r = await fetch(url, { method: 'GET', cache: 'no-store', signal: ctrl.signal });
            if (!r.ok) {
                return;
            }
        } catch (_) {
            return;
        } finally {
            window.clearTimeout(t);
        }

        try {
            localStorage.setItem('heise_rest_same_origin', '1');
        } catch (_) {
            /* ignore */
        }

        this.settings = {
            ...(this.settings || {}),
            restSameOrigin: true
        };

        try {
            await this.storage.saveSettings(this.settings);
        } catch (e) {
            console.warn('Dev-Server-Erkennung: IndexedDB speichern fehlgeschlagen:', e);
        }

        console.info(
            'Heise Dashboard: dev_server erkannt — REST nutzt dieselbe Origin (kein OPTIONS an LM Studio).'
        );
    }

    syncRestSameOriginCheckboxFromStorage() {
        if (!this.elements.restSameOrigin) {
            return;
        }
        try {
            this.elements.restSameOrigin.checked = localStorage.getItem('heise_rest_same_origin') === '1';
        } catch (_) {
            /* ignore */
        }
    }

    /**
     * @returns {string}
     */
    /**
     * @param {string} [raw]
     * @returns {string}
     */
    normalizeNewsSource(raw) {
        return App.normalizeNewsSourceWithEnabled(raw, this.getEnabledNewsSourceIds());
    }

    /** @returns {string[]} Enabled source ids in catalog order (for dropdown and filters). */
    getEnabledNewsSourceIds() {
        if (!this.settings) {
            return App.newsCatalogIds();
        }
        return App.normalizeEnabledNewsSourcesArray(this.settings.enabledNewsSources);
    }

    getBrandLogoUrl() {
        const s = this.settings && this.settings.newsSource;
        switch (s) {
            case 'golem':
                return GOLEM_BRAND_LOGO_URL;
            case 'computerbase':
                return COMPUTERBASE_BRAND_LOGO_URL;
            case 't3n':
                return T3N_BRAND_LOGO_URL;
            case 'verge':
                return VERGE_BRAND_LOGO_URL;
            case 'telepolis':
                return TELEPOLIS_BRAND_LOGO_URL;
            case 'it_administrator':
                return IT_ADMINISTRATOR_BRAND_LOGO_URL;
            default:
                return HEISE_BRAND_LOGO_URL;
        }
    }

    refreshHeaderBrandToggleLabels() {
        const btn = this.elements.headerBrandToggle;
        if (!btn) {
            return;
        }
        if (this._headerBrandMode !== 'logo' && this._headerBrandMode !== 'text') {
            return;
        }
        btn.setAttribute('aria-pressed', this._headerBrandMode === 'logo' ? 'true' : 'false');
    }

    initHeaderBrand() {
        const logo = this.elements.heiseBrandLogo;
        const textEl = this.elements.headerBrandText;
        const btn = this.elements.headerBrandToggle;
        if (!logo || !textEl || !btn) {
            return;
        }

        this._headerBrandMode = this.settings?.headerBrandMode === 'text' ? 'text' : 'logo';
        if (this._i18nHeaderLogoAlt) {
            logo.alt = this._i18nHeaderLogoAlt;
        }

        const onLogoLoad = () => {
            if (this._headerBrandMode === 'logo') {
                logo.hidden = false;
                textEl.hidden = true;
            }
            this.refreshHeaderBrandToggleLabels();
        };

        const onLogoError = () => {
            console.warn('Heise header logo could not be loaded.');
            if (this._headerBrandMode === 'text') {
                return;
            }
            this._headerBrandMode = 'text';
            if (this.settings) {
                this.settings.headerBrandMode = 'text';
            }
            void this.persistHeaderBrandMode();
            logo.hidden = true;
            textEl.hidden = false;
            this.applyHeaderBrandMode('text');
            this.scheduleHeaderBrandTextFit();
        };

        logo.addEventListener('load', onLogoLoad);
        logo.addEventListener('error', onLogoError);

        logo.src = this.getBrandLogoUrl();

        if (logo.complete && logo.naturalWidth > 0) {
            onLogoLoad();
        }

        btn.addEventListener('click', () => void this.toggleHeaderBrandMode());

        this._onHeaderBrandWindowResize = () => this.scheduleHeaderBrandTextFit();
        window.addEventListener('resize', this._onHeaderBrandWindowResize);

        if (typeof ResizeObserver !== 'undefined') {
            this._headerBrandResizeObserver = new ResizeObserver(() => this.scheduleHeaderBrandTextFit());
            this._headerBrandResizeObserver.observe(btn);
        }

        this.applyHeaderBrandMode(this._headerBrandMode);
        this.scheduleHeaderBrandTextFit();
    }

    scheduleHeaderBrandTextFit() {
        if (this._fitHeaderBrandRaf) {
            return;
        }
        this._fitHeaderBrandRaf = requestAnimationFrame(() => {
            this._fitHeaderBrandRaf = 0;
            this.fitHeaderBrandText();
        });
    }

    fitHeaderBrandText() {
        const textEl = this.elements.headerBrandText;
        const btn = this.elements.headerBrandToggle;
        if (!textEl || !btn || this._headerBrandMode !== 'text') {
            return;
        }
        if (textEl.hidden) {
            return;
        }

        const maxRem = 1.85;
        const minRem = 0.55;
        let rem = maxRem;
        textEl.style.fontSize = `${rem}rem`;

        let guard = 0;
        while (textEl.scrollWidth > btn.clientWidth && rem > minRem && guard < 80) {
            rem -= 0.05;
            textEl.style.fontSize = `${rem}rem`;
            guard += 1;
        }
    }

    applyHeaderBrandMode(mode) {
        const logo = this.elements.heiseBrandLogo;
        const textEl = this.elements.headerBrandText;
        const btn = this.elements.headerBrandToggle;
        if (!logo || !textEl || !btn) {
            return;
        }

        const m = mode === 'text' ? 'text' : 'logo';
        if (m === 'text') {
            textEl.style.fontSize = '';
            logo.hidden = true;
            textEl.hidden = false;
            this.refreshHeaderBrandToggleLabels();
            return;
        }
        const ok = logo.complete && logo.naturalWidth > 0;
        const failed = logo.complete && logo.naturalWidth === 0;
        if (failed) {
            textEl.hidden = false;
            logo.hidden = true;
            this.scheduleHeaderBrandTextFit();
            this.refreshHeaderBrandToggleLabels();
            return;
        }
        if (!ok) {
            textEl.hidden = false;
            logo.hidden = true;
            this.scheduleHeaderBrandTextFit();
        } else {
            textEl.hidden = true;
            logo.hidden = false;
        }
        this.refreshHeaderBrandToggleLabels();
    }

    async toggleHeaderBrandMode() {
        this._headerBrandMode = this._headerBrandMode === 'logo' ? 'text' : 'logo';
        if (this._headerBrandMode === 'logo') {
            const lg = this.elements.heiseBrandLogo;
            if (lg && lg.complete && lg.naturalWidth === 0) {
                const bust = `${this.getBrandLogoUrl()}?_=t${Date.now()}`;
                lg.removeAttribute('src');
                lg.src = bust;
            }
        }
        if (this.settings) {
            this.settings.headerBrandMode = this._headerBrandMode;
        }
        this.applyHeaderBrandMode(this._headerBrandMode);
        await this.persistHeaderBrandMode();
        if (this._headerBrandMode === 'text') {
            this.scheduleHeaderBrandTextFit();
        }
    }

    async persistHeaderBrandMode() {
        try {
            await this.storage.saveSettings({ headerBrandMode: this._headerBrandMode });
            if (this.settings) {
                this.settings.headerBrandMode = this._headerBrandMode;
            }
        } catch (e) {
            console.warn('persistHeaderBrandMode:', e);
        }
    }

    async loadSettings() {
        try {
            const settings = await this.storage.getSettings();

            // Category filter schema migration (new heise magazine + telepolis keys)
            let selCats = Array.isArray(settings.selectedCategories) ? [...settings.selectedCategories] : [];
            let categorySchemaVer = Number(settings.categoryFilterSchemaVersion) || 0;
            if (categorySchemaVer < 2) {
                const add = [
                    'heise_ix',
                    'heise_ct',
                    'heise_foto',
                    'heise_mac',
                    'heise_make',
                    'heise_autos',
                    'telepolis'
                ];
                for (const a of add) {
                    if (!selCats.includes(a)) {
                        selCats.push(a);
                    }
                }
                categorySchemaVer = 2;
                try {
                    await this.storage.saveSettings({
                        selectedCategories: selCats,
                        categoryFilterSchemaVersion: categorySchemaVer
                    });
                } catch (e) {
                    console.warn('categoryFilterSchema migration:', e);
                }
            }
            settings.selectedCategories = selCats;

            const apiNorm = AISummarizer.normalizeOpenAiApiBase(settings.apiBaseUrl || '');
            let lmRestRoot = AISummarizer.normalizeLmRestServerRoot(settings.lmRestRoot || '');
            const derivedRest = AISummarizer.normalizeLmRestServerRoot(settings.apiBaseUrl || '');
            const apiDefault = 'http://127.0.0.1:1234/v1';
            const restDefault = 'http://127.0.0.1:1234';
            if (
                settings.apiBaseUrl &&
                settings.apiBaseUrl !== apiDefault &&
                lmRestRoot === restDefault
            ) {
                lmRestRoot = derivedRest;
            }

            const kiMode = settings.kiApiMode === 'openai' ? 'openai' : 'lm_rest_v1';

            let newsSrcCatalogVer = Number(settings.newsSourcesCatalogMigrationVersion);
            if (!Number.isFinite(newsSrcCatalogVer)) {
                newsSrcCatalogVer = 0;
            }
            let enabledOrdered = App.normalizeEnabledNewsSourcesArray(settings.enabledNewsSources);
            // v2: ensure Telepolis is in the enabled list once (v1 could leave legacy DBs without it).
            if (newsSrcCatalogVer < 2) {
                const catalog = App.newsCatalogIds();
                const set = new Set(enabledOrdered);
                if (catalog.includes('telepolis')) {
                    set.add('telepolis');
                }
                enabledOrdered = catalog.filter((id) => set.has(id));
                newsSrcCatalogVer = 2;
                try {
                    await this.storage.saveSettings({
                        enabledNewsSources: enabledOrdered,
                        newsSourcesCatalogMigrationVersion: 2
                    });
                } catch (e) {
                    console.warn('newsSourcesCatalogMigration v2:', e);
                }
            }
            // v3: ensure IT-Administrator is in the enabled list once (new catalog entry).
            if (newsSrcCatalogVer < 3) {
                const catalog = App.newsCatalogIds();
                const set = new Set(enabledOrdered);
                if (catalog.includes('it_administrator')) {
                    set.add('it_administrator');
                }
                enabledOrdered = catalog.filter((id) => set.has(id));
                newsSrcCatalogVer = 3;
                try {
                    await this.storage.saveSettings({
                        enabledNewsSources: enabledOrdered,
                        newsSourcesCatalogMigrationVersion: 3
                    });
                } catch (e) {
                    console.warn('newsSourcesCatalogMigration v3:', e);
                }
            }
            const newsSource = App.normalizeNewsSourceWithEnabled(settings.newsSource, enabledOrdered);
            const summaryLangMode = settings.summaryLangMode === 'browser' ? 'browser' : 'site';

            const reasoningStored = AISummarizer.normalizeLmReasoningParam(settings.reasoning);

            let alternativeLinksCount = 5;
            if (settings.alternativeLinksCount != null && settings.alternativeLinksCount !== '') {
                const a = parseInt(String(settings.alternativeLinksCount), 10);
                if (Number.isFinite(a) && a >= 0 && a <= 15) {
                    alternativeLinksCount = a;
                }
            }

            const webSearchEngine = App.normalizeWebSearchEngine(settings.webSearchEngine);
            const alternativeLinksDisplayMode = App.normalizeAlternativeLinksDisplayMode(
                settings.alternativeLinksDisplayMode
            );
            const alternativeLinksDomainBlacklist = App.normalizeAlternativeLinksDomainBlacklist(
                settings.alternativeLinksDomainBlacklist
            );

            const summaryConcurrency = App.normalizeSummaryConcurrency(settings.summaryConcurrency);
            const summaryRequestTimeoutSeconds = App.normalizeKiRequestTimeoutSeconds(
                settings.summaryRequestTimeoutSeconds
            );

            let enabledHeiseMagazines = App.normalizeEnabledHeiseMagazines(settings.enabledHeiseMagazines);
            if (enabledHeiseMagazines.length === 0) {
                try {
                    const rawM = localStorage.getItem('heise_enabled_magazine_feeds');
                    if (rawM) {
                        enabledHeiseMagazines = App.normalizeEnabledHeiseMagazines(JSON.parse(rawM));
                    }
                } catch (_) {
                    /* ignore */
                }
            }

            this.settings = {
                ...settings,
                apiBaseUrl: apiNorm,
                lmRestRoot,
                kiApiMode: kiMode,
                restSameOrigin: settings.restSameOrigin === true || settings.restSameOrigin === 'true',
                headerBrandMode: settings.headerBrandMode === 'text' ? 'text' : 'logo',
                enabledNewsSources: enabledOrdered,
                newsSource,
                summaryLangMode,
                reasoning: reasoningStored,
                alternativeLinksCount,
                alternativeLinksDisplayMode,
                alternativeLinksDomainBlacklist,
                webSearchEngine,
                enabledHeiseMagazines,
                summaryConcurrency,
                summaryRequestTimeoutSeconds,
                categoryFilterSchemaVersion: categorySchemaVer,
                newsSourcesCatalogMigrationVersion: newsSrcCatalogVer
            };

            try {
                localStorage.setItem('heise_enabled_news_sources', JSON.stringify(enabledOrdered));
                localStorage.setItem('heise_summary_lang_mode', summaryLangMode);
                localStorage.setItem('heise_alternative_links_blacklist', alternativeLinksDomainBlacklist);
                localStorage.setItem('heise_enabled_magazine_feeds', JSON.stringify(enabledHeiseMagazines));
            } catch (_) {
                /* ignore */
            }
            App.syncHeiseMagazineFeedMirror(enabledHeiseMagazines);

            let colorTheme = App.normalizeColorTheme(settings.colorTheme);
            try {
                const lsCt = localStorage.getItem('heise_color_theme');
                if (lsCt && COLOR_THEME_IDS.includes(lsCt)) {
                    colorTheme = lsCt;
                }
            } catch (_) {
                /* ignore */
            }
            this.settings.colorTheme = colorTheme;
            try {
                localStorage.setItem('heise_color_theme', colorTheme);
            } catch (_) {
                /* ignore */
            }

            this.scraper.configureSource(this.settings.newsSource);
            try {
                localStorage.setItem('heise_news_source', this.settings.newsSource);
            } catch (_) {
                /* ignore */
            }
            if (typeof window !== 'undefined') {
                window.__newsSource = this.settings.newsSource;
            }

            // KI: IndexedDB → localStorage (AISummarizer liest localStorage)
            try {
                localStorage.setItem('heise_api_base', apiNorm);
                localStorage.setItem('heise_lm_rest_root', lmRestRoot);
                localStorage.setItem('heise_ki_api_mode', kiMode);
                localStorage.setItem('heise_lm_api_token', settings.lmApiToken || '');
                localStorage.setItem(
                    'heise_rest_same_origin',
                    settings.restSameOrigin === true || settings.restSameOrigin === 'true' ? '1' : '0'
                );
            } catch (_) {
                /* ignore */
            }
            if (settings.lmModel !== undefined && settings.lmModel !== null) {
                try {
                    localStorage.setItem('heise_lm_model', settings.lmModel || '');
                } catch (_) {
                    /* ignore */
                }
            }

            let summaryCacheDays = 14;
            if (settings.summaryCacheDays != null && settings.summaryCacheDays !== '') {
                const p = parseInt(String(settings.summaryCacheDays), 10);
                if (Number.isFinite(p) && p >= 0 && p <= 3650) {
                    summaryCacheDays = p;
                }
            }
            try {
                localStorage.setItem('heise_summary_cache_days', String(summaryCacheDays));
                localStorage.setItem('heise_summary_concurrency', String(summaryConcurrency));
                localStorage.setItem('heise_ki_request_timeout_sec', String(summaryRequestTimeoutSeconds));
                localStorage.setItem('heise_reasoning', reasoningStored);
                localStorage.setItem('heise_alternative_links_count', String(alternativeLinksCount));
                localStorage.setItem('heise_web_search_engine', webSearchEngine);
                localStorage.setItem('heise_alternative_links_display_mode', alternativeLinksDisplayMode);
            } catch (_) {
                /* ignore */
            }

            this.syncHeaderIntervalFromSettings();
            this.syncSortUIFromSettings();

            this.rebuildNewsSourceSelect();
            if (this.elements.newsSourceSelect) {
                this.elements.newsSourceSelect.value = this.settings.newsSource;
            }
            if (this.elements.colorThemeSelect) {
                this.elements.colorThemeSelect.value = this.settings.colorTheme;
            }
            if (this.elements.summaryLangMode) {
                this.elements.summaryLangMode.value = summaryLangMode;
            }

            this.selectedCategories = Array.isArray(this.settings.selectedCategories)
                ? [...this.settings.selectedCategories]
                : [];
            document.querySelectorAll('.category-checkbox').forEach((checkbox) => {
                checkbox.checked = this.selectedCategories.includes(checkbox.value);
            });
            this.syncCategoryFiltersVisibility();
            this.ensureDefaultCategorySelectionForSource();
            this.settings.selectedCategories = this.selectedCategories;
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    /**
     * @param {unknown} raw
     * @returns {string}
     */
    static normalizeColorTheme(raw) {
        const s = String(raw || '').trim();
        return COLOR_THEME_IDS.includes(s) ? s : 'slate';
    }

    /** @param {unknown} raw */
    static normalizeWebSearchEngine(raw) {
        const s = String(raw || 'duckduckgo').trim().toLowerCase();
        return s === 'google' || s === 'bing' || s === 'duckduckgo' ? s : 'duckduckgo';
    }

    /** @param {unknown} raw */
    static normalizeAlternativeLinksDisplayMode(raw) {
        const s = String(raw || 'expanded').trim().toLowerCase();
        return s === 'collapsed' ? 'collapsed' : 'expanded';
    }

    /**
     * Parallel AI summary jobs for batch + auto-summarize (clamped 1–16).
     * Pass `settings.summaryConcurrency`, not the whole settings object.
     * @param {unknown} raw
     * @returns {number}
     */
    static normalizeSummaryConcurrency(raw) {
        const d = 4;
        if (raw == null || raw === '') {
            return d;
        }
        const n = parseInt(String(raw), 10);
        if (!Number.isFinite(n)) {
            return d;
        }
        return Math.min(16, Math.max(1, n));
    }

    /**
     * HTTP timeout for one KI request chain (seconds), clamped 15–3600. Default 120.
     * @param {unknown} raw
     * @returns {number}
     */
    static normalizeKiRequestTimeoutSeconds(raw) {
        const d = 120;
        if (raw == null || raw === '') {
            return d;
        }
        const n = parseInt(String(raw), 10);
        if (!Number.isFinite(n)) {
            return d;
        }
        return Math.min(3600, Math.max(15, n));
    }

    /**
     * Run async work on items with at most `limit` concurrent executions.
     * @template T
     * @param {T[]} items
     * @param {number} limit
     * @param {(item: T, index: number) => Promise<void>} fn
     */
    static async runWithConcurrency(items, limit, fn) {
        const len = items.length;
        if (len === 0) {
            return;
        }
        const cap = Math.min(Math.max(1, Math.floor(limit || 1)), len);
        let nextIndex = 0;

        async function worker() {
            while (true) {
                const i = nextIndex;
                nextIndex += 1;
                if (i >= len) {
                    return;
                }
                await fn(items[i], i);
            }
        }

        await Promise.all(Array.from({ length: cap }, () => worker()));
    }

    /**
     * Brief yield so the main thread can paint. In a background tab,
     * `requestAnimationFrame` is suspended (Chrome, Safari, Edge), which would
     * otherwise block parallel KI workers until the user focuses the tab again.
     * @returns {Promise<void>}
     */
    static yieldForUiCooperation() {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
            return new Promise((r) => setTimeout(r, 0));
        }
        return new Promise((r) => {
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(() => r());
            } else {
                setTimeout(r, 0);
            }
        });
    }

    /**
     * @param {unknown} raw
     * @returns {string[]}
     */
    static normalizeEnabledHeiseMagazines(raw) {
        const NS = typeof window !== 'undefined' ? window.NewsScraper : typeof NewsScraper !== 'undefined' ? NewsScraper : null;
        if (NS && NS.normalizeHeiseMagazineFeedIds) {
            return NS.normalizeHeiseMagazineFeedIds(raw);
        }
        return [];
    }

    /**
     * Feed defs for dashboard checkboxes (must match `NewsScraper.heiseMagazineFeedDefs`).
     * @returns {readonly { id: string, url: string, category: string }[]}
     */
    static getHeiseMagazineFeedDefsForUi() {
        const NS = typeof window !== 'undefined' ? window.NewsScraper : typeof NewsScraper !== 'undefined' ? NewsScraper : null;
        if (NS && typeof NS.heiseMagazineFeedDefs === 'function') {
            try {
                return NS.heiseMagazineFeedDefs();
            } catch (_) {
                /* fall through */
            }
        }
        return [
            { id: 'ix', url: 'https://www.heise.de/ix/feed.xml', category: 'heise_ix' },
            { id: 'ct', url: 'https://www.heise.de/ct/feed.xml', category: 'heise_ct' },
            { id: 'foto', url: 'https://www.heise.de/foto/feed.xml', category: 'heise_foto' },
            { id: 'mac-and-i', url: 'https://www.heise.de/mac-and-i/feed.xml', category: 'heise_mac' },
            { id: 'make', url: 'https://www.heise.de/make/feed.xml', category: 'heise_make' },
            { id: 'autos', url: 'https://www.heise.de/autos/feed.xml', category: 'heise_autos' }
        ];
    }

    /**
     * NewsScraper reads magazine ids from `window` first (reliable); keep in sync with IndexedDB / settings.
     * @param {unknown} raw
     */
    static syncHeiseMagazineFeedMirror(raw) {
        const ids = App.normalizeEnabledHeiseMagazines(raw);
        if (typeof window !== 'undefined') {
            window.__heiseEnabledMagazineFeeds = ids.slice();
        }
    }

    /**
     * Normalizes user-defined alternative-link domain blacklist.
     * Accepts newline/comma/semicolon separated entries, hostnames or full URLs.
     * @param {unknown} raw
     * @returns {string} newline-separated hostnames (deduplicated)
     */
    static normalizeAlternativeLinksDomainBlacklist(raw) {
        const src = String(raw || '');
        if (!src.trim()) {
            return '';
        }
        const out = [];
        const seen = new Set();
        const parts = src.split(/[\n,;]+/);
        for (const part of parts) {
            const token = String(part || '').trim();
            if (!token) {
                continue;
            }
            let host = token;
            try {
                const probe = token.includes('://') ? token : `https://${token}`;
                host = new URL(probe).hostname;
            } catch (_) {
                host = token;
            }
            host = host.toLowerCase();
            if (host.startsWith('*.')) {
                host = host.slice(2);
            }
            if (host.startsWith('www.')) {
                host = host.slice(4);
            }
            host = host.replace(/\.$/, '');
            if (!/^[a-z0-9.-]+$/.test(host) || !host.includes('.')) {
                continue;
            }
            if (!seen.has(host)) {
                seen.add(host);
                out.push(host);
            }
        }
        return out.join('\n');
    }

    /**
     * @param {unknown} raw
     * @returns {string[]}
     */
    static parseAlternativeLinksDomainBlacklist(raw) {
        const normalized = App.normalizeAlternativeLinksDomainBlacklist(raw);
        return normalized ? normalized.split('\n') : [];
    }

    /**
     * Favicon URL for a news article link (Google s2; CSP allows https images).
     * @param {string} url
     * @returns {string}
     */
    static faviconUrlForArticleLink(url) {
        try {
            const h = new URL(url).hostname;
            return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=32`;
        } catch {
            return '';
        }
    }

    /** Reddit favicon (CDN, used next to thread titles). */
    static redditFaviconUrl() {
        return 'https://www.redditstatic.com/desktop2x/img/favicon/favicon-32x32.png';
    }

    /**
     * Open search engine results for a news headline (article title).
     * @param {string} query
     * @param {string} engineId duckduckgo | google | bing
     * @returns {string}
     */
    static buildWebSearchUrl(query, engineId) {
        const q = String(query || '').trim();
        if (!q) {
            return '';
        }
        const enc = encodeURIComponent(q);
        const e = App.normalizeWebSearchEngine(engineId);
        if (e === 'google') {
            return `https://www.google.com/search?q=${enc}&ie=UTF-8`;
        }
        if (e === 'bing') {
            return `https://www.bing.com/search?q=${enc}`;
        }
        return `https://duckduckgo.com/?q=${enc}`;
    }

    /** @returns {'duckduckgo'|'google'|'bing'} */
    getWebSearchEngine() {
        let e = 'duckduckgo';
        try {
            e =
                localStorage.getItem('heise_web_search_engine') ||
                (this.settings && this.settings.webSearchEngine) ||
                'duckduckgo';
        } catch (_) {
            /* ignore */
        }
        return App.normalizeWebSearchEngine(e);
    }

    /** Apply `data-color-theme` on `<html>` (accent colors + header gradient). */
    applyColorTheme() {
        const id = App.normalizeColorTheme(this.settings?.colorTheme);
        if (this.settings) {
            this.settings.colorTheme = id;
        }
        document.documentElement.setAttribute('data-color-theme', id);
        if (this.elements.colorThemeSelect) {
            this.elements.colorThemeSelect.value = id;
        }
    }

    async persistColorTheme() {
        const sel = this.elements.colorThemeSelect;
        if (!sel) {
            return;
        }
        const id = App.normalizeColorTheme(sel.value);
        sel.value = id;
        document.documentElement.setAttribute('data-color-theme', id);
        if (this.settings) {
            this.settings.colorTheme = id;
        }
        try {
            localStorage.setItem('heise_color_theme', id);
        } catch (e) {
            console.warn('localStorage:', e);
        }
        try {
            await this.storage.saveSettings({ colorTheme: id });
        } catch (e) {
            console.warn('persistColorTheme:', e);
        }
    }

    /**
     * Local calendar day bounds for `<input type="date">` value `YYYY-MM-DD`.
     * @param {string} dateStr
     * @returns {{ start: number, end: number }}
     */
    static getLocalDayBounds(dateStr) {
        const parts = String(dateStr || '')
            .trim()
            .split('-')
            .map((x) => parseInt(x, 10));
        if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
            return { start: 0, end: 0 };
        }
        const [y, m, d] = parts;
        const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
        const end = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
        return { start, end };
    }

    /**
     * Apply `locales/de.json` or `locales/en.json` strings to the sort UI (html lang).
     */
    async applySortLabelsFromLocale() {
        const lang =
            document.documentElement && String(document.documentElement.lang).toLowerCase().startsWith('en')
                ? 'en'
                : 'de';
        try {
            const r = await fetch(`locales/${lang}.json`, { cache: 'no-store' });
            if (!r.ok) {
                return;
            }
            const data = await r.json();
            const s = data.sort;
            if (s) {
            const h2 = document.getElementById('sort-heading');
            if (h2 && s.heading) {
                h2.textContent = s.heading;
            }
            const lm = document.querySelector('label[for="sortSelect"]');
            if (lm && s.label_mode) {
                lm.textContent = s.label_mode;
            }
            const ld = document.querySelector('label[for="sortDateSingle"]');
            if (ld && s.label_date) {
                ld.textContent = s.label_date;
            }
            const lf = document.querySelector('label[for="sortDateFrom"]');
            if (lf && s.label_from) {
                lf.textContent = s.label_from;
            }
            const lt = document.querySelector('label[for="sortDateTo"]');
            if (lt && s.label_to) {
                lt.textContent = s.label_to;
            }
            const hint = document.getElementById('sort-hint');
            if (hint && s.hint) {
                hint.textContent = s.hint;
            }
            const btn = document.getElementById('sortApplyBtn');
            if (btn && s.apply) {
                btn.textContent = s.apply;
            }
            const sortToggle = document.getElementById('sortPanelToggle');
            if (sortToggle && s.toggle_title) {
                sortToggle.setAttribute('title', s.toggle_title);
                sortToggle.setAttribute('aria-label', s.toggle_title);
            }
            const sel = document.getElementById('sortSelect');
            const optMap = s.options || {};
            if (sel && optMap) {
                const keys = [
                    'recency',
                    'favorites_first',
                    'favorites_only',
                    'hidden_only',
                    'date_day',
                    'date_range',
                    'comments',
                    'green',
                    'red'
                ];
                const opts = sel.querySelectorAll('option');
                keys.forEach((k, i) => {
                    if (opts[i] && optMap[k]) {
                        opts[i].textContent = optMap[k];
                    }
                });
            }
            const srb = document.getElementById('sortRateLimitBannerText');
            if (srb && s.rate_limit_banner) {
                srb.textContent = s.rate_limit_banner;
            }
            const srr = document.getElementById('sortRateLimitRetryBtn');
            if (srr && s.rate_limit_retry) {
                srr.textContent = s.rate_limit_retry;
            }
            }

            const filtersLoc = data.filters;
            if (filtersLoc) {
                const fh = document.getElementById('filter-heading');
                if (fh && filtersLoc.categories_heading) {
                    fh.textContent = filtersLoc.categories_heading;
                }
                const allBtn = document.getElementById('categorySelectAllBtn');
                if (allBtn && filtersLoc.select_all) {
                    allBtn.textContent = filtersLoc.select_all;
                }
                if (allBtn && filtersLoc.select_all_title) {
                    allBtn.setAttribute('title', filtersLoc.select_all_title);
                    allBtn.setAttribute('aria-label', filtersLoc.select_all_title);
                }
                const noneBtn = document.getElementById('categorySelectNoneBtn');
                if (noneBtn && filtersLoc.select_none) {
                    noneBtn.textContent = filtersLoc.select_none;
                }
                if (noneBtn && filtersLoc.select_none_title) {
                    noneBtn.setAttribute('title', filtersLoc.select_none_title);
                    noneBtn.setAttribute('aria-label', filtersLoc.select_none_title);
                }
                document.querySelectorAll('.category-checkbox').forEach((cb) => {
                    const val = String(cb.value || '').trim();
                    if (!val) {
                        return;
                    }
                    const k = `cat_${val.replace(/[^a-z0-9_]/gi, '_')}`;
                    const text = filtersLoc[k];
                    if (text && cb.id) {
                        const lab = document.querySelector(`label[for="${cb.id}"]`);
                        if (lab) {
                            lab.textContent = text;
                        }
                    }
                });
                const magH = document.getElementById('categoryFiltersMagazineHeading');
                if (magH && filtersLoc.magazines_row_label) {
                    magH.textContent = filtersLoc.magazines_row_label;
                }
            }

            const batch = data.batch;
            if (batch) {
                if (batch.confirm_regenerate) {
                    this._i18nBatchConfirm = batch.confirm_regenerate;
                }
                const allBtn = document.getElementById('summarizeAllBtn');
                if (allBtn && batch.btn_all) {
                    allBtn.textContent = batch.btn_all;
                }
                if (allBtn && batch.btn_all_title) {
                    allBtn.setAttribute('title', batch.btn_all_title);
                }
                const refBtn = document.getElementById('summarizeAllRefreshBtn');
                if (refBtn && batch.btn_regenerate) {
                    refBtn.textContent = batch.btn_regenerate;
                }
                if (refBtn && batch.btn_regenerate_title) {
                    refBtn.setAttribute('title', batch.btn_regenerate_title);
                    refBtn.setAttribute('aria-label', batch.btn_regenerate_title);
                }
            }

            const newsLoc = data.news;
            if (newsLoc) {
                if (newsLoc.new_badge) {
                    this._i18nNewsBadge = newsLoc.new_badge;
                }
                if (newsLoc.status_new) {
                    this._i18nStatusNew = newsLoc.status_new;
                }
                if (newsLoc.aria_new) {
                    this._i18nNewsAria = newsLoc.aria_new;
                }
                if (newsLoc.auto_summary_new_ok) {
                    this._i18nNewsAutoSummaryOk = newsLoc.auto_summary_new_ok;
                }
                if (newsLoc.auto_summary_new_mixed) {
                    this._i18nNewsAutoSummaryMixed = newsLoc.auto_summary_new_mixed;
                }
                if (newsLoc.alt_links_count) {
                    this._i18nAltLinksCount = newsLoc.alt_links_count;
                }
                if (newsLoc.alt_links_btn_show) {
                    this._i18nAltLinksBtnShow = newsLoc.alt_links_btn_show;
                }
                if (newsLoc.alt_links_btn_hide) {
                    this._i18nAltLinksBtnHide = newsLoc.alt_links_btn_hide;
                }
                if (newsLoc.alt_links_refresh) {
                    this._i18nAltLinksRefresh = newsLoc.alt_links_refresh;
                }
                if (newsLoc.alt_links_refresh_done) {
                    this._i18nAltLinksRefreshDone = newsLoc.alt_links_refresh_done;
                }
                if (newsLoc.alt_links_err_no_url) {
                    this._i18nAltLinksErrNoUrl = newsLoc.alt_links_err_no_url;
                }
                if (newsLoc.alt_links_err_no_summary) {
                    this._i18nAltLinksErrNoSummary = newsLoc.alt_links_err_no_summary;
                }
                if (newsLoc.alt_links_refresh_none) {
                    this._i18nAltLinksRefreshNone = newsLoc.alt_links_refresh_none;
                }
                if (newsLoc.web_search_btn) {
                    this._i18nWebSearchBtn = newsLoc.web_search_btn;
                }
                if (newsLoc.web_search_title) {
                    this._i18nWebSearchTitle = newsLoc.web_search_title;
                }
                if (newsLoc.reddit_search_btn) {
                    this._i18nRedditSearchBtn = newsLoc.reddit_search_btn;
                }
                if (newsLoc.reddit_search_title) {
                    this._i18nRedditSearchTitle = newsLoc.reddit_search_title;
                }
                if (newsLoc.reddit_none) {
                    this._i18nRedditNone = newsLoc.reddit_none;
                }
                if (newsLoc.reddit_error) {
                    this._i18nRedditError = newsLoc.reddit_error;
                }
                if (newsLoc.reddit_no_title) {
                    this._i18nRedditNoTitle = newsLoc.reddit_no_title;
                }
                if (newsLoc.reddit_found) {
                    this._i18nRedditFound = newsLoc.reddit_found;
                }
                if (newsLoc.reddit_found_ai) {
                    this._i18nRedditFoundAi = newsLoc.reddit_found_ai;
                }
                if (newsLoc.news_count_loaded) {
                    this._i18nNewsCountLoaded = newsLoc.news_count_loaded;
                }
                if (newsLoc.load_more_btn && this.elements.loadMoreBtn) {
                    this.elements.loadMoreBtn.textContent = newsLoc.load_more_btn;
                }
                if (newsLoc.load_more_title && this.elements.loadMoreBtn) {
                    this.elements.loadMoreBtn.setAttribute('title', newsLoc.load_more_title);
                    this.elements.loadMoreBtn.setAttribute('aria-label', newsLoc.load_more_title);
                }
                if (newsLoc.show_all_btn && this.elements.showAllNewsBtn) {
                    this.elements.showAllNewsBtn.textContent = newsLoc.show_all_btn;
                }
                if (newsLoc.show_all_title && this.elements.showAllNewsBtn) {
                    this.elements.showAllNewsBtn.setAttribute('title', newsLoc.show_all_title);
                    this.elements.showAllNewsBtn.setAttribute('aria-label', newsLoc.show_all_title);
                }
            }

            const headerLoc = data.header;
            if (headerLoc) {
                if (headerLoc.subtitle) {
                    const sub = document.getElementById('headerSubtitle');
                    if (sub) {
                        sub.textContent = headerLoc.subtitle;
                    }
                }
                const ns = this.settings && this.settings.newsSource
                    ? this.normalizeNewsSource(this.settings.newsSource)
                    : 'heise';
                if (headerLoc.brand_wordmark) {
                    const w = document.getElementById('headerBrandText');
                    if (w) {
                        let wm = headerLoc.brand_wordmark;
                        if (ns === 'golem' && headerLoc.brand_wordmark_golem) {
                            wm = headerLoc.brand_wordmark_golem;
                        } else if (ns === 'computerbase' && headerLoc.brand_wordmark_computerbase) {
                            wm = headerLoc.brand_wordmark_computerbase;
                        } else if (ns === 't3n' && headerLoc.brand_wordmark_t3n) {
                            wm = headerLoc.brand_wordmark_t3n;
                        } else if (ns === 'verge' && headerLoc.brand_wordmark_verge) {
                            wm = headerLoc.brand_wordmark_verge;
                        } else if (ns === 'telepolis' && headerLoc.brand_wordmark_telepolis) {
                            wm = headerLoc.brand_wordmark_telepolis;
                        } else if (ns === 'it_administrator' && headerLoc.brand_wordmark_it_administrator) {
                            wm = headerLoc.brand_wordmark_it_administrator;
                        }
                        w.textContent = wm;
                    }
                }
                if (headerLoc.toggle_title) {
                    const b = document.getElementById('headerBrandToggle');
                    if (b) {
                        b.setAttribute('title', headerLoc.toggle_title);
                        b.setAttribute('aria-label', headerLoc.toggle_title);
                    }
                }
                if (headerLoc.logo_alt) {
                    const img = document.getElementById('heiseBrandLogo');
                    let alt = headerLoc.logo_alt;
                    if (ns === 'golem' && headerLoc.logo_alt_golem) {
                        alt = headerLoc.logo_alt_golem;
                    } else if (ns === 'computerbase' && headerLoc.logo_alt_computerbase) {
                        alt = headerLoc.logo_alt_computerbase;
                    } else if (ns === 't3n' && headerLoc.logo_alt_t3n) {
                        alt = headerLoc.logo_alt_t3n;
                    } else if (ns === 'verge' && headerLoc.logo_alt_verge) {
                        alt = headerLoc.logo_alt_verge;
                    } else if (ns === 'telepolis' && headerLoc.logo_alt_telepolis) {
                        alt = headerLoc.logo_alt_telepolis;
                    } else if (ns === 'it_administrator' && headerLoc.logo_alt_it_administrator) {
                        alt = headerLoc.logo_alt_it_administrator;
                    }
                    this._i18nHeaderLogoAlt = alt;
                    if (img) {
                        img.alt = alt;
                    }
                }
                const nsl = document.querySelector('label[for="newsSourceSelect"]');
                if (nsl && headerLoc.news_source_label) {
                    nsl.textContent = headerLoc.news_source_label;
                }
                const nss = document.getElementById('newsSourceSelect');
                this._i18nNewsSourceLabels = {};
                if (nss) {
                    nss.querySelectorAll('option').forEach((opt) => {
                        const id = opt.value;
                        const k = `news_source_${id}`;
                        if (headerLoc[k]) {
                            opt.textContent = headerLoc[k];
                            this._i18nNewsSourceLabels[id] = headerLoc[k];
                        }
                    });
                }
                if (headerLoc.settings_dashboard_btn && this.elements.dashboardSettingsBtn) {
                    this.elements.dashboardSettingsBtn.textContent = headerLoc.settings_dashboard_btn;
                    this.elements.dashboardSettingsBtn.setAttribute(
                        'aria-label',
                        headerLoc.settings_dashboard_btn
                    );
                    this.elements.dashboardSettingsBtn.setAttribute('title', headerLoc.settings_dashboard_btn);
                }
                if (headerLoc.settings_ki_btn && this.elements.settingsBtn) {
                    this.elements.settingsBtn.textContent = headerLoc.settings_ki_btn;
                    this.elements.settingsBtn.setAttribute('aria-label', headerLoc.settings_ki_btn);
                }
                const ctw = document.getElementById('headerColorThemeWrap');
                const ct = document.getElementById('colorThemeSelect');
                if (ctw && headerLoc.color_theme_title) {
                    ctw.setAttribute('title', headerLoc.color_theme_title);
                }
                if (ct && headerLoc.color_theme_aria) {
                    ct.setAttribute('aria-label', headerLoc.color_theme_aria);
                }
                const ctl = document.querySelector('label[for="colorThemeSelect"]');
                if (ctl && headerLoc.color_theme_label) {
                    ctl.textContent = headerLoc.color_theme_label;
                }
                if (ct) {
                    COLOR_THEME_IDS.forEach((tid) => {
                        const opt = ct.querySelector(`option[value="${tid}"]`);
                        const key = `color_theme_${tid}`;
                        if (opt && headerLoc[key]) {
                            opt.textContent = headerLoc[key];
                        }
                    });
                }

                if (headerLoc.youtube_modal_title) {
                    const ytTitleText = document.getElementById('yt-modal-title-text');
                    if (ytTitleText) {
                        ytTitleText.textContent = headerLoc.youtube_modal_title;
                    }
                }
                if (headerLoc.youtube_modal_hint) {
                    const yth = document.getElementById('youtubeModalHint');
                    if (yth) {
                        yth.textContent = headerLoc.youtube_modal_hint;
                    }
                }
                if (headerLoc.youtube_loading && this.elements.youtubeModal) {
                    const yl = this.elements.youtubeModal.querySelector('.youtube-loading');
                    if (yl) {
                        yl.textContent = headerLoc.youtube_loading;
                    }
                }
                if (headerLoc.youtube_close_btn) {
                    const yc = document.getElementById('youtubeCloseBtn');
                    if (yc) {
                        yc.textContent = headerLoc.youtube_close_btn;
                    }
                }
                if (headerLoc.youtube_regenerate_btn) {
                    const yr = document.getElementById('youtubeRegenerateBtn');
                    if (yr) {
                        yr.textContent = headerLoc.youtube_regenerate_btn;
                    }
                }
                if (headerLoc.youtube_regenerate_title) {
                    const yr = document.getElementById('youtubeRegenerateBtn');
                    if (yr) {
                        yr.setAttribute('title', headerLoc.youtube_regenerate_title);
                        yr.setAttribute('aria-label', headerLoc.youtube_regenerate_title);
                    }
                }
                if (headerLoc.youtube_no_results) {
                    this._i18nYoutubeNoResults = headerLoc.youtube_no_results;
                }
                if (headerLoc.youtube_error) {
                    this._i18nYoutubeError = headerLoc.youtube_error;
                }
                if (headerLoc.youtube_topic_label) {
                    this._i18nYoutubeTopicLabel = headerLoc.youtube_topic_label;
                }
                if (headerLoc.youtube_link_search) {
                    this._i18nYoutubeLinkSearch = headerLoc.youtube_link_search;
                }
                if (headerLoc.youtube_thumb_placeholder) {
                    this._i18nYoutubeThumbPlaceholder = headerLoc.youtube_thumb_placeholder;
                }
                if (headerLoc.youtube_channel_ai) {
                    this._i18nYoutubeChannelAi = headerLoc.youtube_channel_ai;
                }
                if (headerLoc.youtube_btn_title) {
                    this._i18nYoutubeBtnTitle = headerLoc.youtube_btn_title;
                }
            }

            const dash = data.dashboard_settings;
            const dTitle = data.header && data.header.settings_dashboard_title;
            if (dash || dTitle) {
                const t = document.getElementById('dashboardSettingsTitle');
                if (t && dTitle) {
                    t.textContent = dTitle;
                }
                const st = document.getElementById('dashboardSourcesSectionTitle');
                if (st && dash && dash.section_sources_heading) {
                    st.textContent = dash.section_sources_heading;
                }
                const dh = document.getElementById('dashboardSourcesHint');
                if (dh && dash && dash.section_sources_hint) {
                    dh.textContent = dash.section_sources_hint;
                }
                const sl = document.getElementById('newsSourcesSearchLabel');
                if (sl && dash && dash.search_label) {
                    sl.textContent = dash.search_label;
                }
                const si = document.getElementById('newsSourcesFilterInput');
                if (si && dash) {
                    if (dash.search_placeholder) {
                        si.setAttribute('placeholder', dash.search_placeholder);
                    }
                    if (dash.search_aria) {
                        si.setAttribute('aria-label', dash.search_aria);
                    }
                }
                if (dash && dash.toggle_visible_enable) {
                    this._i18nToggleVisibleEnable = dash.toggle_visible_enable;
                }
                if (dash && dash.toggle_visible_disable) {
                    this._i18nToggleVisibleDisable = dash.toggle_visible_disable;
                }
                this.syncNewsSourcesToggleVisibleBtn();
                const ca = document.getElementById('cancelDashboardSettings');
                if (ca && dash && dash.cancel) {
                    ca.textContent = dash.cancel;
                }
                const sa = document.getElementById('saveDashboardSettings');
                if (sa && dash && dash.save) {
                    sa.textContent = dash.save;
                }
                if (dash && dash.saved) {
                    this._i18nDashboardSaved = dash.saved;
                }
                if (dash && dash.need_one) {
                    this._i18nDashboardNeedOne = dash.need_one;
                }
                if (dash && dash.heise_magazines_heading) {
                    this._i18nHeiseMagazineHeading = dash.heise_magazines_heading;
                }
                if (dash && dash.heise_magazine_labels && typeof dash.heise_magazine_labels === 'object') {
                    this._i18nHeiseMagazineById = { ...dash.heise_magazine_labels };
                }
                const dKi = document.getElementById('dashboardOpenKiLangBtn');
                if (dKi && dash && dash.open_ki_lang_btn) {
                    dKi.textContent = dash.open_ki_lang_btn;
                }
                if (dKi && dash && dash.open_ki_lang_title) {
                    dKi.setAttribute('title', dash.open_ki_lang_title);
                    dKi.setAttribute('aria-label', dash.open_ki_lang_title);
                }
            }

            const ki = data.ki_modal;
            if (ki) {
                if (ki.batch_summarize_progress) {
                    this._i18nBatchSummarizeProgress = ki.batch_summarize_progress;
                }
                if (ki.batch_summarize_progress_refresh) {
                    this._i18nBatchSummarizeProgressRefresh = ki.batch_summarize_progress_refresh;
                }
                const scl = document.querySelector('label[for="summaryConcurrency"]');
                if (scl && ki.summary_concurrency_label) {
                    scl.textContent = ki.summary_concurrency_label;
                }
                const sch = document.getElementById('summaryConcurrencyHint');
                if (sch && ki.summary_concurrency_hint) {
                    sch.textContent = ki.summary_concurrency_hint;
                }
                const ktl = document.getElementById('kiRequestTimeoutLabel');
                if (ktl && ki.ki_request_timeout_label) {
                    ktl.textContent = ki.ki_request_timeout_label;
                }
                const kth = document.getElementById('kiRequestTimeoutHint');
                if (kth && ki.ki_request_timeout_hint) {
                    kth.textContent = ki.ki_request_timeout_hint;
                }
                const ll = document.querySelector('label[for="summaryLangMode"]');
                if (ll && ki.summary_lang_label) {
                    ll.textContent = ki.summary_lang_label;
                }
                const lh = document.getElementById('summaryLangHint');
                if (lh && ki.summary_lang_hint) {
                    lh.textContent = ki.summary_lang_hint;
                }
                const slm = document.getElementById('summaryLangMode');
                if (slm) {
                    const oSite = slm.querySelector('option[value="site"]');
                    const oBr = slm.querySelector('option[value="browser"]');
                    if (oSite && ki.summary_lang_site) {
                        oSite.textContent = ki.summary_lang_site;
                    }
                    if (oBr && ki.summary_lang_browser) {
                        oBr.textContent = ki.summary_lang_browser;
                    }
                }
                const all = document.getElementById('alternativeLinksCountLabel');
                if (all && ki.alternative_links_label) {
                    all.textContent = ki.alternative_links_label;
                }
                const alh = document.getElementById('alternativeLinksHint');
                if (alh && ki.alternative_links_hint) {
                    alh.textContent = ki.alternative_links_hint;
                }
                const wsl = document.getElementById('webSearchEngineLabel');
                if (wsl && ki.web_search_engine_label) {
                    wsl.textContent = ki.web_search_engine_label;
                }
                const wsh = document.getElementById('webSearchEngineHint');
                if (wsh && ki.web_search_engine_hint) {
                    wsh.textContent = ki.web_search_engine_hint;
                }
                const adl = document.getElementById('alternativeLinksDisplayModeLabel');
                if (adl && ki.alternative_links_display_label) {
                    adl.textContent = ki.alternative_links_display_label;
                }
                const adh = document.getElementById('alternativeLinksDisplayModeHint');
                if (adh && ki.alternative_links_display_hint) {
                    adh.textContent = ki.alternative_links_display_hint;
                }
                const abl = document.getElementById('alternativeLinksBlacklistLabel');
                if (abl && ki.alternative_links_blacklist_label) {
                    abl.textContent = ki.alternative_links_blacklist_label;
                }
                const abh = document.getElementById('alternativeLinksBlacklistHint');
                if (abh && ki.alternative_links_blacklist_hint) {
                    abh.textContent = ki.alternative_links_blacklist_hint;
                }
                const adSel = document.getElementById('alternativeLinksDisplayMode');
                if (adSel && ki.alternative_links_display_expanded && ki.alternative_links_display_collapsed) {
                    const oE = adSel.querySelector('option[value="expanded"]');
                    const oC = adSel.querySelector('option[value="collapsed"]');
                    if (oE) {
                        oE.textContent = ki.alternative_links_display_expanded;
                    }
                    if (oC) {
                        oC.textContent = ki.alternative_links_display_collapsed;
                    }
                }
                const rll = document.querySelector('label[for="reasoningSelect"]');
                if (rll && ki.reasoning_level_label) {
                    rll.textContent = ki.reasoning_level_label;
                }
                const rh = document.getElementById('reasoningHint');
                if (rh && ki.reasoning_level_hint) {
                    rh.textContent = ki.reasoning_level_hint;
                }
                const rs = document.getElementById('reasoningSelect');
                if (rs) {
                    const reasoningOpts = [
                        ['off', ki.reasoning_level_off],
                        ['low', ki.reasoning_level_low],
                        ['medium', ki.reasoning_level_medium],
                        ['high', ki.reasoning_level_high],
                        ['on', ki.reasoning_level_on]
                    ];
                    for (const [val, text] of reasoningOpts) {
                        if (!text) {
                            continue;
                        }
                        const o = rs.querySelector(`option[value="${val}"]`);
                        if (o) {
                            o.textContent = text;
                        }
                    }
                }
                const okb = document.getElementById('openKiStatsBtn');
                if (okb && ki.open_stats_btn) {
                    okb.textContent = ki.open_stats_btn;
                }
                if (okb && ki.open_stats_title) {
                    okb.setAttribute('title', ki.open_stats_title);
                    okb.setAttribute('aria-label', ki.open_stats_title);
                }
            }

            const ks = data.ki_stats;
            if (ks) {
                const t = document.getElementById('kiStatsTitle');
                if (t && ks.title) {
                    t.textContent = ks.title;
                }
                const intro = document.getElementById('kiStatsIntro');
                if (intro && ks.intro) {
                    intro.textContent = ks.intro;
                }
                const empty = document.getElementById('kiStatsEmpty');
                if (empty && ks.empty) {
                    empty.textContent = ks.empty;
                }
                const lblCount = document.getElementById('kiStatsLblCount');
                if (lblCount && ks.count_label) {
                    lblCount.textContent = ks.count_label;
                }
                const lblT = document.getElementById('kiStatsLblTotalTokens');
                if (lblT && ks.total_tokens) {
                    lblT.textContent = ks.total_tokens;
                }
                const lblA = document.getElementById('kiStatsLblAvgTokens');
                if (lblA && ks.avg_tokens) {
                    lblA.textContent = ks.avg_tokens;
                }
                const lblD = document.getElementById('kiStatsLblAvgDuration');
                if (lblD && ks.avg_duration) {
                    lblD.textContent = ks.avg_duration;
                }
                const ccb = document.getElementById('cancelKiStatsBtn');
                if (ccb && ks.close) {
                    ccb.textContent = ks.close;
                }
                const clb = document.getElementById('clearKiStatsBtn');
                if (clb && ks.clear) {
                    clb.textContent = ks.clear;
                }
                if (ks.token_na) {
                    this._i18nKiStatsTokenNa = ks.token_na;
                }
                if (ks.token_na_hint) {
                    this._i18nKiStatsTokenHint = ks.token_na_hint;
                }
                if (ks.chart_caption) {
                    this._i18nKiStatsChartTpl = ks.chart_caption;
                }
                if (ks.chart_legend_avg_tokens) {
                    this._i18nKiStatsChartAvgLegend = ks.chart_legend_avg_tokens;
                }
                if (ks.chart_legend_total_tokens) {
                    this._i18nKiStatsChartTotalLegend = ks.chart_legend_total_tokens;
                }
                if (ks.chart_tokens_none) {
                    this._i18nKiStatsTokensUnavailable = ks.chart_tokens_none;
                }
                if (ks.chart_y_title) {
                    this._i18nKiStatsChartYTitle = ks.chart_y_title;
                }
                if (ks.clear_confirm) {
                    this._i18nKiStatsClearConfirm = ks.clear_confirm;
                }
            }

            this.syncCategoryFiltersVisibility();
            this.syncLoadMoreAndCount();
        } catch (_) {
            /* keep built-in HTML labels */
        }
    }

    /**
     * @param {string} [url]
     * @returns {string}
     */
    static normalizeNewsUrl(url) {
        if (!url) {
            return '';
        }
        const s = String(url).trim();
        const q = s.indexOf('?');
        const h = s.indexOf('#');
        let cut = s.length;
        if (q >= 0) {
            cut = Math.min(cut, q);
        }
        if (h >= 0) {
            cut = Math.min(cut, h);
        }
        let out = s.slice(0, cut);
        if (out.length > 1 && out.endsWith('/')) {
            out = out.slice(0, -1);
        }
        return out;
    }

    /**
     * Canonical article URL for comparing feed refreshes (http/https, host case, path slash).
     * Fixes Heise/Atom cases where the same article toggles scheme so "Neu" detection works.
     * @param {string} [url]
     * @returns {string}
     */
    static canonicalArticleUrl(url) {
        const s = App.normalizeNewsUrl(url);
        if (!s) {
            return '';
        }
        try {
            const u = new URL(s);
            u.protocol = 'https:';
            u.hostname = u.hostname.toLowerCase();
            let path = u.pathname;
            if (path.length > 1 && path.endsWith('/')) {
                path = path.slice(0, -1);
            }
            return `${u.protocol}//${u.hostname}${path}`;
        } catch {
            return s.toLowerCase();
        }
    }

    /**
     * Article URL for KI/cache: prefer `url`, else `link` (matches card buttons; some feeds omit one field).
     * @param {{ url?: string, link?: string }} item
     * @returns {string}
     */
    static articlePrimaryUrl(item) {
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
     * Stable key for per-article UI flags (favorite/hidden).
     * @param {{ url?: string, link?: string }} item
     * @returns {string}
     */
    static articleFlagKey(item) {
        const primary = App.articlePrimaryUrl(item);
        return App.canonicalArticleUrl(primary);
    }

    async loadArticleFlags() {
        try {
            const rows = await this.storage.getAllArticleFlags();
            this._articleFlags = new Map();
            for (const row of rows || []) {
                const key = row && row.articleKey ? String(row.articleKey) : '';
                if (!key) {
                    continue;
                }
                this._articleFlags.set(key, {
                    isFavorite: row.isFavorite === true,
                    isHidden: row.isHidden === true
                });
            }
        } catch (e) {
            console.warn('loadArticleFlags:', e);
            this._articleFlags = new Map();
        }
    }

    applyArticleFlags(items) {
        return (items || []).map((item) => {
            const key = App.articleFlagKey(item);
            const flags = key ? this._articleFlags.get(key) : null;
            return {
                ...item,
                isFavorite: Boolean(flags && flags.isFavorite === true),
                isHidden: Boolean(flags && flags.isHidden === true)
            };
        });
    }

    async saveArticleFlagsForItem(item, patch) {
        const key = App.articleFlagKey(item);
        if (!key) {
            return;
        }
        try {
            const prev = this._articleFlags.get(key) || {};
            const next = {
                isFavorite: patch.isFavorite != null ? patch.isFavorite === true : prev.isFavorite === true,
                isHidden: patch.isHidden != null ? patch.isHidden === true : prev.isHidden === true
            };
            this._articleFlags.set(key, next);
            await this.storage.saveArticleFlag(key, next);
        } catch (e) {
            console.error('saveArticleFlagsForItem:', e);
        }
    }

    /**
     * Resolve article metadata for summary buttons (id can miss in newsItems after filter edge cases).
     * @param {string} cardId
     * @param {string} urlFromButton
     * @returns {object|undefined}
     */
    resolveNewsItemForSummary(cardId, urlFromButton) {
        const byId = (list) => (list || []).find((n) => n && n.id === cardId);
        let item = byId(this.newsItems) || byId(this.filteredNewsItems);
        if (item) {
            return item;
        }
        const norm = App.normalizeNewsUrl(urlFromButton);
        if (!norm) {
            return undefined;
        }
        const byUrl = (list) =>
            (list || []).find((n) => {
                if (!n) {
                    return false;
                }
                return (
                    App.normalizeNewsUrl(n.url) === norm ||
                    App.normalizeNewsUrl(n.link) === norm
                );
            });
        return byUrl(this.newsItems) || byUrl(this.filteredNewsItems);
    }

    syncSortUIFromSettings() {
        const s = this.settings || {};
        const mode = s.sortMode || 'recency';
        if (this.elements.sortSelect) {
            this.elements.sortSelect.value = mode;
        }
        if (this.elements.sortDateSingle) {
            this.elements.sortDateSingle.value = s.sortDateSingle || '';
        }
        if (this.elements.sortDateFrom) {
            this.elements.sortDateFrom.value = s.sortDateFrom || '';
        }
        if (this.elements.sortDateTo) {
            this.elements.sortDateTo.value = s.sortDateTo || '';
        }
        this.syncSortDateVisibility();
    }

    syncSortDateVisibility() {
        const mode = this.elements.sortSelect ? this.elements.sortSelect.value : 'recency';
        if (this.elements.sortDateSingleWrap) {
            this.elements.sortDateSingleWrap.hidden = mode !== 'date_day';
        }
        if (this.elements.sortDateRangeWrap) {
            this.elements.sortDateRangeWrap.hidden = mode !== 'date_range';
        }
    }

    /** Expand/collapse the sort panel (default: collapsed). */
    toggleSortPanel() {
        const body = document.getElementById('sortPanelBody');
        const btn = document.getElementById('sortPanelToggle');
        const section = document.querySelector('.sort-section');
        if (!body || !btn) {
            return;
        }
        const willOpen = body.hidden === true;
        body.hidden = !willOpen;
        btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        if (section) {
            section.classList.toggle('sort-section--open', willOpen);
        }
    }

    readSortFromUI() {
        this.sortMode = this.elements.sortSelect ? this.elements.sortSelect.value : 'recency';
        this.sortDateSingle = this.elements.sortDateSingle ? this.elements.sortDateSingle.value : '';
        this.sortDateFrom = this.elements.sortDateFrom ? this.elements.sortDateFrom.value : '';
        this.sortDateTo = this.elements.sortDateTo ? this.elements.sortDateTo.value : '';
    }

    async persistSortSettings() {
        this.readSortFromUI();
        this.settings = {
            ...this.settings,
            sortMode: this.sortMode,
            sortDateSingle: this.sortDateSingle,
            sortDateFrom: this.sortDateFrom,
            sortDateTo: this.sortDateTo
        };
        try {
            await this.storage.saveSettings(this.settings);
        } catch (e) {
            console.error(e);
        }
    }

    syncCategoryFiltersVisibility() {
        const src = this.normalizeNewsSource(this.settings?.newsSource);
        const heiseEl = document.getElementById('categoryFiltersHeise');
        const teleEl = document.getElementById('categoryFiltersTelepolis');
        const genericEl = document.getElementById('categoryFiltersGenericSources');
        if (heiseEl) {
            heiseEl.hidden = src !== 'heise';
        }
        if (teleEl) {
            teleEl.hidden = src !== 'telepolis';
        }
        if (genericEl) {
            genericEl.hidden = !App.isGenericRubricNewsSource(src);
        }
    }

    /** Keep duplicate rubric checkboxes (heise vs. generic group) aligned with `selectedCategories`. */
    syncAllCategoryCheckboxesFromSelection() {
        const sel = new Set(this.selectedCategories);
        document.querySelectorAll('.category-checkbox').forEach((cb) => {
            cb.checked = sel.has(cb.value);
        });
    }

    /**
     * Checked category values from checkboxes in non-hidden source groups only.
     * @returns {string[]}
     */
    readSelectedCategoriesFromDom() {
        const root = this.elements.categoryFilters;
        if (!root) {
            return [];
        }
        return Array.from(root.querySelectorAll('.category-checkbox'))
            .filter((cb) => {
                const g = cb.closest('[data-news-source-scope]');
                if (g && g.hidden) {
                    return false;
                }
                return cb.checked;
            })
            .map((cb) => cb.value);
    }

    /**
     * Merge visible checkbox state with stored categories from hidden groups (other sources).
     */
    mergeSelectedCategoriesFromVisibleDom() {
        const src = this.normalizeNewsSource(this.settings?.newsSource);
        const visibleSet = App.visibleCategoryValuesForSource(src);
        const vis = this.readSelectedCategoriesFromDom();
        const prev = Array.isArray(this.selectedCategories) ? [...this.selectedCategories] : [];
        const preserved = prev.filter((c) => !visibleSet.has(c));
        this.selectedCategories = [...new Set([...preserved, ...vis])];
        this.syncAllCategoryCheckboxesFromSelection();
    }

    /**
     * When the visible filter group has no selection, check sensible defaults (heise: all; telepolis: on).
     */
    ensureDefaultCategorySelectionForSource() {
        this.syncCategoryFiltersVisibility();
        const src = this.normalizeNewsSource(this.settings?.newsSource);
        const visibleSet = App.visibleCategoryValuesForSource(src);
        let vis = this.readSelectedCategoriesFromDom();
        if (vis.length === 0 && visibleSet.size > 0) {
            if (src === 'telepolis') {
                const cb = document.getElementById('cat-telepolis');
                if (cb) {
                    cb.checked = true;
                }
            } else if (src === 'heise' || App.isGenericRubricNewsSource(src)) {
                document.querySelectorAll('.category-checkbox').forEach((cb) => {
                    const g = cb.closest('[data-news-source-scope]');
                    if (g && g.hidden) {
                        return;
                    }
                    cb.checked = true;
                });
            }
            vis = this.readSelectedCategoriesFromDom();
        }
        const prev = Array.isArray(this.selectedCategories) ? [...this.selectedCategories] : [];
        const preserved = prev.filter((c) => !visibleSet.has(c));
        this.selectedCategories = [...new Set([...preserved, ...vis])];
        this.syncAllCategoryCheckboxesFromSelection();
    }

    buildCategoryFiltered() {
        const src = this.normalizeNewsSource(this.settings?.newsSource);
        const mode = this.sortMode || 'recency';

        const basePass = (item) => {
            if (mode === 'hidden_only') {
                return item.isHidden === true;
            }
            if (mode === 'favorites_only') {
                return item.isFavorite === true && item.isHidden !== true;
            }
            return item.isHidden !== true;
        };

        const base = this.newsItems.filter((item) => basePass(item));

        if (src === 'telepolis') {
            if (!this.selectedCategories.includes('telepolis')) {
                return [];
            }
            const tp = App.telepolisFeedCategorySet();
            return base.filter((item) => tp.has(String(item.category || '')));
        }

        if (src === 'heise' || App.isGenericRubricNewsSource(src)) {
            if (this.selectedCategories.length === 0) {
                return [];
            }
            return base.filter((item) => this.selectedCategories.includes(item.category));
        }

        return base;
    }

    /** @param {'total'|'green'|'red'} key */
    getCommentMetric(item, key) {
        const s = item.commentStats;
        if (!s || !s.ok) {
            return -1;
        }
        if (s.rateLimited && (key === 'green' || key === 'red')) {
            return -1;
        }
        const v = s[key];
        if (typeof v !== 'number' || v < 0) {
            return -1;
        }
        return v;
    }

    sortItemList(list) {
        const mode = this.sortMode || 'recency';
        const copy = [...list];
        if (mode === 'favorites_first') {
            copy.sort((a, b) => {
                const fa = a.isFavorite === true ? 1 : 0;
                const fb = b.isFavorite === true ? 1 : 0;
                if (fb !== fa) {
                    return fb - fa;
                }
                return (b.publishedMs || 0) - (a.publishedMs || 0);
            });
            return copy;
        }
        if (mode === 'favorites_only' || mode === 'hidden_only') {
            copy.sort((a, b) => (b.publishedMs || 0) - (a.publishedMs || 0));
            return copy;
        }
        if (mode === 'recency' || mode === 'date_day' || mode === 'date_range') {
            copy.sort((a, b) => (b.publishedMs || 0) - (a.publishedMs || 0));
            return copy;
        }
        const metric = mode === 'comments' ? 'total' : mode === 'green' ? 'green' : 'red';
        copy.sort((a, b) => {
            const vb = this.getCommentMetric(b, metric);
            const va = this.getCommentMetric(a, metric);
            if (vb !== va) {
                return vb - va;
            }
            return (b.publishedMs || 0) - (a.publishedMs || 0);
        });
        return copy;
    }

    setSortProgressUi(active, text = '') {
        if (this.elements.sortApplyBtn) {
            this.elements.sortApplyBtn.disabled = active;
        }
        if (this.elements.sortProgress) {
            this.elements.sortProgress.hidden = !active && !text;
            this.elements.sortProgress.textContent = text;
        }
    }

    syncLoadMoreAndCount() {
        const n = this.filteredNewsItems.length;
        const tpl = this._i18nNewsCountLoaded || '{count} Nachrichten geladen';
        this.elements.newsCount.textContent = tpl.replace(/\{count\}/g, String(n));
        const shown = Math.min(n, this.itemsPerPage * this.currentPage);
        const hasMore = n > shown;
        const disp = hasMore ? 'inline-block' : 'none';
        this.elements.loadMoreBtn.style.display = disp;
        if (this.elements.showAllNewsBtn) {
            this.elements.showAllNewsBtn.style.display = disp;
        }
    }

    /**
     * Apply category filter, optional date filter, optional comment prefetch, sort, and optionally re-render.
     * @param {{ render?: boolean }} opts
     */
    async applySortPipeline(opts = {}) {
        const render = opts.render !== false;
        this.readSortFromUI();
        await this.persistSortSettings();

        const categoryFiltered = this.buildCategoryFiltered();
        if (categoryFiltered.length === 0) {
            this.filteredNewsItems = [];
            this.currentPage = 1;
            if (render) {
                this.renderNews([], false);
                this.syncLoadMoreAndCount();
            }
            return;
        }

        let list = categoryFiltered;

        if (this.sortMode === 'date_day') {
            if (!this.sortDateSingle) {
                this.showStatus('Bitte ein Datum wählen oder die Sortierung ändern.', true);
            } else {
                const { start, end } = App.getLocalDayBounds(this.sortDateSingle);
                list = list.filter(
                    (item) => item.publishedMs >= start && item.publishedMs <= end
                );
            }
        } else if (this.sortMode === 'date_range') {
            if (!this.sortDateFrom || !this.sortDateTo) {
                this.showStatus('Bitte „Von“ und „Bis“ setzen oder die Sortierung ändern.', true);
            } else {
                const a = App.getLocalDayBounds(this.sortDateFrom).start;
                const b = App.getLocalDayBounds(this.sortDateTo).end;
                const lo = Math.min(a, b);
                const hi = Math.max(a, b);
                list = list.filter((item) => item.publishedMs >= lo && item.publishedMs <= hi);
            }
        }

        let prefetchResult = { rateLimited: false };
        if (['comments', 'green', 'red'].includes(this.sortMode)) {
            this.setSortProgressUi(true, '…');
            try {
                if (typeof HeiseComments !== 'undefined') {
                    prefetchResult =
                        (await HeiseComments.prefetchForItems(list, (done, total) => {
                            this.setSortProgressUi(true, `${done}/${total}`);
                        })) || { rateLimited: false };
                }
            } finally {
                this.setSortProgressUi(false, '');
            }
        }

        this.filteredNewsItems = this.sortItemList(list);
        this.currentPage = 1;
        if (render) {
            this.renderNews(this.filteredNewsItems.slice(0, this.itemsPerPage), false);
            this.syncLoadMoreAndCount();
            if (['comments', 'green', 'red'].includes(this.sortMode)) {
                this.showSortRateLimitBanner(Boolean(prefetchResult && prefetchResult.rateLimited));
            } else {
                this.showSortRateLimitBanner(false);
            }
        }
    }

    /** Show banner under sort controls when comment prefetch hit HTTP 429 (forum). */
    showSortRateLimitBanner(show) {
        const banner = document.getElementById('sortRateLimitBanner');
        if (banner) {
            banner.hidden = !show;
        }
    }

    syncHeaderIntervalFromSettings() {
        const u = this.settings?.updateInterval;
        const custom = this.settings?.customInterval || 60;
        if (u === 'custom') {
            this.elements.refreshIntervalSelect.value = 'custom';
            this.elements.headerCustomInterval.value = String(custom);
            this.elements.headerCustomIntervalWrap.style.display = 'inline-flex';
        } else {
            this.elements.refreshIntervalSelect.value = String(u || 60);
            this.elements.headerCustomIntervalWrap.style.display = 'none';
        }
    }

    toggleHeaderCustomIntervalVisibility() {
        const isCustom = this.elements.refreshIntervalSelect.value === 'custom';
        this.elements.headerCustomIntervalWrap.style.display = isCustom ? 'inline-flex' : 'none';
    }

    async persistRefreshInterval() {
        const sel = this.elements.refreshIntervalSelect.value;
        let updateInterval;
        let customInterval = null;

        if (sel === 'custom') {
            updateInterval = 'custom';
            customInterval = Math.min(
                480,
                Math.max(5, parseInt(this.elements.headerCustomInterval.value, 10) || 60)
            );
            this.elements.headerCustomInterval.value = String(customInterval);
        } else {
            updateInterval = parseInt(sel, 10);
        }

        this.readSortFromUI();
        this.settings = {
            ...this.settings,
            updateInterval,
            customInterval,
            selectedCategories: this.selectedCategories,
            sortMode: this.sortMode,
            sortDateSingle: this.sortDateSingle,
            sortDateFrom: this.sortDateFrom,
            sortDateTo: this.sortDateTo
        };

        try {
            await this.storage.saveSettings(this.settings);
        } catch (e) {
            console.error(e);
        }

        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }
        this.startAutoUpdateTimer();
    }

    async persistCategorySettings() {
        this.settings = {
            ...this.settings,
            selectedCategories: this.selectedCategories
        };
        try {
            await this.storage.saveSettings(this.settings);
        } catch (e) {
            console.error(e);
        }
    }

    /**
     * Set every category checkbox on or off, then apply filter + persist (IndexedDB).
     * @param {boolean} checked
     */
    setAllCategoriesChecked(checked) {
        document.querySelectorAll('.category-checkbox').forEach((cb) => {
            const g = cb.closest('[data-news-source-scope]');
            if (g && g.hidden) {
                return;
            }
            cb.checked = checked;
        });
        this.handleCategoryChange();
    }

    handleCategoryChange() {
        this.mergeSelectedCategoriesFromVisibleDom();

        void this.persistCategorySettings();
        void this.applySortPipeline({ render: true });
    }

    async onNewsSourceChange() {
        const sel = this.elements.newsSourceSelect;
        if (!sel) {
            return;
        }
        const v = this.normalizeNewsSource(sel.value);
        if (this.settings) {
            this.settings.newsSource = v;
        }
        try {
            await this.storage.saveSettings({ newsSource: v });
            localStorage.setItem('heise_news_source', v);
        } catch (e) {
            console.warn('onNewsSourceChange:', e);
        }
        if (typeof window !== 'undefined') {
            window.__newsSource = v;
        }
        this.scraper.configureSource(v);
        this.syncCategoryFiltersVisibility();
        this.ensureDefaultCategorySelectionForSource();
        await this.persistCategorySettings();
        if (typeof HeiseComments !== 'undefined') {
            HeiseComments.clearCommentCache();
        }
        await this.scraper.clearAllFeedCaches();
        await this.applySortLabelsFromLocale();
        const logo = this.elements.heiseBrandLogo;
        if (logo) {
            logo.removeAttribute('src');
            logo.src = `${this.getBrandLogoUrl()}?_=s${Date.now()}`;
        }
        this.applyHeaderBrandMode(this._headerBrandMode);
        if (this._headerBrandMode === 'text') {
            this.scheduleHeaderBrandTextFit();
        }
        await this.fetchNews();
    }

    async fetchNews(forceRefresh = false) {
        const gen = ++this._newsFetchGeneration;
        try {
            // Show loading state
            this.showLoadingState();

            // Clear cache if force refresh
            if (forceRefresh) {
                await this.scraper.clearCache();
            }

            // Fetch news from scraper (defensive second filter — must drop Golem /news/anzeige-… slugs)
            let newsItems = await this.scraper.fetchNews();
            if (gen !== this._newsFetchGeneration) {
                return;
            }
            newsItems = NewsScraper.filterOutAdvertorialItems(newsItems);

            const prevUrls = new Set(
                (this.newsItems || [])
                    .map((i) => App.canonicalArticleUrl(i.url || i.link || ''))
                    .filter(Boolean)
            );
            const hadPrevious = prevUrls.size > 0;

            // Save to IndexedDB
            await this.storage.saveNews(newsItems);
            if (gen !== this._newsFetchGeneration) {
                return;
            }

            // Update state
            this.newsItems = this.applyArticleFlags(newsItems);

            this._newArticleIds = new Set();
            if (hadPrevious) {
                for (const item of newsItems) {
                    const u = App.canonicalArticleUrl(item.url || item.link || '');
                    if (u && !prevUrls.has(u)) {
                        this._newArticleIds.add(item.id);
                    }
                }
            }

            await this.applySortPipeline({ render: true });
            if (gen !== this._newsFetchGeneration) {
                return;
            }

            // Update status bar
            const lastUpdate = new Date().toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit'
            });
            this.elements.lastUpdate.textContent = `Letzte Aktualisierung: ${lastUpdate}`;

            // Show status message
            if (this._newArticleIds.size > 0) {
                const tpl =
                    this._i18nStatusNew || 'Nachrichten aktualisiert — {count} neue Artikel.';
                this.showStatus(tpl.replace(/\{count\}/g, String(this._newArticleIds.size)));
            } else {
                const message =
                    forceRefresh ? 'Nachrichten wurden aktualisiert.' :
                    this.newsItems.length > 0 ? 'Nachrichten erfolgreich geladen.' :
                    'Keine Nachrichten gefunden.';
                this.showStatus(message);
            }

            if (this.newsItems.length > 0) {
                void this.autoSummarizeAfterRefresh(forceRefresh);
            }

        } catch (error) {
            console.error('Error fetching news:', error);
            if (gen !== this._newsFetchGeneration) {
                return;
            }
            this.showStatus('Fehler beim Laden der Nachrichten', true);

            // Try to load from cache
            await this.loadCachedNews();
        }
    }

    async loadCachedNews() {
        try {
            const cachedNews = await this.storage.getAllNews();
            const currentSource = this.normalizeNewsSource(this.settings?.newsSource);
            const forCurrentSource = (cachedNews || []).filter(
                (a) => this.normalizeNewsSource(a && a.newsSource) === currentSource
            );
            const filteredCached = NewsScraper.filterOutAdvertorialItems(forCurrentSource);

            if (filteredCached.length > 0) {
                this._newArticleIds = new Set();
                this.newsItems = this.applyArticleFlags(filteredCached);
                await this.applySortPipeline({ render: true });

                const lastUpdate = new Date().toLocaleTimeString('de-DE', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                this.elements.lastUpdate.textContent = `Letzte Aktualisierung: ${lastUpdate}`;

                this.showStatus('Geladene aus dem Cache (keine Netzwerkverbindung)');
            } else {
                this.filteredNewsItems = [];
                this.currentPage = 1;
                this.renderNews([], false);
                this.syncLoadMoreAndCount();
                this.showStatus('Keine cacheden Nachrichten verfügbar', true);
            }
        } catch (error) {
            console.error('Error loading cached news:', error);
            this.renderNews([], false);
        }
    }

    loadMoreNews() {
        const startIndex = this.itemsPerPage * this.currentPage;
        const endIndex = startIndex + this.itemsPerPage;
        const newsToShow = this.filteredNewsItems.slice(startIndex, endIndex);

        if (newsToShow.length === 0) {
            this.syncLoadMoreAndCount();
            return;
        }

        this.renderNews(newsToShow, true);
        this.currentPage++;
        this.syncLoadMoreAndCount();
    }

    /** Appends all remaining filtered articles in one step (same as repeated „Mehr laden“ until done). */
    showAllNews() {
        const n = this.filteredNewsItems.length;
        const startIndex = this.itemsPerPage * this.currentPage;
        if (startIndex >= n) {
            this.syncLoadMoreAndCount();
            return;
        }
        const rest = this.filteredNewsItems.slice(startIndex);
        this.renderNews(rest, true);
        this.currentPage = Math.max(1, Math.ceil(n / this.itemsPerPage));
        this.syncLoadMoreAndCount();
    }

    /**
     * @param {Array} items
     * @param {boolean} append - true only for "Mehr laden"; false replaces the grid (avoids stacking on skeleton cards)
     */
    renderNews(items, append = false) {
        if (items.length === 0) {
            this.elements.newsGrid.innerHTML = `
                <div style="text-align: center; padding: 3rem; grid-column: 1 / -1;">
                    <p style="font-size: 1.2rem; color: var(--text-secondary);">
                        Keine Nachrichten in dieser Kategorie gefunden.
                    </p>
                </div>
            `;
            return;
        }

        const html = items.map((item) => this.createNewsCardHTML(item)).join('');

        if (append) {
            this.elements.newsGrid.insertAdjacentHTML('beforeend', html);
        } else {
            this.elements.newsGrid.innerHTML = html;
        }

        this.elements.newsGrid.querySelectorAll('.summary-toggle').forEach((btn) => {
            btn.addEventListener('click', (e) => this.toggleSummary(e));
        });
        this.elements.newsGrid.querySelectorAll('.article-favorite-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => void this.toggleFavorite(e));
        });
        this.elements.newsGrid.querySelectorAll('.article-hide-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => void this.toggleHidden(e));
        });
        this.elements.newsGrid.querySelectorAll('.summary-refresh-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => this.refreshSummary(e));
        });

        void this.hydrateCachedSummariesForItems(items);

        if (typeof HeiseComments !== 'undefined' && this.elements.newsGrid) {
            void HeiseComments.hydrate(this.elements.newsGrid);
        }

        this.attachNewArticleHoverHandlers();
    }

    /**
     * After 3s hover on a "new" card, remove highlight (per UX spec).
     */
    attachNewArticleHoverHandlers() {
        if (!this.elements.newsGrid) {
            return;
        }
        this.elements.newsGrid.querySelectorAll('.news-card.news-card--new').forEach((card) => {
            if (card.dataset.newHoverBound === '1') {
                return;
            }
            card.dataset.newHoverBound = '1';
            const onEnter = () => {
                if (card._newHoverTimer) {
                    clearTimeout(card._newHoverTimer);
                }
                card._newHoverTimer = window.setTimeout(() => {
                    this.clearNewArticleHighlight(card);
                }, 3000);
            };
            const onLeave = () => {
                if (card._newHoverTimer) {
                    clearTimeout(card._newHoverTimer);
                    card._newHoverTimer = null;
                }
            };
            card.addEventListener('mouseenter', onEnter);
            card.addEventListener('mouseleave', onLeave);
        });
    }

    clearNewArticleHighlight(card) {
        if (!card || !card.classList.contains('news-card--new')) {
            return;
        }
        card.classList.remove('news-card--new');
        card.removeAttribute('aria-label');
        const id = card.dataset.id;
        if (id && this._newArticleIds) {
            this._newArticleIds.delete(id);
        }
        const badge = card.querySelector('.news-card-new-badge');
        if (badge) {
            badge.remove();
        }
        if (card._newHoverTimer) {
            clearTimeout(card._newHoverTimer);
            card._newHoverTimer = null;
        }
    }

    async confirmAndSummarizeAllRegenerate() {
        const msg =
            this._i18nBatchConfirm ||
            'Alle KI-Zusammenfassungen für die aktuell gefilterten Artikel neu erzeugen? Der Cache wird überschrieben.';
        if (!window.confirm(msg)) {
            return;
        }
        await this.summarizeAllFilteredNews({ forceRefresh: true });
    }

    /**
     * After render: show summaries from IndexedDB (same TTL as generateSummary) so reload keeps them visible.
     * @param {Array<{ id: string, url?: string }>} items
     */
    async hydrateCachedSummariesForItems(items) {
        if (!items || items.length === 0) {
            return;
        }
        try {
            const maxAgeMs = this.summarizer.getSummaryCacheMaxAgeMs();
            await Promise.all(
                items.map(async (item) => {
                    const url = App.articlePrimaryUrl(item);
                    if (!url || !item.id) {
                        return;
                    }

                    const summaryDiv = document.getElementById(`summary-${item.id}`);
                    if (!summaryDiv) {
                        return;
                    }
                    const toggleBtn = summaryDiv.closest('.news-card')?.querySelector('.summary-toggle');

                    const cached = await this.summarizer.getCachedSummaryForDisplay(url);
                    let panelOpened = false;
                    if (cached != null && cached.summary?.trim() && toggleBtn) {
                        this.renderAiSummaryOnCard(summaryDiv, cached);
                        summaryDiv.classList.add('active');
                        toggleBtn.textContent = 'Zusammenfassung ausblenden';
                        panelOpened = true;
                    }

                    if (this.storage && this.storage.db) {
                        const articleKey = App.articleFlagKey(item);
                        if (!articleKey) {
                            return;
                        }
                        try {
                            const rd = await this.storage.getRedditThreadsWithMeta(articleKey);
                            if (rd && Array.isArray(rd.threads) && rd.threads.length > 0) {
                                const cachedAtMs = new Date(rd.cachedAt || 0).getTime();
                                const ageOk =
                                    maxAgeMs === Infinity ||
                                    (Number.isFinite(cachedAtMs) && Date.now() - cachedAtMs <= maxAgeMs);
                                if (ageOk) {
                                    this.renderRedditThreadsOnCard(summaryDiv, rd.threads);
                                    if (!panelOpened) {
                                        summaryDiv.classList.add('active');
                                        if (toggleBtn) {
                                            toggleBtn.textContent = 'Zusammenfassung ausblenden';
                                        }
                                    }
                                }
                            }
                        } catch (re) {
                            console.warn('hydrateRedditThreads:', re);
                        }
                    }
                })
            );
        } catch (e) {
            console.warn('hydrateCachedSummariesForItems:', e);
        }
    }

    createNewsCardHTML(item) {
        const timeDisplay = item.timestamp || 'Aktuell';
        const isNew = this._newArticleIds && this._newArticleIds.has(item.id);
        const newClass = isNew ? ' news-card--new' : '';
        const badge = isNew
            ? `<span class="news-card-new-badge">${this.escapeHtml(this._i18nNewsBadge || 'Neu')}</span>`
            : '';
        const ariaNew = isNew
            ? ` aria-label="${this.escapeHtml(this._i18nNewsAria || 'Neuer Artikel seit der letzten Aktualisierung')}"`
            : '';
        const favoriteLabel = item.isFavorite ? 'Favorit entfernen' : 'Als Favorit markieren';
        const hideLabel = item.isHidden ? 'Einblenden' : 'Ausblenden';
        const starIcon = item.isFavorite ? '★' : '☆';
        const hideIcon = item.isHidden ? '👁️' : '🙈';
        const titleFavoriteMarker = item.isFavorite
            ? '<span class="news-favorite-marker" title="Favorit" aria-hidden="true">★</span>'
            : '';

        return `
            <article class="news-card${newClass}" data-id="${item.id}"${ariaNew}>
                <div class="news-header">
                    <div class="news-header-main">
                        ${badge}
                        <span class="category-badge">${item.categoryName}</span>
                        <span class="forum-mood-wrap" hidden>
                            <span class="forum-mood-label"></span>
                            <span class="forum-mood-emoji" aria-hidden="true"></span>
                        </span>
                    </div>
                    <span class="news-time">${timeDisplay}</span>
                </div>

                <h3 class="news-title">
                    <a href="${item.link}" target="_blank" rel="noopener noreferrer">
                        ${titleFavoriteMarker}
                        ${this.escapeHtml(item.title)}
                    </a>
                </h3>

                <div class="summary-actions">
                    <button type="button" class="article-flag-btn article-favorite-btn" title="${favoriteLabel}" aria-label="${favoriteLabel}">
                        ${starIcon}
                    </button>
                    <button type="button" class="article-flag-btn article-hide-btn" title="${hideLabel}" aria-label="${hideLabel}">
                        ${hideIcon}
                    </button>
                    <button type="button" class="summary-toggle" data-url="${encodeURIComponent(item.url || item.link || '')}">
                        Zusammenfassung anzeigen
                    </button>
                    <button type="button" class="summary-refresh-btn" data-url="${encodeURIComponent(item.url || item.link || '')}" title="Cache leeren und Zusammenfassung neu von der KI erzeugen">
                        Neu erstellen
                    </button>
                    <button type="button" class="youtube-toggle" data-url="${encodeURIComponent(item.url || item.link || '')}" title="${this.escapeHtml(this._i18nYoutubeBtnTitle || 'YouTube search suggestions')}">
                        ▶ YouTube
                    </button>
                    <button type="button" class="article-web-search-btn" data-article-id="${this.escapeHtml(item.id)}" title="${this.escapeHtml(this._i18nWebSearchTitle)}">
                        ${this.escapeHtml(this._i18nWebSearchBtn)}
                    </button>
                    <button type="button" class="article-reddit-search-btn" data-article-id="${this.escapeHtml(item.id)}" title="${this.escapeHtml(this._i18nRedditSearchTitle)}">
                        ${this.escapeHtml(this._i18nRedditSearchBtn)}
                    </button>
                </div>

                <div class="news-comments-row" data-article-url="${this.escapeHtml(item.url || item.link || '')}" aria-live="polite"></div>

                <div class="news-summary" id="summary-${item.id}">
                    <span class="ai-badge">🤖 KI-Zusammenfassung</span>
                    <p class="summary-content"></p>
                    <div class="summary-alt-links-block" hidden>
                        <div class="summary-alt-links-toolbar" hidden>
                            <span class="summary-alt-links-count" aria-live="polite"></span>
                            <div class="summary-alt-links-actions">
                                <button type="button" class="summary-alt-links-toggle-btn" hidden aria-expanded="false" aria-controls="alt-links-${item.id}" title="${this.escapeHtml(this._i18nAltLinksBtnShow)}" aria-label="${this.escapeHtml(this._i18nAltLinksBtnShow)}">▼</button>
                                <button type="button" class="summary-alt-links-refresh-btn" hidden title="${this.escapeHtml(this._i18nAltLinksRefresh)}" aria-label="${this.escapeHtml(this._i18nAltLinksRefresh)}">↻</button>
                            </div>
                        </div>
                        <ul class="summary-alt-links-list" id="alt-links-${item.id}" hidden></ul>
                    </div>
                    <div class="summary-reddit-block" hidden>
                        <ul class="summary-reddit-list" id="reddit-links-${item.id}"></ul>
                    </div>
                </div>
            </article>
        `;
    }

    async toggleFavorite(event) {
        const btn = event.currentTarget;
        const card = btn ? btn.closest('.news-card') : null;
        const cardId = card && card.dataset ? card.dataset.id : '';
        if (!cardId) {
            return;
        }
        const item = this.resolveNewsItemForSummary(cardId, '');
        if (!item) {
            return;
        }
        const next = !(item.isFavorite === true);
        item.isFavorite = next;
        await this.saveArticleFlagsForItem(item, { isFavorite: next });
        await this.applySortPipeline({ render: true });
        this.showStatus(next ? 'Als Favorit markiert.' : 'Favorit entfernt.');
    }

    async toggleHidden(event) {
        const btn = event.currentTarget;
        const card = btn ? btn.closest('.news-card') : null;
        const cardId = card && card.dataset ? card.dataset.id : '';
        if (!cardId) {
            return;
        }
        const item = this.resolveNewsItemForSummary(cardId, '');
        if (!item) {
            return;
        }
        const next = !(item.isHidden === true);
        item.isHidden = next;
        await this.saveArticleFlagsForItem(item, { isHidden: next });
        await this.applySortPipeline({ render: true });
        if (next) {
            this.showStatus('Artikel ausgeblendet. Über Sortierung „Ausgeblendete“ wieder sichtbar.');
        } else {
            this.showStatus('Artikel wieder eingeblendet.');
        }
    }

    /**
     * Initialer KI-Verbindungstest: prüft GET /v1/models oder eine Test-Anfrage.
     * @returns {Promise<'ok'|'err'>}
     */
    async testKiConnection() {
        const dot = this.elements.kiStatusDot;
        if (!dot) {
            return 'unknown';
        }

        try {
            const apiMode = this.settings?.kiApiMode || 'lm_rest_v1';
            let baseUrl = this.settings?.apiBaseUrl || '';

            // Dev-Server same-origin: http://127.0.0.1:* (automatisch erkannt)
            if (this._devServerDetected && baseUrl === '') {
                baseUrl = window.location.origin;
            }

            if (!baseUrl) {
                console.warn('KI-Server URL nicht gesetzt — Status bleibt grau.');
                return 'unknown';
            }

            // Test: GET /v1/models (OpenAI-kompatibel oder LM Studio v1)
            const url = apiMode === 'openai' ? `${baseUrl}/v1/models` : `${baseUrl}/api/v1/models`;

            const resp = await fetch(url, { method: 'GET', headers: this._getAuthHeaders() });
            if (resp.ok && resp.status === 200) {
                dot.classList.remove('ki-status-dot--err');
                dot.classList.add('ki-status-dot--ok');
                console.log('KI-Verbindung ok — Status-Punkt grün.');
                return 'ok';
            } else {
                dot.classList.remove('ki-status-dot--ok');
                dot.classList.add('ki-status-dot--err');
                console.warn('KI-Server Antwort nicht 200 OK — Status-Punkt rot.');
                return 'err';
            }
        } catch (error) {
            // CORS-Fehler oder HTTP-Fehler → Status-Punkt grau (unknown), aber kein Fehler-Meldung
            dot.classList.remove('ki-status-dot--ok', 'ki-status-dot--err');
            console.log('KI-Verbindungstest fehlgeschlagen (CORS/HTTP): Status bleibt grau.');
            return 'unknown';
        }
    }

    /**
     * KI-Status (Header-Punkt): unknown = grau, ok = grün, err = rot.
     * @param {'unknown'|'ok'|'err'} state
     */
    updateKiStatus(state) {
        const dot = this.elements.kiStatusDot;
        if (!dot) {
            return;
        }
        dot.classList.remove('ki-status-dot--ok', 'ki-status-dot--err');
        if (state === 'ok') {
            dot.classList.add('ki-status-dot--ok');
        } else if (state === 'err') {
            dot.classList.add('ki-status-dot--err');
        }
    }

    /** API returns this prefix when fetch/HTTP failed but was caught in summarizer */
    static isAiFailureMessage(text) {
        const s =
            text &&
            typeof text === 'object' &&
            text !== null &&
            typeof text.summary === 'string'
                ? text.summary
                : text;
        return typeof s === 'string' && s.startsWith('Zusammenfassung nicht möglich:');
    }

    /**
     * @param {HTMLElement} summaryDiv — `.news-summary`
     */
    /**
     * @param {HTMLElement} summaryDiv
     * @param {{ keepReddit?: boolean }} [opts]
     */
    clearSummaryAltLinks(summaryDiv, opts) {
        const block = summaryDiv.querySelector('.summary-alt-links-block');
        const toolbar = summaryDiv.querySelector('.summary-alt-links-toolbar');
        const countEl = summaryDiv.querySelector('.summary-alt-links-count');
        const toggleBtn = summaryDiv.querySelector('.summary-alt-links-toggle-btn');
        const refreshBtn = summaryDiv.querySelector('.summary-alt-links-refresh-btn');
        const list = summaryDiv.querySelector('.summary-alt-links-list');
        if (block) {
            block.hidden = true;
        }
        if (toolbar) {
            toolbar.hidden = true;
        }
        if (countEl) {
            countEl.textContent = '';
        }
        if (toggleBtn) {
            toggleBtn.hidden = true;
            toggleBtn.setAttribute('aria-expanded', 'false');
            toggleBtn.textContent = '▼';
            toggleBtn.title = this._i18nAltLinksBtnShow;
            toggleBtn.setAttribute('aria-label', this._i18nAltLinksBtnShow);
        }
        if (refreshBtn) {
            refreshBtn.hidden = true;
        }
        if (list) {
            list.innerHTML = '';
            list.hidden = true;
            list.classList.remove('summary-alt-links-list--expanded');
        }
        if (!(opts && opts.keepReddit)) {
            this.clearSummaryRedditBlock(summaryDiv);
        }
    }

    /**
     * @param {HTMLElement} summaryDiv
     */
    clearSummaryRedditBlock(summaryDiv) {
        const block = summaryDiv.querySelector('.summary-reddit-block');
        const list = summaryDiv.querySelector('.summary-reddit-list');
        if (list) {
            list.innerHTML = '';
        }
        if (block) {
            block.hidden = true;
        }
    }

    /**
     * @param {HTMLElement} summaryDiv
     * @param {Array<{ title?: string, url: string }>} threads
     */
    renderRedditThreadsOnCard(summaryDiv, threads) {
        const block = summaryDiv.querySelector('.summary-reddit-block');
        const list = summaryDiv.querySelector('.summary-reddit-list');
        if (!block || !list) {
            return;
        }
        const rows = Array.isArray(threads) ? threads.slice(0, 5) : [];
        if (rows.length === 0) {
            this.clearSummaryRedditBlock(summaryDiv);
            return;
        }
        const fav = App.redditFaviconUrl();
        const itemsHtml = rows
            .map((t) => {
                const u = t && typeof t.url === 'string' ? t.url.trim() : '';
                if (!u || !/^https?:\/\//i.test(u)) {
                    return '';
                }
                const tit =
                    t && typeof t.title === 'string' && t.title.trim() ? t.title.trim() : u;
                const img = `<img class="summary-reddit-logo" src="${this.escapeHtml(fav)}" width="16" height="16" alt="" loading="lazy" decoding="async" />`;
                return `<li class="summary-reddit-item"><a class="summary-reddit-link" href="${this.escapeHtml(u)}" target="_blank" rel="noopener noreferrer">${img}<span class="summary-reddit-line">${this.escapeHtml(tit)}</span></a></li>`;
            })
            .filter(Boolean)
            .join('');
        list.innerHTML = itemsHtml ? this.sanitizeHtml(itemsHtml) : '';
        block.hidden = !itemsHtml;
    }

    /**
     * @param {string} cardId
     * @param {HTMLElement} [triggerBtn]
     * @returns {Promise<void>}
     */
    async searchRedditForArticle(cardId, triggerBtn) {
        const item = this.resolveNewsItemForSummary(cardId, '');
        const title = item && item.title ? String(item.title).trim() : '';
        if (!title) {
            this.showStatus(this._i18nRedditNoTitle, true);
            return;
        }
        const summaryDiv = document.getElementById(`summary-${cardId}`);
        if (!summaryDiv) {
            return;
        }
        const card = summaryDiv.closest('.news-card');
        const toggleBtn = card ? card.querySelector('.summary-toggle') : null;

        const prevLabel = triggerBtn ? triggerBtn.textContent : '';
        if (triggerBtn) {
            triggerBtn.disabled = true;
            triggerBtn.textContent = '…';
        }

        summaryDiv.classList.add('active');
        if (toggleBtn) {
            toggleBtn.textContent = 'Zusammenfassung ausblenden';
        }

        try {
            if (typeof window === 'undefined' || !window.location || window.location.protocol === 'file:') {
                this.showStatus(this._i18nRedditError, true);
                return;
            }
            const origin = window.location.origin;
            if (origin === 'null' || String(origin).startsWith('file')) {
                this.showStatus(this._i18nRedditError, true);
                return;
            }
            const reasoning = this.summarizer ? this.summarizer.getLmReasoningLevel() : 'off';
            const params = new URLSearchParams({ q: title, limit: '5', ai: '1', reasoning });
            const r = await fetch(`${origin}/api/reddit-search?${params}`, {
                method: 'GET',
                cache: 'no-store',
                credentials: 'same-origin'
            });
            const data = await r.json();
            console.info(
                '[reddit] response: ok=%s, results=%d, ai=%s, search=%s',
                data?.ok, (data?.results || []).length,
                data?.ai_enhanced || false, data?.query_search || ''
            );
            if (!data || data.ok !== true) {
                this.clearSummaryRedditBlock(summaryDiv);
                const err = data && data.error ? String(data.error) : '';
                this.showStatus(err ? `${this._i18nRedditError} (${err})` : this._i18nRedditError, true);
                return;
            }
            const results = Array.isArray(data.results) ? data.results : [];
            if (results.length === 0) {
                this.clearSummaryRedditBlock(summaryDiv);
                this.showStatus(this._i18nRedditNone, true);
                return;
            }
            this.renderRedditThreadsOnCard(summaryDiv, results);
            const rb = summaryDiv.querySelector('.summary-reddit-block');
            if (!rb || rb.hidden) {
                this.clearSummaryRedditBlock(summaryDiv);
                this.showStatus(this._i18nRedditNone, true);
                return;
            }
            const aiQueries = Array.isArray(data.ai_queries) ? data.ai_queries : [];

            const cacheKey = App.articleFlagKey(item);
            if (cacheKey && this.storage && this.storage.db) {
                this.storage.saveRedditThreads(cacheKey, results, aiQueries).catch(
                    (err) => console.warn('saveRedditThreads:', err)
                );
            }

            let statusMsg;
            const foundTpl = String(this._i18nRedditFound || '{count}');
            if (aiQueries.length > 0) {
                const aiTpl = String(this._i18nRedditFoundAi || '{count}');
                statusMsg = aiTpl
                    .replace(/\{count\}/g, String(results.length))
                    .replace(/\{queries\}/g, aiQueries.join(', '));
            } else {
                statusMsg = foundTpl.replace(/\{count\}/g, String(results.length));
            }
            this.showStatus(statusMsg);
        } catch (e) {
            console.error('searchRedditForArticle:', e);
            this.clearSummaryRedditBlock(summaryDiv);
            this.showStatus(this._i18nRedditError, true);
        } finally {
            if (triggerBtn) {
                triggerBtn.disabled = false;
                triggerBtn.textContent = prevLabel || this._i18nRedditSearchBtn;
            }
        }
    }

    /**
     * @param {number} n
     * @returns {string}
     */
    formatAltLinksCount(n) {
        const tpl = String(this._i18nAltLinksCount || '{count}');
        return tpl.replace(/\{count\}/g, String(n));
    }

    /**
     * @returns {string[]}
     */
    getAlternativeLinksBlacklistDomains() {
        let raw = (this.settings && this.settings.alternativeLinksDomainBlacklist) || '';
        if (!raw && typeof localStorage !== 'undefined') {
            try {
                raw = localStorage.getItem('heise_alternative_links_blacklist') || '';
            } catch (_) {
                raw = '';
            }
        }
        return App.parseAlternativeLinksDomainBlacklist(raw);
    }

    /**
     * @param {string} url
     * @returns {boolean}
     */
    isAlternativeLinkBlockedByUserBlacklist(url) {
        try {
            const host = new URL(String(url || '').trim()).hostname.toLowerCase().replace(/^www\./, '');
            const blocked = this.getAlternativeLinksBlacklistDomains();
            for (const dom of blocked) {
                const d = String(dom || '').toLowerCase().replace(/^www\./, '');
                if (!d) {
                    continue;
                }
                if (host === d || host.endsWith(`.${d}`)) {
                    return true;
                }
            }
        } catch (_) {
            /* ignore malformed URL and keep link */
        }
        return false;
    }

    /**
     * @param {HTMLElement} summaryDiv
     * @param {string | { summary: string, alternativeLinks?: Array<{ title: string, url: string }> }} result
     * @param {{ expandAltList?: boolean }} [options] — `expandAltList`: expand after user refreshed alt links; otherwise visibility follows `settings.alternativeLinksDisplayMode` (expanded vs collapsed).
     */
    renderAiSummaryOnCard(summaryDiv, result, options = {}) {
        const summaryContent = summaryDiv.querySelector('.summary-content');
        const block = summaryDiv.querySelector('.summary-alt-links-block');
        const toolbar = summaryDiv.querySelector('.summary-alt-links-toolbar');
        const countEl = summaryDiv.querySelector('.summary-alt-links-count');
        const toggleBtn = summaryDiv.querySelector('.summary-alt-links-toggle-btn');
        const refreshBtn = summaryDiv.querySelector('.summary-alt-links-refresh-btn');
        const list = summaryDiv.querySelector('.summary-alt-links-list');
        const expandAfterRefresh = options && options.expandAltList === true;
        const displayMode = App.normalizeAlternativeLinksDisplayMode(
            this.settings && this.settings.alternativeLinksDisplayMode
        );
        const expandedBySetting = displayMode === 'expanded';
        if (!summaryContent) {
            return;
        }
        const text =
            typeof result === 'object' && result !== null && typeof result.summary === 'string'
                ? result.summary
                : String(result ?? '');
        summaryContent.textContent = text;
        const links =
            typeof result === 'object' &&
            result !== null &&
            Array.isArray(result.alternativeLinks) &&
            result.alternativeLinks.length > 0
                ? result.alternativeLinks
                : [];

        if (block && toolbar && countEl && toggleBtn && refreshBtn && list) {
            const cardEl = summaryDiv.closest('.news-card');
            const urlRow = cardEl ? cardEl.querySelector('.news-comments-row[data-article-url]') : null;
            const articleUrlForFilter = urlRow ? urlRow.getAttribute('data-article-url') || '' : '';
            const filtered =
                links.length > 0
                    ? links
                          .filter(
                              (l) =>
                                  l &&
                                  typeof l.url === 'string' &&
                                  l.url.trim() &&
                                  AISummarizer.isPlausibleArticleUrl(l.url.trim())
                          )
                          .filter(
                              (l) =>
                                  !AISummarizer.shouldExcludeAlternativeLinkUrl(
                                      l.url.trim(),
                                      articleUrlForFilter
                                  )
                          )
                          .filter((l) => !this.isAlternativeLinkBlockedByUserBlacklist(l.url.trim()))
                    : [];

            if (filtered.length === 0) {
                block.hidden = false;
                toolbar.hidden = false;
                countEl.textContent = this.formatAltLinksCount(0);
                toggleBtn.hidden = true;
                toggleBtn.setAttribute('aria-expanded', 'false');
                toggleBtn.textContent = '▼';
                toggleBtn.title = this._i18nAltLinksBtnShow;
                toggleBtn.setAttribute('aria-label', this._i18nAltLinksBtnShow);
                refreshBtn.hidden = false;
                list.innerHTML = '';
                list.hidden = true;
                list.classList.remove('summary-alt-links-list--expanded');
                return;
            }

            block.hidden = false;
            toolbar.hidden = false;
            countEl.textContent = this.formatAltLinksCount(filtered.length);
            toggleBtn.hidden = false;
            refreshBtn.hidden = false;

            const itemsHtml = filtered
                .map((l) => {
                    const u = l.url.trim();
                    const src =
                        typeof l.source === 'string' && l.source.trim() ? l.source.trim() : '';
                    const headline =
                        typeof l.title === 'string' && l.title.trim() ? l.title.trim() : u;
                    const fav = App.faviconUrlForArticleLink(u);
                    const img = fav
                        ? `<img class="summary-alt-link-favicon" src="${this.escapeHtml(fav)}" width="16" height="16" alt="" loading="lazy" decoding="async" />`
                        : '';
                    const lineInner = src
                        ? `<span class="summary-alt-link-source">${this.escapeHtml(src)}:</span><span class="summary-alt-link-title">${this.escapeHtml(headline)}</span>`
                        : `<span class="summary-alt-link-title">${this.escapeHtml(headline)}</span>`;
                    return `<li class="summary-alt-link-item"><a class="summary-alt-link" href="${this.escapeHtml(u)}" target="_blank" rel="noopener noreferrer">${img}<span class="summary-alt-link-line">${lineInner}</span></a></li>`;
                })
                .join('');
            list.innerHTML = this.sanitizeHtml(itemsHtml);

            const showListExpanded = expandAfterRefresh || expandedBySetting;
            if (showListExpanded) {
                list.hidden = false;
                list.classList.add('summary-alt-links-list--expanded');
                toggleBtn.setAttribute('aria-expanded', 'true');
                toggleBtn.textContent = '▲';
                toggleBtn.title = this._i18nAltLinksBtnHide;
                toggleBtn.setAttribute('aria-label', this._i18nAltLinksBtnHide);
            } else {
                list.hidden = true;
                list.classList.remove('summary-alt-links-list--expanded');
                toggleBtn.setAttribute('aria-expanded', 'false');
                toggleBtn.textContent = '▼';
                toggleBtn.title = this._i18nAltLinksBtnShow;
                toggleBtn.setAttribute('aria-label', this._i18nAltLinksBtnShow);
            }
        }
    }

    /**
     * Runs a fresh Bing News search for alternative links, replaces cached links for this article, and re-renders.
     * @param {HTMLElement} summaryDiv
     * @param {HTMLElement} [triggerBtn]
     * @returns {Promise<void>}
     */
    async refreshAlternativeLinksForCard(summaryDiv, triggerBtn) {
        const card = summaryDiv ? summaryDiv.closest('.news-card') : null;
        const cardId = card && card.dataset ? card.dataset.id : '';
        const urlRow = card ? card.querySelector('.news-comments-row[data-article-url]') : null;
        const fallbackUrl = urlRow ? (urlRow.getAttribute('data-article-url') || '').trim() : '';
        const item = this.resolveNewsItemForSummary(cardId, fallbackUrl);
        const url = App.articlePrimaryUrl(item) || fallbackUrl;
        const trimmedUrl = (url || '').trim();
        if (!trimmedUrl || !this.summarizer) {
            this.showStatus(this._i18nAltLinksErrNoUrl, true);
            return;
        }
        const title = item && item.title ? String(item.title).trim() : '';
        const description = item && item.description ? String(item.description).trim() : '';
        const legacyKey = AISummarizer.normalizeArticleUrlKey(trimmedUrl);
        const promptUrl =
            AISummarizer.canonicalSummaryCacheKey(trimmedUrl) || legacyKey || trimmedUrl;

        await this.summarizer._ensureStorageReady();
        let summaryText = '';
        let saveKey = '';
        try {
            const { entry, storageKey } = await this.summarizer._getSummaryEntryForCacheLookup(trimmedUrl);
            summaryText = entry && typeof entry.summary === 'string' ? entry.summary.trim() : '';
            saveKey =
                (storageKey && String(storageKey).trim()) ||
                AISummarizer.canonicalSummaryCacheKey(trimmedUrl) ||
                legacyKey ||
                trimmedUrl;
        } catch (e) {
            console.warn('refreshAlternativeLinksForCard: cache lookup failed', e);
            saveKey =
                AISummarizer.canonicalSummaryCacheKey(trimmedUrl) || legacyKey || trimmedUrl;
        }
        const sc = summaryDiv.querySelector('.summary-content');
        if (!summaryText.trim() && sc) {
            summaryText = (sc.textContent || '').trim();
        }
        if (!summaryText) {
            this.showStatus(this._i18nAltLinksErrNoSummary, true);
            return;
        }

        const toggleBtn = summaryDiv.querySelector('.summary-alt-links-toggle-btn');
        const refreshBtn = triggerBtn && triggerBtn.classList.contains('summary-alt-links-refresh-btn')
            ? triggerBtn
            : summaryDiv.querySelector('.summary-alt-links-refresh-btn');
        const prevRefresh = refreshBtn ? refreshBtn.textContent : '';
        const prevToggleDisabled = toggleBtn ? toggleBtn.disabled : false;
        const prevRefreshDisabled = refreshBtn ? refreshBtn.disabled : false;
        if (toggleBtn) {
            toggleBtn.disabled = true;
        }
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.textContent = '…';
        }

        try {
            let raw = await this.summarizer.fetchAlternativeLinksFromBingNewsSearch(
                title,
                description,
                promptUrl
            );
            const altWant = this.summarizer.getAlternativeLinksSearchResultCount();
            if (Array.isArray(raw) && raw.length > 0) {
                raw = await this.summarizer.filterAlternativeLinksByServerProbe(raw, altWant);
            } else {
                raw = [];
            }
            if (Array.isArray(raw) && raw.length > 0) {
                raw = raw.filter((row) => {
                    const u = row && typeof row.url === 'string' ? row.url.trim() : '';
                    return u ? !this.isAlternativeLinkBlockedByUserBlacklist(u) : false;
                });
            }
            try {
                await this.storage.saveSummary(saveKey, summaryText.trim(), raw);
            } catch (e) {
                console.warn('refreshAlternativeLinksForCard: save failed', e);
            }
            this.renderAiSummaryOnCard(
                summaryDiv,
                {
                    summary: summaryText.trim(),
                    alternativeLinks: raw
                },
                { expandAltList: raw.length > 0 }
            );
            if (raw.length === 0) {
                this.showStatus(this._i18nAltLinksRefreshNone, true);
            } else {
                this.showStatus(this._i18nAltLinksRefreshDone);
            }
        } catch (e) {
            console.error('refreshAlternativeLinksForCard:', e);
            this.showStatus(String(e && e.message ? e.message : e), true);
        } finally {
            if (toggleBtn) {
                toggleBtn.disabled = prevToggleDisabled;
            }
            if (refreshBtn) {
                refreshBtn.disabled = prevRefreshDisabled;
                refreshBtn.textContent = prevRefresh || '↻';
            }
        }
    }

    async toggleSummary(event) {
        const button = event.currentTarget;
        if (!button || !(button instanceof HTMLElement)) {
            return;
        }

        const rawAttr = button.getAttribute('data-url');
        let url = '';
        if (rawAttr) {
            try {
                url = decodeURIComponent(rawAttr).trim();
            } catch {
                url = rawAttr.trim();
            }
        }
        const card = button.closest('.news-card');
        const cardId = card ? card.dataset.id : '';

        if (!url) {
            console.warn('toggleSummary: fehlende data-url (Klick nicht auf Button-Element?)');
        }

        const summaryDiv = cardId ? document.getElementById(`summary-${cardId}`) : null;
        const summaryContent = summaryDiv ? summaryDiv.querySelector('.summary-content') : null;

        if (!summaryDiv || !summaryContent) {
            console.error('toggleSummary: Summary-Bereich nicht gefunden', cardId);
            return;
        }

        // Check if already loaded and visible
        if (summaryDiv.classList.contains('active')) {
            summaryDiv.classList.remove('active');
            button.textContent = 'Zusammenfassung anzeigen';
            return;
        }

        // Show loading state
        button.disabled = true;
        button.innerHTML = '<span class="summary-loading">Lade Zusammenfassung...</span>';

        try {
            if (!url) {
                throw new Error('Keine Artikel-URL am Button (interner UI-Fehler).');
            }

            const item = this.resolveNewsItemForSummary(cardId, url);
            const title = item?.title || '';
            const description = item?.description || '';

            // Generate or retrieve summary (cached in IndexedDB until TTL — see KI settings)
            const summary = await this.summarizer.generateSummary(url, title, description, {
                forceRefresh: false
            });

            const failed = App.isAiFailureMessage(summary);
            const display =
                summary && typeof summary === 'object' && typeof summary.summary === 'string'
                    ? summary.summary.trim()
                    : '';

            if (failed) {
                const errText =
                    summary && typeof summary === 'object' && typeof summary.summary === 'string'
                        ? summary.summary
                        : String(summary);
                this.clearSummaryAltLinks(summaryDiv, { keepReddit: true });
                summaryContent.innerHTML = this.sanitizeHtml(`<span style="color: var(--primary-color);">${this.escapeHtml(errText)}</span>`);
                this.updateKiStatus('err');
                button.textContent = 'Zusammenfassung erneut versuchen';
            } else if (!display) {
                this.clearSummaryAltLinks(summaryDiv, { keepReddit: true });
                summaryContent.innerHTML =
                    '<span style="color: var(--primary-color);">Zusammenfassung leer — bitte „Neu erstellen“ oder Modell prüfen.</span>';
                this.updateKiStatus('err');
                button.textContent = 'Zusammenfassung erneut versuchen';
            } else {
                this.renderAiSummaryOnCard(summaryDiv, summary);
                this.updateKiStatus('ok');
                button.textContent = 'Zusammenfassung ausblenden';
            }

            summaryDiv.classList.add('active');
        } catch (error) {
            console.error('Error toggling summary:', error);
            this.clearSummaryAltLinks(summaryDiv, { keepReddit: true });
            summaryContent.innerHTML = this.sanitizeHtml(`<span style="color: var(--primary-color);">Fehler beim Laden der Zusammenfassung: ${this.escapeHtml(error.message || String(error))}</span>`);
            summaryDiv.classList.add('active');
            button.textContent = 'Zusammenfassung erneut versuchen';
            this.updateKiStatus('err');
        } finally {
            button.disabled = false;
        }
    }

    /**
     * Force new AI summary (ignores cache until save overwrites).
     */
    async refreshSummary(event) {
        event.preventDefault();
        event.stopPropagation();

        const btn = event.currentTarget;
        if (!btn || !(btn instanceof HTMLElement)) {
            return;
        }

        const rawAttr = btn.getAttribute('data-url');
        let url = '';
        if (rawAttr) {
            try {
                url = decodeURIComponent(rawAttr).trim();
            } catch {
                url = rawAttr.trim();
            }
        }
        const card = btn.closest('.news-card');
        const cardId = card ? card.dataset.id : '';

        const summaryDiv = cardId ? document.getElementById(`summary-${cardId}`) : null;
        const summaryContent = summaryDiv ? summaryDiv.querySelector('.summary-content') : null;
        const toggleBtn = card ? card.querySelector('.summary-toggle') : null;

        if (!url || !summaryDiv || !summaryContent || !toggleBtn) {
            console.error('refreshSummary: UI nicht gefunden', cardId);
            return;
        }

        const item = this.resolveNewsItemForSummary(cardId, url);
        const title = item?.title || '';
        const description = item?.description || '';

        const prevLabel = btn.textContent;
        btn.disabled = true;
        toggleBtn.disabled = true;
        btn.textContent = '…';
        summaryDiv.classList.add('active');
        summaryContent.innerHTML = '<span class="summary-loading">KI erzeugt neu…</span>';

        try {
            const summary = await this.summarizer.generateSummary(url, title, description, {
                forceRefresh: true
            });

            const failed = App.isAiFailureMessage(summary);
            const display =
                summary && typeof summary === 'object' && typeof summary.summary === 'string'
                    ? summary.summary.trim()
                    : '';

            if (failed) {
                const errText =
                    summary && typeof summary === 'object' && typeof summary.summary === 'string'
                        ? summary.summary
                        : String(summary);
                this.clearSummaryAltLinks(summaryDiv, { keepReddit: true });
                summaryContent.innerHTML = `<span style="color: var(--primary-color);">${this.escapeHtml(errText)}</span>`;
                this.updateKiStatus('err');
                toggleBtn.textContent = 'Zusammenfassung anzeigen';
            } else if (!display) {
                this.clearSummaryAltLinks(summaryDiv, { keepReddit: true });
                summaryContent.innerHTML =
                    '<span style="color: var(--primary-color);">Zusammenfassung leer — bitte „Neu erstellen“ oder Modell prüfen.</span>';
                this.updateKiStatus('err');
                toggleBtn.textContent = 'Zusammenfassung erneut versuchen';
            } else {
                this.renderAiSummaryOnCard(summaryDiv, summary);
                this.updateKiStatus('ok');
                toggleBtn.textContent = 'Zusammenfassung ausblenden';
            }
        } catch (error) {
            console.error('refreshSummary:', error);
            this.clearSummaryAltLinks(summaryDiv, { keepReddit: true });
            summaryContent.innerHTML = this.sanitizeHtml(`<span style="color: var(--primary-color);">Fehler: ${this.escapeHtml(error.message || String(error))}</span>`);
            this.updateKiStatus('err');
            toggleBtn.textContent = 'Zusammenfassung anzeigen';
        } finally {
            btn.disabled = false;
            toggleBtn.disabled = false;
            btn.textContent = prevLabel || 'Neu erstellen';
        }
    }

    /**
     * Fills summary text on a card if it exists in the DOM (batch job progress).
     * @param {string} itemId
     * @param {string} summary
     * @param {boolean} failed
     */
    _updateCardSummaryIfVisible(itemId, summary, failed) {
        if (!itemId) {
            return;
        }
        const summaryDiv = document.getElementById(`summary-${itemId}`);
        if (!summaryDiv) {
            return;
        }
        const summaryContent = summaryDiv.querySelector('.summary-content');
        if (!summaryContent) {
            return;
        }
        const card = summaryDiv.closest('.news-card');
        const toggleBtn = card ? card.querySelector('.summary-toggle') : null;

        if (failed) {
            const errText =
                summary && typeof summary === 'object' && typeof summary.summary === 'string'
                    ? summary.summary
                    : String(summary);
            this.clearSummaryAltLinks(summaryDiv, { keepReddit: true });
            summaryContent.innerHTML = this.sanitizeHtml(`<span style="color: var(--primary-color);">${this.escapeHtml(errText)}</span>`);
            if (toggleBtn) {
                toggleBtn.textContent = 'Zusammenfassung erneut versuchen';
            }
        } else {
            this.renderAiSummaryOnCard(summaryDiv, summary);
            if (toggleBtn) {
                toggleBtn.textContent = 'Zusammenfassung ausblenden';
            }
        }
        summaryDiv.classList.add('active');
    }

    /**
     * After fetch: generate and show KI summaries for new articles; on manual refresh, also fill
     * missing summaries for already-known articles (no cache yet).
     * @param {boolean} [forceRefresh] True when user clicked Aktualisieren (not first load).
     */
    async autoSummarizeAfterRefresh(forceRefresh = false) {
        if (this._summarizeAllInProgress || this._autoSummarizeNewInProgress) {
            return;
        }

        const list = this.filteredNewsItems || [];
        if (list.length === 0) {
            return;
        }

        /** @type {Map<string, object>} */
        const toProcess = new Map();
        for (const item of list) {
            if (this._newArticleIds && this._newArticleIds.has(item.id)) {
                toProcess.set(item.id, item);
            }
        }

        if (forceRefresh) {
            const itemsWithUrl = list.filter((item) => App.articlePrimaryUrl(item));
            const cachedResults = await Promise.all(
                itemsWithUrl.map(async (item) => {
                    const url = App.articlePrimaryUrl(item);
                    const cached = await this.summarizer.getCachedSummaryForDisplay(url);
                    return { item, cached };
                })
            );
            for (const { item, cached } of cachedResults) {
                if (cached == null || !cached.summary?.trim()) {
                    toProcess.set(item.id, item);
                }
            }
        }

        if (toProcess.size === 0) {
            return;
        }

        const queue = Array.from(toProcess.values());

        this._autoSummarizeNewInProgress = true;
        let ok = 0;
        let failed = 0;
        const limit = App.normalizeSummaryConcurrency(this.settings?.summaryConcurrency);

        try {
            await App.runWithConcurrency(queue, limit, async (item) => {
                const url = App.articlePrimaryUrl(item);
                if (!url) {
                    failed++;
                    return;
                }

                try {
                    const summary = await this.summarizer.generateSummary(
                        url,
                        item.title || '',
                        item.description || '',
                        { forceRefresh: false }
                    );
                    const isFail = App.isAiFailureMessage(summary);
                    const trimmed =
                        summary && typeof summary === 'object' && typeof summary.summary === 'string'
                            ? summary.summary.trim()
                            : '';
                    if (isFail || !trimmed) {
                        failed++;
                        this._updateCardSummaryIfVisible(
                            item.id,
                            isFail ? summary : 'Zusammenfassung leer — bitte „Neu erstellen“.',
                            true
                        );
                    } else {
                        ok++;
                        this._updateCardSummaryIfVisible(item.id, summary, false);
                    }
                } catch (error) {
                    console.error('autoSummarizeAfterRefresh:', item.url, error);
                    failed++;
                    const msg = `Zusammenfassung nicht möglich: ${error.message || String(error)}`;
                    this._updateCardSummaryIfVisible(item.id, msg, true);
                }

                await App.yieldForUiCooperation();
            });

            if (ok > 0) {
                this.updateKiStatus('ok');
            } else if (failed > 0) {
                this.updateKiStatus('err');
            }

            if (ok > 0 && failed === 0) {
                const tpl =
                    this._i18nNewsAutoSummaryOk ||
                    'KI: {ok} Zusammenfassung(en) erstellt und angezeigt.';
                this.showStatus(tpl.replace(/\{ok\}/g, String(ok)));
            } else if (failed > 0) {
                const tpl =
                    this._i18nNewsAutoSummaryMixed ||
                    'KI: {ok} ok, {failed} fehlgeschlagen.';
                this.showStatus(
                    tpl.replace(/\{ok\}/g, String(ok)).replace(/\{failed\}/g, String(failed)),
                    ok === 0
                );
            }
        } finally {
            this._autoSummarizeNewInProgress = false;
        }
    }

    /**
     * Generate AI summaries for all news items matching the current category filter.
     * Concurrency is capped by settings.summaryConcurrency (KI modal).
     * With forceRefresh: ignores cache (same as „Neu erstellen“ per article).
     * @param {{ forceRefresh?: boolean }} [options]
     */
    async summarizeAllFilteredNews(options = {}) {
        if (this._summarizeAllInProgress || this._autoSummarizeNewInProgress) {
            return;
        }

        const forceRefresh = options.forceRefresh === true;

        const items =
            this.filteredNewsItems && this.filteredNewsItems.length > 0 ? this.filteredNewsItems : [];

        if (items.length === 0) {
            this.showStatus('Keine Nachrichten für die aktuellen Filter.', true);
            return;
        }

        const btn = this.elements.summarizeAllBtn;
        const refBtn = this.elements.summarizeAllRefreshBtn;
        const originalLabel = btn ? btn.textContent : '';
        const originalRefLabel = refBtn ? refBtn.textContent : '';
        this._summarizeAllInProgress = true;
        if (btn) {
            btn.disabled = true;
        }
        if (refBtn) {
            refBtn.disabled = true;
        }

        let ok = 0;
        let failed = 0;
        const total = items.length;
        const limit = App.normalizeSummaryConcurrency(this.settings?.summaryConcurrency);
        let done = 0;
        const progressTpl = forceRefresh
            ? this._i18nBatchSummarizeProgressRefresh ||
              'KI neu… ({current}/{total})'
            : this._i18nBatchSummarizeProgress || 'KI… ({current}/{total})';

        const bumpBtn = () => {
            done += 1;
            if (btn) {
                btn.textContent = progressTpl
                    .replace(/\{current\}/g, String(done))
                    .replace(/\{total\}/g, String(total));
            }
        };

        try {
            await App.runWithConcurrency(items, limit, async (item) => {
                try {
                    const url = App.articlePrimaryUrl(item);
                    if (!url) {
                        failed++;
                        return;
                    }

                    try {
                        const summary = await this.summarizer.generateSummary(
                            url,
                            item.title || '',
                            item.description || '',
                            { forceRefresh }
                        );
                        const isFail = App.isAiFailureMessage(summary);
                        const trimmed =
                            summary && typeof summary === 'object' && typeof summary.summary === 'string'
                                ? summary.summary.trim()
                                : '';
                        if (isFail || !trimmed) {
                            failed++;
                            this._updateCardSummaryIfVisible(
                                item.id,
                                isFail ? summary : 'Zusammenfassung leer — bitte „Neu erstellen“.',
                                true
                            );
                        } else {
                            ok++;
                            this._updateCardSummaryIfVisible(item.id, summary, false);
                        }
                    } catch (error) {
                        console.error('summarizeAllFilteredNews:', item.url, error);
                        failed++;
                        const msg = `Zusammenfassung nicht möglich: ${error.message || String(error)}`;
                        this._updateCardSummaryIfVisible(item.id, msg, true);
                    }
                } finally {
                    bumpBtn();
                    await App.yieldForUiCooperation();
                }
            });

            if (ok > 0) {
                this.updateKiStatus('ok');
            } else if (failed > 0) {
                this.updateKiStatus('err');
            } else {
                this.updateKiStatus('unknown');
            }

            this.showStatus(`KI-Stapel: ${ok} ok, ${failed} fehlgeschlagen (${total} gesamt).`, failed > 0 && ok === 0);
        } finally {
            this._summarizeAllInProgress = false;
            if (btn) {
                btn.disabled = false;
                btn.textContent = originalLabel || '🤖 Alle Zusammenfassungen';
            }
            if (refBtn) {
                refBtn.disabled = false;
                refBtn.textContent = originalRefLabel || '🔄 Alle neu erzeugen';
            }
        }
    }

    showLoadingState() {
        this.elements.newsGrid.innerHTML = `
            <div class="skeleton news-card"></div>
            <div class="skeleton news-card"></div>
            <div class="skeleton news-card"></div>
        `;
    }

    showStatus(message, isError = false) {
        const statusBar = document.getElementById('statusBar');
        const flash = document.getElementById('statusFlash');
        if (!statusBar) {
            return;
        }

        if (this._statusFlashTimer) {
            clearTimeout(this._statusFlashTimer);
            this._statusFlashTimer = null;
        }

        if (flash) {
            flash.textContent = message != null ? String(message) : '';
        }

        if (isError) {
            statusBar.style.background = '#ffcccc';
            statusBar.style.color = '#cc0000';
        } else {
            statusBar.style.background = 'var(--bg-secondary)';
            statusBar.style.color = 'var(--text-secondary)';
        }

        this._statusFlashTimer = setTimeout(() => {
            if (flash) {
                flash.textContent = '';
            }
            statusBar.style.background = 'var(--bg-secondary)';
            statusBar.style.color = 'var(--text-secondary)';
            this._statusFlashTimer = null;
        }, 5000);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    }

    applyTheme() {
        let theme = this.settings?.theme || 'system';
        
        if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
    }

    openSettingsModal() {
        let mode = 'lm_rest_v1';
        try {
            mode = localStorage.getItem('heise_ki_api_mode') || this.settings?.kiApiMode || 'lm_rest_v1';
        } catch (_) {
            mode = this.settings?.kiApiMode || 'lm_rest_v1';
        }
        if (mode !== 'openai' && mode !== 'lm_rest_v1') {
            mode = 'lm_rest_v1';
        }
        if (this.elements.kiApiMode) {
            this.elements.kiApiMode.value = mode;
        }

        let base = '';
        try {
            if (mode === 'lm_rest_v1') {
                base =
                    localStorage.getItem('heise_lm_rest_root') ||
                    this.settings?.lmRestRoot ||
                    '';
            } else {
                base = localStorage.getItem('heise_api_base') || this.settings?.apiBaseUrl || '';
            }
        } catch (_) {
            base = mode === 'lm_rest_v1' ? this.settings?.lmRestRoot || '' : this.settings?.apiBaseUrl || '';
        }
        if (!base) {
            base = mode === 'lm_rest_v1' ? 'http://127.0.0.1:1234' : 'http://127.0.0.1:1234/v1';
        }

        this.elements.apiBaseUrl.value =
            mode === 'lm_rest_v1'
                ? AISummarizer.normalizeLmRestServerRoot(base)
                : AISummarizer.normalizeOpenAiApiBase(base);

        let model = '';
        try {
            model = localStorage.getItem('heise_lm_model') || this.settings?.lmModel || '';
        } catch (_) {
            model = this.settings?.lmModel || '';
        }
        this.elements.lmModel.value = model;

        let token = '';
        try {
            token = localStorage.getItem('heise_lm_api_token') || this.settings?.lmApiToken || '';
        } catch (_) {
            token = this.settings?.lmApiToken || '';
        }
        if (this.elements.lmApiToken) {
            this.elements.lmApiToken.value = token;
        }

        let summaryCacheDays = 14;
        try {
            const raw = localStorage.getItem('heise_summary_cache_days');
            if (raw !== null && raw !== '') {
                summaryCacheDays = parseInt(raw, 10);
            } else if (this.settings?.summaryCacheDays != null) {
                summaryCacheDays = parseInt(String(this.settings.summaryCacheDays), 10);
            }
        } catch (_) {
            summaryCacheDays = 14;
        }
        if (!Number.isFinite(summaryCacheDays) || summaryCacheDays < 0) {
            summaryCacheDays = 14;
        }
        if (this.elements.summaryCacheDays) {
            this.elements.summaryCacheDays.value = String(Math.min(3650, summaryCacheDays));
        }

        let summaryConcurrencyUi = App.normalizeSummaryConcurrency(4);
        try {
            const rawSc = localStorage.getItem('heise_summary_concurrency');
            if (rawSc !== null && rawSc !== '') {
                summaryConcurrencyUi = App.normalizeSummaryConcurrency(rawSc);
            } else if (this.settings?.summaryConcurrency != null) {
                summaryConcurrencyUi = App.normalizeSummaryConcurrency(this.settings.summaryConcurrency);
            }
        } catch (_) {
            summaryConcurrencyUi = App.normalizeSummaryConcurrency(4);
        }
        if (this.elements.summaryConcurrency) {
            this.elements.summaryConcurrency.value = String(summaryConcurrencyUi);
        }

        let kiTimeoutUi = App.normalizeKiRequestTimeoutSeconds(120);
        try {
            const rawTo = localStorage.getItem('heise_ki_request_timeout_sec');
            if (rawTo !== null && rawTo !== '') {
                kiTimeoutUi = App.normalizeKiRequestTimeoutSeconds(rawTo);
            } else if (this.settings?.summaryRequestTimeoutSeconds != null) {
                kiTimeoutUi = App.normalizeKiRequestTimeoutSeconds(this.settings.summaryRequestTimeoutSeconds);
            }
        } catch (_) {
            kiTimeoutUi = App.normalizeKiRequestTimeoutSeconds(120);
        }
        if (this.elements.kiRequestTimeoutSeconds) {
            this.elements.kiRequestTimeoutSeconds.value = String(kiTimeoutUi);
        }

        let summaryLangModeUi = 'site';
        try {
            summaryLangModeUi =
                localStorage.getItem('heise_summary_lang_mode') === 'browser' ? 'browser' : 'site';
        } catch (_) {
            summaryLangModeUi = 'site';
        }
        if (this.settings?.summaryLangMode === 'browser' || this.settings?.summaryLangMode === 'site') {
            summaryLangModeUi = this.settings.summaryLangMode;
        }
        if (this.elements.summaryLangMode) {
            this.elements.summaryLangMode.value = summaryLangModeUi;
        }

        let reasoningUi = 'off';
        try {
            reasoningUi = AISummarizer.normalizeLmReasoningParam(
                localStorage.getItem('heise_reasoning') || this.settings?.reasoning
            );
        } catch (_) {
            reasoningUi = 'off';
        }
        if (this.elements.reasoningSelect) {
            this.elements.reasoningSelect.value = reasoningUi;
        }

        let altLinksCount = 5;
        try {
            const rawAl = localStorage.getItem('heise_alternative_links_count');
            if (rawAl !== null && rawAl !== '') {
                altLinksCount = parseInt(rawAl, 10);
            } else if (this.settings?.alternativeLinksCount != null) {
                altLinksCount = parseInt(String(this.settings.alternativeLinksCount), 10);
            }
        } catch (_) {
            altLinksCount = 5;
        }
        if (!Number.isFinite(altLinksCount) || altLinksCount < 0) {
            altLinksCount = 5;
        }
        altLinksCount = Math.min(15, altLinksCount);
        if (this.elements.alternativeLinksCount) {
            this.elements.alternativeLinksCount.value = String(altLinksCount);
        }

        let webSearchEngineUi = 'duckduckgo';
        try {
            webSearchEngineUi =
                localStorage.getItem('heise_web_search_engine') || this.settings?.webSearchEngine || 'duckduckgo';
        } catch (_) {
            webSearchEngineUi = 'duckduckgo';
        }
        if (this.elements.webSearchEngine) {
            this.elements.webSearchEngine.value = App.normalizeWebSearchEngine(webSearchEngineUi);
        }

        let altLinksDisplayUi = 'expanded';
        try {
            altLinksDisplayUi =
                localStorage.getItem('heise_alternative_links_display_mode') ||
                this.settings?.alternativeLinksDisplayMode ||
                'expanded';
        } catch (_) {
            altLinksDisplayUi = 'expanded';
        }
        if (this.elements.alternativeLinksDisplayMode) {
            this.elements.alternativeLinksDisplayMode.value =
                App.normalizeAlternativeLinksDisplayMode(altLinksDisplayUi);
        }

        let altBlacklistUi = '';
        try {
            altBlacklistUi =
                localStorage.getItem('heise_alternative_links_blacklist') ||
                this.settings?.alternativeLinksDomainBlacklist ||
                '';
        } catch (_) {
            altBlacklistUi = this.settings?.alternativeLinksDomainBlacklist || '';
        }
        if (this.elements.alternativeLinksBlacklist) {
            this.elements.alternativeLinksBlacklist.value =
                App.normalizeAlternativeLinksDomainBlacklist(altBlacklistUi);
        }

        let rso = false;
        try {
            rso =
                localStorage.getItem('heise_rest_same_origin') === '1' ||
                this.settings?.restSameOrigin === true;
        } catch (_) {
            rso = this.settings?.restSameOrigin === true;
        }
        if (this.elements.restSameOrigin) {
            this.elements.restSameOrigin.checked = rso;
        }

        this.updateRestSameOriginVisibility();
        this.syncKiServerUrlHint();
        this.updateRestSameOriginUi();

        this.elements.settingsModal.classList.add('active');
    }

    onKiApiModeChange() {
        const mode = this.elements.kiApiMode ? this.elements.kiApiMode.value : 'lm_rest_v1';
        let v = (this.elements.apiBaseUrl.value || '').trim();
        if (v) {
            if (mode === 'lm_rest_v1') {
                this.elements.apiBaseUrl.value = AISummarizer.normalizeLmRestServerRoot(v);
            } else {
                this.elements.apiBaseUrl.value = AISummarizer.normalizeOpenAiApiBase(v);
            }
        }
        this.updateRestSameOriginVisibility();
        this.syncKiServerUrlHint();
        this.updateRestSameOriginUi();
    }

    onRestSameOriginChange() {
        this.syncKiServerUrlHint();
        this.updateRestSameOriginUi();
    }

    onApiBaseUrlUserInput() {
        const mode = this.elements.kiApiMode ? this.elements.kiApiMode.value : 'lm_rest_v1';
        if (mode !== 'lm_rest_v1' || !this.elements.restSameOrigin) {
            return;
        }
        if (this.elements.restSameOrigin.checked) {
            // Editing URL means user wants direct endpoint instead of same-origin proxy.
            this.elements.restSameOrigin.checked = false;
            this.syncKiServerUrlHint();
            this.updateRestSameOriginUi();
        }
    }

    updateRestSameOriginVisibility() {
        const mode = this.elements.kiApiMode ? this.elements.kiApiMode.value : 'lm_rest_v1';
        const wrap = document.getElementById('restSameOriginWrap');
        if (wrap) {
            wrap.style.display = mode === 'lm_rest_v1' ? 'block' : 'none';
        }
    }

    updateRestSameOriginUi() {
        const mode = this.elements.kiApiMode ? this.elements.kiApiMode.value : 'lm_rest_v1';
        const input = this.elements.apiBaseUrl;
        if (!input) {
            return;
        }
        const useSo =
            mode === 'lm_rest_v1' && this.elements.restSameOrigin && this.elements.restSameOrigin.checked;
        input.disabled = false;
        input.title = useSo
            ? 'REST über dieselbe Origin ist aktiv. Beim Tippen in dieses Feld wird die Option automatisch deaktiviert.'
            : '';
    }

    syncKiServerUrlHint() {
        const mode = this.elements.kiApiMode ? this.elements.kiApiMode.value : 'lm_rest_v1';
        const hint = this.elements.serverUrlHint;
        if (!hint) {
            return;
        }
        const so =
            this.elements.restSameOrigin &&
            mode === 'lm_rest_v1' &&
            this.elements.restSameOrigin.checked;
        if (so) {
            const origin =
                typeof window !== 'undefined' && window.location ? window.location.origin : '';
            hint.textContent = origin
                ? `REST wird an dieselbe Origin gesendet: ${origin}/api/v1/chat (kein OPTIONS an LM Studio). Dev-Server: python3 scripts/dev_server.py`
                : 'REST über dieselbe Origin — scripts/dev_server.py starten.';
            return;
        }
        if (mode === 'lm_rest_v1') {
            hint.textContent =
                'Direkt zu LM Studio: Server-Stamm ohne Pfad (kann OPTIONS/CORS erfordern). Beispiel: http://127.0.0.1:1234 — oder CORS-Proxy :1244 / „REST über dieselbe Origin“ mit dev_server.';
        } else {
            hint.textContent =
                'OpenAI-kompatibel: Basis-URL mit /v1, die App nutzt POST …/v1/chat/completions. Beispiel: http://127.0.0.1:1234/v1';
        }
    }

    closeSettingsModal() {
        this.elements.settingsModal.classList.remove('active');
    }

    openKiStatsModal() {
        this.refreshKiStatsPanel();
        if (this.elements.kiStatsModal) {
            this.elements.kiStatsModal.classList.add('active');
        }
    }

    /**
     * @param {string} str
     */
    _escapeXmlForSvg(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    closeKiStatsModal() {
        if (this.elements.kiStatsModal) {
            this.elements.kiStatsModal.classList.remove('active');
        }
    }

    /**
     * @param {number|null|undefined} ms
     * @returns {string}
     */
    formatKiDuration(ms) {
        if (ms == null || Number.isNaN(ms) || ms < 0) {
            return '—';
        }
        const s = ms / 1000;
        if (s < 120) {
            return `${s.toFixed(1)} s`;
        }
        return `${(s / 60).toFixed(1)} min`;
    }

    refreshKiStatsPanel() {
        const snap =
            typeof KiStats !== 'undefined' && KiStats.getSnapshot ? KiStats.getSnapshot() : null;
        const emptyEl = document.getElementById('kiStatsEmpty');
        const panel = document.getElementById('kiStatsPanel');
        const hint = document.getElementById('kiStatsTokenHint');
        const lang =
            document.documentElement && String(document.documentElement.lang).toLowerCase().startsWith('en')
                ? 'en'
                : 'de';
        const localeTag = lang === 'en' ? 'en-US' : 'de-DE';

        if (!snap || snap.count === 0) {
            if (emptyEl) {
                emptyEl.hidden = false;
            }
            if (panel) {
                panel.style.display = 'none';
            }
            if (hint) {
                hint.hidden = true;
            }
            const svg = document.getElementById('kiStatsChartSvg');
            if (svg) {
                svg.innerHTML = '';
            }
            return;
        }

        if (emptyEl) {
            emptyEl.hidden = true;
        }
        if (panel) {
            panel.style.display = '';
        }

        const countVal = document.getElementById('kiStatsCountVal');
        if (countVal) {
            countVal.textContent = String(snap.count);
        }
        const totalEl = document.getElementById('kiStatsTotalTokensVal');
        if (totalEl) {
            if (snap.tokenSamples > 0) {
                totalEl.textContent = snap.totalTokens.toLocaleString(lang === 'en' ? 'en-US' : 'de-DE');
            } else {
                const na = this._i18nKiStatsTokenNa || '—';
                totalEl.textContent = na;
            }
        }
        const avgTok = document.getElementById('kiStatsAvgTokensVal');
        if (avgTok) {
            avgTok.textContent =
                snap.avgTokens != null
                    ? snap.avgTokens.toLocaleString(lang === 'en' ? 'en-US' : 'de-DE')
                    : this._i18nKiStatsTokenNa || '—';
        }
        const avgDur = document.getElementById('kiStatsAvgDurationVal');
        if (avgDur) {
            avgDur.textContent = this.formatKiDuration(snap.avgDurationMs);
        }
        if (hint) {
            const needHint = snap.tokenSamples === 0 && snap.count > 0;
            hint.hidden = !needHint;
            if (needHint) {
                hint.textContent = this._i18nKiStatsTokenHint || '';
            }
        }

        const cap = document.getElementById('kiStatsChartCaption');
        if (cap && this._i18nKiStatsChartTpl) {
            cap.textContent = this._i18nKiStatsChartTpl;
        }

        const buckets =
            typeof KiStats !== 'undefined' && KiStats.getChartBucketsAvgVsTotalTokens
                ? KiStats.getChartBucketsAvgVsTotalTokens('month', localeTag)
                : [];
        this.renderKiStatsOverviewChart(buckets, localeTag);
    }

    /**
     * Grouped column chart: avg. tokens per article vs. total tokens per month — each series normalized to its own max (100%).
     * @param {Array<{ label: string, avgTokens: number|null, totalTokens: number, tokenSamples: number }>} buckets
     * @param {string} localeTag
     */
    renderKiStatsOverviewChart(buckets, localeTag) {
        const svg = document.getElementById('kiStatsChartSvg');
        if (!svg) {
            return;
        }
        if (!buckets || buckets.length === 0) {
            svg.innerHTML = '';
            return;
        }

        const W = 720;
        const H = 360;
        const padL = 58;
        const padR = 18;
        const padT = 40;
        const padB = 64;
        const n = buckets.length;

        const esc = (s) => this._escapeXmlForSvg(s);
        const rawAvg = this._i18nKiStatsChartAvgLegend || 'Avg. tokens / article';
        const rawTot = this._i18nKiStatsChartTotalLegend || 'Total tokens';
        const tAvg = esc(rawAvg);
        const tTot = esc(rawTot);
        const yTitle = esc(this._i18nKiStatsChartYTitle || '%');
        const na = this._i18nKiStatsTokenNa || '—';

        const fmtTok = (v) =>
            Number.isFinite(v) ? Math.round(v).toLocaleString(localeTag || undefined) : '0';
        const tipAvg = (b) => {
            if (b.avgTokens != null && b.avgTokens >= 0) {
                return esc(`${rawAvg}: ${fmtTok(b.avgTokens)}`);
            }
            return esc(`${rawAvg}: ${na}`);
        };
        const tipTot = (b) => esc(`${rawTot}: ${fmtTok(b.totalTokens)}`);

        /** Teal / cyan palette (readable on light & dark cards) */
        const colAvg = '#0f766e';
        const colTot = '#22d3ee';
        const gridStroke = 'rgba(14, 165, 233, 0.35)';
        const axisStroke = 'rgba(56, 189, 248, 0.65)';

        let muted = '#475569';
        try {
            const m = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
            if (m) {
                muted = m;
            }
        } catch (_) {
            /* ignore */
        }

        const eps = 1e-9;
        const hasAvg = buckets.some((b) => b.avgTokens != null && b.avgTokens > 0);
        const maxAvg = hasAvg
            ? Math.max(...buckets.map((b) => (b.avgTokens != null ? b.avgTokens : 0)), eps)
            : eps;
        const maxTot = Math.max(...buckets.map((b) => b.totalTokens), eps);

        const yTop = padT + 36;
        const yBot = H - padB;
        const plotH = yBot - yTop;
        const innerW = W - padL - padR;
        const groupW = innerW / n;
        const groupInner = groupW * 0.82;
        const groupPadX = (groupW - groupInner) / 2;
        const barGap = 4;
        const barW = Math.max(4, (groupInner - barGap) / 2);

        const parts = [];
        parts.push(`<rect width="${W}" height="${H}" fill="none"/>`);

        /** Legend (centered) */
        const legY = 22;
        const legItems = [
            { c: colAvg, t: tAvg },
            { c: colTot, t: tTot }
        ];
        let legW = 0;
        legItems.forEach((it) => {
            legW += 18 + it.t.length * 6.2 + 36;
        });
        let lx = Math.max(padL, (W - legW) / 2);
        legItems.forEach((it) => {
            parts.push(`<rect x="${lx}" y="${legY - 9}" width="11" height="11" rx="2" fill="${it.c}"/>`);
            parts.push(
                `<text x="${lx + 16}" y="${legY}" font-size="12" font-weight="500" fill="${muted}">${it.t}</text>`
            );
            lx += 18 + it.t.length * 6.2 + 36;
        });

        /** Horizontal grid + Y ticks 0–100 % */
        for (let g = 0; g <= 4; g++) {
            const pct = (g / 4) * 100;
            const y = yBot - (plotH * g) / 4;
            parts.push(
                `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${gridStroke}" stroke-width="1"/>`
            );
            parts.push(
                `<text x="${padL - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="${muted}">${Math.round(
                    pct
                )}</text>`
            );
        }

        /** Y-axis title */
        const yMid = (yTop + yBot) / 2;
        parts.push(
            `<text transform="rotate(-90 ${18} ${yMid})" x="18" y="${yMid}" text-anchor="middle" font-size="11" fill="${muted}">${yTitle}</text>`
        );

        /** Axes frame */
        parts.push(
            `<line x1="${padL}" y1="${yTop}" x2="${padL}" y2="${yBot}" stroke="${axisStroke}" stroke-width="1.5"/>`
        );
        parts.push(
            `<line x1="${padL}" y1="${yBot}" x2="${W - padR}" y2="${yBot}" stroke="${axisStroke}" stroke-width="1.5"/>`
        );

        /** Grouped bars */
        for (let i = 0; i < n; i++) {
            const cellLeft = padL + i * groupW + groupPadX;
            const b = buckets[i];
            const av = b.avgTokens != null ? b.avgTokens : 0;
            const tot = b.totalTokens;
            const hAvg = hasAvg ? (av / maxAvg) * plotH : 0;
            const hTot = (tot / maxTot) * plotH;
            const x0 = cellLeft;
            const avgHasVal = b.avgTokens != null && b.avgTokens > 0;
            parts.push(
                `<rect x="${x0}" y="${yBot - hAvg}" width="${barW}" height="${Math.max(
                    hAvg,
                    avgHasVal ? 1 : 0
                )}" rx="2" fill="${colAvg}" fill-opacity="${hasAvg ? 1 : 0.35}"><title>${tipAvg(
                    b
                )}</title></rect>`
            );
            parts.push(
                `<rect x="${x0 + barW + barGap}" y="${yBot - hTot}" width="${barW}" height="${Math.max(
                    hTot,
                    tot > 0 ? 1 : 0
                )}" rx="2" fill="${colTot}"><title>${tipTot(b)}</title></rect>`
            );
        }

        /** X-axis category labels */
        const labelY = yBot + 18;
        for (let i = 0; i < n; i++) {
            const cx = padL + i * groupW + groupW / 2;
            const lab = esc(buckets[i].label);
            parts.push(
                `<text transform="rotate(-32 ${cx} ${labelY})" x="${cx}" y="${labelY}" text-anchor="end" font-size="10" fill="${muted}">${lab}</text>`
            );
        }

        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.innerHTML = parts.join('');
    }

    confirmClearKiStats() {
        const msg = this._i18nKiStatsClearConfirm || 'Clear all statistics?';
        if (typeof window !== 'undefined' && window.confirm && !window.confirm(msg)) {
            return;
        }
        if (typeof KiStats !== 'undefined' && KiStats.clear) {
            KiStats.clear();
        }
        this.refreshKiStatsPanel();
    }

    rebuildNewsSourceSelect() {
        const sel = this.elements.newsSourceSelect;
        if (!sel) {
            return;
        }
        const enabled = this.getEnabledNewsSourceIds();
        const reg =
            typeof window !== 'undefined' && window.NEWS_SOURCES_REGISTRY
                ? window.NEWS_SOURCES_REGISTRY
                : [];
        const byId = new Map(reg.map((r) => [r.id, r]));
        sel.innerHTML = '';
        for (const id of enabled) {
            const opt = document.createElement('option');
            opt.value = id;
            const entry = byId.get(id);
            opt.textContent = entry ? entry.siteUrl : id;
            if (entry && entry.siteUrl) {
                opt.setAttribute('data-site-url', entry.siteUrl);
            }
            sel.appendChild(opt);
        }
    }

    renderNewsSourcesSettingsChecklist() {
        const ul = this.elements.newsSourcesSettingsList;
        if (!ul) {
            return;
        }
        const reg =
            typeof window !== 'undefined' && window.NEWS_SOURCES_REGISTRY
                ? window.NEWS_SOURCES_REGISTRY
                : [];
        const enabled = new Set(this.getEnabledNewsSourceIds());
        const labels = this._i18nNewsSourceLabels || {};
        ul.innerHTML = '';
        for (const row of reg) {
            const name = labels[row.id] || row.id;
            const li = document.createElement('li');
            li.className = 'news-sources-settings__item';
            li.dataset.sourceId = row.id;
            li.dataset.searchBlob = `${row.id} ${row.siteUrl} ${name}`.toLowerCase();

            const label = document.createElement('label');
            label.className = 'news-sources-settings__label';

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'news-sources-settings__source-cb';
            cb.checked = enabled.has(row.id);
            cb.dataset.sourceId = row.id;
            cb.addEventListener('change', () => this.syncNewsSourcesToggleVisibleBtn());

            const span = document.createElement('span');
            span.className = 'news-sources-settings__text';
            const strong = document.createElement('strong');
            strong.className = 'news-sources-settings__name';
            strong.textContent = name;
            const small = document.createElement('span');
            small.className = 'news-sources-settings__url';
            small.textContent = row.siteUrl;
            span.appendChild(strong);
            span.appendChild(small);

            label.appendChild(cb);
            label.appendChild(span);
            li.appendChild(label);

            if (row.id === 'heise') {
                const defs = App.getHeiseMagazineFeedDefsForUi();
                const wrap = document.createElement('div');
                wrap.className = 'heise-magazine-feeds';
                const legend = document.createElement('div');
                legend.className = 'heise-magazine-feeds__legend';
                legend.textContent =
                    this._i18nHeiseMagazineHeading ||
                    'Additional heise.de sections (same source in the header)';
                wrap.appendChild(legend);
                const magEnabled = new Set(this.settings?.enabledHeiseMagazines || []);
                const labelsById = this._i18nHeiseMagazineById || {};
                for (const def of defs) {
                    const item = document.createElement('label');
                    item.className = 'heise-magazine-feeds__item';
                    const mcb = document.createElement('input');
                    mcb.type = 'checkbox';
                    mcb.classList.add('heise-magazine-feed-cb');
                    mcb.setAttribute('data-heise-magazine-id', def.id);
                    mcb.checked = magEnabled.has(def.id);
                    const mspan = document.createElement('span');
                    mspan.textContent = labelsById[def.id] || def.id;
                    item.appendChild(mcb);
                    item.appendChild(mspan);
                    wrap.appendChild(item);
                }
                li.appendChild(wrap);
                const magBlob = defs
                    .map((d) => `${d.id} ${labelsById[d.id] || ''} ${d.url || ''}`)
                    .join(' ');
                li.dataset.searchBlob = `${li.dataset.searchBlob} ${magBlob}`.toLowerCase();
            }

            ul.appendChild(li);
        }
        this.syncNewsSourcesToggleVisibleBtn();
    }

    filterNewsSourcesSettingsList() {
        const input = this.elements.newsSourcesFilterInput;
        const ul = this.elements.newsSourcesSettingsList;
        if (!input || !ul) {
            return;
        }
        const q = String(input.value || '')
            .trim()
            .toLowerCase();
        ul.querySelectorAll('.news-sources-settings__item').forEach((li) => {
            const blob = li.dataset.searchBlob || '';
            li.hidden = Boolean(q && !blob.includes(q));
        });
        this.syncNewsSourcesToggleVisibleBtn();
    }

    /**
     * Updates the single enable/disable control: ⊕ when the next click will check all visible rows, ⊖ when it will clear them.
     */
    syncNewsSourcesToggleVisibleBtn() {
        const btn = this.elements.newsSourcesToggleVisibleBtn;
        const ul = this.elements.newsSourcesSettingsList;
        if (!btn || !ul) {
            return;
        }
        const visible = Array.from(ul.querySelectorAll('.news-sources-settings__item')).filter(
            (li) => !li.hidden
        );
        const icon = btn.querySelector('.news-sources-toggle__icon');
        if (visible.length === 0) {
            btn.disabled = true;
            if (icon) {
                icon.textContent = '⊕';
            }
            const t =
                this._i18nToggleVisibleEnable ||
                'Enable visible sources (no rows match the current filter).';
            btn.setAttribute('title', t);
            btn.setAttribute('aria-label', t);
            return;
        }
        btn.disabled = false;
        let checked = 0;
        visible.forEach((li) => {
            const cb = li.querySelector('input.news-sources-settings__source-cb');
            if (cb && cb.checked) {
                checked += 1;
            }
        });
        const allOn = checked === visible.length;
        const nextEnable = !allOn;
        if (icon) {
            icon.textContent = nextEnable ? '⊕' : '⊖';
        }
        const label = nextEnable
            ? this._i18nToggleVisibleEnable ||
              'Enable visible — check all sources currently shown (⊕)'
            : this._i18nToggleVisibleDisable ||
              'Disable visible — uncheck all sources currently shown (⊖)';
        btn.setAttribute('title', label);
        btn.setAttribute('aria-label', label);
    }

    toggleVisibleNewsSourcesBulk() {
        const ul = this.elements.newsSourcesSettingsList;
        if (!ul) {
            return;
        }
        const visible = Array.from(ul.querySelectorAll('.news-sources-settings__item')).filter(
            (li) => !li.hidden
        );
        if (visible.length === 0) {
            return;
        }
        let checked = 0;
        visible.forEach((li) => {
            const cb = li.querySelector('input.news-sources-settings__source-cb');
            if (cb && cb.checked) {
                checked += 1;
            }
        });
        const allOn = checked === visible.length;
        this.setVisibleNewsSourceCheckboxes(!allOn);
        this.syncNewsSourcesToggleVisibleBtn();
    }

    setVisibleNewsSourceCheckboxes(checked) {
        const ul = this.elements.newsSourcesSettingsList;
        if (!ul) {
            return;
        }
        ul.querySelectorAll('.news-sources-settings__item').forEach((li) => {
            if (li.hidden) {
                return;
            }
            const cb = li.querySelector('input.news-sources-settings__source-cb');
            if (cb) {
                cb.checked = checked;
            }
        });
    }

    async openDashboardSettingsModal() {
        await this.applySortLabelsFromLocale();
        this.renderNewsSourcesSettingsChecklist();
        if (this.elements.newsSourcesFilterInput) {
            this.elements.newsSourcesFilterInput.value = '';
        }
        this.filterNewsSourcesSettingsList();
        if (this.elements.dashboardSettingsModal) {
            this.elements.dashboardSettingsModal.classList.add('active');
        }
    }

    closeDashboardSettingsModal() {
        if (this.elements.dashboardSettingsModal) {
            this.elements.dashboardSettingsModal.classList.remove('active');
        }
    }

    /**
     * From dashboard settings: open KI modal and focus the summary language control.
     */
    async openKiLanguageFromDashboard() {
        this.closeDashboardSettingsModal();
        await this.applySortLabelsFromLocale();
        this.openSettingsModal();
        requestAnimationFrame(() => {
            const el = document.getElementById('summaryLangMode');
            if (el) {
                try {
                    el.focus();
                    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                } catch (_) {
                    /* ignore */
                }
            }
        });
    }

    async saveDashboardSettings() {
        const ul = this.elements.newsSourcesSettingsList;
        if (!ul || !this.settings) {
            this.closeDashboardSettingsModal();
            return;
        }
        const reg =
            typeof window !== 'undefined' && window.NEWS_SOURCES_REGISTRY
                ? window.NEWS_SOURCES_REGISTRY
                : [];
        const checked = new Set();
        reg.forEach((r) => {
            const cb = ul.querySelector(`input[data-source-id="${r.id}"]`);
            if (cb && cb.checked) {
                checked.add(r.id);
            }
        });
        const enabled = reg.map((r) => r.id).filter((id) => checked.has(id));
        if (enabled.length === 0) {
            this.showStatus(this._i18nDashboardNeedOne || 'Mindestens eine Newsquelle muss aktiviert sein.', true);
            return;
        }

        const magIds = [];
        ul.querySelectorAll('input.heise-magazine-feed-cb').forEach((inp) => {
            if (!inp.checked) {
                return;
            }
            const id = inp.getAttribute('data-heise-magazine-id');
            if (id) {
                magIds.push(id);
            }
        });
        const nextMagazines = App.normalizeEnabledHeiseMagazines(magIds);
        const prevMagazinesJson = JSON.stringify(this.settings.enabledHeiseMagazines || []);
        const nextMagazinesJson = JSON.stringify(nextMagazines);
        const magazinesChanged = prevMagazinesJson !== nextMagazinesJson;

        const prev = this.settings.newsSource;
        this.settings.enabledNewsSources = enabled;
        this.settings.enabledHeiseMagazines = nextMagazines;
        try {
            localStorage.setItem('heise_enabled_news_sources', JSON.stringify(enabled));
            localStorage.setItem('heise_enabled_magazine_feeds', JSON.stringify(nextMagazines));
        } catch (_) {
            /* ignore */
        }
        try {
            await this.storage.saveSettings({
                enabledNewsSources: enabled,
                enabledHeiseMagazines: nextMagazines
            });
        } catch (e) {
            console.warn('saveDashboardSettings:', e);
        }
        App.syncHeiseMagazineFeedMirror(nextMagazines);

        this.rebuildNewsSourceSelect();
        await this.applySortLabelsFromLocale();

        const next = App.normalizeNewsSourceWithEnabled(prev, enabled);
        if (this.elements.newsSourceSelect) {
            this.elements.newsSourceSelect.value = next;
        }

        if (next !== prev) {
            await this.onNewsSourceChange();
        } else if (magazinesChanged && next === 'heise') {
            await this.fetchNews(true);
        } else {
            this.showStatus(this._i18nDashboardSaved || 'Einstellungen gespeichert.');
        }
        this.closeDashboardSettingsModal();
    }

    async saveSettings() {
        const mode =
            this.elements.kiApiMode && this.elements.kiApiMode.value === 'openai' ? 'openai' : 'lm_rest_v1';

        const raw = (this.elements.apiBaseUrl.value || '').trim();
        let apiBaseUrl;
        let lmRestRoot;
        if (mode === 'lm_rest_v1') {
            lmRestRoot = AISummarizer.normalizeLmRestServerRoot(raw);
            apiBaseUrl = AISummarizer.normalizeOpenAiApiBase(`${lmRestRoot}/v1`);
            this.elements.apiBaseUrl.value = lmRestRoot;
        } else {
            apiBaseUrl = AISummarizer.normalizeOpenAiApiBase(raw);
            lmRestRoot = AISummarizer.normalizeLmRestServerRoot(apiBaseUrl);
            this.elements.apiBaseUrl.value = apiBaseUrl;
        }

        const lmModel = (this.elements.lmModel.value || '').trim();
        const lmApiToken = this.elements.lmApiToken ? (this.elements.lmApiToken.value || '').trim() : '';
        const restSameOrigin = this.elements.restSameOrigin ? this.elements.restSameOrigin.checked === true : false;

        let summaryCacheDays = 14;
        if (this.elements.summaryCacheDays) {
            const v = parseInt(this.elements.summaryCacheDays.value, 10);
            if (Number.isFinite(v) && v >= 0 && v <= 3650) {
                summaryCacheDays = v;
            }
        }

        const summaryConcurrencySaved = this.elements.summaryConcurrency
            ? App.normalizeSummaryConcurrency(this.elements.summaryConcurrency.value)
            : App.normalizeSummaryConcurrency(this.settings?.summaryConcurrency);

        const summaryRequestTimeoutSaved = this.elements.kiRequestTimeoutSeconds
            ? App.normalizeKiRequestTimeoutSeconds(this.elements.kiRequestTimeoutSeconds.value)
            : App.normalizeKiRequestTimeoutSeconds(this.settings?.summaryRequestTimeoutSeconds);

        const reasoningLevel = this.elements.reasoningSelect
            ? AISummarizer.normalizeLmReasoningParam(this.elements.reasoningSelect.value)
            : AISummarizer.normalizeLmReasoningParam(this.settings?.reasoning);

        let alternativeLinksCount = 5;
        if (this.elements.alternativeLinksCount) {
            const ac = parseInt(this.elements.alternativeLinksCount.value, 10);
            if (Number.isFinite(ac) && ac >= 0 && ac <= 15) {
                alternativeLinksCount = ac;
            }
        }

        const webSearchEngineSaved = this.elements.webSearchEngine
            ? App.normalizeWebSearchEngine(this.elements.webSearchEngine.value)
            : App.normalizeWebSearchEngine(this.settings?.webSearchEngine);

        const alternativeLinksDisplayModeSaved = this.elements.alternativeLinksDisplayMode
            ? App.normalizeAlternativeLinksDisplayMode(this.elements.alternativeLinksDisplayMode.value)
            : App.normalizeAlternativeLinksDisplayMode(this.settings?.alternativeLinksDisplayMode);
        const alternativeLinksDomainBlacklistSaved = this.elements.alternativeLinksBlacklist
            ? App.normalizeAlternativeLinksDomainBlacklist(this.elements.alternativeLinksBlacklist.value)
            : App.normalizeAlternativeLinksDomainBlacklist(this.settings?.alternativeLinksDomainBlacklist);

        try {
            localStorage.setItem('heise_ki_api_mode', mode);
            localStorage.setItem('heise_api_base', apiBaseUrl);
            localStorage.setItem('heise_lm_rest_root', lmRestRoot);
            localStorage.setItem('heise_lm_model', lmModel);
            try {
                sessionStorage.removeItem('heise_lm_resolved_model_id');
            } catch (_) {
                /* ignore */
            }
            localStorage.setItem('heise_lm_api_token', lmApiToken);
            localStorage.setItem('heise_summary_cache_days', String(summaryCacheDays));
            localStorage.setItem('heise_summary_concurrency', String(summaryConcurrencySaved));
            localStorage.setItem('heise_ki_request_timeout_sec', String(summaryRequestTimeoutSaved));
            localStorage.setItem('heise_reasoning', reasoningLevel);

            try {
                localStorage.setItem('heise_alternative_links_count', String(alternativeLinksCount));
            } catch (_) {
                /* ignore */
            }
            try {
                localStorage.setItem('heise_web_search_engine', webSearchEngineSaved);
            } catch (_) {
                /* ignore */
            }

            try {
                localStorage.setItem('heise_alternative_links_display_mode', alternativeLinksDisplayModeSaved);
            } catch (_) {
                /* ignore */
            }
            try {
                localStorage.setItem('heise_alternative_links_blacklist', alternativeLinksDomainBlacklistSaved);
            } catch (_) {
                /* ignore */
            }

            const summaryLangMode =
                this.elements.summaryLangMode && this.elements.summaryLangMode.value === 'browser'
                    ? 'browser'
                    : 'site';
            localStorage.setItem('heise_summary_lang_mode', summaryLangMode);
            localStorage.setItem('heise_rest_same_origin', restSameOrigin ? '1' : '0');
            try {
                localStorage.setItem('heise_rest_same_origin_manual', '1');
            } catch (_) {
                /* ignore */
            }
        } catch (e) {
            console.warn('localStorage:', e);
        }

        const selectedCategories = Array.isArray(this.selectedCategories) ? [...this.selectedCategories] : [];

        const enabledHeiseMagazinesKi = App.normalizeEnabledHeiseMagazines(
            Array.isArray(this.settings?.enabledHeiseMagazines)
                ? this.settings.enabledHeiseMagazines
                : typeof window !== 'undefined' && Array.isArray(window.__heiseEnabledMagazineFeeds)
                  ? window.__heiseEnabledMagazineFeeds
                  : []
        );

        const settings = {
            ...this.settings,
            selectedCategories,
            theme: localStorage.getItem('theme') || 'system',
            colorTheme: App.normalizeColorTheme(this.settings?.colorTheme),
            kiApiMode: mode,
            apiBaseUrl,
            lmRestRoot,
            lmApiToken,
            restSameOrigin,
            summaryCacheDays,
            summaryConcurrency: summaryConcurrencySaved,
            summaryRequestTimeoutSeconds: summaryRequestTimeoutSaved,
            lmModel,
            reasoning: reasoningLevel,
            alternativeLinksCount,
            alternativeLinksDisplayMode: alternativeLinksDisplayModeSaved,
            alternativeLinksDomainBlacklist: alternativeLinksDomainBlacklistSaved,
            webSearchEngine: webSearchEngineSaved,
            summaryLangMode:
                this.elements.summaryLangMode && this.elements.summaryLangMode.value === 'browser'
                    ? 'browser'
                    : 'site',
            enabledHeiseMagazines: enabledHeiseMagazinesKi
        };

        try {
            await this.storage.saveSettings(settings);
            this.settings = settings;
            App.syncHeiseMagazineFeedMirror(this.settings.enabledHeiseMagazines);
            try {
                localStorage.setItem(
                    'heise_enabled_magazine_feeds',
                    JSON.stringify(this.settings.enabledHeiseMagazines || [])
                );
            } catch (_) {
                /* ignore */
            }

            this.closeSettingsModal();
            this.showStatus(
                'KI-Server gespeichert. Test: bei einer Meldung „Zusammenfassung anzeigen“ klicken.'
            );
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showStatus('Fehler beim Speichern', true);
        }
    }

    startAutoUpdateTimer() {
        const interval = (this.settings?.updateInterval === 'custom'
            ? this.settings?.customInterval || 60
            : this.settings?.updateInterval) || 60;

        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }

        this.updateTimer = setInterval(() => {
            this.fetchNews(true);
        }, interval * 60 * 1000);

        console.log(`Auto-update timer: alle ${interval} Minuten`);
    }

    /**
 * Escape HTML for simple string insertions into textContent or attributes.
 * For complex HTML generation, use DOMPurify.sanitize() instead.
 */
escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

/**
 * Sanitize complex HTML templates with DOMPurify (recommended for innerHTML).
 * Blocks inline scripts, event handlers, and dangerous tags.
 */
sanitizeHtml(html) {
        if (typeof DOMPurify === 'undefined') {
            // Fallback to basic escape if DOMPurify not loaded
            const div = document.createElement('div');
            div.innerHTML = html;
            return div.textContent || '';
        }
        return DOMPurify.sanitize(html, {
            ALLOWED_TAGS: ['a', 'b', 'i', 'em', 'strong', 'p', 'span', 'div', 'h3', 'button', 'img', 'ul', 'li'],
            ALLOWED_ATTR: [
                'href',
                'title',
                'aria-label',
                'class',
                'id',
                'data-url',
                'rel',
                'src',
                'width',
                'height',
                'alt',
                'loading',
                'decoding',
                'target'
            ]
        });
    }

    // Cleanup on page unload
    destroy() {
        if (this._onDocumentVisibilityChange && typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', this._onDocumentVisibilityChange);
            this._onDocumentVisibilityChange = null;
        }
        if (this._visibilityResumeFetchTimer) {
            clearTimeout(this._visibilityResumeFetchTimer);
            this._visibilityResumeFetchTimer = null;
        }
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }
        if (this._headerBrandResizeObserver && this.elements.headerBrandToggle) {
            try {
                this._headerBrandResizeObserver.unobserve(this.elements.headerBrandToggle);
            } catch (_) {
                /* ignore */
            }
            this._headerBrandResizeObserver = null;
        }
        if (this._onHeaderBrandWindowResize) {
            window.removeEventListener('resize', this._onHeaderBrandWindowResize);
            this._onHeaderBrandWindowResize = null;
        }
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
