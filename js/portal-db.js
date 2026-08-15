/* ============================================================================
   portal-db.js — Camada única de acesso a dados do Portal ("cérebro")
   ----------------------------------------------------------------------------
   Substitui o acesso direto ao Firebase por UM ponto de configuração.
   O portal pode usar:
     • Google Sheets (via Apps Script)  -> PortalDB.URL configurada
     • Firebase Realtime Database       -> fallback automático

   COMO USAR:
     1) Cole aqui a URL `/exec` do seu Apps Script (Implantar -> Web app).
     2) Todas as páginas que hoje usam `const FIREBASE_URL = "..."` passam a
        usar `PortalDB.baseAtiva()` (veja menu.js / index.html / admin.html).

   O que este arquivo faz:
     - Expõe PortalDB.URL / PortalDB.FIREBASE_FALLBACK / PortalDB.baseAtiva()
     - Traduz PUT/PATCH/DELETE (não suportados nativamente pelo Apps Script)
       para POST, mantendo o mesmo contrato do Firebase (troca transparente).
   ============================================================================ */

(function (global) {
    'use strict';

    if (global.PortalDB) return; // idempotente

    var PortalDB = {
        // ====== CONFIGURAÇÃO =================================================
        // 👇 COLE AQUI a URL /exec do seu Apps Script (terminando em "/")
        URL: 'https://script.google.com/macros/s/COLE_SUA_URL_DEPLOY/exec/',

        // Fallback enquanto a planilha não estiver configurada
        FIREBASE_FALLBACK: 'https://reportes-bdb0a-default-rtdb.firebaseio.com/',

        // 'sheets' usa a planilha; 'firebase' força o Firebase
        MODE: 'sheets'
    };

    /* True se a URL da planilha está configurada (não é placeholder). */
    PortalDB.urlConfigurada = function () {
        return !!/exec/i.test(PortalDB.URL) && !/COLE_SUA_URL/i.test(PortalDB.URL);
    };

    /* Base ativa: retorna a URL (com "/" final) que deve ser usada. */
    PortalDB.baseAtiva = function () {
        if (PortalDB.MODE === 'sheets' && PortalDB.urlConfigurada()) return PortalDB.URL;
        return PortalDB.FIREBASE_FALLBACK;
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
            if (!url || !PortalDB.urlConfigurada() || url.indexOf(PortalDB.URL) !== 0) {
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
