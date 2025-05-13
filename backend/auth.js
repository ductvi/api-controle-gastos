const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const db = new Database('banco_de_dados.db');

async function registrarUsuario(req, res) {
    const { email, senha } = req.body;

    // Verifica se o email já está cadastrado
    const usuarioExistente = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);

    if (usuarioExistente) {
        return res.status(400).json({ message: 'Email já cadastrado' });
    }

    try {
        // Criptografa a senha
        const senhaCriptografada = await bcrypt.hash(senha, 10);
        
        // Insere o novo usuário no banco de dados
        const stmt = db.prepare('INSERT INTO usuarios (email, senha) VALUES (?, ?)');
        stmt.run(email, senhaCriptografada);
        
        res.status(201).json({ message: 'Usuário registrado com sucesso' });
    } catch (error) {
        console.error('Erro ao registrar usuário:', error);
        res.status(500).json({ message: 'Erro ao registrar usuário' });
    }
}

async function loginUsuario(req, res) {
    const { email, senha } = req.body;

    try {
        // Busca o usuário no banco de dados
        const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
        if (!usuario) {
            return res.status(400).json({ message: 'Email ou senha inválidos' });
        }

        // Verifica a senha
        const senhaValida = await bcrypt.compare(senha, usuario.senha);
        if (!senhaValida) {
            return res.status(400).json({ message: 'Email ou senha inválidos' });
        }

        // Gera o token JWT
        const token = jwt.sign(
            { id: usuario.id, email: usuario.email },
            'secreta',
            { expiresIn: '1h' }
        );

        res.json({ token });
    } catch (error) {
        console.error('Erro ao fazer login:', error);
        res.status(500).json({ message: 'Erro ao fazer login' });
    }
}

module.exports = {
    registrarUsuario,
    loginUsuario
};