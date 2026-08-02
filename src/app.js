import { StorageService } from './storage.js';
import { ParserService } from './parser.js';
import { dom, UIService, ABAS } from './ui.js';
import { analisar, criarSnapshot, formatarData, resolverDataDoExport } from './analysis.js';

const AppState = {
    followers: new Map(),   // username -> quando ELE te seguiu
    following: new Map(),   // username -> quando VOCÊ seguiu
    snapshots: [],
    historico: new Set(),
    carregadoDeArquivo: false,
    mtimeArquivos: null,      // File.lastModified dos JSONs carregados
    dataManual: null,         // data que o usuário digitou, se houver
    perfis: [],
    resumo: null,
    aba: 'RANKING',
    pagina: 1
};

const ORDENADORES = {
    score: (a, b) => b.score - a.score,
    recente: (a, b) => (b.voceSeguiuEm ?? 0) - (a.voceSeguiuEm ?? 0),
    antigo: (a, b) => (a.voceSeguiuEm ?? Infinity) - (b.voceSeguiuEm ?? Infinity),
    alfabetica: (a, b) => a.user.localeCompare(b.user)
};

const temDadosCarregados = () => AppState.followers.size > 0 && AppState.following.size > 0;

const SEG_DIA = 86400;
const paraInputDate = (ts) => new Date(ts * 1000).toISOString().slice(0, 10);
/** Meio-dia UTC evita que o fuso jogue a data para o dia anterior. */
const deInputDate = (valor) => Math.floor(new Date(`${valor}T12:00:00Z`).getTime() / 1000);

/**
 * Data que será gravada no snapshot. O usuário manda; na ausência dele, o
 * mtime do arquivo; e só então o conteúdo.
 */
const dataDoExport = () => {
    if (AppState.dataManual) return { takenAt: AppState.dataManual, origem: 'manual' };
    return resolverDataDoExport({
        followers: AppState.followers,
        following: AppState.following,
        mtime: AppState.mtimeArquivos
    });
};

// -------------------------------------------------------------- análise e render

const reanalisar = () => {
    // Só entra como snapshot provisório o que o usuário acabou de carregar de
    // arquivo. Quando os dados vêm de um snapshot já salvo, incluí-los de novo
    // duplicaria a mesma leitura e podia derrubar um snapshot real da análise.
    const provisorio =
        AppState.carregadoDeArquivo && temDadosCarregados()
            ? [criarSnapshot(AppState.followers, AppState.following, dataDoExport().takenAt)]
            : [];
    const salvosAnteriores = AppState.snapshots.filter(
        (s) => !provisorio.length || Math.abs(s.takenAt - provisorio[0].takenAt) >= SEG_DIA
    );

    const { perfis, resumo } = analisar([...salvosAnteriores, ...provisorio], AppState.historico);
    AppState.perfis = perfis;
    AppState.resumo = resumo;

    UIService.renderizarResumo(resumo);
    UIService.renderizarAvisoProva(resumo);
    UIService.renderizarLinhaDoTempo(AppState.snapshots);
    UIService.renderizarAbas(perfis, AppState.aba, trocarAba);
    renderizarLista();
};

const listaVisivel = () => {
    const aba = ABAS.find((a) => a.id === AppState.aba) ?? ABAS[0];
    const busca = dom.searchInput.value.trim().toLowerCase();
    return AppState.perfis
        .filter((p) => !p.resolvido && aba.filtro(p) && (!busca || p.user.includes(busca)))
        .sort(ORDENADORES[dom.ordenacao.value] ?? ORDENADORES.score);
};

const renderizarLista = () => {
    const lista = listaVisivel();
    const aba = ABAS.find((a) => a.id === AppState.aba) ?? ABAS[0];
    dom.listTitle.textContent = `${aba.rotulo} — ${lista.length} perfis`;
    dom.searchInput.disabled = !AppState.perfis.length;

    UIService.renderizarGrade(lista, AppState.pagina, resolverPerfil);
    UIService.renderizarControlesPaginacao(lista.length, AppState.pagina, (novaPagina) => {
        AppState.pagina = novaPagina;
        renderizarLista();
    });
};

const trocarAba = (id) => {
    AppState.aba = id;
    AppState.pagina = 1;
    UIService.renderizarAbas(AppState.perfis, AppState.aba, trocarAba);
    renderizarLista();
};

/**
 * Marca um perfil como resolvido. Com rollback: se a gravação falhar, o perfil
 * volta para a lista em vez de sumir da tela e continuar no disco.
 */
