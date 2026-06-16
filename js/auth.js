import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const authForm = document.getElementById('auth-form');
const toggleAuthBtn = document.getElementById('toggle-auth');
const authBtn = document.getElementById('auth-btn');
const registerFields = document.getElementById('register-fields');
const confirmPasswordGroup = document.getElementById('confirm-password-group');

let isLogin = true;

// Função que vira a tela de Login para Cadastro
function toggleView() {
    isLogin = !isLogin;
    authBtn.textContent = isLogin ? 'Entrar' : 'Cadastrar';
    toggleAuthBtn.innerHTML = isLogin ? 'Não tem uma conta? <strong>Cadastre-se</strong>' : 'Já tem conta? <strong>Entre</strong>';
    registerFields.style.display = isLogin ? 'none' : 'block';
    confirmPasswordGroup.style.display = isLogin ? 'none' : 'block';
    document.getElementById('first-name').required = !isLogin;
    document.getElementById('last-name').required = !isLogin;
    document.getElementById('confirm-password').required = !isLogin;
}

if (toggleAuthBtn) {
    toggleAuthBtn.addEventListener('click', toggleView);
}

// Lógica de Leitura da URL (O Link Mágico do Nutri)
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'register' && isLogin) {
        toggleView(); // Vira a tela automaticamente para cadastro
    }
});

if (authForm) {
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        const originalBtnText = authBtn.textContent;
        authBtn.textContent = 'Aguarde...';
        authBtn.disabled = true;

        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                const confirmPassword = document.getElementById('confirm-password').value;
                const firstName = document.getElementById('first-name').value;
                const lastName = document.getElementById('last-name').value;
                const isNutri = document.getElementById('is-nutri').checked;

                if (password !== confirmPassword) throw new Error("As senhas não coincidem.");

                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                const role = isNutri ? 'nutri' : 'aluno';

                await setDoc(doc(db, "users", user.uid), {
                    firstName, lastName, email, role, goalWeight: null
                });

                alert("Conta criada com sucesso!");
            }
        } catch (error) {
            console.error(error);
            let errorMessage = "Erro na autenticação.";
            if (error.code === 'auth/email-already-in-use') errorMessage = "Este e-mail já está cadastrado.";
            if (error.code === 'auth/weak-password') errorMessage = "A senha deve ter pelo menos 6 caracteres.";
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') errorMessage = "E-mail ou senha incorretos.";
            
            alert(errorMessage);
            authBtn.textContent = originalBtnText;
            authBtn.disabled = false;
        }
    });
}

onAuthStateChanged(auth, async (user) => {
    const currentPage = window.location.pathname;

    if (user) {
        if (currentPage.includes('login.html') || currentPage.endsWith('/html/')) {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const role = userDoc.data().role;
                window.location.href = role === 'nutri' ? 'nutri-dashboard.html' : 'dashboard.html';
            }
        }
    } else {
        if (currentPage.includes('dashboard.html') || currentPage.includes('nutri-dashboard.html')) {
            window.location.href = 'login.html';
        }
    }
});