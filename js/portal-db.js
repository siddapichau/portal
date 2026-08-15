/* ============================================================================
   portal-db.js — Camada única de acesso a dados do Portal ("cérebro")
   ----------------------------------------------------------------------------
   O portal é 100% PLANILHA (Google Sheets via Apps Script).
   Não existe mais nenhuma conexão com Firebase aqui — a única referência ao
   Firebase no projeto fica no Apps Script, só para a importação dos dados.

   ⚡ CACHE INTELIGENTE (novo nesta versão):
     - Os nós do cérebro (menu, usuários, cargos, notícias, status, logs…)
       ficam salvos em localStorage do navegador.
     - Cada nó guarda junto a SUA versão (o Apps Script incrementa "v_<nó>"
       sempre que algo é alterado). Ao carregar, o script pergunta a versão
       atual; se mudou, apaga o cache DAQUELE nó e busca de novo.
     - O login NÃO é perdido: ele fica em outra chave do localStorage
       ('loggedUser') que o cache nunca toca.
     - Para forçar leitura fresca numa chamada, use `&nc=1` na URL.

   COMO ATIVAR:
     1) Publique o Apps Script da planilha (Implantar → Aplicativo da web).
     2) Cole aqui a URL `/exec` gerada. Pronto: todas as páginas usam a
        planilha automaticamente (contrato idêntico ao que o portal já usava).

   O que este arquivo faz:
     - Expõe PortalDB.URL / PortalDB.urlConfigurada() / PortalDB.baseAtiva()
     - Traduz GET  → `?path=...` (evita o muro de login do pathInfo)
     - Traduz PUT/PATCH/DELETE (não suportados nativamente pelo Apps Script)
       para POST, mantendo o mesmo contrato REST (troca transparente).
   ============================================================================ */

