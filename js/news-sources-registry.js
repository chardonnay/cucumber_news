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

    /** @type {readonly { id: string, siteUrl: string, displayName?: string, language?: string, feedStrategy?: string, feedVersion?: string, filterMode?: string, hosts?: string[], searchSites?: string[], sectionUrls?: string[] }[]} */
    const REG = [
        { id: 'heise', siteUrl: 'https://www.heise.de', displayName: 'heise.de', language: 'de', filterMode: 'heise', hosts: ['heise.de'] },
        { id: 'bild', siteUrl: 'https://www.bild.de', displayName: 'BILD', language: 'de', filterMode: 'single', hosts: ['bild.de'] },
        { id: 'telepolis', siteUrl: 'https://www.telepolis.de', displayName: 'Telepolis', language: 'de', filterMode: 'single', hosts: ['telepolis.de'] },
        { id: 'golem', siteUrl: 'https://www.golem.de', displayName: 'golem.de', language: 'de', filterMode: 'generic', hosts: ['golem.de'] },
        { id: 'computerbase', siteUrl: 'https://www.computerbase.de', displayName: 'ComputerBase', language: 'de', filterMode: 'generic', hosts: ['computerbase.de'] },
        { id: 't3n', siteUrl: 'https://t3n.de', displayName: 't3n.de', language: 'de', filterMode: 'generic', hosts: ['t3n.de'] },
        { id: 'it_administrator', siteUrl: 'https://www.it-administrator.de', displayName: 'IT-Administrator', language: 'de', filterMode: 'generic', hosts: ['it-administrator.de'] },
        { id: 'verge', siteUrl: 'https://www.theverge.com', displayName: 'The Verge', language: 'en', filterMode: 'generic', hosts: ['theverge.com'] },
        { id: 'nytimes', siteUrl: 'https://www.nytimes.com', displayName: 'The New York Times', language: 'en', feedStrategy: 'bing_news' },
        { id: 'bbc_news', siteUrl: 'https://www.bbc.com', displayName: 'BBC News', language: 'en', feedStrategy: 'bing_news', hosts: ['bbc.com', 'bbc.co.uk'], searchSites: ['bbc.com', 'bbc.co.uk'] },
        { id: 'cnn', siteUrl: 'https://www.cnn.com', displayName: 'CNN', language: 'en', feedStrategy: 'bing_news' },
        { id: 'yahoo_news_finance', siteUrl: 'https://news.yahoo.com', displayName: 'Yahoo News / Yahoo Finance', language: 'en', feedStrategy: 'bing_news', hosts: ['yahoo.com', 'news.yahoo.com', 'finance.yahoo.com'], searchSites: ['news.yahoo.com', 'finance.yahoo.com', 'yahoo.com'] },
        { id: 'msn_news', siteUrl: 'https://www.msn.com', displayName: 'MSN News', language: 'en', feedStrategy: 'bing_news', hosts: ['msn.com'] },
        { id: 'guardian', siteUrl: 'https://www.theguardian.com', displayName: 'The Guardian', language: 'en', feedStrategy: 'bing_news', hosts: ['theguardian.com'] },
        { id: 'daily_mail', siteUrl: 'https://www.dailymail.co.uk', displayName: 'Daily Mail / MailOnline', language: 'en', feedStrategy: 'bing_news', hosts: ['dailymail.co.uk'] },
        { id: 'fox_news', siteUrl: 'https://www.foxnews.com', displayName: 'Fox News', language: 'en', feedStrategy: 'bing_news', hosts: ['foxnews.com'] },
        {
            id: 'usa_today',
            siteUrl: 'https://www.usatoday.com',
            displayName: 'USA Today',
            language: 'en',
            feedStrategy: 'html_sections',
            feedVersion: '20260428a',
            hosts: ['usatoday.com'],
            sectionUrls: [
                'https://www.usatoday.com/',
                'https://www.usatoday.com/news/',
                'https://www.usatoday.com/sports/',
                'https://www.usatoday.com/money/',
                'https://www.usatoday.com/entertainment/',
                'https://www.usatoday.com/life/',
                'https://www.usatoday.com/tech/',
                'https://www.usatoday.com/travel/',
                'https://www.usatoday.com/opinion/'
            ]
        },
        { id: 'washington_post', siteUrl: 'https://www.washingtonpost.com', displayName: 'The Washington Post', language: 'en', feedStrategy: 'bing_news', hosts: ['washingtonpost.com'] },
        { id: 'wall_street_journal', siteUrl: 'https://www.wsj.com', displayName: 'The Wall Street Journal', language: 'en', feedStrategy: 'bing_news', hosts: ['wsj.com'] },
        { id: 'reuters', siteUrl: 'https://www.reuters.com', displayName: 'Reuters', language: 'en', feedStrategy: 'bing_news', hosts: ['reuters.com'] },
        { id: 'ap_news', siteUrl: 'https://apnews.com', displayName: 'Associated Press', language: 'en', feedStrategy: 'bing_news', hosts: ['apnews.com'] },
        { id: 'nbc_news', siteUrl: 'https://www.nbcnews.com', displayName: 'NBC News', language: 'en', feedStrategy: 'bing_news', hosts: ['nbcnews.com'] },
        { id: 'cbs_news', siteUrl: 'https://www.cbsnews.com', displayName: 'CBS News', language: 'en', feedStrategy: 'bing_news', hosts: ['cbsnews.com'] },
        { id: 'abc_news_us', siteUrl: 'https://abcnews.go.com', displayName: 'ABC News (US)', language: 'en', feedStrategy: 'bing_news', hosts: ['abcnews.go.com'] },
        { id: 'bloomberg', siteUrl: 'https://www.bloomberg.com', displayName: 'Bloomberg', language: 'en', feedStrategy: 'bing_news', hosts: ['bloomberg.com'] },
        { id: 'financial_times', siteUrl: 'https://www.ft.com', displayName: 'Financial Times', language: 'en', feedStrategy: 'bing_news', hosts: ['ft.com'] },
        { id: 'politico', siteUrl: 'https://www.politico.com', displayName: 'Politico', language: 'en', feedStrategy: 'bing_news', hosts: ['politico.com'] },
        { id: 'newsweek', siteUrl: 'https://www.newsweek.com', displayName: 'Newsweek', language: 'en', feedStrategy: 'bing_news', hosts: ['newsweek.com'] },
        { id: 'business_insider', siteUrl: 'https://www.businessinsider.com', displayName: 'Business Insider', language: 'en', feedStrategy: 'bing_news', hosts: ['businessinsider.com'] },
        { id: 'forbes', siteUrl: 'https://www.forbes.com', displayName: 'Forbes', language: 'en', feedStrategy: 'bing_news', hosts: ['forbes.com'] },
        { id: 'economist', siteUrl: 'https://www.economist.com', displayName: 'The Economist', language: 'en', feedStrategy: 'bing_news', hosts: ['economist.com'] },
        { id: 'los_angeles_times', siteUrl: 'https://www.latimes.com', displayName: 'Los Angeles Times', language: 'en', feedStrategy: 'bing_news', hosts: ['latimes.com'] },
        { id: 'times_of_india', siteUrl: 'https://timesofindia.indiatimes.com', displayName: 'The Times of India', language: 'en', feedStrategy: 'bing_news', hosts: ['timesofindia.com', 'indiatimes.com'], searchSites: ['timesofindia.com'] },
        { id: 'hindustan_times', siteUrl: 'https://www.hindustantimes.com', displayName: 'Hindustan Times', language: 'en', feedStrategy: 'bing_news', hosts: ['hindustantimes.com'] },
        { id: 'india_today', siteUrl: 'https://www.indiatoday.in', displayName: 'India Today', language: 'en', feedStrategy: 'bing_news', hosts: ['indiatoday.in'] },
        { id: 'india_com', siteUrl: 'https://www.india.com', displayName: 'India.com', language: 'en', feedStrategy: 'bing_news', hosts: ['india.com'] },
        { id: 'ndtv', siteUrl: 'https://www.ndtv.com', displayName: 'NDTV', language: 'en', feedStrategy: 'bing_news', hosts: ['ndtv.com'] },
        { id: 'news18', siteUrl: 'https://www.news18.com', displayName: 'News18', language: 'en', feedStrategy: 'bing_news', hosts: ['news18.com'] },
        { id: 'indian_express', siteUrl: 'https://indianexpress.com', displayName: 'Indian Express', language: 'en', feedStrategy: 'bing_news', hosts: ['indianexpress.com'] },
        { id: 'the_hindu', siteUrl: 'https://www.thehindu.com', displayName: 'The Hindu', language: 'en', feedStrategy: 'bing_news', hosts: ['thehindu.com'] },
        { id: 'al_jazeera', siteUrl: 'https://www.aljazeera.com', displayName: 'Al Jazeera', language: 'en', feedStrategy: 'bing_news', hosts: ['aljazeera.com'] },
        { id: 'deutsche_welle', siteUrl: 'https://www.dw.com', displayName: 'Deutsche Welle', language: 'en', feedStrategy: 'bing_news', hosts: ['dw.com'] },
        { id: 'spiegel', siteUrl: 'https://www.spiegel.de', displayName: 'Der Spiegel', language: 'de', feedStrategy: 'bing_news', hosts: ['spiegel.de'] },
        { id: 'welt', siteUrl: 'https://www.welt.de', displayName: 'WELT', language: 'de', feedStrategy: 'bing_news', hosts: ['welt.de'] },
        { id: 'sueddeutsche_zeitung', siteUrl: 'https://www.sueddeutsche.de', displayName: 'Süddeutsche Zeitung', language: 'de', feedStrategy: 'bing_news', hosts: ['sueddeutsche.de'] },
        { id: 'faz', siteUrl: 'https://www.faz.net', displayName: 'FAZ', language: 'de', feedStrategy: 'bing_news', hosts: ['faz.net'] },
        { id: 'tagesschau', siteUrl: 'https://www.tagesschau.de', displayName: 'Tagesschau', language: 'de', feedStrategy: 'bing_news', hosts: ['tagesschau.de'] },
        { id: 'n_tv', siteUrl: 'https://www.n-tv.de', displayName: 'n-tv', language: 'de', feedStrategy: 'bing_news', hosts: ['n-tv.de'] },
        { id: 't_online', siteUrl: 'https://www.t-online.de', displayName: 't-online', language: 'de', feedStrategy: 'bing_news', hosts: ['t-online.de'] },
        { id: 'focus_online', siteUrl: 'https://www.focus.de', displayName: 'Focus Online', language: 'de', feedStrategy: 'bing_news', hosts: ['focus.de'] },
        { id: 'stern', siteUrl: 'https://www.stern.de', displayName: 'Stern', language: 'de', feedStrategy: 'bing_news', hosts: ['stern.de'] },
        { id: 'zeit_online', siteUrl: 'https://www.zeit.de', displayName: 'Zeit Online', language: 'de', feedStrategy: 'bing_news', hosts: ['zeit.de'] },
        { id: 'sun', siteUrl: 'https://www.thesun.co.uk', displayName: 'The Sun', language: 'en', feedStrategy: 'bing_news', hosts: ['thesun.co.uk'] },
        { id: 'mirror', siteUrl: 'https://www.mirror.co.uk', displayName: 'The Mirror', language: 'en', feedStrategy: 'bing_news', hosts: ['mirror.co.uk'] },
        { id: 'independent', siteUrl: 'https://www.independent.co.uk', displayName: 'The Independent', language: 'en', feedStrategy: 'bing_news', hosts: ['independent.co.uk'] },
        { id: 'sky_news', siteUrl: 'https://news.sky.com', displayName: 'Sky News', language: 'en', feedStrategy: 'bing_news', hosts: ['news.sky.com', 'sky.com'], searchSites: ['news.sky.com'] },
        { id: 'telegraph', siteUrl: 'https://www.telegraph.co.uk', displayName: 'Telegraph', language: 'en', feedStrategy: 'bing_news', hosts: ['telegraph.co.uk'] },
        { id: 'metro_uk', siteUrl: 'https://metro.co.uk', displayName: 'Metro (UK)', language: 'en', feedStrategy: 'bing_news', hosts: ['metro.co.uk'] },
        { id: 'le_monde', siteUrl: 'https://www.lemonde.fr', displayName: 'Le Monde', language: 'fr', feedStrategy: 'bing_news', hosts: ['lemonde.fr'] },
        { id: 'le_figaro', siteUrl: 'https://www.lefigaro.fr', displayName: 'Le Figaro', language: 'fr', feedStrategy: 'bing_news', hosts: ['lefigaro.fr'] },
        { id: 'la_repubblica', siteUrl: 'https://www.repubblica.it', displayName: 'La Repubblica', language: 'it', feedStrategy: 'bing_news', hosts: ['repubblica.it'] },
        { id: 'corriere_della_sera', siteUrl: 'https://www.corriere.it', displayName: 'Corriere della Sera', language: 'it', feedStrategy: 'bing_news', hosts: ['corriere.it'] },
        { id: 'el_pais', siteUrl: 'https://elpais.com', displayName: 'El País', language: 'es', feedStrategy: 'bing_news', hosts: ['elpais.com'] },
        { id: 'el_mundo', siteUrl: 'https://www.elmundo.es', displayName: 'El Mundo', language: 'es', feedStrategy: 'bing_news', hosts: ['elmundo.es'] },
        { id: 'la_nacion', siteUrl: 'https://www.lanacion.com.ar', displayName: 'La Nación', language: 'es', feedStrategy: 'bing_news', hosts: ['lanacion.com.ar'] },
        { id: 'clarin', siteUrl: 'https://www.clarin.com', displayName: 'Clarín', language: 'es', feedStrategy: 'bing_news', hosts: ['clarin.com'] },
        { id: 'globo', siteUrl: 'https://www.globo.com', displayName: 'Globo', language: 'pt', feedStrategy: 'bing_news', hosts: ['globo.com'] },
        { id: 'uol', siteUrl: 'https://www.uol.com.br', displayName: 'UOL', language: 'pt', feedStrategy: 'bing_news', hosts: ['uol.com.br'] },
        { id: 'folha', siteUrl: 'https://www.folha.uol.com.br', displayName: 'Folha de S.Paulo', language: 'pt', feedStrategy: 'bing_news', hosts: ['folha.uol.com.br'], searchSites: ['folha.uol.com.br'] },
        { id: 'estadao', siteUrl: 'https://www.estadao.com.br', displayName: 'O Estado de S. Paulo', language: 'pt', feedStrategy: 'bing_news', hosts: ['estadao.com.br'] },
        { id: 'cbc_news', siteUrl: 'https://www.cbc.ca/news', displayName: 'CBC News', language: 'en', feedStrategy: 'bing_news', hosts: ['cbc.ca'] },
        { id: 'global_news_ca', siteUrl: 'https://globalnews.ca', displayName: 'Global News (CA)', language: 'en', feedStrategy: 'bing_news', hosts: ['globalnews.ca'] },
        { id: 'toronto_star', siteUrl: 'https://www.thestar.com', displayName: 'Toronto Star', language: 'en', feedStrategy: 'bing_news', hosts: ['thestar.com'] },
        { id: 'la_presse', siteUrl: 'https://www.lapresse.ca', displayName: 'La Presse', language: 'fr', feedStrategy: 'bing_news', hosts: ['lapresse.ca'] },
        { id: 'radio_canada_info', siteUrl: 'https://ici.radio-canada.ca', displayName: 'Radio-Canada Info', language: 'fr', feedStrategy: 'bing_news', hosts: ['ici.radio-canada.ca', 'radio-canada.ca'], searchSites: ['ici.radio-canada.ca'] },
        { id: 'yomiuri', siteUrl: 'https://www.yomiuri.co.jp', displayName: 'Yomiuri Online', language: 'ja', feedStrategy: 'bing_news', hosts: ['yomiuri.co.jp'] },
        { id: 'asahi_shimbun', siteUrl: 'https://www.asahi.com', displayName: 'Asahi Shimbun', language: 'ja', feedStrategy: 'bing_news', hosts: ['asahi.com'] },
        { id: 'nikkei', siteUrl: 'https://www.nikkei.com', displayName: 'Nikkei', language: 'ja', feedStrategy: 'bing_news', hosts: ['nikkei.com'] },
        { id: 'mainichi_shimbun', siteUrl: 'https://mainichi.jp', displayName: 'Mainichi Shimbun', language: 'ja', feedStrategy: 'bing_news', hosts: ['mainichi.jp'] },
        { id: 'joongang', siteUrl: 'https://koreajoongangdaily.joins.com', displayName: 'Korea JoongAng Daily / JoongAng Ilbo', language: 'en', feedStrategy: 'bing_news', hosts: ['joins.com', 'koreajoongangdaily.joins.com'], searchSites: ['koreajoongangdaily.joins.com', 'joins.com'] },
        { id: 'chosun_ilbo', siteUrl: 'https://www.chosun.com', displayName: 'Chosun Ilbo', language: 'ko', feedStrategy: 'bing_news', hosts: ['chosun.com'] },
        { id: 'yonhap_news', siteUrl: 'https://en.yna.co.kr', displayName: 'Yonhap News', language: 'en', feedStrategy: 'bing_news', hosts: ['yonhapnews.co.kr', 'yna.co.kr'], searchSites: ['yonhapnews.co.kr', 'yna.co.kr'] },
        { id: 'sydney_morning_herald', siteUrl: 'https://www.smh.com.au', displayName: 'Sydney Morning Herald', language: 'en', feedStrategy: 'bing_news', hosts: ['smh.com.au'] },
        { id: 'the_age', siteUrl: 'https://www.theage.com.au', displayName: 'The Age', language: 'en', feedStrategy: 'bing_news', hosts: ['theage.com.au'] },
        { id: 'news_com_au', siteUrl: 'https://www.news.com.au', displayName: 'News.com.au', language: 'en', feedStrategy: 'bing_news', hosts: ['news.com.au'] },
        { id: 'abc_news_au', siteUrl: 'https://www.abc.net.au/news', displayName: 'ABC News (Australia)', language: 'en', feedStrategy: 'bing_news', hosts: ['abc.net.au'] },
        { id: 'the_australian', siteUrl: 'https://www.theaustralian.com.au', displayName: 'The Australian', language: 'en', feedStrategy: 'bing_news', hosts: ['theaustralian.com.au'] },
        { id: 'stuff_nz', siteUrl: 'https://www.stuff.co.nz', displayName: 'Stuff', language: 'en', feedStrategy: 'bing_news', hosts: ['stuff.co.nz'] },
        { id: 'nz_herald', siteUrl: 'https://www.nzherald.co.nz', displayName: 'NZ Herald', language: 'en', feedStrategy: 'bing_news', hosts: ['nzherald.co.nz'] },
        { id: 'gulf_news', siteUrl: 'https://gulfnews.com', displayName: 'Gulf News', language: 'en', feedStrategy: 'bing_news', hosts: ['gulfnews.com'] },
        { id: 'khaleej_times', siteUrl: 'https://www.khaleejtimes.com', displayName: 'Khaleej Times', language: 'en', feedStrategy: 'bing_news', hosts: ['khaleejtimes.com'] },
        { id: 'haaretz', siteUrl: 'https://www.haaretz.com', displayName: 'Haaretz', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.haaretz.com/srv/haaretz-latest-headlines', feedVersion: '20260417a', hosts: ['haaretz.com'] },
        { id: 'times_of_israel', siteUrl: 'https://www.timesofisrael.com', displayName: 'Times of Israel', language: 'en', feedStrategy: 'bing_news', hosts: ['timesofisrael.com'] },
        { id: 'al_arabiya_en', siteUrl: 'https://english.alarabiya.net', displayName: 'Al Arabiya', language: 'en', feedStrategy: 'bing_news', hosts: ['english.alarabiya.net', 'alarabiya.net'], searchSites: ['english.alarabiya.net'] },
        { id: 'arab_news', siteUrl: 'https://www.arabnews.com', displayName: 'Arab News', language: 'en', feedStrategy: 'direct_rss', feedUrl: 'https://www.arabnews.com/rss.xml', feedVersion: '20260417a', hosts: ['arabnews.com'] },
        { id: 'scmp', siteUrl: 'https://www.scmp.com', displayName: 'South China Morning Post', language: 'en', feedStrategy: 'bing_news', hosts: ['scmp.com'] },
        { id: 'straits_times', siteUrl: 'https://www.straitstimes.com', displayName: 'The Straits Times', language: 'en', feedStrategy: 'bing_news', hosts: ['straitstimes.com'] },
        { id: 'cna', siteUrl: 'https://www.channelnewsasia.com', displayName: 'Channel NewsAsia / CNA', language: 'en', feedStrategy: 'bing_news', hosts: ['channelnewsasia.com'] },
        { id: 'rappler', siteUrl: 'https://www.rappler.com', displayName: 'Rappler', language: 'en', feedStrategy: 'bing_news', hosts: ['rappler.com'] },
        { id: 'inquirer', siteUrl: 'https://www.inquirer.net', displayName: 'Inquirer', language: 'en', feedStrategy: 'bing_news', hosts: ['inquirer.net'] },
        { id: 'bangkok_post', siteUrl: 'https://www.bangkokpost.com', displayName: 'Bangkok Post', language: 'en', feedStrategy: 'bing_news', hosts: ['bangkokpost.com'] },
        { id: 'vnexpress', siteUrl: 'https://vnexpress.net', displayName: 'VnExpress', language: 'vi', feedStrategy: 'bing_news', hosts: ['vnexpress.net'] },
        { id: 'allafrica', siteUrl: 'https://allafrica.com', displayName: 'AllAfrica', language: 'en', feedStrategy: 'bing_news', hosts: ['allafrica.com'] },
        { id: 'mail_and_guardian', siteUrl: 'https://mg.co.za', displayName: 'Mail & Guardian', language: 'en', feedStrategy: 'bing_news', hosts: ['mg.co.za'] },
        { id: 'daily_nation_kenya', siteUrl: 'https://nation.africa', displayName: 'Daily Nation (Kenya)', language: 'en', feedStrategy: 'bing_news', hosts: ['nation.africa'] },
        { id: 'infobae', siteUrl: 'https://www.infobae.com', displayName: 'Infobae', language: 'es', feedStrategy: 'bing_news', hosts: ['infobae.com'] },
        { id: 'people', siteUrl: 'https://people.com', displayName: 'People', language: 'en', feedStrategy: 'bing_news', hosts: ['people.com'] },
        { id: 'espn', siteUrl: 'https://www.espn.com', displayName: 'ESPN', language: 'en', feedStrategy: 'bing_news', hosts: ['espn.com'] },
        { id: 'marca', siteUrl: 'https://www.marca.com', displayName: 'Marca', language: 'es', feedStrategy: 'bing_news', hosts: ['marca.com'] },
        { id: 'as_com', siteUrl: 'https://as.com', displayName: 'AS', language: 'es', feedStrategy: 'bing_news', hosts: ['as.com'] },
        { id: 'cricbuzz', siteUrl: 'https://www.cricbuzz.com', displayName: 'Cricbuzz', language: 'en', feedStrategy: 'bing_news', hosts: ['cricbuzz.com'] },
        { id: 'bleacher_report', siteUrl: 'https://bleacherreport.com', displayName: 'Bleacher Report', language: 'en', feedStrategy: 'bing_news', hosts: ['bleacherreport.com'] },
        { id: 'sports_reference', siteUrl: 'https://www.sports-reference.com', displayName: 'Sports Reference', language: 'en', feedStrategy: 'bing_news', hosts: ['sports-reference.com'] },
        { id: 'goal', siteUrl: 'https://www.goal.com', displayName: 'Goal', language: 'en', feedStrategy: 'bing_news', hosts: ['goal.com'] },
        { id: 'sky_sports', siteUrl: 'https://www.skysports.com', displayName: 'Sky Sports', language: 'en', feedStrategy: 'bing_news', hosts: ['skysports.com'] },
        { id: 'ninetymin', siteUrl: 'https://www.90min.com', displayName: '90min', language: 'en', feedStrategy: 'bing_news', hosts: ['90min.com'] },
        { id: 'transfermarkt', siteUrl: 'https://www.transfermarkt.de', displayName: 'Transfermarkt', language: 'de', feedStrategy: 'bing_news', hosts: ['transfermarkt.de'] },
        { id: 'imdb', siteUrl: 'https://www.imdb.com', displayName: 'IMDb', language: 'en', feedStrategy: 'bing_news', hosts: ['imdb.com'] },
        { id: 'fandom', siteUrl: 'https://www.fandom.com', displayName: 'Fandom', language: 'en', feedStrategy: 'bing_news', hosts: ['fandom.com'] },
        { id: 'rotten_tomatoes', siteUrl: 'https://www.rottentomatoes.com', displayName: 'Rotten Tomatoes', language: 'en', feedStrategy: 'bing_news', hosts: ['rottentomatoes.com'] },
        { id: 'variety', siteUrl: 'https://variety.com', displayName: 'Variety', language: 'en', feedStrategy: 'bing_news', hosts: ['variety.com'] },
        { id: 'hollywood_reporter', siteUrl: 'https://www.hollywoodreporter.com', displayName: 'The Hollywood Reporter', language: 'en', feedStrategy: 'bing_news', hosts: ['hollywoodreporter.com'] },
        { id: 'tmz', siteUrl: 'https://www.tmz.com', displayName: 'TMZ', language: 'en', feedStrategy: 'bing_news', hosts: ['tmz.com'] },
        { id: 'rolling_stone', siteUrl: 'https://www.rollingstone.com', displayName: 'Rolling Stone', language: 'en', feedStrategy: 'bing_news', hosts: ['rollingstone.com'] },
        { id: 'billboard', siteUrl: 'https://www.billboard.com', displayName: 'Billboard', language: 'en', feedStrategy: 'bing_news', hosts: ['billboard.com'] },
        { id: 'entertainment_weekly', siteUrl: 'https://ew.com', displayName: 'Entertainment Weekly', language: 'en', feedStrategy: 'bing_news', hosts: ['ew.com'] },
        { id: 'deadline', siteUrl: 'https://deadline.com', displayName: 'Deadline', language: 'en', feedStrategy: 'bing_news', hosts: ['deadline.com'] },
        { id: 'techcrunch', siteUrl: 'https://techcrunch.com', displayName: 'TechCrunch', language: 'en', feedStrategy: 'bing_news', hosts: ['techcrunch.com'] },
        { id: 'wired', siteUrl: 'https://www.wired.com', displayName: 'WIRED', language: 'en', feedStrategy: 'bing_news', hosts: ['wired.com'] },
        { id: 'cnet', siteUrl: 'https://www.cnet.com', displayName: 'CNET', language: 'en', feedStrategy: 'bing_news', hosts: ['cnet.com'] },
        { id: 'toms_guide', siteUrl: 'https://www.tomsguide.com', displayName: 'Tom\'s Guide', language: 'en', feedStrategy: 'bing_news', hosts: ['tomsguide.com'] },
        { id: 'toms_hardware', siteUrl: 'https://www.tomshardware.com', displayName: 'Tom\'s Hardware', language: 'en', feedStrategy: 'bing_news', hosts: ['tomshardware.com'] },
        { id: 'digital_trends', siteUrl: 'https://www.digitaltrends.com', displayName: 'Digital Trends', language: 'en', feedStrategy: 'bing_news', hosts: ['digitaltrends.com'] },
        { id: 'how_to_geek', siteUrl: 'https://www.howtogeek.com', displayName: 'How-To Geek', language: 'en', feedStrategy: 'bing_news', hosts: ['howtogeek.com'] },
        { id: 'scientific_american', siteUrl: 'https://www.scientificamerican.com', displayName: 'Scientific American', language: 'en', feedStrategy: 'bing_news', hosts: ['scientificamerican.com'] },
        { id: 'discover_magazine', siteUrl: 'https://www.discovermagazine.com', displayName: 'Discover Magazine', language: 'en', feedStrategy: 'bing_news', hosts: ['discovermagazine.com'] },
        { id: 'new_scientist', siteUrl: 'https://www.newscientist.com', displayName: 'New Scientist', language: 'en', feedStrategy: 'bing_news', hosts: ['newscientist.com'] },
        { id: 'national_geographic', siteUrl: 'https://www.nationalgeographic.com', displayName: 'National Geographic', language: 'en', feedStrategy: 'bing_news', hosts: ['nationalgeographic.com'] },
        { id: 'engadget', siteUrl: 'https://www.engadget.com', displayName: 'Engadget', language: 'en', feedStrategy: 'bing_news', hosts: ['engadget.com'] },
        { id: 'gizmodo', siteUrl: 'https://gizmodo.com', displayName: 'Gizmodo', language: 'en', feedStrategy: 'bing_news', hosts: ['gizmodo.com'] },
        { id: 'ars_technica', siteUrl: 'https://arstechnica.com', displayName: 'Ars Technica', language: 'en', feedStrategy: 'bing_news', hosts: ['arstechnica.com'] },
        { id: 'ign', siteUrl: 'https://www.ign.com', displayName: 'IGN', language: 'en', feedStrategy: 'bing_news', hosts: ['ign.com'] },
        { id: 'gamespot', siteUrl: 'https://www.gamespot.com', displayName: 'GameSpot', language: 'en', feedStrategy: 'bing_news', hosts: ['gamespot.com'] },
        { id: 'kotaku', siteUrl: 'https://kotaku.com', displayName: 'Kotaku', language: 'en', feedStrategy: 'bing_news', hosts: ['kotaku.com'] },
        { id: 'pc_gamer', siteUrl: 'https://www.pcgamer.com', displayName: 'PC Gamer', language: 'en', feedStrategy: 'bing_news', hosts: ['pcgamer.com'] },
        { id: 'polygon', siteUrl: 'https://www.polygon.com', displayName: 'Polygon', language: 'en', feedStrategy: 'bing_news', hosts: ['polygon.com'] },
        { id: 'investopedia', siteUrl: 'https://www.investopedia.com', displayName: 'Investopedia', language: 'en', feedStrategy: 'bing_news', hosts: ['investopedia.com'] },
        { id: 'marketwatch', siteUrl: 'https://www.marketwatch.com', displayName: 'MarketWatch', language: 'en', feedStrategy: 'bing_news', hosts: ['marketwatch.com'] },
        { id: 'cnbc', siteUrl: 'https://www.cnbc.com', displayName: 'CNBC', language: 'en', feedStrategy: 'bing_news', hosts: ['cnbc.com'] },
        { id: 'fortune', siteUrl: 'https://fortune.com', displayName: 'Fortune', language: 'en', feedStrategy: 'bing_news', hosts: ['fortune.com'] },
        { id: 'health', siteUrl: 'https://www.health.com', displayName: 'Health', language: 'en', feedStrategy: 'bing_news', hosts: ['health.com'] },
        { id: 'webmd', siteUrl: 'https://www.webmd.com', displayName: 'WebMD', language: 'en', feedStrategy: 'bing_news', hosts: ['webmd.com'] },
        { id: 'healthline', siteUrl: 'https://www.healthline.com', displayName: 'Healthline', language: 'en', feedStrategy: 'bing_news', hosts: ['healthline.com'] },
        { id: 'medical_news_today', siteUrl: 'https://www.medicalnewstoday.com', displayName: 'Medical News Today', language: 'en', feedStrategy: 'bing_news', hosts: ['medicalnewstoday.com'] },
        { id: 'vogue', siteUrl: 'https://www.vogue.com', displayName: 'Vogue', language: 'en', feedStrategy: 'bing_news', hosts: ['vogue.com'] },
        { id: 'cosmopolitan', siteUrl: 'https://www.cosmopolitan.com', displayName: 'Cosmopolitan', language: 'en', feedStrategy: 'bing_news', hosts: ['cosmopolitan.com'] },
        { id: 'elle', siteUrl: 'https://www.elle.com', displayName: 'ELLE', language: 'en', feedStrategy: 'bing_news', hosts: ['elle.com'] },
        { id: 'gq', siteUrl: 'https://www.gq.com', displayName: 'GQ', language: 'en', feedStrategy: 'bing_news', hosts: ['gq.com'] },
        { id: 'mens_health', siteUrl: 'https://www.menshealth.com', displayName: 'Men\'s Health', language: 'en', feedStrategy: 'bing_news', hosts: ['menshealth.com'] },
        { id: 'womens_health', siteUrl: 'https://www.womenshealthmag.com', displayName: 'Women\'s Health', language: 'en', feedStrategy: 'bing_news', hosts: ['womenshealthmag.com'] },
        { id: 'harpers_bazaar', siteUrl: 'https://www.harpersbazaar.com', displayName: 'Harper\'s Bazaar', language: 'en', feedStrategy: 'bing_news', hosts: ['harpersbazaar.com'] },
        { id: 'instyle', siteUrl: 'https://www.instyle.com', displayName: 'InStyle', language: 'en', feedStrategy: 'bing_news', hosts: ['instyle.com'] },
        { id: 'allrecipes', siteUrl: 'https://www.allrecipes.com', displayName: 'Allrecipes', language: 'en', feedStrategy: 'bing_news', hosts: ['allrecipes.com'] },
        { id: 'food_network', siteUrl: 'https://www.foodnetwork.com', displayName: 'Food Network', language: 'en', feedStrategy: 'bing_news', hosts: ['foodnetwork.com'] },
        { id: 'serious_eats', siteUrl: 'https://www.seriouseats.com', displayName: 'Serious Eats', language: 'en', feedStrategy: 'bing_news', hosts: ['seriouseats.com'] },
        { id: 'lonely_planet', siteUrl: 'https://www.lonelyplanet.com', displayName: 'Lonely Planet', language: 'en', feedStrategy: 'bing_news', hosts: ['lonelyplanet.com'] },
        { id: 'travel_and_leisure', siteUrl: 'https://www.travelandleisure.com', displayName: 'Travel + Leisure', language: 'en', feedStrategy: 'bing_news', hosts: ['travelandleisure.com'] },
        { id: 'cn_traveler', siteUrl: 'https://www.cntraveler.com', displayName: 'Condé Nast Traveler', language: 'en', feedStrategy: 'bing_news', hosts: ['cntraveler.com'] },
        { id: 'frommers', siteUrl: 'https://www.frommers.com', displayName: 'Frommer\'s', language: 'en', feedStrategy: 'bing_news', hosts: ['frommers.com'] },
        { id: 'rough_guides', siteUrl: 'https://www.roughguides.com', displayName: 'Rough Guides', language: 'en', feedStrategy: 'bing_news', hosts: ['roughguides.com'] },
        { id: 'el_universal_mx', siteUrl: 'https://www.eluniversal.com.mx', displayName: 'El Universal', language: 'es', feedStrategy: 'bing_news', hosts: ['eluniversal.com.mx'] },
        { id: 'atlantic', siteUrl: 'https://www.theatlantic.com', displayName: 'The Atlantic', language: 'en', feedStrategy: 'bing_news', hosts: ['theatlantic.com'] },
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
