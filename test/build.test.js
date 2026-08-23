import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import build from '../build.js';

const { removerComentariosJs, removerComentariosCss } = build;

/**
 * O scanner de comentários é o código mais perigoso do projeto: se ele comer um
 * caractere que não devia, o erro não aparece aqui — aparece como app quebrado
 * no navegador de outra pessoa, depois do deploy. Daí a cobertura pesada.
 */

const BARRA = String.fromCharCode(92); // evita ambiguidade de escapagem no teste
const inalterado = (nome, codigo) =>
    test(nome, () => assert.equal(removerComentariosJs(codigo), codigo));

// ---- o que um replace(/\/\/.*$/gm, '') destruiria

inalterado('URL em string simples', `const u = 'https://www.instagram.com/x';`);
inalterado('URL em template literal', 'const u = `https://insta.com/${a}`;');
inalterado('bloco falso dentro de string', `const s = "nao /* e */ comentario";`);
inalterado('regex com barra escapada', `const r = /${BARRA}/+$/;`);
inalterado('regex do parser, com barras e classe', String.raw`const m = /instagram\.com\/(?:_u\/)?([^/?#]+)/i;`);
inalterado('barra dentro de classe de regex', String.raw`const r = /[/]/g;`);
inalterado('aspas escapadas dentro de string', `const s = 'it${BARRA}'s /* x */ ok';`);

// ---- divisão não pode ser confundida com regex

inalterado('divisão entre identificadores', `const x = a / b / c;`);
inalterado('divisão depois de parêntese', `const x = (a + b) / 2;`);
inalterado('regex depois de return', `const f = () => { return /ab/.test(x); };`);

// ---- templates com chaves aninhadas

inalterado('bloco dentro da interpolação', 'const s = `${l.map((x) => { return x; }).join("/")}`;');
inalterado('template dentro de template', 'const s = `a${`b${c}`}d`;');

// ---- comentários de verdade saem

test('comentário de linha some e a quebra permanece', () => {
    assert.equal(removerComentariosJs('const a = 1; // nota\nconst b = 2;'), 'const a = 1;\nconst b = 2;');
});

test('bloco vira espaço, sem juntar instruções', () => {
    // Juntar linhas mudaria o significado do programa via inserção automática
    // de ponto e vírgula. Por isso bloco vira espaço, nunca vazio.
    assert.equal(removerComentariosJs('foo(/* x */ bar);'), 'foo(  bar);');
});

test('jsdoc multilinha desaparece por completo', () => {
    assert.equal(removerComentariosJs('/**\n * doc\n */\nconst a = 1;'), 'const a = 1;');
});

test('comentário dentro da interpolação também sai', () => {
    assert.equal(removerComentariosJs('const s = `${/* x */ a}`;'), 'const s = `${  a}`;');
});

test('CSS perde os comentários e mantém as regras', () => {
    const css = '/* tokens */\n:root { --a: 1px; }\n\n\n/* fim */\n.b { color: red; }';
    const limpo = removerComentariosCss(css);
    assert.ok(!limpo.includes('tokens'));
    assert.ok(limpo.includes('--a: 1px'));
    assert.ok(limpo.includes('.b { color: red; }'));
});

// ---- garantias sobre o código real

const modulos = ['analysis', 'parser', 'zip', 'ui', 'triagem'];

for (const nome of modulos) {
    test(`src/${nome}.js continua válido depois da limpeza`, () => {
        const fonte = readFileSync(new URL(`../src/${nome}.js`, import.meta.url), 'utf8')
            .replace(/^import[\s\S]*?;$/gm, '')
            .replace(/^export\s+/gm, '');
        const limpo = removerComentariosJs(fonte);

        assert.doesNotThrow(() => new vm.Script(limpo), 'o resultado precisa parsear');
        assert.equal(removerComentariosJs(limpo), limpo, 'a operação precisa ser idempotente');
        assert.ok(limpo.length < fonte.length, 'algo precisa ter sido removido');
    });
}

test('o motor se comporta igual antes e depois da limpeza', () => {
    // Parsear não basta: o código limpo tem de PRODUZIR o mesmo resultado.
    const fonte = readFileSync(new URL('../src/analysis.js', import.meta.url), 'utf8')
        .replace(/^export\s+/gm, '');
    const sonda = ';globalThis.saida = [1, 90, 7200, 200000, 3000000, 40000000].map(formatarDuracao);';

    const rodar = (codigo) => {
        const ctx = {};
        vm.createContext(ctx);
        vm.runInContext(codigo + sonda, ctx);
        // Array.from traz o resultado para o realm do teste: um array criado
        // dentro do vm tem outro prototype, e deepEqual compara prototype.
        return Array.from(ctx.saida);
    };

    assert.deepEqual(rodar(removerComentariosJs(fonte)), rodar(fonte));
});