const resolverPerfil = async (user, botao) => {
    if (botao) botao.disabled = true;
    AppState.historico.add(user);
    const alvo = AppState.perfis.find((p) => p.user === user);
    if (alvo) alvo.resolvido = true;

    UIService.renderizarAbas(AppState.perfis, AppState.aba, trocarAba);
    renderizarLista();

    try {
        await StorageService.salvarHistorico(AppState.historico);
        UIService.atualizarBotaoReset(AppState.historico.size);
    } catch (erro) {
        AppState.historico.delete(user);
        if (alvo) alvo.resolvido = false;
        UIService.toast(`Não deu para salvar: ${erro.message}`, 'erro');
        UIService.renderizarAbas(AppState.perfis, AppState.aba, trocarAba);
        renderizarLista();
    }
};

// -------------------------------------------------------------- entrada de arquivos

const carregarArquivos = async (fileList, tipo) => {
    if (!fileList?.length) return;
    try {
        const jsons = await ParserService.lerArquivosAsync(fileList);
        AppState.carregadoDeArquivo = true;
        AppState.dataManual = null;
        const mtime = ParserService.dataDeModificacao(fileList);
        if (mtime) AppState.mtimeArquivos = Math.max(AppState.mtimeArquivos ?? 0, mtime);
        if (tipo === 'followers') {
            AppState.followers = ParserService.extrairSeguidores(...jsons);
            UIService.atualizarStatusUpload(
                dom.statusFollowers,
                AppState.followers.size,
                fileList.length > 1 ? `${fileList.length} arquivos` : 'Carregado'
            );
        } else {
            AppState.following = ParserService.extrairSeguindo(...jsons);
            UIService.atualizarStatusUpload(dom.statusFollowing, AppState.following.size);
        }
        dom.btnSalvarSnapshot.disabled = !temDadosCarregados();
        atualizarCampoData();
        reanalisar();
    } catch (erro) {
        UIService.toast(erro.message, 'erro');
    }
};

const ROTULO_ORIGEM = {
    arquivo: 'detectada da data do arquivo',
    conteudo: 'estimada pelo conteúdo — confira',
    manual: 'definida por você'
};

/** Mostra a data que será gravada, para o usuário conferir e corrigir. */
const atualizarCampoData = () => {
    if (!temDadosCarregados()) {
        dom.dataSnapshot.disabled = true;
        dom.dataSnapshot.value = '';
        dom.origemData.textContent = 'carregue os arquivos';
        dom.btnSalvarSnapshot.textContent = 'Salvar como snapshot';
        return;
    }
    const { takenAt, origem } = dataDoExport();
    dom.dataSnapshot.disabled = false;
    dom.dataSnapshot.value = paraInputDate(takenAt);
    dom.dataSnapshot.max = paraInputDate(Math.floor(Date.now() / 1000));
    dom.origemData.textContent = ROTULO_ORIGEM[origem];
    dom.btnSalvarSnapshot.textContent = `Salvar snapshot de ${formatarData(takenAt)}`;
};

const salvarSnapshot = async () => {
    if (!temDadosCarregados()) return;
    dom.btnSalvarSnapshot.disabled = true;
    try {
        const { takenAt } = dataDoExport();
        const snapshot = criarSnapshot(AppState.followers, AppState.following, takenAt);

        let r = await StorageService.salvarSnapshot(snapshot);

        // Já existe snapshot nesse dia. Substituir apaga a evidência do
        // intervalo, então a decisão é do usuário, nunca automática.
        if (r.conflito) {
            const dia = formatarData(r.existente);
            const confirmado = confirm(
                `Já existe um snapshot de ${dia}.\n\n` +
                'Substituir apaga o anterior e você perde a comparação daquele intervalo. ' +
                'Se este export é de outra data, cancele e corrija a data antes de salvar.\n\n' +
                'Substituir mesmo assim?'
            );
            if (!confirmado) {
                UIService.toast('Nada foi alterado. Ajuste a data e tente de novo.', 'info');
                return;
            }
            r = await StorageService.salvarSnapshot(snapshot, { substituir: true });
        }

        AppState.snapshots = await StorageService.carregarSnapshots();
        AppState.carregadoDeArquivo = false;
        UIService.toast(
            r.substituido
                ? `Snapshot de ${formatarData(takenAt)} atualizado.`
                : `Snapshot de ${formatarData(takenAt)} salvo. Total: ${r.total}.`,
            'ok'
        );
        reanalisar();
    } catch (erro) {
        UIService.toast(`Falha ao salvar snapshot: ${erro.message}`, 'erro');
    } finally {
        dom.btnSalvarSnapshot.disabled = !temDadosCarregados();
    }
};

