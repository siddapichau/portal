// ====== SUA URL DO GOOGLE APPS SCRIPT ======
const APP_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxDerQam4lmNYOSsBLpFRdAAjBvjzCVBSzINfpGdtVU-1cV9Y2DTP8ui_O58715vFJPtA/exec";

/* SISTEMA DE AUTH (Conectado à Planilha do Google) */
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

async function fazerRegistro() {
    const user = document.getElementById('regUser').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const p1 = document.getElementById('regPass1').value;
    const p2 = document.getElementById('regPass2').value;

    if(!user || !email) return alert("Preencha Usuário e E-mail.");
    if(p1.length < 8 || p1.length > 16) return alert("A senha deve ter entre 8 e 16 caracteres.");
    if(p1 !== p2) return alert("As senhas não coincidem!");

    const btn = document.querySelector('#registerBox .btn-auth');
    btn.innerText = "⏳ Registrando...";
    btn.disabled = true;

    try {
        const res = await fetch(APP_SCRIPT_URL, {
            method: 'POST',
            headers: {
                "Content-Type": "text/plain;charset=utf-8",
            },
            redirect: "follow",
            body: JSON.stringify({ action: "register", usuario: user, email: email, senha: p1 })
        });
        const data = await res.json();
        
        alert(data.message);
        if(data.success) mudarAuthModo('login');
    } catch(e) {
        alert("Erro ao conectar com a planilha. Verifique a permissão do Google Apps Script.");
        console.error(e);
    } finally {
        btn.innerText = "Registrar";
        btn.disabled = false;
    }
}

async function fazerLogin() {
    const user = document.getElementById('logUser').value.trim();
    const pass = document.getElementById('logPass').value;
    
    if(!user || !pass) return alert("Preencha todos os campos.");

    const btn = document.querySelector('#loginBox .btn-auth');
    btn.innerText = "⏳ Validando...";
    btn.disabled = true;

    try {
        const res = await fetch(APP_SCRIPT_URL, {
            method: 'POST',
            headers: {
                "Content-Type": "text/plain;charset=utf-8",
            },
            redirect: "follow",
            body: JSON.stringify({ action: "login", usuario: user, senha: pass })
        });
        const data = await res.json();

        if(!data.success) {
            alert(data.message);
        } else {
            if(data.user.solicitacao === "pendente") {
                alert("Seu acesso ainda está pendente de aprovação!");
            } else {
                currentUser = data.user;
                localStorage.setItem('loggedUser', JSON.stringify(currentUser)); 
                alert(`Bem-vindo, ${currentUser.usuario}! Cargo: ${currentUser.cargo}`);
                fecharAuthModal();
                verificarAcesso();
                switchTab('todos');
            }
        }
    } catch(e) {
        alert("Erro ao conectar com a planilha.");
        console.error(e);
    } finally {
        btn.innerText = "Entrar";
        btn.disabled = false;
    }
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

    try {
        await fetch(APP_SCRIPT_URL, {
            method: 'POST',
            headers: {
                "Content-Type": "text/plain;charset=utf-8",
            },
            redirect: "follow",
            body: JSON.stringify({ action: "updateFav", usuario: currentUser.usuario, favoritos: currentUser.favorito })
        });
    } catch(e) {
        console.error("Erro ao salvar favorito", e);
    }
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
