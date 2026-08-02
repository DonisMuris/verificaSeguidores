/**
 * Persistência sem servidor, para a versão autossuficiente (arquivo .html único).
 *
 * Expõe a MESMA interface de storage.js, então app.js funciona nos dois modos
 * sem nenhuma alteração. Aqui os dados ficam no armazenamento local do próprio
 * navegador — não há Node, nem porta, nem arquivo em disco.
 */

const CHAVE_SNAPSHOTS = 'verificaSeguidores.snapshots';
const CHAVE_HISTORICO = 'verificaSeguidores.historico';
const MAX_SNAPSHOTS = 60;

/**
 * Abrindo o arquivo direto do disco (file://), alguns navegadores bloqueiam o
 * armazenamento local — o Safari é o caso mais comum. Em vez de quebrar, o app
 * cai para memória: continua funcionando na sessão, mas os dados somem ao fechar.
 * O usuário é avisado e orientado a usar o botão Backup.
 */
const armazenamentoDisponivel = (() => {
    try {
        const teste = '__teste__';
        localStorage.setItem(teste, '1');
        localStorage.removeItem(teste);
        return true;
    } catch {
        return false;
    }
})();

const memoria = new Map();

const ler = (chave, padrao) => {
    try {
        const bruto = armazenamentoDisponivel ? localStorage.getItem(chave) : memoria.get(chave);
        return bruto ? JSON.parse(bruto) : padrao;
    } catch {
        return padrao;
    }
};

const gravar = (chave, valor) => {
    const texto = JSON.stringify(valor);
    if (!armazenamentoDisponivel) {
        memoria.set(chave, texto);
        return;
    }
    try {
        localStorage.setItem(chave, texto);
    } catch (erro) {
        if (erro.name === 'QuotaExceededError' || erro.code === 22) {
            throw new Error(
                'O armazenamento do navegador encheu. Exporte um backup e apague os snapshots mais antigos.'
            );
        }
        throw erro;
    }
};

export const StorageService = {
    modo: 'local',
    persistente: armazenamentoDisponivel,

    async carregarSnapshots() {
        const lista = ler(CHAVE_SNAPSHOTS, []);
        return Array.isArray(lista) ? lista.sort((a, b) => a.takenAt - b.takenAt) : [];
    },

    /**
     * Nunca substitui em silêncio. Se já existe snapshot no mesmo dia, devolve
     * `conflito` e cabe à interface confirmar — perder um snapshot significa
     * perder a única evidência de quem deixou de te seguir naquele intervalo.
     */
    async salvarSnapshot(snapshot, { substituir = false } = {}) {
        const snaps = await this.carregarSnapshots();
        const idx = snaps.findIndex((s) => Math.abs(s.takenAt - snapshot.takenAt) < 86400);

        if (idx >= 0 && !substituir) {
            return { conflito: true, existente: snaps[idx].takenAt, total: snaps.length };
        }

        if (idx >= 0) snaps[idx] = snapshot;
        else snaps.push(snapshot);

        snaps.sort((a, b) => a.takenAt - b.takenAt);
        const podados = snaps.slice(-MAX_SNAPSHOTS);
        gravar(CHAVE_SNAPSHOTS, podados);
        return { total: podados.length, substituido: idx >= 0 };
    },

    async apagarSnapshots() {
        gravar(CHAVE_SNAPSHOTS, []);
    },

    async carregarHistorico() {
        return new Set(ler(CHAVE_HISTORICO, []));
    },

    async salvarHistorico(historicoSet) {
        gravar(CHAVE_HISTORICO, [...historicoSet]);
    },

    async limparHistorico() {
        gravar(CHAVE_HISTORICO, []);
    },

    // ------------------------------------------------------------- backup

    /**
     * O armazenamento do navegador é apagado se você limpar os dados de navegação.
     * O backup existe para isso — e para levar o histórico a outro computador.
     */
    async exportarBackup() {
        const dados = {
            formato: 'verifica-seguidores/backup',
            versao: 1,
            geradoEm: Math.floor(Date.now() / 1000),
            snapshots: await this.carregarSnapshots(),
            historico: [...(await this.carregarHistorico())]
        };

        const blob = new Blob([JSON.stringify(dados)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const data = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `verifica-seguidores-backup-${data}.json`;
        a.click();
        URL.revokeObjectURL(url);
        return dados.snapshots.length;
    },

    async importarBackup(file) {
        let dados;
        try {
            dados = JSON.parse(await file.text());
        } catch {
            throw new Error('Arquivo de backup inválido.');
        }
        if (!Array.isArray(dados?.snapshots)) {
            throw new Error('Este arquivo não é um backup do Verifica Seguidores.');
        }

        // Mescla com o que já existe, sem duplicar snapshots do mesmo dia.
        const atuais = await this.carregarSnapshots();
        for (const snap of dados.snapshots) {
            if (!Number.isFinite(snap?.takenAt)) continue;
            const idx = atuais.findIndex((s) => Math.abs(s.takenAt - snap.takenAt) < 86400);
            if (idx >= 0) atuais[idx] = snap;
            else atuais.push(snap);
        }
        atuais.sort((a, b) => a.takenAt - b.takenAt);
        gravar(CHAVE_SNAPSHOTS, atuais.slice(-MAX_SNAPSHOTS));

        if (Array.isArray(dados.historico)) {
            const historico = await this.carregarHistorico();
            dados.historico.forEach((u) => historico.add(u));
            gravar(CHAVE_HISTORICO, [...historico]);
        }
        return atuais.length;
    }
};
