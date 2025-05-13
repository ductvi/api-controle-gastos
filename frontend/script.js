const API_URL = 'http://localhost:3000';

// Elementos do DOM
const elements = {
  registerForm: document.getElementById('registerForm'),
  loginForm: document.getElementById('loginForm'),
  registerEmail: document.getElementById('registerEmail'),
  registerPassword: document.getElementById('registerPassword'),
  loginEmail: document.getElementById('loginEmail'),
  loginPassword: document.getElementById('loginPassword'),
  registerMessage: document.getElementById('registerMessage'),
  loginMessage: document.getElementById('loginMessage')
};

// Event Listeners
if (elements.registerForm) {
  elements.registerForm.addEventListener('submit', handleRegister);
}

if (elements.loginForm) {
  elements.loginForm.addEventListener('submit', handleLogin);
}

// Função de Registro
async function handleRegister(e) {
  e.preventDefault();
  
  const email = elements.registerEmail.value.trim();
  const password = elements.registerPassword.value;

  // Validação básica
  if (!validateEmail(email)) {
    showMessage('registerMessage', 'Por favor, insira um email válido', 'error');
    return;
  }

  if (password.length < 6) {
    showMessage('registerMessage', 'A senha deve ter pelo menos 6 caracteres', 'error');
    return;
  }

  try {
    toggleLoading(true, 'registerForm');
    
    const res = await fetch(`${API_URL}/api/usuarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha: password })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Erro ao registrar');
    }

    showMessage('registerMessage', 'Registrado com sucesso! Redirecionando...', 'success');
    
    // Limpa o formulário e redireciona após 2 segundos
    elements.registerForm.reset();
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 2000);
    
  } catch (error) {
    console.error('Erro no registro:', error);
    showMessage('registerMessage', error.message || 'Erro ao registrar', 'error');
  } finally {
    toggleLoading(false, 'registerForm');
  }
}

// Função de Login
async function handleLogin(e) {
  e.preventDefault();
  
  const email = elements.loginEmail.value.trim();
  const password = elements.loginPassword.value;

  if (!validateEmail(email)) {
    showMessage('loginMessage', 'Por favor, insira um email válido', 'error');
    return;
  }

  try {
    toggleLoading(true, 'loginForm');
    
    const res = await fetch(`${API_URL}/api/usuarios/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha: password })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Credenciais inválidas');
    }

    if (data.token) {
      localStorage.setItem('token', data.token);
      showMessage('loginMessage', 'Login realizado com sucesso! Redirecionando...', 'success');
      
      // Redireciona após breve delay
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1500);
    } else {
      throw new Error('Token não recebido');
    }
    
  } catch (error) {
    console.error('Erro no login:', error);
    showMessage('loginMessage', error.message || 'Erro ao fazer login', 'error');
  } finally {
    toggleLoading(false, 'loginForm');
  }
}

// Funções auxiliares
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function showMessage(elementId, message, type) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  element.textContent = message;
  element.className = `message ${type}`;
  
  // Limpa a mensagem após 5 segundos
  setTimeout(() => {
    if (element.textContent === message) {
      element.textContent = '';
      element.className = 'message';
    }
  }, 5000);
}

function toggleLoading(isLoading, formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  
  const button = form.querySelector('button[type="submit"]');
  if (!button) return;
  
  if (isLoading) {
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> Carregando...';
  } else {
    button.disabled = false;
    if (formId === 'registerForm') {
      button.textContent = 'Registrar';
    } else {
      button.textContent = 'Login';
    }
  }
}

// Verifica autenticação ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  const isLoginPage = window.location.pathname.includes('login.html');
  const isRegisterPage = window.location.pathname.includes('register.html');
  
  // Se já estiver autenticado, redireciona para o dashboard
  if (token && (isLoginPage || isRegisterPage)) {
    window.location.href = 'dashboard.html';
  }
});