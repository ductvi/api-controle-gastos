document.addEventListener('DOMContentLoaded', function() {
  // Verifica autenticação
  if (!isTokenValid()) {
    window.location.href = '/login.html';
    return;
  }

  // Carrega todos os dados
  carregarUsuario();
  carregarSaldo();
  carregarTransacoes();

  // Configura logout
  document.getElementById('logoutBtn').addEventListener('click', logout);
});

// ==================== FUNÇÕES PRINCIPAIS ====================

/**
 * Verifica se o token é válido
 */
function isTokenValid() {
  const token = localStorage.getItem('token');
  if (!token || token.split('.').length !== 3) return false;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload && payload.id;
  } catch {
    return false;
  }
}

/**
 * Realiza logout do usuário
 */
function logout() {
  localStorage.removeItem('token');
  window.location.href = 'index.html';
}

/**
 * Carrega os dados do usuário logado
 */
function carregarUsuario() {
  if (!isTokenValid()) {
    logout();
    return;
  }

  try {
    const token = localStorage.getItem('token');
    const payload = JSON.parse(atob(token.split('.')[1]));
    document.getElementById('userEmail').textContent = `Usuário: ${payload.email || 'Conectado'}`;
  } catch (error) {
    console.error('Erro ao carregar usuário:', error);
    logout();
  }
}

// ==================== FUNÇÕES DE TRANSAÇÕES ====================

/**
 * Carrega o saldo do usuário
 */
async function carregarSaldo() {
  try {
    const response = await fetch('http://localhost:3000/api/saldo', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (!response.ok) throw new Error('Erro ao carregar saldo');

    const data = await response.json();
    document.getElementById('saldo').textContent = `R$ ${data.saldo.toFixed(2)}`;
    
    // Adiciona classe conforme o saldo (positivo/negativo)
    const saldoElement = document.getElementById('saldo');
    saldoElement.className = data.saldo >= 0 ? 'saldo-positivo' : 'saldo-negativo';
    
  } catch (error) {
    console.error('Erro:', error);
    showMessage('Erro ao carregar saldo', 'error');
  }
}

/**
 * Carrega as transações do usuário
 */
async function carregarTransacoes() {
  try {
    const response = await fetch('http://localhost:3000/api/transacoes', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (!response.ok) throw new Error('Erro ao carregar transações');

    const data = await response.json();
    renderizarTransacoes(data.transacoes);
  } catch (error) {
    console.error('Erro:', error);
    showMessage('Erro ao carregar transações', 'error');
  }
}

/**
 * Renderiza as transações na tela
 */
function renderizarTransacoes(transacoes) {
  const container = document.getElementById('transacoesContainer');
  container.innerHTML = '';

  if (!transacoes || transacoes.length === 0) {
    container.innerHTML = '<p class="sem-transacoes">Nenhuma transação encontrada</p>';
    return;
  }

  transacoes.forEach(transacao => {
    const transacaoElement = document.createElement('div');
    transacaoElement.className = 'transacao';
    transacaoElement.dataset.id = transacao.id;
    
    const valorClass = transacao.valor < 0 ? 'valor-negativo' : 'valor-positivo';
    const valorFormatado = Math.abs(transacao.valor).toFixed(2);
    const dataFormatada = formatarData(transacao.data);
    
    transacaoElement.innerHTML = `
      <div class="transacao-info">
        <p><strong>${transacao.descricao}</strong></p>
        <p>Valor: <span class="${valorClass}">R$ ${valorFormatado}</span></p>
        <p>Data: ${dataFormatada}</p>
        <p>Categoria: ${transacao.categoria}</p>
      </div>
      <div class="transacao-actions">
        <button class="btn-editar" data-id="${transacao.id}">Editar</button>
        <button class="btn-excluir" data-id="${transacao.id}">Excluir</button>
      </div>
    `;
    container.appendChild(transacaoElement);
  });

  adicionarEventListeners();
}

/**
 * Formata a data para exibição
 */
function formatarData(dataString) {
  try {
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR');
  } catch {
    return dataString; // Retorna o original se falhar
  }
}

// ==================== FORMULÁRIO DE TRANSAÇÃO ====================

/**
 * Configura o formulário de transação
 */
ddocument.getElementById('novaTransacaoForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  // 1. Obtenha os valores corretamente
  const descricao = document.getElementById('descricao').value.trim();
  const valor = Number(document.getElementById('valor').value); // Converta para número
  const data = document.getElementById('data').value;
  const categoria = document.getElementById('categoria').value;

  // 2. Validação reforçada
  if (!descricao || isNaN(valor) || !data || !categoria) {
    showMessage('Preencha todos os campos corretamente', 'error');
    return;
  }

  // 3. Prepare os dados garantindo tipos corretos
  const transacaoData = {
    descricao,
    valor: categoria === 'Despesa' ? -Math.abs(valor) : Math.abs(valor),
    data: new Date(data).toISOString().split('T')[0], // Formato ISO
    categoria
  };

  // 4. Debug: verifique os dados antes de enviar
  console.log('Dados preparados:', transacaoData);

  try {
    const response = await fetch('http://localhost:3000/api/transacoes', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(transacaoData)
    });

    // 5. Tratamento detalhado de erros
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Erro detalhado:', {
        status: response.status,
        error: errorData,
        dadosEnviados: transacaoData
      });
      throw new Error(errorData.message || 'Erro ao processar transação');
    }

    const resultado = await response.json();
    console.log('Sucesso:', resultado);
    
    showMessage('Transação criada com sucesso!', 'success');
    this.reset();
    carregarTransacoes();
    carregarSaldo();
    
  } catch (error) {
    console.error('Erro completo:', error);
    showMessage(`Falha: ${error.message}`, 'error');
  }
});

