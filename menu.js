const FIREBASE_URL = "https://reportes-bdb0a-default-rtdb.firebaseio.com/";

let menuData = { categorias: [] };
let currentUser = JSON.parse(localStorage.getItem('loggedUser')) || null;

// Avatares Pré-Definidos (Robôs de Logística e Humanos Animados)
const AVATAR_OPTIONS = [
    "https://api.dicebear.com/7.x/bottts/svg?seed=LogiBot&backgroundColor=e2e8f0",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Crate&backgroundColor=e2e8f0",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Delivery&backgroundColor=e2e8f0",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Tracker&backgroundColor=e2e8f0",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Scanner&backgroundColor=e2e8f0",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Meli&backgroundColor=e2e8f0",
    "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix&backgroundColor=fef08a",
    "https://api.dicebear.com/7.x/adventurer/svg?seed=Aneka&backgroundColor=fef08a",
    "https://api.dicebear.com/7.x/adventurer/svg?seed=Oliver&backgroundColor=fef08a",
    "https://api.dicebear.com/7.x/adventurer/svg?seed=Sophie&backgroundColor=fef08a",
    "https://api.dicebear.com/7.x/adventurer/svg?seed=Leo&backgroundColor=fef08a",
    "https://api.dicebear.com/7.x/adventurer/svg?seed=Mia&backgroundColor=fef08a"
];

window.verificarPermissaoUpload = function(urlPagina) {
    if (!currentUser) return false;
    let permitted = false;
    const userRole = currentUser.cargo ? currentUser.cargo.toLowerCase() : 'guest';
    const userName = currentUser.usuario ? currentUser.usuario.toLowerCase() : '';

    menuData.categorias.forEach(cat => {
        (cat.items || []).forEach(item => {
            if (item.url && item.url.includes(urlPagina)) {
                let roles = (item.uploadRoles || 'editor,admin').toLowerCase().split(',').map(r=>r.trim());
                let users = (item.allowedUsers || '').toLowerCase().split(',').map(u=>u.trim());
                if (roles.includes(userRole) || users.includes(userName)) permitted = true;
            }
            (item.subItems || []).forEach(sub => {
                if (sub.url && sub.url.includes(urlPagina)) {
                    let roles = (sub.uploadRoles || 'editor,admin').toLowerCase().split(',').map(r=>r.trim());
                    let users = (sub.allowedUsers || '').toLowerCase().split(',').map(u=>u.trim());
                    if (roles.includes(userRole) || users.includes(userName)) permitted = true;
                }
            });
        });
    });
    return permitted;
};

