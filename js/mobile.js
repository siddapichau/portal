/* =========================================================================
   mobile.js — Ajustes de celular que não dá para fazer só com CSS
   -------------------------------------------------------------------------
   Módulo ADITIVO e defensivo: se algo aqui falhar, a página continua
   funcionando normalmente (todo o corpo roda dentro de try/catch).

   O que faz:
     1) Envolve tabelas largas num contêiner que rola horizontalmente,
        para a tabela não empurrar a página inteira para o lado.
        - só em telas <= 768px
        - nunca envolve duas vezes
        - não mexe em tabela que já esteja num contêiner rolável
     2) Reaplica o passo 1 quando a página injeta tabelas novas via JS
        (MutationObserver com debounce).
   ========================================================================= */
(function (global) {
    'use strict';

    if (global.__portalMobileReady) return; // idempotente
    global.__portalMobileReady = true;

    var LARGURA_MOBILE = 768;
    var CLASSE = 'tabela-scroll-mobile';

    function ehMobile() {
        return global.innerWidth <= LARGURA_MOBILE;
    }

    /* Já existe um ancestral que rola na horizontal? Então não precisa wrapper. */
    function jaTemScrollHorizontal(tabela) {
        var pai = tabela.parentElement;
        var niveis = 0;
        while (pai && pai !== document.body && niveis < 3) {
            if (pai.classList && pai.classList.contains(CLASSE)) return true;
            var estilo;
            try { estilo = global.getComputedStyle(pai); } catch (e) { return false; }
            if (estilo) {
                var ox = estilo.overflowX;
                if (ox === 'auto' || ox === 'scroll') return true;
            }
            pai = pai.parentElement;
            niveis++;
        }
        return false;
    }

    function envolverTabelas() {
        if (!ehMobile()) return;
        var tabelas = document.querySelectorAll('table');
        for (var i = 0; i < tabelas.length; i++) {
            var t = tabelas[i];
            try {
                if (t.dataset && t.dataset.mobileWrapped === '1') continue;
                if (jaTemScrollHorizontal(t)) {
                    if (t.dataset) t.dataset.mobileWrapped = '1';
                    continue;
                }
                var wrapper = document.createElement('div');
                wrapper.className = CLASSE;
                t.parentNode.insertBefore(wrapper, t);
                wrapper.appendChild(t);
                if (t.dataset) t.dataset.mobileWrapped = '1';
            } catch (e) { /* ignora esta tabela e segue */ }
        }
    }

    var agendado = null;
    function agendarEnvolver() {
        if (agendado) clearTimeout(agendado);
        agendado = setTimeout(function () {
            agendado = null;
            try { envolverTabelas(); } catch (e) { }
        }, 250);
    }

    function iniciar() {
        try { envolverTabelas(); } catch (e) { }

        // Tabelas criadas depois (render assíncrono do banco de dados, filtros, etc.)
        try {
            if (global.MutationObserver && document.body) {
                var obs = new MutationObserver(function (mutacoes) {
                    for (var i = 0; i < mutacoes.length; i++) {
                        if (mutacoes[i].addedNodes && mutacoes[i].addedNodes.length) {
                            agendarEnvolver();
                            return;
                        }
                    }
                });
                obs.observe(document.body, { childList: true, subtree: true });
            }
        } catch (e) { }

        // Girou o aparelho / redimensionou
        try {
            global.addEventListener('resize', agendarEnvolver, { passive: true });
            global.addEventListener('orientationchange', agendarEnvolver, { passive: true });
        } catch (e) { }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }
})(window);
