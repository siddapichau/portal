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
let activeTab = 'todos'; 

const menuStyles = `
<style>
    /* Botoes Minimalistas do Topo */
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

    /* Barra Superior Amarela */
    .top-bar-wrapper {
        position: fixed; top: 0; left: 0; width: 100%; height: 60px;
        background-color: #FFE600; padding: 0 20px; z-index: 1000;
        display: flex; align-items: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .top-nav { width: 100%; display: flex; justify-content: space-between; align-items: center; }
    .nav-left { display: flex; align-items: center; gap: 15px; }
    .ml-logo { height: 32px; cursor: pointer; }

    /* Estrutura Sidebar Escura */
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
    
    .menu-cat {
        padding: 14px 20px; font-size: 0.9rem; font-weight: 800; color: #ebebeb;
        cursor: pointer; display: flex; justify-content: space-between; align-items: center;
        transition: background 0.2s;
    }
    .menu-cat:hover, .menu-cat.active { background-color: #3483FA; color: #ffffff; }
    
    /* Submenu Flyout (Painel Branco à direita) */
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
                    <button class="btn-minimalist" id="themeToggleBtn" onclick="toggleThemeGlobal()" title="Modo Claro/Escuro">
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
    
    if (activeTab === 'todos') {
        const btn = event.target;
        if(favs.includes(url)) { btn.classList.add('fav'); btn.innerHTML = '★'; }
        else { btn.classList.remove('fav'); btn.innerHTML = '☆'; }
    } else {
        renderizarSidebar(); 
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
        let temFav = false;
        globalMenuData.forEach(cat => {
            cat.items.forEach(item => {
                if (favs.includes(item.url)) {
                    temFav = true;
                    html += `
                        <a href="${item.url}" class="sub-item" style="color: #ebebeb; border-bottom: 1px solid rgba(255,255,255,0.05);">
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
    const senha = prompt("Acesso Restrito ao Painel Admin.\nDigite a senha temporária:");
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

