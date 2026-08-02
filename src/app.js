import { StorageService } from './storage.js';
import { ParserService } from './parser.js';
import { dom, UIService, ABAS } from './ui.js';
import { analisar, criarSnapshot, formatarData } from './analysis.js';

const AppState = {
    followers: new Map(),   // username -> quando ELE te seguiu
    following: new Map(),   // username -> quando VOCÊ seguiu
    snapshots: [],
    historico: new Set(),
    carregadoDeArquivo: false,
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
    // Só entra como snapshot provisório o que o usuário acabou de carregar de
    // arquivo. Quando os dados vêm de um snapshot já salvo, incluí-los de novo
    // duplicaria a mesma leitura e podia derrubar um snapshot real da análise.
    const provisorio =
        AppState.carregadoDeArquivo && temDadosCarregados()
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
        AppState.carregadoDeArquivo = true;
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
        atualizarRotuloSnapshot();
        reanalisar();
    } catch (erro) {
        UIService.toast(erro.message, 'erro');
    }
};

/** Mostra a data deduzida do export para o usuário conferir antes de salvar. */
const atualizarRotuloSnapshot = () => {
    if (!temDadosCarregados()) {
        dom.btnSalvarSnapshot.textContent = 'Salvar como snapshot';
        return;
    }
    const { takenAt } = criarSnapshot(AppState.followers, AppState.following);
    dom.btnSalvarSnapshot.textContent = `Salvar snapshot de ${formatarData(takenAt)}`;
};

const salvarSnapshot = async () => {
    if (!temDadosCarregados()) return;
    dom.btnSalvarSnapshot.disabled = true;
    try {
        const snapshot = criarSnapshot(AppState.followers, AppState.following);
        const r = await StorageService.salvarSnapshot(snapshot);
        AppState.snapshots = await StorageService.carregarSnapshots();
        AppState.carregadoDeArquivo = false;
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
        atualizarRotuloSnapshot();
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
