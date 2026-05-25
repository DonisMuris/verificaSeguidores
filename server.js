const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const PATH_HISTORY = path.join(DATA_DIR, 'unfollowed_history.json');
const PATH_FOLLOWERS = path.join(DATA_DIR, 'cached_followers.json');
const PATH_FOLLOWING = path.join(DATA_DIR, 'cached_following.json');

// Garante a existência da pasta e dos arquivos iniciais
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(PATH_HISTORY)) fs.writeFileSync(PATH_HISTORY, JSON.stringify([]), 'utf8');
if (!fs.existsSync(PATH_FOLLOWERS)) fs.writeFileSync(PATH_FOLLOWERS, JSON.stringify([]), 'utf8');
if (!fs.existsSync(PATH_FOLLOWING)) fs.writeFileSync(PATH_FOLLOWING, JSON.stringify([]), 'utf8');

// Helper para ler arquivos de forma assíncrona
const responderComArquivo = (res, filePath) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Erro ao ler arquivo em disco.' }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(data);
    });
};

// Helper para salvar arquivos de forma assíncrona
const salvarDadosEmArquivo = (res, filePath, rawBody) => {
    try {
        const dados = JSON.parse(rawBody);
        fs.writeFile(filePath, JSON.stringify(dados, null, 2), 'utf8', (err) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Erro ao gravar arquivo em disco.' }));
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ success: true }));
        });
    } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Dados JSON inválidos.' }));
    }
};

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // ROTAS GET
    if (req.method === 'GET' && req.url === '/api/history') {
        responderComArquivo(res, PATH_HISTORY);
    } else if (req.method === 'GET' && req.url === '/api/followers') {
        responderComArquivo(res, PATH_FOLLOWERS);
    } else if (req.method === 'GET' && req.url === '/api/following') {
        responderComArquivo(res, PATH_FOLLOWING);
    }
    // ROTAS POST
    else if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            if (req.url === '/api/history') {
                salvarDadosEmArquivo(res, PATH_HISTORY, body);
            } else if (req.url === '/api/followers') {
                salvarDadosEmArquivo(res, PATH_FOLLOWERS, body);
            } else if (req.url === '/api/following') {
                salvarDadosEmArquivo(res, PATH_FOLLOWING, body);
            } else {
                res.writeHead(404);
                res.end();
            }
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(PORT, () => {
    console.log(`============= BACK-END SINCRONIZADO =============`);
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Armazenamento centralizado ativo na pasta /data`);
    console.log(`=================================================`);
});