// Função auxiliar para formatar data
function formatarDataParaBackend(dataInput) {
  // Converte de YYYY-MM-DD (input date) para o formato esperado pelo backend
  return new Date(dataInput).toISOString().split('T')[0];
}

/**
 * Valida os dados do formulário
 */
function validarFormulario(descricao, valor, data, categoria) {
  if (!descricao || descricao.length < 3) {
    showMessage('Descrição deve ter pelo menos 3 caracteres', 'error');
    return false;
  }

  if (isNaN(valor)) { // Corrigido: adicionado parêntese de fechamento
    showMessage('Valor deve ser um número válido', 'error');
    return false;
  }

  if (!data) {
    showMessage('Selecione uma data válida', 'error');
    return false;
  }

  if (!['Receita', 'Despesa'].includes(categoria)) {
    showMessage('Selecione uma categoria válida', 'error');
    return false;
  }

  return true;
}

/**
 * Reseta o formulário após envio
 */
function resetarFormulario(isEditing) {
  const form = document.getElementById('novaTransacaoForm');
  form.reset();
  
  if (isEditing) {
    delete form.dataset.editando;
    form.querySelector('button[type="submit"]').textContent = 'Adicionar';
  }
}

// ==================== EDIÇÃO/EXCLUSÃO ====================

/**
 * Adiciona eventos aos botões de ação
 */
function adicionarEventListeners() {
  document.querySelectorAll('.btn-editar').forEach(btn => {
    btn.addEventListener('click', () => editarTransacao(btn.dataset.id));
  });

  document.querySelectorAll('.btn-excluir').forEach(btn => {
    btn.addEventListener('click', () => confirmarExclusao(btn.dataset.id));
  });
}

/**
 * Prepara o formulário para edição
 */
async function editarTransacao(id) {
  try {
    const response = await fetch(`http://localhost:3000/api/transacoes/${id}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (!response.ok) throw new Error('Erro ao carregar transação');

    const transacao = await response.json();
    const dataValue = transacao.data.includes('T') 
      ? transacao.data.split('T')[0] 
      : transacao.data;

    document.getElementById('descricao').value = transacao.descricao;
    document.getElementById('valor').value = Math.abs(transacao.valor);
    document.getElementById('data').value = dataValue;
    document.getElementById('categoria').value = transacao.categoria;

    const form = document.getElementById('novaTransacaoForm');
    form.dataset.editando = id;
    form.querySelector('button[type="submit"]').textContent = 'Atualizar';
    form.scrollIntoView({ behavior: 'smooth' });

  } catch (error) {
    console.error('Erro:', error);
    showMessage('Erro ao carregar transação para edição', 'error');
  }
}

/**
 * Confirma e executa a exclusão
 */
async function confirmarExclusao(id) {
  if (!confirm('Tem certeza que deseja excluir esta transação permanentemente?')) {
    return;
  }

  try {
    const response = await fetch(`http://localhost:3000/api/transacoes/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (!response.ok) throw new Error('Erro ao excluir transação');

    showMessage('Transação excluída com sucesso!', 'success');
    carregarTransacoes();
    carregarSaldo();
    
  } catch (error) {
    console.error('Erro:', error);
    showMessage('Erro ao excluir transação', 'error');
  }
}

// ==================== UTILITÁRIOS ====================

/**
 * Exibe mensagens para o usuário
 */
function showMessage(message, type = 'error') {
  const messageDiv = document.getElementById('messageContainer') || criarMessageContainer();
  
  messageDiv.textContent = message;
  messageDiv.className = `message ${type}`;
  
  setTimeout(() => {
    if (messageDiv.textContent === message) {
      messageDiv.textContent = '';
      messageDiv.className = 'message';
    }
  }, 5000);
}

/**
 * Cria container para mensagens se não existir
 */
function criarMessageContainer() {
  const div = document.createElement('div');
  div.id = 'messageContainer';
  div.className = 'message';
  div.style.position = 'fixed';
  div.style.top = '20px';
  div.style.right = '20px';
  div.style.padding = '15px';
  div.style.borderRadius = '5px';
  div.style.color = 'white';
  div.style.zIndex = '1000';
  document.body.appendChild(div);
  return div;
}