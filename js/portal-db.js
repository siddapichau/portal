/* ============================================================================
   portal-db.js — Camada única de acesso a dados do Portal ("cérebro")
   ----------------------------------------------------------------------------
   O portal é 100% PLANILHA (Google Sheets via Apps Script).
   Não existe mais nenhuma conexão com Firebase aqui — a única referência ao
   Firebase no projeto fica no Apps Script, só para a importação dos dados.

   COMO ATIVAR:
     1) Publique o Apps Script da planilha (Implantar → Aplicativo da web).
     2) Cole aqui a URL `/exec` gerada. Pronto: todas as páginas usam a
        planilha automaticamente (contrato idêntico ao que o portal já usava).

   POR QUE OS DADOS NÃO CARREGAVAM (corrigido nesta versão):
     - As páginas montam `${base}menu_global.json` (contrato Firebase).
     - Sem a barra final, isso virava `.../execmenu_global.json` (URL inválida).
     - COM a barra, `.../exec/menu_global.json` cai no login do Google
       (limitação do Apps Script: pathInfo em web app "Qualquer pessoa"
       não é público).
     - Solução: este arquivo reescreve GET para
       `.../exec?path=menu_global.json` (query string, pública) e o
       Code.gs lê `e.parameter.path`.

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
        URL: 'https://script.google.com/macros/s/AKfycbw3vDT2-dwTBnXP0NDZztLA8YzIxbb7i6TAZLvg7t5Q1j646XEl6BKeCkUdAdqLjhbDJw/exec'
    };

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
                if (path) params.path = path;
                var qs = buildQuery_(params);
                return realFetch(base + (qs ? '?' + qs : ''), init).then(function (res) {
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
                        }).catch(function () {});
                    } catch (e) {}
                    return res;
                });
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
