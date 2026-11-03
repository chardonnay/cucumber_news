/**
 * Cucumber NewsScraper — canonical news source ids and site URLs (registry).
 *
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Daniel Mengel
 */
(function (global) {
    function freezeDeep(value) {
        if (Array.isArray(value)) {
            return Object.freeze(value.map((x) => freezeDeep(x)));
        }
        if (value && typeof value === 'object') {
            const out = {};
            Object.keys(value).forEach((key) => {
                out[key] = freezeDeep(value[key]);
            });
            return Object.freeze(out);
        }
        return value;
    }

    function normalizeHostname(raw) {
        let s = String(raw || '')
            .trim()
            .toLowerCase();
        if (!s) {
            return '';
        }
        try {
            if (s.includes('://')) {
                s = new URL(s).hostname;
            }
        } catch (_) {
            /* keep raw */
        }
        s = s.replace(/^\*\./, '').replace(/^\.+|\.+$/g, '');
        if (s.startsWith('www.')) {
            s = s.slice(4);
        }
        return s;
    }

    function normalizeSearchSite(raw) {
        let s = String(raw || '')
            .trim()
            .toLowerCase();
        if (!s) {
            return '';
        }
        try {
            if (s.includes('://')) {
                const u = new URL(s);
                s = `${u.hostname}${u.pathname || ''}`;
            }
        } catch (_) {
            /* keep raw */
        }
        s = s.replace(/^\*\./, '').replace(/^\.+|\.+$/g, '');
        if (s.startsWith('www.')) {
            s = s.slice(4);
        }
        const cut = s.search(/[?#]/);
        if (cut >= 0) {
            s = s.slice(0, cut);
        }
        s = s.replace(/\/{2,}/g, '/').replace(/\/$/, '');
        if (!/^[a-z0-9./-]+$/.test(s) || !s.includes('.')) {
            return '';
        }
        return s;
    }

    function siteUrlToHost(siteUrl) {
        try {
            return normalizeHostname(new URL(String(siteUrl || '')).hostname);
        } catch (_) {
            return '';
        }
    }

    function siteUrlToSearchSite(siteUrl) {
        try {
            const u = new URL(String(siteUrl || ''));
            const host = normalizeHostname(u.hostname);
            if (!host) {
                return '';
            }
            const path = String(u.pathname || '')
                .replace(/\/{2,}/g, '/')
                .replace(/\/$/, '');
            return normalizeSearchSite(`${host}${path}`);
        } catch (_) {
            return '';
        }
    }

    /** @type {readonly { id: string, siteUrl: string, displayName?: string, language?: string, feedStrategy?: string, feedUrl?: string, feedVersion?: string, filterMode?: string, hosts?: string[], searchSites?: string[], sectionUrls?: string[] }[]} */
    const REG = [
        { id: 'heise', siteUrl: 'https://www.heise.de', displayName: 'heise.de', language: 'de', filterMode: 'heise', hosts: ['heise.de'] },
        { id: 'bild', siteUrl: 'https://www.bild.de', displayName: 'BILD', language: 'de', filterMode: 'single', hosts: ['bild.de'] },
        { id: 'telepolis', siteUrl: 'https://www.telepolis.de', displayName: 'Telepolis', language: 'de', filterMode: 'single', hosts: ['telepolis.de'] },
        { id: 'golem', siteUrl: 'https://www.golem.de', displayName: 'golem.de', language: 'de', filterMode: 'generic', hosts: ['golem.de'] },
        { id: 'computerbase', siteUrl: 'https://www.computerbase.de', displayName: 'ComputerBase', language: 'de', filterMode: 'generic', hosts: ['computerbase.de'] },
        { id: 't3n', siteUrl: 'https://t3n.de', displayName: 't3n.de', language: 'de', filterMode: 'generic', hosts: ['t3n.de'] },
        { id: 'it_administrator', siteUrl: 'https://www.it-administrator.de', displayName: 'IT-Administrator', language: 'de', filterMode: 'generic', hosts: ['it-administrator.de'] },
        { id: 'verge', siteUrl: 'https://www.theverge.com', displayName: 'The Verge', language: 'en', filterMode: 'generic', hosts: ['theverge.com'] },
        { id: 'nytimes', siteUrl: 'https://www.nytimes.com', displayName: 'The New York Times', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', feedVersion: '20261103a' },
        { id: 'bbc_news', siteUrl: 'https://www.bbc.com', displayName: 'BBC News', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://feeds.bbci.co.uk/news/rss.xml', feedVersion: '20261103a', hosts: ['bbc.com', 'bbc.co.uk'], searchSites: ['bbc.com', 'bbc.co.uk'] },
        { id: 'cnn', siteUrl: 'https://www.cnn.com', displayName: 'CNN', language: 'en', feedStrategy: 'bing_news', searchSites: ['edition.cnn.com'], feedVersion: '20261103b' },
        { id: 'yahoo_news_finance', siteUrl: 'https://news.yahoo.com', displayName: 'Yahoo News / Yahoo Finance', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://news.yahoo.com/rss/topstories', feedVersion: '20261103a', hosts: ['yahoo.com', 'news.yahoo.com', 'finance.yahoo.com'], searchSites: ['news.yahoo.com', 'finance.yahoo.com', 'yahoo.com'] },
        { id: 'guardian', siteUrl: 'https://www.theguardian.com', displayName: 'The Guardian', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.theguardian.com/europe/rss', feedVersion: '20261103a', hosts: ['theguardian.com'] },
        { id: 'daily_mail', siteUrl: 'https://www.dailymail.co.uk', displayName: 'Daily Mail / MailOnline', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.dailymail.co.uk/home/index.rss', feedVersion: '20261103b', hosts: ['dailymail.co.uk', 'dailymail.com'] },
        { id: 'fox_news', siteUrl: 'https://www.foxnews.com', displayName: 'Fox News', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://moxie.foxnews.com/google-publisher/latest.xml', feedVersion: '20261103a', hosts: ['foxnews.com'] },
        { id: 'wall_street_journal', siteUrl: 'https://www.wsj.com', displayName: 'The Wall Street Journal', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://feeds.content.dowjones.io/public/rss/RSSWorldNews', feedVersion: '20261103a', hosts: ['wsj.com'] },
        { id: 'nbc_news', siteUrl: 'https://www.nbcnews.com', displayName: 'NBC News', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://feeds.nbcnews.com/nbcnews/public/news', feedVersion: '20261103a', hosts: ['nbcnews.com'] },
        { id: 'cbs_news', siteUrl: 'https://www.cbsnews.com', displayName: 'CBS News', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.cbsnews.com/latest/rss/main', feedVersion: '20261103a', hosts: ['cbsnews.com'] },
        { id: 'abc_news_us', siteUrl: 'https://abcnews.go.com', displayName: 'ABC News (US)', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://feeds.abcnews.com/abcnews/topstories', feedVersion: '20261103b', hosts: ['abcnews.go.com', 'abcnews.com'] },
        { id: 'bloomberg', siteUrl: 'https://www.bloomberg.com', displayName: 'Bloomberg', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://feeds.bloomberg.com/markets/news.rss', feedVersion: '20261103a', hosts: ['bloomberg.com'] },
        { id: 'financial_times', siteUrl: 'https://www.ft.com', displayName: 'Financial Times', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.ft.com/?format=rss', feedVersion: '20261103a', hosts: ['ft.com'] },
        { id: 'newsweek', siteUrl: 'https://www.newsweek.com', displayName: 'Newsweek', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.newsweek.com/rss', feedVersion: '20261103a', hosts: ['newsweek.com'] },
        { id: 'business_insider', siteUrl: 'https://www.businessinsider.com', displayName: 'Business Insider', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.businessinsider.com/rss', feedVersion: '20261103a', hosts: ['businessinsider.com'] },
        { id: 'forbes', siteUrl: 'https://www.forbes.com', displayName: 'Forbes', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.forbes.com/business/feed/', feedVersion: '20261103c', hosts: ['forbes.com'] },
        { id: 'economist', siteUrl: 'https://www.economist.com', displayName: 'The Economist', language: 'en', feedStrategy: 'bing_news', hosts: ['economist.com'] },
        { id: 'los_angeles_times', siteUrl: 'https://www.latimes.com', displayName: 'Los Angeles Times', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.latimes.com/index.rss', feedVersion: '20261103a', hosts: ['latimes.com'] },
        { id: 'times_of_india', siteUrl: 'https://timesofindia.indiatimes.com', displayName: 'The Times of India', language: 'en', feedStrategy: 'bing_news', hosts: ['timesofindia.com', 'indiatimes.com'], searchSites: ['timesofindia.com'] },
        { id: 'hindustan_times', siteUrl: 'https://www.hindustantimes.com', displayName: 'Hindustan Times', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.hindustantimes.com/feeds/rss/latest/rssfeed.xml', feedVersion: '20261103b', hosts: ['hindustantimes.com'] },
        { id: 'india_today', siteUrl: 'https://www.indiatoday.in', displayName: 'India Today', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.indiatoday.in/rss/home', feedVersion: '20261103a', hosts: ['indiatoday.in'] },
        { id: 'ndtv', siteUrl: 'https://www.ndtv.com', displayName: 'NDTV', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://feeds.feedburner.com/ndtvnews-top-stories', feedVersion: '20261103a', hosts: ['ndtv.com'] },
        { id: 'news18', siteUrl: 'https://www.news18.com', displayName: 'News18', language: 'en', feedStrategy: 'bing_news', hosts: ['news18.com'] },
        { id: 'indian_express', siteUrl: 'https://indianexpress.com', displayName: 'Indian Express', language: 'en', feedStrategy: 'bing_news', hosts: ['indianexpress.com'] },
        { id: 'the_hindu', siteUrl: 'https://www.thehindu.com', displayName: 'The Hindu', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.thehindu.com/feeder/default.rss', feedVersion: '20261103a', hosts: ['thehindu.com'] },
        { id: 'al_jazeera', siteUrl: 'https://www.aljazeera.com', displayName: 'Al Jazeera', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.aljazeera.com/xml/rss/all.xml', feedVersion: '20261103a', hosts: ['aljazeera.com'] },
        { id: 'deutsche_welle', siteUrl: 'https://www.dw.com', displayName: 'Deutsche Welle', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://rss.dw.com/rdf/rss-en-all', feedVersion: '20261103a', hosts: ['dw.com'] },
        { id: 'spiegel', siteUrl: 'https://www.spiegel.de', displayName: 'Der Spiegel', language: 'de', feedStrategy: 'bing_news', hosts: ['spiegel.de'] },
        { id: 'welt', siteUrl: 'https://www.welt.de', displayName: 'WELT', language: 'de', feedStrategy: 'direct_rss', feedUrl: 'https://www.welt.de/feeds/latest.rss', feedVersion: '20261103a', hosts: ['welt.de'] },
        { id: 'sueddeutsche_zeitung', siteUrl: 'https://www.sueddeutsche.de', displayName: 'Süddeutsche Zeitung', language: 'de', feedStrategy: 'direct_rss', feedUrl: 'https://rss.sueddeutsche.de/rss/Topthemen', feedVersion: '20261103a', hosts: ['sueddeutsche.de'] },
        { id: 'faz', siteUrl: 'https://www.faz.net', displayName: 'FAZ', language: 'de', feedStrategy: 'direct_rss', feedUrl: 'https://www.faz.net/rss/aktuell/', feedVersion: '20261103a', hosts: ['faz.net'] },
        { id: 'tagesschau', siteUrl: 'https://www.tagesschau.de', displayName: 'Tagesschau', language: 'de', feedStrategy: 'direct_rss', feedUrl: 'https://www.tagesschau.de/index~rss2.xml', feedVersion: '20261103a', hosts: ['tagesschau.de'] },
        { id: 'n_tv', siteUrl: 'https://www.n-tv.de', displayName: 'n-tv', language: 'de', feedStrategy: 'direct_rss', feedUrl: 'https://www.n-tv.de/rss', feedVersion: '20261103a', hosts: ['n-tv.de'] },
        { id: 't_online', siteUrl: 'https://www.t-online.de', displayName: 't-online', language: 'de', feedStrategy: 'direct_rss', feedUrl: 'https://www.t-online.de/feed.rss', feedVersion: '20261103a', hosts: ['t-online.de'] },
        { id: 'focus_online', siteUrl: 'https://www.focus.de', displayName: 'Focus Online', language: 'de', feedStrategy: 'direct_rss', feedUrl: 'https://www.focus.de/rss', feedVersion: '20261103b', hosts: ['focus.de'] },
        { id: 'stern', siteUrl: 'https://www.stern.de', displayName: 'Stern', language: 'de', feedStrategy: 'direct_rss', feedUrl: 'https://www.stern.de/feed/standard/alle-nachrichten/', feedVersion: '20261103a', hosts: ['stern.de'] },
        { id: 'zeit_online', siteUrl: 'https://www.zeit.de', displayName: 'Zeit Online', language: 'de', feedStrategy: 'direct_rss', feedUrl: 'https://newsfeed.zeit.de/index', feedVersion: '20261103a', hosts: ['zeit.de'] },
        { id: 'sun', siteUrl: 'https://www.thesun.co.uk', displayName: 'The Sun', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.thesun.co.uk/feed/', feedVersion: '20261103a', hosts: ['thesun.co.uk'] },
        { id: 'mirror', siteUrl: 'https://www.mirror.co.uk', displayName: 'The Mirror', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.mirror.co.uk/rss.xml', feedVersion: '20261103a', hosts: ['mirror.co.uk'] },
        { id: 'independent', siteUrl: 'https://www.independent.co.uk', displayName: 'The Independent', language: 'en', feedStrategy: 'bing_news', hosts: ['independent.co.uk'] },
        { id: 'sky_news', siteUrl: 'https://news.sky.com', displayName: 'Sky News', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://feeds.skynews.com/feeds/rss/home.xml', feedVersion: '20261103b', hosts: ['news.sky.com', 'sky.com'], searchSites: ['news.sky.com'] },
        { id: 'metro_uk', siteUrl: 'https://metro.co.uk', displayName: 'Metro (UK)', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://metro.co.uk/feed/', feedVersion: '20261103a', hosts: ['metro.co.uk'] },
        { id: 'le_monde', siteUrl: 'https://www.lemonde.fr', displayName: 'Le Monde', language: 'fr', feedStrategy: 'direct_rss', feedUrl: 'https://www.lemonde.fr/rss/une.xml', feedVersion: '20261103a', hosts: ['lemonde.fr'] },
        { id: 'le_figaro', siteUrl: 'https://www.lefigaro.fr', displayName: 'Le Figaro', language: 'fr', feedStrategy: 'direct_rss', feedUrl: 'https://www.lefigaro.fr/rss/figaro_actualites.xml', feedVersion: '20261103a', hosts: ['lefigaro.fr'] },
        { id: 'la_repubblica', siteUrl: 'https://www.repubblica.it', displayName: 'La Repubblica', language: 'it', feedStrategy: 'direct_rss', feedUrl: 'https://www.repubblica.it/rss/homepage/rss2.0.xml', feedVersion: '20261103b', hosts: ['repubblica.it'] },
        { id: 'corriere_della_sera', siteUrl: 'https://www.corriere.it', displayName: 'Corriere della Sera', language: 'it', feedStrategy: 'direct_rss', feedUrl: 'https://xml2.corriereobjects.it/feed-hp/homepage-restyle-2025.xml', feedVersion: '20261103b', hosts: ['corriere.it'] },
        { id: 'el_pais', siteUrl: 'https://elpais.com', displayName: 'El País', language: 'es', feedStrategy: 'direct_rss', feedUrl: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada', feedVersion: '20261103a', hosts: ['elpais.com'] },
        { id: 'el_mundo', siteUrl: 'https://www.elmundo.es', displayName: 'El Mundo', language: 'es', feedStrategy: 'direct_rss', feedUrl: 'https://www.elmundo.es/rss/googlenews/portada.xml', feedVersion: '20261103a', hosts: ['elmundo.es'] },
        { id: 'la_nacion', siteUrl: 'https://www.lanacion.com.ar', displayName: 'La Nación', language: 'es', feedStrategy: 'direct_rss', feedUrl: 'https://www.lanacion.com.ar/arc/outboundfeeds/rss/', feedVersion: '20261103a', hosts: ['lanacion.com.ar'] },
        { id: 'clarin', siteUrl: 'https://www.clarin.com', displayName: 'Clarín', language: 'es', feedStrategy: 'direct_rss', feedUrl: 'https://www.clarin.com/rss/lo-ultimo/', feedVersion: '20261103a', hosts: ['clarin.com'] },
        { id: 'globo', siteUrl: 'https://www.globo.com', displayName: 'Globo', language: 'pt', feedStrategy: 'bing_news', hosts: ['globo.com'] },
        { id: 'uol', siteUrl: 'https://www.uol.com.br', displayName: 'UOL', language: 'pt', feedStrategy: 'direct_rss', feedUrl: 'https://www.uol.com.br/vueland/api/?loadComponent=XmlFeedRss', feedVersion: '20261103d', hosts: ['uol.com.br'] },
        { id: 'folha', siteUrl: 'https://www.folha.uol.com.br', displayName: 'Folha de S.Paulo', language: 'pt', feedStrategy: 'bing_news', hosts: ['folha.uol.com.br'], searchSites: ['folha.uol.com.br'] },
        { id: 'cbc_news', siteUrl: 'https://www.cbc.ca/news', displayName: 'CBC News', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.cbc.ca/webfeed/rss/rss-topstories', feedVersion: '20261103a', hosts: ['cbc.ca'] },
        { id: 'global_news_ca', siteUrl: 'https://globalnews.ca', displayName: 'Global News (CA)', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://globalnews.ca/feed/', feedVersion: '20261103a', hosts: ['globalnews.ca'] },
        { id: 'toronto_star', siteUrl: 'https://www.thestar.com', displayName: 'Toronto Star', language: 'en', feedStrategy: 'publisher', feedVersion: '20261103e', hosts: ['thestar.com'] },
        { id: 'la_presse', siteUrl: 'https://www.lapresse.ca', displayName: 'La Presse', language: 'fr', feedStrategy: 'direct_rss', feedUrl: 'https://www.lapresse.ca/actualites/manchettes/rss', feedVersion: '20261103a', hosts: ['lapresse.ca'] },
        { id: 'radio_canada_info', siteUrl: 'https://ici.radio-canada.ca', displayName: 'Radio-Canada Info', language: 'fr', feedStrategy: 'direct_rss', feedUrl: 'https://ici.radio-canada.ca/info/rss/info/a-la-une', feedVersion: '20261103a', hosts: ['ici.radio-canada.ca', 'radio-canada.ca'], searchSites: ['ici.radio-canada.ca'] },
        { id: 'yomiuri', siteUrl: 'https://www.yomiuri.co.jp', displayName: 'Yomiuri Online', language: 'ja', feedStrategy: 'bing_news', hosts: ['yomiuri.co.jp'] },
        { id: 'asahi_shimbun', siteUrl: 'https://www.asahi.com', displayName: 'Asahi Shimbun', language: 'ja', feedStrategy: 'direct_rss', feedUrl: 'https://www.asahi.com/rss/asahi/newsheadlines.rdf', feedVersion: '20261103a', hosts: ['asahi.com'] },
        { id: 'nikkei', siteUrl: 'https://www.nikkei.com', displayName: 'Nikkei', language: 'ja', feedStrategy: 'publisher', feedVersion: '20261103e', hosts: ['nikkei.com'] },
        { id: 'mainichi_shimbun', siteUrl: 'https://mainichi.jp', displayName: 'Mainichi Shimbun', language: 'ja', feedStrategy: 'direct_rss', feedUrl: 'https://mainichi.jp/rss/etc/mainichi-flash.rss', feedVersion: '20261103a', hosts: ['mainichi.jp'] },
        { id: 'joongang', siteUrl: 'https://www.koreajoongangdaily.com/', displayName: 'Korea JoongAng Daily / JoongAng Ilbo', language: 'en', feedStrategy: 'publisher', feedVersion: '20261103e', hosts: ['joins.com', 'koreajoongangdaily.joins.com', 'koreajoongangdaily.com'], searchSites: ['koreajoongangdaily.com'] },
        { id: 'chosun_ilbo', siteUrl: 'https://www.chosun.com', displayName: 'Chosun Ilbo', language: 'ko', feedStrategy: 'direct_rss', feedUrl: 'https://www.chosun.com/arc/outboundfeeds/rss/?outputType=xml', feedVersion: '20261103a', hosts: ['chosun.com'] },
        { id: 'yonhap_news', siteUrl: 'https://en.yna.co.kr', displayName: 'Yonhap News', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.yna.co.kr/rss/news.xml', feedVersion: '20261103a', hosts: ['yonhapnews.co.kr', 'yna.co.kr'], searchSites: ['yonhapnews.co.kr', 'yna.co.kr'] },
        { id: 'sydney_morning_herald', siteUrl: 'https://www.smh.com.au', displayName: 'Sydney Morning Herald', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.smh.com.au/rss/feed.xml', feedVersion: '20261103a', hosts: ['smh.com.au'] },
        { id: 'the_age', siteUrl: 'https://www.theage.com.au', displayName: 'The Age', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.theage.com.au/rss/feed.xml', feedVersion: '20261103a', hosts: ['theage.com.au'] },
        { id: 'abc_news_au', siteUrl: 'https://www.abc.net.au/news', displayName: 'ABC News (Australia)', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.abc.net.au/news/feed/51120/rss.xml', feedVersion: '20261103a', hosts: ['abc.net.au'] },
        { id: 'stuff_nz', siteUrl: 'https://www.stuff.co.nz', displayName: 'Stuff', language: 'en', feedStrategy: 'bing_news', hosts: ['stuff.co.nz'] },
        { id: 'nz_herald', siteUrl: 'https://www.nzherald.co.nz', displayName: 'NZ Herald', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://rss.nzherald.co.nz/rss/xml/nzhrsscid_000000001.xml', feedVersion: '20261103a', hosts: ['nzherald.co.nz'] },
        { id: 'gulf_news', siteUrl: 'https://gulfnews.com', displayName: 'Gulf News', language: 'en', feedStrategy: 'bing_news', hosts: ['gulfnews.com'] },
        { id: 'khaleej_times', siteUrl: 'https://www.khaleejtimes.com', displayName: 'Khaleej Times', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.khaleejtimes.com/api/v1/collections/top-section.rss', feedVersion: '20261103a', hosts: ['khaleejtimes.com'] },
        { id: 'haaretz', siteUrl: 'https://www.haaretz.com', displayName: 'Haaretz', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.haaretz.com/srv/haaretz-latest-headlines', feedVersion: '20260417a', hosts: ['haaretz.com'] },
        { id: 'times_of_israel', siteUrl: 'https://www.timesofisrael.com', displayName: 'Times of Israel', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.timesofisrael.com/feed/', feedVersion: '20261103a', hosts: ['timesofisrael.com'] },
        { id: 'al_arabiya_en', siteUrl: 'https://english.alarabiya.net', displayName: 'Al Arabiya', language: 'en', feedStrategy: 'bing_news', hosts: ['english.alarabiya.net', 'alarabiya.net'], searchSites: ['english.alarabiya.net'] },
        { id: 'scmp', siteUrl: 'https://www.scmp.com', displayName: 'South China Morning Post', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.scmp.com/rss/feed', feedVersion: '20261103a', hosts: ['scmp.com'] },
        { id: 'straits_times', siteUrl: 'https://www.straitstimes.com', displayName: 'The Straits Times', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.straitstimes.com/news/singapore/rss.xml', feedVersion: '20261103a', hosts: ['straitstimes.com'] },
        { id: 'cna', siteUrl: 'https://www.channelnewsasia.com', displayName: 'Channel NewsAsia / CNA', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml', feedVersion: '20261103a', hosts: ['channelnewsasia.com'] },
        { id: 'rappler', siteUrl: 'https://www.rappler.com', displayName: 'Rappler', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.rappler.com/feed/', feedVersion: '20261103a', hosts: ['rappler.com'] },
        { id: 'inquirer', siteUrl: 'https://www.inquirer.net', displayName: 'Inquirer', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.inquirer.net/fullfeed', feedVersion: '20261103a', hosts: ['inquirer.net'] },
        { id: 'bangkok_post', siteUrl: 'https://www.bangkokpost.com', displayName: 'Bangkok Post', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.bangkokpost.com/rss/data/topstories.xml', feedVersion: '20261103a', hosts: ['bangkokpost.com'] },
        { id: 'vnexpress', siteUrl: 'https://vnexpress.net', displayName: 'VnExpress', language: 'vi', feedStrategy: 'direct_rss', feedUrl: 'https://vnexpress.net/rss/tin-moi-nhat.rss', feedVersion: '20261103a', hosts: ['vnexpress.net'] },
        { id: 'allafrica', siteUrl: 'https://allafrica.com', displayName: 'AllAfrica', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf', feedVersion: '20261103a', hosts: ['allafrica.com'] },
        { id: 'mail_and_guardian', siteUrl: 'https://mg.co.za', displayName: 'Mail & Guardian', language: 'en', feedStrategy: 'bing_news', hosts: ['mg.co.za'] },
        { id: 'daily_nation_kenya', siteUrl: 'https://nation.africa', displayName: 'Daily Nation (Kenya)', language: 'en', feedStrategy: 'bing_news', hosts: ['nation.africa'] },
        { id: 'infobae', siteUrl: 'https://www.infobae.com', displayName: 'Infobae', language: 'es', feedStrategy: 'direct_rss', feedUrl: 'https://www.infobae.com/arc/outboundfeeds/rss/category/america/mundo/', feedVersion: '20261103a', hosts: ['infobae.com'] },
        { id: 'people', siteUrl: 'https://people.com', displayName: 'People', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://feeds-api.dotdashmeredith.com/v1/rss/google/cc522820-4870-4a9a-9d5a-4a08b7a572f8', feedVersion: '20261103b', hosts: ['people.com'] },
        { id: 'espn', siteUrl: 'https://www.espn.com', displayName: 'ESPN', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.espn.com/espn/rss/news', feedVersion: '20261103a', hosts: ['espn.com'] },
        { id: 'marca', siteUrl: 'https://www.marca.com', displayName: 'Marca', language: 'es', feedStrategy: 'direct_rss', feedUrl: 'https://www.marca.com/rss/googlenews/portada.xml', feedVersion: '20261103a', hosts: ['marca.com'] },
        { id: 'as_com', siteUrl: 'https://as.com', displayName: 'AS', language: 'es', feedStrategy: 'direct_rss', feedUrl: 'https://feeds.as.com/mrss-s/pages/as/site/as.com/section/futbol/portada/', feedVersion: '20261103a', hosts: ['as.com'] },
        { id: 'cricbuzz', siteUrl: 'https://www.cricbuzz.com', displayName: 'Cricbuzz', language: 'en', feedStrategy: 'bing_news', hosts: ['cricbuzz.com'], searchSites: ['cricbuzz.com/cricket-news'], feedVersion: '20261103b' },
        { id: 'bleacher_report', siteUrl: 'https://bleacherreport.com', displayName: 'Bleacher Report', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://feeds.bleacherreport.com/articles', feedVersion: '20261103a', hosts: ['bleacherreport.com'] },
        { id: 'goal', siteUrl: 'https://www.goal.com', displayName: 'Goal', language: 'en', feedStrategy: 'publisher', feedVersion: '20261103e', hosts: ['goal.com'] },
        { id: 'sky_sports', siteUrl: 'https://www.skysports.com', displayName: 'Sky Sports', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.skysports.com/rss/11095', feedVersion: '20261103a', hosts: ['skysports.com'] },
        { id: 'transfermarkt', siteUrl: 'https://www.transfermarkt.de', displayName: 'Transfermarkt', language: 'de', feedStrategy: 'direct_rss', feedUrl: 'https://www.transfermarkt.de/rss/news', feedVersion: '20261103a', hosts: ['transfermarkt.de'] },
        { id: 'rotten_tomatoes', siteUrl: 'https://www.rottentomatoes.com', displayName: 'Rotten Tomatoes', language: 'en', feedStrategy: 'bing_news', hosts: ['rottentomatoes.com'] },
        { id: 'variety', siteUrl: 'https://variety.com', displayName: 'Variety', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://variety.com/feed/rss/', feedVersion: '20261103a', hosts: ['variety.com'] },
        { id: 'hollywood_reporter', siteUrl: 'https://www.hollywoodreporter.com', displayName: 'The Hollywood Reporter', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.hollywoodreporter.com/feed/rss/', feedVersion: '20261103a', hosts: ['hollywoodreporter.com'] },
        { id: 'tmz', siteUrl: 'https://www.tmz.com', displayName: 'TMZ', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.tmz.com/rss.xml', feedVersion: '20261103a', hosts: ['tmz.com'] },
        { id: 'rolling_stone', siteUrl: 'https://www.rollingstone.com', displayName: 'Rolling Stone', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.rollingstone.com/feed/rss/', feedVersion: '20261103a', hosts: ['rollingstone.com'] },
        { id: 'billboard', siteUrl: 'https://www.billboard.com', displayName: 'Billboard', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.billboard.com/feed/rss/', feedVersion: '20261103a', hosts: ['billboard.com'] },
        { id: 'entertainment_weekly', siteUrl: 'https://ew.com', displayName: 'Entertainment Weekly', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://feeds-api.dotdashmeredith.com/v1/rss/google/06e092d0-4dff-468a-93db-8d6a995730b4', feedVersion: '20261103a', hosts: ['ew.com'] },
        { id: 'deadline', siteUrl: 'https://deadline.com', displayName: 'Deadline', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://deadline.com/feed/rss/', feedVersion: '20261103a', hosts: ['deadline.com'] },
        { id: 'techcrunch', siteUrl: 'https://techcrunch.com', displayName: 'TechCrunch', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://techcrunch.com/feed/', feedVersion: '20261103a', hosts: ['techcrunch.com'] },
        { id: 'wired', siteUrl: 'https://www.wired.com', displayName: 'WIRED', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.wired.com/feed/rss', feedVersion: '20261103a', hosts: ['wired.com'] },
        { id: 'cnet', siteUrl: 'https://www.cnet.com', displayName: 'CNET', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.cnet.com/rss/all/', feedVersion: '20261103a', hosts: ['cnet.com'] },
        { id: 'toms_guide', siteUrl: 'https://www.tomsguide.com', displayName: 'Tom\'s Guide', language: 'en', feedStrategy: 'bing_news', hosts: ['tomsguide.com'] },
        { id: 'toms_hardware', siteUrl: 'https://www.tomshardware.com', displayName: 'Tom\'s Hardware', language: 'en', feedStrategy: 'bing_news', hosts: ['tomshardware.com'] },
        { id: 'digital_trends', siteUrl: 'https://www.digitaltrends.com', displayName: 'Digital Trends', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.digitaltrends.com/feed/', feedVersion: '20261103a', hosts: ['digitaltrends.com'] },
        { id: 'how_to_geek', siteUrl: 'https://www.howtogeek.com', displayName: 'How-To Geek', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.howtogeek.com/feed/', feedVersion: '20261103a', hosts: ['howtogeek.com'] },
        { id: 'scientific_american', siteUrl: 'https://www.scientificamerican.com', displayName: 'Scientific American', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.scientificamerican.com/platform/syndication/rss/', feedVersion: '20261103a', hosts: ['scientificamerican.com'] },
        { id: 'discover_magazine', siteUrl: 'https://www.discovermagazine.com', displayName: 'Discover Magazine', language: 'en', feedStrategy: 'bing_news', hosts: ['discovermagazine.com'] },
        { id: 'new_scientist', siteUrl: 'https://www.newscientist.com', displayName: 'New Scientist', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.newscientist.com/feed/home/', feedVersion: '20261103b', hosts: ['newscientist.com'] },
        { id: 'national_geographic', siteUrl: 'https://www.nationalgeographic.com', displayName: 'National Geographic', language: 'en', feedStrategy: 'publisher', feedVersion: '20261103e', hosts: ['nationalgeographic.com'] },
        { id: 'engadget', siteUrl: 'https://www.engadget.com', displayName: 'Engadget', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.engadget.com/category/news/feed/', feedVersion: '20261103a', hosts: ['engadget.com'] },
        { id: 'gizmodo', siteUrl: 'https://gizmodo.com', displayName: 'Gizmodo', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://gizmodo.com/feed', feedVersion: '20261103a', hosts: ['gizmodo.com'] },
        { id: 'ars_technica', siteUrl: 'https://arstechnica.com', displayName: 'Ars Technica', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://feeds.arstechnica.com/arstechnica/index', feedVersion: '20261103a', hosts: ['arstechnica.com'] },
        { id: 'ign', siteUrl: 'https://www.ign.com', displayName: 'IGN', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://feeds.ign.com/ign/all', feedVersion: '20261103b', hosts: ['ign.com'] },
        { id: 'gamespot', siteUrl: 'https://www.gamespot.com', displayName: 'GameSpot', language: 'en', feedStrategy: 'bing_news', hosts: ['gamespot.com'] },
        { id: 'kotaku', siteUrl: 'https://kotaku.com', displayName: 'Kotaku', language: 'en', feedStrategy: 'bing_news', hosts: ['kotaku.com'] },
        { id: 'pc_gamer', siteUrl: 'https://www.pcgamer.com', displayName: 'PC Gamer', language: 'en', feedStrategy: 'bing_news', hosts: ['pcgamer.com'] },
        { id: 'polygon', siteUrl: 'https://www.polygon.com', displayName: 'Polygon', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.polygon.com/feed/', feedVersion: '20261103a', hosts: ['polygon.com'] },
        { id: 'investopedia', siteUrl: 'https://www.investopedia.com', displayName: 'Investopedia', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://feeds-api.dotdashmeredith.com/v1/rss/google/f8466ec3-5044-46bc-94b7-2df65f770eff', feedVersion: '20261103a', hosts: ['investopedia.com'] },
        { id: 'marketwatch', siteUrl: 'https://www.marketwatch.com', displayName: 'MarketWatch', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://feeds.marketwatch.com/marketwatch/topstories', feedVersion: '20261103a', hosts: ['marketwatch.com'] },
        { id: 'cnbc', siteUrl: 'https://www.cnbc.com', displayName: 'CNBC', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', feedVersion: '20261103a', hosts: ['cnbc.com'] },
        { id: 'fortune', siteUrl: 'https://fortune.com', displayName: 'Fortune', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://fortune.com/feed', feedVersion: '20261103b', hosts: ['fortune.com'] },
        { id: 'health', siteUrl: 'https://www.health.com', displayName: 'Health', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://feeds-api.dotdashmeredith.com/v1/rss/google/adf185b2-ff7d-4fe3-a978-b59ff8528c53', feedVersion: '20261103a', hosts: ['health.com'] },
        { id: 'healthline', siteUrl: 'https://www.healthline.com', displayName: 'Healthline', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.healthline.com/rss/health-news', feedVersion: '20261103a', hosts: ['healthline.com'] },
        { id: 'medical_news_today', siteUrl: 'https://www.medicalnewstoday.com', displayName: 'Medical News Today', language: 'en', feedStrategy: 'bing_news', hosts: ['medicalnewstoday.com'] },
        { id: 'vogue', siteUrl: 'https://www.vogue.com', displayName: 'Vogue', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.vogue.com/feed/rss', feedVersion: '20261103a', hosts: ['vogue.com'] },
        { id: 'cosmopolitan', siteUrl: 'https://www.cosmopolitan.com', displayName: 'Cosmopolitan', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.cosmopolitan.com/rss/all.xml', feedVersion: '20261103a', hosts: ['cosmopolitan.com'] },
        { id: 'elle', siteUrl: 'https://www.elle.com', displayName: 'ELLE', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.elle.com/rss/all.xml', feedVersion: '20261103b', hosts: ['elle.com'] },
        { id: 'gq', siteUrl: 'https://www.gq.com', displayName: 'GQ', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.gq.com/feed/rss', feedVersion: '20261103a', hosts: ['gq.com'] },
        { id: 'mens_health', siteUrl: 'https://www.menshealth.com', displayName: 'Men\'s Health', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.menshealth.com/rss/all.xml', feedVersion: '20261103a', hosts: ['menshealth.com'] },
        { id: 'womens_health', siteUrl: 'https://www.womenshealthmag.com', displayName: 'Women\'s Health', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.womenshealthmag.com/rss/all.xml', feedVersion: '20261103a', hosts: ['womenshealthmag.com'] },
        { id: 'harpers_bazaar', siteUrl: 'https://www.harpersbazaar.com', displayName: 'Harper\'s Bazaar', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.harpersbazaar.com/rss/all.xml/', feedVersion: '20261103a', hosts: ['harpersbazaar.com'] },
        { id: 'instyle', siteUrl: 'https://www.instyle.com', displayName: 'InStyle', language: 'en', feedStrategy: 'publisher', feedVersion: '20261103e', hosts: ['instyle.com'] },
        { id: 'allrecipes', siteUrl: 'https://www.allrecipes.com', displayName: 'Allrecipes', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://feeds-api.dotdashmeredith.com/v1/rss/google/afd5e9ea-c220-419e-9135-d8457772e240', feedVersion: '20261103a', hosts: ['allrecipes.com'] },
        { id: 'serious_eats', siteUrl: 'https://www.seriouseats.com', displayName: 'Serious Eats', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://feeds-api.dotdashmeredith.com/v1/rss/google/ad57d421-0ff5-41e7-a5da-f2167b6d7f7a', feedVersion: '20261103a', hosts: ['seriouseats.com'] },
        { id: 'lonely_planet', siteUrl: 'https://www.lonelyplanet.com', displayName: 'Lonely Planet', language: 'en', feedStrategy: 'publisher', feedVersion: '20261103e', hosts: ['lonelyplanet.com'] },
        { id: 'travel_and_leisure', siteUrl: 'https://www.travelandleisure.com', displayName: 'Travel + Leisure', language: 'en', feedStrategy: 'bing_news', hosts: ['travelandleisure.com'] },
        { id: 'cn_traveler', siteUrl: 'https://www.cntraveler.com', displayName: 'Condé Nast Traveler', language: 'en', feedStrategy: 'bing_news', hosts: ['cntraveler.com'] },
        { id: 'frommers', siteUrl: 'https://www.frommers.com', displayName: 'Frommer\'s', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.frommers.com/feed.xml', feedVersion: '20261103a', hosts: ['frommers.com'] },
        { id: 'rough_guides', siteUrl: 'https://www.roughguides.com', displayName: 'Rough Guides', language: 'en', feedStrategy: 'publisher', feedVersion: '20261103e', hosts: ['roughguides.com'] },
        { id: 'el_universal_mx', siteUrl: 'https://www.eluniversal.com.mx', displayName: 'El Universal', language: 'es', feedStrategy: 'publisher', feedVersion: '20261103e', hosts: ['eluniversal.com.mx'] },
        { id: 'atlantic', siteUrl: 'https://www.theatlantic.com', displayName: 'The Atlantic', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.theatlantic.com/feed/all/', feedVersion: '20261103a', hosts: ['theatlantic.com'] },
        { id: 'slate', siteUrl: 'https://slate.com', displayName: 'Slate', language: 'en', feedStrategy: 'bing_news', hosts: ['slate.com'] }
    ];

    const registry = Object.freeze(REG.map((row) => freezeDeep(row)));
    const byId = {};
    registry.forEach((row) => {
        byId[row.id] = row;
    });

    function resolveEntry(sourceOrEntry) {
        if (!sourceOrEntry) {
            return null;
        }
        if (typeof sourceOrEntry === 'object' && sourceOrEntry.id) {
            return sourceOrEntry;
        }
        const id = String(sourceOrEntry || '').trim();
        return byId[id] || null;
    }

    function getSourceHosts(sourceOrEntry) {
        const entry = resolveEntry(sourceOrEntry);
        if (!entry) {
            return [];
        }
        const seen = new Set();
        const out = [];
        const push = (raw) => {
            const host = normalizeHostname(raw);
            if (!host || seen.has(host)) {
                return;
            }
            seen.add(host);
            out.push(host);
        };
        if (Array.isArray(entry.hosts)) {
            entry.hosts.forEach(push);
        }
        if (out.length === 0) {
            push(siteUrlToHost(entry.siteUrl));
        }
        return out;
    }

    function getSourceSearchSites(sourceOrEntry) {
        const entry = resolveEntry(sourceOrEntry);
        if (!entry) {
            return [];
        }
        const seen = new Set();
        const out = [];
        const push = (raw) => {
            const site = normalizeSearchSite(raw);
            if (!site || seen.has(site)) {
                return;
            }
            seen.add(site);
            out.push(site);
        };
        if (Array.isArray(entry.searchSites)) {
            entry.searchSites.forEach(push);
        }
        if (out.length === 0) {
            push(siteUrlToSearchSite(entry.siteUrl));
        }
        return out;
    }

    function hostMatchesEntry(sourceOrEntry, hostname) {
        const host = normalizeHostname(hostname);
        if (!host) {
            return false;
        }
        return getSourceHosts(sourceOrEntry).some((pattern) => host === pattern || host.endsWith(`.${pattern}`));
    }

    function getSourceDisplayName(sourceOrEntry) {
        const entry = resolveEntry(sourceOrEntry);
        if (!entry) {
            return '';
        }
        return String(entry.displayName || entry.siteUrl || entry.id || '').trim();
    }

    function getSourceLanguage(sourceOrEntry) {
        const entry = resolveEntry(sourceOrEntry);
        if (!entry) {
            return '';
        }
        return String(entry.language || '').trim().toLowerCase();
    }

    function getSourceSiteUrl(sourceOrEntry) {
        const entry = resolveEntry(sourceOrEntry);
        if (!entry) {
            return '';
        }
        return String(entry.siteUrl || '').trim();
    }

    function getSourceFilterMode(sourceOrEntry) {
        const entry = resolveEntry(sourceOrEntry);
        if (!entry) {
            return 'none';
        }
        return String(entry.filterMode || 'none').trim().toLowerCase() || 'none';
    }

    function getSourceIdByHostname(hostname) {
        const host = normalizeHostname(hostname);
        if (!host) {
            return '';
        }
        for (const row of registry) {
            if (hostMatchesEntry(row, host)) {
                return row.id;
            }
        }
        return '';
    }

    function getSourceLanguageByHostname(hostname) {
        const id = getSourceIdByHostname(hostname);
        return id ? getSourceLanguage(id) : '';
    }

    global.NEWS_SOURCES_REGISTRY = registry;
    global.NEWS_SOURCE_IDS = Object.freeze(registry.map((row) => row.id));
    global.NEWS_SOURCE_BY_ID = Object.freeze(byId);
    global.NEWS_SOURCE_REGISTRY_UTILS = Object.freeze({
        normalizeHostname,
        normalizeSearchSite,
        getSourceEntry: resolveEntry,
        getSourceHosts,
        getSourceSearchSites,
        getSourceDisplayName,
        getSourceLanguage,
        getSourceSiteUrl,
        getSourceFilterMode,
        hostMatchesEntry,
        getSourceIdByHostname,
        getSourceLanguageByHostname
    });
})(typeof window !== 'undefined' ? window : globalThis);
