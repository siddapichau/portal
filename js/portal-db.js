/* ============================================================================
   portal-db.js — Camada única de acesso a dados do Portal (cérebro)
   ----------------------------------------------------------------------------
   REFEITO v3 — corrige travamento da tela inicial e adiciona controle
   MANUAL de versão global via Admin.

   O QUE MUDOU:
   - Nenhuma requisição de dados depende da checagem de versão. A versão é
     checada EM PARALELO e só limpa o cache quando muda.
   - Cache simples por tempo (TTL 2 min). Se a rede falhar, devolve cache
     velho (stale) para não deixar a tela em branco.
   - Nova chave de cache: pdb_cache_v3 (antigas v2 são apagadas automaticamente)
   - Preservação garantida: loggedUser, themePreference e portal_app_version
     NUNCA são apagados pelo limpador de cache.
   - Versão global: config/app_versao na planilha. Admin muda esse valor e
     todo navegador detecta e limpa cache (mantendo login).

   USO ADMIN (nova aba Versão / Cache):
   - Ler config/app_versao.json
   - PUT nova versão -> todos que entrarem limpam cache e recarregam
   - Botão limpar meu cache local

   Contrato idêntico ao anterior (REST Firebase-like):
     GET  ?path=users.json  e  ?path=users/abc.json
     PUT/PATCH/DELETE/POST via envelope __method
   ============================================================================ */

