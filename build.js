/**
 * Gera a versão autossuficiente: um único VerificaSeguidores.html que roda com
 * duplo clique, sem Node, sem servidor e sem instalar nada.
 *
 * Por que um build em vez de um segundo arquivo escrito à mão: assim a lógica
 * do parser e do motor de análise tem UMA fonte da verdade (src/). Duas cópias
 * divergiriam no primeiro ajuste.
 *
 * Uso:  node build.js
 */

const fs = require('fs');
const path = require('path');

const RAIZ = __dirname;
const SAIDA = path.join(RAIZ, 'VerificaSeguidores.html');

// Ordem importa: cada arquivo só pode usar o que já foi definido acima dele.
// storage-local.js entra no lugar de storage.js — mesma interface, sem servidor.
const MODULOS = [
    'src/parser.js',
    'src/analysis.js',
    'src/storage-local.js',
    'src/ui.js',
    'src/app.js'
];

/** Converte um módulo ES em código solto, para concatenar num script clássico. */
const desmodularizar = (codigo) =>
    codigo
        .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
        .replace(/^export\s+/gm, '')
        .trim();

const construir = () => {
    const template = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');

    const script = MODULOS.map((rel) => {
        const codigo = desmodularizar(fs.readFileSync(path.join(RAIZ, rel), 'utf8'));
        return `/* ================= ${rel} ================= */\n${codigo}`;
    }).join('\n\n');

    const html = template
        // Sem servidor não há token de sessão para injetar.
        .replace(/^.*<meta name="app-token"[^>]*>\n?/m, '')
        // Troca o carregamento por módulos pelo código embutido.
        .replace(
            /<script type="module"[^>]*><\/script>/,
            `<script>\n(() => {\n"use strict";\n\n${script}\n\n})();\n</script>`
        )
        .replace(
            '<title>',
            '<!-- Arquivo gerado por build.js. Não edite aqui: edite src/ e rode "node build.js". -->\n    <title>'
        );

    if (html.includes('<script type="module"')) {
        throw new Error('O script de módulo não foi substituído — o template mudou?');
    }

    fs.writeFileSync(SAIDA, html, 'utf8');

    const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(0);
    console.log(`\n  VerificaSeguidores.html gerado (${kb} KB)`);
    console.log('  Abra com duplo clique. Não precisa de Node nem de servidor.\n');
};

construir();
