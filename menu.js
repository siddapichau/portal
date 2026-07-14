const FIREBASE_URL = "https://reportes-bdb0a-default-rtdb.firebaseio.com/";

let menuData = { categorias: [] };
let currentUser = JSON.parse(localStorage.getItem('loggedUser')) || null;

// ==========================================
// FUNÇÃO GLOBAL DE PERMISSÕES
// ==========================================
window.verificarPermissaoUpload = function(urlPagina) {
    if (!currentUser) return false;
    let permitted = false;
    const userRole = currentUser.cargo ? currentUser.cargo.toLowerCase() : 'guest';
    const userName = currentUser.usuario ? currentUser.usuario.toLowerCase() : '';

    menuData.categorias.forEach(cat => {
        (cat.items || []).forEach(item => {
            // Verifica no 2º nível
            if (item.url && item.url.includes(urlPagina)) {
                let roles = (item.uploadRoles || 'editor,admin').toLowerCase().split(',').map(r=>r.trim());
                let users = (item.allowedUsers || '').toLowerCase().split(',').map(u=>u.trim());
                if (roles.includes(userRole) || users.includes(userName)) permitted = true;
            }
            // Verifica no 3º nível (Sub-submenus)
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

// ==========================================
// INICIALIZAÇÃO DO MENU E ESTRUTURA HTML
// ==========================================
async function carregarMenuGlobal() {
    const baseHTML = `
        <div class="top-bar-wrapper">
            <div class="nav-left">
                <button class="btn-hamb" onclick="toggleMenu()" title="Menu"><span></span><span></span><span></span></button>
                <img src="https://upload.wikimedia.org/wikipedia/pt/0/04/Logotipo_MercadoLivre.png" alt="Mercado Livre" class="ml-logo" onclick="window.location.href='index.html'">
            </div>
            <div class="nav-right">
                <button class="btn-minimal" id="btnAdminGlobal" style="display:none;" onclick="abrirPagina('admin.html', 'Admin')" title="Admin">⚙️</button>
                <button class="btn-minimal" onclick="toggleTheme()" title="Alternar Tema"><svg id="themeIconSvg" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg></button>
                <button class="btn-minimal" onclick="abrirAuthModal()" title="Perfil / Login"><svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></button>
            </div>
        </div>
        <div class="sidebar-overlay" onclick="toggleMenu()"></div>
        <div id="global-sidebar" class="sidebar-wrapper">
            <div class="sidebar-left">
                <div class="sidebar-tabs"><button id="tab-todos" class="tab-btn active" onclick="switchTab('todos')">Todos</button><button id="tab-favs" class="tab-btn" onclick="switchTab('favs')">★ Favoritos</button></div>
                <div id="cat-list-container" style="flex:1; overflow-y:auto; padding-bottom:20px;"></div>
            </div>
            <div class="sidebar-right" id="subitem-panel"><div style="padding: 20px; color: var(--text-muted); text-align:center;">Passe o mouse em uma categoria</div></div>
        </div>

        <!-- MODAL AUTH -->
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
                <div class="input-group"><input type="password" id="regPass1" placeholder="Senha (8 a 16 caract.)"><span class="eye-icon" onclick="togglePass('regPass1')">👁️</span></div>
                <div class="input-group"><input type="password" id="regPass2" placeholder="Confirmar Senha"><span class="eye-icon" onclick="togglePass('regPass2')">👁️</span></div>
                <button class="btn-auth" style="background:var(--accent-green);" onclick="fazerRegistro()">Registrar</button>
                <div class="auth-toggle" onclick="mudarAuthModo('login')">Já possui conta? Entrar</div>
            </div>
            <div class="auth-box" id="profileBox" style="display:none; max-width: 450px;">
                <h2 style="margin-bottom: 5px; color: var(--text-title);">Meu Perfil</h2>
                <div id="profileInfo" style="margin-bottom: 15px; color: var(--text-muted); font-size: 0.9rem; text-align: left; background: var(--bg-body); padding: 10px; border-radius: 6px; border: 1px solid var(--border-card);"></div>
                <div style="text-align: left; margin-bottom: 15px;">
                    <strong style="color: var(--text-title); font-size: 0.9rem;">Trocar Senha</strong>
                    <div class="input-group" style="margin-top: 5px;"><input type="password" id="profPassCurrent" placeholder="Senha Atual"><span class="eye-icon" onclick="togglePass('profPassCurrent')">👁️</span></div>
                    <div class="input-group"><input type="password" id="profPassNew1" placeholder="Nova Senha (8-16 caract.)"><span class="eye-icon" onclick="togglePass('profPassNew1')">👁️</span></div>
                    <div class="input-group" style="margin-bottom: 5px;"><input type="password" id="profPassNew2" placeholder="Confirmar Nova Senha"><span class="eye-icon" onclick="togglePass('profPassNew2')">👁️</span></div>
                    <button class="btn-auth" id="btnUpdatePass" style="background:#f59e0b; color: #fff;" onclick="trocarSenha()">Atualizar Senha</button>
                </div>
                <button class="btn-auth" style="background: #FF5252;" onclick="fazerLogout()">Sair da Conta</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('afterbegin', baseHTML);
    verificarAcesso();
    try {
        const res = await fetch(`${FIREBASE_URL}menu_global.json`);
        const data = await res.json();
        if(data && data.categorias) menuData = data;
        renderizarMenuEsquerdo();
    } catch (e) { console.error("Erro Menu", e); }

    document.getElementById('authModal').addEventListener('click', function(e) { if(e.target === this) fecharAuthModal(); });
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

function toggleMenu() {
    document.querySelector('.sidebar-wrapper').classList.toggle('open');
    document.querySelector('.sidebar-overlay').classList.toggle('active');
}

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
    if (pageToLoad) { const frame = document.getElementById('app-frame'); if (frame) frame.src = pageToLoad; } 
    else { window.location.reload(); }
});

function renderizarMenuEsquerdo() {
    const container = document.getElementById('cat-list-container');
    container.innerHTML = '';
    menuData.categorias.forEach((cat, idx) => {
        if(temPermissao(cat.viewRoles, '')) {
            container.innerHTML += `<div class="cat-item" onmouseenter="abrirSubmenu(${idx}, this)" onclick="abrirSubmenu(${idx}, this)">
                ${cat.icon || '📂'} ${cat.category} <span>></span>
            </div>`;
        }
    });
}

function abrirSubmenu(catIdx, element) {
    document.querySelectorAll('.cat-item').forEach(el => el.classList.remove('active'));
    if(element) element.classList.add('active');
    const panel = document.getElementById('subitem-panel');
    panel.classList.add('active');
    let userFavs = currentUser && currentUser.favorito ? currentUser.favorito.split(',') : [];
    let html = '';
    
    (menuData.categorias[catIdx].items || []).forEach((item, itemIdx) => {
        if(temPermissao(item.viewRoles, item.allowedUsers)) {
            const isFav = userFavs.includes(item.title);
            let subItemsHtml = '';
            if (item.subItems && item.subItems.length > 0) {
                subItemsHtml = `<div style="margin-top: 8px; padding-left: 15px; border-left: 2px solid var(--border-card); display: flex; flex-direction: column; gap: 5px;">`;
                item.subItems.forEach(sub => {
                    if(temPermissao(sub.viewRoles, sub.allowedUsers)) {
                        const isSubFav = userFavs.includes(sub.title);
                        subItemsHtml += `
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <div onclick="abrirPagina('${sub.url}', '${sub.title}')" style="cursor:pointer; font-size:0.8rem; color:var(--accent-blue); display:flex; gap:6px; align-items:center;">
                                    <span>${sub.icon || '↳'}</span> ${sub.title}
                                </div>
                                <span class="fav-star ${isSubFav ? 'active' : ''}" style="font-size:0.9rem;" onclick="toggleFavorito('${sub.title}', this)">★</span>
                            </div>
                        `;
                    }
                });
                subItemsHtml += `</div>`;
            }

            html += `
                <div class="subitem-link" style="flex-direction: column; align-items: stretch; gap: 5px;">
                    <div style="display:flex; justify-content: space-between; width: 100%;">
                        <div onclick="abrirPagina('${item.url}', '${item.title}')" style="cursor:pointer; flex:1; display:flex; gap:10px; align-items:center;">
                            <span>${item.icon || '📄'}</span> 
                            <div><div style="color:var(--text-title);">${item.title}</div><div style="font-size:0.75rem; color:var(--text-muted); font-weight:400;">${item.desc || ''}</div></div>
                        </div>
                        <span class="fav-star ${isFav ? 'active' : ''}" onclick="toggleFavorito('${item.title}', this)">★</span>
                    </div>
                    ${subItemsHtml}
                </div>
            `;
        }
    });
    panel.innerHTML = html || '<div style="padding:20px;">Nenhum item disponível para o seu nível de acesso.</div>';
}

function switchTab(tab) {
    document.getElementById('tab-todos').classList.remove('active'); document.getElementById('tab-favs').classList.remove('active'); document.getElementById('tab-' + tab).classList.add('active');
    const panel = document.getElementById('subitem-panel');
    if(tab === 'todos') { renderizarMenuEsquerdo(); panel.innerHTML = '<div style="padding: 20px; color: var(--text-muted); text-align:center;">Passe o mouse em uma categoria</div>'; } 
    else {
        document.getElementById('cat-list-container').innerHTML = '<div style="padding:20px; color:#aaa; font-size:0.85rem;">Exibindo seus favoritos...</div>';
        panel.classList.add('active');
        if(!currentUser) return panel.innerHTML = '<div style="padding:20px; text-align:center;">Faça login para ver favoritos.</div>';
        
        let userFavs = currentUser.favorito ? currentUser.favorito.split(',') : [];
        let favHtml = '';
        menuData.categorias.forEach(cat => {
            (cat.items || []).forEach(item => {
                if(temPermissao(item.viewRoles, item.allowedUsers) && userFavs.includes(item.title)) {
                    favHtml += `<div class="subitem-link"><div onclick="abrirPagina('${item.url}', '${item.title}')" style="cursor:pointer; flex:1; display:flex; gap:10px; align-items:center;"><span>${item.icon || '📄'}</span><div><div style="color:var(--text-title);">${item.title}</div><div style="font-size:0.75rem; color:var(--text-muted); font-weight:400;">${cat.category}</div></div></div><span class="fav-star active" onclick="toggleFavorito('${item.title}', this, true)">★</span></div>`;
                }
                (item.subItems || []).forEach(sub => {
                    if(temPermissao(sub.viewRoles, sub.allowedUsers) && userFavs.includes(sub.title)) {
                        favHtml += `<div class="subitem-link"><div onclick="abrirPagina('${sub.url}', '${sub.title}')" style="cursor:pointer; flex:1; display:flex; gap:10px; align-items:center;"><span>${sub.icon || '📄'}</span><div><div style="color:var(--text-title);">${sub.title}</div><div style="font-size:0.75rem; color:var(--text-muted); font-weight:400;">${item.title}</div></div></div><span class="fav-star active" onclick="toggleFavorito('${sub.title}', this, true)">★</span></div>`;
                    }
                });
            });
        });
        panel.innerHTML = favHtml || '<div style="padding:20px; text-align:center;">Nenhum favorito ainda.</div>';
    }
}

// ==========================================
// AUTH: MIGRADO 100% PARA O FIREBASE (USERS.JSON)
// ==========================================
function abrirAuthModal() { document.getElementById('authModal').classList.add('active'); if(currentUser) { mudarAuthModo('profile'); carregarPerfil(); } else { mudarAuthModo('login'); } }
function fecharAuthModal() { document.getElementById('authModal').classList.remove('active'); }
function mudarAuthModo(modo) { document.getElementById('loginBox').style.display = modo === 'login' ? 'block' : 'none'; document.getElementById('registerBox').style.display = modo === 'register' ? 'block' : 'none'; document.getElementById('profileBox').style.display = modo === 'profile' ? 'block' : 'none'; }
function togglePass(id) { const el = document.getElementById(id); el.type = el.type === 'password' ? 'text' : 'password'; }

function carregarPerfil() {
    let cargoDisplay = currentUser.cargo.toLowerCase() === 'view2' ? 'View Plus' : currentUser.cargo;
    document.getElementById('profileInfo').innerHTML = `<strong>Usuário:</strong> ${currentUser.usuario} <br><strong>E-mail:</strong> ${currentUser.email} <br><strong>Cargo:</strong> <span style="text-transform: uppercase; color: var(--accent-blue); font-weight:bold;">${cargoDisplay}</span>`;
}

// Geração de hash simples para armazenar senhas (MUITO BÁSICO, APENAS PARA FINS DEMONSTRATIVOS LOCAIS)
async function hashPassword(str) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder("utf-8").encode(str));
    return Array.prototype.map.call(new Uint8Array(buf), x=>(('00'+x.toString(16)).slice(-2))).join('');
}

// Busca a Key correta no Firebase a partir do nome de usuário
async function fetchUserKey(username) {
    const res = await fetch(`${FIREBASE_URL}users.json`);
    const data = await res.json();
    if(!data) return null;
    let foundKey = null;
    Object.keys(data).forEach(k => { if(data[k].usuario.toLowerCase() === username.toLowerCase()) foundKey = k; });
    return { key: foundKey, user: foundKey ? data[foundKey] : null };
}

async function fazerRegistro() {
    const user = document.getElementById('regUser').value.trim(); 
    const email = document.getElementById('regEmail').value.trim(); 
    const p1 = document.getElementById('regPass1').value; 
    const p2 = document.getElementById('regPass2').value;
    
    if(!user || !email) return alert("Preencha Usuário e E-mail."); 
    if(p1.length < 8 || p1.length > 16) return alert("A senha deve ter entre 8 e 16 caracteres."); 
    if(p1 !== p2) return alert("As senhas não coincidem!");
    
    const btn = document.querySelector('#registerBox .btn-auth'); 
    btn.innerText = "⏳ Registrando..."; btn.disabled = true;

    try {
        const check = await fetchUserKey(user);
        if(check.key) {
            alert("Nome de usuário já existe no sistema!");
        } else {
            const hashedPass = await hashPassword(p1);
            const newUser = {
                usuario: user,
                email: email,
                senha: hashedPass, // Senha encriptada
                cargo: "view", // Por padrão cai como view comum
                solicitacao: "pendente",
                favorito: ""
            };
            
            await fetch(`${FIREBASE_URL}users.json`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newUser) });
            alert("Conta criada com sucesso! Aguarde aprovação de um Administrador para acessar.");
            mudarAuthModo('login');
        }
    } catch(e) { alert("Erro de comunicação com o servidor."); } 
    finally { btn.innerText = "Registrar"; btn.disabled = false; }
}

async function fazerLogin() {
    const user = document.getElementById('logUser').value.trim(); 
    const pass = document.getElementById('logPass').value;
    
    if(!user || !pass) return alert("Preencha todos os campos.");
    const btn = document.querySelector('#loginBox .btn-auth'); 
    btn.innerText = "⏳ Validando..."; btn.disabled = true;

    try {
        const account = await fetchUserKey(user);
        if(!account.key) {
            alert("Usuário não encontrado.");
        } else {
            const dbUser = account.user;
            const inputHash = await hashPassword(pass);
            
            if (dbUser.senha !== inputHash && dbUser.senha !== pass) { // Valida contra hash ou senha antiga em texto puro
                alert("Senha Incorreta.");
            } else if (dbUser.solicitacao === "pendente") {
                alert("Seu acesso ainda está pendente de aprovação!");
            } else if (dbUser.solicitacao === "bloqueado") {
                alert("Seu acesso foi bloqueado.");
            } else {
                // SUCESSO!
                currentUser = dbUser;
                currentUser.key = account.key; // Salva a chave para updates futuros
                localStorage.setItem('loggedUser', JSON.stringify(currentUser));
                fecharAuthModal();
                verificarAcesso();
                renderizarMenuEsquerdo();
                switchTab('todos');
                location.reload(); // Recarrega para forçar atualização no index.html
            }
        }
    } catch(e) { alert("Erro de conexão ao validar dados."); } 
    finally { btn.innerText = "Entrar"; btn.disabled = false; }
}

async function trocarSenha() {
    const currentPass = document.getElementById('profPassCurrent').value; 
    const newPass1 = document.getElementById('profPassNew1').value; 
    const newPass2 = document.getElementById('profPassNew2').value;
    
    if(!currentPass || !newPass1 || !newPass2) return alert("Preencha todas as senhas."); 
    if(newPass1.length < 8 || newPass1.length > 16) return alert("A nova senha deve ter entre 8 e 16 caracteres."); 
    if(newPass1 !== newPass2) return alert("As novas senhas não coincidem!");
    
    const btn = document.getElementById('btnUpdatePass'); 
    btn.innerText = "⏳ Atualizando..."; btn.disabled = true;

    try {
        const currentHash = await hashPassword(currentPass);
        
        if(currentUser.senha !== currentHash && currentUser.senha !== currentPass) {
            alert("Sua Senha Atual está incorreta.");
        } else {
            const newHash = await hashPassword(newPass1);
            
            await fetch(`${FIREBASE_URL}users/${currentUser.key}.json`, { 
                method: 'PATCH', 
                headers: { "Content-Type": "application/json" }, 
                body: JSON.stringify({ senha: newHash }) 
            });
            
            currentUser.senha = newHash;
            localStorage.setItem('loggedUser', JSON.stringify(currentUser));
            alert("Senha alterada com sucesso!");
            fecharAuthModal();
        }
    } catch(e) { alert("Erro de rede ao trocar senha."); } 
    finally { btn.innerText = "Atualizar Senha"; btn.disabled = false; }
}

async function toggleFavorito(itemTitle, iconElement, reloadFavs = false) {
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
    localStorage.setItem('loggedUser', JSON.stringify(currentUser)); 
    if(reloadFavs) switchTab('favs');
    
    // Salva direto no Firebase
    if(currentUser.key) {
        try { 
            await fetch(`${FIREBASE_URL}users/${currentUser.key}.json`, { 
                method: 'PATCH', 
                headers: { "Content-Type": "application/json" }, 
                body: JSON.stringify({ favorito: currentUser.favorito }) 
            }); 
        } catch(e) {}
    }
}

function fazerLogout() {
    if(confirm("Tem certeza que deseja sair?")) {
        currentUser = null; 
        localStorage.removeItem('loggedUser'); 
        fecharAuthModal(); 
        verificarAcesso(); 
        renderizarMenuEsquerdo(); 
        switchTab('todos'); 
        document.getElementById('btnAdminGlobal').style.display = 'none'; 
        window.location.href = 'index.html';
    }
}

function verificarAcesso() { 
    if(currentUser && currentUser.cargo === 'admin') document.getElementById('btnAdminGlobal').style.display = 'flex'; 
}

function toggleTheme() { 
    const body = document.body; 
    let newMode = body.getAttribute('data-theme') === 'light' ? 'dark' : 'light'; 
    body.setAttribute('data-theme', newMode); 
    localStorage.setItem('themePreference', newMode); 
    
    const frame = document.getElementById('app-frame');
    if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ type: 'THEME_CHANGED', theme: newMode }, '*');
    }
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
