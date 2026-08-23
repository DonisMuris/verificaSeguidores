/**
 * Gera a versão autossuficiente: um único HTML que roda com duplo clique, sem
 * Node, sem servidor e sem instalar nada.
 *
 * Por que um build em vez de um segundo arquivo escrito à mão: assim a lógica
 * do parser e do motor de análise tem UMA fonte da verdade (src/). Duas cópias
 * divergiriam no primeiro ajuste.
 *
 * Uso:
 *   node build.js                                  VerificaSeguidores.html, com comentários
 *   node build.js --release --saida public/index.html   versão publicável
 *
 * O modo release existe porque os comentários deste projeto valem mais que o
 * código: eles carregam a pesquisa (o que foi testado, o que foi descartado e
 * por quê). Publicar o app não deveria publicar isso junto.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = __dirname;

// Ordem importa: cada arquivo só pode usar o que já foi definido acima dele.
// storage-local.js entra no lugar de storage.js — mesma interface, sem servidor.
const MODULOS = [
    'src/dom-utils.js',
    'src/icones.js',
    'src/tema.js',
    'src/parser.js',
    'src/zip.js',
    'src/analysis.js',
    'src/storage-local.js',
    'src/triagem.js',
    'src/ui.js',
    'src/app.js'
];

// ------------------------------------------------------------------ argumentos

const lerArgumentos = (argv) => {
    const release = argv.includes('--release');
    const i = argv.indexOf('--saida');
    const saida = i >= 0 && argv[i + 1] ? argv[i + 1] : 'VerificaSeguidores.html';
    return { release, saida: path.resolve(RAIZ, saida) };
};

// ------------------------------------------------------------------ montagem

/**
 * Tudo entra em LF, sempre.
 *
 * Não é preciosismo: várias regras deste build assumem quebra de linha `\n` pura —
 * a que remove a linha do `app-token`, a que apara espaço no fim da linha, a que
 * colapsa linha em branco. Com um `\r` no meio elas silenciosamente não casam, e o
 * mesmo commit passa a gerar arquivos diferentes no Windows e no runner Linux da
 * Cloudflare. Isso destrói a única conferência de integridade que sobra depois do
 * deploy: baixar o que está no ar e comparar com o build local.
 */
const paraLF = (texto) => texto.replace(/\r\n/g, '\n');

/** Converte um módulo ES em código solto, para concatenar num script clássico. */
const desmodularizar = (codigo) =>
    paraLF(codigo)
        .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
        .replace(/^export\s+/gm, '')
        .trim();

/**
 * Concatenar módulos num escopo só faz duas declarações homônimas colidirem —
 * algo que os imports ES escondem. Falhar aqui é melhor que gerar um HTML que
 * quebra no navegador.
 *
 * Roda ANTES da remoção de comentários, porque usa os cabeçalhos de arquivo
 * para dizer em quais módulos o nome duplicado apareceu.
 */
const detectarColisoes = (script) => {
    const vistos = new Map();
    const duplicados = [];
    let arquivo = '(topo)';

    for (const linha of script.split('\n')) {
        const cabecalho = linha.match(/^\/\* =+ (\S+) =+ \*\/$/);
        if (cabecalho) {
            arquivo = cabecalho[1];
            continue;
        }
        const decl = linha.match(/^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/);
        if (!decl) continue;
        const nome = decl[1];
        if (vistos.has(nome)) duplicados.push(`${nome} (${vistos.get(nome)} e ${arquivo})`);
        else vistos.set(nome, arquivo);
    }

    if (duplicados.length) {
        throw new Error(
            'Identificadores declarados em mais de um módulo — extraia para um módulo comum:\n  ' +
                duplicados.join('\n  ')
        );
    }
};

// ------------------------------------------------------------------ release

