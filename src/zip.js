/**
 * Leitura do .zip do export da Meta — sem nenhuma dependência externa.
 *
 * Por que isto existe: a parte mais cara do onboarding não é a análise, é pedir
 * ao usuário que descompacte o export e cace dois arquivos dentro de
 * `connections/followers_and_following/`. Aceitar o .zip inteiro elimina o passo
 * onde a maioria desiste.
 *
 * Por que não usar uma lib (fflate, jszip): o app precisa continuar rodando com
 * duplo clique, offline, sem CDN e sem `npm install`. O navegador já traz um
 * inflate nativo em `DecompressionStream('deflate-raw')`; o que falta é só ler o
 * índice do ZIP, que são ~60 linhas de leitura de bytes.
 *
 * Lemos o diretório central (não os headers locais em sequência) porque só nos
 * interessam 2 ou 3 entradas de um arquivo com centenas — descompactar tudo para
 * achá-las desperdiçaria memória à toa.
 */

const ASSINATURA_EOCD = 0x06054b50;
const ASSINATURA_CENTRAL = 0x02014b50;
/** O comentário final do ZIP cabe em 64 KB; o EOCD está dentro dessa cauda. */
const CAUDA_EOCD = 66_000;

const zipSuportado = typeof DecompressionStream === 'function';

/** Localiza o End of Central Directory varrendo a cauda de trás para frente. */
const acharEOCD = (dv) => {
    const inicio = Math.max(0, dv.byteLength - CAUDA_EOCD);
    for (let i = dv.byteLength - 22; i >= inicio; i--) {
        if (dv.getUint32(i, true) === ASSINATURA_EOCD) return i;
    }
    return -1;
};

/** Nomes no ZIP vêm em UTF-8 (bit 11) ou CP437; na prática ambos batem em ASCII. */
const decodificarNome = (bytes) => new TextDecoder('utf-8').decode(bytes);

/**
 * Entradas do diretório central. Devolve só o necessário para achar e extrair:
 * nome, método de compressão, tamanho e onde começa o header local.
 */
const lerEntradasCentrais = (dv, bytes, inicio, total) => {
    const entradas = [];
    let p = inicio;

    for (let i = 0; i < total && p + 46 <= dv.byteLength; i++) {
        if (dv.getUint32(p, true) !== ASSINATURA_CENTRAL) break;

        const metodo = dv.getUint16(p + 10, true);
        const tamanhoComprimido = dv.getUint32(p + 20, true);
        const tamNome = dv.getUint16(p + 28, true);
        const tamExtra = dv.getUint16(p + 30, true);
        const tamComentario = dv.getUint16(p + 32, true);
        const offsetLocal = dv.getUint32(p + 42, true);
        const nome = decodificarNome(bytes.subarray(p + 46, p + 46 + tamNome));

        entradas.push({ nome, metodo, tamanhoComprimido, offsetLocal });
        p += 46 + tamNome + tamExtra + tamComentario;
    }
    return entradas;
};

/**
 * O tamanho do nome/extra no header LOCAL pode diferir do central — é o erro
 * clássico de quem lê ZIP. Sempre reler daqui antes de fatiar os dados.
 */
const dadosDaEntrada = (dv, bytes, entrada) => {
    const p = entrada.offsetLocal;
    const tamNome = dv.getUint16(p + 26, true);
    const tamExtra = dv.getUint16(p + 28, true);
    const inicio = p + 30 + tamNome + tamExtra;
    return bytes.subarray(inicio, inicio + entrada.tamanhoComprimido);
};

const inflarDeflateBruto = async (comprimido) => {
    const fluxo = new Blob([comprimido]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(fluxo).arrayBuffer());
};

/** Só interessam os dois arquivos de relacionamento, onde quer que estejam. */
const RELEVANTE = /^(followers(_\d+)?|following(_\d+)?)\.json$/i;
const nomeBase = (caminho) => caminho.split(/[\/]/).pop() ?? '';

export const ZipService = {
    suportado: zipSuportado,

    ehZip(file) {
        return /\.zip$/i.test(file?.name ?? '') || file?.type === 'application/zip';
    },

    /**
     * Extrai do .zip apenas followers_N.json e following.json, já parseados.
     * @returns {Promise<Array<{nome: string, json: any}>>}
     */
    async extrairExportInstagram(file) {
        if (!zipSuportado) {
            throw new Error(
                'Seu navegador não sabe abrir .zip. Descompacte o arquivo e envie os .json avulsos.'
            );
        }

        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const dv = new DataView(buffer);

        const eocd = acharEOCD(dv);
        if (eocd < 0) throw new Error(`"${file.name}" não parece um .zip válido.`);

        const totalEntradas = dv.getUint16(eocd + 10, true);
        const inicioCentral = dv.getUint32(eocd + 16, true);

        // 0xFFFFFFFF é o marcador de ZIP64 — exports de "seguidores e seguindo"
        // têm poucos MB e nunca chegam lá, então avisar é melhor que fingir.
        if (inicioCentral === 0xffffffff || totalEntradas === 0xffff) {
            throw new Error('Este .zip é grande demais (ZIP64). Descompacte e envie os .json.');
        }

        const alvos = lerEntradasCentrais(dv, bytes, inicioCentral, totalEntradas).filter((e) =>
            RELEVANTE.test(nomeBase(e.nome))
        );

        if (!alvos.length) {
            throw new Error(
                `Não achei followers/following dentro de "${file.name}". ` +
                    'Confira se você marcou "Seguidores e seguindo" e o formato JSON.'
            );
        }

        const achados = [];
        for (const entrada of alvos) {
            const cru = dadosDaEntrada(dv, bytes, entrada);
            let conteudo;
            if (entrada.metodo === 0) conteudo = cru;
            else if (entrada.metodo === 8) conteudo = await inflarDeflateBruto(cru);
            else continue; // método exótico: ignora em vez de derrubar o lote

            const texto = new TextDecoder('utf-8').decode(conteudo);
            try {
                achados.push({ nome: nomeBase(entrada.nome), json: JSON.parse(texto) });
            } catch {
                throw new Error(
                    `"${nomeBase(entrada.nome)}" dentro do .zip não é JSON. ` +
                        'Refaça o export escolhendo o formato JSON, não HTML.'
                );
            }
        }

        if (!achados.length) throw new Error(`Não consegui descompactar "${file.name}".`);
        return achados;
    }
};