// Inicia o menu assim que os elementos DOM existirem
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', carregarMenu);
} else {
    carregarMenu();
}
```eof

### 2. `index.html`
```html:index.html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Portal de Controles Internos - Mercado Livre</title>
    <link rel="icon" href="https://cdn.iconscout.com/icon/free/png-256/free-mercado-livre-icon-svg-download-png-14549372.png" type="image/png">
    
    <link rel="stylesheet" href="style.css">

    <style>
        body { align-items: center; padding: 0 0 40px 0; display: flex; flex-direction: column; }
        
        #main-content { 
            margin-top: 80px; padding: 20px; width: 100%; max-width: 1200px;
            transition: margin-left 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.1); 
            display: flex; flex-direction: column; align-items: center; 
        }
        @media (min-width: 900px) { #main-content.shifted { margin-left: 280px; width: calc(100% - 280px); } }

        .main-title { font-size: 2.2rem; font-weight: 900; color: var(--text-title); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 40px; position: relative; padding-bottom: 12px; text-align: center; }
        .main-title::after { content: ''; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 70px; height: 4px; background-color: var(--accent-blue); border-radius: 2px; }

        .welcome-box { background: var(--bg-card); border: 1px solid var(--border-card); border-radius: 12px; padding: 40px; text-align: center; box-shadow: var(--shadow-card); width: 100%; }
        .welcome-box p { color: var(--text-muted); font-size: 1.1rem; line-height: 1.5; margin-bottom: 15px;}
    </style>
</head>
<body data-theme="light">

    <!-- SCRIPTS CORE -->
    <script src="js/firebase.config.js"></script>
    <script src="menu.js"></script>

    <div id="main-content">
        <h1 class="main-title">Portal de Controles Internos</h1>
        
        <div class="welcome-box">
            <h2 style="font-size: 1.8rem; margin-bottom: 15px; color: var(--text-title);">Bem-vindo ao Novo Portal</h2>
            <p>O menu agora é unificado, retrátil e gerenciado pelo banco de dados!<br>Para acessar os relatórios, <strong>clique no ícone de menu (☰) no canto superior esquerdo</strong>.</p>
            <p style="font-size: 0.9rem; color: var(--accent-blue); font-weight: bold; margin-top: 20px;">Você também pode salvar suas páginas favoritas clicando na estrelinha!</p>
        </div>
    </div>

    <script>
        if (localStorage.getItem('themePreference') === 'dark') document.body.setAttribute('data-theme', 'dark');
    </script>
</body>
</html>
```eof

### 3. `admin.html`
```html:admin.html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin - Gerenciar Menu Global</title>
    <link rel="icon" href="https://cdn.iconscout.com/icon/free/png-256/free-mercado-livre-icon-svg-download-png-14549372.png" type="image/png">
    
    <link rel="stylesheet" href="style.css">
    
    <style>
        body { align-items: center; padding: 0 0 40px 0; display: flex; flex-direction: column; }

        #main-content { 
            margin-top: 80px; padding: 20px; width: 100%; max-width: 1000px; margin-left: auto; margin-right: auto;
            transition: margin-left 0.3s ease; 
        }
        @media (min-width: 900px) { #main-content.shifted { margin-left: 280px; width: calc(100% - 280px); } }

        .admin-container { background: var(--bg-card); padding: 30px; border-radius: 12px; box-shadow: var(--shadow-card); border: 1px solid var(--border-card); }
        .header-title { font-size: 1.8rem; font-weight: 900; margin-bottom: 20px; color: var(--text-title); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;}
        
        .cat-card { background: var(--bg-body); border: 1px solid var(--border-card); padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: inset 0 2px 5px rgba(0,0,0,0.02); }
        .cat-header { display: flex; gap: 10px; margin-bottom: 15px; align-items: center; flex-wrap: wrap;}
        .cat-header input { flex: 1; padding: 10px; border-radius: 6px; border: 1px solid var(--border-input); background: var(--bg-input); color: var(--text-main); font-weight: bold;}
        
        .subitem-row { display: grid; grid-template-columns: 80px 1fr 1fr 1fr auto; gap: 10px; background: var(--bg-card); padding: 12px; border-radius: 6px; margin-bottom: 10px; border: 1px solid var(--border-card); align-items: center;}
        .subitem-row input, .subitem-row select { padding: 8px; border-radius: 4px; border: 1px solid var(--border-input); background: var(--bg-input); color: var(--text-main); font-size: 0.85rem;}
        
        .btn { padding: 8px 16px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; color: white; transition: 0.2s; box-shadow: 0 2px 5px rgba(0,0,0,0.1);}
        .btn-green { background-color: var(--accent-green); }
        .btn-green:hover { background-color: #008f45; transform: translateY(-2px);}
        .btn-blue { background-color: var(--accent-blue); font-size: 1rem; padding: 10px 20px;}
        .btn-blue:hover { background-color: #2968c8; transform: translateY(-2px);}
        .btn-red { background-color: var(--accent-red); padding: 8px 12px; }
        .btn-dark { background-color: #475569; }

        /* Auth Overlay (Login) */
        .auth-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.95); z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 18px; }
        [data-theme="light"] .auth-overlay { background: rgba(241, 245, 249, 0.95); }
        .auth-box { width: 100%; max-width: 390px; background-color: var(--bg-card); border: 1px solid var(--border-card); border-radius: 12px; padding: 25px; text-align: center; box-shadow: var(--shadow-card); }
        .auth-box input { width: 100%; background: var(--bg-input); color: var(--text-main); border: 1px solid var(--border-input); border-radius: 7px; padding: 12px; outline: none; font-size: 1rem; margin-bottom: 12px; text-align: center; font-weight: 900; }
        .auth-error { color: var(--accent-red); font-size: .85rem; font-weight: 900; margin-top: 10px; min-height: 18px; }
    </style>
</head>
<body data-theme="light">

    <div class="auth-overlay" id="authOverlay">
        <div class="auth-box">
            <img src="https://upload.wikimedia.org/wikipedia/pt/0/04/Logotipo_MercadoLivre.png" alt="Mercado Livre" style="height: 38px; margin-bottom: 14px;">
            <h2 style="color: var(--text-title); font-size: 1.2rem; font-weight: 900; margin-bottom: 8px;">Acesso ao Admin</h2>
            <p style="color: var(--text-muted); font-size: .85rem; font-weight: 700; margin-bottom: 14px;">Digite a senha temporária para gerenciar o Menu Global.</p>
            <input type="password" id="senhaInput" placeholder="Senha de acesso" autocomplete="off" onkeydown="if(event.key==='Enter') validarAdmin()">
            <button class="btn btn-blue" style="width: 100%;" onclick="validarAdmin()">Entrar</button>
            <div class="auth-error" id="authError"></div>
        </div>
    </div>

    <!-- SCRIPTS CORE -->
    <script src="js/firebase.config.js"></script>
    <script src="menu.js"></script>

    <div id="main-content">
        <div class="admin-container">
            <div class="header-title">
                ⚙️ Gerenciador de Menus
                <button class="btn btn-blue" onclick="salvarNoFirebase()">💾 Salvar no Firebase</button>
            </div>
            <p style="color: var(--text-muted); margin-bottom: 25px; font-size: 0.95rem;">Crie Categorias (ex: "Insumos"). O menu lateral se organizará automaticamente e salvará a configuração para todas as telas do sistema.</p>

            <div id="categorias-container"></div>

            <button class="btn btn-green" onclick="adicionarCategoria()" style="width: 100%; padding: 15px; font-size: 1.1rem; margin-top: 10px;">+ Adicionar Nova Categoria de Menu</button>
        </div>
    </div>

    <script>
        if (localStorage.getItem('themePreference') === 'dark') document.body.setAttribute('data-theme', 'dark');

        function validarAdmin() {
            const senha = document.getElementById('senhaInput').value;
            if (senha === "159159") {
                document.getElementById('authOverlay').style.display = 'none';
                carregarDadosAdmin();
            } else {
                document.getElementById('authError').innerText = "Senha incorreta!";
                document.getElementById('senhaInput').value = '';
            }
        }

        let menuData = { categorias: [] };

        async function carregarDadosAdmin() {
            try {
                if(typeof FIREBASE_URL !== 'undefined') {
                    const res = await fetch(`${FIREBASE_URL}menu_global.json`);
                    const data = await res.json();
                    if(data && data.categorias) {
                        menuData = data;
                    } else {
                        menuData = { categorias: DEFAULT_MENU }; // Vem do menu.js
                    }
                }
            } catch (e) { console.error("Erro ao puxar dados", e); menuData = { categorias: DEFAULT_MENU }; }
            renderizarAdmin();
        }

        function getIconsOptions(selectedIcon) {
            let opts = "";
            // ICONS_LIST vem do menu.js global
            if (typeof ICONS_LIST !== 'undefined') {
                ICONS_LIST.forEach(ico => {
                    opts += `<option value="${ico}" ${ico === selectedIcon ? 'selected' : ''}>${ico}</option>`;
                });
            }
            return opts;
        }

        function renderizarAdmin() {
            const container = document.getElementById('categorias-container');
            container.innerHTML = '';

            menuData.categorias.forEach((cat, catIndex) => {
                let itemsHtml = '';
                if(!cat.items) cat.items = [];

                cat.items.forEach((item, itemIndex) => {
                    itemsHtml += `
                        <div class="subitem-row">
                            <select onchange="updateItem(${catIndex}, ${itemIndex}, 'icon', this.value)">
                                ${getIconsOptions(item.icon)}
                            </select>
                            <input type="text" placeholder="Título (ex: Contagem Insumos)" value="${item.title || ''}" onchange="updateItem(${catIndex}, ${itemIndex}, 'title', this.value)">
                            <input type="text" placeholder="Descrição (ex: Estoque físico)" value="${item.desc || ''}" onchange="updateItem(${catIndex}, ${itemIndex}, 'desc', this.value)">
                            <input type="text" placeholder="URL (ex: contagem_insumos.html)" value="${item.url || ''}" onchange="updateItem(${catIndex}, ${itemIndex}, 'url', this.value)">
                            <button class="btn btn-red" onclick="removerItem(${catIndex}, ${itemIndex})" title="Excluir Submenu">✖</button>
                        </div>
                    `;
                });

                const html = `
                    <div class="cat-card">
                        <div class="cat-header">
                            <input type="text" placeholder="Nome da Categoria Pai (Ex: Insumos e Estoque)" value="${cat.category || ''}" onchange="updateCat(${catIndex}, 'category', this.value)">
                            <button class="btn btn-red" onclick="removerCategoria(${catIndex})">Excluir Categoria</button>
                        </div>
                        
                        <div style="margin-bottom: 10px; font-weight: 800; font-size: 0.85rem; color: var(--text-muted);">Itens (Submenus):</div>
                        ${itemsHtml}
                        
                        <button class="btn btn-dark" style="margin-top: 10px;" onclick="adicionarItem(${catIndex})">+ Adicionar Submenu</button>
                    </div>
                `;
                container.innerHTML += html;
            });
        }

        function adicionarCategoria() { menuData.categorias.push({ category: "Nova Categoria", items: [] }); renderizarAdmin(); }
        function removerCategoria(idx) { if(confirm("Apagar categoria inteira?")) { menuData.categorias.splice(idx, 1); renderizarAdmin(); } }
        function updateCat(idx, field, value) { menuData.categorias[idx][field] = value; }

        function adicionarItem(catIdx) { menuData.categorias[catIdx].items.push({ icon: "📄", title: "Novo Item", desc: "Descrição", url: "pagina.html" }); renderizarAdmin(); }
        function removerItem(catIdx, itemIdx) { menuData.categorias[catIdx].items.splice(itemIdx, 1); renderizarAdmin(); }
        function updateItem(catIdx, itemIdx, field, value) { menuData.categorias[catIdx].items[itemIdx][field] = value; }

        async function salvarNoFirebase() {
            const btn = document.querySelector('.header-title .btn-blue');
            btn.innerText = "⏳ Salvando...";
            try {
                await fetch(`${FIREBASE_URL}menu_global.json`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(menuData)
                });
                alert("Menu salvo com sucesso! O menu lateral será atualizado em todas as páginas.");
                window.location.reload(); 
            } catch(e) {
                alert("Erro ao salvar.");
            }
            btn.innerText = "💾 Salvar no Firebase";
        }
    </script>
</body>
</html>
```eof
