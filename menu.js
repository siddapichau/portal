// menu.js - Menu Lateral, Cabeçalho e Lógica de Favoritos

const ICONS_LIST = ["📦","📋","💻","⏳","🚛","🛑","📊","🎯","✅","⚠️","📆","🛡️","🔍","💰","⚙️","🔧","🔨","🛠️","🏭","📈","📉","📅","🗓️","📁","📂","🗂️","🗃️","📄","📑","🧾","🛒","🛍️","🏷️","🎫","🔑","🔐","🔓","🔒","🔔","🔕","📢","📣","💬","💭","🗯️","🚚","🚜","🚨","🚧","🚥","🚦","⛽","⚓","✈️","🚀","🚁","🛰️"];

const DEFAULT_MENU = [
  {
    "category": "Insumos e Estoque",
    "items": [
      {"title": "Insumos Oper.", "desc": "Gestão de materiais", "url": "insumos.html", "icon": "📦"},
      {"title": "Controle Insumos", "desc": "Estoque físico", "url": "contagem_insumos.html", "icon": "📋"}
    ]
  },
  {
    "category": "Equipamentos e Ativos",
    "items": [
      {"title": "Equipamentos", "desc": "Inventário de ativos", "url": "equipamentos.html", "icon": "💻"}
    ]
  },
  {
    "category": "Logística e Devolução",
    "items": [
      {"title": "Aging Devolução", "desc": "Tempo e status", "url": "aging-devolucao.html", "icon": "⏳"},
      {"title": "Expedir Devolução", "desc": "Expedição pacotes", "url": "expedir_devolucao.html", "icon": "🚛"},
      {"title": "Parado Percurso", "desc": "Pacotes estancados", "url": "parado_percurso.html", "icon": "🛑"}
    ]
  },
  {
    "category": "Inventário e Aderência",
    "items": [
      {"title": "Aderência Tabela", "desc": "Dados consolidados", "url": "aderencia.html", "icon": "📊"},
      {"title": "Aderência Ofensores", "desc": "Motivos pendências", "url": "aderencia2.html", "icon": "🎯"},
      {"title": "Pendentes Inv.", "desc": "Consulta pendências", "url": "pendentes_inventariov2.html", "icon": "✅"}
    ]
  },
  {
    "category": "Avarias e Segurança",
    "items": [
      {"title": "Avaria Diário", "desc": "Análise diária", "url": "avarias-diario.html", "icon": "⚠️"},
      {"title": "Avarias Mensal", "desc": "Visão macro Poka", "url": "poka-avaria.html", "icon": "📆"},
      {"title": "Pendências CFTV", "desc": "Segurança", "url": "pendencias_cftv.html", "icon": "🛡️"}
    ]
  },
  {
    "category": "Busca e Salvados",
    "items": [
      {"title": "Busca Global", "desc": "Sauron cross-bancos", "url": "salvados_procurar.html", "icon": "🔍"},
      {"title": "Salvos Recuperados", "desc": "Valores financeiros", "url": "salvados_recuperados.html", "icon": "💰"}
    ]
  }
];

let globalMenuData = [];
let activeTab = 'todos'; // 'todos' ou 'favoritos'