/**
 * Remove comentários de JavaScript sem quebrar o código.
 *
 * Um `replace(/\/\/.*$/gm, '')` seria catastrófico aqui: este projeto tem
 * `'https://www.instagram.com/'` espalhado em strings e vários literais de
 * regex (`/instagram\.com\/(?:_u\/)?([^/?#]+)/i`) com barras dentro. É preciso
 * varrer caractere a caractere sabendo em que contexto se está.
 *
 * A parte difícil é distinguir `/` de divisão de `/` de início de regex, o que
 * não se resolve olhando só para o caractere: depende do token anterior.
 * A regra usada é a clássica — depois de identificador, número, `)` ou `]` é
 * divisão; depois de qualquer outra coisa, ou de palavra-chave como `return`,
 * é regex.
 *
 * Nada é colapsado em linha: comentário de linha vira vazio (a quebra fica),
 * bloco vira um espaço (as quebras ao redor ficam). Assim não há risco de duas
 * instruções se juntarem e a inserção automática de ponto e vírgula mudar o
 * significado do programa.
 */
const PALAVRAS_ANTES_DE_REGEX = new Set([
    'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
    'case', 'do', 'else', 'yield', 'await', 'throw'
]);

const removerComentariosJs = (codigo) => {
    let saida = '';
    let ultimoChar = '';       // último não-branco emitido
    let palavraAtual = '';     // identificador sendo montado agora
    let ultimaPalavra = '';    // identificador anterior, já fechado

    const emitir = (c) => {
        saida += c;
        if (/[A-Za-z0-9_$]/.test(c)) {
            palavraAtual += c;
        } else if (palavraAtual) {
            ultimaPalavra = palavraAtual;
            palavraAtual = '';
        }
        if (!/\s/.test(c)) ultimoChar = c;
    };

    /** `/` inicia regex? Depende do token anterior, não do que vem depois. */
    const iniciaRegex = () => {
        if (!ultimoChar) return true;
        if (!/[A-Za-z0-9_$)\]]/.test(ultimoChar)) return true;
        return PALAVRAS_ANTES_DE_REGEX.has(palavraAtual || ultimaPalavra);
    };

    /**
     * `pilha` guarda o que cada `{` aberto significa. Um `}` que fecha um
     * `${` devolve ao texto do template; um que fecha bloco comum, não.
     * Sem isso, `${lista.map((x) => { return x; })}` encerraria a interpolação
     * na chave errada e o resto do arquivo seria lido como texto.
     */
    const pilha = [];
    let modo = 'codigo';
    let i = 0;
    const n = codigo.length;

    while (i < n) {
        const c = codigo[i];

        // ---------------------------------------------- texto de template
        if (modo === 'template') {
            if (c === '\\') {
                emitir(c);
                i++;
                if (i < n) emitir(codigo[i++]);
                continue;
            }
            if (c === '$' && codigo[i + 1] === '{') {
                emitir('$');
                emitir('{');
                i += 2;
                pilha.push('interp');
                modo = 'codigo';
                continue;
            }
            if (c === '`') {
                emitir(c);
                i++;
                modo = 'codigo';
                continue;
            }
            emitir(c);
            i++;
            continue;
        }

        // ---------------------------------------------- código
        const prox = codigo[i + 1];

        if (c === '/' && prox === '/') {
            while (i < n && codigo[i] !== '\n') i++;
            continue;
        }
        if (c === '/' && prox === '*') {
            i += 2;
            while (i < n && !(codigo[i] === '*' && codigo[i + 1] === '/')) i++;
            i += 2;
            emitir(' ');
            continue;
        }

        if (c === '"' || c === "'") {
            emitir(c);
            i++;
            while (i < n) {
                const d = codigo[i];
                emitir(d);
                i++;
                if (d === '\\') {
                    if (i < n) emitir(codigo[i++]);
                    continue;
                }
                if (d === c) break;
            }
            continue;
        }

        if (c === '`') {
            emitir(c);
            i++;
            modo = 'template';
            continue;
        }

        if (c === '{') {
            emitir(c);
            i++;
            pilha.push('bloco');
            continue;
        }
        if (c === '}') {
            emitir(c);
            i++;
            if (pilha.pop() === 'interp') modo = 'template';
            continue;
        }

        if (c === '/' && iniciaRegex()) {
            emitir(c);
            i++;
            let emClasse = false;
            while (i < n) {
                const d = codigo[i];
                emitir(d);
                i++;
                if (d === '\\') {
                    if (i < n) emitir(codigo[i++]);
                    continue;
                }
                if (d === '[') emClasse = true;
                else if (d === ']') emClasse = false;
                else if (d === '/' && !emClasse) break;
                else if (d === '\n') break; // regex não atravessa linha: era divisão
            }
            while (i < n && /[a-z]/.test(codigo[i])) emitir(codigo[i++]); // flags
            continue;
        }

        emitir(c);
        i++;
    }

    return saida
        .replace(/[ \t]+$/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};

