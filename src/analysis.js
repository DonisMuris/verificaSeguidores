/**
 * Motor de análise de relações e Bait Score.
 *
 * PREMISSA CENTRAL (validada contra um export real):
 * Quando alguém te larga, o perfil some de followers_N.json e a prova de que ele
 * já te seguiu é destruída. Por isso é IMPOSSÍVEL provar "follow-back bait" com
 * um único export — testei a heurística de clusters e ela recupera menos de 8%
 * dos casos. A prova exige comparar dois snapshots no tempo.
 *
 * O motor então opera em dois modos:
 *   1 snapshot   -> veredito de SUSPEITA, com sinais e ranking de risco.
 *   2+ snapshots -> veredito PROVADO, com ordem de iniciativa e janela de retenção.
 */

export const VEREDITO = {
    BAIT_PROVADO: 'BAIT_PROVADO',
    SUMIU: 'SUMIU',
    BAIT_SUSPEITO: 'BAIT_SUSPEITO',
    NUNCA_RETRIBUIU: 'NUNCA_RETRIBUIU',
    MUTUO: 'MUTUO',
    SO_TE_SEGUE: 'SO_TE_SEGUE'
};

export const ROTULO_VEREDITO = {
    BAIT_PROVADO: 'Isca confirmada',
    SUMIU: 'Te largou',
    BAIT_SUSPEITO: 'Isca provável',
    NUNCA_RETRIBUIU: 'Nunca retribuiu',
    MUTUO: 'Mútuo',
    SO_TE_SEGUE: 'Te segue'
};

const DIA = 86400;
/** Diferença máxima para considerar que houve troca recíproca no mesmo ato. */
const JANELA_TROCA_INSTANTANEA = 10;

/**
 * Piso para a data do export: o follow mais recente registrado. O arquivo não
 * pode ter sido gerado antes do último evento que ele contém.
 *
 * Usar isto sozinho é frágil — mede atividade, não data de geração. Quem passar
 * semanas sem seguir ninguém teria dois exports distintos deduzindo a mesma
 * data. Serve como piso de validação e como último recurso, não como fonte.
 */
export const deduzirDataDoExport = (followers, following) => {
    const agora = Math.floor(Date.now() / 1000);
    let maximo = 0;
    for (const mapa of [followers, following]) {
        for (const ts of mapa.values()) {
            if (Number.isFinite(ts) && ts > maximo && ts <= agora) maximo = ts;
        }
    }
    return maximo || agora;
};

/**
 * Data do export, em ordem de confiabilidade:
 *
 *  1. `mtime` — a data de modificação dos próprios JSONs, que o navegador
 *     entrega em `File.lastModified`. É o momento em que a Meta gerou o
 *     arquivo e, na prática, o valor exato.
 *  2. Maior timestamp do conteúdo, quando o mtime é implausível (arquivo
 *     reeditado, copiado sem preservar data, ou vindo de outro fuso).
 *
 * O mtime só é aceito se cair entre o último evento registrado e agora — um
 * export não pode ser mais antigo que o próprio conteúdo nem estar no futuro.
 */
export const resolverDataDoExport = ({ followers, following, mtime }) => {
    const agora = Math.floor(Date.now() / 1000);
    const piso = deduzirDataDoExport(followers, following);

    if (Number.isFinite(mtime) && mtime >= piso && mtime <= agora + 86400) {
        return { takenAt: mtime, origem: 'arquivo' };
    }
    return { takenAt: piso, origem: 'conteudo' };
};

/**
 * Detecta export recortado por intervalo de datas.
 *
 * Se o usuário pedir o export com "Último ano" em vez de "Todo o período", a
 * Meta corta a lista de seguidores mas entrega o following inteiro. O arquivo
 * parece válido e o app não teria como desconfiar — mas comparar um snapshot
 * completo com um recortado faz TODO seguidor antigo ausente virar um falso
 * "te largou", contaminando a análise inteira.
 *
 * O sinal é a assimetria: num export completo, as duas listas começam mais ou
 * menos na mesma época (quando a conta foi criada). Num recortado, os
 * seguidores começam anos depois do primeiro follow que você deu.
 */
const FOLGA_JANELA = 180 * DIA;

export const detectarExportParcial = (followers, following) => {
    const menor = (mapa) => {
        let min = Infinity;
        for (const ts of mapa.values()) if (Number.isFinite(ts) && ts < min) min = ts;
        return Number.isFinite(min) ? min : null;
    };

    const inicioFollowers = menor(followers);
    const inicioFollowing = menor(following);
    if (inicioFollowers == null || inicioFollowing == null) return { parcial: false };

    const defasagem = inicioFollowers - inicioFollowing;
    return {
        parcial: defasagem > FOLGA_JANELA,
        inicioFollowers,
        inicioFollowing,
        defasagemDias: Math.round(defasagem / DIA)
    };
};

/**
 * Cria um snapshot serializável a partir dos Maps do parser.
 * Sem `takenAt` explícito, a data vem do conteúdo do export, não do relógio.
 */
