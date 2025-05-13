require('dotenv').config();
const express = require('express');
const path = require('path');
const { body, validationResult } = require('express-validator');
const Database = require('better-sqlite3');
const db = new Database(process.env.DB_FILE || 'banco_de_dados.db');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Importando middlewares
const { validacoesTransacao, verificarToken, tratarErrosValidacao } = require('./middlewares');

// inicializa o app
const app = express();
const port = process.env.PORT || 3000;

// configurar os middlewares
app.use(cors({
    origin: '*', // Permite todas as origens (apenas para desenvolvimento!)
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Criação das tabelas
function criarTabelas() {
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS transacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        descricao TEXT,
        valor REAL,
        data TEXT,
        categoria TEXT,
        usuario_id INTEGER
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        senha TEXT
      )
    `).run();
    console.log('Tabelas verificadas/criadas com sucesso!');
  } catch (err) {
    console.error('Erro ao criar tabelas:', err);
  }
}
criarTabelas();

// Função para registrar um novo usuário no sistema
async function registrarUsuario(req, res) {
  const { email, senha } = req.body;
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    const stmt = db.prepare('INSERT INTO usuarios (email, senha) VALUES (?, ?)');
    stmt.run(email, senhaHash);
    res.status(201).json({ message: 'Usuário criado com sucesso' });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ message: 'Email já cadastrado' });
    }
    console.error('Erro ao registrar usuário:', error);
    res.status(500).json({ message: 'Erro ao registrar usuário' });
  }
}

// Função para autenticar um usuário e gerar um token JWT
async function loginUsuario(req, res) {
  const { email, senha } = req.body;
  
  try {
    const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
    if (!usuario) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    const token = jwt.sign({ id: usuario.id }, process.env.JWT_SECRET || 'seuSegredoSuperSecreto', { expiresIn: '1h' });
    res.json({ token });
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    res.status(500).json({ message: 'Erro ao fazer login' });
  }
}

// Rotas públicas
app.post('/api/usuarios', [
  body('email').isEmail().withMessage('Email inválido'),
  body('senha').isLength({ min: 6 }).withMessage('Senha deve ter pelo menos 6 caracteres')
], registrarUsuario);

app.post('/api/usuarios/login', loginUsuario);

// Rotas protegidas
app.use('/api', verificarToken);

// Rota para buscar transações com filtros e paginação
app.get('/api/transacoes', (req, res) => {
  const { categoria, dataInicio, dataFim, valorMinimo, valorMaximo, page = 1, limit = 10 } = req.query;

  let query = 'SELECT * FROM transacoes WHERE usuario_id = ?';
  const params = [req.usuario.id];

  if (categoria) {
    query += ' AND categoria = ?';
    params.push(categoria);
  }
  if (dataInicio) {
    query += ' AND data >= ?';
    params.push(dataInicio);
  }
  if (dataFim) {
    query += ' AND data <= ?';
    params.push(dataFim);
  }
  if (valorMinimo) {
    query += ' AND valor >= ?';
    params.push(Number(valorMinimo));
  }
  if (valorMaximo) {
    query += ' AND valor <= ?';
    params.push(Number(valorMaximo));
  }

  const offset = (page - 1) * limit;
  query += ' LIMIT ? OFFSET ?';
  params.push(Number(limit), offset);

  try {
    const transacoes = db.prepare(query).all(...params);
    const total = db.prepare('SELECT COUNT(*) as total FROM transacoes WHERE usuario_id = ?').get(req.usuario.id).total;

    res.json({
      transacoes,
      paginacao: {
        pagina: Number(page),
        limite: Number(limit),
        total,
        totalPaginas: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erro ao buscar transações:', error);
    res.status(500).json({ message: 'Erro ao buscar transações' });
  }
});

// Rota corrigida
app.post('/api/transacoes', 
  validacoesTransacao,
  tratarErrosValidacao,
  (req, res) => {
    try {
      // Não modifique mais o valor aqui - use exatamente o que o frontend enviou
      const { descricao, valor, data, categoria } = req.body;

      const stmt = db.prepare(`
        INSERT INTO transacoes (descricao, valor, data, categoria, usuario_id)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      const info = stmt.run(
        descricao,
        valor, // Valor já ajustado pelo frontend
        data,
        categoria,
        req.usuario.id
      );

      const novaTransacao = db.prepare('SELECT * FROM transacoes WHERE id = ?').get(info.lastInsertRowid);
      
      // Adicione logs para debug
      console.log('Nova transação criada:', {
        id: info.lastInsertRowid,
        valorInserido: valor,
        tipo: categoria
      });
      
      res.status(201).json(novaTransacao);

    } catch (error) {
      console.error('Erro no banco de dados:', error);
      res.status(500).json({ 
        message: 'Erro ao criar transação',
        error: error.message
      });
    }
  }
);

