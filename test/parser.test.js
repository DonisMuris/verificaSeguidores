import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ParserService, normalizarUsername } from '../src/parser.js';
import { seguidor, seguindo } from './ajuda.js';

test('normaliza username removendo @, barra final e caixa', () => {
    assert.equal(normalizarUsername('@Fulano'), 'fulano');
    assert.equal(normalizarUsername('fulano/'), 'fulano');
    assert.equal(normalizarUsername('  FuLaNo  '), 'fulano');
});

test('rejeita o que não é username válido', () => {
    assert.equal(normalizarUsername('com espaço'), '');
    assert.equal(normalizarUsername('a'.repeat(31)), '');
    assert.equal(normalizarUsername(null), '');
});

test('preserva o timestamp de cada follow', () => {
    // É a premissa do produto inteiro: sem o carimbo não dá para saber quem
    // seguiu primeiro, e sem isso não existe deteccão de isca.
    const mapa = ParserService.extrairSeguidores([seguidor('alguem', 1700000000)]);
    assert.equal(mapa.get('alguem'), 1700000000);
});

test('mescla followers_1..N sem perder ninguém', () => {
    // Contas grandes recebem o arquivo dividido; ler só o primeiro fazia a conta
    // sair errada em silêncio.
    const mapa = ParserService.extrairSeguidores(
        [seguidor('a', 100), seguidor('b', 200)],
        [seguidor('c', 300)]
    );
    assert.deepEqual([...mapa.keys()].sort(), ['a', 'b', 'c']);
});

test('em duplicata mantém o timestamp mais antigo', () => {
    const mapa = ParserService.extrairSeguidores([seguidor('a', 500)], [seguidor('a', 100)]);
    assert.equal(mapa.get('a'), 100, 'o início da relação é o menor carimbo');
});

test('lê following pela href quando não há campo value', () => {
    const mapa = ParserService.extrairSeguindo({ relationships_following: [seguindo('alvo', 42)] });
    assert.equal(mapa.get('alvo'), 42);
});

test('classifica following pelo conteúdo, mesmo renomeado', () => {
    const tipo = ParserService.classificar({ relationships_following: [] }, 'sei-la.json');
    assert.equal(tipo, 'following');
});

test('classifica followers pelo nome, porque o conteúdo é ambíguo', () => {
    assert.equal(ParserService.classificar([], 'followers_2.json'), 'followers');
});

test('recusa array de nome desconhecido em vez de chutar', () => {
    // close_friends.json é um array de itens com o MESMO formato de followers.
    // Chutar "array = seguidores" misturaria a lista de melhores amigos na
    // análise, e o usuário não teria como perceber.
    assert.equal(ParserService.classificar([seguidor('x', 1)], 'close_friends.json'), null);
});

test('ignora arquivos do export que não são as duas listas', () => {
    assert.equal(ParserService.classificar({ profiles_blocked_by_you: [] }, 'blocked.json'), null);
});