// CSS INJETADO PARA O MENU FLYOUT E BOTÕES MINIMALISTAS
const menuStyles = `
<style>
    /* Botoes Minimalistas do Topo (Estilo Imagem 3) */
    .btn-minimalist {
        background-color: rgba(255, 255, 255, 0.7) !important;
        border: 1px solid rgba(0, 0, 0, 0.08) !important;
        border-radius: 8px !important;
        width: 38px; height: 38px;
        display: inline-flex; align-items: center; justify-content: center;
        color: #2D3277 !important;
        box-shadow: 0 2px 6px rgba(0,0,0,0.05);
        transition: all 0.2s ease;
        cursor: pointer;
    }
    .btn-minimalist:hover {
        background-color: rgba(255, 255, 255, 1) !important;
        transform: translateY(-2px);
        box-shadow: 0 4px 10px rgba(0,0,0,0.1);
    }
    .btn-minimalist svg { width: 18px; height: 18px; stroke: #2D3277; stroke-width: 2.2; fill: none; }

    /* Estrutura Sidebar Escura (Estilo Imagem 1) */
    .sidebar {
        position: fixed; top: 60px; left: -300px;
        width: 280px; height: calc(100vh - 60px);
        background-color: #2a2a2a; color: #ebebeb;
        box-shadow: 4px 0 15px rgba(0,0,0,0.2);
        transition: left 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.1);
        z-index: 1000; display: flex; flex-direction: column;
    }
    .sidebar.open { left: 0; }

    .sidebar-tabs { display: flex; padding: 15px; gap: 8px; background: #2a2a2a; }
    .tab {
        flex: 1; text-align: center; padding: 8px 0; border-radius: 20px;
        font-size: 0.85rem; font-weight: 800; cursor: pointer; transition: 0.2s;
    }
    .tab.active { background-color: #ffffff; color: #2a2a2a; }
    .tab.inactive { background-color: transparent; color: #aaaaaa; }
    .tab.inactive:hover { color: #ffffff; }

    .sidebar-content { flex: 1; overflow-y: auto; overflow-x: hidden; padding-bottom: 20px;}
    
    /* Categorias */
    .menu-cat {
        padding: 14px 20px; font-size: 0.9rem; font-weight: 800; color: #ebebeb;
        cursor: pointer; display: flex; justify-content: space-between; align-items: center;
        transition: background 0.2s;
    }
    .menu-cat:hover, .menu-cat.active { background-color: #3483FA; color: #ffffff; }
    
    /* Submenu Flyout (Painel Branco à direita) (Estilo Imagem 2) */
    .submenu-panel {
        position: fixed; top: 60px; left: 280px;
        width: 320px; height: calc(100vh - 60px);
        background-color: #ffffff; color: #333333;
        box-shadow: 4px 0 15px rgba(0,0,0,0.1);
        transform: translateX(-100%); opacity: 0; pointer-events: none;
        transition: all 0.3s ease; z-index: 999; overflow-y: auto;
        border-left: 1px solid #eee;
    }
    [data-theme="dark"] .submenu-panel { background-color: #1e1e1e; color: #ebebeb; border-left: 1px solid #333; }
    
    .sidebar.open.has-flyout ~ .submenu-panel { transform: translateX(0); opacity: 1; pointer-events: auto; }

    .sub-item {
        display: flex; align-items: center; padding: 12px 20px;
        text-decoration: none; color: inherit; border-bottom: 1px solid rgba(0,0,0,0.05);
        transition: background 0.2s; gap: 12px;
    }
    [data-theme="dark"] .sub-item { border-bottom: 1px solid rgba(255,255,255,0.05); }
    .sub-item:hover { background-color: rgba(52, 131, 250, 0.08); }
    
    .sub-icon { font-size: 1.2rem; }
    .sub-text { flex: 1; display: flex; flex-direction: column; }
    .sub-title { font-weight: 800; font-size: 0.85rem; }
    .sub-desc { font-size: 0.7rem; color: #888; margin-top: 2px; }
    
    .star-btn { font-size: 1.2rem; color: #ccc; cursor: pointer; transition: 0.2s; background: none; border: none; }
    .star-btn.fav { color: #FFF159; text-shadow: 0 0 2px rgba(0,0,0,0.3); }
    .star-btn:hover { transform: scale(1.2); }

    /* Admin Footer */
    .sidebar-footer { padding: 15px; border-top: 1px solid rgba(255,255,255,0.1); }
    .admin-link { display: flex; align-items: center; gap: 10px; color: #aaa; text-decoration: none; font-weight: bold; font-size: 0.85rem; transition: 0.2s; cursor: pointer;}
    .admin-link:hover { color: #FFF159; }

</style>
`;

async function carregarMenu() {
    const baseHTML = `
        ${menuStyles}
        <div class="top-bar-wrapper">
            <div class="top-nav">
                <div class="nav-left">
                    <button class="btn-minimalist" onclick="toggleSidebar()" id="btn-hamb" style="border:none!important; background:transparent!important; box-shadow:none!important;">
                        <svg viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                    </button>
                    <img src="https://upload.wikimedia.org/wikipedia/pt/0/04/Logotipo_MercadoLivre.png" alt="Mercado Livre" class="ml-logo" onclick="window.location.href='index.html'">
                </div>
                <div class="nav-right" style="display:flex; gap:10px;">
                    <button class="btn-minimalist" id="themeToggle" onclick="toggleThemeGlobal()" title="Modo Claro/Escuro">
                        <svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                    </button>
                </div>
            </div>
        </div>

        <div id="global-sidebar" class="sidebar" onmouseleave="fecharFlyout()">
            <div class="sidebar-tabs">
                <div class="tab active" id="tab-todos" onclick="switchTab('todos')">Todos</div>
                <div class="tab inactive" id="tab-favoritos" onclick="switchTab('favoritos')">☆ Favoritos</div>
            </div>
            
            <div id="sidebar-content" class="sidebar-content"></div>
            
            <div class="sidebar-footer">
                <div class="admin-link" onclick="acessarAdmin()">
                    <span>⚙️</span> Painel Admin
                </div>
            </div>
        </div>
        
        <div id="submenu-panel" class="submenu-panel" onmouseenter="manterFlyout()" onmouseleave="fecharFlyout()">
            <div id="submenu-list"></div>
        </div>
    `;

    document.body.insertAdjacentHTML('afterbegin', baseHTML);

    try {
        if(typeof FIREBASE_URL !== 'undefined') {
            const res = await fetch(`${FIREBASE_URL}menu_global.json`);
            const data = await res.json();
            globalMenuData = (data && data.categorias) ? data.categorias : DEFAULT_MENU;
        } else {
            globalMenuData = DEFAULT_MENU;
        }
    } catch (e) {
        globalMenuData = DEFAULT_MENU;
    }

    renderizarSidebar();
}

function getFavorites() {
    return JSON.parse(localStorage.getItem('ml_favorites') || '[]');
}

