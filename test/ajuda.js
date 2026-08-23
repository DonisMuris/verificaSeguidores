/**
 * Utilidades compartilhadas pelos testes.
 *
 * Os módulos de `src/` são ES Modules escritos para o navegador, mas nenhum dos
 * que interessam aqui toca o DOM — parser, motor de análise e leitor de zip são
 * lógica pura. Por isso rodam no Node sem nenhum adaptador.
 */

import { deflateRawSync } from 'node:zlib';

const tabelaCrc = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

const crc32 = (buf) => {
    let crc = -1;
    for (const b of buf) crc = (crc >>> 8) ^ tabelaCrc[(crc ^ b) & 0xff];
    return (crc ^ -1) >>> 0;
};

/**
 * Monta um .zip de verdade, com diretório central e deflate — não um stub.
 * Testar o leitor contra um zip falso não provaria nada: o que pode quebrar é
 * justamente a leitura dos offsets reais.
 */
export const montarZip = (arquivos) => {
    const locais = [];
    const centrais = [];
    let offset = 0;

    for (const [nome, conteudo] of Object.entries(arquivos)) {
        const cru = Buffer.from(conteudo, 'utf8');
        const comprimido = deflateRawSync(cru);
        const nb = Buffer.from(nome, 'utf8');
        const crc = crc32(cru);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(8, 8);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(comprimido.length, 18);
        local.writeUInt32LE(cru.length, 22);
        local.writeUInt16LE(nb.length, 26);
        locais.push(local, nb, comprimido);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(8, 10);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(comprimido.length, 20);
        central.writeUInt32LE(cru.length, 24);
        central.writeUInt16LE(nb.length, 28);
        central.writeUInt32LE(offset, 42);
        centrais.push(central, nb);

        offset += 30 + nb.length + comprimido.length;
    }

    const corpo = Buffer.concat(locais);
    const diretorio = Buffer.concat(centrais);
    const fim = Buffer.alloc(22);
    fim.writeUInt32LE(0x06054b50, 0);
    fim.writeUInt16LE(Object.keys(arquivos).length, 8);
    fim.writeUInt16LE(Object.keys(arquivos).length, 10);
    fim.writeUInt32LE(diretorio.length, 12);
    fim.writeUInt32LE(corpo.length, 16);

    return Buffer.concat([corpo, diretorio, fim]);
};

/** O mínimo que `ZipService` usa de um File: nome, tipo e arrayBuffer(). */
export const arquivoFalso = (nome, buffer, type = 'application/zip') => ({
    name: nome,
    type,
    async arrayBuffer() {
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    }
});

/** Entrada no formato de followers_N.json (array puro). */
export const seguidor = (user, ts) => ({
    title: '',
    media_list_data: [],
    string_list_data: [{ href: `https://www.instagram.com/${user}`, value: user, timestamp: ts }]
});

/** Entrada no formato de following.json (embrulhada, sem `value`). */
export const seguindo = (user, ts) => ({
    title: user,
    string_list_data: [{ href: `https://www.instagram.com/_u/${user}`, timestamp: ts }]
});

export const DIA = 86400;
export const AGORA = Math.floor(Date.now() / 1000);
