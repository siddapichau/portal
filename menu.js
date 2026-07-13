// menu.js - Controle Global
let menuData = { categorias: [] };

// SIMULAÇÃO DA PLANILHA NO LOCALSTORAGE
// Estrutura: { usuario, senha, email, solicitacao, cargo, favorito }
if(!localStorage.getItem('bd_usuarios')) {
    localStorage.setItem('bd_usuarios', JSON.stringify([
        { usuario: "admin", senha: "password123", email: "admin@ml.com", solicitacao: "aprovado", cargo: "admin", favorito: "" }
    ]));
}

let currentUser = JSON.parse(localStorage.getItem('loggedUser')) || null;

async function carregarMenuGlobal() {
    const baseHTML = `
        <div class="top-bar-wrapper">
            <div class="nav-left">
                <button class="btn-hamb" onclick="toggleMenu()" title="Menu">
                    <span></span><span></span><span></span>
                </button>
                <img src="https://upload.wikimedia.org/wikipedia/pt/0/04/Logotipo_MercadoLivre.png" alt="Mercado Livre" class="ml-logo" onclick="window.location.href='index.html'">
            </div>
            <div class="nav-right">
                <button class="btn-minimal" id="btnAdminGlobal" style="display:none;" onclick="window.location.href='admin.html'" title="Admin">⚙️</button>
                <button class="btn-minimal" onclick="toggleTheme()" title="Alternar Tema">
                    <svg id="themeIconSvg" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                </button>
                <button class="btn-minimal" onclick="abrirAuthModal()" title="Login">
                    <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </button>
            </div>
        </div>

        <div class="sidebar-overlay" onclick="toggleMenu()"></div>
        <div id="global-sidebar" class="sidebar-wrapper">
            <div class="sidebar-left">
                <div class="sidebar-tabs">
                    <button id="tab-todos" class="tab-btn active" onclick="switchTab('todos')">Todos</button>
                    <button id="tab-favs" class="tab-btn" onclick="switchTab('favs')">★ Favoritos</button>
                </div>
                <div id="cat-list-container" style="flex:1; overflow-y:auto; padding-bottom:20px;"></div>
            </div>
            <div class="sidebar-right" id="subitem-panel">
                <!-- Submenus abrem aqui -->
                <div style="padding: 20px; color: var(--text-muted); text-align:center;">Selecione uma categoria</div>
            </div>
        </div>

        <!-- MODAL AUTH -->
        <div class="auth-modal" id="authModal">
            <div class="auth-box" id="loginBox">
                <h2>Acesso</h2>
                <input type="text" id="logUser" placeholder="Usuário">
                <div class="input-group">
                    <input type="password" id="logPass" placeholder="Senha">
                    <span class="eye-icon" onclick="togglePass('logPass')">👁️</span>
                </div>
                <button class="btn-auth" onclick="fazerLogin()">Entrar</button>
                <div class="auth-toggle" onclick="mudarAuthModo('register')">Não tem conta? Solicite Acesso</div>
            </div>

            <div class="auth-box" id="registerBox" style="display:none;">
                <h2>Registrar</h2>
                <input type="text" id="regUser" placeholder="Usuário">
                <input type="email" id="regEmail" placeholder="E-mail">
                <div class="input-group">
                    <input type="password" id="regPass1" placeholder="Senha (8 a 16 caract.)">
                    <span class="eye-icon" onclick="togglePass('regPass1')">👁️</span>
                </div>
                <div class="input-group">
                    <input type="password" id="regPass2" placeholder="Confirmar Senha">
                    <span class="eye-icon" onclick="togglePass('regPass2')">👁️</span>
                </div>
                <button class="btn-auth" style="background:var(--accent-green);" onclick="fazerRegistro()">Registrar</button>
                <div class="auth-toggle" onclick="mudarAuthModo('login')">Já possui conta? Entrar</div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('afterbegin', baseHTML);
    verificarAcesso();

    try {
        const response = await fetch(`${FIREBASE_URL}menu_global.json`);
        const data = await response.json();
        if(data && data.categorias) menuData = data;
        renderizarMenuEsquerdo();
    } catch (error) { console.error("Erro Menu", error); }
}

function toggleMenu() {
    document.querySelector('.sidebar-wrapper').classList.toggle('open');
    document.querySelector('.sidebar-overlay').classList.toggle('active');
}

// Renderização do Menu Lateral Duplo
function renderizarMenuEsquerdo() {
    const container = document.getElementById('cat-list-container');
    container.innerHTML = '';
    menuData.categorias.forEach((cat, idx) => {
        container.innerHTML += `<div class="cat-item" onclick="abrirSubmenu(${idx}, this)">
            ${cat.category} <span>></span>
        </div>`;
    });
}

function abrirSubmenu(catIdx, element) {
    document.querySelectorAll('.cat-item').forEach(el => el.classList.remove('active'));
    if(element) element.classList.add('active');
    
    const panel = document.getElementById('subitem-panel');
    panel.classList.add('active');
    
    let userFavs = currentUser && currentUser.favorito ? currentUser.favorito.split(',') : [];
    
    let html = '';
    const items = menuData.categorias[catIdx].items || [];
    items.forEach(item => {
        const isFav = userFavs.includes(item.title);
        html += `
            <div class="subitem-link">
                <a href="${item.url}" style="text-decoration:none; color:inherit; flex:1;">${item.title}</a>
                <span class="fav-star ${isFav ? 'active' : ''}" onclick="toggleFavorito('${item.title}', this)">★</span>
            </div>
        `;
    });
    panel.innerHTML = html || '<div style="padding:20px;">Vazio</div>';
}

function switchTab(tab) {
    document.getElementById('tab-todos').classList.remove('active');
    document.getElementById('tab-favs').classList.remove('active');
    document.getElementById('tab-' + tab).classList.add('active');
    
    const panel = document.getElementById('subitem-panel');
    if(tab === 'todos') {
        renderizarMenuEsquerdo();
        panel.innerHTML = '<div style="padding: 20px; color: var(--text-muted); text-align:center;">Selecione uma categoria</div>';
    } else {
        document.getElementById('cat-list-container').innerHTML = '<div style="padding:20px; color:#aaa; font-size:0.85rem;">Exibindo seus favoritos...</div>';
        panel.classList.add('active');
        
        if(!currentUser) {
            panel.innerHTML = '<div style="padding:20px; text-align:center;">Faça login para ver favoritos.</div>';
            return;
        }
        
        let userFavs = currentUser.favorito ? currentUser.favorito.split(',') : [];
        let favHtml = '';
        
        menuData.categorias.forEach(cat => {
            (cat.items || []).forEach(item => {
                if(userFavs.includes(item.title)) {
                    favHtml += `
                    <div class="subitem-link">
                        <a href="${item.url}" style="text-decoration:none; color:inherit; flex:1;">${item.title} <br><small style="color:#aaa;">${cat.category}</small></a>
                        <span class="fav-star active" onclick="toggleFavorito('${item.title}', this, true)">★</span>
                    </div>`;
                }
            });
        });
        panel.innerHTML = favHtml || '<div style="padding:20px; text-align:center;">Nenhum favorito ainda.</div>';
    }
}

function toggleFavorito(itemTitle, iconElement, reloadFavs = false) {
    if(!currentUser) return alert("Faça login para favoritar!");
    
    let favs = currentUser.favorito ? currentUser.favorito.split(',').filter(f => f) : [];
    if(favs.includes(itemTitle)) {
        favs = favs.filter(f => f !== itemTitle);
        iconElement.classList.remove('active');
    } else {
        favs.push(itemTitle);
        iconElement.classList.add('active');
    }
    currentUser.favorito = favs.join(',');
    
    // Atualiza BD
    let bd = JSON.parse(localStorage.getItem('bd_usuarios'));
    let idx = bd.findIndex(u => u.usuario === currentUser.usuario);
    if(idx > -1) { bd[idx].favorito = currentUser.favorito; localStorage.setItem('bd_usuarios', JSON.stringify(bd)); }
    localStorage.setItem('loggedUser', JSON.stringify(currentUser));
    
    if(reloadFavs) switchTab('favs');
}

/* SISTEMA DE AUTH */
function abrirAuthModal() { document.getElementById('authModal').classList.add('active'); }
function fecharAuthModal() { document.getElementById('authModal').classList.remove('active'); }
function mudarAuthModo(modo) {
    document.getElementById('loginBox').style.display = modo === 'login' ? 'block' : 'none';
    document.getElementById('registerBox').style.display = modo === 'register' ? 'block' : 'none';
}
function togglePass(id) {
    const el = document.getElementById(id);
    el.type = el.type === 'password' ? 'text' : 'password';
}

function fazerRegistro() {
    const user = document.getElementById('regUser').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const p1 = document.getElementById('regPass1').value;
    const p2 = document.getElementById('regPass2').value;

    if(!user || !email) return alert("Preencha Usuário e E-mail.");
    if(p1.length < 8 || p1.length > 16) return alert("A senha deve ter entre 8 e 16 caracteres.");
    if(p1 !== p2) return alert("As senhas não coincidem!");

    let bd = JSON.parse(localStorage.getItem('bd_usuarios'));
    if(bd.find(u => u.usuario === user)) return alert("Usuário já existe!");

    let novoUser = { usuario: user, senha: p1, email: email, solicitacao: 'pendente', cargo: 'view', favorito: '' };
    bd.push(novoUser);
    localStorage.setItem('bd_usuarios', JSON.stringify(bd));
    
    alert("Solicitação enviada com sucesso! Status: Pendente.");
    mudarAuthModo('login');
}

function fazerLogin() {
    const user = document.getElementById('logUser').value.trim();
    const pass = document.getElementById('logPass').value;
    
    let bd = JSON.parse(localStorage.getItem('bd_usuarios'));
    let validUser = bd.find(u => u.usuario === user && u.senha === pass);
    
    if(!validUser) return alert("Usuário ou senha incorretos.");
    
    currentUser = validUser;
    localStorage.setItem('loggedUser', JSON.stringify(validUser));
    alert(`Bem-vindo, ${currentUser.usuario}! Cargo: ${currentUser.cargo}`);
    fecharAuthModal();
    verificarAcesso();
}

function verificarAcesso() {
    if(currentUser && currentUser.cargo === 'admin') {
        document.getElementById('btnAdminGlobal').style.display = 'flex';
    }
}

function toggleTheme() {
    const body = document.body;
    let newMode = body.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    body.setAttribute('data-theme', newMode);
    localStorage.setItem('themePreference', newMode);
}

document.addEventListener("DOMContentLoaded", () => {
    if (localStorage.getItem('themePreference') === 'dark') document.body.setAttribute('data-theme', 'dark');
    carregarMenuGlobal();
});
