import { StorageService } from './storage.js';
import { ParserService } from './parser.js';
import { dom, UIService, ABAS } from './ui.js';
import { analisar, criarSnapshot } from './analysis.js';

const AppState = {
    followers: new Map(),   // username -> quando ELE te seguiu
    following: new Map(),   // username -> quando VOCÊ seguiu
    snapshots: [],
    historico: new Set(),
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

// -------------------------------------------------------------- análise e render

const reanalisar = () => {
    // Inclui o estado carregado agora como snapshot provisório (ainda não salvo).
    const provisorio = temDadosCarregados()
        ? [criarSnapshot(AppState.followers, AppState.following)]
        : [];
    const salvosAnteriores = AppState.snapshots.filter(
        (s) => !provisorio.length || Math.abs(s.takenAt - provisorio[0].takenAt) >= 86400
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
        reanalisar();
    } catch (erro) {
        UIService.toast(erro.message, 'erro');
    }
};

const salvarSnapshot = async () => {
    if (!temDadosCarregados()) return;
    dom.btnSalvarSnapshot.disabled = true;
    try {
        const snapshot = criarSnapshot(AppState.followers, AppState.following);
        const r = await StorageService.salvarSnapshot(snapshot);
        AppState.snapshots = await StorageService.carregarSnapshots();
        UIService.toast(
            r.substituido
                ? 'Snapshot de hoje atualizado.'
                : `Snapshot salvo. Total: ${r.total}.`,
            'ok'
        );
        reanalisar();
    } catch (erro) {
        UIService.toast(`Falha ao salvar snapshot: ${erro.message}`, 'erro');
    } finally {
        dom.btnSalvarSnapshot.disabled = !temDadosCarregados();
    }
};

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
    } else {
        dom.statusFollowers.textContent = 'Aguardando arquivo…';
        dom.statusFollowing.textContent = 'Aguardando arquivo…';
    }

    reanalisar();
};

document.addEventListener('DOMContentLoaded', inicializar);
