// ====== SUA URL DO GOOGLE APPS SCRIPT ======
const APP_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwATV05zjehqTqkXjCRWCaQ9Kp7Y6gN19IJ7IdHtcEK9vflhWAkhSyMdEBG_uB8BN0SYA/exec";
const FIREBASE_URL = "https://reportes-bdb0a-default-rtdb.firebaseio.com/";

let menuData = { categorias: [] };
let currentUser = JSON.parse(localStorage.getItem('loggedUser')) || null;

async function carregarMenuGlobal() {
    const baseHTML = `
        <div class="top-bar-wrapper">
            <div class="nav-left">
                <button class="btn-hamb" onclick="toggleMenu()" title="Menu"><span></span><span></span><span></span></button>
                <img src="https://upload.wikimedia.org/wikipedia/pt/0/04/Logotipo_MercadoLivre.png" alt="Mercado Livre" class="ml-logo" onclick="window.location.href='index.html'">
            </div>
            <div class="nav-right">
                <button class="btn-minimal" id="btnAdminGlobal" style="display:none;" onclick="window.location.href='admin.html'" title="Admin">⚙️</button>
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
            <!-- CAIXA DE LOGIN -->
            <div class="auth-box" id="loginBox">
                <h2>Acesso ao Portal</h2>
                <input type="text" id="logUser" placeholder="Usuário">
                <div class="input-group"><input type="password" id="logPass" placeholder="Senha"><span class="eye-icon" onclick="togglePass('logPass')">👁️</span></div>
                <button class="btn-auth" onclick="fazerLogin()">Entrar</button>
                <div class="auth-toggle" onclick="mudarAuthModo('register')">Não tem conta? Solicite Acesso</div>
            </div>

            <!-- CAIXA DE REGISTRO -->
            <div class="auth-box" id="registerBox" style="display:none;">
                <h2>Registrar</h2>
                <input type="text" id="regUser" placeholder="Usuário"><input type="email" id="regEmail" placeholder="E-mail">
                <div class="input-group"><input type="password" id="regPass1" placeholder="Senha (8 a 16 caract.)"><span class="eye-icon" onclick="togglePass('regPass1')">👁️</span></div>
                <div class="input-group"><input type="password" id="regPass2" placeholder="Confirmar Senha"><span class="eye-icon" onclick="togglePass('regPass2')">👁️</span></div>
                <button class="btn-auth" style="background:var(--accent-green);" onclick="fazerRegistro()">Registrar</button>
                <div class="auth-toggle" onclick="mudarAuthModo('login')">Já possui conta? Entrar</div>
            </div>

            <!-- CAIXA DE PERFIL (NOVO) -->
            <div class="auth-box" id="profileBox" style="display:none; max-width: 450px;">
                <h2 style="margin-bottom: 5px; color: var(--text-title);">Meu Perfil</h2>
                <div id="profileInfo" style="margin-bottom: 15px; color: var(--text-muted); font-size: 0.9rem; text-align: left; background: var(--bg-body); padding: 10px; border-radius: 6px; border: 1px solid var(--border-card);"></div>
                
                <div style="text-align: left; margin-bottom: 20px; background: var(--bg-body); padding: 10px; border-radius: 6px; border: 1px solid var(--border-card); max-height: 120px; overflow-y: auto;">
                    <strong style="color: var(--text-title); font-size: 0.9rem;">Páginas liberadas para você:</strong>
                    <ul id="profilePages" style="list-style: none; padding: 0; margin-top: 5px; font-size: 0.85rem; color: var(--text-main);"></ul>
                </div>

                <div style="text-align: left; margin-bottom: 15px;">
                    <strong style="color: var(--text-title); font-size: 0.9rem;">Trocar Senha</strong>
                    <div class="input-group" style="margin-top: 5px;">
                        <input type="password" id="profPassCurrent" placeholder="Senha Atual">
                        <span class="eye-icon" onclick="togglePass('profPassCurrent')">👁️</span>
                    </div>
                    <div class="input-group">
                        <input type="password" id="profPassNew1" placeholder="Nova Senha (8-16 caract.)">
                        <span class="eye-icon" onclick="togglePass('profPassNew1')">👁️</span>
                    </div>
                    <div class="input-group" style="margin-bottom: 5px;">
                        <input type="password" id="profPassNew2" placeholder="Confirmar Nova Senha">
                        <span class="eye-icon" onclick="togglePass('profPassNew2')">👁️</span>
                    </div>
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

    // Fecha o modal ao clicar fora da caixa
    document.getElementById('authModal').addEventListener('click', function(e) {
        if(e.target === this) fecharAuthModal();
    });
}

function temPermissao(rolesStr) {
    if(!rolesStr) return true; 
    let roles = rolesStr.split(',').map(r => r.trim().toLowerCase());
    let userRole = currentUser && currentUser.cargo ? currentUser.cargo.toLowerCase() : 'view';
    if (!currentUser && roles.includes('view')) return true;
    return roles.includes(userRole);
}

function toggleMenu() {
    document.querySelector('.sidebar-wrapper').classList.toggle('open');
    document.querySelector('.sidebar-overlay').classList.toggle('active');
}

function abrirPagina(url, titulo) {
    if(!url || url === '#') return;
    const isIndex = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';
    if (isIndex) {
        document.getElementById('home-view').style.display = 'none';
        document.getElementById('quote-box').style.display = 'none';
        document.getElementById('page-title').style.display = 'none';
        const frame = document.getElementById('app-frame');
        frame.style.display = 'block';
        frame.src = url;
        toggleMenu(); 
    } else {
        window.location.href = url;
    }
}

function renderizarMenuEsquerdo() {
    const container = document.getElementById('cat-list-container');
    container.innerHTML = '';
    menuData.categorias.forEach((cat, idx) => {
        if(temPermissao(cat.viewRoles)) {
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
    (menuData.categorias[catIdx].items || []).forEach(item => {
        if(temPermissao(item.viewRoles)) {
            const isFav = userFavs.includes(item.title);
            html += `
                <div class="subitem-link">
                    <div onclick="abrirPagina('${item.url}', '${item.title}')" style="cursor:pointer; flex:1; display:flex; gap:10px; align-items:center;">
                        <span>${item.icon || '📄'}</span> 
                        <div><div style="color:var(--text-title);">${item.title}</div><div style="font-size:0.75rem; color:var(--text-muted); font-weight:400;">${item.desc || ''}</div></div>
                    </div>
                    <span class="fav-star ${isFav ? 'active' : ''}" onclick="toggleFavorito('${item.title}', this)">★</span>
                </div>
            `;
        }
    });
    panel.innerHTML = html || '<div style="padding:20px;">Nenhum item disponível para o seu nível de acesso.</div>';
}

function switchTab(tab) {
    document.getElementById('tab-todos').classList.remove('active');
    document.getElementById('tab-favs').classList.remove('active');
    document.getElementById('tab-' + tab).classList.add('active');
    const panel = document.getElementById('subitem-panel');
    if(tab === 'todos') {
        renderizarMenuEsquerdo();
        panel.innerHTML = '<div style="padding: 20px; color: var(--text-muted); text-align:center;">Passe o mouse em uma categoria</div>';
    } else {
        document.getElementById('cat-list-container').innerHTML = '<div style="padding:20px; color:#aaa; font-size:0.85rem;">Exibindo seus favoritos...</div>';
        panel.classList.add('active');
        if(!currentUser) return panel.innerHTML = '<div style="padding:20px; text-align:center;">Faça login para ver favoritos.</div>';
        
        let userFavs = currentUser.favorito ? currentUser.favorito.split(',') : [];
        let favHtml = '';
        menuData.categorias.forEach(cat => {
            if(temPermissao(cat.viewRoles)) {
                (cat.items || []).forEach(item => {
                    if(temPermissao(item.viewRoles) && userFavs.includes(item.title)) {
                        favHtml += `
                        <div class="subitem-link">
                            <div onclick="abrirPagina('${item.url}', '${item.title}')" style="cursor:pointer; flex:1; display:flex; gap:10px; align-items:center;">
                                <span>${item.icon || '📄'}</span> 
                                <div><div style="color:var(--text-title);">${item.title}</div><div style="font-size:0.75rem; color:var(--text-muted); font-weight:400;">${cat.category}</div></div>
                            </div>
                            <span class="fav-star active" onclick="toggleFavorito('${item.title}', this, true)">★</span>
                        </div>`;
                    }
                });
            }
        });
        panel.innerHTML = favHtml || '<div style="padding:20px; text-align:center;">Nenhum favorito ainda.</div>';
    }
}

// ==== SISTEMA DE MODAL INTELIGENTE ====
function abrirAuthModal() { 
    document.getElementById('authModal').classList.add('active'); 
    if(currentUser) {
        mudarAuthModo('profile');
        carregarPerfil();
    } else {
        mudarAuthModo('login');
    }
}

function fecharAuthModal() { document.getElementById('authModal').classList.remove('active'); }

function mudarAuthModo(modo) { 
    document.getElementById('loginBox').style.display = modo === 'login' ? 'block' : 'none'; 
    document.getElementById('registerBox').style.display = modo === 'register' ? 'block' : 'none'; 
    document.getElementById('profileBox').style.display = modo === 'profile' ? 'block' : 'none';
}

function togglePass(id) { const el = document.getElementById(id); el.type = el.type === 'password' ? 'text' : 'password'; }

function carregarPerfil() {
    document.getElementById('profileInfo').innerHTML = `
        <strong>Usuário:</strong> ${currentUser.usuario} <br> 
        <strong>E-mail:</strong> ${currentUser.email} <br> 
        <strong>Nível de Acesso:</strong> <span style="text-transform: uppercase; color: var(--accent-blue); font-weight:bold;">${currentUser.cargo}</span>
    `;
    
    let ul = document.getElementById('profilePages');
    ul.innerHTML = '';
    menuData.categorias.forEach(cat => {
        if(temPermissao(cat.viewRoles)) {
            (cat.items || []).forEach(item => {
                if(temPermissao(item.viewRoles)) {
                    ul.innerHTML += `<li style="padding:3px 0;">✔️ ${item.title} <span style="color:#aaa; font-size:0.75rem;">(${cat.category})</span></li>`;
                }
            });
        }
    });
    if(ul.innerHTML === '') ul.innerHTML = '<li>Nenhuma página liberada.</li>';
}

async function trocarSenha() {
    const currentPass = document.getElementById('profPassCurrent').value;
    const newPass1 = document.getElementById('profPassNew1').value;
    const newPass2 = document.getElementById('profPassNew2').value;

    if(!currentPass || !newPass1 || !newPass2) return alert("Preencha todos os campos de senha.");
    if(newPass1.length < 8 || newPass1.length > 16) return alert("A nova senha deve ter entre 8 e 16 caracteres.");
    if(newPass1 !== newPass2) return alert("As novas senhas não coincidem!");

    const btn = document.getElementById('btnUpdatePass');
    btn.innerText = "⏳ Atualizando..."; btn.disabled = true;

    try {
        const res = await fetch(APP_SCRIPT_URL, {
            method: 'POST', headers: { "Content-Type": "text/plain;charset=utf-8" }, redirect: "follow",
            body: JSON.stringify({ action: "changePassword", usuario: currentUser.usuario, senhaAtual: currentPass, novaSenha: newPass1 })
        });
        const data = await res.json();
        alert(data.message);
        if(data.success) {
            currentUser.senha = newPass1;
            localStorage.setItem('loggedUser', JSON.stringify(currentUser));
            document.getElementById('profPassCurrent').value = '';
            document.getElementById('profPassNew1').value = '';
            document.getElementById('profPassNew2').value = '';
        }
    } catch(e) { alert("Erro ao comunicar com o servidor."); } finally { btn.innerText = "Atualizar Senha"; btn.disabled = false; }
}

function fazerLogout() {
    if(confirm("Tem certeza que deseja sair da sua conta?")) {
        currentUser = null;
        localStorage.removeItem('loggedUser');
        fecharAuthModal();
        verificarAcesso();
        renderizarMenuEsquerdo();
        switchTab('todos');
        document.getElementById('btnAdminGlobal').style.display = 'none'; // Esconde botão admin
        alert("Você saiu com sucesso.");
    }
}

async function fazerRegistro() {
    const user = document.getElementById('regUser').value.trim(); const email = document.getElementById('regEmail').value.trim(); const p1 = document.getElementById('regPass1').value; const p2 = document.getElementById('regPass2').value;
    if(!user || !email) return alert("Preencha Usuário e E-mail.");
    if(p1.length < 8 || p1.length > 16) return alert("A senha deve ter entre 8 e 16 caracteres.");
    if(p1 !== p2) return alert("As senhas não coincidem!");
    const btn = document.querySelector('#registerBox .btn-auth'); btn.innerText = "⏳ Registrando..."; btn.disabled = true;
    try {
        const res = await fetch(APP_SCRIPT_URL, { method: 'POST', headers: { "Content-Type": "text/plain;charset=utf-8" }, redirect: "follow", body: JSON.stringify({ action: "register", usuario: user, email: email, senha: p1 }) });
        const data = await res.json(); alert(data.message); if(data.success) mudarAuthModo('login');
    } catch(e) { alert("Erro ao conectar."); } finally { btn.innerText = "Registrar"; btn.disabled = false; }
}

async function fazerLogin() {
    const user = document.getElementById('logUser').value.trim(); const pass = document.getElementById('logPass').value;
    if(!user || !pass) return alert("Preencha todos os campos.");
    const btn = document.querySelector('#loginBox .btn-auth'); btn.innerText = "⏳ Validando..."; btn.disabled = true;
    try {
        const res = await fetch(APP_SCRIPT_URL, { method: 'POST', headers: { "Content-Type": "text/plain;charset=utf-8" }, redirect: "follow", body: JSON.stringify({ action: "login", usuario: user, senha: pass }) });
        const data = await res.json();
        if(!data.success) { alert(data.message); } else {
            if(data.user.solicitacao === "pendente") alert("Seu acesso ainda está pendente de aprovação!");
            else if(data.user.solicitacao === "bloqueado") alert("Seu acesso foi bloqueado pelo administrador.");
            else {
                currentUser = data.user; localStorage.setItem('loggedUser', JSON.stringify(currentUser)); 
                fecharAuthModal(); verificarAcesso(); renderizarMenuEsquerdo(); switchTab('todos');
            }
        }
    } catch(e) { alert("Erro ao conectar."); } finally { btn.innerText = "Entrar"; btn.disabled = false; }
}

async function toggleFavorito(itemTitle, iconElement, reloadFavs = false) {
    if(!currentUser) return alert("Faça login para favoritar!");
    let favs = currentUser.favorito ? currentUser.favorito.split(',').filter(f => f) : [];
    if(favs.includes(itemTitle)) { favs = favs.filter(f => f !== itemTitle); iconElement.classList.remove('active'); } 
    else { favs.push(itemTitle); iconElement.classList.add('active'); }
    currentUser.favorito = favs.join(','); localStorage.setItem('loggedUser', JSON.stringify(currentUser));
    if(reloadFavs) switchTab('favs');
    try { await fetch(APP_SCRIPT_URL, { method: 'POST', headers: { "Content-Type": "text/plain;charset=utf-8" }, redirect: "follow", body: JSON.stringify({ action: "updateFav", usuario: currentUser.usuario, favoritos: currentUser.favorito }) }); } catch(e) {}
}

function verificarAcesso() { if(currentUser && currentUser.cargo === 'admin') document.getElementById('btnAdminGlobal').style.display = 'flex'; }
function toggleTheme() { const body = document.body; let newMode = body.getAttribute('data-theme') === 'light' ? 'dark' : 'light'; body.setAttribute('data-theme', newMode); localStorage.setItem('themePreference', newMode); }
document.addEventListener("DOMContentLoaded", () => { if (localStorage.getItem('themePreference') === 'dark') document.body.setAttribute('data-theme', 'dark'); carregarMenuGlobal(); });