export const criarSnapshot = (followers, following, takenAt) => ({
    takenAt: Number.isFinite(takenAt) ? takenAt : deduzirDataDoExport(followers, following),
    followers: Object.fromEntries(followers),
    following: Object.fromEntries(following)
});

const mapaDe = (obj) => new Map(Object.entries(obj ?? {}));

/**
 * Compara dois snapshots consecutivos e devolve os eventos de transição.
 * É aqui que nasce a evidência que o export sozinho não tem.
 */
export const diffSnapshots = (anterior, atual) => {
    const fAnt = mapaDe(anterior.followers);
    const fAtu = mapaDe(atual.followers);
    const gAnt = mapaDe(anterior.following);
    const gAtu = mapaDe(atual.following);

    const eventos = [];
    const push = (user, tipo) => eventos.push({ user, tipo, de: anterior.takenAt, ate: atual.takenAt });

    for (const user of fAtu.keys()) if (!fAnt.has(user)) push(user, 'SEGUIU_VOCE');
    for (const user of fAnt.keys()) if (!fAtu.has(user)) push(user, 'PAROU_DE_TE_SEGUIR');
    for (const user of gAtu.keys()) if (!gAnt.has(user)) push(user, 'VOCE_SEGUIU');
    for (const user of gAnt.keys()) if (!gAtu.has(user)) push(user, 'VOCE_PAROU');

    return eventos;
};

/**
 * Score 0–100. Pesa a prova, a intenção (troca instantânea = follow-back reflexo,
 * o alvo exato do golpe) e a velocidade do descarte.
 */
const VEREDITOS_DE_RISCO = new Set([
    VEREDITO.BAIT_PROVADO,
    VEREDITO.SUMIU,
    VEREDITO.BAIT_SUSPEITO,
    VEREDITO.NUNCA_RETRIBUIU
]);

const calcularScore = (perfil) => {
    let score = 0;
    const motivos = [];

    // Relação saudável (mútua ou só ele te segue) nunca pontua risco. Sem esta
    // guarda, um mútuo com troca instantânea somava pontos e poluía o ranking.
    if (!VEREDITOS_DE_RISCO.has(perfil.veredito)) {
        return { score: 0, motivos: [] };
    }

    if (perfil.veredito === VEREDITO.BAIT_PROVADO) {
        score += 55;
        motivos.push('Seguiu você primeiro, você retribuiu e depois foi largado — confirmado entre dois snapshots.');
    } else if (perfil.veredito === VEREDITO.SUMIU) {
        score += 30;
        motivos.push('Te seguia no snapshot anterior e não segue mais.');
    } else if (perfil.veredito === VEREDITO.BAIT_SUSPEITO) {
        score += 20;
        motivos.push('Você seguiu recentemente e não há reciprocidade.');
    }

    if (perfil.trocaInstantanea) {
        score += 25;
        motivos.push('A troca de follows aconteceu em menos de 10s — follow-back reflexo.');
    }

    const retencao = perfil.retencaoMaxSeg;
    if (retencao != null) {
        if (retencao <= 2 * DIA) {
            score += 20;
            motivos.push('Te largou em até 2 dias.');
        } else if (retencao <= 7 * DIA) {
            score += 12;
            motivos.push('Te largou em até 1 semana.');
        } else if (retencao >= 365 * DIA) {
            score -= 15;
            motivos.push('A relação durou mais de um ano — provavelmente não é isca.');
        }
    }

    if (perfil.voceSeguiuEm != null) {
        const idade = Math.floor(Date.now() / 1000) - perfil.voceSeguiuEm;
        if (idade <= 90 * DIA) {
            score += 8;
            motivos.push('Follow recente (últimos 90 dias).');
        }
    }

    return { score: Math.max(0, Math.min(100, score)), motivos };
};

/**
 * Análise principal.
 * @param {Array} snapshots  ordenados do mais antigo ao mais recente
 * @param {Set}   historico  usernames que você já resolveu (parou de seguir)
 */