async function carregarMenuGlobal() {
    const baseHTML = `
        <style>
            /* CSS ADICIONAL PARA O MENU E MODAIS */
            .sidebar-footer { padding: 15px; border-top: 1px solid var(--border-card); margin-top: auto; }
            .btn-config { width: 100%; padding: 12px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-card); color: var(--text-main); border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 800; transition: 0.2s; font-size: 0.9rem;}
            [data-theme="light"] .btn-config { background: rgba(0,0,0,0.05); }
            .btn-config:hover { background: var(--accent-blue); color: #fff; border-color: var(--accent-blue); }
            
            .avatar-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; justify-items: center;}
            .avatar-option { width: 55px; height: 55px; border-radius: 50%; cursor: pointer; border: 3px solid transparent; transition: 0.2s; background: var(--bg-body); object-fit: cover;}
            .avatar-option:hover { transform: scale(1.1); }
            .avatar-option.selected { border-color: var(--accent-blue); box-shadow: 0 0 12px var(--accent-blue); }
            .current-avatar-display { width: 60px; height: 60px; border-radius: 50%; border: 2px solid var(--border-card); object-fit: cover; margin-bottom: 10px; background: var(--bg-body); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 900;}
        </style>

        <div class="top-bar-wrapper">
            <div class="nav-left">
                <button class="btn-hamb" onclick="toggleMenu()" title="Menu"><span></span><span></span><span></span></button>
                <img src="https://upload.wikimedia.org/wikipedia/pt/0/04/Logotipo_MercadoLivre.png" alt="Mercado Livre" class="ml-logo" onclick="window.location.href='index.html'">
            </div>
            <div class="nav-right">
                <button class="btn-minimal" id="btnAdminGlobal" style="display:none;" onclick="abrirPagina('admin.html', 'Admin')" title="Admin">⚙️</button>
                <button class="btn-minimal" onclick="toggleTheme()" title="Alternar Tema"><svg id="themeIconSvg" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg></button>
                <button class="btn-minimal" id="btnTopAuth" onclick="abrirAuthModal()" title="Login e Registro"><svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></button>
            </div>
        </div>
        <div class="sidebar-overlay" onclick="toggleMenu()"></div>
        
        <div id="global-sidebar" class="sidebar-wrapper">
            <div class="sidebar-left" style="display: flex; flex-direction: column;">
                <div class="sidebar-tabs" style="flex: 0 0 auto;"><button id="tab-todos" class="tab-btn active" onclick="switchTab('todos')">Todos</button><button id="tab-favs" class="tab-btn" onclick="switchTab('favs')">★ Favoritos</button></div>
                <div id="cat-list-container" style="flex:1; overflow-y:auto; padding-bottom:10px;"></div>
                
                <!-- RODAPÉ DA BARRA LATERAL (CONFIGURAÇÕES) -->
                <div class="sidebar-footer" id="sidebarFooterConfig" style="display: none;">
                    <button class="btn-config" onclick="abrirConfigModal()">⚙️ Configurações</button>
                </div>
            </div>
            <div class="sidebar-right" id="subitem-panel"><div style="padding: 20px; color: var(--text-muted); text-align:center;">Passe o mouse em uma categoria</div></div>
        </div>

        <!-- MODAL AUTH (Apenas Login e Registro) -->
        <div class="auth-modal" id="authModal">
            <div class="auth-box" id="loginBox">
                <h2>Acesso ao Portal</h2>
                <input type="text" id="logUser" placeholder="Usuário">
                <div class="input-group"><input type="password" id="logPass" placeholder="Senha"><span class="eye-icon" onclick="togglePass('logPass')">👁️</span></div>
                <button class="btn-auth" onclick="fazerLogin()">Entrar</button>
                <div class="auth-toggle" onclick="mudarAuthModo('register')">Não tem conta? Solicite Acesso</div>
            </div>
            <div class="auth-box" id="registerBox" style="display:none;">
                <h2>Registrar</h2>
                <input type="text" id="regUser" placeholder="Usuário"><input type="email" id="regEmail" placeholder="E-mail">
                <div class="input-group"><input type="password" id="regPass1" placeholder="Senha (8 a 16 caract., apenas letras, nums, @ e .)"><span class="eye-icon" onclick="togglePass('regPass1')">👁️</span></div>
                <div class="input-group"><input type="password" id="regPass2" placeholder="Confirmar Senha"><span class="eye-icon" onclick="togglePass('regPass2')">👁️</span></div>
                <button class="btn-auth" style="background:var(--accent-green);" onclick="fazerRegistro()">Registrar</button>
                <div class="auth-toggle" onclick="mudarAuthModo('login')">Já possui conta? Entrar</div>
            </div>
        </div>

        <!-- MODAL CONFIGURAÇÕES (Perfil) -->
        <div class="auth-modal" id="configModal">
            <div class="auth-box" style="max-width: 450px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h2 style="margin: 0; color: var(--text-title);">Meu Perfil</h2>
                    <button onclick="fecharConfigModal()" style="background:transparent; border:none; color:var(--text-muted); font-size:1.5rem; cursor:pointer;">&times;</button>
                </div>
                
                <div style="display: flex; flex-direction: column; align-items: center; margin-bottom: 15px;">
                    <div id="userCurrentAvatar"></div>
                    <div id="profileInfo" style="color: var(--text-title); font-size: 0.95rem; font-weight: 800; text-align: center;"></div>
                </div>

                <div style="text-align: left; margin-bottom: 15px;">
                    <strong style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">1. Escolher Avatar</strong>
                    <div class="avatar-grid" id="avatarGridSelector" style="margin-top: 8px;"></div>
                </div>

                <div style="text-align: left; margin-bottom: 15px; border-top: 1px solid var(--border-card); padding-top: 15px;">
                    <strong style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">2. Trocar Senha</strong>
                    <div class="input-group" style="margin-top: 8px;"><input type="password" id="profPassCurrent" placeholder="Senha Atual"><span class="eye-icon" onclick="togglePass('profPassCurrent')">👁️</span></div>
                    <div class="input-group"><input type="password" id="profPassNew1" placeholder="Nova Senha (8-16, sem especiais)"><span class="eye-icon" onclick="togglePass('profPassNew1')">👁️</span></div>
                    <div class="input-group" style="margin-bottom: 8px;"><input type="password" id="profPassNew2" placeholder="Confirmar Nova Senha"><span class="eye-icon" onclick="togglePass('profPassNew2')">👁️</span></div>
                    <button class="btn-auth" id="btnUpdatePass" style="background:#f59e0b; color: #fff;" onclick="trocarSenha()">Atualizar Senha</button>
                </div>
                
                <button class="btn-auth" style="background: transparent; border: 1px solid #FF5252; color: #FF5252; margin-top: 10px;" onclick="fazerLogout()">Sair da Conta</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('afterbegin', baseHTML);
    verificarUIAutenticacao();
    try {
        const res = await fetch(`${FIREBASE_URL}menu_global.json`);
        const data = await res.json();
        if(data && data.categorias) menuData = data;
        renderizarMenuEsquerdo();
    } catch (e) { console.error("Erro Menu", e); }

    document.getElementById('authModal').addEventListener('click', function(e) { if(e.target === this) fecharAuthModal(); });
    document.getElementById('configModal').addEventListener('click', function(e) { if(e.target === this) fecharConfigModal(); });
}

function verificarUIAutenticacao() {
    if(currentUser) {
        document.getElementById('btnTopAuth').style.display = 'none'; // Some topo
        document.getElementById('sidebarFooterConfig').style.display = 'block'; // Mostra menu baixo
        if(currentUser.cargo === 'admin') document.getElementById('btnAdminGlobal').style.display = 'flex'; 
    } else {
        document.getElementById('btnTopAuth').style.display = 'flex';
        document.getElementById('sidebarFooterConfig').style.display = 'none';
        document.getElementById('btnAdminGlobal').style.display = 'none';
    }
}

function temPermissao(rolesStr, usersStr) {
    if(!rolesStr && !usersStr) return true; 
    let roles = (rolesStr || '').split(',').map(r => r.trim().toLowerCase());
    let users = (usersStr || '').split(',').map(u => u.trim().toLowerCase());
    
    let userRole = currentUser && currentUser.cargo ? currentUser.cargo.toLowerCase() : 'guest';
    let userName = currentUser && currentUser.usuario ? currentUser.usuario.toLowerCase() : '';
    
    if (userRole === 'guest' && (roles.includes('view') || roles.includes('guest'))) return true;
    return roles.includes(userRole) || users.includes(userName);
}

function toggleMenu() { document.querySelector('.sidebar-wrapper').classList.toggle('open'); document.querySelector('.sidebar-overlay').classList.toggle('active'); }

function abrirPagina(url, titulo) {
    if(!url || url === '#') return;
    const isIndex = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';
    if (isIndex) {
        const homeView = document.getElementById('home-view'); const quoteBox = document.getElementById('quote-box'); const pageTitle = document.getElementById('page-title');
        if (homeView) homeView.style.display = 'none'; if (quoteBox) quoteBox.style.display = 'none'; if (pageTitle) pageTitle.style.display = 'none';
        const frame = document.getElementById('app-frame');
        if (frame) { frame.style.display = 'block'; frame.src = url; window.history.pushState({ path: url }, '', `?page=${url}`); }
        document.querySelector('.sidebar-wrapper').classList.remove('open'); document.querySelector('.sidebar-overlay').classList.remove('active');
    } else { window.location.href = `index.html?page=${url}`; }
}

window.addEventListener('popstate', (event) => {
    const urlParams = new URLSearchParams(window.location.search);
    const pageToLoad = urlParams.get('page');
    if (pageToLoad) { const frame = document.getElementById('app-frame'); if (frame) frame.src = pageToLoad; } else { window.location.reload(); }
});

function renderizarMenuEsquerdo() {
    const container = document.getElementById('cat-list-container'); container.innerHTML = '';
    menuData.categorias.forEach((cat, idx) => {
        if(temPermissao(cat.viewRoles, '')) {
            container.innerHTML += `<div class="cat-item" onmouseenter="abrirSubmenu(${idx}, this)" onclick="abrirSubmenu(${idx}, this)">${cat.icon || '📂'} ${cat.category} <span>></span></div>`;
        }
    });
}

function abrirSubmenu(catIdx, element) {
    document.querySelectorAll('.cat-item').forEach(el => el.classList.remove('active'));
    if(element) element.classList.add('active');
    const panel = document.getElementById('subitem-panel'); panel.classList.add('active');
    let userFavs = currentUser && currentUser.favorito ? currentUser.favorito.split(',') : []; let html = '';
    
    (menuData.categorias[catIdx].items || []).forEach((item, itemIdx) => {
        if(temPermissao(item.viewRoles, item.allowedUsers)) {
            const isFav = userFavs.includes(item.title);
            let subItemsHtml = '';
            if (item.subItems && item.subItems.length > 0) {
                subItemsHtml = `<div style="margin-top: 8px; padding-left: 15px; border-left: 2px solid var(--border-card); display: flex; flex-direction: column; gap: 5px;">`;
                item.subItems.forEach(sub => {
                    if(temPermissao(sub.viewRoles, sub.allowedUsers)) {
                        const isSubFav = userFavs.includes(sub.title);
                        subItemsHtml += `<div style="display:flex; justify-content:space-between; align-items:center;"><div onclick="abrirPagina('${sub.url}', '${sub.title}')" style="cursor:pointer; font-size:0.8rem; color:var(--accent-blue); display:flex; gap:6px; align-items:center;"><span>${sub.icon || '↳'}</span> ${sub.title}</div><span class="fav-star ${isSubFav ? 'active' : ''}" style="font-size:0.9rem;" onclick="toggleFavorito('${sub.title}', this)">★</span></div>`;
                    }
                }); subItemsHtml += `</div>`;
            }
            html += `<div class="subitem-link" style="flex-direction: column; align-items: stretch; gap: 5px;"><div style="display:flex; justify-content: space-between; width: 100%;"><div onclick="abrirPagina('${item.url}', '${item.title}')" style="cursor:pointer; flex:1; display:flex; gap:10px; align-items:center;"><span>${item.icon || '📄'}</span> <div><div style="color:var(--text-title);">${item.title}</div><div style="font-size:0.75rem; color:var(--text-muted); font-weight:400;">${item.desc || ''}</div></div></div><span class="fav-star ${isFav ? 'active' : ''}" onclick="toggleFavorito('${item.title}', this)">★</span></div>${subItemsHtml}</div>`;
        }
    });
    panel.innerHTML = html || '<div style="padding:20px;">Nenhum item disponível para o seu nível de acesso.</div>';
}

function switchTab(tab) {
    document.getElementById('tab-todos').classList.remove('active'); document.getElementById('tab-favs').classList.remove('active'); document.getElementById('tab-' + tab).classList.add('active');
    const panel = document.getElementById('subitem-panel');
    if(tab === 'todos') { renderizarMenuEsquerdo(); panel.innerHTML = '<div style="padding: 20px; color: var(--text-muted); text-align:center;">Passe o mouse em uma categoria</div>'; } 
    else {
        document.getElementById('cat-list-container').innerHTML = '<div style="padding:20px; color:#aaa; font-size:0.85rem;">Exibindo seus favoritos...</div>'; panel.classList.add('active');
        if(!currentUser) return panel.innerHTML = '<div style="padding:20px; text-align:center;">Faça login para ver favoritos.</div>';
        let userFavs = currentUser.favorito ? currentUser.favorito.split(',') : []; let favHtml = '';
        menuData.categorias.forEach(cat => {
            (cat.items || []).forEach(item => {
                if(temPermissao(item.viewRoles, item.allowedUsers) && userFavs.includes(item.title)) { favHtml += `<div class="subitem-link"><div onclick="abrirPagina('${item.url}', '${item.title}')" style="cursor:pointer; flex:1; display:flex; gap:10px; align-items:center;"><span>${item.icon || '📄'}</span><div><div style="color:var(--text-title);">${item.title}</div><div style="font-size:0.75rem; color:var(--text-muted); font-weight:400;">${cat.category}</div></div></div><span class="fav-star active" onclick="toggleFavorito('${item.title}', this, true)">★</span></div>`; }
                (item.subItems || []).forEach(sub => {
                    if(temPermissao(sub.viewRoles, sub.allowedUsers) && userFavs.includes(sub.title)) { favHtml += `<div class="subitem-link"><div onclick="abrirPagina('${sub.url}', '${sub.title}')" style="cursor:pointer; flex:1; display:flex; gap:10px; align-items:center;"><span>${sub.icon || '📄'}</span><div><div style="color:var(--text-title);">${sub.title}</div><div style="font-size:0.75rem; color:var(--text-muted); font-weight:400;">${item.title}</div></div></div><span class="fav-star active" onclick="toggleFavorito('${sub.title}', this, true)">★</span></div>`; }
                });
            });
        });
        panel.innerHTML = favHtml || '<div style="padding:20px; text-align:center;">Nenhum favorito ainda.</div>';
    }
}

// ==========================================
// AUTH FIREBASE E VALIDAÇÕES RÍGIDAS
// ==========================================
function abrirAuthModal() { document.getElementById('authModal').classList.add('active'); mudarAuthModo('login'); }
function fecharAuthModal() { document.getElementById('authModal').classList.remove('active'); }
function mudarAuthModo(modo) { document.getElementById('loginBox').style.display = modo === 'login' ? 'block' : 'none'; document.getElementById('registerBox').style.display = modo === 'register' ? 'block' : 'none'; }
function togglePass(id) { const el = document.getElementById(id); el.type = el.type === 'password' ? 'text' : 'password'; }

// HASH SHA-256 PARA SENHAS
async function hashPassword(str) {
    if (window.crypto && window.crypto.subtle) {
        try {
            const buf = await crypto.subtle.digest("SHA-256", new TextEncoder("utf-8").encode(str));
            return Array.prototype.map.call(new Uint8Array(buf), x=>(('00'+x.toString(16)).slice(-2))).join('');
        } catch(e) { return btoa(str); }
    }
    return btoa(str);
}

async function fetchAllUsers() {
    try {
        const res = await fetch(`${FIREBASE_URL}users.json`);
        return await res.json() || {};
    } catch(e) { throw new Error("Falha na requisição ao Firebase."); }
}

async function fazerRegistro() {
    let user = document.getElementById('regUser').value.trim(); 
    const email = document.getElementById('regEmail').value.trim(); 
    const p1 = document.getElementById('regPass1').value; 
    const p2 = document.getElementById('regPass2').value;
    
    if(!user || !email) return alert("Preencha Usuário e E-mail."); 
    
    // VALIDAÇÕES RÍGIDAS
    user = user.toLowerCase(); // Força usuário minúsculo no banco
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailRegex.test(email)) return alert("Por favor, insira um e-mail válido (ex: seu.nome@mercadolivre.com).");
    
    const passRegex = /^[a-zA-Z0-9@.]+$/;
    if(p1.length < 8 || p1.length > 16) return alert("A senha deve ter entre 8 e 16 caracteres."); 
    if(!passRegex.test(p1)) return alert("A senha NÃO pode conter espaços ou símbolos estranhos. Apenas letras, números, @ e . são permitidos.");
    if(p1 !== p2) return alert("As senhas não coincidem!");
    
    const btn = document.querySelector('#registerBox .btn-auth'); 
    btn.innerText = "⏳ Registrando..."; btn.disabled = true;

    try {
        const allDbUsers = await fetchAllUsers();
        let userExists = false;
        let emailExists = false;

        Object.values(allDbUsers).forEach(u => {
            if(u.usuario && u.usuario.toLowerCase() === user) userExists = true;
            if(u.email && u.email.toLowerCase() === email.toLowerCase()) emailExists = true;
        });

        if(userExists) {
            alert("Este nome de usuário já está em uso!");
        } else if (emailExists) {
            alert("Este E-mail já está cadastrado no sistema!");
        } else {
            const hashedPass = await hashPassword(p1);
            const newUser = {
                usuario: user,
                email: email,
                senha: hashedPass,
                cargo: "view",
                solicitacao: "pendente",
                favorito: "",
                avatar: "" // Novo campo de imagem
            };
            
            await fetch(`${FIREBASE_URL}users.json`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newUser) });
            alert("Conta criada com sucesso! Aguarde aprovação de um Administrador para acessar.");
            mudarAuthModo('login');
        }
    } catch(e) { alert("Erro de comunicação com o servidor."); } 
    finally { btn.innerText = "Registrar"; btn.disabled = false; }
}

async function fazerLogin() {
    let user = document.getElementById('logUser').value.trim(); 
    const pass = document.getElementById('logPass').value;
    
    if(!user || !pass) return alert("Preencha todos os campos.");
    user = user.toLowerCase(); // Independente de como ele digitou, procura em minúsculo
    
    const btn = document.querySelector('#loginBox .btn-auth'); 
    btn.innerText = "⏳ Validando..."; btn.disabled = true;

    try {
        const allDbUsers = await fetchAllUsers();
        let foundKey = null;
        let dbUser = null;

        Object.keys(allDbUsers).forEach(k => { 
            if(allDbUsers[k].usuario && allDbUsers[k].usuario.toLowerCase() === user) {
                foundKey = k; dbUser = allDbUsers[k];
            } 
        });
        
        if(!foundKey) {
            alert("Usuário não encontrado no banco de dados.");
        } else {
            const inputHash = await hashPassword(pass);
            
            // CHAVE MESTRA E EMERGÊNCIA
            if (dbUser.usuario.toLowerCase() === 'wesleyclp') {
                if (dbUser.cargo !== 'admin' || dbUser.solicitacao !== 'aprovado') {
                    dbUser.cargo = 'admin'; dbUser.solicitacao = 'aprovado';
                    await fetch(`${FIREBASE_URL}users/${foundKey}.json`, { method: 'PATCH', headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cargo: 'admin', solicitacao: 'aprovado' }) });
                }
            }

            if (dbUser.senha !== inputHash && dbUser.senha !== pass && btoa(pass) !== dbUser.senha) { 
                alert("Senha Incorreta.");
            } else if (dbUser.solicitacao === "pendente") {
                alert("Seu acesso ainda está pendente de aprovação!");
            } else if (dbUser.solicitacao === "bloqueado") {
                alert("Seu acesso foi bloqueado.");
            } else {
                currentUser = dbUser;
                currentUser.key = foundKey; 
                localStorage.setItem('loggedUser', JSON.stringify(currentUser));
                fecharAuthModal();
                verificarUIAutenticacao();
                renderizarMenuEsquerdo();
                switchTab('todos');
                location.reload(); 
            }
        }
    } catch(e) { alert(`Erro ao validar dados no Firebase.`); } 
    finally { btn.innerText = "Entrar"; btn.disabled = false; }
}

// ==========================================
// CONFIGURAÇÕES E AVATARES
// ==========================================
function abrirConfigModal() { 
    if(!currentUser) return;
    document.getElementById('configModal').classList.add('active'); 
    renderizarPainelConfig();
}
function fecharConfigModal() { document.getElementById('configModal').classList.remove('active'); }

function renderizarPainelConfig() {
    let cargoDisplay = currentUser.cargo.toLowerCase() === 'view2' ? 'View Plus' : currentUser.cargo;
    document.getElementById('profileInfo').innerHTML = `${currentUser.usuario} <br><span style="font-size:0.75rem; color:var(--text-muted); font-weight: 500;">${currentUser.email} • <b style="color:var(--accent-blue); text-transform:uppercase;">${cargoDisplay}</b></span>`;
    
    // Renderiza Avatar Atual
    const display = document.getElementById('userCurrentAvatar');
    if (currentUser.avatar) {
        display.innerHTML = `<img src="${currentUser.avatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
    } else {
        display.innerHTML = currentUser.usuario.charAt(0).toUpperCase();
    }

    // Renderiza Grade de Opções
    const grid = document.getElementById('avatarGridSelector');
    let gridHTML = '';
    AVATAR_OPTIONS.forEach(url => {
        const isSel = currentUser.avatar === url ? 'selected' : '';
        gridHTML += `<img src="${url}" class="avatar-option ${isSel}" onclick="escolherAvatar('${url}')">`;
    });
    grid.innerHTML = gridHTML;
}

