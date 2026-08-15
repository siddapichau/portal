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

   O que este arquivo faz:
     - Expõe PortalDB.URL / PortalDB.urlConfigurada() / PortalDB.baseAtiva()
     - Traduz PUT/PATCH/DELETE (não suportados nativamente pelo Apps Script)
       para POST, mantendo o mesmo contrato REST (troca transparente).
   ============================================================================ */

(function (global) {
    'use strict';

    if (global.PortalDB) return; // idempotente

    var PortalDB = {
        // ====== CONFIGURAÇÃO =================================================
        // 👇 COLE AQUI a URL /exec do seu Apps Script (terminando em "/exec/")
        URL: 'https://script.google.com/macros/s/COLE_SUA_URL_DEPLOY/exec/'
    };

    /* True se a URL da planilha está configurada (não é placeholder). */
    PortalDB.urlConfigurada = function () {
        return !!/exec/i.test(PortalDB.URL) && !/COLE_SUA_URL/i.test(PortalDB.URL);
    };

    /* Base ativa: SEMPRE a planilha. Avisa no console se ainda não configurada. */
    PortalDB.baseAtiva = function () {
        if (!PortalDB.urlConfigurada()) {
            console.error(
                '[PortalDB] ⚠️ URL da planilha NÃO configurada.\n' +
                '1) Publique o Apps Script (Implantar → Aplicativo da web).\n' +
                '2) Cole a URL /exec em js/portal-db.js → PortalDB.URL.\n' +
                'Sem isso o portal não carrega dados.'
            );
        }
        return PortalDB.URL;
    };

    /* ========================================================================
       Tradutor de métodos.
       O Apps Script só expõe GET (doGet) e POST (doPost). Então transformamos
       PUT/PATCH/DELETE (e POST com JSON) em POST com um envelope que o backend
       entende: { __method, __path, __body }.
       GET continua GET (requisição simples, sem CORS preflight).
       ======================================================================== */
    if (global.fetch) {
        var realFetch = global.fetch.bind(global);

        global.fetch = function (input, init) {
            init = init || {};
            var method = (init.method || 'GET').toUpperCase();
            var url = (typeof input === 'string') ? input : (input && input.url);

            // Só interceptamos chamadas destinadas à planilha (Apps Script)
            if (!url || url.indexOf(PortalDB.URL) !== 0) {
                return realFetch(input, init);
            }
            if (method === 'GET') {
                return realFetch(input, init);
            }

            // Escrita -> POST com envelope (text/plain evita preflight)
            var path = url.slice(PortalDB.URL.length); // ex.: "users/abc.json"
            var parsed = null;
            if (init.body) {
                try { parsed = JSON.parse(init.body); } catch (e) { parsed = init.body; }
            }
            var payload = { __method: method, __path: path, __body: parsed };
            return realFetch(PortalDB.URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });
        };
    }

    global.PortalDB = PortalDB;
})(window);
