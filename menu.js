// menu.js - Controle Global do Menu Lateral e Cabeçalho (Dinâmico via Firebase)

// CSS Dinâmico Injetado para os Menus com Subcategorias
const menuStyle = `
<style>
    /* Oculta os submenus por padrão */
    .submenu {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.4s ease-in-out;
        background-color: #1f1f1f;
    }
    
    /* Ao passar o mouse na categoria, abre o submenu */
    .menu-category:hover .submenu {
        max-height: 1000px; /* Expande o submenu */
    }

    .category-header {
        display: flex;
        align-items: center;
        padding: 15px 20px;
        color: #EBEBEB;
        font-weight: 800;
        font-size: 0.95rem;
        cursor: pointer;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        transition: background 0.3s;
    }
    
    .menu-category:hover .category-header {
        background-color: #333;
        border-left: 4px solid #FFF159;
    }

    .cat-icon { font-size: 1.4rem; margin-right: 15px; width: 30px; text-align: center; }
    .cat-title { flex: 1; }
    .cat-arrow { font-size: 0.8rem; color: #777; transition: transform 0.3s; }
    
    .menu-category:hover .cat-arrow {
        transform: rotate(180deg);
        color: #FFF159;
    }

    /* Ajuste visual para os itens dentro do submenu */
    .submenu .side-btn {
        padding-left: 65px; /* Empurra um pouco pra direita */
        border-bottom: 1px solid rgba(255,255,255,0.02);
    }
    .submenu .side-btn:hover { background-color: #2b2b2b; }
</style>
`;

async function carregarMenuGlobal() {
    // 1. Estrutura base do HTML (Barra Superior e Shell da Sidebar)
    const baseHTML = `
        ${menuStyle}
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
            <div class="sidebar-tabs">
                <div class="tab active">Todos</div>
                <div class="tab inactive">☆ Favoritos</div>
            </div>
            
            <div class="sidebar-links" id="sidebar-links-container">
                <div style="padding: 20px; text-align: center; color: #888; font-weight: bold; font-size: 0.9rem;">
                    Buscando menus...
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('afterbegin', baseHTML);

    // 2. Busca os dados no Firebase (A URL vem do firebase.config.js)
    try {
        const response = await fetch(`${FIREBASE_URL}menu_global.json`);
        const data = await response.json();
        renderizarMenus(data);
    } catch (error) {
        console.error("Erro ao carregar o menu do Firebase:", error);
        document.getElementById('sidebar-links-container').innerHTML = 
            `<div style="padding: 20px; text-align: center; color: #FF5252;">Falha ao carregar o menu.<br>Verifique sua conexão.</div>`;
    }
}

function renderizarMenus(data) {
    const container = document.getElementById('sidebar-links-container');
    
    if (!data || !data.categorias || data.categorias.length === 0) {
        container.innerHTML = `<div style="padding: 20px; text-align: center; color: #aaa;">Nenhum menu cadastrado.<br>Acesse <b>admin.html</b> para criar.</div>`;
        return;
    }

    let html = '';
    
    data.categorias.forEach(cat => {
        let subItemsHtml = '';
        
        // Se houver submenus (links)
        if (cat.items && cat.items.length > 0) {
            cat.items.forEach(item => {
                subItemsHtml += `
                    <a href="${item.url}" class="side-btn">
                        <div class="side-icon">${item.icon || '🔗'}</div>
                        <div class="side-text">
                            <span class="side-title">${item.title}</span>
                            <span class="side-desc">${item.desc}</span>
                        </div>
                        <div class="side-arrow">›</div>
                    </a>
                `;
            });
        }

        // Renderiza a Categoria (Pai) e o Submenu (Filhos)
        html += `
            <div class="menu-category">
                <div class="category-header">
                    <span class="cat-icon">${cat.icon || '📂'}</span>
                    <span class="cat-title">${cat.title}</span>
                    <span class="cat-arrow">▼</span>
                </div>
                <div class="submenu">
                    ${subItemsHtml}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Inicializa a injeção do menu
document.addEventListener("DOMContentLoaded", () => {
    carregarMenuGlobal();
});

// Animação de Abrir/Fechar a Sidebar
function toggleMenu() {
    const sidebar = document.getElementById('global-sidebar');
    const mainContent = document.getElementById('main-content');
    const btnIcon = document.getElementById('btn-hamb');
    
    sidebar.classList.toggle('open');
    if (mainContent) mainContent.classList.toggle('shifted');

    if (sidebar.classList.contains('open')) {
        btnIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#2D3277" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    } else {
        btnIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#2D3277" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;
    }
}