function toggleFavorite(url, event) {
    event.preventDefault();
    event.stopPropagation();
    let favs = getFavorites();
    if (favs.includes(url)) {
        favs = favs.filter(f => f !== url);
    } else {
        favs.push(url);
    }
    localStorage.setItem('ml_favorites', JSON.stringify(favs));
    
    // Atualiza a view instantaneamente
    if (activeTab === 'todos') {
        const btn = event.target;
        if(favs.includes(url)) { btn.classList.add('fav'); btn.innerHTML = '★'; }
        else { btn.classList.remove('fav'); btn.innerHTML = '☆'; }
    } else {
        renderizarSidebar(); // Recarrega se estiver na aba favoritos
    }
}

function renderizarSidebar() {
    const container = document.getElementById('sidebar-content');
    const favs = getFavorites();
    let html = '';

    if (activeTab === 'todos') {
        globalMenuData.forEach((cat, idx) => {
            html += `
                <div class="menu-cat" onmouseenter="abrirFlyout(${idx})">
                    ${cat.category} <span>›</span>
                </div>
            `;
        });
    } else {
        // Aba Favoritos - Lista plana de todos os itens favoritados
        let temFav = false;
        globalMenuData.forEach(cat => {
            cat.items.forEach(item => {
                if (favs.includes(item.url)) {
                    temFav = true;
                    html += `
                        <a href="${item.url}" class="sub-item" style="color: white; border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <div class="sub-icon">${item.icon}</div>
                            <div class="sub-text">
                                <span class="sub-title">${item.title}</span>
                                <span class="sub-desc" style="color:#aaa;">${item.desc}</span>
                            </div>
                            <button class="star-btn fav" onclick="toggleFavorite('${item.url}', event)">★</button>
                        </a>
                    `;
                }
            });
        });
        if(!temFav) html = `<div style="padding:20px; text-align:center; color:#888; font-size:0.85rem;">Nenhum favorito ainda.<br>Vá em 'Todos' e clique na estrela.</div>`;
    }

    container.innerHTML = html;
}

let flyoutTimeout;

function abrirFlyout(catIdx) {
    clearTimeout(flyoutTimeout);
    const cat = globalMenuData[catIdx];
    const container = document.getElementById('submenu-list');
    const favs = getFavorites();
    
    // Marca a categoria ativa visualmente
    document.querySelectorAll('.menu-cat').forEach((el, i) => {
        if(i === catIdx) el.classList.add('active'); else el.classList.remove('active');
    });

    let html = `<div style="padding: 15px 20px; font-weight: 900; font-size: 1.1rem; border-bottom: 1px solid rgba(0,0,0,0.1);">${cat.category}</div>`;
    
    if (cat.items && cat.items.length > 0) {
        cat.items.forEach(item => {
            const isFav = favs.includes(item.url);
            const starCls = isFav ? 'fav' : '';
            const starIco = isFav ? '★' : '☆';
            html += `
                <a href="${item.url}" class="sub-item">
                    <div class="sub-icon">${item.icon}</div>
                    <div class="sub-text">
                        <span class="sub-title">${item.title}</span>
                        <span class="sub-desc">${item.desc}</span>
                    </div>
                    <button class="star-btn ${starCls}" onclick="toggleFavorite('${item.url}', event)">${starIco}</button>
                </a>
            `;
        });
    } else {
        html += `<div style="padding:20px; color:#888; font-size:0.85rem;">Sem itens cadastrados.</div>`;
    }
    
    container.innerHTML = html;
    document.getElementById('global-sidebar').classList.add('has-flyout');
}

function manterFlyout() { clearTimeout(flyoutTimeout); }
function fecharFlyout() {
    flyoutTimeout = setTimeout(() => {
        document.getElementById('global-sidebar').classList.remove('has-flyout');
        document.querySelectorAll('.menu-cat').forEach(el => el.classList.remove('active'));
    }, 200);
}

function switchTab(tab) {
    activeTab = tab;
    document.getElementById('tab-todos').className = tab === 'todos' ? 'tab active' : 'tab inactive';
    document.getElementById('tab-favoritos').className = tab === 'favoritos' ? 'tab active' : 'tab inactive';
    document.getElementById('global-sidebar').classList.remove('has-flyout');
    renderizarSidebar();
}

function toggleSidebar() {
    const sidebar = document.getElementById('global-sidebar');
    const mainContent = document.getElementById('main-content');
    const btnIcon = document.getElementById('btn-hamb');
    
    sidebar.classList.toggle('open');
    if (mainContent) mainContent.classList.toggle('shifted');

    if (sidebar.classList.contains('open')) {
        btnIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#2D3277" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    } else {
        btnIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#2D3277" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;
        sidebar.classList.remove('has-flyout');
    }
}

function acessarAdmin() {
    const senha = prompt("Acesso Restrito ao Painel Admin.
Digite a senha temporária:");
    if (senha === "159159") {
        window.location.href = "admin.html";
    } else if (senha !== null) {
        alert("Senha incorreta!");
    }
}

function toggleThemeGlobal() {
    const body = document.body;
    let newMode = body.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    body.setAttribute('data-theme', newMode);
    localStorage.setItem('themePreference', newMode);
}

document.addEventListener("DOMContentLoaded", () => { carregarMenu(); });