dom.dataSnapshot?.addEventListener('change', () => {
    const valor = dom.dataSnapshot.value;
    AppState.dataManual = valor ? deInputDate(valor) : null;
    atualizarCampoData();
});

// -------------------------------------------------------------- listeners

dom.followersInput.addEventListener('change', (e) => carregarArquivos(e.target.files, 'followers'));
dom.followingInput.addEventListener('change', (e) => carregarArquivos(e.target.files, 'following'));
dom.btnSalvarSnapshot.addEventListener('click', salvarSnapshot);
dom.ordenacao.addEventListener('change', () => {
    AppState.pagina = 1;
    renderizarLista();
});

let debounce;
dom.searchInput.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
        AppState.pagina = 1;
        renderizarLista();
    }, 150);
});

dom.btnExportarBackup?.addEventListener('click', async () => {
    try {
        if (StorageService.exportarBackup) {
            const total = await StorageService.exportarBackup();
            UIService.toast(`Backup gerado com ${total} snapshot(s).`, 'ok');
        } else {
            // No modo servidor os dados já estão em disco, em data/snapshots.json.
            UIService.toast('Seus dados já estão salvos na pasta data/ do projeto.', 'info');
        }
    } catch (erro) {
        UIService.toast(erro.message, 'erro');
    }
});

dom.inputImportarBackup?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
        if (!StorageService.importarBackup) {
            throw new Error('No modo servidor, restaure copiando o arquivo para data/snapshots.json.');
        }
        const total = await StorageService.importarBackup(file);
        AppState.snapshots = await StorageService.carregarSnapshots();
        AppState.historico = await StorageService.carregarHistorico();
        UIService.atualizarBotaoReset(AppState.historico.size);

        const ultimo = AppState.snapshots.at(-1);
        if (ultimo) {
            AppState.followers = new Map(Object.entries(ultimo.followers ?? {}));
            AppState.following = new Map(Object.entries(ultimo.following ?? {}));
            UIService.atualizarStatusUpload(dom.statusFollowers, AppState.followers.size, 'Do backup');
            UIService.atualizarStatusUpload(dom.statusFollowing, AppState.following.size, 'Do backup');
            dom.btnSalvarSnapshot.disabled = false;
        }
        UIService.toast(`Backup restaurado. ${total} snapshot(s) disponíveis.`, 'ok');
        reanalisar();
    } catch (erro) {
        UIService.toast(erro.message, 'erro');
    } finally {
        e.target.value = '';
    }
});

dom.btnResetHistory.addEventListener('click', async () => {
    if (!confirm('Limpar o histórico de perfis que você já resolveu?')) return;
    try {
        await StorageService.limparHistorico();
        AppState.historico.clear();
        AppState.perfis.forEach((p) => (p.resolvido = false));
        UIService.atualizarBotaoReset(0);
        reanalisar();
    } catch (erro) {
        UIService.toast(erro.message, 'erro');
    }
});

// -------------------------------------------------------------- inicialização

const inicializar = async () => {
    const [historico, snapshots] = await Promise.all([
        StorageService.carregarHistorico(),
        StorageService.carregarSnapshots()
    ]);

    AppState.historico = historico;
    AppState.snapshots = snapshots;
    UIService.atualizarBotaoReset(historico.size);

    // Reidrata o último snapshot salvo para a tela já abrir com dados.
    const ultimo = snapshots.at(-1);
    if (ultimo) {
        AppState.followers = new Map(Object.entries(ultimo.followers ?? {}));
        AppState.following = new Map(Object.entries(ultimo.following ?? {}));
        UIService.atualizarStatusUpload(dom.statusFollowers, AppState.followers.size, 'Do snapshot');
        UIService.atualizarStatusUpload(dom.statusFollowing, AppState.following.size, 'Do snapshot');
        dom.btnSalvarSnapshot.disabled = false;
        atualizarCampoData();
    } else {
        dom.statusFollowers.textContent = 'Aguardando arquivo…';
        dom.statusFollowing.textContent = 'Aguardando arquivo…';
    }

    // Navegador bloqueando o armazenamento local: o app funciona, mas esquece tudo ao fechar.
    if (StorageService.persistente === false) {
        UIService.toast(
            'Seu navegador não permite salvar dados neste modo. Use o botão Backup antes de fechar.',
            'erro'
        );
    }

    reanalisar();
};

document.addEventListener('DOMContentLoaded', inicializar);