(function (global) {
    'use strict';

    // Evita duplicar se já carregou a v3
    if (global.PortalDB && global.PortalDB.__v3) return;

    var PortalDB = {
        // Cole aqui a URL /exec do Apps Script (com ou sem barra)
        URL: 'https://script.google.com/macros/s/AKfycbw3vDT2-dwTBnXP0NDZztLA8YzIxbb7i6TAZLvg7t5Q1j646XEl6BKeCkUdAdqLjhbDJw/exec',
        versionTtlMs: 15000, // intervalo mínimo entre checagens de versão no servidor
        CACHE_TTL: 2 * 60 * 1000, // 2 min de cache por nó
        PRESERVE_KEYS: ['loggedUser', 'themePreference', 'portal_app_version', 'portal_app_version_check', 'lastNewsTime', 'lastStatusTime', 'portal_page_urls'],
        __v3: true
    };

    // Nós que podem ser cacheados (cérebro). Páginas usam planilhas próprias, não cacheamos aqui.
    var CACHE_NODES = [
        'menu_global', 'users', 'cargos', 'funcoes', 'portal_news',
        'portal_status', 'portal_bigquery', 'logs', 'presence',
        'user_bookmarks', 'config'
    ];

    var LS_CACHE = 'pdb_cache_v3';
    var LS_VERSION = 'portal_app_version';
    var LS_LAST_CHECK = 'portal_app_version_check';

    function lsGet_(key, fb) {
        try { var raw = global.localStorage.getItem(key); return raw ? JSON.parse(raw) : fb; }
        catch (e) { return fb; }
    }
    function lsSet_(key, val) {
        try { global.localStorage.setItem(key, JSON.stringify(val)); } catch (e) { }
    }
    function lsGetStr_(key) {
        try { return global.localStorage.getItem(key); } catch (e) { return null; }
    }
    function lsSetStr_(key, val) {
        try { global.localStorage.setItem(key, val); } catch (e) { }
    }

    var cacheStore = lsGet_(LS_CACHE, {});
    // limpa resíduos da versão antiga que causava travamento
    try { global.localStorage.removeItem('pdb_cache_v2'); } catch(e){}
    try { global.localStorage.removeItem('pdb_meta_v2'); } catch(e){}
    var realFetch = (global.fetch && global.fetch.bind(global)) || null;

    function execBase() {
        return String(PortalDB.URL || '').replace(/\/+$/, '');
    }

    function urlValida_(u) {
        u = String(u || '').replace(/\/+$/, '');
        return /\/macros\/s\/.+\/exec$/i.test(u) && !/COLE_SUA_URL/i.test(u);
    }

    PortalDB.urlConfigurada = function () {
        return urlValida_(execBase());
    };

    // =========================================================================
    // URLs /exec POR PÁGINA (cada página pode ter a planilha dela)
    // -------------------------------------------------------------------------
    // O Admin (aba "Planilhas por Página") grava no nó `config` chaves no
    // formato:  url_pages/insumos.html  ->  https://.../exec
    // Aqui elas ficam espelhadas em localStorage.portal_page_urls para que
    // baseAtiva() consiga responder de forma SÍNCRONA já no carregamento.
    // =========================================================================
    var LS_PAGE_URLS = 'portal_page_urls';
    var PAGE_URL_PREFIX = 'url_';

    function pageUrlsMap_() { return lsGet_(LS_PAGE_URLS, {}) || {}; }

    // "pages/insumos.html" a partir do endereço atual (funciona dentro do iframe)
    PortalDB.paginaAtual = function () {
        try {
            var p = String(global.location.pathname || '');
            var partes = p.split('/').filter(Boolean);
            var arq = partes.length ? partes[partes.length - 1] : '';
            if (!/\.html?$/i.test(arq)) return 'index.html';
            var pai = partes.length > 1 ? partes[partes.length - 2] : '';
            return (pai === 'pages') ? ('pages/' + arq) : arq;
        } catch (e) { return 'index.html'; }
    };

    // URL da planilha da página informada (ou da atual). Cai na URL central.
    PortalDB.urlDaPagina = function (pagina) {
        var chave = pagina || PortalDB.paginaAtual();
        var mapa = pageUrlsMap_();
        var achou = mapa[chave] || mapa[String(chave).replace(/^pages\//, '')] || '';
        return urlValida_(achou) ? String(achou).replace(/\/+$/, '') : execBase();
    };

    // Lista de todas as bases conhecidas (central + páginas) — usada pelo fetch
    function basesConhecidas_() {
        var out = [];
        var c = execBase(); if (c) out.push(c);
        var mapa = pageUrlsMap_();
        Object.keys(mapa).forEach(function (k) {
            var u = String(mapa[k] || '').replace(/\/+$/, '');
            if (u && out.indexOf(u) === -1) out.push(u);
        });
        return out;
    }

    PortalDB.baseAtiva = function (pagina) {
        var u = PortalDB.urlDaPagina(pagina);
        if (!urlValida_(u)) {
            console.error(
                '[PortalDB] ⚠️ URL da planilha NÃO configurada.\n' +
                '1) Publique o Apps Script (Implantar → Aplicativo da web).\n' +
                '2) Cole a URL /exec em js/portal-db.js → PortalDB.URL\n' +
                '   (ou configure a planilha da página no Admin → Planilhas por Página).'
            );
        }
        return u + '/';
    };

    // Base do "cérebro" (menu, usuários, notícias...). Sempre a URL central.
    PortalDB.baseCentral = function () { return execBase() + '/'; };

    // Versão assíncrona garantida: se a URL da página ainda não foi sincronizada
    // no localStorage (ex.: primeiro acesso de outro usuário), faz a sincronização
    // antes de resolver para garantir que a requisição vá para a planilha certa.
    PortalDB.obterBaseAtiva = function (pagina) {
        var chave = pagina || PortalDB.paginaAtual();
        var mapa = pageUrlsMap_();
        var achou = mapa[chave] || mapa[String(chave).replace(/^pages\//, '')] || '';
        if (urlValida_(achou)) return Promise.resolve(String(achou).replace(/\/+$/, '') + '/');
        return PortalDB.syncPageUrls().then(function (novoMapa) {
            var u = (novoMapa && (novoMapa[chave] || novoMapa[String(chave).replace(/^pages\//, '')])) || '';
            return (urlValida_(u) ? String(u).replace(/\/+$/, '') : execBase()) + '/';
        }).catch(function () {
            return execBase() + '/';
        });
    };

    // Grava/atualiza o espelho local das URLs por página
    PortalDB.setPageUrls = function (mapa) {
        var limpo = {};
        Object.keys(mapa || {}).forEach(function (k) {
            var v = String(mapa[k] || '').trim().replace(/\/+$/, '');
            if (v) limpo[k] = v;
        });
        lsSet_(LS_PAGE_URLS, limpo);
        return limpo;
    };
    PortalDB.getPageUrls = pageUrlsMap_;

    // Busca no nó `config` todas as chaves url_* e espelha no localStorage
    PortalDB.syncPageUrls = function () {
        if (!realFetch || !urlValida_(execBase())) return Promise.resolve({});
        var url = execBase() + '?path=config.json&nc=1&_=' + Date.now();
        return realFetch(url, {}).then(function (r) { return r.json(); }).then(function (cfg) {
            if (!cfg || typeof cfg !== 'object') return {};
            var mapa = {};
            Object.keys(cfg).forEach(function (k) {
                if (k.indexOf(PAGE_URL_PREFIX) !== 0) return;
                var val = cfg[k];
                if (val && typeof val === 'object') val = (val.valor !== undefined ? val.valor : '');
                var pagina = k.slice(PAGE_URL_PREFIX.length);
                if (val) mapa[pagina] = String(val).trim().replace(/\/+$/, '');
            });
            return PortalDB.setPageUrls(mapa);
        }).catch(function () { return pageUrlsMap_(); });
    };

    // --------- helpers querystring ----------
    function parseQuery_(qs) {
        var out = {};
        if (!qs) return out;
        var parts = String(qs).split('&');
        for (var i = 0; i < parts.length; i++) {
            var pair = parts[i];
            if (!pair) continue;
            var eq = pair.indexOf('=');
            var k = decodeURIComponent((eq >= 0 ? pair.slice(0, eq) : pair).replace(/\+/g, ' '));
            var v = eq >= 0 ? decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' ')) : '';
            out[k] = v;
        }
        return out;
    }
    function buildQuery_(obj) {
        var parts = [];
        for (var k in obj) {
            if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
            if (obj[k] === undefined || obj[k] === null) continue;
            parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]));
        }
        return parts.join('&');
    }
    function splitExecUrl_(url, base) {
        var rest = url.slice(base.length);
        var qPos = rest.indexOf('?');
        var pathPart = (qPos >= 0 ? rest.slice(0, qPos) : rest).replace(/^\/+/, '');
        var queryPart = qPos >= 0 ? rest.slice(qPos + 1) : '';
        var params = parseQuery_(queryPart);
        if (!pathPart && params.path) pathPart = String(params.path).replace(/^\/+/, '');
        return { path: pathPart, params: params };
    }

    function makeCachedResponse_(jsonData) {
        var text = JSON.stringify(jsonData === undefined ? null : jsonData);
        return {
            ok: true,
            status: 200,
            url: '',
            json: function () { return Promise.resolve(jsonData); },
            text: function () { return Promise.resolve(text); },
            clone: function () { return makeCachedResponse_(jsonData); }
        };
    }

    // --------- limpeza de cache preservando login ----------
    function clearCachePreserveLogin_() {
        try {
            var preserve = {};
            PortalDB.PRESERVE_KEYS.forEach(function (k) {
                var v = lsGetStr_(k);
                if (v !== null) preserve[k] = v;
            });
            var allKeys = [];
            try {
                for (var i = 0; i < global.localStorage.length; i++) {
                    var kk = global.localStorage.key(i);
                    if (kk) allKeys.push(kk);
                }
            } catch (e) { }
            // remove tudo que não está na lista de preservação
            allKeys.forEach(function (k) {
                if (PortalDB.PRESERVE_KEYS.indexOf(k) === -1) {
                    // mantém chaves que parecem ser de avatar/tema antigo? não, só preserve list
                    try { global.localStorage.removeItem(k); } catch (e) { }
                }
            });
            // restaura preservadas (caso tenham sido removidas por iteração)
            Object.keys(preserve).forEach(function (k) {
                try { global.localStorage.setItem(k, preserve[k]); } catch (e) { }
            });
            cacheStore = {};
            lsSet_(LS_CACHE, {});
            // limpa chaves antigas
            try { global.localStorage.removeItem('pdb_cache_v2'); } catch (e) { }
            try { global.localStorage.removeItem('pdb_meta_v2'); } catch (e) { }
            try { global.localStorage.removeItem('pdb_meta_v3'); } catch (e) { }
            console.log('[PortalDB] cache limpo, login preservado');
        } catch (e) {
            console.warn('[PortalDB] falha ao limpar cache', e);
        }
    }

    PortalDB.clearCache = clearCachePreserveLogin_;

    // Recarrega o PORTAL INTEIRO (o shell index.html), não só o iframe.
    // Assim a nova versão vale para todas as páginas de uma vez.
    PortalDB.recarregarPortal = function () {
        try {
            if (global.top && global.top !== global.self) { global.top.location.reload(); return; }
        } catch (e) { /* cross-origin: cai no reload local */ }
        try { global.location.reload(); } catch (e) { }
    };

    PortalDB.forceClearCachePreserveLogin = function () {
        clearCachePreserveLogin_();
        lsSetStr_(LS_LAST_CHECK, '0');
        PortalDB.recarregarPortal();
    };
    // compatibilidade com código antigo
    PortalDB.bumpVersionCheck = function () { lsSetStr_(LS_LAST_CHECK, '0'); };
    PortalDB.getAppVersion = function () { return lsGetStr_(LS_VERSION) || '1'; };
    PortalDB.setAppVersionLocal = function (v) { lsSetStr_(LS_VERSION, String(v)); };

    // --------- versão global ----------
    function getServerAppVersion_() {
        var base = execBase();
        if (!PortalDB.urlConfigurada() || !realFetch) return Promise.resolve(null);
        var url = base + '?path=config/app_versao.json&nc=1&_=' + Date.now();
        return realFetch(url, {}).then(function (res) {
            return res.json();
        }).then(function (v) {
            if (v === null || v === undefined) return null;
            if (typeof v === 'object') {
                if (v.valor !== undefined) return String(v.valor);
                if (v.app_versao !== undefined) return String(v.app_versao);
                // se vier objeto completo de config (caso leitura coleção), tenta pegar app_versao
                if (v.app_versao && typeof v.app_versao === 'object' && v.app_versao.valor) return String(v.app_versao.valor);
            }
            return String(v);
        }).catch(function () { return null; });
    }

    function checkAndClearIfVersionChanged_(forceReload) {
        var now = Date.now();
        var last = parseInt(lsGetStr_(LS_LAST_CHECK) || '0', 10);
        if (forceReload !== true && last && (now - last) < PortalDB.versionTtlMs) {
            return Promise.resolve(false);
        }
        lsSetStr_(LS_LAST_CHECK, String(now));
        return getServerAppVersion_().then(function (serverV) {
            if (serverV === null) return false;
            var localV = lsGetStr_(LS_VERSION);
            if (localV === null) {
                lsSetStr_(LS_VERSION, serverV);
                return false;
            }
            if (String(localV) !== String(serverV)) {
                console.log('[PortalDB] versão global mudou', localV, '->', serverV, 'limpando cache');
                clearCachePreserveLogin_();
                lsSetStr_(LS_VERSION, serverV);
                if (forceReload !== false) {
                    try {
                        var flagKey = 'portal_reload_' + serverV;
                        if (!global.sessionStorage.getItem(flagKey)) {
                            global.sessionStorage.setItem(flagKey, '1');
                            setTimeout(function () { PortalDB.recarregarPortal(); }, 200);
                        }
                    } catch (e) {
                        setTimeout(function () { PortalDB.recarregarPortal(); }, 200);
                    }
                }
                return true;
            }
            return false;
        });
    }

    PortalDB.checkAppVersion = function () { return checkAndClearIfVersionChanged_(true); };
    PortalDB.checkAppVersionSilently = function () { return checkAndClearIfVersionChanged_(false); };

    // checagem imediata e periódica, sem travar a página
    try {
        setTimeout(function () { checkAndClearIfVersionChanged_(true); }, 350);
    } catch (e) { }
    // espelha as URLs /exec por página imediatamente e em segundo plano
    try {
        PortalDB.syncPageUrls();
    } catch (e) { }
    try {
        setTimeout(function () { PortalDB.syncPageUrls(); }, 600);
    } catch (e) { }
    try {
        setInterval(function () { checkAndClearIfVersionChanged_(true); }, 30000);
    } catch (e) { }

    // --------- override do fetch (seguro, nunca trava) ----------
    if (realFetch) {
        var originalFetch = realFetch;

        global.fetch = function (input, init) {
            init = init || {};
            var method = (init.method || 'GET').toUpperCase();
            var url = typeof input === 'string' ? input : (input && input.url);

            // Descobre qual base /exec essa chamada está usando (central OU de página)
            var base = null;
            var todas = basesConhecidas_();
            for (var b = 0; b < todas.length; b++) {
                if (url && todas[b] && url.indexOf(todas[b]) === 0) { base = todas[b]; break; }
            }

            if (!url || !base) {
                return originalFetch(input, init);
            }

            var split = splitExecUrl_(url, base);
            var path = split.path || '';
            var params = split.params || {};
            var node = String(path).replace(/\.json$/, '').split('/')[0];

            // Só cacheamos os nós do "cérebro" na planilha central.
            var ehCentral = (base === execBase());
            var isCacheable = ehCentral && CACHE_NODES.indexOf(node) !== -1 && method === 'GET' && !params.nc;

            function doRealFetch() {
                var sendParams = {};
                for (var k in params) {
                    if (Object.prototype.hasOwnProperty.call(params, k)) sendParams[k] = params[k];
                }
                if (path) sendParams.path = path;
                delete sendParams.nc;
                // __v e outros internos não vão pro servidor
                delete sendParams.__v;
                var qs = buildQuery_(sendParams);
                var finalUrl = base + (qs ? '?' + qs : '');

                return originalFetch(finalUrl, {}).then(function (res) {
                    if (isCacheable) {
                        try {
                            var clone = res.clone();
                            clone.json().then(function (data) {
                                cacheStore[node] = { t: Date.now(), data: data };
                                lsSet_(LS_CACHE, cacheStore);
                            }).catch(function () { });
                        } catch (e) { }
                    } else {
                        if (ehCentral && CACHE_NODES.indexOf(node) !== -1 && method !== 'GET') {
                            try { delete cacheStore[node]; lsSet_(LS_CACHE, cacheStore); } catch (e) { }
                        }
                    }
                    return res;
                }).catch(function (err) {
                    if (isCacheable && cacheStore[node]) {
                        console.warn('[PortalDB] rede falhou, usando cache stale para', node);
                        return makeCachedResponse_(cacheStore[node].data);
                    }
                    throw err;
                });
            }

            // GET cacheável: serve do cache se dentro do TTL
            if (isCacheable) {
                var cached = cacheStore[node];
                if (cached && (Date.now() - cached.t) < PortalDB.CACHE_TTL) {
                    return Promise.resolve(makeCachedResponse_(cached.data));
                }
                // se tem cache velho, tenta rede mas fallback usa velho (já tratado no catch)
                return doRealFetch();
            }

            // bypass de cache (nc=1) → limpa entrada daquele nó
            if (params.nc && ehCentral && CACHE_NODES.indexOf(node) !== -1) {
                try { delete cacheStore[node]; lsSet_(LS_CACHE, cacheStore); } catch (e) { }
            }

            // Escritas: traduz PUT/PATCH/DELETE para POST + envelope (Apps Script só tem doPost)
            if (method !== 'GET') {
                var parsed = null;
                if (init.body) {
                    try { parsed = JSON.parse(init.body); } catch (e) { parsed = init.body; }
                }
                // já envelopado?
                if (parsed && typeof parsed === 'object' && parsed.__method) {
                    return originalFetch(base, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify(parsed)
                    }).then(function (r) {
                        if (ehCentral && CACHE_NODES.indexOf(node) !== -1) {
                            try { delete cacheStore[node]; lsSet_(LS_CACHE, cacheStore); } catch (e2) { }
                        }
                        return r;
                    });
                }
                var payload = { __method: method, __path: path, __body: parsed };
                return originalFetch(base, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(payload)
                }).then(function (r) {
                    if (ehCentral && CACHE_NODES.indexOf(node) !== -1) {
                        try { delete cacheStore[node]; lsSet_(LS_CACHE, cacheStore); } catch (e) { }
                    }
                    return r;
                });
            }

            return doRealFetch();
        };
    }

    global.PortalDB = PortalDB;
})(window);