// Rota para buscar uma transação específica pelo ID
app.get('/api/transacoes/:id', (req, res) => {
  try {
    const transacao = db.prepare('SELECT * FROM transacoes WHERE id = ? AND usuario_id = ?')
      .get(req.params.id, req.usuario.id);

    if (transacao) {
      res.json(transacao);
    } else {
      res.status(404).json({ message: 'Transação não encontrada' });
    }
  } catch (error) {
    console.error('Erro ao buscar transação:', error);
    res.status(500).json({ message: 'Erro ao buscar transação' });
  }
});

// Rota para atualizar uma transação existente
app.put('/api/transacoes/:id', validacoesTransacao, (req, res) => {
  try {
    const stmt = db.prepare(`
      UPDATE transacoes SET 
        descricao = ?, 
        valor = ?, 
        data = ?, 
        categoria = ?
      WHERE id = ? AND usuario_id = ?
    `);
    const info = stmt.run(
      req.body.descricao,
      req.body.valor,
      req.body.data,
      req.body.categoria,
      req.params.id,
      req.usuario.id
    );

    if (info.changes > 0) {
      const transacaoAtualizada = db.prepare('SELECT * FROM transacoes WHERE id = ?').get(req.params.id);
      res.json(transacaoAtualizada);
    } else {
      res.status(404).json({ message: 'Transação não encontrada ou não pertence a este usuário' });
    }
  } catch (error) {
    console.error('Erro ao atualizar transação:', error);
    res.status(500).json({ message: 'Erro ao atualizar transação' });
  }
});

// Rota para deletar uma transação específica
app.delete('/api/transacoes/:id', (req, res) => {
  try {
    const info = db.prepare('DELETE FROM transacoes WHERE id = ? AND usuario_id = ?')
      .run(req.params.id, req.usuario.id);

    if (info.changes > 0) {
      res.json({ message: 'Transação removida com sucesso' });
    } else {
      res.status(404).json({ message: 'Transação não encontrada ou não pertence a este usuário' });
    }
  } catch (error) {
    console.error('Erro ao remover transação:', error);
    res.status(500).json({ message: 'Erro ao remover transação' });
  }
});

// Rota para calcular o saldo total do usuário (receitas, despesas e saldo)
app.get('/api/saldo', (req, res) => {
  try {
    const resultado = db.prepare(`
      SELECT 
        SUM(CASE WHEN categoria = 'Receita' THEN valor ELSE 0 END) AS receitas,
        SUM(CASE WHEN categoria = 'Despesa' THEN valor ELSE 0 END) AS despesas,
        SUM(valor) AS saldo
      FROM transacoes
      WHERE usuario_id = ?
    `).get(req.usuario.id);

    res.json({
      receitas: resultado.receitas || 0,
      despesas: resultado.despesas || 0,
      saldo: resultado.saldo || 0
    });
  } catch (error) {
    console.error('Erro ao calcular saldo:', error);
    res.status(500).json({ message: 'Erro ao calcular saldo' });
  }
});

// Rota para gerar um relatório agrupado por categorias
app.get('/api/relatorio/categorias', (req, res) => {
  try {
    const relatorio = db.prepare(`
      SELECT 
        categoria, 
        SUM(valor) AS total,
        COUNT(*) AS quantidade
      FROM transacoes
      WHERE usuario_id = ?
      GROUP BY categoria
    `).all(req.usuario.id);

    res.json(relatorio);
  } catch (error) {
    console.error('Erro ao gerar relatório por categoria:', error);
    res.status(500).json({ message: 'Erro ao gerar relatório' });
  }
});

// Rota para gerar um relatório mensal com base no mês e ano fornecidos
app.get('/api/relatorio/mensal', (req, res) => {
  try {
    const { mes, ano } = req.query;
    if (!mes || !ano) {
      return res.status(400).json({ message: 'Mês e ano são obrigatórios' });
    }

    const mesFormatado = mes.toString().padStart(2, '0');
    const transacoes = db.prepare(`
      SELECT * FROM transacoes
      WHERE usuario_id = ? 
        AND strftime('%m', data) = ? 
        AND strftime('%Y', data) = ?
      ORDER BY data DESC
    `).all(req.usuario.id, mesFormatado, ano);

    res.json(transacoes);
  } catch (error) {
    console.error('Erro ao gerar relatório mensal:', error);
    res.status(500).json({ message: 'Erro ao gerar relatório' });
  }
});

// Middleware para tratar erros internos do servidor
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Erro interno no servidor' });
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
