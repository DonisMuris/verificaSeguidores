/**
 * Servidor local de persistência.
 *
 * Correções de segurança em relação à versão anterior:
 *  - Escuta só em 127.0.0.1 (antes: todas as interfaces da rede).
 *  - Sem `Access-Control-Allow-Origin: *`. Antes, qualquer site aberto no seu
 *    navegador podia ler sua lista de seguidores e sobrescrever seu histórico.
 *  - Serve o próprio front-end, o que elimina o CORS e a dependência do Live Server.
 *  - Limite de tamanho de corpo, validação de schema e escrita atômica.
 */

const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const HOST = '127.0.0.1';
const RAIZ = __dirname;
const DATA_DIR = path.join(RAIZ, 'data');
const PATH_SNAPSHOTS = path.join(DATA_DIR, 'snapshots.json');
const PATH_HISTORY = path.join(DATA_DIR, 'unfollowed_history.json');

const MAX_BODY = 32 * 1024 * 1024; // 32 MB
const MAX_SNAPSHOTS = 60;
const RE_USERNAME = /^[a-z0-9._]{1,30}$/;

/** Token de sessão: sem ele, nenhuma rota /api responde. Injetado no HTML. */
const TOKEN = crypto.randomBytes(24).toString('hex');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

fs.mkdirSync(DATA_DIR, { recursive: true });

const json = (res, status, payload) => {
    const corpo = JSON.stringify(payload);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(corpo),
        'X-Content-Type-Options': 'nosniff'
    });
    res.end(corpo);
};

/** Escrita atômica: grava em temporário e renomeia. Um crash no meio não corrompe o arquivo. */
const gravarAtomico = async (destino, dados) => {
    const temp = `${destino}.${process.pid}.tmp`;
    await fsp.writeFile(temp, JSON.stringify(dados, null, 2), 'utf8');
    await fsp.rename(temp, destino);
};

const lerJson = async (arquivo, padrao) => {
    try {
        return JSON.parse(await fsp.readFile(arquivo, 'utf8'));
    } catch {
        return padrao;
    }
};

/** Fila serial de escrita por arquivo — evita corrida entre POSTs concorrentes. */
const filas = new Map();
const enfileirar = (chave, tarefa) => {
    const anterior = filas.get(chave) ?? Promise.resolve();
    const atual = anterior.then(tarefa, tarefa);
    filas.set(chave, atual.catch(() => {}));
    return atual;
};

const lerCorpo = (req) =>
    new Promise((resolve, reject) => {
        let tamanho = 0;
        const partes = [];
        req.on('data', (chunk) => {
            tamanho += chunk.length;
            if (tamanho > MAX_BODY) {
                reject(Object.assign(new Error('Corpo grande demais.'), { status: 413 }));
                req.destroy();
                return;
            }
            partes.push(chunk);
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(Buffer.concat(partes).toString('utf8')));
            } catch {
                reject(Object.assign(new Error('JSON inválido.'), { status: 400 }));
            }
        });
        req.on('error', reject);
    });

const validarMapaDeUsuarios = (obj, campo) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        throw Object.assign(new Error(`Campo "${campo}" deve ser um objeto.`), { status: 400 });
    }
    for (const [user, ts] of Object.entries(obj)) {
        if (!RE_USERNAME.test(user)) {
            throw Object.assign(new Error(`Username inválido em "${campo}": ${user}`), { status: 400 });
        }
        if (ts !== null && !Number.isFinite(ts)) {
            throw Object.assign(new Error(`Timestamp inválido para ${user}.`), { status: 400 });
        }
    }
};

const validarSnapshot = (snap) => {
    if (!snap || typeof snap !== 'object') {
        throw Object.assign(new Error('Snapshot inválido.'), { status: 400 });
    }
    if (!Number.isFinite(snap.takenAt)) {
        throw Object.assign(new Error('takenAt ausente ou inválido.'), { status: 400 });
    }
    validarMapaDeUsuarios(snap.followers, 'followers');
    validarMapaDeUsuarios(snap.following, 'following');
    return { takenAt: snap.takenAt, followers: snap.followers, following: snap.following };
};

