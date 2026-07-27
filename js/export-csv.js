/* =========================================================================
   export-csv.js  —  Exportação de CSV padronizada para todo o Portal
   -------------------------------------------------------------------------
   Módulo ADITIVO: não altera nenhum comportamento existente. Só expõe
   utilitários globais que as páginas de reporte chamam para baixar CSV.

   Padrão adotado (igual ao que já existia em equipamentos.html):
     - separador ";"      -> Excel pt-BR abre em colunas sem pedir importação
     - BOM "\uFEFF"       -> acentuação correta no Excel
     - todo campo entre aspas, com "" para escapar aspas internas
     - CRLF nas quebras   -> compatível com Excel antigo

   API:
     PortalCSV.baixar(nomeArquivo, colunas, linhas)
     PortalCSV.deObjetos(nomeArquivo, arrayDeObjetos, colunasOpcionais)
     PortalCSV.deTabela(nomeArquivo, seletorOuElementoTabela)
     PortalCSV.nomeComData(prefixo)
   ========================================================================= */
(function (global) {
    'use strict';

    if (global.PortalCSV) return; // idempotente: não redefine se já carregado

    var SEP = ';';
    var BOM = '\uFEFF';

    /* Converte qualquer valor em texto seguro para uma célula CSV. */
    function celula(valor) {
        if (valor === null || valor === undefined) return '""';
        var texto;
        if (valor instanceof Date) {
            texto = valor.toLocaleString('pt-BR');
        } else if (typeof valor === 'object') {
            try { texto = JSON.stringify(valor); } catch (e) { texto = String(valor); }
        } else {
            texto = String(valor);
        }
        // Normaliza quebras internas para não estourar a linha do CSV
        texto = texto.replace(/\r\n|\r|\n/g, ' ').replace(/\s+/g, ' ').trim();
        // Escapa aspas duplicando-as (padrão RFC 4180)
        texto = texto.replace(/"/g, '""');
        return '"' + texto + '"';
    }

    /* Remove tags HTML de um texto (útil ao exportar conteúdo renderizado). */
    function semHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
    }

    /* Dispara o download de um texto como arquivo .csv */
    function salvarArquivo(nomeArquivo, conteudo) {
        var nome = String(nomeArquivo || 'export').replace(/[\\/:*?"<>|]+/g, '-');
        if (!/\.csv$/i.test(nome)) nome += '.csv';

        var blob = new Blob([BOM + conteudo], { type: 'text/csv;charset=utf-8;' });

        // IE / Edge legado
        if (global.navigator && global.navigator.msSaveBlob) {
            global.navigator.msSaveBlob(blob, nome);
            return true;
        }

        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = nome;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        // Some navegadores precisam de um tick antes de revogar a URL
        setTimeout(function () {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 150);
        return true;
    }

    /* Sufixo de data/hora para o nome do arquivo: 27-07-2026_14h32 */
    function nomeComData(prefixo) {
        var d = new Date();
        var p = function (n) { return String(n).padStart(2, '0'); };
        return (prefixo || 'reporte') + '_' + p(d.getDate()) + '-' + p(d.getMonth() + 1) +
            '-' + d.getFullYear() + '_' + p(d.getHours()) + 'h' + p(d.getMinutes());
    }

    /* Aviso padronizado quando não há nada para exportar. */
    function avisarVazio() {
        try {
            if (typeof global.mostrarToast === 'function') {
                global.mostrarToast('Nenhum dado disponível para exportar.');
                return;
            }
        } catch (e) { /* segue para o alert */ }
        alert('Nenhum dado disponível para exportar.');
    }

    /* ---------------------------------------------------------------
       baixar(nome, colunas, linhas)
       colunas: ['Área','Total']   linhas: [['Sorting', 10], ...]
       --------------------------------------------------------------- */
    function baixar(nomeArquivo, colunas, linhas) {
        if (!linhas || !linhas.length) { avisarVazio(); return false; }
        var out = [];
        if (colunas && colunas.length) out.push(colunas.map(celula).join(SEP));
        for (var i = 0; i < linhas.length; i++) {
            var linha = linhas[i];
            if (!Array.isArray(linha)) linha = [linha];
            out.push(linha.map(celula).join(SEP));
        }
        return salvarArquivo(nomeArquivo, out.join('\r\n'));
    }

    /* ---------------------------------------------------------------
       deObjetos(nome, [{a:1,b:2}, ...], ['a','b'])
       Sem a lista de colunas, usa a união das chaves de todos os itens.
       --------------------------------------------------------------- */
    function deObjetos(nomeArquivo, itens, colunas) {
        if (!itens || !itens.length) { avisarVazio(); return false; }

        var cols = colunas && colunas.length ? colunas.slice() : [];
        if (!cols.length) {
            var vistos = {};
            for (var i = 0; i < itens.length; i++) {
                var obj = itens[i];
                if (!obj || typeof obj !== 'object') continue;
                for (var k in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, k) && !vistos[k]) {
                        vistos[k] = true;
                        cols.push(k);
                    }
                }
            }
        }
        if (!cols.length) { avisarVazio(); return false; }

        var linhas = itens.map(function (obj) {
            return cols.map(function (c) {
                return obj ? obj[c] : '';
            });
        });
        return baixar(nomeArquivo, cols, linhas);
    }

    /* ---------------------------------------------------------------
       deTabela(nome, '#minha-tabela')
       Lê o <table> já renderizado. Respeita colspan e ignora linhas
       de placeholder ("Aguardando dados...", "Nenhum item...").
       --------------------------------------------------------------- */
    function deTabela(nomeArquivo, tabela) {
        var el = typeof tabela === 'string' ? document.querySelector(tabela) : tabela;
        if (!el) { avisarVazio(); return false; }

        var colunas = [];
        var cabecalhos = el.querySelectorAll('thead tr:last-child th, thead tr:last-child td');
        for (var h = 0; h < cabecalhos.length; h++) {
            colunas.push(semHtml(cabecalhos[h].textContent));
        }

        var linhas = [];
        var trs = el.querySelectorAll('tbody tr');
        for (var r = 0; r < trs.length; r++) {
            var tds = trs[r].querySelectorAll('td, th');
            if (!tds.length) continue;
            // Pula linhas-placeholder que ocupam a tabela inteira
            if (tds.length === 1 && colunas.length > 1) continue;
            var linha = [];
            for (var c = 0; c < tds.length; c++) linha.push(semHtml(tds[c].textContent));
            if (linha.join('').trim() === '') continue;
            linhas.push(linha);
        }
        if (!linhas.length) { avisarVazio(); return false; }
        return baixar(nomeArquivo, colunas, linhas);
    }

    global.PortalCSV = {
        baixar: baixar,
        deObjetos: deObjetos,
        deTabela: deTabela,
        nomeComData: nomeComData,
        celula: celula,
        semHtml: semHtml,
        salvarArquivo: salvarArquivo
    };
})(window);
