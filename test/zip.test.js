import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ZipService } from '../src/zip.js';
import { ParserService } from '../src/parser.js';
import { montarZip, arquivoFalso, seguidor, seguindo } from './ajuda.js';

const zipDoExport = () =>
    montarZip({
        // A estrutura real da Meta: os arquivos vivem em subpasta.
        'connections/followers_and_following/followers_1.json': JSON.stringify([seguidor('alfa', 100)]),
        'connections/followers_and_following/following.json': JSON.stringify({
            relationships_following: [seguindo('beta', 200)]
        }),
        'connections/followers_and_following/close_friends.json': JSON.stringify([seguidor('gama', 300)]),
        'preferences/settings.json': JSON.stringify({ irrelevante: true })
    });

test('acha as duas listas dentro do zip, em qualquer subpasta', async () => {
    const achados = await ZipService.extrairExportInstagram(arquivoFalso('export.zip', zipDoExport()));
    const nomes = achados.map((a) => a.nome).sort();
    assert.deepEqual(nomes, ['followers_1.json', 'following.json']);
});

test('não descompacta o resto do export', () => {
    // Um export completo tem centenas de arquivos e centenas de MB. Inflar tudo
    // para achar dois seria desperdício de memória no navegador do usuário.
    return ZipService.extrairExportInstagram(arquivoFalso('export.zip', zipDoExport())).then((achados) => {
        assert.equal(achados.length, 2);
        assert.ok(!achados.some((a) => a.nome === 'close_friends.json'));
    });
});

test('o conteúdo extraído chega íntegro ao parser', async () => {
    const achados = await ZipService.extrairExportInstagram(arquivoFalso('export.zip', zipDoExport()));
    const porTipo = {};
    for (const { nome, json } of achados) porTipo[ParserService.classificar(json, nome)] = json;

    assert.equal(ParserService.extrairSeguidores(porTipo.followers).get('alfa'), 100);
    assert.equal(ParserService.extrairSeguindo(porTipo.following).get('beta'), 200);
});

test('reconhece .zip pela extensão e pelo tipo MIME', () => {
    assert.equal(ZipService.ehZip({ name: 'export.ZIP' }), true);
    assert.equal(ZipService.ehZip({ name: 'x', type: 'application/zip' }), true);
    assert.equal(ZipService.ehZip({ name: 'followers_1.json', type: 'application/json' }), false);
});

test('arquivo corrompido dá erro legível, não stack trace', async () => {
    await assert.rejects(
        () => ZipService.extrairExportInstagram(arquivoFalso('x.zip', Buffer.from([1, 2, 3, 4, 5]))),
        /não parece um \.zip válido/
    );
});

test('zip sem as listas explica o que fazer', async () => {
    const vazio = montarZip({ 'preferences/settings.json': '{}' });
    await assert.rejects(
        () => ZipService.extrairExportInstagram(arquivoFalso('x.zip', vazio)),
        /Seguidores e seguindo/
    );
});

test('json inválido dentro do zip aponta o arquivo culpado', async () => {
    const ruim = montarZip({ 'connections/followers_and_following/following.json': '<html>nao json</html>' });
    await assert.rejects(
        () => ZipService.extrairExportInstagram(arquivoFalso('x.zip', ruim)),
        /following\.json.*não é JSON/s
    );
});