(function (global) {
    'use strict';

    if (global.PortalDB) return; // idempotente

    var PortalDB = {
        // ====== CONFIGURAÇÃO =================================================
        // Cole a URL /exec do Apps Script (com ou sem barra no final — tanto faz)
        URL: 'https://script.google.com/macros/s/AKfycbw3vDT2-dwTBnXP0NDZztLA8YzIxbb7i6TAZLvg7t5Q1j646XEl6BKeCkUdAdqLjhbDJw/exec',

        // ====== CACHE ========================================================
        // Quantos ms entre checagens da versão no servidor (para não espancar
        // a API a cada fetch). Reduza para detectar mudanças mais rápido.
        versionTtlMs: 8000
    };

    // Nós do CÉREBRO que podem ser cacheados. Nós de páginas (equipamentos,
    // aderência…) NÃO entram aqui — cada um tem a planilha própria e não deve
    // ser cacheado por este módulo.
    var CACHE_NODES = [
        'menu_global', 'users', 'cargos', 'funcoes', 'portal_news',
        'portal_status', 'portal_bigquery', 'logs', 'presence',
        'user_bookmarks', 'config'
    ];

    var LS_CACHE = 'pdb_cache_v2';   // { nó: { v: versão, data: ... } }
    var LS_META = 'pdb_meta_v2';     // { v: { nó: versão, ... }, t: carimbo }

    function lsGet_(key, fb) {
        try { var raw = global.localStorage.getItem(key); return raw ? JSON.parse(raw) : fb; }
        catch (e) { return fb; }
    }
    function lsSet_(key, val) {
        try { global.localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
    }

    var cache = { nodes: lsGet_(LS_CACHE, {}), meta: lsGet_(LS_META, null) };
    var inflightVersion = null;

    function execBase() {
        return String(PortalDB.URL || '').replace(/\/+$/, '');
    }

    /* True se a URL da planilha está configurada (não é placeholder). */
    PortalDB.urlConfigurada = function () {
        var u = execBase();
        return /\/macros\/s\/.+\/exec$/i.test(u) && !/COLE_SUA_URL/i.test(u);
    };

    /* Base ativa: SEMPRE a planilha, com barra final.
       Assim `${base}menu_global.json` continua válido em todas as páginas. */
    PortalDB.baseAtiva = function () {
        if (!PortalDB.urlConfigurada()) {
            console.error(
                '[PortalDB] ⚠️ URL da planilha NÃO configurada.\n' +
                '1) Publique o Apps Script (Implantar → Aplicativo da web).\n' +
                '2) Cole a URL /exec em js/portal-db.js → PortalDB.URL.\n' +
                'Sem isso o portal não carrega dados.'
            );
        }
        return execBase() + '/';
    };

    // ========================================================================
    // CACHE — leitura da versão por nó (via endpoint de saúde) + invalidação
    // ========================================================================

    function getVersionMap_() {
        if (inflightVersion) return inflightVersion;
        inflightVersion = realFetch(execBase() + '?__v=' + Date.now(), {})
            .then(function (res) { return res.json(); })
            .then(function (h) {
                return (h && typeof h.versao_por_no === 'object') ? h.versao_por_no : null;
            })
            .catch(function () { return null; })
            .then(function (vm) {
                inflightVersion = null;
                return vm;
            });
        return inflightVersion;
    }

    // Checa a versão do servidor (limitado a versionTtlMs). Se um nó mudou,
    // descarta o cache só daquele nó. Nunca mexe no 'loggedUser'.
    function ensureVersion_() {
        var now = Date.now();
        if (cache.meta && (now - (cache.meta.t || 0)) < PortalDB.versionTtlMs) {
            return Promise.resolve(cache.meta.v || {});
        }
        return getVersionMap_().then(function (vm) {
            if (!vm) return cache.meta ? (cache.meta.v || {}) : {};
            if (cache.meta && cache.meta.v) {
                var cur = cache.meta.v;
                for (var node in cache.nodes) {
                    if (!Object.prototype.hasOwnProperty.call(cache.nodes, node)) continue;
                    var newV = vm[node], oldV = cur[node];
                    if (newV != null && oldV != null && String(newV) !== String(oldV)) {
                        delete cache.nodes[node];
                    }
                }
            }
            cache.meta = { v: vm, t: now };
            lsSet_(LS_META, cache.meta);
            lsSet_(LS_CACHE, cache.nodes);
            return vm;
        });
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

    // Faz a leitura de rede de verdade e, se for nó cacheável, guarda no cache.
    // Busca a versão em paralelo na 1ª leitura, para o cache já nascer com a
    // versão correta (evita re-busca na próxima visita).
    function fetchNode_(base, params, path, node) {
        if (path) params.path = path;
        delete params.nc; // flag interna de "não cachear" não vai ao servidor
        var qs = buildQuery_(params);
        // Só busca a versão quando vamos guardar no cache (nó do cérebro).
        var versionPromise = (node && cache.meta && cache.meta.v)
            ? Promise.resolve(cache.meta.v)
            : (node ? getVersionMap_() : Promise.resolve(null));
        return Promise.all([realFetch(base + (qs ? '?' + qs : ''), {}), versionPromise])
            .then(function (rs) {
                var res = rs[0], vm = rs[1];
                if (vm && !(cache.meta && cache.meta.v)) {
                    cache.meta = { v: vm, t: Date.now() };
                    lsSet_(LS_META, cache.meta);
                }
                try {
                    res.clone().json().then(function (data) {
                        if (data && data.error === 'Rota inválida') {
                            console.error(
                                '[PortalDB] A implantação do Apps Script ainda é a versão antiga.\n' +
                                'Cole apps-script/Code.gs e faça Implantar → Gerenciar implantações → Nova versão.\n' +
                                'Teste: abra a URL /exec — tem que vir { ok:true, ... }, não "Rota inválida".\n' +
                                'Passo a passo: apps-script/COMO_IMPLANTAR.md'
                            );
                        }
                        if (node) {
                            cache.nodes[node] = {
                                v: cache.meta && cache.meta.v ? cache.meta.v[node] : undefined,
                                data: data
                            };
                            lsSet_(LS_CACHE, cache.nodes);
                        }
                    }).catch(function () {});
                } catch (e) {}
                return res;
            });
    }

    // Serve do cache se a versão estiver ok; senão busca na rede.
    function serveOrFetch_(node, base, params, path) {
        if (cache.nodes[node] && cache.nodes[node].data !== undefined) {
            return ensureVersion_().then(function (vm) {
                var cached = cache.nodes[node];
                if (cached && String(cached.v) === String(vm[node] || '')) {
                    return makeCachedResponse_(cached.data);
                }
                delete cache.nodes[node];
                return fetchNode_(base, params, path, node);
            });
        }
        return fetchNode_(base, params, path, node);
    }

    /* Limpa todo o cache (útil após trocar a URL da planilha). */
    PortalDB.clearCache = function () {
        cache.nodes = {};
        cache.meta = null;
        lsSet_(LS_CACHE, {});
        try { global.localStorage.removeItem(LS_META); } catch (e) {}
    };

    /* Força a próxima checagem de versão (descarta a janela de TTL). */
    PortalDB.bumpVersionCheck = function () { cache.meta = null; };

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

    /* Extrai o pedaço depois de /exec e devolve { path, query }.
       Aceita os dois jeitos que o portal já monta:
         .../exec/menu_global.json?_=1
         .../execmenu_global.json?_=1   (URL antiga, sem barra) */
    function splitExecUrl_(url, base) {
        var rest = url.slice(base.length);
        var qPos = rest.indexOf('?');
        var pathPart = (qPos >= 0 ? rest.slice(0, qPos) : rest).replace(/^\/+/, '');
        var queryPart = qPos >= 0 ? rest.slice(qPos + 1) : '';
        var params = parseQuery_(queryPart);
        if (!pathPart && params.path) pathPart = String(params.path).replace(/^\/+/, '');
        return { path: pathPart, params: params };
    }

    /* ========================================================================
       Tradutor de métodos.
       O Apps Script só expõe GET (doGet) e POST (doPost). Então:
         GET  → GET  /exec?path=users/abc.json&orderBy=...
         PUT/PATCH/DELETE/POST → POST /exec com envelope { __method, __path, __body }
       text/plain no POST evita preflight CORS.
       ======================================================================== */
    if (global.fetch) {
        var realFetch = global.fetch.bind(global);

        global.fetch = function (input, init) {
            init = init || {};
            var method = (init.method || 'GET').toUpperCase();
            var url = (typeof input === 'string') ? input : (input && input.url);
            var base = execBase();

            if (!url || !base || url.indexOf(base) !== 0) {
                return realFetch(input, init);
            }

            var split = splitExecUrl_(url, base);
            var path = split.path || '';
            var params = split.params || {};

            if (method === 'GET') {
                var node = String(path).replace(/\.json$/, '').split('/')[0];
                var isCacheable = CACHE_NODES.indexOf(node) !== -1 && !params.nc;
                if (isCacheable) {
                    return serveOrFetch_(node, base, params, path);
                }
                return fetchNode_(base, params, path, isCacheable ? node : null);
            }

            var parsed = null;
            if (init.body) {
                try { parsed = JSON.parse(init.body); } catch (e) { parsed = init.body; }
            }

            // Já veio envelopado (não envelopa de novo)
            if (parsed && typeof parsed === 'object' && parsed.__method) {
                return realFetch(base, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(parsed)
                });
            }

            var payload = {
                __method: method,
                __path: path,
                __body: parsed
            };
            return realFetch(base, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });
        };
    }

    global.PortalDB = PortalDB;
})(window);
