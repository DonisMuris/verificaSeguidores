import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analisar, criarSnapshot, VEREDITO, formatarDuracao, detectarExportParcial } from '../src/analysis.js';
import { DIA, AGORA } from './ajuda.js';

/** Atalho: monta um snapshot a partir de dois objetos simples. */
const snap = (followers, following, takenAt) =>
    criarSnapshot(new Map(Object.entries(followers)), new Map(Object.entries(following)), takenAt);

const acharPerfil = (perfis, user) => perfis.find((p) => p.user === user);

test('com 1 snapshot não afirma prova', () => {
    // O achado central do projeto: quem te larga some do arquivo e leva a prova
    // junto. Afirmar mais que isso seria inventar, que é o que a concorrência faz.
    const { resumo } = analisar([snap({ a: 100 }, { a: 90, b: AGORA - 10 * DIA }, AGORA)]);
    assert.equal(resumo.temProva, false);
    assert.equal(resumo.baitProvado, 0);
});

test('com 2 snapshots identifica quem largou', () => {
    const antes = snap({ isca: AGORA - 60 * DIA, fiel: AGORA - 90 * DIA },
                       { isca: AGORA - 60 * DIA + 3, fiel: AGORA - 90 * DIA }, AGORA - 30 * DIA);
    const depois = snap({ fiel: AGORA - 90 * DIA },
                        { isca: AGORA - 60 * DIA + 3, fiel: AGORA - 90 * DIA }, AGORA);

    const { perfis, resumo } = analisar([antes, depois]);
    assert.equal(resumo.temProva, true);

    const isca = acharPerfil(perfis, 'isca');
    assert.equal(isca.veredito, VEREDITO.BAIT_PROVADO, 'veio primeiro, foi retribuído e sumiu');
    assert.ok(isca.perdidoEntre, 'sabe em qual intervalo sumiu');
    assert.equal(acharPerfil(perfis, 'fiel').veredito, VEREDITO.MUTUO);
});

test('quem sumiu mas foi seguido por você primeiro não é isca', () => {
    // A distinção importa: sumir é um fato, ser isca depende de quem começou.
    const antes = snap({ alvo: AGORA - 30 * DIA }, { alvo: AGORA - 90 * DIA }, AGORA - 10 * DIA);
    const depois = snap({}, { alvo: AGORA - 90 * DIA }, AGORA);
    const { perfis } = analisar([antes, depois]);
    assert.equal(acharPerfil(perfis, 'alvo').veredito, VEREDITO.SUMIU);
});

test('mútuo com troca instantânea tem risco zero', () => {
    // Bug já corrigido uma vez: sem esta guarda, amizades recíprocas que se
    // seguiram no mesmo minuto subiam ao topo do ranking de risco.
    const { perfis } = analisar([snap({ amigo: 1000 }, { amigo: 1003 }, AGORA)]);
    const amigo = acharPerfil(perfis, 'amigo');
    assert.equal(amigo.veredito, VEREDITO.MUTUO);
    assert.equal(amigo.trocaInstantanea, true, 'a troca instantânea é detectada');
    assert.equal(amigo.score, 0, 'mas não vira risco');
});

test('quem só te segue não entra no ranking de risco', () => {
    const { perfis } = analisar([snap({ fa: 1000 }, {}, AGORA)]);
    const fa = acharPerfil(perfis, 'fa');
    assert.equal(fa.veredito, VEREDITO.SO_TE_SEGUE);
    assert.equal(fa.score, 0);
});

test('as três listas da interface particionam todos os perfis', () => {
    // "Não me seguem", "não sigo de volta" e "mútuos" precisam somar o total,
    // senão o usuário vê números que não fecham e perde a confiança na conta.
    const { perfis } = analisar([
        snap({ m: 100, so: 200 }, { m: 100, nr: 300 }, AGORA)
    ]);
    const naoMeSeguem = perfis.filter((p) => p.voceSegueAgora && !p.teSegueAgora).length;
    const naoSigo = perfis.filter((p) => p.veredito === VEREDITO.SO_TE_SEGUE).length;
    const mutuos = perfis.filter((p) => p.veredito === VEREDITO.MUTUO).length;
    assert.equal(naoMeSeguem + naoSigo + mutuos, perfis.length);
});

test('relação de mais de um ano perde pontos de risco', () => {
    const antes = snap({ velho: AGORA - 800 * DIA }, { velho: AGORA - 800 * DIA + 5 }, AGORA - 10 * DIA);
    const depois = snap({}, { velho: AGORA - 800 * DIA + 5 }, AGORA);
    const { perfis } = analisar([antes, depois]);
    const velho = acharPerfil(perfis, 'velho');
    assert.ok(
        velho.motivos.some((m) => m.includes('mais de um ano')),
        'a longevidade da relação entra como atenuante'
    );
});

test('perfil resolvido sai das contagens', () => {
    const { resumo } = analisar([snap({}, { x: AGORA - 200 * DIA }, AGORA)], new Set(['x']));
    assert.equal(resumo.naoRetribuem, 0);
});

test('detecta export recortado por intervalo de datas', () => {
    // O erro mais caro que o usuário pode cometer: o arquivo parece válido e
    // transforma todo seguidor antigo ausente num falso "te largou".
    const r = detectarExportParcial(
        new Map([['a', AGORA - 30 * DIA]]),
        new Map([['b', AGORA - 900 * DIA]])
    );
    assert.equal(r.parcial, true);
    assert.ok(r.defasagemDias > 800);
});

test('export completo não dispara alarme falso', () => {
    const r = detectarExportParcial(
        new Map([['a', AGORA - 900 * DIA]]),
        new Map([['b', AGORA - 880 * DIA]])
    );
    assert.equal(r.parcial, false);
});

test('formata duração no singular e no plural', () => {
    assert.equal(formatarDuracao(30), '30s');
    assert.equal(formatarDuracao(40 * DIA), '1 mês');
    assert.equal(formatarDuracao(90 * DIA), '3 meses');
    assert.equal(formatarDuracao(null), '—');
});
