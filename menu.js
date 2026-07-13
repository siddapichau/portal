// menu.js - Controle Global do Menu, Cabeçalho e Autenticação

let currentUserRole = 'guest'; // Roles: guest, view, editor, admin

async function carregarMenuGlobal() {
    const baseHTML = `
        <!-- BARRA SUPERIOR -->
        <div class="top-bar-wrapper">
            <div class="nav-left">
                <button class="btn-minimal" onclick="toggleMenu()" id="btn-hamb">
                    <svg viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                </button>
                <img src="https://upload.wikimedia.org/wikipedia/pt/0/04/Logotipo_MercadoLivre.png" alt="Mercado Livre" class="ml-logo" onclick="window.location.href='index.html'">
            </div>
            
            <div class="nav-right">
                <!-- Botão Upload (Restrito) -->
                <button class="btn-minimal" id="btnUploadGlobal" style="display: none;" title="Subir Arquivo">
                    <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                </button>
                <!-- Botão Tema (Lua/Sol) -->
                <button class="btn-minimal" onclick="toggleTheme()" title="Alternar Tema">
                    <svg id="themeIconSvg" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                </button>
                <!-- Botão Login (Usuário) -->
                <button class="btn-minimal" onclick="abrirLoginModal()" title="Login">
                    <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </button>
            </div>
        </div>

        <!-- MENU LATERAL DA SIDEBAR MANTIDO IGUAL AO ANTERIOR... -->
        <div id="global-sidebar" class="sidebar">
            <div class="sidebar-links" id="sidebar-links-container"></div>
        </div>

        <!-- POP-UP DE LOGIN/REGISTRO -->
        <div class="auth-modal" id="loginModal">
            <div class="auth-box">
                <h2 id="modalTitle">Acesso ao Sistema</h2>
                <input type="text" id="authUser" placeholder="E-mail ou Usuário">
                <input type="password" id="authPass" placeholder="Senha">
                <button class="btn-auth" onclick="autenticarUsuario()" id="authBtn">Entrar</button>
                <div class="auth-toggle" onclick="toggleModoAuth()">Não tem conta? Registre-se (Cargo View)</div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('afterbegin', baseHTML);
    // Lógica para puxar o menu do Firebase permanece a mesma...
}

// Lógica Visual do Tema
function toggleTheme() {
    const body = document.body;
    let newMode = body.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    body.setAttribute('data-theme', newMode);
    localStorage.setItem('themePreference', newMode);
    const svg = document.getElementById('themeIconSvg');
    if(newMode === 'light') {
        svg.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>'; // Lua
    } else {
        svg.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>'; // Sol
    }
}

// Lógica de Autenticação (Simulando Planilha)
let modoRegistro = false;
function abrirLoginModal() { document.getElementById('loginModal').classList.add('active'); }
function fecharLoginModal() { document.getElementById('loginModal').classList.remove('active'); }

function toggleModoAuth() {
    modoRegistro = !modoRegistro;
    document.getElementById('modalTitle').innerText = modoRegistro ? "Registrar Nova Conta" : "Acesso ao Sistema";
    document.getElementById('authBtn').innerText = modoRegistro ? "Registrar" : "Entrar";
    document.querySelector('.auth-toggle').innerText = modoRegistro ? "Já tem conta? Faça Login" : "Não tem conta? Registre-se (Cargo View)";
}

function autenticarUsuario() {
    const user = document.getElementById('authUser').value;
    // Aqui no futuro você conecta com sua planilha via Fetch API. Por enquanto simulamos:
    if(modoRegistro) {
        alert("Registrado com sucesso! Seu cargo inicial é 'View'.");
        currentUserRole = 'view';
    } else {
        if(user === "admin") currentUserRole = 'admin';
        else if(user === "editor") currentUserRole = 'editor';
        else currentUserRole = 'view';
        alert(`Logado com sucesso! Nível de acesso: ${currentUserRole}`);
    }
    
    // Atualiza permissões na tela
    if(currentUserRole === 'editor' || currentUserRole === 'admin') {
        document.getElementById('btnUploadGlobal').style.display = 'flex';
    }
    fecharLoginModal();
}

document.addEventListener("DOMContentLoaded", () => { carregarMenuGlobal(); });
