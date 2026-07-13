// menu.js - Controle Global do Menu Lateral e Cabeçalho

const menuGlobalHTML = `
    <!-- BARRA SUPERIOR AMARELA -->
    <div class="top-bar-wrapper">
        <div class="top-nav">
            <div class="nav-left">
                <button class="hamburger-btn" onclick="toggleMenu()" id="btn-hamb">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#2D3277" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                </button>
                <img src="https://upload.wikimedia.org/wikipedia/pt/0/04/Logotipo_MercadoLivre.png" alt="Mercado Livre" class="ml-logo" onclick="window.location.href='index.html'">
            </div>
            <div class="nav-right">
                <button class="theme-toggle" id="themeToggle" onclick="toggleTheme()" title="Alternar Modo Claro/Escuro">
                    <span id="themeIcon">🌙</span>
                </button>
            </div>
        </div>
    </div>

    <!-- MENU LATERAL (SIDEBAR) -->
    <div id="global-sidebar" class="sidebar">
        <!-- Abas do Menu -->
        <div class="sidebar-tabs">
            <div class="tab active">Todos</div>
            <div class="tab inactive">☆ Favoritos</div>
        </div>

        <!-- Lista de Links -->
        <div class="sidebar-links">
            
            <a href="insumos.html" class="side-btn">
                <div class="side-icon">📦</div>
                <div class="side-text">
                    <span class="side-title">Insumos Operacionais</span>
                    <span class="side-desc">Gestão de materiais e suprimentos.</span>
                </div>
                <div class="side-arrow">›</div>
            </a>

            <a href="contagem_insumos.html" class="side-btn">
                <div class="side-icon">📋</div>
                <div class="side-text">
                    <span class="side-title">Controle Insumos</span>
                    <span class="side-desc">Painel de contagem e estoque físico.</span>
                </div>
                <div class="side-arrow">›</div>
            </a>

            <a href="equipamentos.html" class="side-btn">
                <div class="side-icon">💻</div>
                <div class="side-text">
                    <span class="side-title">Equipamentos</span>
                    <span class="side-desc">Inventário e controle de ativos físicos.</span>
                </div>
                <div class="side-arrow">›</div>
            </a>

            <a href="aging-devolucao.html" class="side-btn">
                <div class="side-icon">⏳</div>
                <div class="side-text">
                    <span class="side-title">Aging Devolução</span>
                    <span class="side-desc">Controle de tempo e status retornados.</span>
                </div>
                <div class="side-arrow">›</div>
            </a>

            <a href="parado_percurso.html" class="side-btn">
                <div class="side-icon">🛑</div>
                <div class="side-text">
                    <span class="side-title">Parado no Percurso</span>
                    <span class="side-desc">Cruzamento e aging de pacotes estancados.</span>
                </div>
                <div class="side-arrow">›</div>
            </a>

            <a href="aderencia.html" class="side-btn">
                <div class="side-icon">📊</div>
                <div class="side-text">
                    <span class="side-title">Aderência Tabela</span>
                    <span class="side-desc">Análise quantitativa consolidada.</span>
                </div>
                <div class="side-arrow">›</div>
            </a>

            <a href="aderencia2.html" class="side-btn">
                <div class="side-icon">🎯</div>
                <div class="side-text">
                    <span class="side-title">Aderência Ofensores</span>
                    <span class="side-desc">Análise de motivos de pendências.</span>
                </div>
                <div class="side-arrow">›</div>
            </a>

            <a href="avarias-diario.html" class="side-btn">
                <div class="side-icon">⚠️</div>
                <div class="side-text">
                    <span class="side-title">Avaria Diário</span>
                    <span class="side-desc">Acompanhamento diário de avarias.</span>
                </div>
                <div class="side-arrow">›</div>
            </a>

            <a href="poka-avaria.html" class="side-btn">
                <div class="side-icon">📆</div>
                <div class="side-text">
                    <span class="side-title">Avarias Mensal</span>
                    <span class="side-desc">Visão macro e histórico consolidado.</span>
                </div>
                <div class="side-arrow">›</div>
            </a>

            <a href="pendencias_cftv.html" class="side-btn">
                <div class="side-icon">🛡️</div>
                <div class="side-text">
                    <span class="side-title">Pendências CFTV</span>
                    <span class="side-desc">Resoluções do time de segurança.</span>
                </div>
                <div class="side-arrow">›</div>
            </a>

            <a href="salvados_procurar.html" class="side-btn">
                <div class="side-icon">🔍</div>
                <div class="side-text">
                    <span class="side-title">Busca Global (Sauron)</span>
                    <span class="side-desc">Busca inteligente em bancos de salvados.</span>
                </div>
                <div class="side-arrow">›</div>
            </a>

            <a href="salvados_recuperados.html" class="side-btn">
                <div class="side-icon">💰</div>
                <div class="side-text">
                    <span class="side-title">Salvados Recuperados</span>
                    <span class="side-desc">Valores financeiros recuperados.</span>
                </div>
                <div class="side-arrow">›</div>
            </a>

            <a href="expedir_devolucao.html" class="side-btn">
                <div class="side-icon">🚛</div>
                <div class="side-text">
                    <span class="side-title">Expedir Devolução</span>
                    <span class="side-desc">Expedição de pacotes devolvidos.</span>
                </div>
                <div class="side-arrow">›</div>
            </a>

            <a href="pendentes_inventariov2.html" class="side-btn">
                <div class="side-icon">✅</div>
                <div class="side-text">
                    <span class="side-title">Pendentes Inventário</span>
                    <span class="side-desc">Consulta de pendências físicas.</span>
                </div>
                <div class="side-arrow">›</div>
            </a>

        </div>
    </div>
`;

// Injeta o menu assim que a página carregar
document.addEventListener("DOMContentLoaded", () => {
    document.body.insertAdjacentHTML('afterbegin', menuGlobalHTML);
});

// Lógica de Abrir/Fechar o Menu Lateral
function toggleMenu() {
    const sidebar = document.getElementById('global-sidebar');
    const mainContent = document.getElementById('main-content');
    const btnIcon = document.getElementById('btn-hamb');
    
    sidebar.classList.toggle('open');
    mainContent.classList.toggle('shifted');

    // Troca o ícone de Hambúrguer para "X"
    if (sidebar.classList.contains('open')) {
        btnIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#2D3277" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    } else {
        btnIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#2D3277" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;
    }
}
