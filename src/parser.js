/**
 * Camada de leitura do export "Baixe suas informações" da Meta.
 *
 * Diferença crítica para a versão anterior: aqui NADA de timestamp é descartado.
 * O campo `timestamp` de followers_N.json é o momento em que a pessoa te seguiu;
 * o de following.json é o momento em que VOCÊ seguiu. A ordem entre os dois é o
 * que permite provar quem iniciou a relação.
 */

const RE_USERNAME = /^[a-z0-9._]{1,30}$/;

/** Normaliza username: minúsculo, sem espaços, sem @ e sem barra final de URL. */
export const normalizarUsername = (valor) => {
    if (typeof valor !== 'string') return '';
    const limpo = valor.trim().toLowerCase().replace(/^@/, '').replace(/\/+$/, '');
    return RE_USERNAME.test(limpo) ? limpo : '';
};

/** Extrai o username de uma href do tipo https://www.instagram.com/_u/fulano */
const usernameDeHref = (href) => {
    if (typeof href !== 'string') return '';
    const m = href.match(/instagram\.com\/(?:_u\/)?([^/?#]+)/i);
    return m ? normalizarUsername(m[1]) : '';
};

/**
 * Os arquivos de label_values vêm com mojibake ("Nome de usuÃ¡rio") porque a Meta
 * grava UTF-8 relido como Latin-1. Comparamos por substring estável ("usu") após
 * remover diacríticos, o que sobrevive tanto ao texto correto quanto ao corrompido.
 */
const rotuloEhUsername = (label) =>
    String(label ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .includes('usu');

/** Desembrulha as várias formas que a Meta usa para o mesmo array. */
const desembrulhar = (json, ...chaves) => {
    if (Array.isArray(json)) return json;
    if (json && typeof json === 'object') {
        for (const chave of chaves) {
            if (Array.isArray(json[chave])) return json[chave];
        }
        const primeiroArray = Object.values(json).find(Array.isArray);
        if (primeiroArray) return primeiroArray;
    }
    return [];
};

/** Lê item no formato { title, string_list_data: [{ value, href, timestamp }] } */
const lerItemRelacionamento = (item) => {
    const dado = item?.string_list_data?.[0] ?? {};
    const user =
        normalizarUsername(dado.value) ||
        normalizarUsername(item?.title) ||
        usernameDeHref(dado.href);
    if (!user) return null;
    return { user, ts: Number.isFinite(dado.timestamp) ? dado.timestamp : null };
};

/** Lê item no formato { timestamp, label_values: [{ label, value }] } */
const lerItemLabelValues = (item) => {
    const rotulos = Array.isArray(item?.label_values) ? item.label_values : [];
    const alvo = rotulos.find((l) => rotuloEhUsername(l?.label));
    const user = normalizarUsername(alvo?.value);
    if (!user) return null;
    return { user, ts: Number.isFinite(item?.timestamp) ? item.timestamp : null };
};

/** Mescla entradas em um Map, mantendo o timestamp mais antigo (início da relação). */
const paraMap = (entradas) => {
    const mapa = new Map();
    for (const entrada of entradas) {
        if (!entrada) continue;
        const anterior = mapa.get(entrada.user);
        if (anterior == null || (entrada.ts != null && entrada.ts < anterior)) {
            mapa.set(entrada.user, entrada.ts);
        }
    }
    return mapa;
};

export const ParserService = {
    /**
     * Seguidores. Aceita UM ou VÁRIOS arquivos: contas grandes recebem
     * followers_1.json, followers_2.json, followers_3.json... A versão anterior
     * lia só o _1 e errava em silêncio para quem tem muitos seguidores.
     */
    extrairSeguidores(...jsons) {
        return paraMap(
            jsons.flatMap((json) =>
                desembrulhar(json, 'relationships_followers').map(lerItemRelacionamento)
            )
        );
    },

    /** Perfis que você segue. */
    extrairSeguindo(...jsons) {
        return paraMap(
            jsons.flatMap((json) =>
                desembrulhar(json, 'relationships_following').map(lerItemRelacionamento)
            )
        );
    },

    /**
     * recently_unfollowed_profiles.json = perfis que VOCÊ deixou de seguir.
     * (Verificado no seu export: 244 de 247 já não estão mais no seu following.)
     * Serve para preencher o histórico automaticamente em vez de você marcar
     * "parei de seguir" na mão.
     */
    extrairUnfollowsQueVoceFez(json) {
        return paraMap(desembrulhar(json).map(lerItemLabelValues));
    },

    /** Solicitações de follow — recebidas (conta privada) ou enviadas por você. */
    extrairSolicitacoes(json) {
        return paraMap(desembrulhar(json).map(lerItemLabelValues));
    },

    /** Lê e faz o parse de um File do input, com mensagem de erro legível. */
    async lerArquivoAsync(file) {
        const texto = await file.text();
        try {
            return JSON.parse(texto);
        } catch {
            throw new Error(
                `"${file.name}" não é um JSON válido. Confirme que baixou o export em formato JSON (não HTML).`
            );
        }
    },

    /** Lê vários arquivos de uma vez (ex.: followers_1..N). */
    async lerArquivosAsync(fileList) {
        return Promise.all(Array.from(fileList).map((f) => this.lerArquivoAsync(f)));
    },

    /**
     * Data de modificação dos arquivos, em segundos. É o carimbo que a Meta
     * deixou ao gerar o export — a fonte mais confiável para datar o snapshot.
     */
    dataDeModificacao(fileList) {
        const datas = Array.from(fileList)
            .map((f) => f.lastModified)
            .filter((t) => Number.isFinite(t) && t > 0);
        return datas.length ? Math.floor(Math.max(...datas) / 1000) : null;
    }
};