/** CSS não tem regex nem comentário de linha: só blocos e strings. */
const removerComentariosCss = (css) =>
    css
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/[ \t]+$/gm, '')
        .replace(/\n{3,}/g, '\n\n');

/**
 * Rede de segurança do modo release: se o scanner tiver comido um caractere que
 * não devia, o resultado não é um erro visível — é um app que quebra no
 * navegador de outra pessoa. Melhor falhar aqui.
 */
const validarScript = (script) => {
    try {
        new vm.Script(script);
    } catch (erro) {
        throw new Error(
            `A remoção de comentários gerou JavaScript inválido: ${erro.message}\n` +
                'Isto é um bug do build, não do app. Gere sem --release e abra uma issue.'
        );
    }
    // Idempotência: rodar de novo não pode mudar nada. Se mudar, o scanner saiu
    // de sincronia com algum literal e está "removendo" coisa que é código.
    if (removerComentariosJs(script) !== script) {
        throw new Error('A remoção de comentários não é idempotente — há um literal mal interpretado.');
    }
};

/**
 * Cabeçalhos para o Cloudflare Pages.
 *
 * `connect-src 'none'` é o item que importa: com ele o navegador **impede**
 * qualquer requisição de rede saindo da página. A promessa de "nada sai do seu
 * computador" deixa de ser um texto na tela e passa a ser garantida pelo
 * navegador — o que é exatamente o argumento do produto.
 */
const CABECALHOS = `/*
  Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin
`;

// ------------------------------------------------------------------ construção

const construir = () => {
    const { release, saida } = lerArgumentos(process.argv.slice(2));
    const template = paraLF(fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8'));

    const script = MODULOS.map((rel) => {
        const codigo = desmodularizar(fs.readFileSync(path.join(RAIZ, rel), 'utf8'));
        return `/* ================= ${rel} ================= */\n${codigo}`;
    }).join('\n\n');

    detectarColisoes(script);

    let html = template
        // Sem servidor não há token de sessão para injetar.
        .replace(/^.*<meta name="app-token"[^>]*>\n?/m, '')
        // Troca o carregamento por módulos pelo código embutido.
        .replace(
            /<script type="module"[^>]*><\/script>/,
            `<script>\n(() => {\n"use strict";\n\n${script}\n\n})();\n</script>`
        );

    if (html.includes('<script type="module"')) {
        throw new Error('O script de módulo não foi substituído — o template mudou?');
    }

    if (release) {
        // Todos os blocos <script>, não só o dos módulos: o script anti-flash do
        // tema mora solto no <head> e também carrega comentário explicativo.
        html = html
            .replace(/<script>([\s\S]*?)<\/script>/g, (_m, corpo) => {
                const limpo = removerComentariosJs(corpo);
                validarScript(limpo);
                return `<script>\n${limpo}\n</script>`;
            })
            .replace(/<style>[\s\S]*?<\/style>/, (bloco) => removerComentariosCss(bloco))
            .replace(/^[ \t]*<!--[\s\S]*?-->[ \t]*\n?/gm, '');
    } else {
        html = html.replace(
            '<title>',
            '<!-- Arquivo gerado por build.js. Não edite aqui: edite src/ e rode "node build.js". -->\n    <title>'
        );
    }

    fs.mkdirSync(path.dirname(saida), { recursive: true });
    fs.writeFileSync(saida, html, 'utf8');

    if (release) {
        fs.writeFileSync(path.join(path.dirname(saida), '_headers'), CABECALHOS, 'utf8');
    }

    const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(0);
    const nome = path.relative(RAIZ, saida).replace(/\\/g, '/');
    console.log(`\n  ${nome} gerado (${kb} KB)${release ? ' — modo release, sem comentários' : ''}`);
    console.log(
        release
            ? '  _headers escrito ao lado. Publique a pasta inteira.\n'
            : '  Abra com duplo clique. Não precisa de Node nem de servidor.\n'
    );
};

// Rodar direto constrói; ser importado expõe as partes testáveis.
if (require.main === module) construir();
module.exports = { removerComentariosJs, removerComentariosCss };