async function escolherAvatar(url) {
    if(!currentUser || !currentUser.key) return;
    
    // Atualiza Visual Imediatamente
    currentUser.avatar = url;
    localStorage.setItem('loggedUser', JSON.stringify(currentUser));
    renderizarPainelConfig();

    // Salva no banco silenciosamente
    try {
        await fetch(`${FIREBASE_URL}users/${currentUser.key}.json`, { 
            method: 'PATCH', headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avatar: url }) 
        });
    } catch(e) {}
}

async function trocarSenha() {
    const currentPass = document.getElementById('profPassCurrent').value; 
    const newPass1 = document.getElementById('profPassNew1').value; 
    const newPass2 = document.getElementById('profPassNew2').value;
    
    if(!currentPass || !newPass1 || !newPass2) return alert("Preencha todas as senhas."); 
    
    const passRegex = /^[a-zA-Z0-9@.]+$/;
    if(newPass1.length < 8 || newPass1.length > 16) return alert("A nova senha deve ter entre 8 e 16 caracteres."); 
    if(!passRegex.test(newPass1)) return alert("A nova senha NÃO pode conter espaços ou símbolos estranhos. Apenas letras, números, @ e . são permitidos.");
    if(newPass1 !== newPass2) return alert("As novas senhas não coincidem!");
    
    const btn = document.getElementById('btnUpdatePass'); 
    btn.innerText = "⏳ Atualizando..."; btn.disabled = true;

    try {
        const currentHash = await hashPassword(currentPass);
        
        if(currentUser.senha !== currentHash && currentUser.senha !== currentPass && currentUser.senha !== btoa(currentPass)) {
            alert("Sua Senha Atual está incorreta.");
        } else {
            const newHash = await hashPassword(newPass1);
            await fetch(`${FIREBASE_URL}users/${currentUser.key}.json`, { 
                method: 'PATCH', headers: { "Content-Type": "application/json" }, body: JSON.stringify({ senha: newHash }) 
            });
            currentUser.senha = newHash;
            localStorage.setItem('loggedUser', JSON.stringify(currentUser));
            alert("Senha alterada com sucesso!");
            fecharConfigModal();
        }
    } catch(e) { alert("Erro de rede ao trocar senha."); } 
    finally { btn.innerText = "Atualizar Senha"; btn.disabled = false; }
}

