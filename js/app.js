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
/** Remote favicon from bild.de — not bundled (see README). */
const BILD_BRAND_LOGO_URL = 'https://www.bild.de/favicon.ico';
/** Remote icon from t3n CDN — not bundled (see README). */
const T3N_BRAND_LOGO_URL = 'https://cdn.t3n.de/global/images/icons/t3n-favicon-96x96.png';
/** Remote favicon from The Verge — not bundled (see README). */
const VERGE_BRAND_LOGO_URL = 'https://www.theverge.com/static-assets/icons/favicon-32x32.png';
/**
 * Normalized hostname suffixes for English-first publishers (MyMemory `lang` + card `lang`).
 * Matches `AISummarizer.normalizeHostnameForMatch` output (no leading `www.`).
 */
const ENGLISH_CONTENT_HOST_SUFFIXES = [
    'theverge.com',
    'techcrunch.com',
    'arstechnica.com',
    'wired.com',
    'engadget.com',
    'theguardian.com',
    'msn.com',
    'bbc.co.uk',
    'bbc.com',
    'nytimes.com',
    'washingtonpost.com',
    'reuters.com',
    'bloomberg.com'
];
/** Telepolis (heise medien) — favicon */
const TELEPOLIS_BRAND_LOGO_URL = 'https://www.telepolis.de/favicon.ico';
/** IT-Administrator — favicon */
const IT_ADMINISTRATOR_BRAND_LOGO_URL = 'https://www.it-administrator.de/favicon.ico';

/** Accent color themes (must match `data-color-theme` in index.html). */
const COLOR_THEME_IDS = ['heise', 'ocean', 'forest', 'violet', 'amber', 'rose', 'slate', 'midnight'];
const ARTICLE_READ_STATE_IDS = ['seen', 'read'];
const ARTICLE_STATE_COLOR_IDS = ['new', 'seen', 'read'];
const ARTICLE_STATE_COLOR_DEFAULTS = {
    new: '#2d8a3e',
    seen: '#d9a20b',
    read: '#6b7280'
};
const ARTICLE_SEEN_HOVER_DELAY_MS = 3000;

/** Default surface colors (must match `:root` / `[data-theme="dark"]` in index.html). */
const THEME_DEFAULT_SURFACE = {
    light: {
        bgPrimary: '#f7f1ea',
        bgSecondary: '#f1e8de',
        bgCard: '#ffffff',
        borderColor: '#eadfd3'
    },
    dark: {
        bgPrimary: '#151210',
        bgSecondary: '#1d1916',
        bgCard: '#221d1a',
        borderColor: '#3b342e'
    }
};

/** Default header bar colors (must match `:root` / `[data-theme="dark"]` --header-* in index.html). */
const THEME_DEFAULT_HEADER = {
    light: {
        headerSurface: '#ffffff',
        headerText: '#171411',
        headerBorder: '#eadfd3'
    },
    dark: {
        headerSurface: '#1f1a16',
        headerText: '#fcfaf8',
        headerBorder: '#3b342e'
    }
};

/** Default text colors (must match `:root` / `[data-theme="dark"]` --text-* in index.html). */
const THEME_DEFAULT_TEXT = {
    light: {
        textPrimary: '#171411',
        textSecondary: '#6f655c'
    },
    dark: {
        textPrimary: '#fcfaf8',
        textSecondary: '#b9aea3'
    }
};

/** Header transparency 0–100 (0 = opaque, 100 = fully transparent) per mode. */
const THEME_DEFAULT_HEADER_TRANSPARENCY = {
    light: 0,
    dark: 0
};

/**
 * Maximum surface mix amount for the brightness slider.
 * 50 is neutral (no change); 0 / 100 mix the surface up to this fraction with black / white.
 * Kept moderate so card vs. background separation never collapses and text stays readable.
 * Chosen so the slider extremes still hit roughly WCAG AA against the auto-adjusted text.
 */
const THEME_SURFACE_BRIGHTNESS_MAX = 0.28;
/** Borders mix slightly less, so they keep contrast against the adjusted surface. */
const THEME_BORDER_BRIGHTNESS_MAX = 0.20;
/**
 * Maximum text mix amount in the *opposite* direction of the surface shift,
 * to maintain readable contrast at the slider extremes. 50 is neutral.
 *
 * Sized so that, combined with `THEME_SURFACE_BRIGHTNESS_MAX = 0.28`, the primary
 * text keeps at least WCAG AA (4.5:1) against every default surface (bgPrimary,
 * bgSecondary, bgCard) in both light and dark mode at any slider position.
 * The previous value (0.22) bleached the text too aggressively and dropped the
 * worst-case contrast to ~4.1:1. With 0.14 the worst-case primary contrast is
 * ~4.6:1 (dark mode, slider=100, against bgCard) — see CHANGELOG.
 */
const THEME_TEXT_CONTRAST_MAX = 0.14;

/** Per-accent surface defaults so the page background changes with the selected color theme. */
const COLOR_THEME_SURFACE_DEFAULTS = {
    heise: {
        light: {
            bgPrimary: '#fffaf5',
            bgSecondary: '#fff4ea',
            borderColor: '#eadfd3'
        },
        dark: {}
    },
    ocean: {
        light: {
            bgPrimary: '#fbfdff',
            bgSecondary: '#f1f8fd',
            borderColor: '#d6e6f2'
        },
        dark: {
            bgPrimary: '#0f1722',
            bgSecondary: '#162131',
            bgCard: '#1b2738',
            borderColor: '#30445d'
        }
    },
    forest: {
        light: {
            bgPrimary: '#fbfefc',
            bgSecondary: '#f2f8f4',
            borderColor: '#d7e6dc'
        },
        dark: {
            bgPrimary: '#101712',
            bgSecondary: '#172119',
            bgCard: '#1d2820',
            borderColor: '#314237'
        }
    },
    violet: {
        light: {
            bgPrimary: '#fcfaff',
            bgSecondary: '#f5f0fc',
            borderColor: '#e2d8f2'
        },
        dark: {
            bgPrimary: '#171221',
            bgSecondary: '#20192d',
            bgCard: '#261f35',
            borderColor: '#433661'
        }
    },
    amber: {
        light: {
            bgPrimary: '#fffbf4',
            bgSecondary: '#fbf3e2',
            borderColor: '#eadcbd'
        },
        dark: {
            bgPrimary: '#1c150d',
            bgSecondary: '#261d12',
            bgCard: '#2d2318',
            borderColor: '#4b3927'
        }
    },
    rose: {
        light: {
            bgPrimary: '#fff9fb',
            bgSecondary: '#faedf2',
            borderColor: '#edd8e1'
        },
        dark: {
            bgPrimary: '#201217',
            bgSecondary: '#2a1920',
            bgCard: '#332028',
            borderColor: '#5a3743'
        }
    },
    slate: {
        light: {
            bgPrimary: '#fbfcfe',
            bgSecondary: '#f4f7fb',
            borderColor: '#dbe4ee'
        },
        dark: {
            bgPrimary: '#12161c',
            bgSecondary: '#19202a',
            bgCard: '#202835',
            borderColor: '#364354'
        }
    },
    midnight: {
        light: {
            bgPrimary: '#fafbff',
            bgSecondary: '#f2f5fc',
            borderColor: '#d9e0f2'
        },
        dark: {
            bgPrimary: '#101322',
            bgSecondary: '#161b31',
            bgCard: '#1d2340',
            borderColor: '#333c68'
        }
    }
};

/**
 * @param {string} colorTheme
 * @param {'light'|'dark'} mode
 * @returns {{ bgPrimary: string, bgSecondary: string, bgCard: string, borderColor: string }}
 */
function getThemeSurfaceDefaults(colorTheme, mode) {
    const normalizedTheme = COLOR_THEME_IDS.includes(colorTheme) ? colorTheme : 'heise';
    return {
        ...THEME_DEFAULT_SURFACE[mode],
        ...((COLOR_THEME_SURFACE_DEFAULTS[normalizedTheme] && COLOR_THEME_SURFACE_DEFAULTS[normalizedTheme][mode]) || {})
    };
}

/** Persisted manual card order per visible main-view state (source + categories + sort + date filter). */
const MANUAL_CARD_ORDER_STORAGE_KEY = 'heise_manual_card_order_by_view';
/** Persisted "Neu" article URLs per source until the user acknowledges the badge. */
const PENDING_NEW_ARTICLE_URLS_STORAGE_KEY = 'heise_pending_new_article_urls_by_source';

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
        this.disabledCategoriesBySource = {};
        this.favoriteNewsSources = [];
        this.selectedArticleIds = new Set();
        this.currentPage = 1;
        // Minimum page size; wide grids raise this to the detected column count.
        this.baseItemsPerPage = 9;
        this.itemsPerPage = this.baseItemsPerPage;
        this._newsGridResizeTimer = 0;

        /** Article IDs that appeared since the previous fetch (cleared after 3s hover or highlight removal). */
        this._newArticleIds = new Set();
        /** Source id currently represented by `this.newsItems` (used for source-local "Neu" detection across reloads). */
        this._loadedNewsSource = '';
        /** @type {Record<string, string[]>} */
        this._pendingNewArticleUrlsBySource = App.loadPendingNewArticleUrlState();

        // Performance optimization: Filter cache to avoid repeated O(n) filtering on the same dataset.
        /** @type {Map<string, object[]>} */
        this._filterCache = new Map();
        /** @type {Record<string, string[]>} */
        this._manualCardOrderByView = App.loadManualCardOrderState();
        this._draggedNewsCardId = '';
        this._dragNewsDropTargetId = '';
        this._dragNewsDropPosition = 'before';

        /** Background KI run for new articles after refresh (avoid overlap with „Alle Zusammenfassungen“). */
        this._autoSummarizeNewInProgress = false;
        /** @type {Map<string, {isFavorite?: boolean, isHidden?: boolean, readState?: ''|'seen'|'read'}>} */
        this._articleFlags = new Map();
        /** Serializes MyMemory in-place translation passes. */
        this._articleInPlaceTranslationRunning = false;
        /** When a pass was requested while another run was active, run again after the current pass finishes. */
        this._articleInPlaceTranslationPending = false;
        /** @type {ReturnType<typeof setTimeout>|0} */
        this._articleInPlaceTranslationDebounce = 0;
        /** @type {Map<string, string>} */
        this._uiTranslationCache = new Map();
        /** @type {Array<{ id: string, aliases?: string[], loaded?: boolean, reasoningAllowedOptions?: Array<'off'|'low'|'medium'|'high'|'on'>, reasoningDefault?: ''|'off'|'low'|'medium'|'high'|'on' }>} */
        this._availableLmModels = [];

        // DOM Elements
        this.elements = {
            newsGrid: document.getElementById('newsGrid'),
            categoryFilters: document.getElementById('categoryFilters'),
            loadMoreBtn: document.getElementById('loadMoreBtn'),
            showAllNewsBtn: document.getElementById('showAllNewsBtn'),
            themeToggle: document.getElementById('themeToggle'),
            refreshBtn: document.getElementById('refreshBtn'),
            generateSelectedSourcesBtn: document.getElementById('generateSelectedSourcesBtn'),
            summarizeAllBtn: document.getElementById('summarizeAllBtn'),
            summarizeAllRefreshBtn: document.getElementById('summarizeAllRefreshBtn'),
            exportBtn: document.getElementById('exportBtn'),
            manualLink: document.getElementById('manualLink'),
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
            lmModelRefreshBtn: document.getElementById('lmModelRefreshBtn'),
            summaryLangMode: document.getElementById('summaryLangMode'),
            summaryStyle: document.getElementById('summaryStyle'),
            summaryStyleCustom: document.getElementById('summaryStyleCustom'),
            articleTranslationEnabled: document.getElementById('articleTranslationEnabled'),
            articleTranslationTargetLang: document.getElementById('articleTranslationTargetLang'),
            articleTranslationLinkProvider: document.getElementById('articleTranslationLinkProvider'),
            summaryCacheDays: document.getElementById('summaryCacheDays'),
            summaryConcurrency: document.getElementById('summaryConcurrency'),
            kiRequestTimeoutSeconds: document.getElementById('kiRequestTimeoutSeconds'),
            reasoningSelect: document.getElementById('reasoningSelect'),
            reasoningEnabledCheckbox: document.getElementById('reasoningEnabledCheckbox'),
            alternativeLinksCount: document.getElementById('alternativeLinksCount'),
            alternativeLinksDisplayMode: document.getElementById('alternativeLinksDisplayMode'),
            forumEntriesDiscoveryMode: document.getElementById('forumEntriesDiscoveryMode'),
            youtubeSuggestionsDiscoveryMode: document.getElementById('youtubeSuggestionsDiscoveryMode'),
            alternativeLinksBlacklist: document.getElementById('alternativeLinksBlacklist'),
            webSearchEngine: document.getElementById('webSearchEngine'),
            cancelSettings: document.getElementById('cancelSettings'),
            saveSettings: document.getElementById('saveSettings'),
            openKiStatsBtn: document.getElementById('openKiStatsBtn'),
            kiStatsModal: document.getElementById('kiStatsModal'),
            clearKiStatsBtn: document.getElementById('clearKiStatsBtn'),
            cancelKiStatsBtn: document.getElementById('cancelKiStatsBtn'),
            exportModal: document.getElementById('exportModal'),
            exportFormat: document.getElementById('exportFormat'),
            exportScope: document.getElementById('exportScope'),
            exportPeriodWrap: document.getElementById('exportPeriodWrap'),
            exportPeriodType: document.getElementById('exportPeriodType'),
            exportPeriodDate: document.getElementById('exportPeriodDate'),
            exportIncludeSummary: document.getElementById('exportIncludeSummary'),
            exportIncludeAlternativeLinks: document.getElementById('exportIncludeAlternativeLinks'),
            exportIncludeReddit: document.getElementById('exportIncludeReddit'),
            exportIncludeComments: document.getElementById('exportIncludeComments'),
            exportIncludeKiMeta: document.getElementById('exportIncludeKiMeta'),
            exportIncludeThumbnails: document.getElementById('exportIncludeThumbnails'),
            exportSelectionInfo: document.getElementById('exportSelectionInfo'),
            cancelExportBtn: document.getElementById('cancelExportBtn'),
            runExportBtn: document.getElementById('runExportBtn'),
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
            headerSourceFavoriteToggleBtn: document.getElementById('headerSourceFavoriteToggleBtn'),
            headerSubtitle: document.getElementById('headerSubtitle'),
            headerSourcePrevBtn: document.getElementById('headerSourcePrevBtn'),
            headerSourceFavoritesBtn: document.getElementById('headerSourceFavoritesBtn'),
            headerSourceNextBtn: document.getElementById('headerSourceNextBtn'),
            newsSourceSelect: document.getElementById('newsSourceSelect'),
            colorThemeSelect: document.getElementById('colorThemeSelect'),
            headerColorThemeWrap: document.getElementById('headerColorThemeWrap'),
            youtubeModal: document.getElementById('youtubeModal'),
            themeModeSelect: document.getElementById('themeModeSelect'),
            settingsColorThemeSelect: document.getElementById('settingsColorThemeSelect'),
            articleStateNewColor: document.getElementById('articleStateNewColor'),
            articleStateSeenColor: document.getElementById('articleStateSeenColor'),
            articleStateReadColor: document.getElementById('articleStateReadColor'),
            themeBrightnessLight: document.getElementById('themeBrightnessLight'),
            themeBrightnessDark: document.getElementById('themeBrightnessDark'),
            themeResetDefaultsBtn: document.getElementById('themeResetDefaultsBtn'),
            articleThumbnailsEnabled: document.getElementById('articleThumbnailsEnabled'),
            themeLightBgPrimary: document.getElementById('themeLightBgPrimary'),
            themeLightBgSecondary: document.getElementById('themeLightBgSecondary'),
            themeLightBgCard: document.getElementById('themeLightBgCard'),
            themeLightBorder: document.getElementById('themeLightBorder'),
            themeDarkBgPrimary: document.getElementById('themeDarkBgPrimary'),
            themeDarkBgSecondary: document.getElementById('themeDarkBgSecondary'),
            themeDarkBgCard: document.getElementById('themeDarkBgCard'),
            themeDarkBorder: document.getElementById('themeDarkBorder'),
            themeLightHeaderSurface: document.getElementById('themeLightHeaderSurface'),
            themeLightHeaderText: document.getElementById('themeLightHeaderText'),
            themeLightHeaderBorder: document.getElementById('themeLightHeaderBorder'),
            themeLightHeaderTransparency: document.getElementById('themeLightHeaderTransparency'),
            themeDarkHeaderSurface: document.getElementById('themeDarkHeaderSurface'),
            themeDarkHeaderText: document.getElementById('themeDarkHeaderText'),
            themeDarkHeaderBorder: document.getElementById('themeDarkHeaderBorder'),
            themeDarkHeaderTransparency: document.getElementById('themeDarkHeaderTransparency'),
            selectedSourcesGenerationModal: document.getElementById(
                'selectedSourcesGenerationModal'
            ),
            selectedSourcesGenerationState: document.getElementById(
                'selectedSourcesGenerationState'
            ),
            selectedSourcesGenerationCurrentValue: document.getElementById(
                'selectedSourcesGenerationCurrentValue'
            ),
            selectedSourcesGenerationRemainingValue: document.getElementById(
                'selectedSourcesGenerationRemainingValue'
            ),
            selectedSourcesGenerationProgressValue: document.getElementById(
                'selectedSourcesGenerationProgressValue'
            ),
            selectedSourcesGenerationCurrentArticlesValue: document.getElementById(
                'selectedSourcesGenerationCurrentArticlesValue'
            ),
            selectedSourcesGenerationEtaValue: document.getElementById(
                'selectedSourcesGenerationEtaValue'
            ),
            selectedSourcesGenerationScopeSelect: document.getElementById(
                'selectedSourcesGenerationScopeSelect'
            ),
            selectedSourcesGenerationPeriodSelect: document.getElementById(
                'selectedSourcesGenerationPeriodSelect'
            ),
            startSelectedSourcesGenerationBtn: document.getElementById(
                'startSelectedSourcesGenerationBtn'
            ),
            cancelSelectedSourcesGenerationBtn: document.getElementById(
                'cancelSelectedSourcesGenerationBtn'
            ),
            backgroundSelectedSourcesRefreshEnabled: document.getElementById(
                'backgroundSelectedSourcesRefreshEnabled'
            ),
            backgroundSelectedSourcesRefreshScopeSelect: document.getElementById(
                'backgroundSelectedSourcesRefreshScopeSelect'
            )
        };

        // Timer reference
        this.updateTimer = null;
        this._scheduledAutoUpdateInProgress = false;
        this._selectedSourcesGenerationInProgress = false;
        this._selectedSourcesGenerationCancelRequested = false;
        this._selectedSourcesGenerationState = {
            phase: 'idle',
            currentSourceId: '',
            totalSources: 0,
            completedSources: 0,
            remainingSources: 0,
            failedSources: 0,
            currentSourceTotalArticles: 0,
            currentSourceCompletedArticles: 0,
            estimatedRemainingArticles: 0
        };

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
        this._i18nHeaderSourcePrevTitle = 'Vorherige Quelle';
        this._i18nHeaderSourceNextTitle = 'Nächste Quelle';
        this._i18nHeaderSourceFavoritesTitle = 'Zwischen favorisierten Quellen wechseln';
        this._i18nHeaderSourceFavoritesEmptyTitle = 'Keine favorisierten Quellen aktiv';
        this._i18nHeaderSourceFavoriteAddTitle = 'Aktuelle Quelle als Favorit markieren';
        this._i18nHeaderSourceFavoriteRemoveTitle = 'Aktuelle Quelle aus Favoriten entfernen';
        this._i18nDashboardSaved = '';
        this._i18nDashboardNeedOne = '';
        this._i18nToggleVisibleEnable = '';
        this._i18nToggleVisibleDisable = '';
        /** @type {Record<string, string>} */
        this._i18nFilterLabels = {};
        this._i18nHeiseMagazineHeading = '';
        /** @type {Record<string, string>} */
        this._i18nHeiseMagazineById = {};
        this._i18nBatchSummarizeProgress = '';
        this._i18nBatchSummarizeProgressRefresh = '';
        this._i18nSelectedSourcesGenerationConfirm = '';
        this._i18nSelectedSourcesGenerationStatusPreparing = 'Vorbereitung …';
        this._i18nSelectedSourcesGenerationStatusFetching = 'Artikel werden geladen …';
        this._i18nSelectedSourcesGenerationStatusGenerating =
            'KI-Zusammenfassungen, alternative Links und Reddit werden erzeugt …';
        this._i18nSelectedSourcesGenerationStatusCancelRequested =
            'Abbruch angefordert — laufende Anfragen werden noch sauber beendet.';
        this._i18nSelectedSourcesGenerationStatusCancelled = 'Vorgang abgebrochen.';
        this._i18nSelectedSourcesGenerationStatusDone = 'Vorgang abgeschlossen.';
        this._i18nSelectedSourcesGenerationStatusDoneWithFailures =
            'Vorgang abgeschlossen — {count} Quelle(n) konnten nicht verarbeitet werden.';
        this._i18nSelectedSourcesGenerationStatusBusy =
            'Die Vollgenerierung läuft bereits.';
        this._i18nSelectedSourcesGenerationStatusBlocked =
            'Bitte warten, bis laufende KI- oder Aktualisierungsjobs beendet sind.';
        this._i18nSelectedSourcesGenerationCurrentNone = '—';
        this._i18nSelectedSourcesGenerationEtaUnavailable = '—';
        this._i18nSelectedSourcesGenerationCancelBtn = 'Abbrechen';
        this._i18nSelectedSourcesGenerationCancelPendingBtn = 'Abbruch läuft …';
        this._i18nSelectedSourcesGenerationCloseBtn = 'Schließen';
        this._i18nKiStatsTokenNa = '—';
        this._i18nKiStatsTokenHint = '';
        this._i18nKiStatsChartTpl = '';
        this._i18nKiStatsClearConfirm = '';
        this._i18nKiStatsChartAvgLegend = '';
        this._i18nKiStatsChartTotalLegend = '';
        this._i18nKiStatsTokensUnavailable = '';
        this._i18nKiStatsChartYTitle = '';
        this._i18nKiStatsChartTotalTokens = '';
        this._i18nKiStatsChartAvgTokens = '';
        this._i18nKiStatsChartAvgDuration = '';
        this._i18nKiStatsChartNewTpl = '';
        this._i18nKiStatsTopModel = 'Model';
        this._i18nLmModelHintDefault = '';
        this._i18nLmModelAutomatic = 'Automatic — use the currently loaded LM Studio model';
        this._i18nLmModelLoading = 'Loading model list…';
        this._i18nLmModelLoadErrorTpl = 'Could not load model list: {error}';
        this._i18nLmModelRefreshTitle = 'Reload model list';
        this._i18nLmModelRefreshAria = 'Reload model list';
        this._i18nLmModelLoadedPrefix = '●';
        this._i18nLmModelNotInListTpl = '{id} (not in server list)';
        this._i18nLmModelActiveSuffix = ' — currently in use';
        this._i18nLmModelFileError =
            '“REST via same page origin” does not work with file://. Use http(s) or disable the option.';
        this._i18nReasoningLevelHint =
            'Choose the reasoning level for LM Studio models (when supported). Values match the LM Studio API.';
        this._i18nReasoningEnabledHint =
            'Enable reasoning feature (for LLMs that support this feature).';
        this._i18nReasoningLevelOff = 'Off';
        this._i18nReasoningLevelLow = 'Low';
        this._i18nReasoningLevelMedium = 'Medium';
        this._i18nReasoningLevelHigh = 'High';
        this._i18nReasoningLevelOn = 'On';
        this._i18nArticleTranslationToolbarHint = '';
        this._i18nArticleTranslationReloadStatus = '';
        this._i18nArticleTranslationQuota = '';
        this._i18nAltLinksCount = '{count} alternative sources';
        this._i18nAltLinksBtnShow = 'Show alternative links';
        this._i18nAltLinksBtnHide = 'Hide alternative links';
        this._i18nAltLinksRefresh = 'Refresh alternative links';
        this._i18nAltLinksRefreshDone = 'Alternative links updated.';
        this._i18nAltLinksErrNoUrl = 'No article URL for alternative link search.';
        this._i18nAltLinksErrNoSummary = 'No summary yet — load or generate one first.';
        this._i18nAltLinksRefreshNone = 'No alternative links returned (search or probe).';
        this._i18nWebSearchBtn = 'Weitere Artikel';
        this._i18nWebSearchTitle = 'Gleiches Thema per Suchmaschine finden';
        this._i18nRedditSearchBtn = 'Reddit';
        this._i18nRedditSearchTitle = 'Search Reddit for threads on this topic (up to 5)';
        this._i18nRedditNone = 'No matching Reddit threads found.';
        this._i18nRedditError = 'Reddit search failed.';
        this._i18nRedditNoTitle = 'No article title for Reddit search.';
        this._i18nRedditFound = '{count} Reddit thread(s)';
        this._i18nRedditFoundAi = 'Reddit (KI): {count} Thread(s) — Suche: {queries}';
        this._i18nSummaryRefreshBtn = 'Neu erstellen';
        this._i18nShareBtn = 'Teilen';
        this._i18nShareTitle = 'Artikel und sichtbare Karteninhalte teilen';
        this._i18nShareDone = 'Artikel an die Teilen-Funktion übergeben.';
        this._i18nShareCopied = 'Artikelinhalt in die Zwischenablage kopiert.';
        this._i18nShareUnavailable = 'Teilen ist in diesem Browser hier nicht verfügbar.';
        this._i18nShareFailed = 'Teilen fehlgeschlagen.';
        this._i18nShareSectionSummary = 'Zusammenfassung';
        this._i18nShareSectionAlternativeLinks = 'Alternative Links';
        this._i18nShareSectionReddit = 'Reddit Threads';
        this._i18nShareSectionComments = 'Kommentar-Metadaten';
        this._i18nNewsCountLoaded = '{count} Nachrichten geladen';
        this._i18nExportSelectionInfo = 'Ausgewählt: {selected}, sichtbar: {visible}';
        this._i18nExportDone = 'Export erstellt: {count} Artikel ({format}).';
        this._i18nExportNoItems = 'Keine Artikel für den Export gefunden.';
        this._i18nThemeBrightnessHintNeutral = '{value} % — neutral (Standardfarben)';
        this._i18nThemeBrightnessHintLighter = '{value} % — Flächen heller, Text bleibt gut lesbar';
        this._i18nThemeBrightnessHintDarker = '{value} % — Flächen dunkler, Text bleibt gut lesbar';

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
        return ['heise', 'bild', 'telepolis', 'golem', 'computerbase', 't3n', 'it_administrator', 'verge'];
    }

    /** @returns {{ getSourceEntry?: Function, getSourceDisplayName?: Function, getSourceSiteUrl?: Function, getSourceLanguage?: Function, getSourceLanguageByHostname?: Function, getSourceFilterMode?: Function }|null} */
    static sourceRegistryUtils() {
        if (
            typeof window !== 'undefined' &&
            window.NEWS_SOURCE_REGISTRY_UTILS &&
            typeof window.NEWS_SOURCE_REGISTRY_UTILS === 'object'
        ) {
            return window.NEWS_SOURCE_REGISTRY_UTILS;
        }
        return null;
    }

    /**
     * @param {string} source
     * @returns {{ id?: string, siteUrl?: string, displayName?: string, language?: string, filterMode?: string }|null}
     */
    static getSourceRegistryEntry(source) {
        const utils = App.sourceRegistryUtils();
        if (utils && typeof utils.getSourceEntry === 'function') {
            return utils.getSourceEntry(source);
        }
        return null;
    }

    /**
     * @param {string} source
     * @returns {string}
     */
    static getSourceDisplayName(source) {
        const utils = App.sourceRegistryUtils();
        if (utils && typeof utils.getSourceDisplayName === 'function') {
            const label = String(utils.getSourceDisplayName(source) || '').trim();
            if (label) {
                return label;
            }
        }
        const fallback = {
            heise: 'heise.de',
            bild: 'BILD',
            telepolis: 'Telepolis',
            golem: 'golem.de',
            computerbase: 'ComputerBase',
            t3n: 't3n.de',
            it_administrator: 'IT-Administrator',
            verge: 'The Verge'
        };
        return fallback[String(source || '').trim()] || String(source || '').trim();
    }

    /**
     * @param {string} source
     * @returns {string}
     */
    static getSourceSiteUrl(source) {
        const utils = App.sourceRegistryUtils();
        if (utils && typeof utils.getSourceSiteUrl === 'function') {
            const siteUrl = String(utils.getSourceSiteUrl(source) || '').trim();
            if (siteUrl) {
                return siteUrl;
            }
        }
        const fallback = {
            heise: 'https://www.heise.de',
            bild: 'https://www.bild.de',
            telepolis: 'https://www.telepolis.de',
            golem: 'https://www.golem.de',
            computerbase: 'https://www.computerbase.de',
            t3n: 'https://t3n.de',
            it_administrator: 'https://www.it-administrator.de',
            verge: 'https://www.theverge.com'
        };
        return fallback[String(source || '').trim()] || '';
    }

    /**
     * @param {string} source
     * @returns {string}
     */
    static getSourceLanguage(source) {
        const utils = App.sourceRegistryUtils();
        if (utils && typeof utils.getSourceLanguage === 'function') {
            const lang = String(utils.getSourceLanguage(source) || '').trim().toLowerCase();
            if (lang) {
                return lang;
            }
        }
        const id = String(source || '').trim();
        if (id === 'verge') {
            return 'en';
        }
        return 'de';
    }

    /**
     * @param {string} hostname
     * @returns {string}
     */
    static getSourceLanguageByHostname(hostname) {
        const utils = App.sourceRegistryUtils();
        if (utils && typeof utils.getSourceLanguageByHostname === 'function') {
            return String(utils.getSourceLanguageByHostname(hostname) || '')
                .trim()
                .toLowerCase();
        }
        return '';
    }

    /**
     * @param {string} source
     * @returns {string}
     */
    static getSourceFilterMode(source) {
        const utils = App.sourceRegistryUtils();
        if (utils && typeof utils.getSourceFilterMode === 'function') {
            const mode = String(utils.getSourceFilterMode(source) || '').trim().toLowerCase();
            if (mode) {
                return mode;
            }
        }
        const id = String(source || '').trim();
        if (id === 'heise') {
            return 'heise';
        }
        if (id === 'bild' || id === 'telepolis') {
            return 'single';
        }
        if (['golem', 'computerbase', 't3n', 'it_administrator', 'verge'].includes(id)) {
            return 'generic';
        }
        return 'none';
    }

    /** Sources that use a dedicated single-category filter group instead of the generic rubric set. */
    static singleCategoryNewsSourceSet() {
        return new Set(
            App.newsCatalogIds().filter((id) => App.getSourceFilterMode(id) === 'single')
        );
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
     * @param {unknown} raw
     * @returns {string[]}
     */
    static normalizeFavoriteNewsSourcesArray(raw) {
        const order = App.newsCatalogIds();
        const known = new Set(order);
        if (!Array.isArray(raw) || raw.length === 0) {
            return [];
        }
        const picked = new Set(
            raw.map((x) => String(x).trim()).filter((id) => known.has(id))
        );
        if (picked.size === 0) {
            return [];
        }
        return order.filter((id) => picked.has(id));
    }

    /**
     * @param {unknown} raw
     * @returns {Record<string, string[]>}
     */
    static normalizeDisabledCategoriesBySource(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            return {};
        }
        const knownSources = new Set(App.newsCatalogIds());
        const out = {};
        Object.entries(raw).forEach(([sourceId, value]) => {
            const source = String(sourceId || '').trim();
            if (!source || !knownSources.has(source) || !Array.isArray(value)) {
                return;
            }
            out[source] = [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
        });
        return out;
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

    /**
     * Exact stored source id from cached rows; unlike `normalizeNewsSource`, this must not remap disabled sources.
     * @param {unknown} raw
     * @returns {string}
     */
    static normalizeStoredNewsSourceId(raw) {
        const s = String(raw || '').trim();
        return App.newsCatalogIds().includes(s) ? s : '';
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
        return new Set(
            App.newsCatalogIds().filter((id) => App.getSourceFilterMode(id) === 'generic')
        );
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
        if (s === 'bild') {
            return new Set(['bild']);
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

    /** Categories used by BILD feed articles (single-source grouping). */
    static bildFeedCategorySet() {
        return new Set(['bild']);
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
            this.clearArticleTranslationCookieIfDisabled();
            await this.loadArticleFlags();
            await this.purgeHiddenArticlesFromNewsCache();

            await this.applySortLabelsFromLocale();

            await this.maybeDetectDevServerRestOrigin();
            this.syncRestSameOriginCheckboxFromStorage();

            // Set up event listeners
            this.setupEventListeners();
            this.bindPreferredColorSchemeListener();

            this.applyColorTheme();
            // Apply theme
            this.applyTheme();
            this.applyArticleStateColorVariables();

            this.initHeaderBrand();

            // Initial news fetch
            await this.fetchNews();

            this.refreshArticleTranslationToolbarFromSettings();
            this.scheduleArticleInPlaceTranslation();

            // Start auto-update timer
            this.startAutoUpdateTimer();
            // Prewarm favorite sources shortly after start instead of waiting a full interval.
            this.scheduleImmediateBackgroundRefresh();

            // Initial KI-Verbindungstest (GET /v1/models oder Test-Anfrage)
            await this.testKiConnection();

            console.log('Application initialized successfully');

        } catch (error) {
            console.error('Initialization error:', error);
            this.showStatus('Fehler beim Laden der Anwendung', true);
        }
    }

    setupEventListeners() {
        if (this.elements.categoryFilters) {
            this.elements.categoryFilters.addEventListener('change', (event) => {
                const target = event.target;
                if (!(target instanceof HTMLInputElement) || !target.classList.contains('category-checkbox')) {
                    return;
                }
                this.handleCategoryChange();
            });
        }

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

        // Disabled: No automatic refresh when tab becomes visible again
        /*
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
        */

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
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', () => this.scheduleNewsGridCapacitySync());
        }

        // Theme toggle
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());

        if (this.elements.colorThemeSelect) {
            this.elements.colorThemeSelect.addEventListener('change', () => void this.persistColorTheme());
        }

        this.wireThemeSettingsListeners();

        // Refresh button
        this.elements.refreshBtn.addEventListener('click', () => {
            if (this._selectedSourcesGenerationInProgress) {
                return;
            }
            void this.fetchNews(true);
        });
        if (this.elements.generateSelectedSourcesBtn) {
            this.elements.generateSelectedSourcesBtn.addEventListener('click', () =>
                this.openSelectedSourcesGenerationSetup()
            );
        }
        if (this.elements.startSelectedSourcesGenerationBtn) {
            this.elements.startSelectedSourcesGenerationBtn.addEventListener('click', () =>
                void this.confirmAndRunSelectedSourcesGeneration()
            );
        }

        // Batch: all summaries for current filter
        if (this.elements.summarizeAllBtn) {
            this.elements.summarizeAllBtn.addEventListener('click', () => this.summarizeAllFilteredNews({ forceRefresh: false }));
        }
        if (this.elements.summarizeAllRefreshBtn) {
            this.elements.summarizeAllRefreshBtn.addEventListener('click', () => this.confirmAndSummarizeAllRegenerate());
        }
        if (this.elements.exportBtn) {
            this.elements.exportBtn.addEventListener('click', () => this.openExportModal());
        }
        if (this.elements.cancelExportBtn) {
            this.elements.cancelExportBtn.addEventListener('click', () => this.closeExportModal());
        }
        if (this.elements.runExportBtn) {
            this.elements.runExportBtn.addEventListener('click', () => void this.runExport());
        }
        if (this.elements.exportScope) {
            this.elements.exportScope.addEventListener('change', () => this.syncExportScopeUi());
        }
        if (this.elements.exportFormat) {
            this.elements.exportFormat.addEventListener('change', () => this.syncExportFormatUi());
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
        document.addEventListener('ki-stats-updated', () => {
            if (this.elements.kiStatsModal && this.elements.kiStatsModal.classList.contains('active')) {
                this.refreshKiStatsPanel();
            }
        });

        // Add event listeners for period selector buttons
        const periodBtns = document.querySelectorAll('.btn-period');
        if (periodBtns) {
            periodBtns.forEach((btn) => {
                btn.addEventListener('click', () => this.switchKiStatsPeriod(btn));
            });
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
        if (this.elements.backgroundSelectedSourcesRefreshEnabled) {
            this.elements.backgroundSelectedSourcesRefreshEnabled.addEventListener('change', () => {
                if (this.elements.backgroundSelectedSourcesRefreshScopeSelect) {
                    this.elements.backgroundSelectedSourcesRefreshScopeSelect.disabled =
                        !this.elements.backgroundSelectedSourcesRefreshEnabled.checked;
                }
            });
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
            this.elements.apiBaseUrl.addEventListener('blur', () => {
                if (this.elements.settingsModal && this.elements.settingsModal.classList.contains('active')) {
                    void this.populateModelDropdown();
                }
            });
        }
        if (this.elements.lmApiToken) {
            this.elements.lmApiToken.addEventListener('blur', () => {
                if (this.elements.settingsModal && this.elements.settingsModal.classList.contains('active')) {
                    void this.populateModelDropdown();
                }
            });
        }
        if (this.elements.lmModelRefreshBtn) {
            this.elements.lmModelRefreshBtn.addEventListener('click', () => void this.populateModelDropdown());
        }
        if (this.elements.lmModel) {
            this.elements.lmModel.addEventListener('change', () => this.syncReasoningControlsForCurrentModel());
        }
        if (this.elements.reasoningEnabledCheckbox) {
            this.elements.reasoningEnabledCheckbox.addEventListener('change', () =>
                this.syncReasoningControlsForCurrentModel()
            );
        }

        if (this.elements.articleTranslationEnabled) {
            this.elements.articleTranslationEnabled.addEventListener('change', () => this.syncArticleTranslationFormDisabled());
        }

        if (this.elements.summaryStyle) {
            this.elements.summaryStyle.addEventListener('change', () => this.syncSummaryStyleCustomVisibility());
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
        if (this.elements.headerSourcePrevBtn) {
            this.elements.headerSourcePrevBtn.addEventListener('click', () =>
                void this.moveHeaderNewsSource(-1)
            );
        }
        if (this.elements.headerSourceFavoritesBtn) {
            this.elements.headerSourceFavoritesBtn.addEventListener('click', () =>
                void this.moveHeaderToNextFavoriteNewsSource()
            );
        }
        if (this.elements.headerSourceNextBtn) {
            this.elements.headerSourceNextBtn.addEventListener('click', () =>
                void this.moveHeaderNewsSource(1)
            );
        }
        if (this.elements.headerSourceFavoriteToggleBtn) {
            this.elements.headerSourceFavoriteToggleBtn.addEventListener('click', () =>
                void this.toggleCurrentNewsSourceFavorite()
            );
        }

        // Event delegation on newsGrid for all card buttons (replaces multiple document listeners)
        // Note: newsGrid may not exist yet at init time, so we set listener dynamically after render
        this._newsCardClickHandler = (e) => {
            const target = e.target;
            if (!target || typeof target.closest !== 'function') {
                return;
            }

            const originalArticleLink = target.closest('a[data-original-article-link="1"]');
            if (originalArticleLink) {
                this.markArticleReadStateFromCard(originalArticleLink.closest('.news-card'), 'read');
                return;
            }

            // YouTube button
            const youtubeBtn = target.closest('.youtube-toggle');
            if (youtubeBtn) {
                e.preventDefault();
                const rawUrl = youtubeBtn.getAttribute('data-url') || '';
                let url = '';
                try {
                    url = decodeURIComponent(rawUrl).trim();
                } catch (_) {
                    url = rawUrl.trim();
                }
                if (!url) return;

                // Resolve article metadata
                const card = target.closest('.news-card');
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
                return;
            }

            // Web search button
            const webSearchBtn = target.closest('.article-web-search-btn');
            if (webSearchBtn) {
                e.preventDefault();
                const card = webSearchBtn.closest('.news-card');
                const cardId = card && card.dataset ? card.dataset.id : '';
                if (!cardId) return;
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
                return;
            }

            // Reddit search button
            const redditBtn = target.closest('.article-reddit-search-btn');
            if (redditBtn) {
                e.preventDefault();
                const card = redditBtn.closest('.news-card');
                const cardId = card && card.dataset ? card.dataset.id : '';
                if (!cardId) return;
                void this.searchRedditForArticle(cardId, redditBtn);
                return;
            }

            // Share button
            const shareBtn = target.closest('.article-share-btn');
            if (shareBtn) {
                e.preventDefault();
                const card = shareBtn.closest('.news-card');
                const cardId = card && card.dataset ? card.dataset.id : '';
                if (!cardId) return;
                void this.shareArticleCard(cardId, shareBtn);
                return;
            }

            // Alternative links refresh button
            const altLinksRefreshBtn = target.closest('.summary-alt-links-refresh-btn');
            if (altLinksRefreshBtn) {
                e.preventDefault();
                const summaryDiv = altLinksRefreshBtn.closest('.news-summary');
                if (summaryDiv) {
                    void this.refreshAlternativeLinksForCard(summaryDiv, altLinksRefreshBtn);
                }
                return;
            }

            // Alternative links toggle button
            const altLinksToggleBtn = target.closest('.summary-alt-links-toggle-btn');
            if (altLinksToggleBtn) {
                e.preventDefault();
                const summaryDiv = altLinksToggleBtn.closest('.news-summary');
                const list = summaryDiv ? summaryDiv.querySelector('.summary-alt-links-list') : null;
                if (!list || list.hidden === undefined) return;
                const exp = altLinksToggleBtn.getAttribute('aria-expanded') === 'true';
                const nextExpanded = !exp;
                altLinksToggleBtn.setAttribute('aria-expanded', String(nextExpanded));
                list.hidden = !nextExpanded;
                altLinksToggleBtn.textContent = nextExpanded ? '▲' : '▼';
                altLinksToggleBtn.title = nextExpanded ? this._i18nAltLinksBtnHide : this._i18nAltLinksBtnShow;
                altLinksToggleBtn.setAttribute('aria-label', nextExpanded ? this._i18nAltLinksBtnHide : this._i18nAltLinksBtnShow);
                return;
            }

            // Favorite button
            const favoriteBtn = target.closest('.article-favorite-btn');
            if (favoriteBtn && !target.classList.contains('summary-toggle')) {
                void this.toggleFavorite(e);
                return;
            }

            // Hide button
            const hideBtn = target.closest('.article-hide-btn');
            if (hideBtn) {
                void this.toggleHidden(e);
                return;
            }

            // Summary toggle button
            const summaryToggleBtn = target.closest('.summary-toggle');
            if (summaryToggleBtn) {
                e.preventDefault();
                this.toggleSummary(e);
                return;
            }

            // Summary refresh button
            const summaryRefreshBtn = target.closest('.summary-refresh-btn');
            if (summaryRefreshBtn) {
                e.preventDefault();
                this.refreshSummary(e);
                return;
            }
        };

        // Set event listener on newsGrid when it exists (already assigned to this._newsCardClickHandler above)
        if (this.elements.newsGrid && this._newsCardClickHandler) {
            this.elements.newsGrid.addEventListener('click', this._newsCardClickHandler);
        }
        if (this.elements.newsGrid) {
            this.elements.newsGrid.addEventListener('change', (e) => this.handleNewsGridChange(e));
            this.elements.newsGrid.addEventListener('dragstart', (e) => this.handleNewsCardDragStart(e));
            this.elements.newsGrid.addEventListener('dragover', (e) => this.handleNewsCardDragOver(e));
            this.elements.newsGrid.addEventListener('drop', (e) => this.handleNewsCardDrop(e));
            this.elements.newsGrid.addEventListener('dragend', () => this.clearNewsCardDragState());
        }

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
        if (this.elements.exportModal) {
            this.elements.exportModal.addEventListener('click', (e) => {
                if (e.target === this.elements.exportModal) {
                    this.closeExportModal();
                }
            });
        }
        if (this.elements.selectedSourcesGenerationModal) {
            this.elements.selectedSourcesGenerationModal.addEventListener('click', (e) => {
                if (e.target !== this.elements.selectedSourcesGenerationModal) {
                    return;
                }
                if (this._selectedSourcesGenerationInProgress) {
                    return;
                }
                this.closeSelectedSourcesGenerationModal();
            });
        }
        if (this.elements.cancelSelectedSourcesGenerationBtn) {
            this.elements.cancelSelectedSourcesGenerationBtn.addEventListener('click', () => {
                if (this._selectedSourcesGenerationInProgress) {
                    this.requestSelectedSourcesGenerationCancel();
                    return;
                }
                this.closeSelectedSourcesGenerationModal();
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
                    this.elements.selectedSourcesGenerationModal &&
                    this.elements.selectedSourcesGenerationModal.classList.contains('active')
                ) {
                    if (this._selectedSourcesGenerationInProgress) {
                        this.requestSelectedSourcesGenerationCancel();
                    } else {
                        this.closeSelectedSourcesGenerationModal();
                    }
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

    /** @returns {string[]} Favorite source ids in catalog order. */
    getFavoriteNewsSourceIds() {
        if (Array.isArray(this.favoriteNewsSources)) {
            return App.normalizeFavoriteNewsSourcesArray(this.favoriteNewsSources);
        }
        return App.normalizeFavoriteNewsSourcesArray(this.settings?.favoriteNewsSources);
    }

    /**
     * @param {string} sourceId
     * @returns {boolean}
     */
    isFavoriteNewsSource(sourceId) {
        const normalized = App.normalizeStoredNewsSourceId(sourceId);
        if (!normalized) {
            return false;
        }
        return this.getFavoriteNewsSourceIds().includes(normalized);
    }

    /**
     * @param {string} sourceId
     * @returns {string}
     */
    getNewsSourceSortLabel(sourceId) {
        const id = App.normalizeStoredNewsSourceId(sourceId) || String(sourceId || '').trim();
        return (
            (this._i18nNewsSourceLabels && this._i18nNewsSourceLabels[id]) ||
            App.getSourceDisplayName(id) ||
            id
        );
    }

    /** @returns {string[]} Enabled source ids sorted alphabetically by the visible label. */
    getSortedEnabledNewsSourceIds() {
        const enabled = this.getEnabledNewsSourceIds();
        const orderIndex = new Map(enabled.map((id, index) => [id, index]));
        const lang =
            typeof document !== 'undefined' && document.documentElement
                ? document.documentElement.lang || undefined
                : undefined;
        const collator = new Intl.Collator(lang, {
            usage: 'sort',
            sensitivity: 'base',
            numeric: true
        });
        return [...enabled].sort((a, b) => {
            const cmp = collator.compare(this.getNewsSourceSortLabel(a), this.getNewsSourceSortLabel(b));
            if (cmp !== 0) {
                return cmp;
            }
            return (orderIndex.get(a) || 0) - (orderIndex.get(b) || 0);
        });
    }

    /** @returns {string[]} Enabled favorite source ids in the same order as the header dropdown. */
    getEnabledFavoriteNewsSourceIdsSorted() {
        const favoriteSet = new Set(this.getFavoriteNewsSourceIds());
        return this.getSortedEnabledNewsSourceIds().filter((id) => favoriteSet.has(id));
    }

    /** @returns {string} */
    getCurrentHeaderNewsSourceId() {
        const sorted = this.getSortedEnabledNewsSourceIds();
        const raw =
            (this.elements.newsSourceSelect && this.elements.newsSourceSelect.value) ||
            (this.settings && this.settings.newsSource) ||
            '';
        return App.normalizeNewsSourceWithEnabled(raw, sorted);
    }

    refreshHeaderSourceControls() {
        const currentSource = this.getCurrentHeaderNewsSourceId();
        const sortedSources = this.getSortedEnabledNewsSourceIds();
        const currentIndex = sortedSources.indexOf(currentSource);
        const selectedSourcesGenerationInProgress =
            this._selectedSourcesGenerationInProgress === true;
        const favoriteToggleBtn = this.elements.headerSourceFavoriteToggleBtn;
        const prevBtn = this.elements.headerSourcePrevBtn;
        const favoritesBtn = this.elements.headerSourceFavoritesBtn;
        const nextBtn = this.elements.headerSourceNextBtn;
        const enabledFavorites = this.getEnabledFavoriteNewsSourceIdsSorted();
        const currentIsFavorite = this.isFavoriteNewsSource(currentSource);

        if (favoriteToggleBtn) {
            const label = currentIsFavorite
                ? this._i18nHeaderSourceFavoriteRemoveTitle
                : this._i18nHeaderSourceFavoriteAddTitle;
            favoriteToggleBtn.disabled = selectedSourcesGenerationInProgress || !currentSource;
            favoriteToggleBtn.setAttribute('aria-pressed', currentIsFavorite ? 'true' : 'false');
            favoriteToggleBtn.setAttribute('title', label);
            favoriteToggleBtn.setAttribute('aria-label', label);
        }

        if (prevBtn) {
            const disabled = selectedSourcesGenerationInProgress || currentIndex <= 0;
            prevBtn.disabled = disabled;
            prevBtn.setAttribute('title', this._i18nHeaderSourcePrevTitle);
            prevBtn.setAttribute('aria-label', this._i18nHeaderSourcePrevTitle);
        }

        if (nextBtn) {
            const disabled =
                selectedSourcesGenerationInProgress ||
                currentIndex < 0 ||
                currentIndex >= sortedSources.length - 1;
            nextBtn.disabled = disabled;
            nextBtn.setAttribute('title', this._i18nHeaderSourceNextTitle);
            nextBtn.setAttribute('aria-label', this._i18nHeaderSourceNextTitle);
        }

        if (favoritesBtn) {
            const disabled =
                selectedSourcesGenerationInProgress ||
                enabledFavorites.length === 0 ||
                (enabledFavorites.length === 1 && enabledFavorites[0] === currentSource);
            const label =
                enabledFavorites.length > 0
                    ? this._i18nHeaderSourceFavoritesTitle
                    : this._i18nHeaderSourceFavoritesEmptyTitle;
            favoritesBtn.disabled = disabled;
            favoritesBtn.setAttribute('title', label);
            favoritesBtn.setAttribute('aria-label', label);
        }
    }

    async selectHeaderNewsSource(sourceId) {
        const sel = this.elements.newsSourceSelect;
        if (!sel) {
            return;
        }
        if (this._selectedSourcesGenerationInProgress) {
            this.refreshHeaderSourceControls();
            return;
        }
        const sortedSources = this.getSortedEnabledNewsSourceIds();
        const next = App.normalizeNewsSourceWithEnabled(sourceId, sortedSources);
        const current = this.getCurrentHeaderNewsSourceId();
        sel.value = next;
        if (next === current) {
            this.refreshHeaderSourceControls();
            return;
        }
        await this.onNewsSourceChange();
    }

    async moveHeaderNewsSource(step) {
        if (this._selectedSourcesGenerationInProgress) {
            this.refreshHeaderSourceControls();
            return;
        }
        const sortedSources = this.getSortedEnabledNewsSourceIds();
        const current = this.getCurrentHeaderNewsSourceId();
        const currentIndex = sortedSources.indexOf(current);
        const nextIndex = currentIndex + step;
        if (currentIndex < 0 || nextIndex < 0 || nextIndex >= sortedSources.length) {
            this.refreshHeaderSourceControls();
            return;
        }
        await this.selectHeaderNewsSource(sortedSources[nextIndex]);
    }

    async moveHeaderToNextFavoriteNewsSource() {
        if (this._selectedSourcesGenerationInProgress) {
            this.refreshHeaderSourceControls();
            return;
        }
        const favorites = this.getEnabledFavoriteNewsSourceIdsSorted();
        if (favorites.length === 0) {
            this.refreshHeaderSourceControls();
            return;
        }
        const current = this.getCurrentHeaderNewsSourceId();
        const currentIndex = favorites.indexOf(current);
        const next = currentIndex >= 0 ? favorites[(currentIndex + 1) % favorites.length] : favorites[0];
        if (!next || next === current) {
            this.refreshHeaderSourceControls();
            return;
        }
        await this.selectHeaderNewsSource(next);
    }

    async toggleCurrentNewsSourceFavorite() {
        if (this._selectedSourcesGenerationInProgress) {
            this.refreshHeaderSourceControls();
            return;
        }
        const current = this.getCurrentHeaderNewsSourceId();
        if (!current) {
            return;
        }
        const prevFavorites = [...this.getFavoriteNewsSourceIds()];
        const nextSet = new Set(this.getFavoriteNewsSourceIds());
        if (nextSet.has(current)) {
            nextSet.delete(current);
        } else {
            nextSet.add(current);
        }
        const nextFavorites = App.normalizeFavoriteNewsSourcesArray([...nextSet]);
        this.favoriteNewsSources = nextFavorites;
        if (this.settings) {
            this.settings.favoriteNewsSources = nextFavorites;
        }
        this.refreshHeaderSourceControls();
        try {
            await this.storage.saveSettings({ favoriteNewsSources: nextFavorites });
        } catch (e) {
            const restoredFavorites = App.normalizeFavoriteNewsSourcesArray(prevFavorites);
            this.favoriteNewsSources = restoredFavorites;
            if (this.settings) {
                this.settings.favoriteNewsSources = restoredFavorites;
            }
            this.refreshHeaderSourceControls();
            console.error('toggleCurrentNewsSourceFavorite: failed to persist favoriteNewsSources', e);
        }
    }

    /** @returns {boolean} */
    isBackgroundSelectedSourcesRefreshEnabled() {
        return App.normalizeBackgroundSelectedSourcesRefreshEnabled(
            this.settings?.backgroundSelectedSourcesRefreshEnabled
        );
    }

    /** @returns {'favorites'|'enabled'} */
    getBackgroundSelectedSourcesRefreshScope() {
        return App.normalizeBackgroundSelectedSourcesRefreshScope(
            this.settings?.backgroundSelectedSourcesRefreshScope
        );
    }

    /** @returns {string[]} Source ids the background refresh loop should cover, per the configured scope. */
    getBackgroundRefreshSourceIds() {
        if (this.getBackgroundSelectedSourcesRefreshScope() === 'favorites') {
            return this.getEnabledFavoriteNewsSourceIdsSorted();
        }
        return this.getEnabledNewsSourceIds();
    }

    /**
     * @param {string} sourceId
     * @returns {string}
     */
    getNewsSourceDisplayLabel(sourceId) {
        const normalized = this.normalizeNewsSource(sourceId);
        if (!normalized) {
            return this._i18nSelectedSourcesGenerationCurrentNone || '—';
        }
        return (
            (this._i18nNewsSourceLabels && this._i18nNewsSourceLabels[normalized]) ||
            App.getSourceDisplayName(normalized) ||
            normalized
        );
    }

    openSelectedSourcesGenerationModal() {
        if (this.elements.selectedSourcesGenerationModal) {
            this.elements.selectedSourcesGenerationModal.classList.add('active');
        }
    }

    openSelectedSourcesGenerationSetup() {
        if (this._selectedSourcesGenerationInProgress) {
            this.showStatus(
                this._i18nSelectedSourcesGenerationStatusBusy ||
                    'Die Vollgenerierung läuft bereits.',
                true
            );
            this.openSelectedSourcesGenerationModal();
            return;
        }
        if (
            this._scheduledAutoUpdateInProgress ||
            this._summarizeAllInProgress ||
            this._autoSummarizeNewInProgress
        ) {
            this.showStatus(
                this._i18nSelectedSourcesGenerationStatusBlocked ||
                    'Bitte warten, bis laufende KI- oder Aktualisierungsjobs beendet sind.',
                true
            );
            return;
        }
        if (this.elements.selectedSourcesGenerationPeriodSelect) {
            this.elements.selectedSourcesGenerationPeriodSelect.value = 'today';
        }
        if (this.elements.selectedSourcesGenerationScopeSelect) {
            this.elements.selectedSourcesGenerationScopeSelect.value = 'enabled';
        }
        this._selectedSourcesGenerationCancelRequested = false;
        this.setSelectedSourcesGenerationState({
            phase: 'idle',
            currentSourceId: '',
            totalSources: 0,
            completedSources: 0,
            remainingSources: 0,
            failedSources: 0,
            currentSourceTotalArticles: 0,
            currentSourceCompletedArticles: 0,
            estimatedRemainingArticles: 0
        });
        this.openSelectedSourcesGenerationModal();
    }

    closeSelectedSourcesGenerationModal() {
        if (
            this._selectedSourcesGenerationInProgress &&
            this.elements.selectedSourcesGenerationModal &&
            this.elements.selectedSourcesGenerationModal.classList.contains('active')
        ) {
            return;
        }
        if (this.elements.selectedSourcesGenerationModal) {
            this.elements.selectedSourcesGenerationModal.classList.remove('active');
        }
    }

    renderSelectedSourcesGenerationState() {
        const state = this._selectedSourcesGenerationState || {};
        const currentLabel = state.currentSourceId
            ? this.getNewsSourceDisplayLabel(state.currentSourceId)
            : this._i18nSelectedSourcesGenerationCurrentNone || '—';
        const total = Number.isFinite(state.totalSources) ? state.totalSources : 0;
        const completed = Number.isFinite(state.completedSources) ? state.completedSources : 0;
        const remaining = Number.isFinite(state.remainingSources)
            ? state.remainingSources
            : Math.max(total - completed, 0);
        const currentSourceTotalArticles = Number.isFinite(state.currentSourceTotalArticles)
            ? Math.max(0, state.currentSourceTotalArticles)
            : 0;
        const currentSourceCompletedArticles = Number.isFinite(state.currentSourceCompletedArticles)
            ? Math.max(0, Math.min(state.currentSourceCompletedArticles, currentSourceTotalArticles))
            : 0;

        let phaseText = this._i18nSelectedSourcesGenerationStatusPreparing || 'Vorbereitung …';
        switch (state.phase) {
            case 'idle':
                phaseText =
                    this._i18nSelectedSourcesGenerationStatusReady ||
                    'Zeitraum wählen und Start starten.';
                break;
            case 'fetching':
                phaseText =
                    this._i18nSelectedSourcesGenerationStatusFetching ||
                    'Artikel werden geladen …';
                break;
            case 'generating':
                phaseText =
                    this._i18nSelectedSourcesGenerationStatusGenerating ||
                    'KI-Zusammenfassungen, alternative Links und Reddit werden erzeugt …';
                break;
            case 'cancel_requested':
                phaseText =
                    this._i18nSelectedSourcesGenerationStatusCancelRequested ||
                    'Abbruch angefordert — laufende Anfragen werden noch sauber beendet.';
                break;
            case 'cancelled':
                phaseText =
                    this._i18nSelectedSourcesGenerationStatusCancelled ||
                    'Vorgang abgebrochen.';
                break;
            case 'done':
                if (state.failedSources > 0) {
                    phaseText = (
                        this._i18nSelectedSourcesGenerationStatusDoneWithFailures ||
                        'Vorgang abgeschlossen — {count} Quelle(n) konnten nicht verarbeitet werden.'
                    ).replace(/\{count\}/g, String(state.failedSources));
                } else {
                    phaseText =
                        this._i18nSelectedSourcesGenerationStatusDone || 'Vorgang abgeschlossen.';
                }
                break;
            default:
                break;
        }

        if (this.elements.selectedSourcesGenerationState) {
            this.elements.selectedSourcesGenerationState.textContent = phaseText;
        }
        if (this.elements.selectedSourcesGenerationCurrentValue) {
            this.elements.selectedSourcesGenerationCurrentValue.textContent = currentLabel;
        }
        if (this.elements.selectedSourcesGenerationRemainingValue) {
            this.elements.selectedSourcesGenerationRemainingValue.textContent = String(remaining);
        }
        if (this.elements.selectedSourcesGenerationProgressValue) {
            this.elements.selectedSourcesGenerationProgressValue.textContent =
                `${completed} / ${total}`;
        }
        if (this.elements.selectedSourcesGenerationCurrentArticlesValue) {
            this.elements.selectedSourcesGenerationCurrentArticlesValue.textContent =
                `${currentSourceCompletedArticles} / ${currentSourceTotalArticles}`;
        }
        if (this.elements.selectedSourcesGenerationEtaValue) {
            this.elements.selectedSourcesGenerationEtaValue.textContent =
                this.formatSelectedSourcesGenerationEta(
                    state.estimatedRemainingArticles,
                    state.phase
                );
        }
        if (this.elements.generateSelectedSourcesBtn) {
            this.elements.generateSelectedSourcesBtn.disabled =
                this._selectedSourcesGenerationInProgress;
        }
        if (this.elements.selectedSourcesGenerationPeriodSelect) {
            this.elements.selectedSourcesGenerationPeriodSelect.disabled =
                this._selectedSourcesGenerationInProgress;
        }
        if (this.elements.selectedSourcesGenerationScopeSelect) {
            this.elements.selectedSourcesGenerationScopeSelect.disabled =
                this._selectedSourcesGenerationInProgress;
        }
        if (this.elements.startSelectedSourcesGenerationBtn) {
            this.elements.startSelectedSourcesGenerationBtn.disabled =
                this._selectedSourcesGenerationInProgress ||
                this._selectedSourcesGenerationCancelRequested;
            this.elements.startSelectedSourcesGenerationBtn.textContent =
                this._i18nSelectedSourcesGenerationStartBtn || 'Starten';
        }
        if (this.elements.cancelSelectedSourcesGenerationBtn) {
            this.elements.cancelSelectedSourcesGenerationBtn.disabled =
                this._selectedSourcesGenerationInProgress &&
                this._selectedSourcesGenerationCancelRequested;
            this.elements.cancelSelectedSourcesGenerationBtn.textContent =
                this._selectedSourcesGenerationInProgress
                    ? this._selectedSourcesGenerationCancelRequested
                        ? this._i18nSelectedSourcesGenerationCancelPendingBtn ||
                          'Abbruch läuft …'
                        : this._i18nSelectedSourcesGenerationCancelBtn || 'Abbrechen'
                    : this._i18nSelectedSourcesGenerationCloseBtn || 'Schließen';
        }
        if (this.elements.refreshBtn) {
            this.elements.refreshBtn.disabled = this._selectedSourcesGenerationInProgress;
        }
        if (this.elements.newsSourceSelect) {
            this.elements.newsSourceSelect.disabled = this._selectedSourcesGenerationInProgress;
        }
        this.setDashboardSourceSettingsDisabled(this._selectedSourcesGenerationInProgress);
        this.refreshHeaderSourceControls();
    }

    getOrderedSelectedSourcesForGeneration(sourceIds) {
        const currentSource = this.normalizeNewsSource(this.settings?.newsSource);
        const ordered = [];
        const seen = new Set();
        const normalizedSourceIds = (Array.isArray(sourceIds) ? sourceIds : [])
            .map((sourceId) => this.normalizeNewsSource(sourceId))
            .filter(Boolean);
        if (currentSource && normalizedSourceIds.includes(currentSource)) {
            ordered.push(currentSource);
            seen.add(currentSource);
        }
        normalizedSourceIds.forEach((normalized) => {
            if (!normalized || seen.has(normalized)) {
                return;
            }
            seen.add(normalized);
            ordered.push(normalized);
        });
        return ordered;
    }

    static normalizeSelectedSourcesGenerationScope(raw) {
        const value = String(raw || '').trim();
        return value === 'favorites' ? 'favorites' : 'enabled';
    }

    getSelectedSourcesGenerationScope() {
        return App.normalizeSelectedSourcesGenerationScope(
            this.elements.selectedSourcesGenerationScopeSelect
                ? this.elements.selectedSourcesGenerationScopeSelect.value
                : 'enabled'
        );
    }

    getSelectedSourcesGenerationSourceIds() {
        const scope = this.getSelectedSourcesGenerationScope();
        if (scope === 'favorites') {
            return this.getEnabledFavoriteNewsSourceIdsSorted();
        }
        return this.getEnabledNewsSourceIds();
    }

    getSelectedSourcesGenerationScopeLabel(scope) {
        const normalized = App.normalizeSelectedSourcesGenerationScope(scope);
        const select = this.elements.selectedSourcesGenerationScopeSelect;
        if (select) {
            const option = Array.from(select.options || []).find((opt) => opt.value === normalized);
            if (option && option.textContent) {
                return option.textContent.trim();
            }
        }
        return normalized === 'favorites' ? 'Nur Favoriten' : 'Alle abonnierten Quellen';
    }

    static normalizeSelectedSourcesGenerationPeriod(raw) {
        const value = String(raw || '').trim();
        if (value === 'last_7_days' || value === 'last_30_days' || value === 'all_loaded') {
            return value;
        }
        return 'today';
    }

    getSelectedSourcesGenerationPeriod() {
        return App.normalizeSelectedSourcesGenerationPeriod(
            this.elements.selectedSourcesGenerationPeriodSelect
                ? this.elements.selectedSourcesGenerationPeriodSelect.value
                : 'today'
        );
    }

    static formatLocalDateInputValue(date = new Date()) {
        const d = date instanceof Date && Number.isFinite(date.getTime()) ? date : new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    getSelectedSourcesGenerationPeriodRange(period) {
        const normalized = App.normalizeSelectedSourcesGenerationPeriod(period);
        if (normalized === 'all_loaded') {
            return { period: normalized, start: -Infinity, end: Infinity };
        }
        const today = new Date();
        const dayOffset = normalized === 'last_30_days' ? 29 : normalized === 'last_7_days' ? 6 : 0;
        const startDate = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() - dayOffset,
            0,
            0,
            0,
            0
        );
        const start = App.getLocalDayBounds(App.formatLocalDateInputValue(startDate)).start;
        const end = App.getLocalDayBounds(App.formatLocalDateInputValue(today)).end;
        return { period: normalized, start, end };
    }

    getSelectedSourcesGenerationPeriodLabel(period) {
        const normalized = App.normalizeSelectedSourcesGenerationPeriod(period);
        const select = this.elements.selectedSourcesGenerationPeriodSelect;
        if (select) {
            const option = Array.from(select.options || []).find((opt) => opt.value === normalized);
            if (option && option.textContent) {
                return option.textContent.trim();
            }
        }
        const labels = {
            today: 'Heute',
            last_7_days: 'Letzte 7 Tage',
            last_30_days: 'Letzte 30 Tage',
            all_loaded: 'Alle geladenen Artikel'
        };
        return labels[normalized] || labels.today;
    }

    static getNewsItemPublishedMs(item) {
        const n = Number(item && item.publishedMs);
        if (Number.isFinite(n) && n > 0) {
            return n;
        }
        for (const key of ['publishedAt', 'published', 'pubDate', 'date']) {
            const raw = item && item[key];
            if (!raw) {
                continue;
            }
            const parsed = Date.parse(String(raw));
            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }
        return NaN;
    }

    static isNewsItemInGenerationPeriod(item, periodRange) {
        if (!periodRange || periodRange.period === 'all_loaded') {
            return true;
        }
        const ms = App.getNewsItemPublishedMs(item);
        return (
            Number.isFinite(ms) &&
            ms >= Number(periodRange.start) &&
            ms <= Number(periodRange.end)
        );
    }

    filterNewsItemsForSelectedSourcesGenerationPeriod(items, periodRange) {
        const visibleItems = (Array.isArray(items) ? items : []).filter(
            (item) => !this.isArticleHiddenByUser(item)
        );
        if (!periodRange || periodRange.period === 'all_loaded') {
            return visibleItems;
        }
        return visibleItems.filter((item) =>
            App.isNewsItemInGenerationPeriod(item, periodRange)
        );
    }

    setSelectedSourcesGenerationState(patch = {}) {
        this._selectedSourcesGenerationState = {
            ...(this._selectedSourcesGenerationState || {}),
            ...patch
        };
        this.renderSelectedSourcesGenerationState();
    }

    requestSelectedSourcesGenerationCancel() {
        if (!this._selectedSourcesGenerationInProgress || this._selectedSourcesGenerationCancelRequested) {
            return;
        }
        this._selectedSourcesGenerationCancelRequested = true;
        this.setSelectedSourcesGenerationState({ phase: 'cancel_requested' });
    }

    async confirmAndRunSelectedSourcesGeneration() {
        if (this._selectedSourcesGenerationInProgress) {
            this.showStatus(
                this._i18nSelectedSourcesGenerationStatusBusy ||
                    'Die Vollgenerierung läuft bereits.',
                true
            );
            this.openSelectedSourcesGenerationModal();
            return;
        }
        if (
            this._scheduledAutoUpdateInProgress ||
            this._summarizeAllInProgress ||
            this._autoSummarizeNewInProgress
        ) {
            this.showStatus(
                this._i18nSelectedSourcesGenerationStatusBlocked ||
                    'Bitte warten, bis laufende KI- oder Aktualisierungsjobs beendet sind.',
                true
            );
            return;
        }

        const selectedSourceIds = this.getSelectedSourcesGenerationSourceIds();
        if (!Array.isArray(selectedSourceIds) || selectedSourceIds.length === 0) {
            if (this.getSelectedSourcesGenerationScope() === 'favorites') {
                this.showStatus(
                    this._i18nSelectedSourcesGenerationNoFavorites ||
                        'Keine favorisierten abonnierten Quellen vorhanden.',
                    true
                );
                return;
            }
            this.showStatus(this._i18nDashboardNeedOne || 'Mindestens eine Newsquelle muss aktiviert sein.', true);
            return;
        }

        const period = this.getSelectedSourcesGenerationPeriod();
        const periodRange = this.getSelectedSourcesGenerationPeriodRange(period);
        const scope = this.getSelectedSourcesGenerationScope();
        const ordered = this.getOrderedSelectedSourcesForGeneration(selectedSourceIds);
        let totalArticles = 0;
        try {
            const cachedNews = await this.storage.getAllNews();
            const articleCountsBySource = this.buildArticleCountsBySource(cachedNews, periodRange);
            totalArticles = this.sumEstimatedArticlesForSources(ordered, articleCountsBySource);
        } catch (error) {
            console.warn('selected sources generation preflight count:', error);
        }

        const periodLabel = this.getSelectedSourcesGenerationPeriodLabel(period);
        const scopeLabel = this.getSelectedSourcesGenerationScopeLabel(scope);
        const template =
            this._i18nSelectedSourcesGenerationConfirmWithCount ||
            this._i18nSelectedSourcesGenerationConfirm ||
            'Für {scope} im Zeitraum „{period}“ sind aktuell {count} geladene Artikel aus {sources} Quelle(n) betroffen. Wirklich starten? Der Vorgang kann lange dauern.';
        const msg = template
            .replace(/\{scope\}/g, scopeLabel)
            .replace(/\{period\}/g, periodLabel)
            .replace(/\{count\}/g, String(totalArticles))
            .replace(/\{sources\}/g, String(ordered.length));
        if (typeof window !== 'undefined' && window.confirm && !window.confirm(msg)) {
            return;
        }

        await this.runSelectedSourcesGeneration(selectedSourceIds, { period, periodRange, scope });
    }

    /**
     * @returns {number|null}
     */
    getSelectedSourcesGenerationAvgDurationMs() {
        if (typeof KiStats === 'undefined' || !KiStats.getSnapshot) {
            return null;
        }
        const snap = KiStats.getSnapshot();
        if (!snap || !Number.isFinite(snap.avgDurationMs) || snap.avgDurationMs <= 0) {
            return null;
        }
        return snap.avgDurationMs;
    }

    /**
     * @param {number|undefined|null} remainingArticles
     * @param {string} [phase]
     * @returns {string}
     */
    formatSelectedSourcesGenerationEta(remainingArticles, phase = '') {
        if (phase === 'done' || phase === 'cancelled') {
            return '0 s';
        }
        const avgDurationMs = this.getSelectedSourcesGenerationAvgDurationMs();
        const articleCount = Number(remainingArticles);
        if (!(avgDurationMs > 0) || !Number.isFinite(articleCount) || articleCount <= 0) {
            return this._i18nSelectedSourcesGenerationEtaUnavailable || '—';
        }
        const concurrency = App.normalizeSummaryConcurrency(this.settings?.summaryConcurrency);
        const etaMs = Math.max(1000, Math.round((avgDurationMs * articleCount) / concurrency));
        return this.formatKiDuration(etaMs);
    }

    getBrandLogoUrl() {
        const s = this.settings && this.settings.newsSource;
        switch (s) {
            case 'bild':
                return BILD_BRAND_LOGO_URL;
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
                if (s === 'heise' || !s) {
                    return HEISE_BRAND_LOGO_URL;
                }
                try {
                    const siteUrl = App.getSourceSiteUrl(String(s || ''));
                    if (siteUrl) {
                        return `${new URL(siteUrl).origin}/favicon.ico`;
                    }
                } catch (_) {
                    /* fallback below */
                }
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
            const anthropicNorm = AISummarizer.normalizeAnthropicApiBase(
                settings.anthropicApiBaseUrl || ''
            );
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

            const kiMode = AISummarizer.normalizeKiApiMode(settings.kiApiMode);

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
            // v4: ensure BILD is in the enabled list once (new catalog entry).
            if (newsSrcCatalogVer < 4) {
                const catalog = App.newsCatalogIds();
                const set = new Set(enabledOrdered);
                if (catalog.includes('bild')) {
                    set.add('bild');
                }
                enabledOrdered = catalog.filter((id) => set.has(id));
                newsSrcCatalogVer = 4;
                try {
                    await this.storage.saveSettings({
                        enabledNewsSources: enabledOrdered,
                        newsSourcesCatalogMigrationVersion: 4
                    });
                } catch (e) {
                    console.warn('newsSourcesCatalogMigration v4:', e);
                }
            }
            // v5: ensure every registry source is present once in the enabled list.
            if (newsSrcCatalogVer < 5) {
                const catalog = App.newsCatalogIds();
                const set = new Set(enabledOrdered);
                catalog.forEach((id) => set.add(id));
                enabledOrdered = catalog.filter((id) => set.has(id));
                newsSrcCatalogVer = 5;
                try {
                    await this.storage.saveSettings({
                        enabledNewsSources: enabledOrdered,
                        newsSourcesCatalogMigrationVersion: 5
                    });
                } catch (e) {
                    console.warn('newsSourcesCatalogMigration v5:', e);
                }
            }
            const newsSource = App.normalizeNewsSourceWithEnabled(settings.newsSource, enabledOrdered);
            const disabledCategoriesBySource = App.normalizeDisabledCategoriesBySource(
                settings.disabledCategoriesBySource
            );

            // Migrate legacy flat selectedCategories → per-source disabledCategoriesBySource.
            // Old users stored a flat array of *selected* category values; the new system
            // stores which categories are *disabled* per source.  When no per-source entry
            // exists yet but the legacy array has data, derive disabled = known − selected
            // for the active source so old deselections carry over.
            if (
                Object.keys(disabledCategoriesBySource).length === 0 &&
                Array.isArray(selCats) &&
                selCats.length > 0 &&
                newsSource
            ) {
                const selectedSet = new Set(
                    selCats.map((v) => String(v || '').trim()).filter(Boolean)
                );
                const allKnown = [
                    'it', 'security', 'ki', 'wissenschaft', 'mobiles', 'entertainment',
                    'wirtschaft', 'netzpolitik', 'journal', 'heise_ix', 'heise_ct',
                    'heise_foto', 'heise_mac', 'heise_make', 'heise_autos', 'telepolis', 'bild'
                ];
                const disabled = allKnown.filter((v) => !selectedSet.has(v));
                if (disabled.length > 0 && disabled.length < allKnown.length) {
                    disabledCategoriesBySource[newsSource] = disabled;
                    try {
                        await this.storage.saveSettings({ disabledCategoriesBySource });
                    } catch (e) {
                        console.warn('selectedCategories migration:', e);
                    }
                }
            }

            const favoriteNewsSources = App.normalizeFavoriteNewsSourcesArray(
                settings.favoriteNewsSources
            );
            const summaryLangMode = settings.summaryLangMode === 'browser' ? 'browser' : 'site';
            const summaryStyle = App.normalizeSummaryStyle(settings.summaryStyle);
            const summaryStyleCustom = App.normalizeSummaryStyleCustom(settings.summaryStyleCustom);

            const reasoningStored = AISummarizer.normalizeLmReasoningParam(settings.reasoning);
            const reasoningEnabledStored = AISummarizer.normalizeLmReasoningEnabled(
                settings.reasoningEnabled,
                reasoningStored
            );
            let lmModelSelectionMode = AISummarizer.normalizeLmModelSelectionMode(
                settings.lmModelSelectionMode
            );
            try {
                const lsModelSelectionMode = localStorage.getItem('heise_lm_model_selection_mode');
                if (lsModelSelectionMode) {
                    lmModelSelectionMode =
                        AISummarizer.normalizeLmModelSelectionMode(lsModelSelectionMode);
                }
            } catch (_) {
                /* ignore */
            }
            const lmModel =
                lmModelSelectionMode === 'manual'
                    ? String(settings.lmModel || '').trim()
                    : '';

            let alternativeLinksCount = 5;
            if (settings.alternativeLinksCount != null && settings.alternativeLinksCount !== '') {
                const a = parseInt(String(settings.alternativeLinksCount), 10);
                if (Number.isFinite(a) && a >= 0 && a <= 15) {
                    alternativeLinksCount = a;
                }
            }

            const webSearchEngine = App.normalizeWebSearchEngine(settings.webSearchEngine);
            const articleTranslationEnabled = settings.articleTranslationEnabled === true;
            const AT0 = typeof window !== 'undefined' ? window.ArticleTranslation : null;
            const articleTranslationTargetLang = AT0
                ? AT0.normalizeTargetLang(settings.articleTranslationTargetLang)
                : String(settings.articleTranslationTargetLang || 'de')
                      .trim()
                      .toLowerCase() || 'de';
            const rawArticleProv = String(settings.articleTranslationLinkProvider || 'google').trim().toLowerCase();
            const articleTranslationLinkProvider = AT0
                ? AT0.normalizeLinkProvider(settings.articleTranslationLinkProvider)
                : rawArticleProv === 'bing'
                  ? 'bing'
                  : rawArticleProv === 'google_classic' || rawArticleProv === 'google_legacy'
                    ? 'google_classic'
                    : 'google';
            const alternativeLinksDisplayMode = App.normalizeAlternativeLinksDisplayMode(
                settings.alternativeLinksDisplayMode
            );
            const forumEntriesDiscoveryMode = App.normalizeForumEntriesDiscoveryMode(
                settings.forumEntriesDiscoveryMode
            );
            const youtubeSuggestionsDiscoveryMode = App.normalizeYoutubeSuggestionsDiscoveryMode(
                settings.youtubeSuggestionsDiscoveryMode
            );
            const alternativeLinksDomainBlacklist = App.normalizeAlternativeLinksDomainBlacklist(
                settings.alternativeLinksDomainBlacklist
            );
            const articleThumbnailsEnabled = App.normalizeArticleThumbnailsEnabled(
                settings.articleThumbnailsEnabled
            );
            const articleStateColors = App.normalizeArticleStateColors(settings.articleStateColors);
            const backgroundSelectedSourcesRefreshEnabled =
                App.normalizeBackgroundSelectedSourcesRefreshEnabled(
                    settings.backgroundSelectedSourcesRefreshEnabled
                );
            const backgroundSelectedSourcesRefreshScope =
                App.normalizeBackgroundSelectedSourcesRefreshScope(
                    settings.backgroundSelectedSourcesRefreshScope
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
                anthropicApiBaseUrl: anthropicNorm,
                kiApiMode: kiMode,
                lmModel,
                lmModelSelectionMode,
                restSameOrigin: settings.restSameOrigin === true || settings.restSameOrigin === 'true',
                headerBrandMode: settings.headerBrandMode === 'text' ? 'text' : 'logo',
                enabledNewsSources: enabledOrdered,
                newsSource,
                summaryLangMode,
                summaryStyle,
                summaryStyleCustom,
                reasoning: reasoningStored,
                reasoningEnabled: reasoningEnabledStored,
                alternativeLinksCount,
                alternativeLinksDisplayMode,
                forumEntriesDiscoveryMode,
                youtubeSuggestionsDiscoveryMode,
                alternativeLinksDomainBlacklist,
                articleThumbnailsEnabled,
                articleStateColors,
                backgroundSelectedSourcesRefreshEnabled,
                backgroundSelectedSourcesRefreshScope,
                webSearchEngine,
                articleTranslationEnabled,
                articleTranslationTargetLang,
                articleTranslationLinkProvider,
                enabledHeiseMagazines,
                summaryConcurrency,
                summaryRequestTimeoutSeconds,
                categoryFilterSchemaVersion: categorySchemaVer,
                newsSourcesCatalogMigrationVersion: newsSrcCatalogVer,
                disabledCategoriesBySource,
                favoriteNewsSources
            };

            try {
                localStorage.setItem('heise_enabled_news_sources', JSON.stringify(enabledOrdered));
                localStorage.setItem('heise_summary_lang_mode', summaryLangMode);
                localStorage.setItem('heise_summary_style', summaryStyle);
                localStorage.setItem('heise_summary_style_custom', summaryStyleCustom);
                localStorage.setItem('heise_alternative_links_blacklist', alternativeLinksDomainBlacklist);
                localStorage.setItem('heise_forum_entries_discovery_mode', forumEntriesDiscoveryMode);
                localStorage.setItem('heise_article_thumbnails_enabled', articleThumbnailsEnabled ? '1' : '0');
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

            this.settings.theme = App.normalizeThemePreference(this.settings.theme);
            try {
                const lt = localStorage.getItem('theme');
                if (lt === 'light' || lt === 'dark' || lt === 'system') {
                    this.settings.theme = lt;
                }
            } catch (_) {
                /* ignore */
            }
            try {
                localStorage.setItem('theme', this.settings.theme);
            } catch (_) {
                /* ignore */
            }

            this.settings.themeCustomColors = App.normalizeThemeCustomColors(this.settings.themeCustomColors);
            this.settings.themeCustomHeaderColors = App.normalizeThemeCustomHeaderColors(
                this.settings.themeCustomHeaderColors
            );
            this.settings.themeSurfaceBrightness = App.normalizeThemeSurfaceBrightness(
                this.settings.themeSurfaceBrightness
            );
            this.settings.themeHeaderTransparency = App.normalizeThemeHeaderTransparency(
                this.settings.themeHeaderTransparency
            );
            try {
                const tj = localStorage.getItem('heise_theme_custom_colors');
                if (tj) {
                    const parsed = JSON.parse(tj);
                    const merged = App.normalizeThemeCustomColors(parsed);
                    this.settings.themeCustomColors = App.normalizeThemeCustomColors({
                        light: { ...this.settings.themeCustomColors.light, ...merged.light },
                        dark: { ...this.settings.themeCustomColors.dark, ...merged.dark }
                    });
                }
            } catch (_) {
                /* ignore */
            }
            try {
                const hj = localStorage.getItem('heise_theme_custom_header_colors');
                if (hj) {
                    const parsed = JSON.parse(hj);
                    const merged = App.normalizeThemeCustomHeaderColors(parsed);
                    this.settings.themeCustomHeaderColors = App.normalizeThemeCustomHeaderColors({
                        light: { ...this.settings.themeCustomHeaderColors.light, ...merged.light },
                        dark: { ...this.settings.themeCustomHeaderColors.dark, ...merged.dark }
                    });
                }
            } catch (_) {
                /* ignore */
            }
            try {
                const bj = localStorage.getItem('heise_theme_surface_brightness');
                if (bj) {
                    this.settings.themeSurfaceBrightness = App.normalizeThemeSurfaceBrightness(JSON.parse(bj));
                }
            } catch (_) {
                /* ignore */
            }
            try {
                const htj = localStorage.getItem('heise_theme_header_transparency');
                if (htj) {
                    this.settings.themeHeaderTransparency = App.normalizeThemeHeaderTransparency(JSON.parse(htj));
                }
            } catch (_) {
                /* ignore */
            }
            try {
                const acj = localStorage.getItem('heise_article_state_colors');
                if (acj) {
                    this.settings.articleStateColors = App.normalizeArticleStateColors(JSON.parse(acj));
                }
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
                localStorage.setItem('heise_anthropic_api_base', anthropicNorm);
                localStorage.setItem('heise_ki_api_mode', kiMode);
                localStorage.setItem('heise_lm_api_token', settings.lmApiToken || '');
                localStorage.setItem('heise_lm_model', lmModel);
                localStorage.setItem('heise_lm_model_selection_mode', lmModelSelectionMode);
                localStorage.setItem(
                    'heise_rest_same_origin',
                    settings.restSameOrigin === true || settings.restSameOrigin === 'true' ? '1' : '0'
                );
            } catch (_) {
                /* ignore */
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
                localStorage.setItem('heise_reasoning_enabled', reasoningEnabledStored ? '1' : '0');
                localStorage.setItem('heise_alternative_links_count', String(alternativeLinksCount));
                localStorage.setItem('heise_web_search_engine', webSearchEngine);
                localStorage.setItem('heise_alternative_links_display_mode', alternativeLinksDisplayMode);
                localStorage.setItem('heise_forum_entries_discovery_mode', forumEntriesDiscoveryMode);
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
            if (this.elements.summaryStyle) {
                this.elements.summaryStyle.value = summaryStyle;
            }
            if (this.elements.summaryStyleCustom) {
                this.elements.summaryStyleCustom.value = summaryStyleCustom;
            }
            this.syncSummaryStyleCustomVisibility();

            this.disabledCategoriesBySource = { ...disabledCategoriesBySource };
            this.favoriteNewsSources = [...favoriteNewsSources];
            this.selectedCategories = [];
            this.syncCategoryFiltersVisibility();
            this.ensureDefaultCategorySelectionForSource();
            this.settings = {
                ...this.settings,
                disabledCategoriesBySource: this.disabledCategoriesBySource,
                favoriteNewsSources: this.favoriteNewsSources,
                selectedCategories: this.selectedCategories
            };
            this.refreshHeaderSourceControls();
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
    static normalizeThemePreference(raw) {
        const s = String(raw || 'system').trim().toLowerCase();
        return s === 'light' || s === 'dark' || s === 'system' ? s : 'system';
    }

    /**
     * @param {unknown} raw
     * @returns {{ light: Record<string, string>, dark: Record<string, string> }}
     */
    static normalizeThemeCustomColors(raw) {
        const keys = new Set(['bgPrimary', 'bgSecondary', 'bgCard', 'borderColor']);
        const pick = (o) => {
            const out = {};
            if (!o || typeof o !== 'object') {
                return out;
            }
            for (const k of Object.keys(o)) {
                if (!keys.has(k)) {
                    continue;
                }
                const hx = App.normalizeHexColor(o[k]);
                if (hx) {
                    out[k] = hx;
                }
            }
            return out;
        };
        const light = raw && typeof raw === 'object' && raw.light ? pick(raw.light) : {};
        const dark = raw && typeof raw === 'object' && raw.dark ? pick(raw.dark) : {};
        return { light, dark };
    }

    /**
     * @param {unknown} raw
     * @returns {{ light: Record<string, string>, dark: Record<string, string> }}
     */
    static normalizeThemeCustomHeaderColors(raw) {
        const keys = new Set(['headerSurface', 'headerText', 'headerBorder']);
        const pick = (o) => {
            const out = {};
            if (!o || typeof o !== 'object') {
                return out;
            }
            for (const k of Object.keys(o)) {
                if (!keys.has(k)) {
                    continue;
                }
                const hx = App.normalizeHexColor(o[k]);
                if (hx) {
                    out[k] = hx;
                }
            }
            return out;
        };
        const light = raw && typeof raw === 'object' && raw.light ? pick(raw.light) : {};
        const dark = raw && typeof raw === 'object' && raw.dark ? pick(raw.dark) : {};
        return { light, dark };
    }

    /**
     * @param {unknown} raw
     * @returns {number}
     */
    static normalizeThemeSurfaceBrightnessValue(raw) {
        const clamp = (n) => Math.min(100, Math.max(0, n));
        const d = 50;
        if (raw == null || raw === '') {
            return d;
        }
        const n = parseInt(String(raw), 10);
        if (!Number.isFinite(n)) {
            return d;
        }
        return clamp(n);
    }

    /**
     * Legacy migration: old sliders used 100 as neutral with a narrower/wider custom range.
     * @param {unknown} raw
     * @returns {number}
     */
    static normalizeLegacyThemeSurfaceBrightnessValue(raw) {
        const d = 50;
        if (raw == null || raw === '') {
            return d;
        }
        const n = parseInt(String(raw), 10);
        if (!Number.isFinite(n)) {
            return d;
        }
        return App.normalizeThemeSurfaceBrightnessValue(
            Math.round(50 + ((n - 100) * 50) / 30)
        );
    }

    /**
     * @param {unknown} raw
     * @returns {{ light: number, dark: number, version: 2 }}
     */
    static normalizeThemeSurfaceBrightness(raw) {
        const d = 50;
        let light = d;
        let dark = d;
        if (raw && typeof raw === 'object') {
            const isV2 = Number(raw.version) === 2;
            const normalizeSingle = isV2
                ? App.normalizeThemeSurfaceBrightnessValue
                : App.normalizeLegacyThemeSurfaceBrightnessValue;
            light = normalizeSingle(raw.light);
            dark = normalizeSingle(raw.dark);
        }
        return { light, dark, version: 2 };
    }

    /**
     * @param {unknown} raw
     * @returns {number}
     */
    static normalizeThemeHeaderTransparencyValue(raw) {
        const d = 0;
        if (raw == null || raw === '') {
            return d;
        }
        const n = parseInt(String(raw), 10);
        if (!Number.isFinite(n)) {
            return d;
        }
        return Math.min(100, Math.max(0, n));
    }

    /**
     * @param {unknown} raw
     * @returns {{ light: number, dark: number, version: 1 }}
     */
    static normalizeThemeHeaderTransparency(raw) {
        let light = THEME_DEFAULT_HEADER_TRANSPARENCY.light;
        let dark = THEME_DEFAULT_HEADER_TRANSPARENCY.dark;
        if (raw && typeof raw === 'object') {
            light = App.normalizeThemeHeaderTransparencyValue(raw.light);
            dark = App.normalizeThemeHeaderTransparencyValue(raw.dark);
        }
        return { light, dark, version: 1 };
    }

    /**
     * @param {unknown} raw
     * @returns {string[]}
     */
    static normalizeManualCardOrderIds(raw) {
        if (!Array.isArray(raw)) {
            return [];
        }
        const out = [];
        const seen = new Set();
        raw.forEach((entry) => {
            const id = String(entry == null ? '' : entry).trim();
            if (!id || seen.has(id)) {
                return;
            }
            seen.add(id);
            out.push(id);
        });
        return out;
    }

    /**
     * @param {unknown} raw
     * @returns {Record<string, string[]>}
     */
    static normalizeManualCardOrderState(raw) {
        const out = {};
        if (!raw || typeof raw !== 'object') {
            return out;
        }
        Object.keys(raw).forEach((key) => {
            const viewKey = String(key || '').trim();
            if (!viewKey) {
                return;
            }
            const ids = App.normalizeManualCardOrderIds(raw[key]);
            if (ids.length > 0) {
                out[viewKey] = ids;
            }
        });
        return out;
    }

    /**
     * @returns {Record<string, string[]>}
     */
    static loadManualCardOrderState() {
        if (typeof localStorage === 'undefined') {
            return {};
        }
        try {
            const raw = localStorage.getItem(MANUAL_CARD_ORDER_STORAGE_KEY);
            if (!raw) {
                return {};
            }
            return App.normalizeManualCardOrderState(JSON.parse(raw));
        } catch (_) {
            return {};
        }
    }

    /**
     * @param {unknown} raw
     * @returns {Record<string, string[]>}
     */
    static normalizePendingNewArticleUrlState(raw) {
        if (!raw || typeof raw !== 'object') {
            return {};
        }
        /** @type {Record<string, string[]>} */
        const out = {};
        Object.entries(raw).forEach(([sourceId, urls]) => {
            const normalizedSource = App.normalizeStoredNewsSourceId(sourceId);
            if (!normalizedSource || !Array.isArray(urls)) {
                return;
            }
            const normalizedUrls = [...new Set(
                urls
                    .map((url) => App.canonicalArticleUrl(url))
                    .filter(Boolean)
            )];
            if (normalizedUrls.length > 0) {
                out[normalizedSource] = normalizedUrls;
            }
        });
        return out;
    }

    /**
     * @returns {Record<string, string[]>}
     */
    static loadPendingNewArticleUrlState() {
        if (typeof localStorage === 'undefined') {
            return {};
        }
        try {
            const raw = localStorage.getItem(PENDING_NEW_ARTICLE_URLS_STORAGE_KEY);
            if (!raw) {
                return {};
            }
            return App.normalizePendingNewArticleUrlState(JSON.parse(raw));
        } catch (_) {
            return {};
        }
    }

    /** @param {unknown} raw @returns {string | null} */
    static normalizeHexColor(raw) {
        const s = String(raw || '').trim();
        const m = /^#?([0-9a-fA-F]{6})$/.exec(s);
        if (!m) {
            return null;
        }
        return `#${m[1].toLowerCase()}`;
    }

    /** @param {unknown} raw @returns {''|'seen'|'read'} */
    static normalizeArticleReadState(raw) {
        const s = String(raw || '').trim().toLowerCase();
        return ARTICLE_READ_STATE_IDS.includes(s) ? s : '';
    }

    /**
     * @param {unknown} raw
     * @returns {{ new: string, seen: string, read: string }}
     */
    static normalizeArticleStateColors(raw) {
        const input = raw && typeof raw === 'object' ? raw : {};
        return ARTICLE_STATE_COLOR_IDS.reduce((colors, key) => {
            const normalized = App.normalizeHexColor(input[key]);
            colors[key] = normalized || ARTICLE_STATE_COLOR_DEFAULTS[key];
            return colors;
        }, {});
    }

    /** @param {string} hex */
    static hexToRgb(hex) {
        const h = App.normalizeHexColor(hex);
        if (!h) {
            return null;
        }
        const n = parseInt(h.slice(1), 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }

    /** @param {string} hex */
    static relativeLuminance(hex) {
        const rgb = App.hexToRgb(hex);
        if (!rgb) {
            return 0;
        }
        const channel = (value) => {
            const s = value / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
    }

    /** @param {string} backgroundHex */
    static readableTextColorForBackground(backgroundHex) {
        const bg = App.normalizeHexColor(backgroundHex) || '#000000';
        const luminance = App.relativeLuminance(bg);
        const contrastWithWhite = 1.05 / (luminance + 0.05);
        const contrastWithBlack = (luminance + 0.05) / 0.05;
        return contrastWithWhite >= contrastWithBlack ? '#ffffff' : '#111827';
    }

    /** @param {number} r @param {number} g @param {number} b */
    static rgbToHex(r, g, b) {
        const c = (x) => Math.max(0, Math.min(255, Math.round(x)));
        return `#${[c(r), c(g), c(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    }

    /**
     * @param {string} a
     * @param {string} b
     * @param {number} t 0..1
     */
    static mixHex(a, b, t) {
        const A = App.hexToRgb(a);
        const B = App.hexToRgb(b);
        if (!A || !B) {
            return App.normalizeHexColor(a) || '#000000';
        }
        const u = Math.max(0, Math.min(1, t));
        return App.rgbToHex(A.r + (B.r - A.r) * u, A.g + (B.g - A.g) * u, A.b + (B.b - A.b) * u);
    }

    /**
     * Maps 0..100 (50 = neutral) into a signed [-1..+1] curve with a small dead zone
     * around 50 so casual slider movements feel stable, then eases towards the extremes.
     * @param {number} percent 0–100
     * @returns {number} signed factor, -1..+1
     */
    static themeBrightnessCurve(percent) {
        const p = App.normalizeThemeSurfaceBrightnessValue(percent);
        const t = (p - 50) / 50;
        if (Math.abs(t) < 0.04) {
            return 0;
        }
        const sign = t < 0 ? -1 : 1;
        const eased = Math.pow(Math.abs(t), 1.15);
        return sign * Math.min(1, eased);
    }

    /**
     * Mix `hex` toward white/black based on the brightness slider.
     * The cap (`maxMix`) keeps the change moderate so surfaces stay distinguishable.
     * @param {string} hex
     * @param {number} percent 0–100 (50 = unchanged)
     * @param {number} [maxMix=THEME_SURFACE_BRIGHTNESS_MAX] upper bound of the mix amount
     */
    static adjustSurfaceBrightness(hex, percent, maxMix) {
        const h = App.normalizeHexColor(hex);
        if (!h) {
            return hex;
        }
        const t = App.themeBrightnessCurve(percent);
        if (t === 0) {
            return h;
        }
        const cap = typeof maxMix === 'number' ? maxMix : THEME_SURFACE_BRIGHTNESS_MAX;
        const toward = t > 0 ? '#ffffff' : '#000000';
        const amt = Math.min(1, Math.abs(t) * cap);
        return App.mixHex(h, toward, amt);
    }

    /**
     * Adjust text colors against a surface that was shifted by the brightness slider.
     * The text moves in the *opposite* direction of the surface so contrast is preserved
     * at slider extremes. `mode` clamps the direction so light-mode text never turns
     * brighter than its base when the surface goes lighter (and vice versa for dark mode).
     * @param {string} hex original text color
     * @param {number} percent 0–100 (50 = unchanged)
     * @param {'light'|'dark'} mode
     */
    static adjustTextBrightness(hex, percent, mode) {
        const h = App.normalizeHexColor(hex);
        if (!h) {
            return hex;
        }
        const t = App.themeBrightnessCurve(percent);
        if (t === 0) {
            return h;
        }
        // light mode: only react when surface gets darker (t < 0) → push text lighter.
        // dark  mode: only react when surface gets lighter (t > 0) → push text darker.
        if (mode === 'light' && t > 0) {
            return h;
        }
        if (mode === 'dark' && t < 0) {
            return h;
        }
        const toward = mode === 'light' ? '#ffffff' : '#000000';
        const amt = Math.min(1, Math.abs(t) * THEME_TEXT_CONTRAST_MAX);
        return App.mixHex(h, toward, amt);
    }

    /**
     * @param {{ themeCustomColors: { light: Record<string, string>, dark: Record<string, string> }, themeSurfaceBrightness: { light: number, dark: number }, themeCustomHeaderColors?: { light: Record<string, string>, dark: Record<string, string> } }} palette
     * @param {'light' | 'dark'} mode
     */
    static resolveThemeSurfaceForMode(palette, mode) {
        const colorTheme = App.normalizeColorTheme(palette && palette.colorTheme);
        const defs = getThemeSurfaceDefaults(colorTheme, mode);
        const cust = palette.themeCustomColors[mode] || {};
        const merged = {
            bgPrimary: cust.bgPrimary || defs.bgPrimary,
            bgSecondary: cust.bgSecondary || defs.bgSecondary,
            bgCard: cust.bgCard || defs.bgCard,
            borderColor: cust.borderColor || defs.borderColor
        };
        const br = palette.themeSurfaceBrightness[mode];
        return {
            bgPrimary: App.adjustSurfaceBrightness(merged.bgPrimary, br),
            bgSecondary: App.adjustSurfaceBrightness(merged.bgSecondary, br),
            bgCard: App.adjustSurfaceBrightness(merged.bgCard, br),
            borderColor: App.adjustSurfaceBrightness(merged.borderColor, br, THEME_BORDER_BRIGHTNESS_MAX)
        };
    }

    /**
     * @param {{ themeCustomHeaderColors: { light: Record<string, string>, dark: Record<string, string> }, themeSurfaceBrightness?: { light: number, dark: number } }} palette
     * @param {'light' | 'dark'} mode
     */
    static resolveThemeHeaderForMode(palette, mode) {
        const defs = THEME_DEFAULT_HEADER[mode];
        const cust = (palette.themeCustomHeaderColors && palette.themeCustomHeaderColors[mode]) || {};
        const br = palette && palette.themeSurfaceBrightness ? palette.themeSurfaceBrightness[mode] : 50;
        return {
            headerSurface: App.adjustSurfaceBrightness(cust.headerSurface || defs.headerSurface, br),
            headerText: App.adjustTextBrightness(cust.headerText || defs.headerText, br, mode),
            headerBorder: App.adjustSurfaceBrightness(
                cust.headerBorder || defs.headerBorder,
                br,
                THEME_BORDER_BRIGHTNESS_MAX
            )
        };
    }

    /**
     * Resolve text colors for the active mode, taking the brightness slider into account
     * so text contrast scales with the surface adjustment.
     * @param {{ themeSurfaceBrightness?: { light: number, dark: number } }} palette
     * @param {'light' | 'dark'} mode
     * @returns {{ textPrimary: string, textSecondary: string }}
     */
    static resolveThemeTextForMode(palette, mode) {
        const defs = THEME_DEFAULT_TEXT[mode];
        const br = palette && palette.themeSurfaceBrightness ? palette.themeSurfaceBrightness[mode] : 50;
        return {
            textPrimary: App.adjustTextBrightness(defs.textPrimary, br, mode),
            textSecondary: App.adjustTextBrightness(defs.textSecondary, br, mode)
        };
    }

    /**
     * @param {{ themeHeaderTransparency?: { light: number, dark: number } }} palette
     * @param {'light' | 'dark'} mode
     */
    static resolveThemeHeaderTransparencyForMode(palette, mode) {
        const raw =
            palette && palette.themeHeaderTransparency
                ? palette.themeHeaderTransparency[mode]
                : THEME_DEFAULT_HEADER_TRANSPARENCY[mode];
        const transparency = App.normalizeThemeHeaderTransparencyValue(raw);
        const opaque = Math.max(0, 100 - transparency);
        return {
            shellBorderMix: `${Math.round(opaque * 0.78)}%`,
            overlayOpacity: String(opaque / 100),
            panelFill: `${opaque}%`,
            panelBorderFill: `${Math.round(opaque * 0.88)}%`,
            controlFill: `${opaque}%`,
            controlBorderFill: `${Math.round(opaque)}%`
        };
    }

    /** @param {unknown} raw */
    static normalizeWebSearchEngine(raw) {
        const s = String(raw || 'duckduckgo').trim().toLowerCase();
        return s === 'google' || s === 'bing' || s === 'duckduckgo' ? s : 'duckduckgo';
    }

    /**
     * KI summary writing style. Unknown values fall back to the neutral `factual` default.
     * `custom` uses the free-text summaryStyleCustom as the sole style instruction.
     * @param {unknown} raw
     * @returns {'factual'|'professional'|'casual'|'custom'}
     */
    static normalizeSummaryStyle(raw) {
        const s = String(raw || 'factual').trim().toLowerCase();
        return s === 'professional' || s === 'casual' || s === 'custom' || s === 'factual'
            ? s
            : 'factual';
    }

    /**
     * Optional free-text style wish: trimmed and capped (newlines kept for textarea redisplay).
     * @param {unknown} raw
     * @returns {string}
     */
    static normalizeSummaryStyleCustom(raw) {
        let s = String(raw == null ? '' : raw).replace(/\r\n?/g, '\n');
        s = s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
        if (s.length > 300) {
            s = s.slice(0, 300).trim();
        }
        return s;
    }

    /** @param {unknown} raw */
    static normalizeAlternativeLinksDisplayMode(raw) {
        const s = String(raw || 'expanded').trim().toLowerCase();
        return s === 'collapsed' ? 'collapsed' : 'expanded';
    }

    /** @param {unknown} raw */
    static normalizeForumEntriesDiscoveryMode(raw) {
        const s = String(raw || 'click').trim().toLowerCase();
        return s === 'always' ? 'always' : 'click';
    }

    static normalizeYoutubeSuggestionsDiscoveryMode(raw) {
        const s = String(raw || 'click').trim().toLowerCase();
        return s === 'always' ? 'always' : 'click';
    }

    /** @param {unknown} raw */
    static normalizeArticleThumbnailsEnabled(raw) {
        if (raw === false || raw === 0) {
            return false;
        }
        const s = String(raw == null ? 'true' : raw).trim().toLowerCase();
        return !(s === 'false' || s === '0' || s === 'off' || s === 'no');
    }

    /**
     * Whether the header refresh timer should also refresh all enabled sources in the background.
     * @param {unknown} raw
     * @returns {boolean}
     */
    static normalizeBackgroundSelectedSourcesRefreshEnabled(raw) {
        if (raw === true || raw === 1) {
            return true;
        }
        const s = String(raw == null ? 'false' : raw).trim().toLowerCase();
        return s === 'true' || s === '1' || s === 'on' || s === 'yes';
    }

    /**
     * Scope for the background selected-sources refresh: 'favorites' (only starred) or 'enabled'.
     * Defaults to 'favorites' (inverted vs. the generation scope normalizer, which defaults to 'enabled').
     * @param {unknown} raw
     * @returns {'favorites'|'enabled'}
     */
    static normalizeBackgroundSelectedSourcesRefreshScope(raw) {
        const value = String(raw || '').trim();
        return value === 'enabled' ? 'enabled' : 'favorites';
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
     * @param {{ thumbnailUrl?: unknown }|null|undefined} item
     * @returns {string}
     */
    static articleThumbnailUrl(item) {
        const raw = item && item.thumbnailUrl != null ? String(item.thumbnailUrl).trim() : '';
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
        if (this.elements.settingsColorThemeSelect) {
            this.elements.settingsColorThemeSelect.value = id;
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
        if (this.elements.settingsColorThemeSelect) {
            this.elements.settingsColorThemeSelect.value = id;
        }
        this.applyThemeSurfaceDefaultsToModal(id);
        this.applyThemeSurfaceVariables();
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
                const out = {};
                Object.keys(filtersLoc).forEach((key) => {
                    if (!key.startsWith('cat_')) {
                        return;
                    }
                    const value = key.slice(4);
                    if (!value) {
                        return;
                    }
                    out[value] = String(filtersLoc[key] || '').trim();
                });
                this._i18nFilterLabels = out;
                if (this.elements.categoryFilters) {
                    this.renderCategoryFilters();
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
                if (newsLoc.seen_badge) {
                    this._i18nNewsSeenBadge = newsLoc.seen_badge;
                }
                if (newsLoc.read_badge) {
                    this._i18nNewsReadBadge = newsLoc.read_badge;
                }
                if (newsLoc.status_new) {
                    this._i18nStatusNew = newsLoc.status_new;
                }
                if (newsLoc.aria_new) {
                    this._i18nNewsAria = newsLoc.aria_new;
                }
                if (newsLoc.aria_seen) {
                    this._i18nNewsSeenAria = newsLoc.aria_seen;
                }
                if (newsLoc.aria_read) {
                    this._i18nNewsReadAria = newsLoc.aria_read;
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
                if (newsLoc.share_btn) {
                    this._i18nShareBtn = newsLoc.share_btn;
                }
                if (newsLoc.share_title) {
                    this._i18nShareTitle = newsLoc.share_title;
                }
                if (newsLoc.share_done) {
                    this._i18nShareDone = newsLoc.share_done;
                }
                if (newsLoc.share_copied) {
                    this._i18nShareCopied = newsLoc.share_copied;
                }
                if (newsLoc.share_unavailable) {
                    this._i18nShareUnavailable = newsLoc.share_unavailable;
                }
                if (newsLoc.share_failed) {
                    this._i18nShareFailed = newsLoc.share_failed;
                }
                if (newsLoc.share_section_summary) {
                    this._i18nShareSectionSummary = newsLoc.share_section_summary;
                }
                if (newsLoc.share_section_alternative_links) {
                    this._i18nShareSectionAlternativeLinks = newsLoc.share_section_alternative_links;
                }
                if (newsLoc.share_section_reddit) {
                    this._i18nShareSectionReddit = newsLoc.share_section_reddit;
                }
                if (newsLoc.share_section_comments) {
                    this._i18nShareSectionComments = newsLoc.share_section_comments;
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
                if (newsLoc.export_selection_info) {
                    this._i18nExportSelectionInfo = newsLoc.export_selection_info;
                }
                if (newsLoc.export_done) {
                    this._i18nExportDone = newsLoc.export_done;
                }
                if (newsLoc.export_no_items) {
                    this._i18nExportNoItems = newsLoc.export_no_items;
                }
                const setTxt = (id, txt) => {
                    const el = document.getElementById(id);
                    if (el && txt) {
                        el.textContent = txt;
                    }
                };
                setTxt('exportModalTitle', newsLoc.export_modal_title);
                setTxt('exportFormatLabel', newsLoc.export_format_label);
                setTxt('exportScopeLabel', newsLoc.export_scope_label);
                setTxt('exportScopeSelectedOption', newsLoc.export_scope_selected);
                setTxt('exportScopePeriodOption', newsLoc.export_scope_period);
                setTxt('exportPeriodTypeLabel', newsLoc.export_period_label);
                setTxt('exportPeriodDayOption', newsLoc.export_period_day);
                setTxt('exportPeriodWeekOption', newsLoc.export_period_week);
                setTxt('exportPeriodMonthOption', newsLoc.export_period_month);
                setTxt('exportPeriodYearOption', newsLoc.export_period_year);
                setTxt('exportPeriodDateLabel', newsLoc.export_reference_date_label);
                setTxt('exportContentLabel', newsLoc.export_include_label);
                setTxt('exportIncludeSummaryLabel', newsLoc.export_include_summary);
                setTxt('exportIncludeAlternativeLinksLabel', newsLoc.export_include_alt_links);
                setTxt('exportIncludeRedditLabel', newsLoc.export_include_reddit);
                setTxt('exportIncludeCommentsLabel', newsLoc.export_include_comments);
                setTxt('exportIncludeKiMetaLabel', newsLoc.export_include_ki_meta);
                setTxt('exportIncludeThumbnailsLabel', newsLoc.export_include_thumbnails);
                setTxt('cancelExportBtn', newsLoc.export_cancel_btn);
                setTxt('runExportBtn', newsLoc.export_run_btn);
                this.updateExportSelectionInfo();
            }

            const headerLoc = data.header;
            if (headerLoc) {
                if (headerLoc.subtitle) {
                    const sub = document.getElementById('headerSubtitle');
                    if (sub) {
                        sub.textContent = headerLoc.subtitle;
                    }
                }
                if (this.elements.exportBtn) {
                    if (headerLoc.export_btn) {
                        this.elements.exportBtn.textContent = headerLoc.export_btn;
                    }
                    if (headerLoc.export_btn_title) {
                        this.elements.exportBtn.setAttribute('title', headerLoc.export_btn_title);
                        this.elements.exportBtn.setAttribute('aria-label', headerLoc.export_btn_title);
                    }
                }
                if (this.elements.manualLink) {
                    if (headerLoc.manual_btn) {
                        this.elements.manualLink.textContent = headerLoc.manual_btn;
                    }
                    if (headerLoc.manual_btn_title) {
                        this.elements.manualLink.setAttribute('title', headerLoc.manual_btn_title);
                        this.elements.manualLink.setAttribute('aria-label', headerLoc.manual_btn_title);
                    }
                }
                if (this.elements.generateSelectedSourcesBtn) {
                    if (headerLoc.generate_selected_sources_btn) {
                        this.elements.generateSelectedSourcesBtn.textContent =
                            headerLoc.generate_selected_sources_btn;
                    }
                    if (headerLoc.generate_selected_sources_title) {
                        this.elements.generateSelectedSourcesBtn.setAttribute(
                            'title',
                            headerLoc.generate_selected_sources_title
                        );
                        this.elements.generateSelectedSourcesBtn.setAttribute(
                            'aria-label',
                            headerLoc.generate_selected_sources_title
                        );
                    }
                }
                const ns = this.settings && this.settings.newsSource
                    ? this.normalizeNewsSource(this.settings.newsSource)
                    : 'heise';
                const sourceDisplayName = App.getSourceDisplayName(ns) || 'heise.de';
                if (headerLoc.brand_wordmark) {
                    const w = document.getElementById('headerBrandText');
                    if (w) {
                        const specificWordmark = headerLoc[`brand_wordmark_${ns}`];
                        let wm =
                            typeof specificWordmark === 'string' && specificWordmark.trim()
                                ? specificWordmark
                                : sourceDisplayName;
                        if (ns === 'heise' && typeof headerLoc.brand_wordmark === 'string' && headerLoc.brand_wordmark.trim()) {
                            wm = headerLoc.brand_wordmark;
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
                    const specificAlt = headerLoc[`logo_alt_${ns}`];
                    let alt =
                        typeof specificAlt === 'string' && specificAlt.trim()
                            ? specificAlt
                            : `${sourceDisplayName} Logo`;
                    if (ns === 'heise' && typeof headerLoc.logo_alt === 'string' && headerLoc.logo_alt.trim()) {
                        alt = headerLoc.logo_alt;
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
                        const fallbackLabel = App.getSourceDisplayName(id) || id;
                        const nextLabel =
                            typeof headerLoc[k] === 'string' && headerLoc[k].trim()
                                ? headerLoc[k]
                                : fallbackLabel;
                        opt.textContent = nextLabel;
                        this._i18nNewsSourceLabels[id] = nextLabel;
                    });
                }
                if (headerLoc.source_prev_title) {
                    this._i18nHeaderSourcePrevTitle = headerLoc.source_prev_title;
                }
                if (headerLoc.source_next_title) {
                    this._i18nHeaderSourceNextTitle = headerLoc.source_next_title;
                }
                if (headerLoc.source_favorites_nav_title) {
                    this._i18nHeaderSourceFavoritesTitle = headerLoc.source_favorites_nav_title;
                }
                if (headerLoc.source_favorites_nav_empty_title) {
                    this._i18nHeaderSourceFavoritesEmptyTitle =
                        headerLoc.source_favorites_nav_empty_title;
                }
                if (headerLoc.source_favorite_add_title) {
                    this._i18nHeaderSourceFavoriteAddTitle = headerLoc.source_favorite_add_title;
                }
                if (headerLoc.source_favorite_remove_title) {
                    this._i18nHeaderSourceFavoriteRemoveTitle =
                        headerLoc.source_favorite_remove_title;
                }
                this.rebuildNewsSourceSelect();
                if (this.elements.newsSourceSelect) {
                    this.elements.newsSourceSelect.value = ns;
                }
                this.refreshHeaderSourceControls();
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
                const bgTitle = document.getElementById('backgroundSelectedSourcesRefreshEnabledTitle');
                if (bgTitle && dash && dash.background_selected_sources_refresh_title) {
                    bgTitle.textContent = dash.background_selected_sources_refresh_title;
                }
                const bgHint = document.getElementById('backgroundSelectedSourcesRefreshEnabledHint');
                if (bgHint && dash && dash.background_selected_sources_refresh_hint) {
                    bgHint.textContent = dash.background_selected_sources_refresh_hint;
                }
                const bgScopeLabel = document.getElementById(
                    'backgroundSelectedSourcesRefreshScopeLabel'
                );
                if (bgScopeLabel && dash && dash.background_selected_sources_refresh_scope_label) {
                    bgScopeLabel.textContent = dash.background_selected_sources_refresh_scope_label;
                }
                const bgScopeFav = document.getElementById(
                    'backgroundSelectedSourcesRefreshScopeFavoritesOption'
                );
                if (bgScopeFav && dash && dash.background_selected_sources_refresh_scope_favorites) {
                    bgScopeFav.textContent = dash.background_selected_sources_refresh_scope_favorites;
                }
                const bgScopeEnabled = document.getElementById(
                    'backgroundSelectedSourcesRefreshScopeEnabledOption'
                );
                if (bgScopeEnabled && dash && dash.background_selected_sources_refresh_scope_enabled) {
                    bgScopeEnabled.textContent = dash.background_selected_sources_refresh_scope_enabled;
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

            const selectedSourcesGen = data.selected_sources_generation;
            if (selectedSourcesGen) {
                if (selectedSourcesGen.confirm) {
                    this._i18nSelectedSourcesGenerationConfirm =
                        selectedSourcesGen.confirm;
                }
                if (selectedSourcesGen.confirm_with_count) {
                    this._i18nSelectedSourcesGenerationConfirmWithCount =
                        selectedSourcesGen.confirm_with_count;
                }
                if (selectedSourcesGen.no_favorites) {
                    this._i18nSelectedSourcesGenerationNoFavorites =
                        selectedSourcesGen.no_favorites;
                }
                if (selectedSourcesGen.status_ready) {
                    this._i18nSelectedSourcesGenerationStatusReady =
                        selectedSourcesGen.status_ready;
                }
                if (selectedSourcesGen.status_preparing) {
                    this._i18nSelectedSourcesGenerationStatusPreparing =
                        selectedSourcesGen.status_preparing;
                }
                if (selectedSourcesGen.status_fetching) {
                    this._i18nSelectedSourcesGenerationStatusFetching =
                        selectedSourcesGen.status_fetching;
                }
                if (selectedSourcesGen.status_generating) {
                    this._i18nSelectedSourcesGenerationStatusGenerating =
                        selectedSourcesGen.status_generating;
                }
                if (selectedSourcesGen.status_cancel_requested) {
                    this._i18nSelectedSourcesGenerationStatusCancelRequested =
                        selectedSourcesGen.status_cancel_requested;
                }
                if (selectedSourcesGen.status_cancelled) {
                    this._i18nSelectedSourcesGenerationStatusCancelled =
                        selectedSourcesGen.status_cancelled;
                }
                if (selectedSourcesGen.status_done) {
                    this._i18nSelectedSourcesGenerationStatusDone =
                        selectedSourcesGen.status_done;
                }
                if (selectedSourcesGen.status_done_with_failures) {
                    this._i18nSelectedSourcesGenerationStatusDoneWithFailures =
                        selectedSourcesGen.status_done_with_failures;
                }
                if (selectedSourcesGen.status_busy) {
                    this._i18nSelectedSourcesGenerationStatusBusy =
                        selectedSourcesGen.status_busy;
                }
                if (selectedSourcesGen.status_blocked) {
                    this._i18nSelectedSourcesGenerationStatusBlocked =
                        selectedSourcesGen.status_blocked;
                }
                if (selectedSourcesGen.current_none) {
                    this._i18nSelectedSourcesGenerationCurrentNone =
                        selectedSourcesGen.current_none;
                }
                if (selectedSourcesGen.eta_unavailable) {
                    this._i18nSelectedSourcesGenerationEtaUnavailable =
                        selectedSourcesGen.eta_unavailable;
                }
                if (selectedSourcesGen.cancel_btn) {
                    this._i18nSelectedSourcesGenerationCancelBtn =
                        selectedSourcesGen.cancel_btn;
                }
                if (selectedSourcesGen.cancel_pending_btn) {
                    this._i18nSelectedSourcesGenerationCancelPendingBtn =
                        selectedSourcesGen.cancel_pending_btn;
                }
                if (selectedSourcesGen.close_btn) {
                    this._i18nSelectedSourcesGenerationCloseBtn =
                        selectedSourcesGen.close_btn;
                }
                if (selectedSourcesGen.start_btn) {
                    this._i18nSelectedSourcesGenerationStartBtn =
                        selectedSourcesGen.start_btn;
                }

                const setText = (id, text) => {
                    const el = document.getElementById(id);
                    if (el && text) {
                        el.textContent = text;
                    }
                };
                setText('selectedSourcesGenerationTitle', selectedSourcesGen.modal_title);
                setText('selectedSourcesGenerationHint', selectedSourcesGen.modal_hint);
                setText('selectedSourcesGenerationScopeLabel', selectedSourcesGen.scope_label);
                setText(
                    'selectedSourcesGenerationScopeEnabledOption',
                    selectedSourcesGen.scope_enabled
                );
                setText(
                    'selectedSourcesGenerationScopeFavoritesOption',
                    selectedSourcesGen.scope_favorites
                );
                setText('selectedSourcesGenerationScopeHint', selectedSourcesGen.scope_hint);
                setText('selectedSourcesGenerationPeriodLabel', selectedSourcesGen.period_label);
                setText('selectedSourcesGenerationPeriodHint', selectedSourcesGen.period_hint);
                setText(
                    'selectedSourcesGenerationPeriodTodayOption',
                    selectedSourcesGen.period_today
                );
                setText(
                    'selectedSourcesGenerationPeriodLast7Option',
                    selectedSourcesGen.period_last_7_days
                );
                setText(
                    'selectedSourcesGenerationPeriodLast30Option',
                    selectedSourcesGen.period_last_30_days
                );
                setText(
                    'selectedSourcesGenerationPeriodAllLoadedOption',
                    selectedSourcesGen.period_all_loaded
                );
                setText('startSelectedSourcesGenerationBtn', selectedSourcesGen.start_btn);
                setText('selectedSourcesGenerationCurrentLabel', selectedSourcesGen.label_current);
                setText(
                    'selectedSourcesGenerationRemainingLabel',
                    selectedSourcesGen.label_remaining
                );
                setText(
                    'selectedSourcesGenerationProgressLabel',
                    selectedSourcesGen.label_progress
                );
                setText(
                    'selectedSourcesGenerationCurrentArticlesLabel',
                    selectedSourcesGen.label_current_articles
                );
                setText('selectedSourcesGenerationEtaLabel', selectedSourcesGen.label_eta);
                this.renderSelectedSourcesGenerationState();
            }

            const ki = data.ki_modal;
            if (ki) {
                const apiModeLabel = document.querySelector('label[for="kiApiMode"]');
                if (apiModeLabel && ki.api_mode) {
                    apiModeLabel.textContent = ki.api_mode;
                }
                const serverUrlLabel = document.querySelector('label[for="apiBaseUrl"]');
                if (serverUrlLabel && ki.server_url) {
                    serverUrlLabel.textContent = ki.server_url;
                }
                const apiModeSelect = document.getElementById('kiApiMode');
                if (apiModeSelect) {
                    const restOption = apiModeSelect.querySelector('option[value="lm_rest_v1"]');
                    const openAiOption = apiModeSelect.querySelector('option[value="openai"]');
                    const anthropicOption = apiModeSelect.querySelector('option[value="anthropic"]');
                    if (restOption && ki.mode_rest) {
                        restOption.textContent = ki.mode_rest;
                    }
                    if (openAiOption && ki.mode_openai) {
                        openAiOption.textContent = ki.mode_openai;
                    }
                    if (anthropicOption && ki.mode_anthropic) {
                        anthropicOption.textContent = ki.mode_anthropic;
                    }
                }
                if (ki.batch_summarize_progress) {
                    this._i18nBatchSummarizeProgress = ki.batch_summarize_progress;
                }
                if (ki.batch_summarize_progress_refresh) {
                    this._i18nBatchSummarizeProgressRefresh = ki.batch_summarize_progress_refresh;
                }
                const lml = document.getElementById('lmModelLabel');
                if (lml && ki.model) {
                    lml.textContent = ki.model;
                }
                if (ki.model_hint_default) {
                    this._i18nLmModelHintDefault = ki.model_hint_default;
                }
                if (ki.model_hint_openai) {
                    this._i18nOpenAiModelHint = ki.model_hint_openai;
                }
                if (ki.model_hint_anthropic) {
                    this._i18nAnthropicModelHint = ki.model_hint_anthropic;
                }
                if (ki.model_automatic) {
                    this._i18nLmModelAutomatic = ki.model_automatic;
                }
                if (ki.model_automatic_openai) {
                    this._i18nOpenAiModelAutomatic = ki.model_automatic_openai;
                }
                if (ki.model_automatic_anthropic) {
                    this._i18nAnthropicModelAutomatic = ki.model_automatic_anthropic;
                }
                if (ki.api_token) {
                    this._i18nKiApiTokenLabel = ki.api_token;
                }
                if (ki.api_token_placeholder) {
                    this._i18nKiApiTokenPlaceholder = ki.api_token_placeholder;
                }
                if (ki.hint_rest) {
                    this._i18nKiHintRest = ki.hint_rest;
                }
                if (ki.hint_openai) {
                    this._i18nKiHintOpenAi = ki.hint_openai;
                }
                if (ki.hint_anthropic) {
                    this._i18nKiHintAnthropic = ki.hint_anthropic;
                }
                if (ki.api_token_anthropic) {
                    this._i18nAnthropicApiTokenLabel = ki.api_token_anthropic;
                }
                if (ki.api_token_anthropic_placeholder) {
                    this._i18nAnthropicApiTokenPlaceholder = ki.api_token_anthropic_placeholder;
                }
                if (ki.model_loading) {
                    this._i18nLmModelLoading = ki.model_loading;
                }
                if (ki.model_load_error) {
                    this._i18nLmModelLoadErrorTpl = ki.model_load_error;
                }
                if (ki.model_refresh_title) {
                    this._i18nLmModelRefreshTitle = ki.model_refresh_title;
                }
                if (ki.model_refresh_aria) {
                    this._i18nLmModelRefreshAria = ki.model_refresh_aria;
                }
                if (ki.model_loaded_prefix) {
                    this._i18nLmModelLoadedPrefix = ki.model_loaded_prefix;
                }
                if (ki.model_not_in_server_list) {
                    this._i18nLmModelNotInListTpl = ki.model_not_in_server_list;
                }
                if (ki.model_role_active_suffix) {
                    this._i18nLmModelActiveSuffix = ki.model_role_active_suffix;
                }
                if (ki.model_file_sameorigin_error) {
                    this._i18nLmModelFileError = ki.model_file_sameorigin_error;
                }
                if (ki.model_loaded_status) {
                    this._i18nLmModelLoadedStatusLine = ki.model_loaded_status;
                }
                if (ki.model_loaded_status_none) {
                    this._i18nLmModelLoadedStatusNone = ki.model_loaded_status_none;
                }
                if (ki.btn_refresh_summary) {
                    this._i18nSummaryRefreshBtn = ki.btn_refresh_summary;
                }
                const lmhIdle = document.getElementById('lmModelHint');
                if (lmhIdle && ki.model_hint_default) {
                    lmhIdle.textContent = ki.model_hint_default;
                }
                const mrb = document.getElementById('lmModelRefreshBtn');
                if (mrb) {
                    if (ki.model_refresh_title) {
                        mrb.setAttribute('title', ki.model_refresh_title);
                    }
                    if (ki.model_refresh_aria) {
                        mrb.setAttribute('aria-label', ki.model_refresh_aria);
                    }
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
                const styleLabel = document.getElementById('summaryStyleLabel');
                if (styleLabel && ki.summary_style_label) {
                    styleLabel.textContent = ki.summary_style_label;
                }
                const styleHint = document.getElementById('summaryStyleHint');
                if (styleHint && ki.summary_style_hint) {
                    styleHint.textContent = ki.summary_style_hint;
                }
                const styleSel = document.getElementById('summaryStyle');
                if (styleSel) {
                    const oFactual = styleSel.querySelector('option[value="factual"]');
                    const oProf = styleSel.querySelector('option[value="professional"]');
                    const oCasual = styleSel.querySelector('option[value="casual"]');
                    const oCustom = styleSel.querySelector('option[value="custom"]');
                    if (oFactual && ki.summary_style_factual) {
                        oFactual.textContent = ki.summary_style_factual;
                    }
                    if (oProf && ki.summary_style_professional) {
                        oProf.textContent = ki.summary_style_professional;
                    }
                    if (oCasual && ki.summary_style_casual) {
                        oCasual.textContent = ki.summary_style_casual;
                    }
                    if (oCustom && ki.summary_style_custom_option) {
                        oCustom.textContent = ki.summary_style_custom_option;
                    }
                }
                const styleCustomLabel = document.getElementById('summaryStyleCustomLabel');
                if (styleCustomLabel && ki.summary_style_custom_label) {
                    styleCustomLabel.textContent = ki.summary_style_custom_label;
                }
                const styleCustomHint = document.getElementById('summaryStyleCustomHint');
                if (styleCustomHint && ki.summary_style_custom_hint) {
                    styleCustomHint.textContent = ki.summary_style_custom_hint;
                }
                const styleCustomEl = document.getElementById('summaryStyleCustom');
                if (styleCustomEl && ki.summary_style_custom_placeholder) {
                    styleCustomEl.setAttribute('placeholder', ki.summary_style_custom_placeholder);
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
                if (ki.article_translation_enabled_title) {
                    const aet = document.getElementById('articleTranslationEnabledTitle');
                    if (aet) {
                        aet.textContent = ki.article_translation_enabled_title;
                    }
                }
                if (ki.article_translation_enabled_hint) {
                    const aeh = document.getElementById('articleTranslationEnabledHint');
                    if (aeh) {
                        aeh.textContent = ki.article_translation_enabled_hint;
                    }
                }
                if (ki.article_translation_target_label) {
                    const atl = document.getElementById('articleTranslationTargetLabel');
                    if (atl) {
                        atl.textContent = ki.article_translation_target_label;
                    }
                }
                if (ki.article_translation_target_hint) {
                    const ath = document.getElementById('articleTranslationTargetHint');
                    if (ath) {
                        ath.textContent = ki.article_translation_target_hint;
                    }
                }
                if (ki.article_translation_provider_label) {
                    const apl = document.getElementById('articleTranslationProviderLabel');
                    if (apl) {
                        apl.textContent = ki.article_translation_provider_label;
                    }
                }
                if (ki.article_translation_provider_hint) {
                    const aph = document.getElementById('articleTranslationProviderHint');
                    if (aph) {
                        aph.textContent = ki.article_translation_provider_hint;
                    }
                }
                if (ki.article_translation_toolbar_hint) {
                    this._i18nArticleTranslationToolbarHint = ki.article_translation_toolbar_hint;
                    const tbh = document.getElementById('articleTranslationToolbarHint');
                    if (tbh) {
                        tbh.textContent = ki.article_translation_toolbar_hint;
                    }
                }
                if (ki.article_translation_reload_status) {
                    this._i18nArticleTranslationReloadStatus = ki.article_translation_reload_status;
                }
                if (ki.article_translation_quota) {
                    this._i18nArticleTranslationQuota = ki.article_translation_quota;
                }
                const gto = document.getElementById('articleTranslationLinkProvider');
                if (gto) {
                    const og = gto.querySelector('option[value="google"]');
                    const ogc = gto.querySelector('option[value="google_classic"]');
                    const ob = gto.querySelector('option[value="bing"]');
                    if (og && ki.article_translation_provider_goog) {
                        og.textContent = ki.article_translation_provider_goog;
                    }
                    if (ogc && ki.article_translation_provider_google_classic) {
                        ogc.textContent = ki.article_translation_provider_google_classic;
                    }
                    if (ob && ki.article_translation_provider_bing) {
                        ob.textContent = ki.article_translation_provider_bing;
                    }
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
                const fdl = document.getElementById('forumEntriesDiscoveryModeLabel');
                if (fdl && ki.forum_entries_discovery_label) {
                    fdl.textContent = ki.forum_entries_discovery_label;
                }
                const fdh = document.getElementById('forumEntriesDiscoveryModeHint');
                if (fdh && ki.forum_entries_discovery_hint) {
                    fdh.textContent = ki.forum_entries_discovery_hint;
                }
                const fdSel = document.getElementById('forumEntriesDiscoveryMode');
                if (
                    fdSel &&
                    ki.forum_entries_discovery_click &&
                    ki.forum_entries_discovery_always
                ) {
                    const oClick = fdSel.querySelector('option[value="click"]');
                    const oAlways = fdSel.querySelector('option[value="always"]');
                    if (oClick) {
                        oClick.textContent = ki.forum_entries_discovery_click;
                    }
                    if (oAlways) {
                        oAlways.textContent = ki.forum_entries_discovery_always;
                    }
                }
                const ydl = document.getElementById('youtubeSuggestionsDiscoveryModeLabel');
                if (ydl && ki.youtube_suggestions_discovery_label) {
                    ydl.textContent = ki.youtube_suggestions_discovery_label;
                }
                const ydh = document.getElementById('youtubeSuggestionsDiscoveryModeHint');
                if (ydh && ki.youtube_suggestions_discovery_hint) {
                    ydh.textContent = ki.youtube_suggestions_discovery_hint;
                }
                const ydSel = document.getElementById('youtubeSuggestionsDiscoveryMode');
                if (
                    ydSel &&
                    ki.youtube_suggestions_discovery_click &&
                    ki.youtube_suggestions_discovery_always
                ) {
                    const oyClick = ydSel.querySelector('option[value="click"]');
                    const oyAlways = ydSel.querySelector('option[value="always"]');
                    if (oyClick) {
                        oyClick.textContent = ki.youtube_suggestions_discovery_click;
                    }
                    if (oyAlways) {
                        oyAlways.textContent = ki.youtube_suggestions_discovery_always;
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
                if (ki.reasoning_level_hint) {
                    this._i18nReasoningLevelHint = ki.reasoning_level_hint;
                }
                const rs = document.getElementById('reasoningSelect');
                if (ki.reasoning_level_off) {
                    this._i18nReasoningLevelOff = ki.reasoning_level_off;
                }
                if (ki.reasoning_level_low) {
                    this._i18nReasoningLevelLow = ki.reasoning_level_low;
                }
                if (ki.reasoning_level_medium) {
                    this._i18nReasoningLevelMedium = ki.reasoning_level_medium;
                }
                if (ki.reasoning_level_high) {
                    this._i18nReasoningLevelHigh = ki.reasoning_level_high;
                }
                if (ki.reasoning_level_on) {
                    this._i18nReasoningLevelOn = ki.reasoning_level_on;
                }
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
                
                // Reasoning enabled toggle
                const reLabel = document.querySelector('legend[for="reasoningEnabledCheckbox"]');
                if (reLabel && ki.reasoning_enabled_label) {
                    reLabel.textContent = ki.reasoning_enabled_label;
                }
                const reHint = document.getElementById('reasoningEnabledHint');
                if (reHint && ki.reasoning_enabled_hint) {
                    reHint.textContent = ki.reasoning_enabled_hint;
                }
                if (ki.reasoning_enabled_hint) {
                    this._i18nReasoningEnabledHint = ki.reasoning_enabled_hint;
                }
                this.syncReasoningControlsForCurrentModel();
                
                const okb = document.getElementById('openKiStatsBtn');
                if (okb && ki.open_stats_btn) {
                    okb.textContent = ki.open_stats_btn;
                }
                if (okb && ki.open_stats_title) {
                    okb.setAttribute('title', ki.open_stats_title);
                    okb.setAttribute('aria-label', ki.open_stats_title);
                }

                const th0 = document.getElementById('themeSettingsHeading');
                if (th0 && ki.theme_section_title) {
                    th0.textContent = ki.theme_section_title;
                }
                const thi0 = document.getElementById('themeSettingsHint');
                if (thi0 && ki.theme_section_hint) {
                    thi0.textContent = ki.theme_section_hint;
                }
                const tml = document.getElementById('themeModeSelectLabel');
                if (tml && ki.theme_mode_label) {
                    tml.textContent = ki.theme_mode_label;
                }
                const tms = document.getElementById('themeModeSelect');
                if (tms) {
                    const tmOpts = [
                        ['system', ki.theme_mode_system],
                        ['light', ki.theme_mode_light],
                        ['dark', ki.theme_mode_dark]
                    ];
                    for (const [val, text] of tmOpts) {
                        if (!text) {
                            continue;
                        }
                        const o = tms.querySelector(`option[value="${val}"]`);
                        if (o) {
                            o.textContent = text;
                        }
                    }
                }
                const sct = document.getElementById('settingsColorThemeLabel');
                if (sct && ki.theme_accent_label) {
                    sct.textContent = ki.theme_accent_label;
                }
                const scts = document.getElementById('settingsColorThemeSelect');
                if (scts && headerLoc) {
                    COLOR_THEME_IDS.forEach((tid) => {
                        const opt = scts.querySelector(`option[value="${tid}"]`);
                        const key = `color_theme_${tid}`;
                        if (opt && headerLoc[key]) {
                            opt.textContent = headerLoc[key];
                        }
                    });
                }
                const articleStateLegend = document.getElementById('articleStateColorsLegend');
                if (articleStateLegend && ki.article_state_colors_title) {
                    articleStateLegend.textContent = ki.article_state_colors_title;
                }
                const articleStateHint = document.getElementById('articleStateColorsHint');
                if (articleStateHint && ki.article_state_colors_hint) {
                    articleStateHint.textContent = ki.article_state_colors_hint;
                }
                const articleStateColorLabelPairs = [
                    ['articleStateNewColorLabel', 'article_state_new_color'],
                    ['articleStateSeenColorLabel', 'article_state_seen_color'],
                    ['articleStateReadColorLabel', 'article_state_read_color']
                ];
                articleStateColorLabelPairs.forEach(([id, key]) => {
                    const node = document.getElementById(id);
                    if (node && ki[key]) {
                        node.textContent = ki[key];
                    }
                });
                const legL = document.getElementById('themeFieldsetLightLegend');
                if (legL && ki.theme_fieldset_light) {
                    legL.textContent = ki.theme_fieldset_light;
                }
                const legD = document.getElementById('themeFieldsetDarkLegend');
                if (legD && ki.theme_fieldset_dark) {
                    legD.textContent = ki.theme_fieldset_dark;
                }
                const legHL = document.getElementById('themeFieldsetHeaderLightLegend');
                if (legHL && ki.theme_fieldset_header_light) {
                    legHL.textContent = ki.theme_fieldset_header_light;
                }
                const legHD = document.getElementById('themeFieldsetHeaderDarkLegend');
                if (legHD && ki.theme_fieldset_header_dark) {
                    legHD.textContent = ki.theme_fieldset_header_dark;
                }
                const thlHint = document.getElementById('themeHeaderLightHint');
                if (thlHint && ki.theme_header_hint_light) {
                    thlHint.textContent = ki.theme_header_hint_light;
                }
                const thdHint = document.getElementById('themeHeaderDarkHint');
                if (thdHint && ki.theme_header_hint_dark) {
                    thdHint.textContent = ki.theme_header_hint_dark;
                }
                const tbl = document.getElementById('themeBrightnessLightLabel');
                if (tbl && ki.theme_brightness_label) {
                    tbl.textContent = ki.theme_brightness_label;
                }
                const tbd = document.getElementById('themeBrightnessDarkLabel');
                if (tbd && ki.theme_brightness_label_dark) {
                    tbd.textContent = ki.theme_brightness_label_dark;
                }
                const thtl = document.getElementById('themeHeaderTransparencyLightLabel');
                if (thtl && ki.theme_header_transparency_label) {
                    thtl.textContent = ki.theme_header_transparency_label;
                }
                const thtd = document.getElementById('themeHeaderTransparencyDarkLabel');
                if (thtd && ki.theme_header_transparency_label_dark) {
                    thtd.textContent = ki.theme_header_transparency_label_dark;
                }
                const themeColorLabelPairs = [
                    ['themeLightBgPrimaryLabel', 'theme_light_bg_primary'],
                    ['themeLightBgSecondaryLabel', 'theme_light_bg_secondary'],
                    ['themeLightBgCardLabel', 'theme_light_bg_card'],
                    ['themeLightBorderLabel', 'theme_light_border'],
                    ['themeDarkBgPrimaryLabel', 'theme_dark_bg_primary'],
                    ['themeDarkBgSecondaryLabel', 'theme_dark_bg_secondary'],
                    ['themeDarkBgCardLabel', 'theme_dark_bg_card'],
                    ['themeDarkBorderLabel', 'theme_dark_border'],
                    ['themeLightHeaderSurfaceLabel', 'theme_header_label_bg'],
                    ['themeLightHeaderTextLabel', 'theme_header_label_text'],
                    ['themeLightHeaderBorderLabel', 'theme_header_label_border'],
                    ['themeDarkHeaderSurfaceLabel', 'theme_header_label_bg'],
                    ['themeDarkHeaderTextLabel', 'theme_header_label_text'],
                    ['themeDarkHeaderBorderLabel', 'theme_header_label_border']
                ];
                for (const [id, k] of themeColorLabelPairs) {
                    const node = document.getElementById(id);
                    if (node && ki[k]) {
                        node.textContent = ki[k];
                    }
                }
                const trb = document.getElementById('themeResetDefaultsBtn');
                if (trb && ki.theme_reset_defaults) {
                    trb.textContent = ki.theme_reset_defaults;
                }
                if (ki.theme_brightness_hint_neutral) {
                    this._i18nThemeBrightnessHintNeutral = ki.theme_brightness_hint_neutral;
                }
                if (ki.theme_brightness_hint_lighter) {
                    this._i18nThemeBrightnessHintLighter = ki.theme_brightness_hint_lighter;
                }
                if (ki.theme_brightness_hint_darker) {
                    this._i18nThemeBrightnessHintDarker = ki.theme_brightness_hint_darker;
                }
                this.syncThemeModalBrightnessHints();
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
                if (ks.chart_caption_new) {
                    this._i18nKiStatsChartNewTpl = ks.chart_caption_new;
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
                if (ks.chart_total_tokens) {
                    this._i18nKiStatsChartTotalTokens = ks.chart_total_tokens;
                }
                if (ks.chart_avg_tokens) {
                    this._i18nKiStatsChartAvgTokens = ks.chart_avg_tokens;
                }
                if (ks.chart_avg_duration) {
                    this._i18nKiStatsChartAvgDuration = ks.chart_avg_duration;
                }
                if (ks.top_model) {
                    this._i18nKiStatsTopModel = ks.top_model;
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
     * @param {unknown} value
     * @returns {string}
     */
    static collapseWhitespace(value) {
        return String(value ?? '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Reconstructs a real hostname from a `*.translate.goog` host (dots in the original host became hyphens).
     * @param {string} translateGoogHost e.g. `www-theverge-com.translate.goog`
     * @returns {string} e.g. `www.theverge.com`, or '' if not a translate.goog host
     */
    static decodeTranslateGoogSlugToHostname(translateGoogHost) {
        const h = String(translateGoogHost || '')
            .trim()
            .toLowerCase();
        const suf = '.translate.goog';
        if (!h.endsWith(suf)) {
            return '';
        }
        const slug = h.slice(0, -suf.length);
        const parts = slug.split('-').filter(Boolean);
        if (parts.length < 2) {
            return '';
        }
        const last = parts[parts.length - 1];
        if (!/^[a-z0-9]{2,24}$/i.test(last)) {
            return '';
        }
        return `${parts.slice(0, -1).join('.')}.${last}`;
    }

    /**
     * Returns the article URL to inspect for content language (unwraps translation proxy URLs).
     * @param {string} rawUrl
     * @returns {string}
     */
    static unwrapArticleUrlForLangDetection(rawUrl) {
        const s = String(rawUrl || '').trim();
        if (!s) {
            return '';
        }
        try {
            const u = new URL(s);
            const h = u.hostname.toLowerCase();
            if (h === 'translate.google.com' || h.endsWith('.translate.google.com')) {
                const inner = u.searchParams.get('u');
                if (inner && /^https?:\/\//i.test(inner.trim())) {
                    return inner.trim();
                }
            }
            if (h.endsWith('.translate.goog')) {
                const decoded = App.decodeTranslateGoogSlugToHostname(h);
                if (decoded) {
                    return `${u.protocol}//${decoded}${u.pathname}${u.search}`;
                }
            }
        } catch (_) {
            /* ignore */
        }
        return s;
    }

    /**
     * Best-effort unwrapping for outbound share targets so the shared URL points to the original article.
     * Supports the translation wrappers emitted by `article-translation.js`.
     * @param {string} rawUrl
     * @returns {string}
     */
    static unwrapShareTargetUrl(rawUrl) {
        const s = String(rawUrl || '').trim();
        if (!s) {
            return '';
        }
        const unwrappedGoogle = App.unwrapArticleUrlForLangDetection(s);
        if (unwrappedGoogle !== s) {
            return unwrappedGoogle;
        }
        try {
            const u = new URL(s);
            const h = u.hostname.toLowerCase();
            if (h === 'www.microsofttranslator.com' || h === 'microsofttranslator.com') {
                const inner = u.searchParams.get('a');
                if (inner && /^https?:\/\//i.test(inner.trim())) {
                    return inner.trim();
                }
            }
        } catch (_) {
            /* ignore */
        }
        return s;
    }

    /**
     * @param {string} hostname
     * @returns {boolean}
     */
    static hostnameLikelyEnglishArticleHost(hostname) {
        try {
            const lang = App.getSourceLanguageByHostname(hostname);
            if (lang === 'en') {
                return true;
            }
            const h = AISummarizer.normalizeHostnameForMatch(hostname);
            for (const r of ENGLISH_CONTENT_HOST_SUFFIXES) {
                if (h === r || h.endsWith(`.${r}`)) {
                    return true;
                }
            }
        } catch (_) {
            /* ignore */
        }
        return false;
    }

    /**
     * HTML `lang` for card content so Google Translate can treat mixed feeds (e.g. de heise + en Verge) correctly.
     * @param {{ newsSource?: string, link?: string, url?: string }|null|undefined} item
     * @param {string} [activeNewsSource] — current tab (fallback when `item.newsSource` is missing on cached rows)
     * @returns {string}
     */
    static articleContentHtmlLang(item, activeNewsSource) {
        const srcItem = item && item.newsSource != null ? String(item.newsSource).trim().toLowerCase() : '';
        const srcView = String(activeNewsSource || '')
            .trim()
            .toLowerCase();
        const sourceLang = App.getSourceLanguage(srcItem || srcView);
        if (sourceLang) {
            return sourceLang;
        }
        const primary = App.articlePrimaryUrl(item) || (item && item.link != null ? String(item.link).trim() : '') || '';
        const link = App.unwrapArticleUrlForLangDetection(primary);
        try {
            const h = new URL(link).hostname.toLowerCase();
            const registryLang = App.getSourceLanguageByHostname(h);
            if (registryLang) {
                return registryLang;
            }
            if (App.hostnameLikelyEnglishArticleHost(h)) {
                return 'en';
            }
        } catch (_) {
            /* ignore */
        }
        return 'de';
    }

    clearArticleTranslationCookieIfDisabled() {
        if (this.settings && this.settings.articleTranslationEnabled === true) {
            return;
        }
        try {
            document.cookie = 'googtrans=;path=/;max-age=0';
        } catch (_) {
            /* ignore */
        }
    }

    /**
     * When article translation is enabled, rewrite external article URLs to open via Google or Microsoft translation.
     * @param {string} url
     * @returns {string}
     */
    maybeWrapUrlForArticleTranslation(url) {
        const raw = String(url || '').trim();
        if (!raw || !this.settings || this.settings.articleTranslationEnabled !== true) {
            return raw;
        }
        const AT = typeof window !== 'undefined' ? window.ArticleTranslation : null;
        if (!AT || typeof AT.wrapUrlForTranslatedView !== 'function') {
            return raw;
        }
        return AT.wrapUrlForTranslatedView(
            raw,
            this.settings.articleTranslationTargetLang || 'de',
            AT.normalizeLinkProvider(this.settings.articleTranslationLinkProvider)
        );
    }

    syncArticleTranslationFormDisabled() {
        const on =
            this.elements.articleTranslationEnabled &&
            this.elements.articleTranslationEnabled.checked === true;
        const tl = this.elements.articleTranslationTargetLang;
        const pr = this.elements.articleTranslationLinkProvider;
        const tw = document.getElementById('articleTranslationTargetWrap');
        const pw = document.getElementById('articleTranslationProviderWrap');
        if (tl) {
            tl.disabled = !on;
        }
        if (pr) {
            pr.disabled = !on;
        }
        if (tw) {
            tw.style.opacity = on ? '' : '0.58';
        }
        if (pw) {
            pw.style.opacity = on ? '' : '0.58';
        }
    }

    /** Enable/dim the custom-style text field; it only applies when style === 'custom'. */
    syncSummaryStyleCustomVisibility() {
        const isCustom =
            this.elements.summaryStyle && this.elements.summaryStyle.value === 'custom';
        const ta = this.elements.summaryStyleCustom;
        const wrap = document.getElementById('summaryStyleCustomWrap');
        if (ta) {
            ta.disabled = !isCustom;
        }
        if (wrap) {
            wrap.style.opacity = isCustom ? '' : '0.58';
        }
    }

    refreshArticleTranslationToolbarFromSettings() {
        const tb = document.getElementById('articleTranslationToolbar');
        const hintEl = document.getElementById('articleTranslationToolbarHint');
        if (!tb) {
            return;
        }
        tb.hidden = true;
        if (hintEl) {
            hintEl.textContent = '';
        }
    }

    /**
     * Title sync when summary language follows the browser language without full article translation.
     * @returns {boolean}
     */
    shouldAutoTranslateTitlesForBrowserSummary() {
        return !!(
            this.settings &&
            this.settings.summaryLangMode === 'browser' &&
            this.settings.articleTranslationEnabled !== true
        );
    }

    /**
     * Debounced MyMemory translation pass after the grid or summaries change.
     */
    scheduleArticleInPlaceTranslation() {
        if (
            !this.settings ||
            (
                this.settings.articleTranslationEnabled !== true &&
                !this.shouldAutoTranslateTitlesForBrowserSummary()
            )
        ) {
            return;
        }
        if (this._articleInPlaceTranslationDebounce) {
            window.clearTimeout(this._articleInPlaceTranslationDebounce);
        }
        this._articleInPlaceTranslationDebounce = window.setTimeout(() => {
            this._articleInPlaceTranslationDebounce = 0;
            void this.runArticleInPlaceTranslationJob();
        }, 550);
    }

    async runArticleInPlaceTranslationJob() {
        if (this._articleInPlaceTranslationRunning) {
            this._articleInPlaceTranslationPending = true;
            return;
        }
        if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
            return;
        }
        const AT = typeof window !== 'undefined' ? window.ArticleTranslation : null;
        const fullArticleTranslation = this.settings && this.settings.articleTranslationEnabled === true;
        const titleOnlyBrowserSync = this.shouldAutoTranslateTitlesForBrowserSummary();
        if (!AT || !this.settings || (!fullArticleTranslation && !titleOnlyBrowserSync)) {
            return;
        }
        if (fullArticleTranslation) {
            this.refreshArticleTranslationToolbarFromSettings();
        }
        this._articleInPlaceTranslationRunning = true;
        try {
            await this.translateNewsCardsWithMyMemory(AT, {
                titlesOnly: titleOnlyBrowserSync && !fullArticleTranslation
            });
        } catch (e) {
            console.warn('In-place article translation:', e);
            const msg = String((e && e.message) || e);
            if (msg.includes('mymemory_quota')) {
                this.showStatus(
                    this._i18nArticleTranslationQuota ||
                        'Daily translation quota exceeded (MyMemory). Try again tomorrow.',
                    true
                );
            }
        } finally {
            this._articleInPlaceTranslationRunning = false;
            if (this._articleInPlaceTranslationPending) {
                this._articleInPlaceTranslationPending = false;
                void this.runArticleInPlaceTranslationJob();
            }
        }
    }

    /**
     * @returns {{ fullArticleTranslation: boolean, titlesOnly: boolean }}
     */
    getInPlaceTranslationMode() {
        const fullArticleTranslation = this.settings && this.settings.articleTranslationEnabled === true;
        const titlesOnly = this.shouldAutoTranslateTitlesForBrowserSummary() && !fullArticleTranslation;
        return {
            fullArticleTranslation,
            titlesOnly
        };
    }

    /**
     * @param {{ normalizeTargetLang: Function }} AT
     * @param {boolean} titlesOnly
     * @returns {string}
     */
    getInPlaceTranslationTargetLang(AT, titlesOnly) {
        return titlesOnly
            ? AT.normalizeTargetLang(
                  String(
                      typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en'
                  )
                      .split('-')[0]
                      .toLowerCase()
              )
            : AT.normalizeTargetLang(this.settings.articleTranslationTargetLang);
    }

    /**
     * @param {HTMLElement} card
     * @param {{ normalizeTargetLang: Function, shouldMachineTranslateInPlace: Function, translateTextMyMemory: Function, translateLongTextMyMemory: Function }} AT
     * @param {{ titlesOnly?: boolean }} [options]
     * @returns {Promise<boolean>}
     */
    async translateRenderedNewsCardWithMyMemory(card, AT, options = {}) {
        if (!(card instanceof HTMLElement)) {
            return false;
        }
        const titlesOnly = options && options.titlesOnly === true;
        const target = this.getInPlaceTranslationTargetLang(AT, titlesOnly);
        const from = (card.getAttribute('lang') || 'de').trim();
        if (!AT.shouldMachineTranslateInPlace(from, target)) {
            return false;
        }
        if (titlesOnly) {
            await this.translateOneNewsCardTitleWithMyMemory(card, from, target, AT);
            await this.translateHeadlineNodeListWithMyMemory(
                card,
                '.summary-alt-link-title, .summary-reddit-line',
                from,
                target,
                AT
            );
            return true;
        }
        await this.translateOneNewsCardWithMyMemory(card, from, target, AT);
        return true;
    }

    /**
     * @param {HTMLElement|null|undefined} card
     * @returns {Promise<void>}
     */
    async runImmediateInPlaceTranslationForCard(card) {
        if (!(card instanceof HTMLElement)) {
            return;
        }
        if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
            return;
        }
        const AT = typeof window !== 'undefined' ? window.ArticleTranslation : null;
        const { fullArticleTranslation, titlesOnly } = this.getInPlaceTranslationMode();
        if (!AT || !this.settings || (!fullArticleTranslation && !titlesOnly)) {
            return;
        }
        try {
            await this.translateRenderedNewsCardWithMyMemory(card, AT, { titlesOnly });
        } catch (e) {
            console.warn('runImmediateInPlaceTranslationForCard:', e);
            const msg = String((e && e.message) || e);
            if (msg.includes('mymemory_quota')) {
                this.showStatus(
                    this._i18nArticleTranslationQuota ||
                        'Daily translation quota exceeded (MyMemory). Try again tomorrow.',
                    true
                );
            }
        }
    }

    /**
     * @param {{ normalizeTargetLang: Function, shouldMachineTranslateInPlace: Function, translateTextMyMemory: Function, translateLongTextMyMemory: Function }} AT
     * @param {{ titlesOnly?: boolean }} [options]
     */
    async translateNewsCardsWithMyMemory(AT, options = {}) {
        const titlesOnly = options && options.titlesOnly === true;
        const grid = this.elements.newsGrid;
        if (!grid) {
            return;
        }
        const cards = Array.from(grid.querySelectorAll('.news-card'));
        for (const card of cards) {
            try {
                const didTranslate = await this.translateRenderedNewsCardWithMyMemory(card, AT, { titlesOnly });
                if (!didTranslate) {
                    continue;
                }
            } catch (e) {
                const m = String((e && e.message) || e);
                if (m.includes('mymemory_quota')) {
                    throw e;
                }
                console.warn('translateOneNewsCardWithMyMemory:', e);
            }
            await new Promise((r) => window.setTimeout(r, 420));
        }
    }

    /**
     * @param {HTMLElement} card
     * @param {string} from
     * @param {string} target
     * @param {{ translateTextMyMemory: Function }} AT
     */
    async translateOneNewsCardTitleWithMyMemory(card, from, target, AT) {
        const titleSpan = card.querySelector('.news-title-translate');
        if (!titleSpan) {
            return;
        }
        const raw = String(titleSpan.dataset.originalText || titleSpan.textContent || '').trim();
        if (!raw) {
            return;
        }
        if (titleSpan.dataset.mtmTitleLang === target) {
            return;
        }
        titleSpan.textContent = await this.translateShortUiText(raw, from, target, AT);
        titleSpan.dataset.mtmTitleLang = target;
    }

    /**
     * @param {string} text
     * @param {string} from
     * @param {string} target
     * @returns {Promise<string>}
     */
    async translateShortUiTextWithKi(text, from, target) {
        const raw = String(text || '').trim();
        if (!raw || /^https?:\/\//i.test(raw)) {
            return raw;
        }
        if (!this.summarizer || typeof this.summarizer.completePrompt !== 'function') {
            return raw;
        }
        const fromLabel =
            typeof this.summarizer.formatLanguageNameForPrompt === 'function'
                ? this.summarizer.formatLanguageNameForPrompt(from)
                : from;
        const targetLabel =
            typeof this.summarizer.formatLanguageNameForPrompt === 'function'
                ? this.summarizer.formatLanguageNameForPrompt(target)
                : target;
        const systemPrompt =
            `You are a translation engine. Translate the user's text from ${fromLabel} to ${targetLabel}. ` +
            'Return only the translated text. Preserve URLs, @mentions, hashtags, emojis, punctuation, and brand or product names.';
        try {
            const out = await this.summarizer.completePrompt(systemPrompt, raw);
            const finalText = String(out || '').trim();
            return finalText || raw;
        } catch (e) {
            console.warn('translateShortUiTextWithKi:', e);
            return raw;
        }
    }

    /**
     * @param {string} text
     * @param {string} from
     * @param {string} target
     * @param {{ translateTextMyMemory: Function }} AT
     * @returns {Promise<string>}
     */
    async translateShortUiText(text, from, target, AT) {
        const raw = String(text || '').trim();
        if (!raw) {
            return '';
        }
        const cacheKey = `${from}|${target}|${raw}`;
        if (this._uiTranslationCache.has(cacheKey)) {
            return this._uiTranslationCache.get(cacheKey) || raw;
        }
        let translated = raw;
        try {
            translated = await AT.translateTextMyMemory(raw, from, target);
        } catch (e) {
            console.warn('translateShortUiText: MyMemory fallback to KI', e);
            translated = await this.translateShortUiTextWithKi(raw, from, target);
        }
        const finalText = String(translated || '').trim() || raw;
        this._uiTranslationCache.set(cacheKey, finalText);
        return finalText;
    }

    /**
     * @param {HTMLElement} root
     * @param {string} selector
     * @param {string} from
     * @param {string} target
     * @param {{ translateTextMyMemory: Function }} AT
     */
    async translateHeadlineNodeListWithMyMemory(root, selector, from, target, AT) {
        const nodes = Array.from(root.querySelectorAll(selector));
        for (const el of nodes) {
            const raw = String(el.dataset.originalText || el.textContent || '').trim();
            if (!raw) {
                continue;
            }
            if (!el.dataset.originalText) {
                el.dataset.originalText = raw;
            }
            if (el.dataset.mtmTitleLang === target) {
                continue;
            }
            el.textContent = await this.translateShortUiText(raw, from, target, AT);
            el.dataset.mtmTitleLang = target;
            await new Promise((r) => window.setTimeout(r, 380));
        }
    }

    /**
     * @param {HTMLElement} card
     * @param {string} from
     * @param {string} target
     * @param {{ translateTextMyMemory: Function, translateLongTextMyMemory: Function }} AT
     */
    async translateOneNewsCardWithMyMemory(card, from, target, AT) {
        await this.translateOneNewsCardTitleWithMyMemory(card, from, target, AT);
        await this.translateHeadlineNodeListWithMyMemory(
            card,
            '.summary-alt-link-title, .summary-reddit-line',
            from,
            target,
            AT
        );
        const titleSpan = card.querySelector('.news-title-translate');
        if (titleSpan) {
            titleSpan.dataset.mtm = '1';
        }
        const badge = card.querySelector('.category-badge');
        if (badge && badge.dataset.mtm !== '1') {
            const raw = (badge.textContent || '').trim();
            if (raw) {
                badge.textContent = await this.translateShortUiText(raw, from, target, AT);
                badge.dataset.mtm = '1';
            }
        }
        const sc = card.querySelector('.summary-content');
        if (sc && sc.textContent && sc.textContent.trim() && sc.dataset.mtm !== '1') {
            sc.textContent = await AT.translateLongTextMyMemory(sc.textContent.trim(), from, target);
            sc.dataset.mtm = '1';
        }
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

    /**
     * Build a news-cache row without transient UI flags.
     * @param {Record<string, unknown>} item
     * @param {string} [sourceId]
     * @returns {Record<string, unknown>}
     */
    static newsCacheRecordForItem(item, sourceId = '') {
        const record = { ...(item || {}) };
        delete record.isFavorite;
        delete record.isHidden;
        delete record.readState;
        if (sourceId) {
            record.newsSource = sourceId;
        }
        return record;
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
                    isHidden: row.isHidden === true,
                    readState: App.normalizeArticleReadState(row.readState)
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
                isHidden: Boolean(flags && flags.isHidden === true),
                readState: App.normalizeArticleReadState(flags ? flags.readState : item.readState)
            };
        });
    }

    getArticleReadStateForItem(item) {
        const key = App.articleFlagKey(item);
        if (key) {
            const flags = this._articleFlags.get(key);
            if (flags) {
                return App.normalizeArticleReadState(flags.readState);
            }
        }
        return App.normalizeArticleReadState(item && item.readState);
    }

    isArticleHiddenByUser(item) {
        const key = App.articleFlagKey(item);
        if (key) {
            const flags = this._articleFlags.get(key);
            if (flags) {
                return flags.isHidden === true;
            }
        }
        return Boolean(item && item.isHidden === true);
    }

    buildNewsCacheRecordsForSource(sourceId, items) {
        const normalizedSource = this.normalizeNewsSource(sourceId);
        return (Array.isArray(items) ? items : [])
            .filter((item) => !this.isArticleHiddenByUser(item))
            .map((item) => App.newsCacheRecordForItem(item, normalizedSource));
    }

    async purgeHiddenArticlesFromNewsCache() {
        if (!this.storage) {
            return 0;
        }
        try {
            const rows = await this.storage.getAllNews();
            const hiddenRows = (Array.isArray(rows) ? rows : []).filter((row) =>
                this.isArticleHiddenByUser(row)
            );
            if (hiddenRows.length === 0) {
                return 0;
            }
            await Promise.all(hiddenRows.map((row) => this.storage.deleteNewsArticle(row && row.id)));
            return hiddenRows.length;
        } catch (e) {
            console.warn('purgeHiddenArticlesFromNewsCache:', e);
            return 0;
        }
    }

    async syncArticleNewsCacheForHiddenState(item, isHidden) {
        if (!this.storage) {
            return;
        }
        if (isHidden) {
            await this.storage.deleteNewsArticle(item && item.id);
            return;
        }
        const sourceId =
            App.normalizeStoredNewsSourceId(item && item.newsSource) ||
            this.normalizeNewsSource(this.settings?.newsSource);
        const record = App.newsCacheRecordForItem(item, sourceId);
        await this.storage.saveNewsArticle(record);
    }

    async saveArticleFlagsForItem(item, patch) {
        const key = App.articleFlagKey(item);
        if (!key) {
            return;
        }
        try {
            const prev = this._articleFlags.get(key) || {};
            const safePatch = patch || {};
            const hasReadState = Object.hasOwn(safePatch, 'readState');
            const next = {
                isFavorite: safePatch.isFavorite != null ? safePatch.isFavorite === true : prev.isFavorite === true,
                isHidden: safePatch.isHidden != null ? safePatch.isHidden === true : prev.isHidden === true,
                readState: hasReadState
                    ? App.normalizeArticleReadState(safePatch.readState)
                    : App.normalizeArticleReadState(prev.readState)
            };
            this._articleFlags.set(key, next);
            this._filterCache.clear();
            await this.storage.saveArticleFlag(key, next);
            if (safePatch.isHidden != null) {
                await this.syncArticleNewsCacheForHiddenState(item, next.isHidden);
            }
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

    /**
     * @param {HTMLElement} card
     * @param {string} selector
     * @param {(link: HTMLAnchorElement) => string} buildLabel
     * @returns {string[]}
     */
    collectShareLinkLines(card, selector, buildLabel) {
        if (!card) {
            return [];
        }
        return Array.from(card.querySelectorAll(selector))
            .map((node) => {
                const link = node instanceof HTMLAnchorElement ? node : null;
                if (!link) {
                    return '';
                }
                const href = App.unwrapShareTargetUrl(link.getAttribute('href') || link.href || '');
                const label = App.collapseWhitespace(buildLabel(link));
                if (!href && !label) {
                    return '';
                }
                if (!href) {
                    return label;
                }
                if (!label || label === href) {
                    return href;
                }
                return `${label} — ${href}`;
            })
            .filter(Boolean);
    }

    /**
     * @param {HTMLElement} card
     * @returns {string[]}
     */
    collectShareCommentLines(card) {
        if (!card) {
            return [];
        }
        const lines = [];
        const moodWrap = card.querySelector('.forum-mood-wrap');
        if (moodWrap instanceof HTMLElement && !moodWrap.hidden) {
            const mood = App.collapseWhitespace(moodWrap.textContent || '');
            if (mood) {
                lines.push(mood);
            }
        }
        const commentsRow = card.querySelector('.news-comments-row');
        if (!(commentsRow instanceof HTMLElement) || commentsRow.hidden) {
            return lines;
        }
        const commentsInner = commentsRow.querySelector('.news-comments-inner');
        if (!(commentsInner instanceof HTMLElement)) {
            return lines;
        }
        const primary = App.collapseWhitespace(
            commentsInner.querySelector('.news-comments-row-primary')?.textContent || ''
        );
        if (primary) {
            lines.push(primary);
        }
        const maxRepliesLink = commentsInner.querySelector('.news-comments-max-link--standalone');
        if (maxRepliesLink instanceof HTMLAnchorElement) {
            const label = App.collapseWhitespace(maxRepliesLink.textContent || '');
            const href = App.unwrapShareTargetUrl(
                maxRepliesLink.getAttribute('href') || maxRepliesLink.href || ''
            );
            if (label && href) {
                lines.push(`${label} — ${href}`);
            } else if (label) {
                lines.push(label);
            }
        }
        commentsInner
            .querySelectorAll(
                '.news-comments-rss-note, .news-comments-rate-msg, .news-comments-note, .news-comments-error'
            )
            .forEach((node) => {
                const text = App.collapseWhitespace(node.textContent || '');
                if (text) {
                    lines.push(text);
                }
            });
        return Array.from(new Set(lines));
    }

    /**
     * @param {HTMLElement} card
     * @param {object|undefined} item
     * @returns {{ title: string, url: string, text: string }}
     */
    buildSharePayloadForCard(card, item) {
        const title = App.collapseWhitespace(
            card.querySelector('.news-title-translate')?.textContent || item?.title || ''
        );
        const rowUrl = card.querySelector('.news-comments-row[data-article-url]')?.getAttribute('data-article-url') || '';
        const linkHref = card.querySelector('.news-title a')?.getAttribute('href') || '';
        const articleUrl = App.unwrapShareTargetUrl(App.articlePrimaryUrl(item) || rowUrl || linkHref);
        const sections = [];
        const summaryDiv = card.querySelector('.news-summary');
        const summaryVisible =
            summaryDiv instanceof HTMLElement && summaryDiv.classList.contains('active');
        const summaryText = summaryVisible
            ? App.collapseWhitespace(summaryDiv.querySelector('.summary-content')?.textContent || '')
            : '';
        if (summaryText) {
            sections.push(`${this._i18nShareSectionSummary}\n${summaryText}`);
        }
        const altLinks = summaryVisible
            ? this.collectShareLinkLines(card, '.summary-alt-link', (link) => {
                  const source = App.collapseWhitespace(
                      link.querySelector('.summary-alt-link-source')?.textContent || ''
                  ).replace(/:\s*$/, '');
                  const headline = App.collapseWhitespace(
                      link.querySelector('.summary-alt-link-title')?.textContent || ''
                  );
                  if (source && headline) {
                      return `${source}: ${headline}`;
                  }
                  return headline;
              })
            : [];
        if (altLinks.length > 0) {
            sections.push(
                `${this._i18nShareSectionAlternativeLinks}\n${altLinks.map((line, index) => `${index + 1}. ${line}`).join('\n')}`
            );
        }
        const redditThreads = summaryVisible
            ? this.collectShareLinkLines(card, '.summary-reddit-link', (link) =>
                  App.collapseWhitespace(
                      link.querySelector('.summary-reddit-line')?.textContent || link.textContent || ''
                  )
              )
            : [];
        if (redditThreads.length > 0) {
            sections.push(
                `${this._i18nShareSectionReddit}\n${redditThreads.map((line, index) => `${index + 1}. ${line}`).join('\n')}`
            );
        }
        const commentLines = this.collectShareCommentLines(card);
        if (commentLines.length > 0) {
            sections.push(`${this._i18nShareSectionComments}\n${commentLines.join('\n')}`);
        }

        const parts = [];
        if (title) {
            parts.push(title);
        }
        if (articleUrl) {
            parts.push(articleUrl);
        }
        if (sections.length > 0) {
            parts.push(...sections.map((section) => `\n${section}`));
        }
        parts.push('\nCreated with Cucumber NewsScraper');

        return {
            title,
            url: articleUrl,
            text: parts.join('\n').trim()
        };
    }

    /**
     * @param {string} cardId
     * @param {HTMLElement} [triggerBtn]
     * @returns {Promise<void>}
     */
    async shareArticleCard(cardId, triggerBtn) {
        const card = this.findRenderedNewsCardById(cardId);
        if (!card) {
            this.showStatus(this._i18nShareFailed, true);
            return;
        }
        const item = this.resolveNewsItemForSummary(cardId, '');
        const payload = this.buildSharePayloadForCard(card, item);
        if (!payload.text) {
            this.showStatus(this._i18nShareFailed, true);
            return;
        }

        const nav = typeof navigator !== 'undefined' ? navigator : null;
        const shareData = {
            title: payload.title,
            text: payload.text,
            ...(payload.url ? { url: payload.url } : {})
        };

        const prevDisabled = triggerBtn ? triggerBtn.disabled : false;
        if (triggerBtn) {
            triggerBtn.disabled = true;
        }
        try {
            const canUseNativeShare =
                nav &&
                typeof nav.share === 'function' &&
                (() => {
                    if (typeof nav.canShare !== 'function') {
                        return true;
                    }
                    try {
                        return nav.canShare(shareData);
                    } catch (_) {
                        return false;
                    }
                })();

            if (canUseNativeShare) {
                await nav.share(shareData);
                this.showStatus(this._i18nShareDone);
                return;
            }

            if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
                await nav.clipboard.writeText(payload.text);
                this.showStatus(this._i18nShareCopied);
                return;
            }

            this.showStatus(this._i18nShareUnavailable, true);
        } catch (error) {
            if (error && typeof error === 'object' && error.name === 'AbortError') {
                return;
            }
            if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
                try {
                    await nav.clipboard.writeText(payload.text);
                    this.showStatus(this._i18nShareCopied);
                    return;
                } catch (_) {
                    /* fall through to error status */
                }
            }
            this.showStatus(this._i18nShareFailed, true);
        } finally {
            if (triggerBtn) {
                triggerBtn.disabled = prevDisabled;
            }
        }
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
        this.renderCategoryFilters();
    }

    /**
     * Build visible category options from the currently loaded articles of the active source.
     * @param {Array<Record<string, unknown>>} [items]
     * @returns {{ value: string, label: string }[]}
     */
    collectCategoryOptionsForCurrentSource(items = this.newsItems) {
        const activeSource = this.normalizeNewsSource(this.settings?.newsSource);
        const optionsByValue = new Map();
        (Array.isArray(items) ? items : []).forEach((item) => {
            const sourceId = App.normalizeStoredNewsSourceId(item && item.newsSource);
            if (sourceId && sourceId !== activeSource) {
                return;
            }
            const value = String(item && item.category || '').trim();
            if (!value || optionsByValue.has(value)) {
                return;
            }
            const fallbackLabel = String(item && item.categoryName || '').trim() || value;
            optionsByValue.set(value, this.getVisibleCategoryLabel(value, fallbackLabel));
        });
        return this.sortCategoryOptions(
            Array.from(optionsByValue.entries()).map(([value, label]) => ({ value, label }))
        );
    }

    /**
     * @param {string} value
     * @param {string} fallbackLabel
     * @returns {string}
     */
    getVisibleCategoryLabel(value, fallbackLabel) {
        const key = String(value || '').trim();
        if (!key) {
            return String(fallbackLabel || '').trim();
        }
        const localized = this._i18nFilterLabels[key];
        return localized || String(fallbackLabel || key).trim();
    }

    /**
     * @param {{ value: string, label: string }[]} options
     * @returns {{ value: string, label: string }[]}
     */
    sortCategoryOptions(options) {
        const order = new Map([
            ['it', 1],
            ['security', 2],
            ['ki', 3],
            ['wissenschaft', 4],
            ['mobiles', 5],
            ['entertainment', 6],
            ['wirtschaft', 7],
            ['netzpolitik', 8],
            ['journal', 9],
            ['heise_ix', 10],
            ['heise_ct', 11],
            ['heise_foto', 12],
            ['heise_mac', 13],
            ['heise_make', 14],
            ['heise_autos', 15],
            ['telepolis', 16],
            ['bild', 17]
        ]);
        return [...(Array.isArray(options) ? options : [])].sort((a, b) => {
            const aOrder = order.has(a.value) ? order.get(a.value) : Number.MAX_SAFE_INTEGER;
            const bOrder = order.has(b.value) ? order.get(b.value) : Number.MAX_SAFE_INTEGER;
            if (aOrder !== bOrder) {
                return aOrder - bOrder;
            }
            return String(a.label || a.value || '').localeCompare(String(b.label || b.value || ''), undefined, {
                sensitivity: 'base'
            });
        });
    }

    /**
     * Render filter chips for the active source from the currently available article categories.
     * @param {Array<Record<string, unknown>>} [items]
     */
    renderCategoryFilters(items = this.newsItems) {
        const root = this.elements.categoryFilters;
        if (!root) {
            return;
        }
        const options = this.collectCategoryOptionsForCurrentSource(items);
        root.innerHTML = '';
        if (options.length === 0) {
            return;
        }
        const group = document.createElement('div');
        group.className = 'category-filters__group';
        group.dataset.newsSourceScope = 'dynamic';
        const activeSource = this.normalizeNewsSource(this.settings?.newsSource);
        const disabled = new Set(this.getStoredDisabledCategoriesForSource(activeSource));
        options.forEach((option, index) => {
            const value = String(option.value || '').trim();
            if (!value) {
                return;
            }
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = `cat-dyn-${index}-${value.replace(/[^a-z0-9_-]/gi, '_')}`;
            input.className = 'category-checkbox';
            input.value = value;
            input.checked = !disabled.has(value);

            const label = document.createElement('label');
            label.htmlFor = input.id;
            label.className = 'category-label';
            label.textContent = String(option.label || value).trim();

            group.appendChild(input);
            group.appendChild(label);
        });
        root.appendChild(group);
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
     * Category values currently visible for the active source filter UI.
     * @returns {Set<string>}
     */
    getVisibleCategoryValueSet() {
        return new Set(this.collectCategoryOptionsForCurrentSource().map((option) => option.value));
    }

    /**
     * @param {string} source
     * @returns {boolean}
     */
    hasStoredDisabledCategoriesForSource(source) {
        const sourceId = String(source || '').trim();
        if (!sourceId || !this.disabledCategoriesBySource || typeof this.disabledCategoriesBySource !== 'object') {
            return false;
        }
        return Object.prototype.hasOwnProperty.call(this.disabledCategoriesBySource, sourceId);
    }

    /**
     * @param {string} source
     * @returns {string[]}
     */
    getStoredDisabledCategoriesForSource(source) {
        const sourceId = String(source || '').trim();
        if (!this.hasStoredDisabledCategoriesForSource(sourceId)) {
            return [];
        }
        const raw = this.disabledCategoriesBySource[sourceId];
        return Array.isArray(raw) ? [...new Set(raw.map((item) => String(item || '').trim()).filter(Boolean))] : [];
    }

    /**
     * Merge visible checkbox state with stored categories from hidden groups (other sources).
     */
    mergeSelectedCategoriesFromVisibleDom() {
        const vis = this.readSelectedCategoriesFromDom();
        this.selectedCategories = [...new Set(vis.map((item) => String(item || '').trim()).filter(Boolean))];
        this.syncAllCategoryCheckboxesFromSelection();
    }

    /**
     * When the visible filter group has no selection, check sensible defaults (heise/generic: all; single-source groups: on).
     */
    ensureDefaultCategorySelectionForSource() {
        const src = this.normalizeNewsSource(this.settings?.newsSource);
        const visibleSet = this.getVisibleCategoryValueSet();
        if (visibleSet.size === 0) {
            this.selectedCategories = [];
            return;
        }
        let vis = this.readSelectedCategoriesFromDom();
        if (!this.hasStoredDisabledCategoriesForSource(src)) {
            document.querySelectorAll('.category-checkbox').forEach((cb) => {
                const g = cb.closest('[data-news-source-scope]');
                if (g && g.hidden) {
                    return;
                }
                cb.checked = true;
            });
            vis = this.readSelectedCategoriesFromDom();
        }
        this.selectedCategories = [...new Set(vis.map((item) => String(item || '').trim()).filter(Boolean))];
        this.syncAllCategoryCheckboxesFromSelection();
    }

    buildCategoryFiltered() {
        const mode = this.sortMode || 'recency';
        const visibleCategorySet = this.getVisibleCategoryValueSet();

        const cacheKey = this._buildFilterCacheKey(this.normalizeNewsSource(this.settings?.newsSource), mode);

        const cached = this._filterCache.get(cacheKey);
        if (cached && Array.isArray(cached)) {
            return cached;
        }

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

        let result;
        if (visibleCategorySet.size === 0) {
            result = base;
        } else if (this.selectedCategories.length === 0) {
            result = [];
        } else {
            const catSet = new Set(
                this.selectedCategories.filter((category) => visibleCategorySet.has(String(category || '').trim()))
            );
            if (catSet.size === 0) {
                result = [];
            } else {
                result = base.filter((item) => catSet.has(String(item.category || '').trim()));
            }
        }

        // Cache the result
        this._filterCache.set(cacheKey, result);
        return result;
    }

    /** @returns {string} Unique cache key for filter state */
    _buildFilterCacheKey(src, mode) {
        const cats = [...this.selectedCategories].sort().join('|');
        const dateFilter = 
            mode === 'date_day' ? `day:${this.sortDateSingle}` :
            mode === 'date_range' ? `range:${this.sortDateFrom}|${this.sortDateTo}` :
            '';
        return `${src}|${cats}|${mode}|${dateFilter}`;
    }

    /** @returns {string} */
    getManualCardOrderViewKey() {
        const src = this.normalizeNewsSource(this.settings?.newsSource);
        const mode = this.sortMode || 'recency';
        return this._buildFilterCacheKey(src, mode);
    }

    /** @returns {string[]} */
    getManualCardOrderForCurrentView() {
        const viewKey = this.getManualCardOrderViewKey();
        return App.normalizeManualCardOrderIds(this._manualCardOrderByView[viewKey]);
    }

    persistManualCardOrderState() {
        if (typeof localStorage === 'undefined') {
            return;
        }
        try {
            localStorage.setItem(
                MANUAL_CARD_ORDER_STORAGE_KEY,
                JSON.stringify(App.normalizeManualCardOrderState(this._manualCardOrderByView))
            );
        } catch (_) {
            /* ignore */
        }
    }

    /**
     * @param {string[]} ids
     */
    setManualCardOrderForCurrentView(ids) {
        const viewKey = this.getManualCardOrderViewKey();
        const normalizedIds = App.normalizeManualCardOrderIds(ids);
        if (normalizedIds.length > 0) {
            this._manualCardOrderByView[viewKey] = normalizedIds;
        } else {
            delete this._manualCardOrderByView[viewKey];
        }
        this.persistManualCardOrderState();
    }

    /**
     * @param {Array<Record<string, unknown>>} list
     * @returns {Array<Record<string, unknown>>}
     */
    applyManualCardOrder(list) {
        const items = Array.isArray(list) ? [...list] : [];
        const manualIds = this.getManualCardOrderForCurrentView();
        if (items.length < 2 || manualIds.length === 0) {
            return items;
        }
        const byId = new Map();
        items.forEach((item) => {
            const id = String(item && item.id ? item.id : '').trim();
            if (!id) {
                return;
            }
            byId.set(id, item);
        });

        const ordered = [];
        const seen = new Set();

        manualIds.forEach((id) => {
            const item = byId.get(id);
            if (!item || seen.has(id)) {
                return;
            }
            seen.add(id);
            ordered.push(item);
        });

        items.forEach((item) => {
            const id = String(item && item.id ? item.id : '').trim();
            if (!id || seen.has(id)) {
                return;
            }
            ordered.push(item);
        });

        return ordered;
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
        this.updateItemsPerPageForGrid();
        const n = this.filteredNewsItems.length;
        const tpl = this._i18nNewsCountLoaded || '{count} Nachrichten geladen';
        this.elements.newsCount.textContent = tpl.replace(/\{count\}/g, String(n));
        const rendered = this.getRenderedNewsCards().length;
        const shown = Math.min(n, rendered > 0 ? rendered : this.itemsPerPage * this.currentPage);
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

        this.filteredNewsItems = this.applyManualCardOrder(this.sortItemList(list));
        this.currentPage = 1;
        if (render) {
            this.updateItemsPerPageForGrid();
            await this.renderNews(this.filteredNewsItems.slice(0, this.itemsPerPage), false);
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
            disabledCategoriesBySource: this.disabledCategoriesBySource,
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
        const currentSource = this.normalizeNewsSource(this.settings?.newsSource);
        const visibleValues = [...this.getVisibleCategoryValueSet()];
        const selectedSet = new Set(
            (Array.isArray(this.selectedCategories) ? this.selectedCategories : [])
                .map((item) => String(item || '').trim())
                .filter(Boolean)
        );
        this.disabledCategoriesBySource = {
            ...(this.disabledCategoriesBySource && typeof this.disabledCategoriesBySource === 'object'
                ? this.disabledCategoriesBySource
                : {}),
            [currentSource]: visibleValues.filter((value) => !selectedSet.has(value))
        };
        this.settings = {
            ...this.settings,
            selectedCategories: this.selectedCategories,
            disabledCategoriesBySource: this.disabledCategoriesBySource
        };
        try {
            await this.storage.saveSettings({
                selectedCategories: this.selectedCategories,
                disabledCategoriesBySource: this.disabledCategoriesBySource
            });
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
        if (this._selectedSourcesGenerationInProgress) {
            const currentSource = this.normalizeNewsSource(this.settings?.newsSource);
            if (currentSource) {
                sel.value = currentSource;
            }
            this.refreshHeaderSourceControls();
            return;
        }
        const v = this.normalizeNewsSource(sel.value);
        // Invalidate in-flight fetches immediately. Otherwise a slow previous-source request can
        // finish during the awaited settings/cache work below and render or persist under `v`.
        this._newsFetchGeneration += 1;
        this.showLoadingState();
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
        this.selectedCategories = [];
        if (this.settings) {
            this.settings.selectedCategories = [];
        }
        this.scraper.configureSource(v);
        this.syncCategoryFiltersVisibility();
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
        this.refreshHeaderSourceControls();
        if (this._headerBrandMode === 'text') {
            this.scheduleHeaderBrandTextFit();
        }
        await this.fetchNews();
    }

    /**
     * Load the previous canonical article URLs for one source.
     * Reuses the in-memory list when it already belongs to that source, otherwise falls back to IndexedDB.
     * @param {string} sourceId
     * @returns {Promise<Set<string>>}
     */
    async getPreviousArticleUrlSetForSource(sourceId) {
        const normalizedSource = this.normalizeNewsSource(sourceId);
        if (!normalizedSource) {
            return new Set();
        }

        if (normalizedSource === this._loadedNewsSource && Array.isArray(this.newsItems) && this.newsItems.length > 0) {
            return new Set(
                this.newsItems
                    .map((item) => App.canonicalArticleUrl(item && (item.url || item.link || '')))
                    .filter(Boolean)
            );
        }

        const cachedNews = await this.storage.getAllNews();
        const prevUrls = new Set();
        (Array.isArray(cachedNews) ? cachedNews : []).forEach((item) => {
            const itemSource = App.normalizeStoredNewsSourceId(item && item.newsSource);
            if (itemSource !== normalizedSource) {
                return;
            }
            const url = App.canonicalArticleUrl(item && (item.url || item.link || ''));
            if (url) {
                prevUrls.add(url);
            }
        });
        return prevUrls;
    }

    persistPendingNewArticleUrlState() {
        if (typeof localStorage === 'undefined') {
            return;
        }
        try {
            localStorage.setItem(
                PENDING_NEW_ARTICLE_URLS_STORAGE_KEY,
                JSON.stringify(App.normalizePendingNewArticleUrlState(this._pendingNewArticleUrlsBySource))
            );
        } catch (e) {
            console.warn('persistPendingNewArticleUrlState:', e);
        }
    }

    /**
     * @param {string} sourceId
     * @returns {Set<string>}
     */
    getPendingNewArticleUrlSetForSource(sourceId) {
        const normalizedSource = this.normalizeNewsSource(sourceId);
        if (!normalizedSource) {
            return new Set();
        }
        const raw = this._pendingNewArticleUrlsBySource && this._pendingNewArticleUrlsBySource[normalizedSource];
        return new Set(
            (Array.isArray(raw) ? raw : [])
                .map((url) => App.canonicalArticleUrl(url))
                .filter(Boolean)
        );
    }

    /**
     * @param {string} sourceId
     * @returns {boolean}
     */
    hasPendingNewArticleSourceEntry(sourceId) {
        const normalizedSource = this.normalizeNewsSource(sourceId);
        return !!(
            normalizedSource &&
            this._pendingNewArticleUrlsBySource &&
            Object.prototype.hasOwnProperty.call(this._pendingNewArticleUrlsBySource, normalizedSource)
        );
    }

    /**
     * @param {string} sourceId
     * @param {Iterable<string>} urls
     */
    setPendingNewArticleUrlsForSource(sourceId, urls) {
        const normalizedSource = this.normalizeNewsSource(sourceId);
        if (!normalizedSource) {
            return;
        }
        const normalizedUrls = [...new Set(
            Array.from(urls || [])
                .map((url) => App.canonicalArticleUrl(url))
                .filter(Boolean)
        )];
        this._pendingNewArticleUrlsBySource[normalizedSource] = normalizedUrls;
        this.persistPendingNewArticleUrlState();
    }

    /**
     * @param {string} sourceId
     * @param {Array<Record<string, unknown>>} items
     */
    mergePendingNewArticlesForSource(sourceId, items) {
        const pending = this.getPendingNewArticleUrlSetForSource(sourceId);
        (Array.isArray(items) ? items : []).forEach((item) => {
            if (this.getArticleReadStateForItem(item)) {
                return;
            }
            const url = App.canonicalArticleUrl(item && (item.url || item.link || ''));
            if (url) {
                pending.add(url);
            }
        });
        this.setPendingNewArticleUrlsForSource(sourceId, pending);
    }

    /**
     * @param {string} sourceId
     * @param {Array<Record<string, unknown>>} items
     */
    syncVisibleNewArticleIdsFromPending(sourceId, items) {
        const pending = this.getPendingNewArticleUrlSetForSource(sourceId);
        let pendingChanged = false;
        this._newArticleIds = new Set();
        (Array.isArray(items) ? items : []).forEach((item) => {
            const url = App.canonicalArticleUrl(item && (item.url || item.link || ''));
            if (!url || !pending.has(url) || !item || !item.id) {
                return;
            }
            if (this.getArticleReadStateForItem(item)) {
                pending.delete(url);
                pendingChanged = true;
                return;
            }
            if (item && item.id) {
                this._newArticleIds.add(item.id);
            }
        });
        if (pendingChanged) {
            this.setPendingNewArticleUrlsForSource(sourceId, pending);
        }
    }

    async fetchNews(forceRefresh = false, options = {}) {
        const gen = ++this._newsFetchGeneration;
        const suppressStatus = options && options.suppressStatus === true;
        const suppressAutoSummarize = options && options.suppressAutoSummarize === true;
        const fetchSource = this.normalizeNewsSource(this.settings?.newsSource);
        const scraper = new NewsScraper();
        scraper.configureSource(fetchSource);
        try {
            // Show loading state
            this.showLoadingState();

            // Clear cache if force refresh
            if (forceRefresh) {
                await scraper.clearCache();
            }
            if (
                gen !== this._newsFetchGeneration ||
                this.normalizeNewsSource(this.settings?.newsSource) !== fetchSource
            ) {
                return;
            }

            // Fetch news from scraper (defensive second filter — must drop Golem /news/anzeige-… slugs)
            let newsItems = await scraper.fetchNews();
            if (
                gen !== this._newsFetchGeneration ||
                this.normalizeNewsSource(this.settings?.newsSource) !== fetchSource
            ) {
                return;
            }
            newsItems = NewsScraper.filterOutAdvertorialItems(newsItems).map((item) => ({
                ...item,
                newsSource: fetchSource
            }));

            const prevUrls = await this.getPreviousArticleUrlSetForSource(fetchSource);
            const hadPrevious = prevUrls.size > 0;
            if (
                gen !== this._newsFetchGeneration ||
                this.normalizeNewsSource(this.settings?.newsSource) !== fetchSource
            ) {
                return;
            }

            // Save only non-hidden articles to IndexedDB; hidden rows stay available in memory for this session.
            const newsItemsForCache = this.buildNewsCacheRecordsForSource(fetchSource, newsItems);
            await this.storage.replaceNewsForSource(fetchSource, newsItemsForCache);
            if (
                gen !== this._newsFetchGeneration ||
                this.normalizeNewsSource(this.settings?.newsSource) !== fetchSource
            ) {
                return;
            }

            // Update state
            this._filterCache.clear();
            this.newsItems = this.applyArticleFlags(newsItems);
            this._loadedNewsSource = fetchSource;
            this.selectedArticleIds = new Set(
                [...this.selectedArticleIds].filter((id) => this.newsItems.some((n) => n && n.id === id))
            );
            this.renderCategoryFilters(this.newsItems);
            this.ensureDefaultCategorySelectionForSource();

            const newlyDetectedItems = [];
            if (hadPrevious) {
                for (const item of newsItems) {
                    if (this.isArticleHiddenByUser(item)) {
                        continue;
                    }
                    const u = App.canonicalArticleUrl(item.url || item.link || '');
                    if (u && !prevUrls.has(u)) {
                        newlyDetectedItems.push(item);
                    }
                }
            }
            if (newlyDetectedItems.length > 0) {
                this.mergePendingNewArticlesForSource(fetchSource, newlyDetectedItems);
            } else if (!this.hasPendingNewArticleSourceEntry(fetchSource)) {
                this.mergePendingNewArticlesForSource(fetchSource, newsItemsForCache);
            }
            this.syncVisibleNewArticleIdsFromPending(fetchSource, this.newsItems);

            await this.applySortPipeline({ render: true });
            if (
                gen !== this._newsFetchGeneration ||
                this.normalizeNewsSource(this.settings?.newsSource) !== fetchSource
            ) {
                return;
            }

            // Update status bar
            const lastUpdate = new Date().toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit'
            });
            this.elements.lastUpdate.textContent = `Letzte Aktualisierung: ${lastUpdate}`;

            // Show status message
            if (!suppressStatus) {
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
            }

            if (this.newsItems.length > 0 && !suppressAutoSummarize) {
                void this.autoSummarizeAfterRefresh(forceRefresh);
            }

            return {
                ok: true,
                source: fetchSource,
                items: Array.isArray(this.newsItems) ? [...this.newsItems] : [],
                usedCache: false
            };

        } catch (error) {
            console.error('Error fetching news:', error);
            if (
                gen !== this._newsFetchGeneration ||
                this.normalizeNewsSource(this.settings?.newsSource) !== fetchSource
            ) {
                return;
            }
            if (!suppressStatus) {
                this.showStatus('Fehler beim Laden der Nachrichten', true);
            }

            // Try to load from cache
            await this.loadCachedNews({ suppressStatus });
            return {
                ok: false,
                source: fetchSource,
                items: Array.isArray(this.newsItems) ? [...this.newsItems] : [],
                usedCache: true,
                error
            };
        }
    }

    async loadCachedNews(options = {}) {
        const suppressStatus = options && options.suppressStatus === true;
        try {
            const cachedNews = await this.storage.getAllNews();
            const currentSource = this.normalizeNewsSource(this.settings?.newsSource);
            const forCurrentSource = (cachedNews || []).filter(
                (a) => App.normalizeStoredNewsSourceId(a && a.newsSource) === currentSource
            );
            const filteredCached = NewsScraper.filterOutAdvertorialItems(forCurrentSource);

            if (filteredCached.length > 0) {
                this._filterCache.clear();
                this.newsItems = this.applyArticleFlags(filteredCached);
                this._loadedNewsSource = currentSource;
                if (!this.hasPendingNewArticleSourceEntry(currentSource)) {
                    this.mergePendingNewArticlesForSource(currentSource, this.newsItems);
                }
                this.syncVisibleNewArticleIdsFromPending(currentSource, this.newsItems);
                this.selectedArticleIds = new Set(
                    [...this.selectedArticleIds].filter((id) => this.newsItems.some((n) => n && n.id === id))
                );
                this.renderCategoryFilters(this.newsItems);
                this.ensureDefaultCategorySelectionForSource();
                await this.applySortPipeline({ render: true });

                const lastUpdate = new Date().toLocaleTimeString('de-DE', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                this.elements.lastUpdate.textContent = `Letzte Aktualisierung: ${lastUpdate}`;

                if (!suppressStatus) {
                    this.showStatus('Geladene aus dem Cache (keine Netzwerkverbindung)');
                }
            } else {
                this.filteredNewsItems = [];
                this._loadedNewsSource = '';
                this.currentPage = 1;
                this.renderCategoryFilters([]);
                this.renderNews([], false);
                this.syncLoadMoreAndCount();
                if (!suppressStatus) {
                    this.showStatus('Keine cacheden Nachrichten verfügbar', true);
                }
            }
        } catch (error) {
            console.error('Error loading cached news:', error);
            this.renderCategoryFilters([]);
            this.renderNews([], false);
        }
    }

    /**
     * Build known article URL sets per source from cached rows.
     * @param {Array<Record<string, unknown>>} rows
     * @returns {Map<string, Set<string>>}
     */
    buildKnownArticleUrlSetsBySource(rows) {
        /** @type {Map<string, Set<string>>} */
        const out = new Map();
        (Array.isArray(rows) ? rows : []).forEach((row) => {
            const sourceId = App.normalizeStoredNewsSourceId(row && row.newsSource);
            const url = App.canonicalArticleUrl(row && (row.url || row.link || ''));
            if (!sourceId || !url) {
                return;
            }
            if (!out.has(sourceId)) {
                out.set(sourceId, new Set());
            }
            out.get(sourceId).add(url);
        });
        return out;
    }

    /**
     * Build article counts per source from cached rows.
     * @param {Array<Record<string, unknown>>} rows
     * @param {{ period?: string, start?: number, end?: number }|null} [periodRange]
     * @returns {Map<string, number>}
     */
    buildArticleCountsBySource(rows, periodRange = null) {
        /** @type {Map<string, number>} */
        const out = new Map();
        (Array.isArray(rows) ? rows : []).forEach((row) => {
            const sourceId = App.normalizeStoredNewsSourceId(row && row.newsSource);
            if (!sourceId) {
                return;
            }
            if (periodRange && !App.isNewsItemInGenerationPeriod(row, periodRange)) {
                return;
            }
            out.set(sourceId, (out.get(sourceId) || 0) + 1);
        });
        return out;
    }

    /**
     * @param {string[]} sourceIds
     * @param {Map<string, number>} countsBySource
     * @returns {number}
     */
    sumEstimatedArticlesForSources(sourceIds, countsBySource) {
        return (Array.isArray(sourceIds) ? sourceIds : []).reduce((sum, sourceId) => {
            const normalized = this.normalizeNewsSource(sourceId);
            if (!normalized) {
                return sum;
            }
            const count = countsBySource instanceof Map ? countsBySource.get(normalized) : 0;
            return sum + (Number.isFinite(count) && count > 0 ? count : 0);
        }, 0);
    }

    /**
     * Wait briefly until current visible auto-summary work has drained, to avoid overloading the KI backend.
     * @param {number} [maxWaitMs]
     * @returns {Promise<void>}
     */
    async waitForVisibleAutoSummariesToSettle(maxWaitMs = 120000) {
        const startedAt = Date.now();
        while (
            (this._autoSummarizeNewInProgress || this._summarizeAllInProgress) &&
            Date.now() - startedAt < maxWaitMs
        ) {
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
    }

    /**
     * Fetch one source without switching the UI source and store it in IndexedDB.
     * @param {string} sourceId
     * @param {{ forceRefresh?: boolean }} [options]
     * @returns {Promise<Array<Record<string, unknown>>>}
     */
    async fetchSourceArticlesForGeneration(sourceId, options = {}) {
        const source = this.normalizeNewsSource(sourceId);
        if (!source) {
            return [];
        }

        const scraper = new NewsScraper();
        scraper.configureSource(source);
        if (options && options.forceRefresh === true) {
            await scraper.clearCache();
        }

        let newsItems = await scraper.fetchNews();
        newsItems = NewsScraper.filterOutAdvertorialItems(newsItems).map((item) => ({
            ...item,
            newsSource: source
        }));

        if (
            newsItems.length === 0 ||
            newsItems.every((item) => App.isOfflineDemoNewsItem(item))
        ) {
            throw new Error(`offline-demo-or-empty:${source}`);
        }

        await this.storage.replaceNewsForSource(
            source,
            this.buildNewsCacheRecordsForSource(source, newsItems)
        );
        return this.applyArticleFlags(newsItems);
    }

    /**
     * Fetch one source without switching the UI source and return newly discovered articles.
     * @param {string} sourceId
     * @param {Set<string>} knownUrls
     * @returns {Promise<Array<Record<string, unknown>>>}
     */
    async refreshBackgroundSource(sourceId, knownUrls) {
        const source = this.normalizeNewsSource(sourceId);
        if (!source) {
            return [];
        }

        let newsItems = [];
        try {
            newsItems = await this.fetchSourceArticlesForGeneration(source, { forceRefresh: true });
        } catch (error) {
            console.warn(`Background refresh skipped source ${source}:`, error);
            return [];
        }

        const seen = knownUrls instanceof Set ? knownUrls : new Set();
        const newItems = newsItems.filter((item) => {
            if (this.isArticleHiddenByUser(item)) {
                return false;
            }
            const url = App.canonicalArticleUrl(item && (item.url || item.link || ''));
            return !!(url && !seen.has(url));
        });

        console.info(
            'Background refresh source=%s articles=%d new=%d',
            source,
            newsItems.length,
            newItems.length
        );
        return newItems;
    }

    /**
     * Prewarm KI summaries, alternative links and Reddit cache for new background articles.
     * @param {Array<Record<string, unknown>>} items
     * @param {{ shouldCancel?: () => boolean, updateVisibleCards?: boolean, onProgress?: (done: number, total: number) => void }} [options]
     * @returns {Promise<boolean>}
     */
    async prewarmBackgroundArtifactsForArticles(items, options = {}) {
        const queue = (Array.isArray(items) ? items : []).filter((item) => App.articlePrimaryUrl(item));
        if (queue.length === 0) {
            return true;
        }
        const limit = App.normalizeSummaryConcurrency(this.settings?.summaryConcurrency);
        const shouldCancel =
            options && typeof options.shouldCancel === 'function' ? options.shouldCancel : () => false;
        const updateVisibleCards = options && options.updateVisibleCards === true;
        const onProgress =
            options && typeof options.onProgress === 'function' ? options.onProgress : null;
        let canceled = false;
        let done = 0;
        await App.runWithConcurrency(queue, limit, async (item) => {
            if (shouldCancel()) {
                canceled = true;
                return;
            }
            const url = App.articlePrimaryUrl(item);
            if (!url) {
                return;
            }

            try {
                const summary = await this.summarizer.generateSummary(
                    url,
                    String(item.title || ''),
                    String(item.description || ''),
                    { forceRefresh: false }
                );
                const isFail = App.isAiFailureMessage(summary);
                const trimmed =
                    summary && typeof summary === 'object' && typeof summary.summary === 'string'
                        ? summary.summary.trim()
                        : '';
                if (updateVisibleCards) {
                    if (isFail || !trimmed) {
                        this._updateCardSummaryIfVisible(
                            item.id,
                            isFail ? summary : 'Zusammenfassung leer — bitte „Neu erstellen“.',
                            true
                        );
                    } else {
                        this._updateCardSummaryIfVisible(item.id, summary, false);
                    }
                }
            } catch (e) {
                console.warn('background summary prewarm:', url, e);
                if (updateVisibleCards) {
                    this._updateCardSummaryIfVisible(
                        item.id,
                        `Zusammenfassung nicht möglich: ${e.message || String(e)}`,
                        true
                    );
                }
            }

            if (shouldCancel()) {
                canceled = true;
                return;
            }

            try {
                await this.prefetchRedditThreadsForItem(item);
            } catch (e) {
                console.warn('background reddit prewarm:', url, e);
            }

            if (shouldCancel()) {
                canceled = true;
                return;
            }

            try {
                await this.prefetchYoutubeRelatedForItem(item);
            } catch (e) {
                console.warn('background youtube prewarm:', url, e);
            }

            done += 1;
            if (onProgress) {
                onProgress(done, queue.length);
            }
            await App.yieldForUiCooperation();
        });
        return canceled === false;
    }

    /**
     * Load Reddit threads for one article without requiring a visible card in the DOM.
     * @param {Record<string, unknown>} item
     * @returns {Promise<void>}
     */
    async prefetchRedditThreadsForItem(item) {
        // Reddit aggressively blocks automated background fetches (HTTP 403), so only
        // prewarm forum entries when the user opted into automatic discovery. In the
        // default "click" mode the Reddit search stays strictly manual — triggered by
        // the card's Reddit button (searchRedditForArticle).
        if (!this.shouldAutoGenerateForumEntries()) {
            return;
        }
        const title = item && item.title ? String(item.title).trim() : '';
        const articleKey = App.articleFlagKey(item);
        if (!title || !articleKey) {
            return;
        }
        if (typeof window === 'undefined' || !window.location || window.location.protocol === 'file:') {
            return;
        }
        const origin = window.location.origin;
        if (origin === 'null' || String(origin).startsWith('file')) {
            return;
        }

        // Cache-first: in "always" mode the cache is populated once and then reused, so
        // we do not re-query Reddit on every background refresh (Reddit blocks repeated
        // automated fetches with HTTP 403). A fresh cached entry skips the live query
        // entirely — the user can still force a fresh search via the card's Reddit button.
        if (this.storage && this.storage.db) {
            try {
                const cached = await this.storage.getRedditThreadsWithMeta(articleKey);
                if (cached && Array.isArray(cached.threads) && cached.threads.length > 0) {
                    const maxAgeMs = this.summarizer
                        ? this.summarizer.getSummaryCacheMaxAgeMs()
                        : Infinity;
                    const cachedAtMs = new Date(cached.cachedAt || 0).getTime();
                    if (maxAgeMs === Infinity || Date.now() - cachedAtMs <= maxAgeMs) {
                        return;
                    }
                }
            } catch (_) {
                /* fall through to a live fetch if the cache read fails */
            }
        }

        const query = await this.resolveRedditQuery(item, null);
        if (!query) {
            return;
        }

        const reasoningConfig = this.getSupportedReasoningConfigForCurrentModel();
        const params = new URLSearchParams({ q: query, limit: '5', ai: '1' });
        if (reasoningConfig.enabled) {
            params.set('reasoning', reasoningConfig.level);
        }

        const response = await fetch(`${origin}/api/reddit-search?${params}`, {
            method: 'GET',
            cache: 'no-store',
            credentials: 'same-origin'
        });
        const data = await response.json();
        if (!data || data.ok !== true || !Array.isArray(data.results) || data.results.length === 0) {
            return;
        }

        const relevantResults = await this.filterRedditThreadsByAiRelevance(item, null, data.results);
        if (relevantResults.length === 0) {
            return;
        }

        const aiQueries = Array.isArray(data.ai_queries) ? data.ai_queries : [];
        if (this.storage && this.storage.db) {
            await this.storage.saveRedditThreads(articleKey, relevantResults, aiQueries);
        }
    }

    /**
     * Generate and cache KI YouTube search suggestions for one article without requiring
     * a visible card — the background equivalent of opening the YouTube modal. Only runs
     * when the user enabled automatic YouTube discovery ("always"); otherwise suggestions
     * stay on-demand (generated when the user opens the modal). Cache-first: a fresh cached
     * entry is reused so the KI is not queried again unnecessarily.
     * @param {Record<string, unknown>} item
     * @returns {Promise<void>}
     */
    async prefetchYoutubeRelatedForItem(item) {
        if (!this.shouldAutoGenerateYoutubeSuggestions()) {
            return;
        }
        if (!this.youtubeRelated || !this.summarizer) {
            return;
        }
        const url = item && (item.url || item.link) ? String(item.url || item.link).trim() : '';
        const title = item && item.title ? String(item.title).trim() : '';
        if (!url || !title) {
            return;
        }
        const ctx = {
            url,
            title,
            description: item && item.description ? String(item.description) : ''
        };

        // Cache-first: reuse a fresh cached entry (getCached already applies the
        // summary-cache TTL) instead of re-running the KI on every background refresh.
        try {
            const cached = await this.youtubeRelated.getCached(ctx);
            if (cached && Array.isArray(cached.items) && cached.items.length > 0) {
                return;
            }
        } catch (_) {
            /* fall through to generate fresh suggestions */
        }

        const result = await this.youtubeRelated.fetchAndSummarize(ctx);
        const items = result && Array.isArray(result.items) ? result.items : [];
        if (items.length > 0) {
            await this.youtubeRelated.save(ctx, items, result.searchQueryUsed || null);
        }
    }

    /**
     * Auto-discovery ("always" mode) for a visible card: render cached Reddit threads if a
     * fresh entry exists (the card hydrates from cache, no network), otherwise run a single
     * live search. This keeps automatic discovery cache-first — only the card's Reddit button
     * (searchRedditForArticle) forces a fresh re-query.
     * @param {Record<string, unknown>} item
     * @returns {Promise<void>}
     */
    async maybeAutoSearchRedditForVisibleCard(item) {
        try {
            const articleKey = App.articleFlagKey(item);
            if (articleKey && this.storage && this.storage.db) {
                const cached = await this.storage.getRedditThreadsWithMeta(articleKey);
                if (cached && Array.isArray(cached.threads) && cached.threads.length > 0) {
                    const maxAgeMs = this.summarizer
                        ? this.summarizer.getSummaryCacheMaxAgeMs()
                        : Infinity;
                    const cachedAtMs = new Date(cached.cachedAt || 0).getTime();
                    if (maxAgeMs === Infinity || Date.now() - cachedAtMs <= maxAgeMs) {
                        return;
                    }
                }
            }
        } catch (_) {
            /* fall through to a live search */
        }
        await this.searchRedditForArticle(item.id);
    }

    /**
     * Run a background-refresh task under a browser-wide lock so only one tab executes it at a time.
     * Falls back to running directly when the Web Locks API is unavailable (e.g. file: protocol).
     * @param {() => Promise<void>} fn
     * @returns {Promise<boolean>} true if the task ran in this tab, false if another tab held the lock.
     */
    async runWithBackgroundRefreshLock(fn) {
        if (
            typeof navigator !== 'undefined' &&
            navigator.locks &&
            typeof navigator.locks.request === 'function'
        ) {
            return navigator.locks.request(
                'cucumber-bg-refresh',
                { ifAvailable: true },
                async (lock) => {
                    if (!lock) {
                        console.info('Background refresh skipped: another tab holds the lock.');
                        return false;
                    }
                    await fn();
                    return true;
                }
            );
        }
        await fn();
        return true;
    }

    /**
     * Runs on the header refresh interval. Optionally refreshes all enabled sources in the background.
     * @param {{ skipCurrentSourceRefresh?: boolean }} [options] Pass skipCurrentSourceRefresh for the
     *   immediate on-start / on-enable kick, where the visible source is already loaded and only the
     *   background favorites need prewarming.
     * @returns {Promise<void>}
     */
    async runScheduledAutoUpdate(options = {}) {
        const skipCurrentSourceRefresh = options && options.skipCurrentSourceRefresh === true;
        if (this._selectedSourcesGenerationInProgress) {
            console.info('Scheduled auto-update skipped because selected-source generation is active.');
            return;
        }
        if (this._scheduledAutoUpdateInProgress) {
            console.info('Scheduled auto-update skipped because the previous run is still active.');
            return;
        }
        this._scheduledAutoUpdateInProgress = true;

        try {
            if (!this.isBackgroundSelectedSourcesRefreshEnabled()) {
                if (!skipCurrentSourceRefresh) {
                    await this.fetchNews(true);
                }
                return;
            }

            const currentSource = this.normalizeNewsSource(this.settings?.newsSource);
            if (!skipCurrentSourceRefresh) {
                await this.fetchNews(true);
            }
            await this.waitForVisibleAutoSummariesToSettle();

            // The expensive multi-source prewarm runs in only one tab per browser (Web Locks);
            // the current-source refresh above stays per-tab so every tab keeps its visible list fresh.
            await this.runWithBackgroundRefreshLock(async () => {
                const cachedNews = await this.storage.getAllNews();
                const knownUrlsBySource = this.buildKnownArticleUrlSetsBySource(cachedNews);
                const backgroundSources = this.getBackgroundRefreshSourceIds().filter(
                    (id) => id !== currentSource
                );

                for (const sourceId of backgroundSources) {
                    try {
                        const newItems = await this.refreshBackgroundSource(
                            sourceId,
                            knownUrlsBySource.get(sourceId) || new Set()
                        );
                        this.mergePendingNewArticlesForSource(sourceId, newItems);
                        await this.prewarmBackgroundArtifactsForArticles(newItems);
                    } catch (e) {
                        console.warn(`Background refresh failed for source ${sourceId}:`, e);
                    }
                }
            });
        } finally {
            this._scheduledAutoUpdateInProgress = false;
        }
    }

    /**
     * Fetch and fully prewarm every enabled source from the settings dialog.
     * @param {string[]} sourceIds
     * @param {{ period?: string, periodRange?: { period?: string, start?: number, end?: number } }} [options]
     * @returns {Promise<void>}
     */
    async runSelectedSourcesGeneration(sourceIds, options = {}) {
        const period = App.normalizeSelectedSourcesGenerationPeriod(options.period);
        const periodRange =
            options.periodRange || this.getSelectedSourcesGenerationPeriodRange(period);
        const currentSource = this.normalizeNewsSource(this.settings?.newsSource);
        const ordered = this.getOrderedSelectedSourcesForGeneration(sourceIds);

        if (ordered.length === 0) {
            this.showStatus(this._i18nDashboardNeedOne || 'Mindestens eine Newsquelle muss aktiviert sein.', true);
            return;
        }

        const cachedNews = await this.storage.getAllNews();
        const articleCountsBySource = this.buildArticleCountsBySource(cachedNews, periodRange);
        const initialEstimatedArticles = this.sumEstimatedArticlesForSources(
            ordered,
            articleCountsBySource
        );

        this._selectedSourcesGenerationInProgress = true;
        this._selectedSourcesGenerationCancelRequested = false;
        this.setSelectedSourcesGenerationState({
            phase: 'preparing',
            currentSourceId: '',
            totalSources: ordered.length,
            completedSources: 0,
            remainingSources: ordered.length,
            failedSources: 0,
            currentSourceTotalArticles: 0,
            currentSourceCompletedArticles: 0,
            estimatedRemainingArticles: initialEstimatedArticles
        });
        this.openSelectedSourcesGenerationModal();

        let completed = 0;
        let failedSources = 0;
        let cancelled = false;

        try {
            for (const sourceId of ordered) {
                const remainingAfterCurrent = Math.max(ordered.length - completed - 1, 0);
                const remainingSourceIds = ordered.slice(completed);
                const estimatedArticlesBeforeFetch = this.sumEstimatedArticlesForSources(
                    remainingSourceIds,
                    articleCountsBySource
                );
                this.setSelectedSourcesGenerationState({
                    phase: this._selectedSourcesGenerationCancelRequested ? 'cancel_requested' : 'fetching',
                    currentSourceId: sourceId,
                    completedSources: completed,
                    remainingSources: remainingAfterCurrent,
                    failedSources,
                    currentSourceTotalArticles:
                        articleCountsBySource.get(sourceId) || 0,
                    currentSourceCompletedArticles: 0,
                    estimatedRemainingArticles: estimatedArticlesBeforeFetch
                });

                if (this._selectedSourcesGenerationCancelRequested) {
                    cancelled = true;
                    break;
                }

                let items = [];
                let itemsForGeneration = [];
                try {
                    if (sourceId === currentSource) {
                        const result = await this.fetchNews(true, {
                            suppressStatus: true,
                            suppressAutoSummarize: true
                        });
                        items =
                            result && Array.isArray(result.items)
                                ? result.items
                                : [];
                        const hasOfflineDemo =
                            items.length > 0 &&
                            items.every((item) => App.isOfflineDemoNewsItem(item));
                        if (!result || result.ok !== true || hasOfflineDemo) {
                            throw result && result.error ? result.error : new Error(`fetch-failed:${sourceId}`);
                        }
                    } else {
                        items = await this.fetchSourceArticlesForGeneration(sourceId, {
                            forceRefresh: true
                        });
                    }
                    itemsForGeneration =
                        this.filterNewsItemsForSelectedSourcesGenerationPeriod(items, periodRange);
                    articleCountsBySource.set(sourceId, itemsForGeneration.length);
                } catch (error) {
                    failedSources += 1;
                    console.warn(`Selected sources generation fetch failed for ${sourceId}:`, error);
                    articleCountsBySource.set(sourceId, 0);
                    completed += 1;
                    this.setSelectedSourcesGenerationState({
                        phase: this._selectedSourcesGenerationCancelRequested ? 'cancel_requested' : 'fetching',
                        currentSourceId: sourceId,
                        completedSources: completed,
                        remainingSources: Math.max(ordered.length - completed, 0),
                        failedSources,
                        currentSourceTotalArticles: 0,
                        currentSourceCompletedArticles: 0,
                        estimatedRemainingArticles: this.sumEstimatedArticlesForSources(
                            ordered.slice(completed),
                            articleCountsBySource
                        )
                    });
                    if (this._selectedSourcesGenerationCancelRequested) {
                        cancelled = true;
                        break;
                    }
                    continue;
                }

                this.setSelectedSourcesGenerationState({
                    phase: this._selectedSourcesGenerationCancelRequested ? 'cancel_requested' : 'generating',
                    currentSourceId: sourceId,
                    completedSources: completed,
                    remainingSources: remainingAfterCurrent,
                    failedSources,
                    currentSourceTotalArticles: itemsForGeneration.length,
                    currentSourceCompletedArticles: 0,
                    estimatedRemainingArticles:
                        itemsForGeneration.length +
                        this.sumEstimatedArticlesForSources(
                            ordered.slice(completed + 1),
                            articleCountsBySource
                        )
                });

                const finishedSource = await this.prewarmBackgroundArtifactsForArticles(itemsForGeneration, {
                    shouldCancel: () => this._selectedSourcesGenerationCancelRequested,
                    updateVisibleCards: sourceId === currentSource,
                    onProgress: (doneArticles, totalArticles) => {
                        this.setSelectedSourcesGenerationState({
                            phase: this._selectedSourcesGenerationCancelRequested
                                ? 'cancel_requested'
                                : 'generating',
                            currentSourceId: sourceId,
                            completedSources: completed,
                            remainingSources: remainingAfterCurrent,
                            failedSources,
                            currentSourceTotalArticles: totalArticles,
                            currentSourceCompletedArticles: doneArticles,
                            estimatedRemainingArticles:
                                Math.max(totalArticles - doneArticles, 0) +
                                this.sumEstimatedArticlesForSources(
                                    ordered.slice(completed + 1),
                                    articleCountsBySource
                                )
                        });
                    }
                });

                if (!finishedSource && this._selectedSourcesGenerationCancelRequested) {
                    cancelled = true;
                    break;
                }

                completed += 1;
                this.setSelectedSourcesGenerationState({
                    phase: 'generating',
                    currentSourceId: sourceId,
                    completedSources: completed,
                    remainingSources: Math.max(ordered.length - completed, 0),
                    failedSources,
                    currentSourceTotalArticles: itemsForGeneration.length,
                    currentSourceCompletedArticles: itemsForGeneration.length,
                    estimatedRemainingArticles: this.sumEstimatedArticlesForSources(
                        ordered.slice(completed),
                        articleCountsBySource
                    )
                });
            }
        } finally {
            this._selectedSourcesGenerationInProgress = false;
            cancelled = cancelled || this._selectedSourcesGenerationCancelRequested;
            this._selectedSourcesGenerationCancelRequested = false;
            this.setSelectedSourcesGenerationState({
                phase: cancelled ? 'cancelled' : 'done',
                currentSourceId: cancelled
                    ? this._selectedSourcesGenerationState.currentSourceId || ''
                    : '',
                completedSources: completed,
                remainingSources: Math.max(ordered.length - completed, 0),
                failedSources,
                currentSourceTotalArticles: 0,
                currentSourceCompletedArticles: 0,
                estimatedRemainingArticles: 0
            });
        }

        if (cancelled) {
            this.showStatus(
                this._i18nSelectedSourcesGenerationStatusCancelled || 'Vorgang abgebrochen.',
                false
            );
            return;
        }

        if (failedSources > 0) {
            this.showStatus(
                (
                    this._i18nSelectedSourcesGenerationStatusDoneWithFailures ||
                    'Vorgang abgeschlossen — {count} Quelle(n) konnten nicht verarbeitet werden.'
                ).replace(/\{count\}/g, String(failedSources)),
                false
            );
            return;
        }

        this.showStatus(
            this._i18nSelectedSourcesGenerationStatusDone || 'Vorgang abgeschlossen.'
        );
    }

    loadMoreNews() {
        this.updateItemsPerPageForGrid();
        const startIndex = this.getRenderedNewsCards().length;
        const endIndex = startIndex + this.itemsPerPage;
        const newsToShow = this.filteredNewsItems.slice(startIndex, endIndex);

        if (newsToShow.length === 0) {
            this.syncLoadMoreAndCount();
            return;
        }

        void this.renderNews(newsToShow, true);
        this.currentPage = Math.max(1, Math.ceil((startIndex + newsToShow.length) / this.itemsPerPage));
        this.syncLoadMoreAndCount();
    }

    /** Appends all remaining filtered articles in one step (same as repeated „Mehr laden“ until done). */
    showAllNews() {
        const n = this.filteredNewsItems.length;
        this.updateItemsPerPageForGrid();
        const startIndex = this.getRenderedNewsCards().length;
        if (startIndex >= n) {
            this.syncLoadMoreAndCount();
            return;
        }
        const rest = this.filteredNewsItems.slice(startIndex);
        void this.renderNews(rest, true);
        this.currentPage = Math.max(1, Math.ceil(n / this.itemsPerPage));
        this.syncLoadMoreAndCount();
    }

    /**
     * @param {Array} items
     * @param {boolean} append - true only for "Mehr laden"; false replaces the grid (avoids stacking on skeleton cards)
     */
    async renderNews(items, append = false) {
        this.clearNewsCardDragState();
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

        // Attach event delegation handler for all card buttons
        if (this._newsCardClickHandler && this.elements.newsGrid) {
            this.elements.newsGrid.addEventListener('click', this._newsCardClickHandler);
            this._newsCardClickHandler = null; // Handler now attached
        }

        try {
            await this.hydrateCachedSummariesForItems(items);
        } catch (e) {
            console.warn('hydrateCachedSummariesForItems (renderNews):', e);
        }

        if (typeof HeiseComments !== 'undefined' && this.elements.newsGrid) {
            void HeiseComments.hydrate(this.elements.newsGrid);
        }

        this.attachThumbnailImageFallbacks();
        this.attachNewArticleHoverHandlers();
        this.scheduleArticleInPlaceTranslation();
    }

    /** @returns {HTMLElement[]} */
    getRenderedNewsCards() {
        if (!this.elements.newsGrid) {
            return [];
        }
        return Array.from(this.elements.newsGrid.querySelectorAll('.news-card[data-id]'));
    }

    /**
     * @param {string} articleId
     * @returns {HTMLElement | null}
     */
    findRenderedNewsCardById(articleId) {
        if (!articleId) {
            return null;
        }
        return this.getRenderedNewsCards().find((card) => card.dataset.id === articleId) || null;
    }

    clearNewsCardDragState() {
        this.getRenderedNewsCards().forEach((card) => {
            card.classList.remove('news-card--dragging', 'news-card--drop-before', 'news-card--drop-after');
        });
        this._draggedNewsCardId = '';
        this._dragNewsDropTargetId = '';
        this._dragNewsDropPosition = 'before';
    }

    /** @returns {number} */
    getNewsGridColumnCount() {
        if (!this.elements.newsGrid || typeof window === 'undefined') {
            return 1;
        }
        const cols = window
            .getComputedStyle(this.elements.newsGrid)
            .gridTemplateColumns
            .split(/\s+/)
            .filter(Boolean);
        return Math.max(1, cols.length);
    }

    /** @returns {number} */
    updateItemsPerPageForGrid() {
        const base = Math.max(1, Number(this.baseItemsPerPage) || 9);
        const columns = this.getNewsGridColumnCount();
        const next = Math.max(base, columns);
        this.itemsPerPage = next;
        return next;
    }

    scheduleNewsGridCapacitySync() {
        if (typeof window === 'undefined') {
            return;
        }
        if (this._newsGridResizeTimer) {
            clearTimeout(this._newsGridResizeTimer);
        }
        this._newsGridResizeTimer = setTimeout(() => {
            this._newsGridResizeTimer = 0;
            void this.syncRenderedNewsCapacity();
        }, 120);
    }

    async syncRenderedNewsCapacity() {
        if (!Array.isArray(this.filteredNewsItems) || this.filteredNewsItems.length === 0) {
            this.updateItemsPerPageForGrid();
            this.syncLoadMoreAndCount();
            return;
        }
        this.updateItemsPerPageForGrid();
        const renderedCount = this.getRenderedNewsCards().length;
        const targetCount = Math.min(
            this.filteredNewsItems.length,
            Math.max(renderedCount, this.itemsPerPage * Math.max(1, this.currentPage))
        );
        if (targetCount > renderedCount) {
            await this.renderNews(this.filteredNewsItems.slice(renderedCount, targetCount), true);
        }
        this.currentPage = Math.max(1, Math.ceil(targetCount / this.itemsPerPage));
        this.syncLoadMoreAndCount();
    }

    /**
     * @param {HTMLElement} card
     * @param {DragEvent} event
     * @returns {'before'|'after'}
     */
    getNewsCardDropPosition(card, event) {
        const rect = card.getBoundingClientRect();
        const clientX = Number(event.clientX);
        const clientY = Number(event.clientY);
        if (this.getNewsGridColumnCount() > 1) {
            const xRatio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0.5;
            const yRatio = rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5;
            const xDist = Math.abs(xRatio - 0.5);
            const yDist = Math.abs(yRatio - 0.5);
            if (yDist > xDist + 0.08) {
                return yRatio >= 0.5 ? 'after' : 'before';
            }
            return xRatio >= 0.5 ? 'after' : 'before';
        }
        return clientY >= rect.top + rect.height / 2 ? 'after' : 'before';
    }

    /**
     * @param {HTMLElement | null} card
     * @param {'before'|'after'} position
     */
    markNewsCardDropTarget(card, position) {
        this.getRenderedNewsCards().forEach((entry) => {
            entry.classList.remove('news-card--drop-before', 'news-card--drop-after');
        });
        if (!card) {
            this._dragNewsDropTargetId = '';
            this._dragNewsDropPosition = 'before';
            return;
        }
        card.classList.add(position === 'after' ? 'news-card--drop-after' : 'news-card--drop-before');
        this._dragNewsDropTargetId = String(card.dataset.id || '').trim();
        this._dragNewsDropPosition = position;
    }

    syncManualCardOrderFromGrid() {
        const visibleCards = this.getRenderedNewsCards();
        if (visibleCards.length === 0 || !Array.isArray(this.filteredNewsItems) || this.filteredNewsItems.length === 0) {
            return;
        }
        const visibleIds = visibleCards
            .map((card) => String(card.dataset.id || '').trim())
            .filter(Boolean);
        if (visibleIds.length === 0) {
            return;
        }
        const byId = new Map();
        this.filteredNewsItems.forEach((item) => {
            const id = String(item && item.id ? item.id : '').trim();
            if (!id) {
                return;
            }
            byId.set(id, item);
        });
        const visibleSet = new Set(visibleIds);
        const reorderedVisible = visibleIds
            .map((id) => byId.get(id))
            .filter(Boolean);
        const rest = this.filteredNewsItems.filter((item) => !visibleSet.has(String(item && item.id ? item.id : '').trim()));
        this.filteredNewsItems = [...reorderedVisible, ...rest];
        this.setManualCardOrderForCurrentView(
            this.filteredNewsItems
                .map((item) => String(item && item.id ? item.id : '').trim())
                .filter(Boolean)
        );
    }

    /**
     * @param {string} draggedId
     * @param {string} targetId
     * @param {'before'|'after'} position
     */
    reorderRenderedNewsCards(draggedId, targetId, position) {
        if (!draggedId || !targetId || draggedId === targetId) {
            return;
        }
        const draggedCard = this.findRenderedNewsCardById(draggedId);
        const targetCard = this.findRenderedNewsCardById(targetId);
        if (!draggedCard || !targetCard || draggedCard === targetCard) {
            return;
        }
        if (position === 'after') {
            targetCard.insertAdjacentElement('afterend', draggedCard);
        } else {
            targetCard.insertAdjacentElement('beforebegin', draggedCard);
        }
        this.syncManualCardOrderFromGrid();
    }

    /**
     * @param {DragEvent} event
     */
    handleNewsCardDragStart(event) {
        const handle = event.target && event.target.closest
            ? event.target.closest('.news-card-drag-handle')
            : null;
        if (!handle) {
            return;
        }
        const card = handle.closest('.news-card[data-id]');
        const articleId = card && card.dataset ? String(card.dataset.id || '').trim() : '';
        if (!card || !articleId) {
            return;
        }
        this._draggedNewsCardId = articleId;
        this._dragNewsDropTargetId = '';
        this._dragNewsDropPosition = 'before';
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            try {
                event.dataTransfer.setData('text/plain', articleId);
            } catch (_) {
                /* ignore */
            }
        }
        window.requestAnimationFrame(() => {
            card.classList.add('news-card--dragging');
        });
    }

    /**
     * @param {DragEvent} event
     */
    handleNewsCardDragOver(event) {
        if (!this._draggedNewsCardId) {
            return;
        }
        event.preventDefault();
        let targetCard = event.target && event.target.closest
            ? event.target.closest('.news-card[data-id]')
            : null;
        if (!targetCard) {
            const renderedCards = this.getRenderedNewsCards();
            targetCard = renderedCards[renderedCards.length - 1] || null;
        }
        if (!targetCard) {
            this.markNewsCardDropTarget(null, 'before');
            return;
        }
        if (String(targetCard.dataset.id || '').trim() === this._draggedNewsCardId) {
            this.markNewsCardDropTarget(null, 'before');
            return;
        }
        const position = this.getNewsCardDropPosition(targetCard, event);
        this.markNewsCardDropTarget(targetCard, position);
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
    }

    /**
     * @param {DragEvent} event
     */
    handleNewsCardDrop(event) {
        if (!this._draggedNewsCardId) {
            return;
        }
        event.preventDefault();
        let targetId = this._dragNewsDropTargetId;
        let position = this._dragNewsDropPosition === 'after' ? 'after' : 'before';

        const hoveredCard = event.target && event.target.closest
            ? event.target.closest('.news-card[data-id]')
            : null;
        if (hoveredCard && hoveredCard.dataset) {
            const hoveredId = String(hoveredCard.dataset.id || '').trim();
            if (hoveredId && hoveredId !== this._draggedNewsCardId) {
                targetId = hoveredId;
                position = this.getNewsCardDropPosition(hoveredCard, event);
            }
        }

        if (!targetId || targetId === this._draggedNewsCardId) {
            this.clearNewsCardDragState();
            return;
        }

        this.reorderRenderedNewsCards(this._draggedNewsCardId, targetId, position);
        this.clearNewsCardDragState();
    }

    attachThumbnailImageFallbacks() {
        if (!this.elements.newsGrid) {
            return;
        }
        this.elements.newsGrid.querySelectorAll('.news-card-thumbnail img').forEach((img) => {
            if (img.dataset.thumbFallbackBound === '1') {
                return;
            }
            img.dataset.thumbFallbackBound = '1';
            img.addEventListener(
                'error',
                () => {
                    const wrap = img.closest('.news-card-thumbnail-wrap');
                    if (wrap) {
                        wrap.hidden = true;
                    }
                },
                { once: true }
            );
        });
    }

    getArticleDisplayState(item) {
        const readState = this.getArticleReadStateForItem(item);
        if (readState) {
            return readState;
        }
        return this._newArticleIds && item && item.id && this._newArticleIds.has(item.id) ? 'new' : '';
    }

    getArticleStateBadgeLabel(state) {
        if (state === 'read') {
            return this._i18nNewsReadBadge || 'Gelesen';
        }
        if (state === 'seen') {
            return this._i18nNewsSeenBadge || 'Gesehen';
        }
        return this._i18nNewsBadge || 'Neu';
    }

    getArticleStateAriaLabel(state) {
        if (state === 'read') {
            return this._i18nNewsReadAria || 'Artikel gelesen';
        }
        if (state === 'seen') {
            return this._i18nNewsSeenAria || 'Artikel gesehen';
        }
        return this._i18nNewsAria || 'Neuer Artikel seit der letzten Aktualisierung';
    }

    clearArticleSeenHoverTimer(card) {
        if (card && card._newHoverTimer) {
            clearTimeout(card._newHoverTimer);
            card._newHoverTimer = null;
        }
    }

    /**
     * After 3s hover on a "new" card, persist it as "seen".
     */
    attachNewArticleHoverHandlers() {
        if (!this.elements.newsGrid) {
            return;
        }
        this.elements.newsGrid
            .querySelectorAll('.news-card.news-card--state-new, .news-card.news-card--new')
            .forEach((card) => {
                if (card.dataset.newHoverBound === '1') {
                    return;
                }
                card.dataset.newHoverBound = '1';
                const onEnter = () => {
                    if (
                        !card.classList.contains('news-card--state-new') &&
                        !card.classList.contains('news-card--new')
                    ) {
                        return;
                    }
                    this.clearArticleSeenHoverTimer(card);
                    card._newHoverTimer = window.setTimeout(() => {
                        if (
                            card.classList.contains('news-card--state-new') ||
                            card.classList.contains('news-card--new')
                        ) {
                            this.markArticleReadStateFromCard(card, 'seen');
                        }
                    }, ARTICLE_SEEN_HOVER_DELAY_MS);
                };
                const onLeave = () => {
                    this.clearArticleSeenHoverTimer(card);
                };
                card.addEventListener('mouseenter', onEnter);
                card.addEventListener('mouseleave', onLeave);
            });
    }

    removePendingNewStateForItem(item) {
        const id = item && item.id ? String(item.id) : '';
        if (id && this._newArticleIds) {
            this._newArticleIds.delete(id);
        }
        const sourceId =
            App.normalizeStoredNewsSourceId(item && item.newsSource) ||
            this.normalizeNewsSource(this._loadedNewsSource || this.settings?.newsSource);
        const url = App.canonicalArticleUrl(item && (item.url || item.link || ''));
        if (sourceId && url) {
            const pending = this.getPendingNewArticleUrlSetForSource(sourceId);
            if (pending.delete(url)) {
                this.setPendingNewArticleUrlsForSource(sourceId, pending);
            }
        }
    }

    updateArticleReadStateInLists(articleId, readState) {
        const id = String(articleId || '').trim();
        if (!id) {
            return null;
        }
        let updated = null;
        [this.newsItems, this.filteredNewsItems].forEach((list) => {
            (Array.isArray(list) ? list : []).forEach((entry) => {
                if (entry && entry.id === id) {
                    entry.readState = readState;
                    updated = entry;
                }
            });
        });
        return updated;
    }

    applyArticleStateToCard(card, state) {
        if (!card) {
            return;
        }
        const displayState = state === 'new' ? 'new' : App.normalizeArticleReadState(state);
        card.classList.remove(
            'news-card--new',
            'news-card--state-new',
            'news-card--state-seen',
            'news-card--state-read'
        );
        if (displayState) {
            card.classList.add(`news-card--state-${displayState}`);
            if (displayState === 'new') {
                card.classList.add('news-card--new');
            }
            card.dataset.articleState = displayState;
            card.setAttribute('aria-label', this.getArticleStateAriaLabel(displayState));
        } else {
            delete card.dataset.articleState;
            card.removeAttribute('aria-label');
        }

        const readState = App.normalizeArticleReadState(displayState);
        if (readState) {
            card.dataset.articleReadState = readState;
        } else {
            delete card.dataset.articleReadState;
        }

        let badge = card.querySelector('[data-article-state-badge]');
        if (!displayState) {
            if (badge) {
                badge.remove();
            }
            return;
        }
        if (!badge) {
            badge = document.createElement('span');
            badge.setAttribute('data-article-state-badge', '');
            const headerMain = card.querySelector('.news-header-main');
            const selectWrap = headerMain ? headerMain.querySelector('.article-select-wrap') : null;
            if (selectWrap) {
                selectWrap.insertAdjacentElement('afterend', badge);
            } else if (headerMain) {
                headerMain.prepend(badge);
            }
        }
        badge.className = `news-card-state-badge news-card-state-badge--${displayState}`;
        badge.textContent = this.getArticleStateBadgeLabel(displayState);
    }

    markArticleReadStateFromCard(card, readState) {
        const nextState = App.normalizeArticleReadState(readState);
        if (!card || !nextState) {
            return;
        }
        const currentCardState = App.normalizeArticleReadState(card.dataset.articleReadState);
        if (currentCardState === 'read' && nextState === 'seen') {
            return;
        }
        const articleId = card.dataset ? String(card.dataset.id || '').trim() : '';
        if (!articleId) {
            return;
        }
        const resolvedItem = this.resolveNewsItemForSummary(articleId, '') ||
            this.updateArticleReadStateInLists(articleId, nextState);
        if (!resolvedItem) {
            return;
        }
        const currentItemState = this.getArticleReadStateForItem(resolvedItem);
        if (currentItemState === 'read' && nextState === 'seen') {
            return;
        }
        resolvedItem.readState = nextState;
        this.updateArticleReadStateInLists(articleId, nextState);
        this.removePendingNewStateForItem(resolvedItem);
        this.clearArticleSeenHoverTimer(card);
        this.applyArticleStateToCard(card, nextState);
        void this.saveArticleFlagsForItem(resolvedItem, { readState: nextState });
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
                        this.setSummaryToggleButtonState(toggleBtn, 'hide');
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
                                            this.setSummaryToggleButtonState(toggleBtn, 'hide');
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
            this.scheduleArticleInPlaceTranslation();
        } catch (e) {
            console.warn('hydrateCachedSummariesForItems:', e);
        }
    }

    handleNewsGridChange(event) {
        const checkbox = event.target && event.target.closest
            ? event.target.closest('.article-select-checkbox')
            : null;
        if (!checkbox) {
            return;
        }
        const articleId = String(checkbox.getAttribute('data-article-id') || '').trim();
        if (!articleId) {
            return;
        }
        if (checkbox.checked) {
            this.selectedArticleIds.add(articleId);
        } else {
            this.selectedArticleIds.delete(articleId);
        }
        this.updateExportSelectionInfo();
    }

    openExportModal() {
        if (!this.elements.exportModal) {
            return;
        }
        if (this.elements.exportPeriodDate && !this.elements.exportPeriodDate.value) {
            this.elements.exportPeriodDate.value = new Date().toISOString().slice(0, 10);
        }
        this.syncExportScopeUi();
        this.syncExportFormatUi();
        this.updateExportSelectionInfo();
        this.elements.exportModal.classList.add('active');
    }

    closeExportModal() {
        if (this.elements.exportModal) {
            this.elements.exportModal.classList.remove('active');
        }
    }

    syncExportScopeUi() {
        if (!this.elements.exportScope || !this.elements.exportPeriodWrap) {
            return;
        }
        this.elements.exportPeriodWrap.hidden = this.elements.exportScope.value !== 'period';
    }

    syncExportFormatUi() {
        if (!this.elements.exportFormat || !this.elements.exportIncludeThumbnails) {
            return;
        }
        const isPdf = this.elements.exportFormat.value === 'pdf';
        this.elements.exportIncludeThumbnails.checked = isPdf;
        this.elements.exportIncludeThumbnails.disabled = !isPdf;
        const label = this.elements.exportIncludeThumbnails.closest('label');
        if (label) {
            label.style.opacity = isPdf ? '1' : '0.6';
        }
        const labelText = document.getElementById('exportIncludeThumbnailsLabel');
        if (labelText) {
            labelText.textContent = 'Thumbnails (nur PDF, Standard: an)';
        }
    }

    updateExportSelectionInfo() {
        const el = this.elements.exportSelectionInfo;
        if (!el) {
            return;
        }
        const tpl = this._i18nExportSelectionInfo || 'Selected: {selected}, visible: {visible}';
        el.textContent = tpl
            .replace(/\{selected\}/g, String(this.selectedArticleIds.size))
            .replace(/\{visible\}/g, String(this.filteredNewsItems.length));
    }

    static getPeriodBounds(periodType, isoDate) {
        const d = new Date(`${isoDate}T00:00:00`);
        if (!Number.isFinite(d.getTime())) {
            return null;
        }
        if (periodType === 'day') {
            const start = new Date(d);
            const end = new Date(d);
            end.setHours(23, 59, 59, 999);
            return { startMs: start.getTime(), endMs: end.getTime() };
        }
        if (periodType === 'week') {
            const day = d.getDay();
            const mondayOffset = day === 0 ? -6 : 1 - day;
            const start = new Date(d);
            start.setDate(start.getDate() + mondayOffset);
            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setDate(end.getDate() + 6);
            end.setHours(23, 59, 59, 999);
            return { startMs: start.getTime(), endMs: end.getTime() };
        }
        if (periodType === 'month') {
            const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
            const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
            return { startMs: start.getTime(), endMs: end.getTime() };
        }
        const start = new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
        const end = new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
        return { startMs: start.getTime(), endMs: end.getTime() };
    }

    getExportItemsByScope() {
        const scope = this.elements.exportScope ? this.elements.exportScope.value : 'selected';
        if (scope === 'period') {
            const periodType = this.elements.exportPeriodType ? this.elements.exportPeriodType.value : 'day';
            const refDate = this.elements.exportPeriodDate ? this.elements.exportPeriodDate.value : '';
            const bounds = App.getPeriodBounds(periodType, refDate);
            if (!bounds) {
                return [];
            }
            return (this.newsItems || []).filter((item) => {
                const ms = Number(item && item.publishedMs);
                return Number.isFinite(ms) && ms >= bounds.startMs && ms <= bounds.endMs;
            });
        }
        if (this.selectedArticleIds.size === 0) {
            return [];
        }
        const idSet = new Set(this.selectedArticleIds);
        return (this.newsItems || []).filter((item) => idSet.has(item.id));
    }

    async buildExportPayload(items, opts) {
        const model = (this.settings && this.settings.lmModel) || '';
        const kiMode = (this.settings && this.settings.kiApiMode) || '';
        const reasoning = (this.settings && this.settings.reasoning) || '';
        const reasoningEnabled = AISummarizer.normalizeLmReasoningEnabled(
            this.settings && this.settings.reasoningEnabled,
            reasoning
        );
        const rows = [];
        for (const item of items) {
            const rec = {
                id: item.id,
                title: item.title,
                url: item.url || item.link || '',
                source: item.newsSource || this.settings?.newsSource || '',
                category: item.category || '',
                categoryName: item.categoryName || '',
                timestamp: item.timestamp || '',
                publishedAt: item.publishedMs ? new Date(item.publishedMs).toISOString() : '',
                fetchedAt: item.fetchedAt || ''
            };
            if (opts.includeThumbnails) {
                const thumbnailUrl = App.articleThumbnailUrl(item);
                if (thumbnailUrl) {
                    rec.thumbnailUrl = thumbnailUrl;
                }
            }
            if (opts.includeSummary || opts.includeAlternativeLinks || opts.includeKiMeta) {
                const url = App.articlePrimaryUrl(item);
                if (url) {
                    const cached = await this.summarizer.getCachedSummaryForDisplay(url);
                    if (cached && opts.includeSummary) {
                        rec.summary = cached.summary || '';
                    }
                    if (cached && opts.includeAlternativeLinks) {
                        rec.alternativeLinks = Array.isArray(cached.alternativeLinks)
                            ? cached.alternativeLinks
                            : [];
                    }
                    if (cached && opts.includeKiMeta) {
                        rec.kiMeta = {
                            model,
                            apiMode: kiMode,
                            reasoning: reasoningEnabled ? reasoning : '',
                            summaryCachedAt: cached.cachedAt || ''
                        };
                    }
                }
            }
            if (opts.includeReddit && this.storage && this.storage.db) {
                const articleKey = App.articleFlagKey(item);
                if (articleKey) {
                    const rd = await this.storage.getRedditThreadsWithMeta(articleKey);
                    rec.redditThreads = rd && Array.isArray(rd.threads) ? rd.threads : [];
                }
            }
            if (opts.includeComments) {
                rec.commentStats = item.commentStats || null;
            }
            rows.push(rec);
        }
        return {
            meta: {
                createdAt: new Date().toISOString(),
                articleCount: rows.length,
                newsSource: this.settings?.newsSource || '',
                scope: this.elements.exportScope ? this.elements.exportScope.value : 'selected'
            },
            articles: rows
        };
    }

    async runExport() {
        try {
            if (typeof window === 'undefined' || !window.ArticleExporter) {
                this.showStatus('Export-Modul nicht verfügbar.', true);
                return;
            }
            const items = this.getExportItemsByScope();
            if (!items || items.length === 0) {
                this.showStatus(this._i18nExportNoItems || 'No articles found for export.', true);
                return;
            }
            const format = this.elements.exportFormat ? this.elements.exportFormat.value : 'json';
            const opts = {
                includeSummary: this.elements.exportIncludeSummary ? this.elements.exportIncludeSummary.checked : true,
                includeAlternativeLinks: this.elements.exportIncludeAlternativeLinks ? this.elements.exportIncludeAlternativeLinks.checked : true,
                includeReddit: this.elements.exportIncludeReddit ? this.elements.exportIncludeReddit.checked : false,
                includeComments: this.elements.exportIncludeComments ? this.elements.exportIncludeComments.checked : false,
                includeKiMeta: this.elements.exportIncludeKiMeta ? this.elements.exportIncludeKiMeta.checked : false,
                includeThumbnails:
                    format === 'pdf' &&
                    this.elements.exportIncludeThumbnails &&
                    this.elements.exportIncludeThumbnails.checked === true
            };
            const payload = await this.buildExportPayload(items, opts);
            const baseName = `news-export-${this.settings?.newsSource || 'source'}`;
            if (format === 'json') {
                const file = window.ArticleExporter.buildFileName(baseName, 'json');
                window.ArticleExporter.download(JSON.stringify(payload, null, 2), 'application/json;charset=utf-8', file);
            } else if (format === 'yaml') {
                const file = window.ArticleExporter.buildFileName(baseName, 'yaml');
                window.ArticleExporter.download(window.ArticleExporter.toYaml(payload), 'application/x-yaml;charset=utf-8', file);
            } else if (format === 'xml') {
                const file = window.ArticleExporter.buildFileName(baseName, 'xml');
                window.ArticleExporter.download(window.ArticleExporter.toXml(payload), 'application/xml;charset=utf-8', file);
            } else if (format === 'asciidoc') {
                const file = window.ArticleExporter.buildFileName(baseName, 'adoc');
                window.ArticleExporter.download(
                    window.ArticleExporter.toAsciiDoc(payload),
                    'text/plain;charset=utf-8',
                    file
                );
            } else {
                const file = window.ArticleExporter.buildFileName(baseName, 'pdf');
                const ok = await window.ArticleExporter.toPdf(payload, file);
                if (!ok) {
                    this.showStatus('PDF-Export ist aktuell nicht verfügbar.', true);
                    return;
                }
            }
            const doneTpl = this._i18nExportDone || 'Export created: {count} article(s) ({format}).';
            this.showStatus(
                doneTpl
                    .replace(/\{count\}/g, String(items.length))
                    .replace(/\{format\}/g, String(format).toUpperCase())
            );
            this.closeExportModal();
        } catch (e) {
            console.error('runExport:', e);
            this.showStatus('Export fehlgeschlagen.', true);
        }
    }

    areArticleThumbnailsEnabled() {
        return App.normalizeArticleThumbnailsEnabled(this.settings?.articleThumbnailsEnabled);
    }

    /**
     * @param {Record<string, unknown>} item
     * @returns {string}
     */
    buildArticleThumbnailHtml(item) {
        if (!this.areArticleThumbnailsEnabled()) {
            return '';
        }
        const thumbnailUrl = App.articleThumbnailUrl(item);
        if (!thumbnailUrl) {
            return '';
        }
        const articleHref = this.maybeWrapUrlForArticleTranslation(item.link || item.url || '');
        if (!articleHref) {
            return '';
        }
        return `
            <div class="news-card-thumbnail-wrap">
                <a class="news-card-thumbnail" href="${this.escapeHtml(articleHref)}" target="_blank" rel="noopener noreferrer" data-original-article-link="1" data-article-id="${this.escapeHtml(item.id || '')}">
                    <img
                        src="${this.escapeHtml(thumbnailUrl)}"
                        alt=""
                        loading="lazy"
                        decoding="async"
                        referrerpolicy="no-referrer"
                    >
                </a>
            </div>
        `;
    }

    /**
     * @param {string} icon
     * @param {string} label
     * @param {{ labelClass?: string }} [options]
     * @returns {string}
     */
    buildCardActionButtonContent(icon, label, options = {}) {
        const labelClass = App.collapseWhitespace(options.labelClass || '');
        const labelClassAttr = labelClass ? ` class="card-action-label ${this.escapeHtml(labelClass)}"` : ' class="card-action-label"';
        return `<span class="card-action-icon" aria-hidden="true">${this.escapeHtml(icon)}</span><span${labelClassAttr}>${this.escapeHtml(label)}</span>`;
    }

    /**
     * @param {HTMLElement|null} button
     * @param {string} icon
     * @param {string} label
     * @param {{ labelClass?: string }} [options]
     */
    setCardActionButtonContent(button, icon, label, options = {}) {
        if (!(button instanceof HTMLElement)) {
            return;
        }
        button.innerHTML = this.sanitizeHtml(this.buildCardActionButtonContent(icon, label, options));
    }

    /**
     * @param {HTMLElement|null} button
     * @param {'show'|'hide'|'retry'|'loading'} state
     */
    setSummaryToggleButtonState(button, state) {
        const map = {
            show: { icon: '✦', label: 'Zusammenfassung anzeigen' },
            hide: { icon: '✦', label: 'Zusammenfassung ausblenden' },
            retry: { icon: '↻', label: 'Zusammenfassung erneut versuchen' },
            loading: { icon: '⋯', label: 'Lade Zusammenfassung...', labelClass: 'summary-loading' }
        };
        const spec = map[state] || map.show;
        this.setCardActionButtonContent(button, spec.icon, spec.label, { labelClass: spec.labelClass || '' });
    }

    /**
     * @param {HTMLElement|null} button
     * @param {'default'|'loading'} state
     */
    setSummaryRefreshButtonState(button, state) {
        const map = {
            default: { icon: '↻', label: this._i18nSummaryRefreshBtn || 'Neu erstellen' },
            loading: { icon: '⋯', label: 'KI erzeugt neu...', labelClass: 'summary-loading' }
        };
        const spec = map[state] || map.default;
        this.setCardActionButtonContent(button, spec.icon, spec.label, { labelClass: spec.labelClass || '' });
    }

    /**
     * @param {HTMLElement|null} button
     * @param {'default'|'loading'} state
     */
    setRedditActionButtonState(button, state) {
        const map = {
            default: { icon: '💬', label: this._i18nRedditSearchBtn || 'Reddit' },
            loading: { icon: '⋯', label: 'Reddit sucht...', labelClass: 'summary-loading' }
        };
        const spec = map[state] || map.default;
        this.setCardActionButtonContent(button, spec.icon, spec.label, { labelClass: spec.labelClass || '' });
    }

    createNewsCardHTML(item) {
        const timeDisplay = item.timestamp || 'Aktuell';
        const articleState = this.getArticleDisplayState(item);
        const articleReadState = App.normalizeArticleReadState(item.readState);
        const isSelected = this.selectedArticleIds.has(item.id);
        const stateClass = articleState
            ? ` news-card--state-${articleState}${articleState === 'new' ? ' news-card--new' : ''}`
            : '';
        const badge = articleState
            ? `<span class="news-card-state-badge news-card-state-badge--${articleState}" data-article-state-badge>${this.escapeHtml(this.getArticleStateBadgeLabel(articleState))}</span>`
            : '';
        const ariaState = articleState
            ? ` aria-label="${this.escapeHtml(this.getArticleStateAriaLabel(articleState))}"`
            : '';
        const readStateAttr = articleReadState
            ? ` data-article-read-state="${this.escapeHtml(articleReadState)}"`
            : '';
        const articleStateAttr = articleState
            ? ` data-article-state="${this.escapeHtml(articleState)}"`
            : '';
        const favoriteLabel = item.isFavorite ? 'Favorit entfernen' : 'Als Favorit markieren';
        const hideLabel = item.isHidden ? 'Einblenden' : 'Ausblenden';
        const starIcon = item.isFavorite ? '★' : '☆';
        const hideIcon = item.isHidden ? '👁️' : '🙈';
        const titleFavoriteMarker = item.isFavorite
            ? '<span class="news-favorite-marker" title="Favorit" aria-hidden="true">★</span>'
            : '';
        const thumbnailHtml = this.buildArticleThumbnailHtml(item);
        const summaryToggleHtml = this.buildCardActionButtonContent('✦', 'Zusammenfassung anzeigen');
        const summaryRefreshHtml = this.buildCardActionButtonContent(
            '↻',
            this._i18nSummaryRefreshBtn || 'Neu erstellen'
        );
        const youtubeHtml = this.buildCardActionButtonContent('▶', 'YouTube');
        const webSearchHtml = this.buildCardActionButtonContent(
            '🔍',
            this._i18nWebSearchBtn || 'Weitere Artikel'
        );
        const redditHtml = this.buildCardActionButtonContent(
            '💬',
            this._i18nRedditSearchBtn || 'Reddit'
        );
        const shareHtml = this.buildCardActionButtonContent(
            '↗',
            this._i18nShareBtn || 'Teilen'
        );

        return `
            <article class="news-card${stateClass}" data-id="${item.id}"${articleStateAttr}${readStateAttr} lang="${App.articleContentHtmlLang(item, this.settings && this.settings.newsSource)}"${ariaState}>
                <div class="news-header">
                    <div class="news-header-main">
                        <span class="news-card-drag-handle notranslate" draggable="true" title="Artikel verschieben" aria-label="Artikel verschieben">⋮⋮</span>
                        <label class="article-select-wrap" title="Für Export auswählen">
                            <input type="checkbox" class="article-select-checkbox" data-article-id="${this.escapeHtml(item.id)}" ${isSelected ? 'checked' : ''}>
                            <span>Export</span>
                        </label>
                        ${badge}
                        <span class="category-badge">${item.categoryName}</span>
                        <span class="forum-mood-wrap" hidden>
                            <span class="forum-mood-label"></span>
                            <span class="forum-mood-emoji" aria-hidden="true"></span>
                        </span>
                    </div>
                    <span class="news-time">${timeDisplay}</span>
                </div>

                ${thumbnailHtml}

                <h3 class="news-title">
                    <a href="${this.escapeHtml(this.maybeWrapUrlForArticleTranslation(item.link))}" target="_blank" rel="noopener noreferrer" data-original-article-link="1" data-article-id="${this.escapeHtml(item.id || '')}">
                        ${titleFavoriteMarker}
                        <span class="news-title-translate" data-original-text="${this.escapeHtml(item.title)}">${this.escapeHtml(item.title)}</span>
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
                        ${summaryToggleHtml}
                    </button>
                    <button type="button" class="summary-refresh-btn" data-url="${encodeURIComponent(item.url || item.link || '')}" title="Cache leeren und Zusammenfassung neu von der KI erzeugen">
                        ${summaryRefreshHtml}
                    </button>
                    <button type="button" class="youtube-toggle" data-url="${encodeURIComponent(item.url || item.link || '')}" title="${this.escapeHtml(this._i18nYoutubeBtnTitle || 'YouTube search suggestions')}">
                        ${youtubeHtml}
                    </button>
                    <button type="button" class="article-web-search-btn" data-article-id="${this.escapeHtml(item.id)}" title="${this.escapeHtml(this._i18nWebSearchTitle)}">
                        ${webSearchHtml}
                    </button>
                    <button type="button" class="article-reddit-search-btn" data-article-id="${this.escapeHtml(item.id)}" title="${this.escapeHtml(this._i18nRedditSearchTitle)}">
                        ${redditHtml}
                    </button>
                    <button type="button" class="article-share-btn" data-article-id="${this.escapeHtml(item.id)}" title="${this.escapeHtml(this._i18nShareTitle)}">
                        ${shareHtml}
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
        // Delegation on #newsGrid: currentTarget is the grid, not the button — resolve via closest
        const btn = event.target?.closest('.article-favorite-btn');
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
        // Delegation on #newsGrid: currentTarget is the grid, not the button — resolve via closest
        const btn = event.target?.closest('.article-hide-btn');
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
            const apiMode = AISummarizer.normalizeKiApiMode(this.settings?.kiApiMode);
            let baseUrl =
                apiMode === 'anthropic'
                    ? this.settings?.anthropicApiBaseUrl || ''
                    : this.settings?.apiBaseUrl || '';

            // Dev-Server same-origin: http://127.0.0.1:* (automatisch erkannt)
            if (apiMode !== 'anthropic' && this._devServerDetected && baseUrl === '') {
                baseUrl = window.location.origin;
            }

            if (!baseUrl) {
                console.warn('KI-Server URL nicht gesetzt — Status bleibt grau.');
                return 'unknown';
            }

            // Test: GET …/models (same URL logic as AISummarizer model discovery)
            const url = AISummarizer.getModelsListUrlFromSettings({
                kiApiMode: apiMode,
                apiBaseUrl: baseUrl,
                lmRestRoot: this.settings?.lmRestRoot || '',
                anthropicApiBaseUrl: this.settings?.anthropicApiBaseUrl || '',
                restSameOrigin: this.settings?.restSameOrigin === true,
                pageOrigin: typeof window !== 'undefined' && window.location ? window.location.origin : ''
            });
            if (!url) {
                console.warn('KI-Server: keine Modell-URL (z. B. file:// + same-origin).');
                return 'unknown';
            }

            const token = this.settings?.lmApiToken || '';
            if (apiMode === 'anthropic' && !token) {
                console.warn('KI-Server: Anthropic API-Token fehlt.');
                return 'unknown';
            }
            const headers = this.summarizer.buildModelsGetHeaders(apiMode, token, url);
            const resp = await fetch(url, { method: 'GET', headers });
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
     * Offline demo / fallback rows should not overwrite real cached source data in background refresh.
     * @param {Record<string, unknown>|null|undefined} item
     * @returns {boolean}
     */
    static isOfflineDemoNewsItem(item) {
        if (!item || typeof item !== 'object') {
            return false;
        }
        const id = String(item.id || '').trim().toLowerCase();
        const title = String(item.title || '').trim();
        return id.includes('fallback-') || /\(Offline-Demo\)/i.test(title);
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
                return `<li class="summary-reddit-item"><a class="summary-reddit-link" href="${this.escapeHtml(this.maybeWrapUrlForArticleTranslation(u))}" target="_blank" rel="noopener noreferrer">${img}<span class="summary-reddit-line">${this.escapeHtml(tit)}</span></a></li>`;
            })
            .filter(Boolean)
            .join('');
        list.innerHTML = itemsHtml ? this.sanitizeHtml(itemsHtml) : '';
        block.hidden = !itemsHtml;
        this.queueInPlaceTranslationForSummaryCard(summaryDiv);
    }

    /**
     * Build a short Reddit search query from an AI summary.
     * Falls back to title when summary is unusable.
     * @param {string} summaryText
     * @param {string} title
     * @returns {string}
     */
    buildRedditSearchQueryFromSummary(summaryText, title) {
        const fallback = String(title || '').trim();
        const raw = String(summaryText || '').trim();
        if (!raw) {
            return fallback;
        }

        // Remove common list prefixes / markdown noise and collapse whitespace.
        const cleaned = raw
            .replace(/[`*_>#]/g, ' ')
            .replace(/^\s*[-*•]+\s*/gm, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!cleaned) {
            return fallback;
        }

        // Prefer first meaningful sentence.
        const sentence = cleaned
            .split(/[.!?]\s+/)
            .map((s) => s.trim())
            .find((s) => s.length >= 24) || cleaned;

        // Keep query concise for better Reddit relevance.
        const short = sentence.length > 170 ? `${sentence.slice(0, 167).trim()}…` : sentence;
        return short || fallback;
    }

    /**
     * Resolve best Reddit query: prefer AI summary (visible/cached), fallback to title.
     * @param {object | undefined} item
     * @param {HTMLElement} summaryDiv
     * @returns {Promise<string>}
     */
    async resolveRedditQuery(item, summaryDiv) {
        const title = item && item.title ? String(item.title).trim() : '';
        const visibleSummary = summaryDiv
            ? String(summaryDiv.querySelector('.summary-content')?.textContent || '').trim()
            : '';
        if (visibleSummary) {
            return this.buildRedditSearchQueryFromSummary(visibleSummary, title);
        }

        const url = App.articlePrimaryUrl(item);
        if (!url || !this.summarizer) {
            return title;
        }
        try {
            const cached = await this.summarizer.getCachedSummaryForDisplay(url);
            const txt =
                cached && typeof cached.summary === 'string' ? String(cached.summary).trim() : '';
            return this.buildRedditSearchQueryFromSummary(txt, title);
        } catch (_) {
            return title;
        }
    }

    /**
     * Whether forum entries should be auto-generated under article sources.
     * @returns {boolean}
     */
    shouldAutoGenerateForumEntries() {
        const mode = App.normalizeForumEntriesDiscoveryMode(
            this.settings?.forumEntriesDiscoveryMode
        );
        return mode === 'always';
    }

    /**
     * Whether KI YouTube search suggestions should be generated and cached in the
     * background together with the AI summaries (vs. only when the user opens the modal).
     * @returns {boolean}
     */
    shouldAutoGenerateYoutubeSuggestions() {
        const mode = App.normalizeYoutubeSuggestionsDiscoveryMode(
            this.settings?.youtubeSuggestionsDiscoveryMode
        );
        return mode === 'always';
    }

    /**
     * Parse keep-indices JSON from KI text, supports fenced code blocks.
     * @param {string} raw
     * @returns {number[]}
     */
    parseRedditKeepIndicesFromAi(raw) {
        const text = String(raw || '').trim();
        if (!text) {
            return [];
        }
        const candidates = [];
        candidates.push(text);
        const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fenced && fenced[1]) {
            candidates.push(fenced[1].trim());
        }
        const objMatch = text.match(/\{[\s\S]*\}/);
        if (objMatch && objMatch[0]) {
            candidates.push(objMatch[0].trim());
        }
        for (const c of candidates) {
            try {
                const parsed = JSON.parse(c);
                if (parsed && Array.isArray(parsed.keep)) {
                    return parsed.keep
                        .map((x) => Number(x))
                        .filter((n) => Number.isInteger(n) && n >= 0);
                }
            } catch (_) {
                /* try next */
            }
        }
        return [];
    }

    /**
     * KI filter: keeps only Reddit threads relevant to article topic.
     * @param {object | undefined} item
     * @param {HTMLElement} summaryDiv
     * @param {Array<{ title?: string, url: string }>} threads
     * @returns {Promise<Array<{ title?: string, url: string }>>}
     */
    async filterRedditThreadsByAiRelevance(item, summaryDiv, threads) {
        if (!this.summarizer || typeof this.summarizer.completePrompt !== 'function') {
            return threads;
        }
        const rows = Array.isArray(threads) ? threads.slice(0, 8) : [];
        if (rows.length <= 1) {
            return rows;
        }

        const title = item && item.title ? String(item.title).trim() : '';
        const visibleSummary = summaryDiv
            ? String(summaryDiv.querySelector('.summary-content')?.textContent || '').trim()
            : '';
        const articleSummary = visibleSummary.length > 1200 ? `${visibleSummary.slice(0, 1200)}…` : visibleSummary;
        const threadLines = rows
            .map((t, i) => `${i}. ${String(t?.title || t?.url || '').trim()} | ${String(t?.url || '').trim()}`)
            .join('\n');

        const systemPrompt =
            'You are a strict relevance filter for Reddit results. Return ONLY JSON.';
        const userPrompt = [
            'Task: Keep only Reddit threads that are clearly about the same topic as the article.',
            'Reject vague, loosely related, or different-topic results.',
            'Return STRICT JSON only: {"keep":[indices]}',
            '',
            `Article title: ${title || 'n/a'}`,
            `Article summary: ${articleSummary || 'n/a'}`,
            '',
            'Candidate threads:',
            threadLines
        ].join('\n');

        try {
            const raw = await this.summarizer.completePrompt(systemPrompt, userPrompt);
            const keep = this.parseRedditKeepIndicesFromAi(raw);
            if (keep.length === 0) {
                return [];
            }
            const keepSet = new Set(keep);
            return rows.filter((_, idx) => keepSet.has(idx));
        } catch (e) {
            console.warn('filterRedditThreadsByAiRelevance:', e);
            // Fallback: keep original results if KI filter is unavailable
            return rows;
        }
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
        const query = await this.resolveRedditQuery(item, summaryDiv);
        if (!query) {
            this.showStatus(this._i18nRedditNoTitle, true);
            return;
        }

        if (triggerBtn) {
            triggerBtn.disabled = true;
            this.setRedditActionButtonState(triggerBtn, 'loading');
        }

        summaryDiv.classList.add('active');
        if (toggleBtn) {
            this.setSummaryToggleButtonState(toggleBtn, 'hide');
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
            const reasoningConfig = this.getSupportedReasoningConfigForCurrentModel();
            const params = new URLSearchParams({ q: query, limit: '5', ai: '1' });
            if (reasoningConfig.enabled) {
                params.set('reasoning', reasoningConfig.level);
            }
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
            const relevantResults = await this.filterRedditThreadsByAiRelevance(item, summaryDiv, results);
            if (relevantResults.length === 0) {
                this.clearSummaryRedditBlock(summaryDiv);
                this.showStatus(this._i18nRedditNone, true);
                return;
            }
            this.renderRedditThreadsOnCard(summaryDiv, relevantResults);
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
                    .replace(/\{count\}/g, String(relevantResults.length))
                    .replace(/\{queries\}/g, aiQueries.join(', '));
            } else {
                statusMsg = foundTpl.replace(/\{count\}/g, String(relevantResults.length));
            }
            this.showStatus(statusMsg);
        } catch (e) {
            console.error('searchRedditForArticle:', e);
            this.clearSummaryRedditBlock(summaryDiv);
            this.showStatus(this._i18nRedditError, true);
        } finally {
            if (triggerBtn) {
                triggerBtn.disabled = false;
                this.setRedditActionButtonState(triggerBtn, 'default');
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
                this.queueInPlaceTranslationForSummaryCard(summaryDiv);
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
                    return `<li class="summary-alt-link-item"><a class="summary-alt-link" href="${this.escapeHtml(this.maybeWrapUrlForArticleTranslation(u))}" target="_blank" rel="noopener noreferrer">${img}<span class="summary-alt-link-line">${lineInner}</span></a></li>`;
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
        this.queueInPlaceTranslationForSummaryCard(summaryDiv);
    }

    /**
     * Re-translate summary / alt / Reddit nodes on this card after DOM updates (MyMemory).
     * @param {HTMLElement} summaryDiv
     */
    queueInPlaceTranslationForSummaryCard(summaryDiv) {
        if (
            !this.settings ||
            (
                this.settings.articleTranslationEnabled !== true &&
                !this.shouldAutoTranslateTitlesForBrowserSummary()
            )
        ) {
            return;
        }
        if (!summaryDiv) {
            return;
        }
        const sc = summaryDiv.querySelector('.summary-content');
        if (sc && this.settings.articleTranslationEnabled === true) {
            sc.removeAttribute('data-mtm');
        }
        summaryDiv.querySelectorAll('.summary-alt-link-title, .summary-reddit-line').forEach((el) => {
            el.removeAttribute('data-mtm');
            el.removeAttribute('data-mtm-title-lang');
        });
        void this.runImmediateInPlaceTranslationForCard(summaryDiv.closest('.news-card'));
        this.scheduleArticleInPlaceTranslation();
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
        // Legacy key removed - canonicalSummaryCacheKey handles both stripping and canonicalization
        const promptUrl = AISummarizer.canonicalSummaryCacheKey(trimmedUrl) || trimmedUrl;

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
        // Delegation on #newsGrid: currentTarget is the grid, not the button — resolve via closest
        const button = event.target?.closest('.summary-toggle');
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
            this.setSummaryToggleButtonState(button, 'show');
            return;
        }

        // Show loading state
        button.disabled = true;
        this.setSummaryToggleButtonState(button, 'loading');

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
                this.setSummaryToggleButtonState(button, 'retry');
            } else if (!display) {
                this.clearSummaryAltLinks(summaryDiv, { keepReddit: true });
                summaryContent.innerHTML =
                    '<span style="color: var(--primary-color);">Zusammenfassung leer — bitte „Neu erstellen“ oder Modell prüfen.</span>';
                this.updateKiStatus('err');
                this.setSummaryToggleButtonState(button, 'retry');
            } else {
                this.renderAiSummaryOnCard(summaryDiv, summary);
                this.updateKiStatus('ok');
                this.setSummaryToggleButtonState(button, 'hide');
            }

            summaryDiv.classList.add('active');
        } catch (error) {
            console.error('Error toggling summary:', error);
            this.clearSummaryAltLinks(summaryDiv, { keepReddit: true });
            summaryContent.innerHTML = this.sanitizeHtml(`<span style="color: var(--primary-color);">Fehler beim Laden der Zusammenfassung: ${this.escapeHtml(error.message || String(error))}</span>`);
            summaryDiv.classList.add('active');
            this.setSummaryToggleButtonState(button, 'retry');
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

        // Delegation on #newsGrid: currentTarget is the grid, not the button — resolve via closest
        const btn = event.target?.closest('.summary-refresh-btn');
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

        btn.disabled = true;
        toggleBtn.disabled = true;
        this.setSummaryRefreshButtonState(btn, 'loading');
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
                this.setSummaryToggleButtonState(toggleBtn, 'show');
            } else if (!display) {
                this.clearSummaryAltLinks(summaryDiv, { keepReddit: true });
                summaryContent.innerHTML =
                    '<span style="color: var(--primary-color);">Zusammenfassung leer — bitte „Neu erstellen“ oder Modell prüfen.</span>';
                this.updateKiStatus('err');
                this.setSummaryToggleButtonState(toggleBtn, 'retry');
            } else {
                this.renderAiSummaryOnCard(summaryDiv, summary);
                this.updateKiStatus('ok');
                this.setSummaryToggleButtonState(toggleBtn, 'hide');
            }
        } catch (error) {
            console.error('refreshSummary:', error);
            this.clearSummaryAltLinks(summaryDiv, { keepReddit: true });
            summaryContent.innerHTML = this.sanitizeHtml(`<span style="color: var(--primary-color);">Fehler: ${this.escapeHtml(error.message || String(error))}</span>`);
            this.updateKiStatus('err');
            this.setSummaryToggleButtonState(toggleBtn, 'show');
        } finally {
            btn.disabled = false;
            toggleBtn.disabled = false;
            this.setSummaryRefreshButtonState(btn, 'default');
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
                this.setSummaryToggleButtonState(toggleBtn, 'retry');
            }
        } else {
            this.renderAiSummaryOnCard(summaryDiv, summary);
            if (toggleBtn) {
                this.setSummaryToggleButtonState(toggleBtn, 'hide');
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
        if (
            this._summarizeAllInProgress ||
            this._autoSummarizeNewInProgress ||
            this._selectedSourcesGenerationInProgress
        ) {
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
                        if (
                            this.shouldAutoGenerateForumEntries() &&
                            this._newArticleIds &&
                            this._newArticleIds.has(item.id)
                        ) {
                            // Fire-and-forget: only cards currently in DOM get immediate forum entries.
                            // Cache-first — skip the live Reddit query when fresh threads are already
                            // cached (the card hydrates them on render). The Reddit button still forces.
                            void this.maybeAutoSearchRedditForVisibleCard(item);
                        }
                        if (
                            this.shouldAutoGenerateYoutubeSuggestions() &&
                            this._newArticleIds &&
                            this._newArticleIds.has(item.id)
                        ) {
                            // Fire-and-forget: warm the YouTube suggestion cache so the modal opens instantly.
                            void this.prefetchYoutubeRelatedForItem(item).catch((e) =>
                                console.warn('autoSummarizeAfterRefresh youtube:', item.url, e)
                            );
                        }
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
        if (
            this._summarizeAllInProgress ||
            this._autoSummarizeNewInProgress ||
            this._selectedSourcesGenerationInProgress
        ) {
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
        try {
            localStorage.setItem('theme', newTheme);
        } catch (_) {
            /* ignore */
        }
        if (this.settings) {
            this.settings.theme = newTheme;
        }
        this.applyThemeSurfaceVariables();
    }

    applyTheme() {
        const theme = App.normalizeThemePreference(this.settings?.theme);

        if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
        this.applyThemeSurfaceVariables();
    }

    /** Applies --bg-* / --border-color, --text-*, --header-* and header transparency vars from settings (or optional modal-built palette). */
    applyThemeSurfaceVariables(palette) {
        const pal =
            palette ||
            this.buildThemeSurfacePaletteFromSettings();
        const mode = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        const surf = App.resolveThemeSurfaceForMode(pal, mode);
        const hdr = App.resolveThemeHeaderForMode(pal, mode);
        const text = App.resolveThemeTextForMode(pal, mode);
        const hdrTransparency = App.resolveThemeHeaderTransparencyForMode(pal, mode);
        const root = document.documentElement.style;
        root.setProperty('--bg-primary', surf.bgPrimary);
        root.setProperty('--bg-secondary', surf.bgSecondary);
        root.setProperty('--bg-card', surf.bgCard);
        root.setProperty('--border-color', surf.borderColor);
        root.setProperty('--text-primary', text.textPrimary);
        root.setProperty('--text-secondary', text.textSecondary);
        root.setProperty('--header-surface', hdr.headerSurface);
        root.setProperty('--header-text', hdr.headerText);
        root.setProperty('--header-border', hdr.headerBorder);
        root.setProperty('--header-shell-border-mix', hdrTransparency.shellBorderMix);
        root.setProperty('--header-overlay-opacity', hdrTransparency.overlayOpacity);
        root.setProperty('--header-panel-fill', hdrTransparency.panelFill);
        root.setProperty('--header-panel-border-fill', hdrTransparency.panelBorderFill);
        root.setProperty('--header-control-fill', hdrTransparency.controlFill);
        root.setProperty('--header-control-border-fill', hdrTransparency.controlBorderFill);
    }

    applyArticleStateColorVariables(colors) {
        const normalized = App.normalizeArticleStateColors(colors || this.settings?.articleStateColors);
        const root = document.documentElement.style;
        ARTICLE_STATE_COLOR_IDS.forEach((state) => {
            const color = normalized[state];
            root.setProperty(`--article-state-${state}-color`, color);
            root.setProperty(
                `--article-state-${state}-text`,
                App.readableTextColorForBackground(color)
            );
        });
    }

    /**
     * @returns {{ colorTheme: string, themeCustomColors: { light: Object, dark: Object }, themeCustomHeaderColors: { light: Object, dark: Object }, themeSurfaceBrightness: { light: number, dark: number }, themeHeaderTransparency: { light: number, dark: number } }}
     */
    buildThemeSurfacePaletteFromSettings() {
        const themeCustomColors = App.normalizeThemeCustomColors(this.settings?.themeCustomColors);
        const themeCustomHeaderColors = App.normalizeThemeCustomHeaderColors(this.settings?.themeCustomHeaderColors);
        const themeSurfaceBrightness = App.normalizeThemeSurfaceBrightness(this.settings?.themeSurfaceBrightness);
        const themeHeaderTransparency = App.normalizeThemeHeaderTransparency(this.settings?.themeHeaderTransparency);
        const colorTheme = App.normalizeColorTheme(this.settings?.colorTheme);
        return { colorTheme, themeCustomColors, themeCustomHeaderColors, themeSurfaceBrightness, themeHeaderTransparency };
    }

    /** Read theme modal controls (live preview in Settings). */
    buildThemeSurfacePaletteFromModal() {
        const el = this.elements;
        let bl = 50;
        let bd = 50;
        if (el.themeBrightnessLight) {
            const n = parseInt(el.themeBrightnessLight.value, 10);
            if (Number.isFinite(n)) {
                bl = n;
            }
        }
        if (el.themeBrightnessDark) {
            const n = parseInt(el.themeBrightnessDark.value, 10);
            if (Number.isFinite(n)) {
                bd = n;
            }
        }
        let htl = THEME_DEFAULT_HEADER_TRANSPARENCY.light;
        let htd = THEME_DEFAULT_HEADER_TRANSPARENCY.dark;
        if (el.themeLightHeaderTransparency) {
            const n = parseInt(el.themeLightHeaderTransparency.value, 10);
            if (Number.isFinite(n)) {
                htl = n;
            }
        }
        if (el.themeDarkHeaderTransparency) {
            const n = parseInt(el.themeDarkHeaderTransparency.value, 10);
            if (Number.isFinite(n)) {
                htd = n;
            }
        }
        const themeSurfaceBrightness = App.normalizeThemeSurfaceBrightness({ light: bl, dark: bd, version: 2 });
        const themeHeaderTransparency = App.normalizeThemeHeaderTransparency({
            light: htl,
            dark: htd,
            version: 1
        });
        const themeCustomColors = this.gatherThemeCustomColorsFromModalForSave();
        const themeCustomHeaderColors = this.gatherThemeCustomHeaderColorsFromModalForSave();
        const colorTheme = App.normalizeColorTheme(
            this.elements.settingsColorThemeSelect?.value || this.elements.colorThemeSelect?.value || this.settings?.colorTheme
        );
        return { colorTheme, themeCustomColors, themeCustomHeaderColors, themeSurfaceBrightness, themeHeaderTransparency };
    }

    populateThemeSettingsModal() {
        const el = this.elements;
        if (!el.themeModeSelect) {
            return;
        }
        const themePref = App.normalizeThemePreference(this.settings?.theme);
        el.themeModeSelect.value = themePref;

        const ct = App.normalizeColorTheme(this.settings?.colorTheme);
        if (el.settingsColorThemeSelect) {
            el.settingsColorThemeSelect.value = ct;
        }

        const articleStateColors = App.normalizeArticleStateColors(this.settings?.articleStateColors);
        if (el.articleStateNewColor) {
            el.articleStateNewColor.value = articleStateColors.new;
        }
        if (el.articleStateSeenColor) {
            el.articleStateSeenColor.value = articleStateColors.seen;
        }
        if (el.articleStateReadColor) {
            el.articleStateReadColor.value = articleStateColors.read;
        }

        const tc = App.normalizeThemeCustomColors(this.settings?.themeCustomColors);
        const tch = App.normalizeThemeCustomHeaderColors(this.settings?.themeCustomHeaderColors);
        const br = App.normalizeThemeSurfaceBrightness(this.settings?.themeSurfaceBrightness);
        const ht = App.normalizeThemeHeaderTransparency(this.settings?.themeHeaderTransparency);

        const mergeMode = (mode) => ({ ...getThemeSurfaceDefaults(ct, mode), ...tc[mode] });
        const mergeHeader = (mode) => ({ ...THEME_DEFAULT_HEADER[mode], ...tch[mode] });
        const L = mergeMode('light');
        const D = mergeMode('dark');
        const HL = mergeHeader('light');
        const HD = mergeHeader('dark');

        if (el.themeLightBgPrimary) {
            el.themeLightBgPrimary.value = L.bgPrimary;
        }
        if (el.themeLightBgSecondary) {
            el.themeLightBgSecondary.value = L.bgSecondary;
        }
        if (el.themeLightBgCard) {
            el.themeLightBgCard.value = L.bgCard;
        }
        if (el.themeLightBorder) {
            el.themeLightBorder.value = L.borderColor;
        }
        if (el.themeDarkBgPrimary) {
            el.themeDarkBgPrimary.value = D.bgPrimary;
        }
        if (el.themeDarkBgSecondary) {
            el.themeDarkBgSecondary.value = D.bgSecondary;
        }
        if (el.themeDarkBgCard) {
            el.themeDarkBgCard.value = D.bgCard;
        }
        if (el.themeDarkBorder) {
            el.themeDarkBorder.value = D.borderColor;
        }
        if (el.themeBrightnessLight) {
            el.themeBrightnessLight.value = String(br.light);
        }
        if (el.themeBrightnessDark) {
            el.themeBrightnessDark.value = String(br.dark);
        }
        if (el.themeLightHeaderSurface) {
            el.themeLightHeaderSurface.value = HL.headerSurface;
        }
        if (el.themeLightHeaderText) {
            el.themeLightHeaderText.value = HL.headerText;
        }
        if (el.themeLightHeaderBorder) {
            el.themeLightHeaderBorder.value = HL.headerBorder;
        }
        if (el.themeLightHeaderTransparency) {
            el.themeLightHeaderTransparency.value = String(ht.light);
        }
        if (el.themeDarkHeaderSurface) {
            el.themeDarkHeaderSurface.value = HD.headerSurface;
        }
        if (el.themeDarkHeaderText) {
            el.themeDarkHeaderText.value = HD.headerText;
        }
        if (el.themeDarkHeaderBorder) {
            el.themeDarkHeaderBorder.value = HD.headerBorder;
        }
        if (el.themeDarkHeaderTransparency) {
            el.themeDarkHeaderTransparency.value = String(ht.dark);
        }
        this.syncThemeModalBrightnessHints();
    }

    /**
     * Reset modal surface color controls to the selected preset theme defaults.
     * Brightness sliders stay untouched; header color controls are separate.
     * @param {string} colorTheme
     */
    applyThemeSurfaceDefaultsToModal(colorTheme) {
        const el = this.elements;
        const normalizedTheme = App.normalizeColorTheme(colorTheme);
        const L = getThemeSurfaceDefaults(normalizedTheme, 'light');
        const D = getThemeSurfaceDefaults(normalizedTheme, 'dark');
        if (el.themeLightBgPrimary) {
            el.themeLightBgPrimary.value = L.bgPrimary;
        }
        if (el.themeLightBgSecondary) {
            el.themeLightBgSecondary.value = L.bgSecondary;
        }
        if (el.themeLightBgCard) {
            el.themeLightBgCard.value = L.bgCard;
        }
        if (el.themeLightBorder) {
            el.themeLightBorder.value = L.borderColor;
        }
        if (el.themeDarkBgPrimary) {
            el.themeDarkBgPrimary.value = D.bgPrimary;
        }
        if (el.themeDarkBgSecondary) {
            el.themeDarkBgSecondary.value = D.bgSecondary;
        }
        if (el.themeDarkBgCard) {
            el.themeDarkBgCard.value = D.bgCard;
        }
        if (el.themeDarkBorder) {
            el.themeDarkBorder.value = D.borderColor;
        }
    }

    /**
     * Builds the localized hint text for a brightness slider.
     * @param {number} percent 0–100
     * @returns {string}
     */
    formatThemeBrightnessHint(percent) {
        const v = App.normalizeThemeSurfaceBrightnessValue(percent);
        let tpl;
        if (v === 50) {
            tpl = this._i18nThemeBrightnessHintNeutral || '{value} %';
        } else if (v > 50) {
            tpl = this._i18nThemeBrightnessHintLighter || '{value} %';
        } else {
            tpl = this._i18nThemeBrightnessHintDarker || '{value} %';
        }
        return String(tpl).replace(/\{value\}/g, String(v));
    }

    syncThemeModalBrightnessHints() {
        const el = this.elements;
        const hintL = document.getElementById('themeBrightnessLightHint');
        const hintD = document.getElementById('themeBrightnessDarkHint');
        const hintHTL = document.getElementById('themeHeaderTransparencyLightHint');
        const hintHTD = document.getElementById('themeHeaderTransparencyDarkHint');
        if (el.themeBrightnessLight && hintL) {
            hintL.textContent = this.formatThemeBrightnessHint(el.themeBrightnessLight.value);
        }
        if (el.themeBrightnessDark && hintD) {
            hintD.textContent = this.formatThemeBrightnessHint(el.themeBrightnessDark.value);
        }
        if (el.themeLightHeaderTransparency && hintHTL) {
            hintHTL.textContent = `${App.normalizeThemeHeaderTransparencyValue(el.themeLightHeaderTransparency.value)} %`;
        }
        if (el.themeDarkHeaderTransparency && hintHTD) {
            hintHTD.textContent = `${App.normalizeThemeHeaderTransparencyValue(el.themeDarkHeaderTransparency.value)} %`;
        }
    }

    applyThemeAppearancePreviewFromModal(previewModeOverride) {
        if (!this.elements.themeModeSelect) {
            return;
        }
        const forcedMode =
            previewModeOverride === 'dark' || previewModeOverride === 'light'
                ? previewModeOverride
                : '';
        if (forcedMode) {
            document.documentElement.setAttribute('data-theme', forcedMode);
        } else {
            const pref = App.normalizeThemePreference(this.elements.themeModeSelect.value);
            if (pref === 'system') {
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
            } else {
                document.documentElement.setAttribute('data-theme', pref);
            }
        }
        const accent = App.normalizeColorTheme(this.elements.settingsColorThemeSelect?.value);
        document.documentElement.setAttribute('data-color-theme', accent);
        if (this.elements.colorThemeSelect) {
            this.elements.colorThemeSelect.value = accent;
        }
        const pal = this.buildThemeSurfacePaletteFromModal();
        this.applyThemeSurfaceVariables(pal);
    }

    restoreThemeAppearanceFromPersistedSettings() {
        this.applyTheme();
        this.applyColorTheme();
        this.applyThemeSurfaceVariables();
        this.applyArticleStateColorVariables();
    }

    gatherThemeCustomColorsFromModalForSave() {
        const el = this.elements;
        const readHex = (input) => (input ? App.normalizeHexColor(input.value) : null);
        const out = { light: {}, dark: {} };
        const colorTheme = App.normalizeColorTheme(
            this.elements.settingsColorThemeSelect?.value || this.elements.colorThemeSelect?.value || this.settings?.colorTheme
        );
        const dl = getThemeSurfaceDefaults(colorTheme, 'light');
        const dd = getThemeSurfaceDefaults(colorTheme, 'dark');
        const maybe = (key, val, def, bucket) => {
            if (val && val !== def) {
                bucket[key] = val;
            }
        };
        maybe('bgPrimary', readHex(el.themeLightBgPrimary), dl.bgPrimary, out.light);
        maybe('bgSecondary', readHex(el.themeLightBgSecondary), dl.bgSecondary, out.light);
        maybe('bgCard', readHex(el.themeLightBgCard), dl.bgCard, out.light);
        maybe('borderColor', readHex(el.themeLightBorder), dl.borderColor, out.light);
        maybe('bgPrimary', readHex(el.themeDarkBgPrimary), dd.bgPrimary, out.dark);
        maybe('bgSecondary', readHex(el.themeDarkBgSecondary), dd.bgSecondary, out.dark);
        maybe('bgCard', readHex(el.themeDarkBgCard), dd.bgCard, out.dark);
        maybe('borderColor', readHex(el.themeDarkBorder), dd.borderColor, out.dark);
        return App.normalizeThemeCustomColors(out);
    }

    gatherThemeCustomHeaderColorsFromModalForSave() {
        const el = this.elements;
        const readHex = (input) => (input ? App.normalizeHexColor(input.value) : null);
        const out = { light: {}, dark: {} };
        const dl = THEME_DEFAULT_HEADER.light;
        const dd = THEME_DEFAULT_HEADER.dark;
        const maybe = (key, val, def, bucket) => {
            if (val && val !== def) {
                bucket[key] = val;
            }
        };
        maybe('headerSurface', readHex(el.themeLightHeaderSurface), dl.headerSurface, out.light);
        maybe('headerText', readHex(el.themeLightHeaderText), dl.headerText, out.light);
        maybe('headerBorder', readHex(el.themeLightHeaderBorder), dl.headerBorder, out.light);
        maybe('headerSurface', readHex(el.themeDarkHeaderSurface), dd.headerSurface, out.dark);
        maybe('headerText', readHex(el.themeDarkHeaderText), dd.headerText, out.dark);
        maybe('headerBorder', readHex(el.themeDarkHeaderBorder), dd.headerBorder, out.dark);
        return App.normalizeThemeCustomHeaderColors(out);
    }

    gatherArticleStateColorsFromModalForSave() {
        const el = this.elements;
        return App.normalizeArticleStateColors({
            new: el.articleStateNewColor?.value,
            seen: el.articleStateSeenColor?.value,
            read: el.articleStateReadColor?.value
        });
    }

    wireThemeSettingsListeners() {
        const el = this.elements;
        const on = (node, ev, fn) => {
            if (node) {
                node.addEventListener(ev, fn);
            }
        };
        on(el.themeModeSelect, 'change', () => this.applyThemeAppearancePreviewFromModal());
        on(el.settingsColorThemeSelect, 'change', () => {
            const colorTheme = App.normalizeColorTheme(el.settingsColorThemeSelect?.value);
            this.applyThemeSurfaceDefaultsToModal(colorTheme);
            this.applyThemeAppearancePreviewFromModal();
        });
        const surf = (mode) => this.applyThemeAppearancePreviewFromModal(mode);
        on(el.themeBrightnessLight, 'input', () => {
            this.syncThemeModalBrightnessHints();
            surf('light');
        });
        on(el.themeBrightnessDark, 'input', () => {
            this.syncThemeModalBrightnessHints();
            surf('dark');
        });
        [
            el.themeLightBgPrimary,
            el.themeLightBgSecondary,
            el.themeLightBgCard,
            el.themeLightBorder
        ].forEach((inp) => on(inp, 'input', () => surf('light')));
        [
            el.themeDarkBgPrimary,
            el.themeDarkBgSecondary,
            el.themeDarkBgCard,
            el.themeDarkBorder
        ].forEach((inp) => on(inp, 'input', () => surf('dark')));
        [
            el.themeLightHeaderSurface,
            el.themeLightHeaderText,
            el.themeLightHeaderBorder,
            el.themeLightHeaderTransparency
        ].forEach((inp) =>
            on(inp, 'input', () => {
                this.syncThemeModalBrightnessHints();
                surf('light');
            })
        );
        [
            el.themeDarkHeaderSurface,
            el.themeDarkHeaderText,
            el.themeDarkHeaderBorder,
            el.themeDarkHeaderTransparency
        ].forEach((inp) =>
            on(inp, 'input', () => {
                this.syncThemeModalBrightnessHints();
                surf('dark');
            })
        );
        [
            el.articleStateNewColor,
            el.articleStateSeenColor,
            el.articleStateReadColor
        ].forEach((inp) => on(inp, 'input', () => {
            this.applyArticleStateColorVariables(this.gatherArticleStateColorsFromModalForSave());
        }));

        on(el.themeResetDefaultsBtn, 'click', () => {
            const colorTheme = App.normalizeColorTheme(
                el.settingsColorThemeSelect?.value || this.elements.colorThemeSelect?.value || this.settings?.colorTheme
            );
            const L = getThemeSurfaceDefaults(colorTheme, 'light');
            const D = getThemeSurfaceDefaults(colorTheme, 'dark');
            const HL = THEME_DEFAULT_HEADER.light;
            const HD = THEME_DEFAULT_HEADER.dark;
            if (el.themeLightBgPrimary) {
                el.themeLightBgPrimary.value = L.bgPrimary;
            }
            if (el.themeLightBgSecondary) {
                el.themeLightBgSecondary.value = L.bgSecondary;
            }
            if (el.themeLightBgCard) {
                el.themeLightBgCard.value = L.bgCard;
            }
            if (el.themeLightBorder) {
                el.themeLightBorder.value = L.borderColor;
            }
            if (el.themeDarkBgPrimary) {
                el.themeDarkBgPrimary.value = D.bgPrimary;
            }
            if (el.themeDarkBgSecondary) {
                el.themeDarkBgSecondary.value = D.bgSecondary;
            }
            if (el.themeDarkBgCard) {
                el.themeDarkBgCard.value = D.bgCard;
            }
            if (el.themeDarkBorder) {
                el.themeDarkBorder.value = D.borderColor;
            }
            if (el.themeBrightnessLight) {
                el.themeBrightnessLight.value = '50';
            }
            if (el.themeBrightnessDark) {
                el.themeBrightnessDark.value = '50';
            }
            if (el.themeLightHeaderSurface) {
                el.themeLightHeaderSurface.value = HL.headerSurface;
            }
            if (el.themeLightHeaderText) {
                el.themeLightHeaderText.value = HL.headerText;
            }
            if (el.themeLightHeaderBorder) {
                el.themeLightHeaderBorder.value = HL.headerBorder;
            }
            if (el.themeLightHeaderTransparency) {
                el.themeLightHeaderTransparency.value = String(THEME_DEFAULT_HEADER_TRANSPARENCY.light);
            }
            if (el.themeDarkHeaderSurface) {
                el.themeDarkHeaderSurface.value = HD.headerSurface;
            }
            if (el.themeDarkHeaderText) {
                el.themeDarkHeaderText.value = HD.headerText;
            }
            if (el.themeDarkHeaderBorder) {
                el.themeDarkHeaderBorder.value = HD.headerBorder;
            }
            if (el.themeDarkHeaderTransparency) {
                el.themeDarkHeaderTransparency.value = String(THEME_DEFAULT_HEADER_TRANSPARENCY.dark);
            }
            if (el.articleStateNewColor) {
                el.articleStateNewColor.value = ARTICLE_STATE_COLOR_DEFAULTS.new;
            }
            if (el.articleStateSeenColor) {
                el.articleStateSeenColor.value = ARTICLE_STATE_COLOR_DEFAULTS.seen;
            }
            if (el.articleStateReadColor) {
                el.articleStateReadColor.value = ARTICLE_STATE_COLOR_DEFAULTS.read;
            }
            this.syncThemeModalBrightnessHints();
            this.applyThemeAppearancePreviewFromModal();
            this.applyArticleStateColorVariables(this.gatherArticleStateColorsFromModalForSave());
        });
    }

    bindPreferredColorSchemeListener() {
        if (typeof window === 'undefined' || !window.matchMedia) {
            return;
        }
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        this._prefColorSchemeMq = mq;
        this._onPrefColorSchemeChange = () => {
            if (App.normalizeThemePreference(this.settings?.theme) === 'system') {
                this.applyTheme();
            }
        };
        mq.addEventListener('change', this._onPrefColorSchemeChange);
    }

    /**
     * Loads GET /v1/models (or OpenAI-compatible `…/v1/models`) into the KI settings model `<select>`.
     * @param {string} [presetSavedModel] When opening the modal, pass the stored model id so the selection is correct before `<option>` elements exist.
     */
    async populateModelDropdown(presetSavedModel) {
        const sel = this.elements.lmModel;
        if (!sel) {
            return;
        }
        this._availableLmModels = [];
        let savedModel =
            presetSavedModel !== undefined && presetSavedModel !== null
                ? String(presetSavedModel).trim()
                : String(sel.value || '').trim();
        if (!savedModel) {
            const modelSelectionMode = AISummarizer.normalizeLmModelSelectionMode(
                this.settings?.lmModelSelectionMode
            );
            try {
                const lsModelSelectionMode = AISummarizer.normalizeLmModelSelectionMode(
                    localStorage.getItem('heise_lm_model_selection_mode')
                );
                if (lsModelSelectionMode === 'manual' || modelSelectionMode === 'manual') {
                    savedModel = (localStorage.getItem('heise_lm_model') || '').trim();
                }
            } catch (_) {
                savedModel = '';
            }
        }
        if (
            !savedModel &&
            AISummarizer.normalizeLmModelSelectionMode(this.settings?.lmModelSelectionMode) === 'manual' &&
            this.settings?.lmModel
        ) {
            savedModel = String(this.settings.lmModel).trim();
        }
        const hintEl = document.getElementById('lmModelHint');
        const statusEl = document.getElementById('lmModelLoadedStatus');
        const hideLmLoadedStatus = () => {
            if (!statusEl) {
                return;
            }
            statusEl.textContent = '';
            statusEl.style.display = 'none';
            statusEl.setAttribute('aria-hidden', 'true');
        };
        const showLmLoadedStatus = (text) => {
            if (!statusEl) {
                return;
            }
            statusEl.textContent = text;
            statusEl.style.display = '';
            statusEl.removeAttribute('aria-hidden');
        };
        hideLmLoadedStatus();
        const refreshBtn = this.elements.lmModelRefreshBtn;

        const mode = AISummarizer.normalizeKiApiMode(this.elements.kiApiMode?.value);
        const rawUrl = (this.elements.apiBaseUrl?.value || '').trim();
        let lmRestRoot = 'http://127.0.0.1:1234';
        let apiBaseUrl = 'http://127.0.0.1:1234/v1';
        let anthropicApiBaseUrl = 'https://api.anthropic.com/v1';
        if (mode === 'lm_rest_v1') {
            lmRestRoot = AISummarizer.normalizeLmRestServerRoot(rawUrl || lmRestRoot);
            apiBaseUrl = AISummarizer.normalizeOpenAiApiBase(`${lmRestRoot}/v1`);
        } else if (mode === 'anthropic') {
            anthropicApiBaseUrl = AISummarizer.normalizeAnthropicApiBase(rawUrl || anthropicApiBaseUrl);
        } else {
            apiBaseUrl = AISummarizer.normalizeOpenAiApiBase(rawUrl || apiBaseUrl);
            lmRestRoot = AISummarizer.normalizeLmRestServerRoot(apiBaseUrl);
        }
        const restSameOrigin = mode === 'lm_rest_v1' && this.elements.restSameOrigin?.checked === true;
        const token = this.elements.lmApiToken ? (this.elements.lmApiToken.value || '').trim() : '';

        const listUrl = AISummarizer.getModelsListUrlFromSettings({
            kiApiMode: mode,
            lmRestRoot,
            apiBaseUrl,
            anthropicApiBaseUrl,
            restSameOrigin,
            pageOrigin: typeof window !== 'undefined' && window.location ? window.location.origin : ''
        });

        if (!listUrl) {
            sel.innerHTML = '';
            const auto = document.createElement('option');
            auto.value = '';
            auto.textContent = this._i18nLmModelAutomatic;
            sel.appendChild(auto);
            sel.disabled = true;
            sel.value = '';
            if (refreshBtn) {
                refreshBtn.disabled = true;
            }
            if (hintEl) {
                hintEl.textContent = this._i18nLmModelFileError;
            }
            hideLmLoadedStatus();
            this.syncReasoningControlsForCurrentModel();
            return;
        }

        if (refreshBtn) {
            refreshBtn.disabled = false;
        }
        sel.disabled = true;
        if (hintEl) {
            hintEl.textContent = this._i18nLmModelLoading;
        }

        const ac = new AbortController();
        const to = setTimeout(() => ac.abort(), 25000);
        /** @type {{ ok: true, models: object[] } | { ok: false, error: string }} */
        let result;
        try {
            result = await this.summarizer.fetchAvailableModels(ac.signal, {
                kiApiMode: mode,
                lmRestRoot,
                apiBaseUrl,
                anthropicApiBaseUrl,
                restSameOrigin,
                lmApiToken: token
            });
        } finally {
            clearTimeout(to);
        }

        const loadedMark = this._i18nLmModelLoadedPrefix || '●';

        const appendAutomatic = () => {
            const o = document.createElement('option');
            o.value = '';
            o.textContent =
                mode === 'lm_rest_v1'
                    ? this._i18nLmModelAutomatic
                    : mode === 'anthropic'
                      ? this._i18nAnthropicModelAutomatic || 'Automatic — use first model from GET /v1/models'
                      : this._i18nOpenAiModelAutomatic || 'Automatic — use the default model';
            sel.appendChild(o);
        };

        sel.innerHTML = '';

        if (!result.ok) {
            appendAutomatic();
            const tpl = this._i18nLmModelLoadErrorTpl || '{error}';
            if (hintEl) {
                hintEl.textContent = tpl.replace(/\{error\}/g, String(result.error));
            }
            if (savedModel) {
                const o = document.createElement('option');
                o.value = savedModel;
                const ntpl = this._i18nLmModelNotInListTpl || '{id}';
                o.textContent = ntpl.replace(/\{id\}/g, savedModel);
                o.setAttribute('title', savedModel);
                sel.appendChild(o);
                sel.value = savedModel;
            } else {
                sel.value = '';
            }
            sel.disabled = false;
            hideLmLoadedStatus();
            this.syncReasoningControlsForCurrentModel();
            return;
        }

        appendAutomatic();
        const models = result.models || [];
        this._availableLmModels = [...models];
        const idSet = new Set(models.map((m) => m.id));
        let autoResolvedId = '';
        if (!savedModel) {
            const loadedModel = models.find((m) => m && m.loaded === true);
            const fallbackModel = loadedModel || models[0] || null;
            autoResolvedId = fallbackModel && fallbackModel.id ? String(fallbackModel.id).trim() : '';
            if (autoResolvedId) {
                try {
                    sessionStorage.setItem('heise_lm_resolved_model_id', autoResolvedId);
                } catch (_) {
                    /* ignore */
                }
            }
        }

        for (const m of models) {
            const o = document.createElement('option');
            o.value = m.id;
            o.textContent = AISummarizer.formatModelOptionLabel(m, { loadedMark });
            const tip = AISummarizer.getModelTitleTooltip(m);
            const activeExplicit = Boolean(savedModel && savedModel === m.id);
            const activeAuto = Boolean(!savedModel && autoResolvedId && autoResolvedId === m.id);
            let fullTitle = tip;
            if (activeExplicit || activeAuto) {
                fullTitle += this._i18nLmModelActiveSuffix || '';
            }
            o.setAttribute('title', fullTitle);
            if (activeExplicit || activeAuto) {
                o.setAttribute('data-active', 'true');
            }
            sel.appendChild(o);
        }

        if (savedModel && !idSet.has(savedModel)) {
            const o = document.createElement('option');
            o.value = savedModel;
            const ntpl = this._i18nLmModelNotInListTpl || '{id}';
            o.textContent = ntpl.replace(/\{id\}/g, savedModel);
            o.setAttribute('title', savedModel);
            sel.appendChild(o);
        }

        sel.disabled = false;
        if (hintEl) {
            if (mode === 'anthropic') {
                hintEl.textContent =
                    this._i18nAnthropicModelHint ||
                    'Anthropic: model list is loaded with GET /v1/models. Automatic uses the first returned model; selecting a model pins it.';
            } else if (mode === 'openai') {
                hintEl.textContent =
                    this._i18nOpenAiModelHint ||
                    'OpenAI-compatible: model list is loaded with GET /v1/models when available. Empty selection uses the default model.';
            } else {
                hintEl.textContent = this._i18nLmModelHintDefault || '';
            }
        }
        if (mode === 'lm_rest_v1') {
            const loadedMs = models.filter((m) => m && m.loaded);
            if (loadedMs.length) {
                const names = loadedMs.map((m) => m.displayName || m.id).join(', ');
                const tpl = this._i18nLmModelLoadedStatusLine || 'Loaded in LM Studio: {names}';
                showLmLoadedStatus(tpl.replace(/\{names\}/g, names));
            } else {
                showLmLoadedStatus(this._i18nLmModelLoadedStatusNone || '');
            }
        } else {
            hideLmLoadedStatus();
        }

        if (savedModel) {
            sel.value = savedModel;
            if (sel.value !== savedModel) {
                sel.value = '';
            }
        } else {
            sel.value = '';
        }
        this.syncReasoningControlsForCurrentModel();
    }

    openSettingsModal() {
        let mode = 'lm_rest_v1';
        try {
            mode = localStorage.getItem('heise_ki_api_mode') || this.settings?.kiApiMode || 'lm_rest_v1';
        } catch (_) {
            mode = this.settings?.kiApiMode || 'lm_rest_v1';
        }
        mode = AISummarizer.normalizeKiApiMode(mode);
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
            } else if (mode === 'anthropic') {
                base =
                    localStorage.getItem('heise_anthropic_api_base') ||
                    this.settings?.anthropicApiBaseUrl ||
                    '';
            } else {
                base = localStorage.getItem('heise_api_base') || this.settings?.apiBaseUrl || '';
            }
        } catch (_) {
            if (mode === 'lm_rest_v1') {
                base = this.settings?.lmRestRoot || '';
            } else if (mode === 'anthropic') {
                base = this.settings?.anthropicApiBaseUrl || '';
            } else {
                base = this.settings?.apiBaseUrl || '';
            }
        }
        if (!base) {
            base =
                mode === 'lm_rest_v1'
                    ? 'http://127.0.0.1:1234'
                    : mode === 'anthropic'
                      ? 'https://api.anthropic.com/v1'
                      : 'http://127.0.0.1:1234/v1';
        }

        this.elements.apiBaseUrl.value =
            mode === 'lm_rest_v1'
                ? AISummarizer.normalizeLmRestServerRoot(base)
                : mode === 'anthropic'
                  ? AISummarizer.normalizeAnthropicApiBase(base)
                : AISummarizer.normalizeOpenAiApiBase(base);

        let lmModelSelectionMode = AISummarizer.normalizeLmModelSelectionMode(
            this.settings?.lmModelSelectionMode
        );
        try {
            const lsModelSelectionMode = localStorage.getItem('heise_lm_model_selection_mode');
            if (lsModelSelectionMode) {
                lmModelSelectionMode = AISummarizer.normalizeLmModelSelectionMode(lsModelSelectionMode);
            }
        } catch (_) {
            /* ignore */
        }
        let model = '';
        if (lmModelSelectionMode === 'manual') {
            try {
                model = localStorage.getItem('heise_lm_model') || this.settings?.lmModel || '';
            } catch (_) {
                model = this.settings?.lmModel || '';
            }
        }

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

        let summaryStyleUi = App.normalizeSummaryStyle(this.settings?.summaryStyle);
        try {
            const lsStyle = localStorage.getItem('heise_summary_style');
            if (lsStyle) {
                summaryStyleUi = App.normalizeSummaryStyle(lsStyle);
            }
        } catch (_) {
            /* ignore */
        }
        if (this.elements.summaryStyle) {
            this.elements.summaryStyle.value = summaryStyleUi;
        }

        let summaryStyleCustomUi = App.normalizeSummaryStyleCustom(this.settings?.summaryStyleCustom);
        try {
            const lsStyleCustom = localStorage.getItem('heise_summary_style_custom');
            if (lsStyleCustom != null) {
                summaryStyleCustomUi = App.normalizeSummaryStyleCustom(lsStyleCustom);
            }
        } catch (_) {
            /* ignore */
        }
        if (this.elements.summaryStyleCustom) {
            this.elements.summaryStyleCustom.value = summaryStyleCustomUi;
        }
        this.syncSummaryStyleCustomVisibility();

        if (this.elements.articleTranslationEnabled) {
            this.elements.articleTranslationEnabled.checked = this.settings?.articleTranslationEnabled === true;
        }
        if (this.elements.articleTranslationTargetLang) {
            const atl = String(this.settings?.articleTranslationTargetLang || 'de').trim();
            const sel = this.elements.articleTranslationTargetLang;
            const has = [...sel.options].some((o) => o.value === atl);
            sel.value = has ? atl : 'de';
        }
        if (this.elements.articleTranslationLinkProvider) {
            const ATp = typeof window !== 'undefined' ? window.ArticleTranslation : null;
            const p = ATp
                ? ATp.normalizeLinkProvider(this.settings?.articleTranslationLinkProvider)
                : 'google';
            const sel = this.elements.articleTranslationLinkProvider;
            if ([...sel.options].some((o) => o.value === p)) {
                sel.value = p;
            } else {
                sel.value = 'google';
            }
        }
        this.syncArticleTranslationFormDisabled();

        let reasoningUi = 'off';
        let reasoningEnabledUi = false;
        try {
            let reasoningSource = this.settings?.reasoning;
            let reasoningEnabledSource = this.settings?.reasoningEnabled;
            const lsReasoning = localStorage.getItem('heise_reasoning');
            if (lsReasoning != null && lsReasoning !== '') {
                reasoningSource = lsReasoning;
            }
            const lsReasoningEnabled = localStorage.getItem('heise_reasoning_enabled');
            if (lsReasoningEnabled != null && lsReasoningEnabled !== '') {
                reasoningEnabledSource = lsReasoningEnabled;
            }
            reasoningUi = AISummarizer.normalizeLmReasoningParam(reasoningSource);
            reasoningEnabledUi = AISummarizer.normalizeLmReasoningEnabled(
                reasoningEnabledSource,
                reasoningUi
            );
        } catch (_) {
            reasoningUi = AISummarizer.normalizeLmReasoningParam(this.settings?.reasoning);
            reasoningEnabledUi = AISummarizer.normalizeLmReasoningEnabled(
                this.settings?.reasoningEnabled,
                reasoningUi
            );
        }
        if (this.elements.reasoningSelect) {
            this.elements.reasoningSelect.value = reasoningUi;
        }

        if (this.elements.reasoningEnabledCheckbox) {
            this.elements.reasoningEnabledCheckbox.checked = reasoningEnabledUi;
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

        let forumDiscoveryUi = 'click';
        try {
            forumDiscoveryUi =
                localStorage.getItem('heise_forum_entries_discovery_mode') ||
                this.settings?.forumEntriesDiscoveryMode ||
                'click';
        } catch (_) {
            forumDiscoveryUi = this.settings?.forumEntriesDiscoveryMode || 'click';
        }
        if (this.elements.forumEntriesDiscoveryMode) {
            this.elements.forumEntriesDiscoveryMode.value =
                App.normalizeForumEntriesDiscoveryMode(forumDiscoveryUi);
        }

        let youtubeDiscoveryUi = 'click';
        try {
            youtubeDiscoveryUi =
                localStorage.getItem('heise_youtube_suggestions_discovery_mode') ||
                this.settings?.youtubeSuggestionsDiscoveryMode ||
                'click';
        } catch (_) {
            youtubeDiscoveryUi = this.settings?.youtubeSuggestionsDiscoveryMode || 'click';
        }
        if (this.elements.youtubeSuggestionsDiscoveryMode) {
            this.elements.youtubeSuggestionsDiscoveryMode.value =
                App.normalizeYoutubeSuggestionsDiscoveryMode(youtubeDiscoveryUi);
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
        this.syncKiProviderText();

        this.elements.settingsModal.classList.add('active');
        this._availableLmModels = [];
        void this.populateModelDropdown(model);
    }

    onKiApiModeChange() {
        const mode = AISummarizer.normalizeKiApiMode(
            this.elements.kiApiMode ? this.elements.kiApiMode.value : 'lm_rest_v1'
        );
        let v = (this.elements.apiBaseUrl.value || '').trim();
        if (v) {
            if (mode === 'lm_rest_v1') {
                this.elements.apiBaseUrl.value = AISummarizer.normalizeLmRestServerRoot(v);
            } else if (mode === 'anthropic') {
                const looksLikeDefaultLocal =
                    /^https?:\/\/127\.0\.0\.1:1234\/?v?1?$/i.test(v) ||
                    /^https?:\/\/localhost:1234\/?v?1?$/i.test(v);
                this.elements.apiBaseUrl.value = looksLikeDefaultLocal
                    ? AISummarizer.normalizeAnthropicApiBase('')
                    : AISummarizer.normalizeAnthropicApiBase(v);
            } else {
                this.elements.apiBaseUrl.value = AISummarizer.normalizeOpenAiApiBase(v);
            }
        } else if (mode === 'anthropic') {
            this.elements.apiBaseUrl.value = AISummarizer.normalizeAnthropicApiBase('');
        }
        this.updateRestSameOriginVisibility();
        this.syncKiServerUrlHint();
        this.updateRestSameOriginUi();
        this.syncKiProviderText();
        this._availableLmModels = [];
        if (this.elements.settingsModal && this.elements.settingsModal.classList.contains('active')) {
            void this.populateModelDropdown();
        }
    }

    onRestSameOriginChange() {
        this.syncKiServerUrlHint();
        this.updateRestSameOriginUi();
        this._availableLmModels = [];
        if (this.elements.settingsModal && this.elements.settingsModal.classList.contains('active')) {
            void this.populateModelDropdown();
        }
    }

    onApiBaseUrlUserInput() {
        const mode = AISummarizer.normalizeKiApiMode(
            this.elements.kiApiMode ? this.elements.kiApiMode.value : 'lm_rest_v1'
        );
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
        const mode = AISummarizer.normalizeKiApiMode(
            this.elements.kiApiMode ? this.elements.kiApiMode.value : 'lm_rest_v1'
        );
        const wrap = document.getElementById('restSameOriginWrap');
        if (wrap) {
            wrap.style.display = mode === 'lm_rest_v1' ? 'block' : 'none';
        }
    }

    updateRestSameOriginUi() {
        const mode = AISummarizer.normalizeKiApiMode(
            this.elements.kiApiMode ? this.elements.kiApiMode.value : 'lm_rest_v1'
        );
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
        const mode = AISummarizer.normalizeKiApiMode(
            this.elements.kiApiMode ? this.elements.kiApiMode.value : 'lm_rest_v1'
        );
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
                this._i18nKiHintRest ||
                'Direkt zu LM Studio: Server-Stamm ohne Pfad (kann OPTIONS/CORS erfordern). Beispiel: http://127.0.0.1:1234 — oder CORS-Proxy :1244 / „REST über dieselbe Origin“ mit dev_server.';
        } else if (mode === 'anthropic') {
            hint.textContent =
                this._i18nKiHintAnthropic ||
                'Anthropic Messages API: Basis-URL mit /v1, die App nutzt POST …/v1/messages und GET …/v1/models. Standard: https://api.anthropic.com/v1';
        } else {
            hint.textContent =
                this._i18nKiHintOpenAi ||
                'OpenAI-kompatibel: Basis-URL mit /v1, die App nutzt POST …/v1/chat/completions. Beispiel: http://127.0.0.1:1234/v1';
        }
    }

    syncKiProviderText() {
        const mode = AISummarizer.normalizeKiApiMode(
            this.elements.kiApiMode ? this.elements.kiApiMode.value : 'lm_rest_v1'
        );
        const tokenLabel = document.querySelector('label[for="lmApiToken"]');
        if (tokenLabel) {
            tokenLabel.textContent =
                mode === 'anthropic'
                    ? this._i18nAnthropicApiTokenLabel || 'API key (required)'
                    : this._i18nKiApiTokenLabel || 'API-Token (optional)';
        }
        if (this.elements.lmApiToken) {
            this.elements.lmApiToken.setAttribute(
                'placeholder',
                mode === 'anthropic'
                    ? this._i18nAnthropicApiTokenPlaceholder || 'Anthropic API key'
                    : this._i18nKiApiTokenPlaceholder || 'Nur wenn LM Studio „Require Authentication“ nutzt'
            );
        }
        const hintEl = document.getElementById('lmModelHint');
        if (hintEl) {
            if (mode === 'anthropic') {
                hintEl.textContent =
                    this._i18nAnthropicModelHint ||
                    'Anthropic: model list is loaded with GET /v1/models. Automatic uses the first returned model; selecting a model pins it.';
            } else if (mode === 'openai') {
                hintEl.textContent =
                    this._i18nOpenAiModelHint ||
                    'OpenAI-compatible: model list is loaded with GET /v1/models when available. Empty selection uses the default model.';
            } else {
                hintEl.textContent = this._i18nLmModelHintDefault || '';
            }
        }
    }

    /**
     * @param {'off'|'low'|'medium'|'high'|'on'} value
     * @returns {string}
     */
    getReasoningOptionLabel(value) {
        switch (value) {
            case 'low':
                return this._i18nReasoningLevelLow;
            case 'medium':
                return this._i18nReasoningLevelMedium;
            case 'high':
                return this._i18nReasoningLevelHigh;
            case 'on':
                return this._i18nReasoningLevelOn;
            case 'off':
            default:
                return this._i18nReasoningLevelOff;
        }
    }

    /**
     * @returns {{ capabilitiesKnown: boolean, allowedOptions: Array<'off'|'low'|'medium'|'high'|'on'>, defaultOption: 'off'|'low'|'medium'|'high'|'on'|null, visible: boolean, canEnable: boolean }}
     */
    getReasoningCapabilitiesForCurrentModel() {
        const mode = AISummarizer.normalizeKiApiMode(this.elements.kiApiMode?.value);
        if (mode !== 'lm_rest_v1') {
            return {
                capabilitiesKnown: true,
                allowedOptions: ['off'],
                defaultOption: 'off',
                visible: false,
                canEnable: false
            };
        }

        let activeModelId = String(this.elements.lmModel?.value || '').trim();
        if (!activeModelId) {
            try {
                activeModelId = String(sessionStorage.getItem('heise_lm_resolved_model_id') || '').trim();
            } catch (_) {
                activeModelId = '';
            }
        }

        const findModelEntry = (candidateId) => {
            const normalized = String(candidateId || '').trim();
            if (!normalized || !Array.isArray(this._availableLmModels)) {
                return null;
            }
            return (
                this._availableLmModels.find(
                    (entry) =>
                        entry &&
                        (
                            entry.id === normalized ||
                            (Array.isArray(entry.aliases) && entry.aliases.includes(normalized))
                        )
                ) || null
            );
        };

        let modelEntry = findModelEntry(activeModelId);
        if (!modelEntry && Array.isArray(this._availableLmModels)) {
            const loadedEntries = this._availableLmModels.filter((entry) => entry && entry.loaded === true);
            if (loadedEntries.length === 1) {
                modelEntry = loadedEntries[0];
            } else if (this._availableLmModels.length === 1) {
                modelEntry = this._availableLmModels[0];
            }
        }
        if (!modelEntry) {
            return {
                capabilitiesKnown: false,
                allowedOptions: [],
                defaultOption: null,
                visible: false,
                canEnable: false
            };
        }
        const allowedOptions =
            Array.isArray(modelEntry.reasoningAllowedOptions)
                ? modelEntry.reasoningAllowedOptions.filter(Boolean)
                : [];
        const exposesReasoningConfig = AISummarizer.modelExposesLmReasoningConfig(modelEntry);
        const normalizedAllowed = exposesReasoningConfig ? [...allowedOptions] : ['off'];
        const defaultOption =
            modelEntry.reasoningDefault &&
            normalizedAllowed.includes(modelEntry.reasoningDefault)
                ? modelEntry.reasoningDefault
                : normalizedAllowed.includes('off')
                  ? 'off'
                  : normalizedAllowed[0];

        return {
            capabilitiesKnown: true,
            allowedOptions: normalizedAllowed,
            defaultOption,
            visible: true,
            canEnable: exposesReasoningConfig && normalizedAllowed.some((value) => value !== 'off')
        };
    }

    /**
     * @returns {{ enabled: boolean, level: 'off'|'low'|'medium'|'high'|'on' }}
     */
    getSupportedReasoningConfigForCurrentModel() {
        const config = this.summarizer
            ? this.summarizer.getLmReasoningConfig()
            : { enabled: false, level: 'off' };
        if (!config.enabled) {
            return config;
        }
        const capability = this.getReasoningCapabilitiesForCurrentModel();
        if (!capability.canEnable || !capability.allowedOptions.includes(config.level)) {
            return { enabled: false, level: config.level };
        }
        return config;
    }

    syncReasoningControlsForCurrentModel() {
        const select = this.elements.reasoningSelect;
        const checkbox = this.elements.reasoningEnabledCheckbox;
        if (!select && !checkbox) {
            return;
        }

        const selectGroup = select ? select.closest('.setting-group') : null;
        const checkboxGroup = checkbox ? checkbox.closest('.setting-group') : null;
        const capability = this.getReasoningCapabilitiesForCurrentModel();
        if (!capability.capabilitiesKnown) {
            if (selectGroup) {
                selectGroup.style.display = 'none';
            }
            if (checkboxGroup) {
                checkboxGroup.style.display = 'none';
            }
            if (select) {
                select.disabled = true;
            }
            if (checkbox) {
                checkbox.disabled = true;
            }
            return;
        }

        if (selectGroup) {
            selectGroup.style.display = capability.visible ? '' : 'none';
        }
        if (checkboxGroup) {
            checkboxGroup.style.display = capability.visible ? '' : 'none';
        }

        const currentLevel = select
            ? AISummarizer.normalizeLmReasoningParam(select.value)
            : AISummarizer.normalizeLmReasoningParam(this.settings?.reasoning);
        const nextLevel = capability.allowedOptions.includes(currentLevel)
            ? currentLevel
            : capability.defaultOption;

        if (select) {
            select.innerHTML = '';
            for (const value of capability.allowedOptions) {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = this.getReasoningOptionLabel(value);
                select.appendChild(option);
            }
            select.value = capability.allowedOptions.includes(nextLevel) ? nextLevel : capability.defaultOption;
            select.disabled = !capability.canEnable;
        }

        if (checkbox) {
            if (!capability.canEnable) {
                checkbox.checked = false;
            }
            checkbox.disabled = !capability.canEnable;
        }

        const reasoningHint = document.getElementById('reasoningHint');
        if (reasoningHint) {
            reasoningHint.textContent = this._i18nReasoningLevelHint || '';
        }
        const reasoningEnabledHint = document.getElementById('reasoningEnabledHint');
        if (reasoningEnabledHint) {
            reasoningEnabledHint.textContent = this._i18nReasoningEnabledHint || '';
        }
    }

    closeSettingsModal() {
        this.elements.settingsModal.classList.remove('active');
    }

    openKiStatsModal() {
        this._kiStatsPeriod = 'week';
        this.syncKiStatsPeriodButtons(this._kiStatsPeriod);
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

    /**
     * @param {'week'|'month'|'year'|'all'} period
     */
    syncKiStatsPeriodButtons(period) {
        const normalized = period;
        const allPeriodBtns = document.querySelectorAll('.btn-period');
        if (!allPeriodBtns) {
            return;
        }
        allPeriodBtns.forEach((btn) => {
            const isActive = btn.getAttribute('data-period') === normalized;
            btn.classList.toggle('btn-period-active', isActive);
        });
    }

    hideKiStatsChartTooltip() {
        const tooltip = document.getElementById('kiStatsChartTooltip');
        if (!tooltip) {
            return;
        }
        tooltip.hidden = true;
        tooltip.textContent = '';
    }

    bindKiStatsChartPointTooltips() {
        const svg = document.getElementById('kiStatsChartSvg');
        const tooltip = document.getElementById('kiStatsChartTooltip');
        const chartInner = svg ? svg.closest('.ki-stats-chart-inner') : null;
        if (!svg || !tooltip || !chartInner) {
            return;
        }

        const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
        const positionTooltip = (event, text) => {
            tooltip.textContent = text;
            tooltip.hidden = false;

            const bounds = chartInner.getBoundingClientRect();
            const left = clamp(event.clientX - bounds.left, 16, Math.max(bounds.width - 16, 16));
            const top = clamp(event.clientY - bounds.top - 10, 12, Math.max(bounds.height - 12, 12));
            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
        };

        const points = svg.querySelectorAll('.ki-stats-point');
        points.forEach((point) => {
            const show = (event) => {
                const text = point.getAttribute('data-tooltip');
                if (!text) {
                    this.hideKiStatsChartTooltip();
                    return;
                }
                positionTooltip(event, text);
            };
            point.addEventListener('mouseenter', show);
            point.addEventListener('mousemove', show);
            point.addEventListener('mouseleave', () => this.hideKiStatsChartTooltip());
        });

        svg.onmouseleave = () => this.hideKiStatsChartTooltip();
    }

    refreshKiStatsPanel() {
        const period = this._kiStatsPeriod || 'week';
        const snap =
            typeof KiStats !== 'undefined' && KiStats.getSnapshot ? KiStats.getSnapshot(period) : null;
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
            this.hideKiStatsChartTooltip();
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
        if (cap && this._i18nKiStatsChartNewTpl) {
            cap.textContent = this._i18nKiStatsChartNewTpl;
        }

        // Use the new three-lines chart with support for week/month/year
        const buckets =
            typeof KiStats !== 'undefined' && KiStats.getChartBucketsThreeLines
                ? KiStats.getChartBucketsThreeLines(period, localeTag)
                : [];
        this.renderKiStatsThreeLinesChart(buckets, localeTag);
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

    /**
     * New chart: three lines showing total tokens, avg tokens per article, and avg duration.
     * @param {Array<{ label: string, avgTokens: number|null, totalTokens: number, tokenSamples: number, avgDurationMs: number|null, topModel?: string|null }>} buckets
     * @param {string} localeTag
     */
    renderKiStatsThreeLinesChart(buckets, localeTag) {
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
        
        // Read translations
        const rawTotal = this._i18nKiStatsChartTotalTokens || 'Total tokens';
        const rawAvgTok = this._i18nKiStatsChartAvgTokens || 'Avg. tokens / article';
        const rawAvgDur = this._i18nKiStatsChartAvgDuration || 'Avg. duration';
        const rawTopModel = this._i18nKiStatsTopModel || 'Model';
        const tTotal = esc(rawTotal);
        const tAvgTok = esc(rawAvgTok);
        const tAvgDur = esc(rawAvgDur);
        
        const na = this._i18nKiStatsTokenNa || '—';
        
        const fmtTok = (v) =>
            Number.isFinite(v) ? Math.round(v).toLocaleString(localeTag || undefined) : '0';
        const fmtDur = (v) => {
            if (!Number.isFinite(v)) return na;
            const mins = Math.floor(v / 60000);
            const secs = ((v % 60000) / 1000).toFixed(1);
            return `${mins}:${secs.toString().padStart(5, '0')} min`;
        };
        
        const buildPointTooltip = (label, metricLabel, valueText, topModel) => {
            const parts = [`${label} • ${metricLabel}: ${valueText}`];
            if (topModel) {
                parts.push(`${rawTopModel}: ${topModel}`);
            }
            return esc(parts.join(' • '));
        };

        const tipTotal = (b) => buildPointTooltip(b.label, rawTotal, fmtTok(b.totalTokens), b.topModel);
        const tipAvgTok = (b) => {
            if (b.avgTokens != null && b.avgTokens >= 0) {
                return buildPointTooltip(b.label, rawAvgTok, fmtTok(b.avgTokens), b.topModel);
            }
            return buildPointTooltip(b.label, rawAvgTok, na, b.topModel);
        };
        const tipAvgDur = (b) => buildPointTooltip(b.label, rawAvgDur, fmtDur(b.avgDurationMs || 0), b.topModel);

        /** Color palette */
        const colTotal = '#2563eb'; // blue-600
        const colAvgTok = '#10b981'; // emerald-500
        const colAvgDur = '#f59e0b'; // amber-500
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

        // Find max values for scaling
        const eps = 1e-9;
        const maxTotal = Math.max(...buckets.map((b) => b.totalTokens), eps);
        
        // For avg tokens and duration, only consider entries with data
        const avgTokVals = buckets.map((b) => (b.avgTokens != null && b.avgTokens > 0 ? b.avgTokens : eps));
        const maxAvgTok = Math.max(...avgTokVals);
        
        const avgDurVals = buckets.map((b) => (b.avgDurationMs != null && b.avgDurationMs > 0 ? b.avgDurationMs : eps));
        const maxAvgDur = Math.max(...avgDurVals);

        const yTop = padT + 36;
        const yBot = H - padB;
        const plotH = yBot - yTop;
        const innerW = W - padL - padR;
        const xStep = innerW / (n - 1 || 1);
        
        // Helper to map value to Y coordinate
        const yFor = (val, max) => yBot - (val / max) * plotH;
        
        const parts = [];
        parts.push(`<rect width="${W}" height="${H}" fill="none"/>`);

        // Legend
        const legY = 20;
        const legItems = [
            { c: colTotal, t: tTotal },
            { c: colAvgTok, t: tAvgTok },
            { c: colAvgDur, t: tAvgDur }
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

        // Horizontal grid lines (0%, 25%, 50%, 75%, 100%)
        for (let g = 0; g <= 4; g++) {
            const pct = (g / 4) * 100;
            const y = yBot - (plotH * g) / 4;
            parts.push(
                `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${gridStroke}" stroke-width="1"/>`
            );
            parts.push(
                `<text x="${padL - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="${muted}">${Math.round(pct)}%</text>`
            );
        }

        // Y-axis title (i18n)
        const yMid = (yTop + yBot) / 2;
        const rawYTitle = this._i18nKiStatsChartYTitle || '% of max';
        parts.push(
            `<text transform="rotate(-90 ${18} ${yMid})" x="18" y="${yMid}" text-anchor="middle" font-size="11" fill="${muted}">${esc(rawYTitle)}</text>`
        );

        // Axes frame
        parts.push(
            `<line x1="${padL}" y1="${yTop}" x2="${padL}" y2="${yBot}" stroke="${axisStroke}" stroke-width="1.5"/>`
        );
        parts.push(
            `<line x1="${padL}" y1="${yBot}" x2="${W - padR}" y2="${yBot}" stroke="${axisStroke}" stroke-width="1.5"/>`
        );

        // Calculate X positions
        const xPositions = [];
        for (let i = 0; i < n; i++) {
            xPositions.push(padL + (i * innerW) / (n - 1 || 1));
        }

        // Draw curves using SVG polylines (segments for gaps, include zeros)
        const drawLine = (vals, color, maxVal) => {
            if (!vals.some((v) => Number.isFinite(v) && v >= 0)) return '';
            
            /** @type {string[]} */
            const segments = [];
            let currentSegmentPoints = [];
            
            for (let i = 0; i < vals.length; i++) {
                const val = vals[i];
                if (Number.isFinite(val) && val >= 0) {
                    // Valid value: add to current segment
                    const x = xPositions[i];
                    const y = yFor(val, maxVal);
                    currentSegmentPoints.push(`${x},${y}`);
                } else {
                    // Invalid/gap: emit current segment if length >= 2, reset
                    if (currentSegmentPoints.length >= 2) {
                        segments.push(`<polyline fill="none" stroke="${color}" stroke-width="3" points="${currentSegmentPoints.join(' ')}"/>`);
                    }
                    currentSegmentPoints = [];
                }
            }
            // Emit final segment if length >= 2
            if (currentSegmentPoints.length >= 2) {
                segments.push(`<polyline fill="none" stroke="${color}" stroke-width="3" points="${currentSegmentPoints.join(' ')}"/>`);
            }
            
            return segments.join('');
        };

        const valsTotal = buckets.map((b) => b.totalTokens);
        const valsAvgTok = buckets.map((b) => (Number.isFinite(b.avgTokens) && b.avgTokens >= 0 ? b.avgTokens : NaN));
        const valsAvgDur = buckets.map((b) => (Number.isFinite(b.avgDurationMs) && b.avgDurationMs >= 0 ? b.avgDurationMs : NaN));

        parts.push(drawLine(valsTotal, colTotal, maxTotal));
        parts.push(drawLine(valsAvgTok, colAvgTok, maxAvgTok));
        parts.push(drawLine(valsAvgDur, colAvgDur, maxAvgDur));

        // Data points with tooltips (include zeros)
        const drawPoints = (vals, color, maxVal, tooltipFn) => {
            return vals.map((val, i) => {
                if (!Number.isFinite(val) || val < 0) return '';
                const x = xPositions[i];
                const y = yFor(val, maxVal);
                const tooltipText = tooltipFn({ ...buckets[i], avgDurationMs: buckets[i].avgDurationMs || 0 });
                return [
                    `<circle class="ki-stats-point-marker" cx="${x}" cy="${y}" r="4" fill="${color}"></circle>`,
                    `<circle class="ki-stats-point" cx="${x}" cy="${y}" r="12" fill="transparent" pointer-events="all" data-tooltip="${tooltipText}"></circle>`
                ].join('');
            }).join('');
        };

        parts.push(drawPoints(valsTotal, colTotal, maxTotal, (b) => tipTotal(b)));
        parts.push(drawPoints(valsAvgTok, colAvgTok, maxAvgTok, (b) => tipAvgTok(b)));
        parts.push(drawPoints(valsAvgDur, colAvgDur, maxAvgDur, (b) => tipAvgDur(b)));

        // X-axis labels
        const labelY = yBot + 18;
        let labelStep = 1;
        if (n > 24) {
            labelStep = 4;
        } else if (n > 16) {
            labelStep = 3;
        } else if (n > 10) {
            labelStep = 2;
        }
        for (let i = 0; i < n; i++) {
            const isLast = i === n - 1;
            if (!isLast && i % labelStep !== 0) {
                continue;
            }
            const cx = xPositions[i];
            const lab = esc(buckets[i].label);
            parts.push(
                `<text transform="rotate(-32 ${cx} ${labelY})" x="${cx}" y="${labelY}" text-anchor="end" font-size="10" fill="${muted}">${lab}</text>`
            );
        }

        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.innerHTML = parts.join('');
        this.hideKiStatsChartTooltip();
        this.bindKiStatsChartPointTooltips();
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

    switchKiStatsPeriod(btn) {
        const rawPeriod = btn.getAttribute('data-period');
        const period = rawPeriod === 'day' ? 'week' : rawPeriod;
        if (!period) return;

        this.syncKiStatsPeriodButtons(period);

        // Store period
        this._kiStatsPeriod = period;

        // Refresh chart
        this.refreshKiStatsPanel();
    }

    rebuildNewsSourceSelect() {
        const sel = this.elements.newsSourceSelect;
        if (!sel) {
            return;
        }
        const enabled = this.getSortedEnabledNewsSourceIds();
        const reg =
            typeof window !== 'undefined' && window.NEWS_SOURCES_REGISTRY
                ? window.NEWS_SOURCES_REGISTRY
                : [];
        const byId = new Map(reg.map((r) => [r.id, r]));
        const current =
            (this.settings && this.settings.newsSource) ||
            (this.elements.newsSourceSelect && this.elements.newsSourceSelect.value) ||
            '';
        sel.innerHTML = '';
        for (const id of enabled) {
            const opt = document.createElement('option');
            opt.value = id;
            const entry = byId.get(id);
            opt.textContent =
                (this._i18nNewsSourceLabels && this._i18nNewsSourceLabels[id]) ||
                (entry && (entry.displayName || entry.siteUrl)) ||
                App.getSourceDisplayName(id) ||
                id;
            const siteUrl = (entry && entry.siteUrl) || App.getSourceSiteUrl(id);
            if (siteUrl) {
                opt.setAttribute('data-site-url', siteUrl);
            }
            sel.appendChild(opt);
        }
        const next = App.normalizeNewsSourceWithEnabled(current, enabled);
        if (next) {
            sel.value = next;
        }
        this.refreshHeaderSourceControls();
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
            const name = labels[row.id] || row.displayName || row.siteUrl || row.id;
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
        this.setDashboardSourceSettingsDisabled(this._selectedSourcesGenerationInProgress);
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
        if (this._selectedSourcesGenerationInProgress) {
            btn.disabled = true;
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
        if (this._selectedSourcesGenerationInProgress) {
            return;
        }
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

    setDashboardSourceSettingsDisabled(disabled) {
        const sourceSettingsDisabled = disabled === true;
        if (this.elements.dashboardSettingsBtn) {
            this.elements.dashboardSettingsBtn.disabled = sourceSettingsDisabled;
        }
        if (this.elements.newsSourcesFilterInput) {
            this.elements.newsSourcesFilterInput.disabled = sourceSettingsDisabled;
        }
        if (this.elements.saveDashboardSettings) {
            this.elements.saveDashboardSettings.disabled = sourceSettingsDisabled;
        }
        if (this.elements.newsSourcesToggleVisibleBtn) {
            this.elements.newsSourcesToggleVisibleBtn.disabled = sourceSettingsDisabled;
        }
        if (this.elements.backgroundSelectedSourcesRefreshEnabled) {
            this.elements.backgroundSelectedSourcesRefreshEnabled.disabled = sourceSettingsDisabled;
        }
        if (this.elements.backgroundSelectedSourcesRefreshScopeSelect) {
            this.elements.backgroundSelectedSourcesRefreshScopeSelect.disabled =
                sourceSettingsDisabled || !this.isBackgroundSelectedSourcesRefreshEnabled();
        }
        const ul = this.elements.newsSourcesSettingsList;
        if (ul) {
            ul.querySelectorAll(
                'input.news-sources-settings__source-cb, input.heise-magazine-feed-cb'
            ).forEach((input) => {
                input.disabled = sourceSettingsDisabled;
            });
        }
        if (!sourceSettingsDisabled) {
            this.syncNewsSourcesToggleVisibleBtn();
        }
    }

    async openDashboardSettingsModal() {
        if (this._selectedSourcesGenerationInProgress) {
            this.showStatus(
                this._i18nSelectedSourcesGenerationStatusBusy ||
                    'Source generation in progress - please wait',
                true
            );
            this.openSelectedSourcesGenerationModal();
            this.setDashboardSourceSettingsDisabled(true);
            return;
        }
        await this.applySortLabelsFromLocale();
        this.renderNewsSourcesSettingsChecklist();
        if (this.elements.newsSourcesFilterInput) {
            this.elements.newsSourcesFilterInput.value = '';
        }
        this.filterNewsSourcesSettingsList();
        this.populateThemeSettingsModal();
        if (this.elements.articleThumbnailsEnabled) {
            this.elements.articleThumbnailsEnabled.checked = this.areArticleThumbnailsEnabled();
        }
        if (this.elements.backgroundSelectedSourcesRefreshEnabled) {
            this.elements.backgroundSelectedSourcesRefreshEnabled.checked =
                this.isBackgroundSelectedSourcesRefreshEnabled();
        }
        if (this.elements.backgroundSelectedSourcesRefreshScopeSelect) {
            this.elements.backgroundSelectedSourcesRefreshScopeSelect.value =
                this.getBackgroundSelectedSourcesRefreshScope();
            this.elements.backgroundSelectedSourcesRefreshScopeSelect.disabled =
                !this.isBackgroundSelectedSourcesRefreshEnabled();
        }
        if (this.elements.dashboardSettingsModal) {
            this.elements.dashboardSettingsModal.classList.add('active');
        }
    }

    closeDashboardSettingsModal() {
        this.restoreThemeAppearanceFromPersistedSettings();
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
        if (this._selectedSourcesGenerationInProgress) {
            this.showStatus(
                this._i18nSelectedSourcesGenerationStatusBusy ||
                    'Source generation in progress - please wait',
                true
            );
            this.openSelectedSourcesGenerationModal();
            this.setDashboardSourceSettingsDisabled(true);
            return;
        }
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
        const prevArticleThumbnailsEnabled = this.areArticleThumbnailsEnabled();

        const themePrefSaved = this.elements.themeModeSelect
            ? App.normalizeThemePreference(this.elements.themeModeSelect.value)
            : App.normalizeThemePreference(this.settings?.theme);
        const colorThemeSaved = this.elements.settingsColorThemeSelect
            ? App.normalizeColorTheme(this.elements.settingsColorThemeSelect.value)
            : App.normalizeColorTheme(this.settings?.colorTheme);
        const themeCustomColorsSaved = this.gatherThemeCustomColorsFromModalForSave();
        const themeCustomHeaderColorsSaved = this.gatherThemeCustomHeaderColorsFromModalForSave();
        const articleStateColorsSaved = this.gatherArticleStateColorsFromModalForSave();
        const themeSurfaceBrightnessSaved =
            this.elements.themeBrightnessLight && this.elements.themeBrightnessDark
                ? App.normalizeThemeSurfaceBrightness({
                      light: parseInt(this.elements.themeBrightnessLight.value, 10),
                      dark: parseInt(this.elements.themeBrightnessDark.value, 10),
                      version: 2
                  })
                : App.normalizeThemeSurfaceBrightness(this.settings?.themeSurfaceBrightness);
        const themeHeaderTransparencySaved =
            this.elements.themeLightHeaderTransparency && this.elements.themeDarkHeaderTransparency
                ? App.normalizeThemeHeaderTransparency({
                      light: parseInt(this.elements.themeLightHeaderTransparency.value, 10),
                      dark: parseInt(this.elements.themeDarkHeaderTransparency.value, 10),
                      version: 1
                  })
                : App.normalizeThemeHeaderTransparency(this.settings?.themeHeaderTransparency);
        const articleThumbnailsEnabledSaved = this.elements.articleThumbnailsEnabled
            ? App.normalizeArticleThumbnailsEnabled(this.elements.articleThumbnailsEnabled.checked)
            : prevArticleThumbnailsEnabled;
        const thumbnailsChanged = articleThumbnailsEnabledSaved !== prevArticleThumbnailsEnabled;
        const backgroundSelectedSourcesRefreshEnabledSaved =
            this.elements.backgroundSelectedSourcesRefreshEnabled
                ? App.normalizeBackgroundSelectedSourcesRefreshEnabled(
                      this.elements.backgroundSelectedSourcesRefreshEnabled.checked
                  )
                : this.isBackgroundSelectedSourcesRefreshEnabled();
        const backgroundSelectedSourcesRefreshScopeSaved =
            this.elements.backgroundSelectedSourcesRefreshScopeSelect
                ? App.normalizeBackgroundSelectedSourcesRefreshScope(
                      this.elements.backgroundSelectedSourcesRefreshScopeSelect.value
                  )
                : this.getBackgroundSelectedSourcesRefreshScope();

        try {
            localStorage.setItem('theme', themePrefSaved);
            localStorage.setItem('heise_color_theme', colorThemeSaved);
            localStorage.setItem('heise_theme_custom_colors', JSON.stringify(themeCustomColorsSaved));
            localStorage.setItem('heise_theme_custom_header_colors', JSON.stringify(themeCustomHeaderColorsSaved));
            localStorage.setItem('heise_theme_surface_brightness', JSON.stringify(themeSurfaceBrightnessSaved));
            localStorage.setItem('heise_theme_header_transparency', JSON.stringify(themeHeaderTransparencySaved));
            localStorage.setItem('heise_article_thumbnails_enabled', articleThumbnailsEnabledSaved ? '1' : '0');
            localStorage.setItem('heise_article_state_colors', JSON.stringify(articleStateColorsSaved));
        } catch (_) {
            /* ignore */
        }

        const prev = this.settings.newsSource;
        this.settings.enabledNewsSources = enabled;
        this.settings.enabledHeiseMagazines = nextMagazines;
        this.settings.theme = themePrefSaved;
        this.settings.colorTheme = colorThemeSaved;
        this.settings.themeCustomColors = themeCustomColorsSaved;
        this.settings.themeCustomHeaderColors = themeCustomHeaderColorsSaved;
        this.settings.articleStateColors = articleStateColorsSaved;
        this.settings.themeSurfaceBrightness = themeSurfaceBrightnessSaved;
        this.settings.themeHeaderTransparency = themeHeaderTransparencySaved;
        this.settings.articleThumbnailsEnabled = articleThumbnailsEnabledSaved;
        this.settings.backgroundSelectedSourcesRefreshEnabled =
            backgroundSelectedSourcesRefreshEnabledSaved;
        this.settings.backgroundSelectedSourcesRefreshScope =
            backgroundSelectedSourcesRefreshScopeSaved;
        try {
            localStorage.setItem('heise_enabled_news_sources', JSON.stringify(enabled));
            localStorage.setItem('heise_enabled_magazine_feeds', JSON.stringify(nextMagazines));
        } catch (_) {
            /* ignore */
        }
        try {
            await this.storage.saveSettings({
                enabledNewsSources: enabled,
                enabledHeiseMagazines: nextMagazines,
                theme: themePrefSaved,
                colorTheme: colorThemeSaved,
                themeCustomColors: themeCustomColorsSaved,
                themeCustomHeaderColors: themeCustomHeaderColorsSaved,
                articleStateColors: articleStateColorsSaved,
                themeSurfaceBrightness: themeSurfaceBrightnessSaved,
                themeHeaderTransparency: themeHeaderTransparencySaved,
                articleThumbnailsEnabled: articleThumbnailsEnabledSaved,
                backgroundSelectedSourcesRefreshEnabled:
                    backgroundSelectedSourcesRefreshEnabledSaved,
                backgroundSelectedSourcesRefreshScope:
                    backgroundSelectedSourcesRefreshScopeSaved
            });
        } catch (e) {
            console.warn('saveDashboardSettings:', e);
        }
        this.applyTheme();
        this.applyColorTheme();
        this.applyArticleStateColorVariables(articleStateColorsSaved);
        App.syncHeiseMagazineFeedMirror(nextMagazines);

        this.rebuildNewsSourceSelect();
        await this.applySortLabelsFromLocale();

        const next = App.normalizeNewsSourceWithEnabled(prev, this.getSortedEnabledNewsSourceIds());
        if (this.elements.newsSourceSelect) {
            this.elements.newsSourceSelect.value = next;
        }
        this.refreshHeaderSourceControls();

        if (next !== prev) {
            await this.onNewsSourceChange();
        } else if (magazinesChanged && next === 'heise') {
            await this.fetchNews(true);
        } else if (thumbnailsChanged) {
            await this.applySortPipeline({ render: true });
            this.showStatus(this._i18nDashboardSaved || 'Einstellungen gespeichert.');
        } else {
            this.showStatus(this._i18nDashboardSaved || 'Einstellungen gespeichert.');
        }
        // Enabling the background refresh should prewarm favorites promptly, not only on the next interval.
        this.scheduleImmediateBackgroundRefresh(2000);
        this.closeDashboardSettingsModal();
    }

    async saveSettings() {
        const prevArticleTranslation = {
            on: this.settings?.articleTranslationEnabled === true,
            lang: String(this.settings?.articleTranslationTargetLang || 'de'),
            prov:
                typeof window !== 'undefined' && window.ArticleTranslation
                    ? window.ArticleTranslation.normalizeLinkProvider(this.settings?.articleTranslationLinkProvider)
                    : 'google'
        };

        const mode = AISummarizer.normalizeKiApiMode(
            this.elements.kiApiMode ? this.elements.kiApiMode.value : 'lm_rest_v1'
        );

        const raw = (this.elements.apiBaseUrl.value || '').trim();
        let apiBaseUrl = AISummarizer.normalizeOpenAiApiBase(this.settings?.apiBaseUrl || '');
        let lmRestRoot = AISummarizer.normalizeLmRestServerRoot(this.settings?.lmRestRoot || '');
        let anthropicApiBaseUrl = AISummarizer.normalizeAnthropicApiBase(
            this.settings?.anthropicApiBaseUrl || ''
        );
        if (mode === 'lm_rest_v1') {
            lmRestRoot = AISummarizer.normalizeLmRestServerRoot(raw);
            apiBaseUrl = AISummarizer.normalizeOpenAiApiBase(`${lmRestRoot}/v1`);
            this.elements.apiBaseUrl.value = lmRestRoot;
        } else if (mode === 'anthropic') {
            anthropicApiBaseUrl = AISummarizer.normalizeAnthropicApiBase(raw);
            this.elements.apiBaseUrl.value = anthropicApiBaseUrl;
        } else {
            apiBaseUrl = AISummarizer.normalizeOpenAiApiBase(raw);
            lmRestRoot = AISummarizer.normalizeLmRestServerRoot(apiBaseUrl);
            this.elements.apiBaseUrl.value = apiBaseUrl;
        }

        const lmModel = (this.elements.lmModel.value || '').trim();
        const lmModelSelectionMode = lmModel ? 'manual' : 'auto';
        const lmApiToken = this.elements.lmApiToken ? (this.elements.lmApiToken.value || '').trim() : '';
        const restSameOrigin =
            mode === 'lm_rest_v1' && this.elements.restSameOrigin
                ? this.elements.restSameOrigin.checked === true
                : false;

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

        const reasoningCapability = this.getReasoningCapabilitiesForCurrentModel();
        const preserveStoredReasoning = mode === 'lm_rest_v1' && !reasoningCapability.capabilitiesKnown;
        let reasoningLevel = preserveStoredReasoning
            ? AISummarizer.normalizeLmReasoningParam(this.settings?.reasoning)
            : this.elements.reasoningSelect
              ? AISummarizer.normalizeLmReasoningParam(this.elements.reasoningSelect.value)
              : AISummarizer.normalizeLmReasoningParam(this.settings?.reasoning);

        const reasoningEnabled = preserveStoredReasoning
            ? AISummarizer.normalizeLmReasoningEnabled(this.settings?.reasoningEnabled, reasoningLevel)
            : this.elements.reasoningEnabledCheckbox
              ? this.elements.reasoningEnabledCheckbox.checked === true
              : AISummarizer.normalizeLmReasoningEnabled(this.settings?.reasoningEnabled, reasoningLevel);

        const reasoningLevelForStorage = reasoningLevel;

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

        const summaryStyleSaved = this.elements.summaryStyle
            ? App.normalizeSummaryStyle(this.elements.summaryStyle.value)
            : App.normalizeSummaryStyle(this.settings?.summaryStyle);
        const summaryStyleCustomSaved = this.elements.summaryStyleCustom
            ? App.normalizeSummaryStyleCustom(this.elements.summaryStyleCustom.value)
            : App.normalizeSummaryStyleCustom(this.settings?.summaryStyleCustom);

        const articleTranslationEnabled =
            this.elements.articleTranslationEnabled &&
            this.elements.articleTranslationEnabled.checked === true;
        const ATs = typeof window !== 'undefined' ? window.ArticleTranslation : null;
        const articleTranslationTargetLang = ATs
            ? ATs.normalizeTargetLang(
                  this.elements.articleTranslationTargetLang && this.elements.articleTranslationTargetLang.value
              )
            : 'de';
        const articleTranslationLinkProvider = ATs
            ? ATs.normalizeLinkProvider(
                  this.elements.articleTranslationLinkProvider &&
                      this.elements.articleTranslationLinkProvider.value
              )
            : 'google';

        const alternativeLinksDisplayModeSaved = this.elements.alternativeLinksDisplayMode
            ? App.normalizeAlternativeLinksDisplayMode(this.elements.alternativeLinksDisplayMode.value)
            : App.normalizeAlternativeLinksDisplayMode(this.settings?.alternativeLinksDisplayMode);
        const forumEntriesDiscoveryModeSaved = this.elements.forumEntriesDiscoveryMode
            ? App.normalizeForumEntriesDiscoveryMode(this.elements.forumEntriesDiscoveryMode.value)
            : App.normalizeForumEntriesDiscoveryMode(this.settings?.forumEntriesDiscoveryMode);
        const youtubeSuggestionsDiscoveryModeSaved = this.elements.youtubeSuggestionsDiscoveryMode
            ? App.normalizeYoutubeSuggestionsDiscoveryMode(this.elements.youtubeSuggestionsDiscoveryMode.value)
            : App.normalizeYoutubeSuggestionsDiscoveryMode(this.settings?.youtubeSuggestionsDiscoveryMode);
        const alternativeLinksDomainBlacklistSaved = this.elements.alternativeLinksBlacklist
            ? App.normalizeAlternativeLinksDomainBlacklist(this.elements.alternativeLinksBlacklist.value)
            : App.normalizeAlternativeLinksDomainBlacklist(this.settings?.alternativeLinksDomainBlacklist);

        try {
            localStorage.setItem('heise_ki_api_mode', mode);
            localStorage.setItem('heise_api_base', apiBaseUrl);
            localStorage.setItem('heise_lm_rest_root', lmRestRoot);
            localStorage.setItem('heise_anthropic_api_base', anthropicApiBaseUrl);
            localStorage.setItem('heise_lm_model', lmModel);
            localStorage.setItem('heise_lm_model_selection_mode', lmModelSelectionMode);
            try {
                sessionStorage.removeItem('heise_lm_resolved_model_id');
                sessionStorage.removeItem('heise_anthropic_resolved_model_id');
            } catch (_) {
                /* ignore */
            }
            localStorage.setItem('heise_lm_api_token', lmApiToken);
            localStorage.setItem('heise_summary_cache_days', String(summaryCacheDays));
            localStorage.setItem('heise_summary_concurrency', String(summaryConcurrencySaved));
            localStorage.setItem('heise_ki_request_timeout_sec', String(summaryRequestTimeoutSaved));
            localStorage.setItem('heise_reasoning', reasoningLevelForStorage);
            localStorage.setItem('heise_reasoning_enabled', reasoningEnabled ? '1' : '0');

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
                localStorage.setItem(
                    'heise_forum_entries_discovery_mode',
                    forumEntriesDiscoveryModeSaved
                );
            } catch (_) {
                /* ignore */
            }
            try {
                localStorage.setItem(
                    'heise_youtube_suggestions_discovery_mode',
                    youtubeSuggestionsDiscoveryModeSaved
                );
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
            localStorage.setItem('heise_summary_style', summaryStyleSaved);
            localStorage.setItem('heise_summary_style_custom', summaryStyleCustomSaved);
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
            disabledCategoriesBySource: this.disabledCategoriesBySource,
            kiApiMode: mode,
            apiBaseUrl,
            lmRestRoot,
            anthropicApiBaseUrl,
            lmApiToken,
            restSameOrigin,
            summaryCacheDays,
            summaryConcurrency: summaryConcurrencySaved,
            summaryRequestTimeoutSeconds: summaryRequestTimeoutSaved,
            lmModel,
            lmModelSelectionMode,
            reasoning: reasoningLevelForStorage,
            reasoningEnabled,
            alternativeLinksCount,
            alternativeLinksDisplayMode: alternativeLinksDisplayModeSaved,
            forumEntriesDiscoveryMode: forumEntriesDiscoveryModeSaved,
            youtubeSuggestionsDiscoveryMode: youtubeSuggestionsDiscoveryModeSaved,
            alternativeLinksDomainBlacklist: alternativeLinksDomainBlacklistSaved,
            webSearchEngine: webSearchEngineSaved,
            summaryLangMode:
                this.elements.summaryLangMode && this.elements.summaryLangMode.value === 'browser'
                    ? 'browser'
                    : 'site',
            summaryStyle: summaryStyleSaved,
            summaryStyleCustom: summaryStyleCustomSaved,
            articleTranslationEnabled,
            articleTranslationTargetLang,
            articleTranslationLinkProvider,
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

            this.applyTheme();
            this.applyColorTheme();

            const nextArticleTranslation = {
                on: settings.articleTranslationEnabled === true,
                lang: String(settings.articleTranslationTargetLang || 'de'),
                prov:
                    typeof window !== 'undefined' && window.ArticleTranslation
                        ? window.ArticleTranslation.normalizeLinkProvider(settings.articleTranslationLinkProvider)
                        : 'google'
            };
            const articleTranslationNeedsReload =
                prevArticleTranslation.on !== nextArticleTranslation.on ||
                (nextArticleTranslation.on &&
                    prevArticleTranslation.on &&
                    (prevArticleTranslation.lang !== nextArticleTranslation.lang ||
                        prevArticleTranslation.prov !== nextArticleTranslation.prov));

            if (articleTranslationNeedsReload) {
                this.clearArticleTranslationCookieIfDisabled();
                try {
                    if (!nextArticleTranslation.on) {
                        document.cookie = 'googtrans=;path=/;max-age=0';
                    }
                } catch (_) {
                    /* ignore */
                }
                this.closeSettingsModal();
                this.showStatus(
                    this._i18nArticleTranslationReloadStatus ||
                        'Translation settings saved. Reloading the page …',
                    false
                );
                window.setTimeout(() => {
                    window.location.reload();
                }, 400);
                return;
            }

            this.refreshArticleTranslationToolbarFromSettings();
            this.scheduleArticleInPlaceTranslation();

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
            void this.runScheduledAutoUpdate();
        }, interval * 60 * 1000);

        console.log(`Auto-update timer: alle ${interval} Minuten`);
    }

    /**
     * Kick one background refresh soon after start / after enabling the setting, so favorite sources
     * get prewarmed without waiting for the full header interval. The visible source is already loaded,
     * so this skips the current-source refresh and only prewarms the background (favorite) sources.
     * @param {number} [delayMs]
     */
    scheduleImmediateBackgroundRefresh(delayMs = 8000) {
        if (this._immediateBackgroundRefreshTimer) {
            clearTimeout(this._immediateBackgroundRefreshTimer);
            this._immediateBackgroundRefreshTimer = null;
        }
        if (!this.isBackgroundSelectedSourcesRefreshEnabled()) {
            return;
        }
        this._immediateBackgroundRefreshTimer = setTimeout(() => {
            this._immediateBackgroundRefreshTimer = null;
            void this.runScheduledAutoUpdate({ skipCurrentSourceRefresh: true });
        }, Math.max(0, delayMs));
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
        /* Disabled: No visibilitychange listener anymore */
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
        if (this._immediateBackgroundRefreshTimer) {
            clearTimeout(this._immediateBackgroundRefreshTimer);
            this._immediateBackgroundRefreshTimer = null;
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