export const analisar = (snapshots, historico = new Set()) => {
    const ordenados = [...snapshots].sort((a, b) => a.takenAt - b.takenAt);
    const atual = ordenados.at(-1);
    if (!atual) return { perfis: [], resumo: null, temProva: false };

    const followers = mapaDe(atual.followers);
    const following = mapaDe(atual.following);
    const temProva = ordenados.length >= 2;

    /**
     * Para cada usuário, a última vez que o vimos como seguidor e o timestamp
     * original em que ele te seguiu — inclusive se ele já sumiu do snapshot atual.
     */
    const ultimoComoSeguidor = new Map();
    const seguiuVoceEmHistorico = new Map();
    for (const snap of ordenados) {
        for (const [user, ts] of Object.entries(snap.followers ?? {})) {
            ultimoComoSeguidor.set(user, snap.takenAt);
            if (!seguiuVoceEmHistorico.has(user) && ts != null) seguiuVoceEmHistorico.set(user, ts);
        }
    }

    const candidatos = new Set([...following.keys(), ...ultimoComoSeguidor.keys(), ...followers.keys()]);
    const perfis = [];

    for (const user of candidatos) {
        const voceSegueAgora = following.has(user);
        const teSegueAgora = followers.has(user);
        const jaTeSeguiu = ultimoComoSeguidor.has(user);

        // Relações intactas ou que você já resolveu não entram no ranking.
        if (!voceSegueAgora && !teSegueAgora) continue;

        const voceSeguiuEm = following.get(user) ?? null;
        const seguiuVoceEm = followers.get(user) ?? seguiuVoceEmHistorico.get(user) ?? null;

        const delta =
            voceSeguiuEm != null && seguiuVoceEm != null ? voceSeguiuEm - seguiuVoceEm : null;
        const trocaInstantanea = delta != null && Math.abs(delta) <= JANELA_TROCA_INSTANTANEA;
        const quemVeioPrimeiro =
            delta == null ? null : trocaInstantanea ? 'SIMULTANEO' : delta > 0 ? 'ELES' : 'VOCE';

        // Em qual intervalo ele deixou de te seguir?
        let perdidoEntre = null;
        if (jaTeSeguiu && !teSegueAgora) {
            const visto = ultimoComoSeguidor.get(user);
            const posterior = ordenados.find((s) => s.takenAt > visto);
            if (posterior) perdidoEntre = [visto, posterior.takenAt];
        }

        let veredito;
        if (!voceSegueAgora && teSegueAgora) {
            veredito = VEREDITO.SO_TE_SEGUE;
        } else if (voceSegueAgora && teSegueAgora) {
            veredito = VEREDITO.MUTUO;
        } else if (perdidoEntre) {
            // Provado: ele veio primeiro, você retribuiu, ele largou.
            veredito =
                quemVeioPrimeiro === 'ELES' || quemVeioPrimeiro === 'SIMULTANEO'
                    ? VEREDITO.BAIT_PROVADO
                    : VEREDITO.SUMIU;
        } else if (temProva) {
            veredito = VEREDITO.NUNCA_RETRIBUIU;
        } else {
            const recente =
                voceSeguiuEm != null && Math.floor(Date.now() / 1000) - voceSeguiuEm <= 180 * DIA;
            veredito = recente ? VEREDITO.BAIT_SUSPEITO : VEREDITO.NUNCA_RETRIBUIU;
        }

        // Janela de retenção: do seu follow até o momento em que o sumiço foi detectado.
        const retencaoMaxSeg =
            perdidoEntre && voceSeguiuEm != null ? perdidoEntre[1] - voceSeguiuEm : null;
        const retencaoMinSeg =
            perdidoEntre && voceSeguiuEm != null
                ? Math.max(0, perdidoEntre[0] - voceSeguiuEm)
                : null;

        const perfil = {
            user,
            voceSegueAgora,
            teSegueAgora,
            voceSeguiuEm,
            seguiuVoceEm,
            deltaSeg: delta,
            trocaInstantanea,
            quemVeioPrimeiro,
            perdidoEntre,
            retencaoMinSeg,
            retencaoMaxSeg,
            veredito,
            resolvido: historico.has(user)
        };

        Object.assign(perfil, calcularScore(perfil));
        perfis.push(perfil);
    }

    perfis.sort((a, b) => b.score - a.score || (b.voceSeguiuEm ?? 0) - (a.voceSeguiuEm ?? 0));

    const conta = (v) => perfis.filter((p) => p.veredito === v && !p.resolvido).length;
    const resumo = {
        snapshots: ordenados.length,
        primeiroSnapshot: ordenados[0].takenAt,
        ultimoSnapshot: atual.takenAt,
        seguidores: followers.size,
        seguindo: following.size,
        temProva,
        baitProvado: conta(VEREDITO.BAIT_PROVADO),
        sumiu: conta(VEREDITO.SUMIU),
        baitSuspeito: conta(VEREDITO.BAIT_SUSPEITO),
        nuncaRetribuiu: conta(VEREDITO.NUNCA_RETRIBUIU),
        mutuos: conta(VEREDITO.MUTUO),
        soTeSeguem: conta(VEREDITO.SO_TE_SEGUE),
        trocasInstantaneas: perfis.filter((p) => p.trocaInstantanea).length
    };
    resumo.naoRetribuem = resumo.baitProvado + resumo.sumiu + resumo.baitSuspeito + resumo.nuncaRetribuiu;
    resumo.taxaReciprocidade = resumo.seguindo ? resumo.mutuos / resumo.seguindo : 0;

    return { perfis, resumo, temProva, eventos: temProva ? diffSnapshots(ordenados.at(-2), atual) : [] };
};

/** Formata uma duração em segundos de forma legível. */
export const formatarDuracao = (seg) => {
    if (seg == null) return '—';
    if (seg < 60) return `${Math.round(seg)}s`;
    if (seg < 3600) return `${Math.round(seg / 60)}min`;
    if (seg < DIA) return `${Math.round(seg / 3600)}h`;
    if (seg < 30 * DIA) return `${Math.round(seg / DIA)}d`;
    if (seg < 365 * DIA) {
        const meses = Math.round(seg / (30 * DIA));
        return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
    }
    return `${(seg / (365 * DIA)).toFixed(1)} anos`;
};

export const formatarData = (ts) =>
    ts == null ? '—' : new Date(ts * 1000).toLocaleDateString('pt-BR');
