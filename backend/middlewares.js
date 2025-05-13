require('dotenv').config();
const { body, validationResult } = require('express-validator'); // Corrigido aqui
const jwt = require('jsonwebtoken');

// Middlewares para validação de dados
const validacoesTransacao = [
  body('descricao')
    .isString().withMessage('Descrição deve ser texto')
    .trim()
    .isLength({ min: 3 }).withMessage('Mínimo 3 caracteres'),
    
  body('valor')
    .isFloat().withMessage('Deve ser um número válido')
    .toFloat(), // Converte para float
    
  body('data')
    .isISO8601().withMessage('Formato de data inválido (YYYY-MM-DD)'),
    
  body('categoria')
    .isIn(['Receita', 'Despesa']).withMessage('Categoria inválida')
];

// Middleware para verificar token
function verificarToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Token não fornecido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'seuSegredoSuperSecreto');
    req.usuario = { id: decoded.id };
    next();
  } catch (error) {
    console.error('Erro ao verificar token:', error);
    res.status(401).json({ message: 'Token inválido' });
  }
}

const tratarErrosValidacao = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      errors: errors.array(),
      message: 'Erro de validação nos dados enviados'
    });
  }
  next();
};

module.exports = {
  validacoesTransacao,
  verificarToken,
  tratarErrosValidacao
};