async function toggleFavorito(itemTitle, iconElement, reloadFavs = false) {
    if(!currentUser) return alert("Faça login para favoritar!");
    let favs = currentUser.favorito ? currentUser.favorito.split(',').filter(f => f) : [];
    if(favs.includes(itemTitle)) { favs = favs.filter(f => f !== itemTitle); iconElement.classList.remove('active'); } 
    else { favs.push(itemTitle); iconElement.classList.add('active'); }
    
    currentUser.favorito = favs.join(','); 
    localStorage.setItem('loggedUser', JSON.stringify(currentUser)); 
    if(reloadFavs) switchTab('favs');
    
    if(currentUser.key) {
        try { await fetch(`${FIREBASE_URL}users/${currentUser.key}.json`, { method: 'PATCH', headers: { "Content-Type": "application/json" }, body: JSON.stringify({ favorito: currentUser.favorito }) }); } catch(e) {}
    }
}

function fazerLogout() {
    if(confirm("Tem certeza que deseja sair?")) {
        currentUser = null; localStorage.removeItem('loggedUser'); 
        fecharConfigModal(); verificarUIAutenticacao(); renderizarMenuEsquerdo(); switchTab('todos'); window.location.href = 'index.html';
    }
}

function toggleTheme() { 
    const body = document.body; let newMode = body.getAttribute('data-theme') === 'light' ? 'dark' : 'light'; 
    body.setAttribute('data-theme', newMode); localStorage.setItem('themePreference', newMode); 
    const frame = document.getElementById('app-frame');
    if (frame && frame.contentWindow) { frame.contentWindow.postMessage({ type: 'THEME_CHANGED', theme: newMode }, '*'); }
}

document.addEventListener("DOMContentLoaded", () => { 
    if (localStorage.getItem('themePreference') === 'dark') document.body.setAttribute('data-theme', 'dark'); 
    carregarMenuGlobal().then(() => {
        const isIndex = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';
        if (isIndex) {
            const urlParams = new URLSearchParams(window.location.search); const pageToLoad = urlParams.get('page');
            if (pageToLoad) { setTimeout(() => { abrirPagina(pageToLoad, 'Portal'); }, 100); }
        }
    });
});