const validarHistorico = (lista) => {
    if (!Array.isArray(lista)) {
        throw Object.assign(new Error('Histórico deve ser um array.'), { status: 400 });
    }
    if (lista.length > 100000) {
        throw Object.assign(new Error('Histórico grande demais.'), { status: 400 });
    }
    const invalido = lista.find((u) => typeof u !== 'string' || !RE_USERNAME.test(u));
    if (invalido !== undefined) {
        throw Object.assign(new Error(`Username inválido: ${invalido}`), { status: 400 });
    }
    return [...new Set(lista)];
};

// ---------------------------------------------------------------- arquivos estáticos

const servirEstatico = async (req, res, urlPath) => {
    const relativo = urlPath === '/' ? 'index.html' : decodeURIComponent(urlPath).replace(/^\/+/, '');
    const destino = path.resolve(RAIZ, relativo);

    // Impede path traversal e leitura da pasta de dados pessoais.
    if (!destino.startsWith(RAIZ + path.sep) || destino.startsWith(DATA_DIR + path.sep)) {
        res.writeHead(403).end('Proibido');
        return;
    }

    try {
        let conteudo = await fsp.readFile(destino);
        const ext = path.extname(destino).toLowerCase();

        // Injeta o token de sessão no HTML para o front autenticar nas rotas /api.
        if (ext === '.html') {
            conteudo = Buffer.from(conteudo.toString('utf8').replace('__TOKEN__', TOKEN), 'utf8');
        }

        res.writeHead(200, {
            'Content-Type': MIME[ext] ?? 'application/octet-stream',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff'
        });
        res.end(conteudo);
    } catch {
        res.writeHead(404).end('Não encontrado');
    }
};

// ---------------------------------------------------------------- rotas de API

const rotasApi = {
    'GET /api/snapshots': async (_req, res) => {
        json(res, 200, await lerJson(PATH_SNAPSHOTS, []));
    },

    'POST /api/snapshots': async (req, res) => {
        const snapshot = validarSnapshot(await lerCorpo(req));
        const resultado = await enfileirar('snapshots', async () => {
            const snaps = await lerJson(PATH_SNAPSHOTS, []);
            // Substitui o snapshot do mesmo dia em vez de duplicar.
            const idx = snaps.findIndex((s) => Math.abs(s.takenAt - snapshot.takenAt) < 86400);
            if (idx >= 0) snaps[idx] = snapshot;
            else snaps.push(snapshot);
            snaps.sort((a, b) => a.takenAt - b.takenAt);
            const podados = snaps.slice(-MAX_SNAPSHOTS);
            await gravarAtomico(PATH_SNAPSHOTS, podados);
            return { total: podados.length, substituido: idx >= 0 };
        });
        json(res, 200, { ok: true, ...resultado });
    },

    'DELETE /api/snapshots': async (_req, res) => {
        await enfileirar('snapshots', () => gravarAtomico(PATH_SNAPSHOTS, []));
        json(res, 200, { ok: true });
    },

    'GET /api/history': async (_req, res) => {
        json(res, 200, await lerJson(PATH_HISTORY, []));
    },

    'POST /api/history': async (req, res) => {
        const historico = validarHistorico(await lerCorpo(req));
        await enfileirar('history', () => gravarAtomico(PATH_HISTORY, historico));
        json(res, 200, { ok: true, total: historico.length });
    }
};

const server = http.createServer(async (req, res) => {
    const urlPath = new URL(req.url, `http://${HOST}`).pathname;

    if (!urlPath.startsWith('/api/')) {
        if (req.method !== 'GET') return void res.writeHead(405).end();
        return void servirEstatico(req, res, urlPath);
    }

    // Toda rota de API exige o token da sessão. Sem isso, um site malicioso
    // aberto em outra aba conseguiria conversar com este servidor.
    if (req.headers['x-app-token'] !== TOKEN) {
        return void json(res, 401, { error: 'Token de sessão ausente ou inválido.' });
    }

    const handler = rotasApi[`${req.method} ${urlPath}`];
    if (!handler) return void json(res, 404, { error: 'Rota não encontrada.' });

    try {
        await handler(req, res);
    } catch (erro) {
        if (res.headersSent) return;
        json(res, erro.status ?? 500, { error: erro.message ?? 'Erro interno.' });
    }
});

server.listen(PORT, HOST, () => {
    console.log('\n  Verifica Seguidores — servidor local');
    console.log(`  Abra:  http://${HOST}:${PORT}`);
    console.log(`  Dados: ${DATA_DIR}`);
    console.log('  Ligado só em localhost. Nada sai da sua máquina.\n');
});
