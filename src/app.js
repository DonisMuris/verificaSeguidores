import { StorageService } from './storage.js';
import { ParserService } from './parser.js';
import { dom, UIService } from './ui.js';

const AppState = {
    followers: new Set(),
    following: new Set(),
    unfollowersFiltered: [],
    historyUnfollowed: new Set(),
    currentPage: 1
};

// Lógica Core de cálculo cruzado (Aritmética de Conjuntos)
const processarAnaliseRelacoes = () => {
    if (AppState.following.size === 0) return;

    const rawUnfollowers = [...AppState.following]
        .filter(user => !AppState.followers.has(user));

    AppState.unfollowersFiltered = rawUnfollowers
        .filter(user => !AppState.historyUnfollowed.has(user))
        .sort();

    UIService.atualizarPainelContagem(
        AppState.followers.size,
        AppState.following.size,
        AppState.unfollowersFiltered.length
    );

    dom.searchInput.disabled = false;
    filtrarERenderizarVisualizacao();
};

const filtrarERenderizarVisualizacao = () => {
    const query = dom.searchInput.value.toLowerCase().trim();
    const listaFiltrada = AppState.unfollowersFiltered.filter(user => 
        user.toLowerCase().includes(query)
    );

    dom.listTitle.textContent = `Perfis Pendentes (${listaFiltrada.length})`;
    
    UIService.renderizarGrade(listaFiltrada, AppState.currentPage, async (userMarcado) => {
        // 1. Atualiza o estado visual na hora (UX Otimista)
        AppState.historyUnfollowed.add(userMarcado);
        UIService.atualizarBotaoReset(AppState.historyUnfollowed.size);
        processarAnaliseRelacoes();

        // 2. Persiste em background no banco físico
        await StorageService.salvarHistorico(AppState.historyUnfollowed);
    });

    UIService.renderizarControlesPaginacao(listaFiltrada.length, AppState.currentPage, (novaPagina) => {
        AppState.currentPage = novaPagina;
        filtrarERenderizarVisualizacao();
    });
};

// --- LISTENERS DE UPLOAD (Sincronizam imediatamente com o Back-End) ---

dom.followersInput.addEventListener('change', async (e) => {
    if (!e.target.files[0]) return;
    try {
        const json = await ParserService.lerArquivoAsync(e.target.files[0]);
        AppState.followers = ParserService.extrairSeguidores(json);
        UIService.atualizarStatusUpload(dom.statusFollowers, AppState.followers.size);
        
        // Salva o novo estado no servidor
        await StorageService.salvarCacheMeta(AppState.followers, AppState.following);
        dom.btnVerificar.disabled = !(AppState.followers.size > 0 && AppState.following.size > 0);
    } catch (err) { alert(err); }
});

dom.followingInput.addEventListener('change', async (e) => {
    if (!e.target.files[0]) return;
    try {
        const json = await ParserService.lerArquivoAsync(e.target.files[0]);
        AppState.following = ParserService.extrairSeguindo(json);
        UIService.atualizarStatusUpload(dom.statusFollowing, AppState.following.size);
        
        // Salva o novo estado no servidor
        await StorageService.salvarCacheMeta(AppState.followers, AppState.following);
        dom.btnVerificar.disabled = !(AppState.followers.size > 0 && AppState.following.size > 0);
    } catch (err) { alert(err); }
});

dom.btnVerificar.addEventListener('click', () => {
    AppState.currentPage = 1;
    processarAnaliseRelacoes();
});

dom.searchInput.addEventListener('input', () => {
    AppState.currentPage = 1;
    filtrarERenderizarVisualizacao();
});

dom.btnResetHistory.addEventListener('click', async () => {
    if (confirm("Deseja limpar o histórico de unfollows?")) {
        await StorageService.limparHistorico();
        AppState.historyUnfollowed.clear();
        UIService.atualizarBotaoReset(0);
        processarAnaliseRelacoes();
    }
});

// --- FLUXO DE INICIALIZAÇÃO INTELIGENTE ---
const inicializarAplicacao = async () => {
    // 1. Carrega o histórico de unfollows do servidor
    AppState.historyUnfollowed = await StorageService.carregarHistorico();
    UIService.atualizarBotaoReset(AppState.historyUnfollowed.size);

    // 2. Tenta carregar o cache salvo das listas de seguidores/seguindo do servidor
    const cache = await StorageService.carregarCacheMeta();
    
    if (cache.followers.size > 0 || cache.following.size > 0) {
        AppState.followers = cache.followers;
        AppState.following = cache.following;
        
        UIService.atualizarStatusUpload(dom.statusFollowers, AppState.followers.size, true);
        UIService.atualizarStatusUpload(dom.statusFollowing, AppState.following.size, true);
        
        processarAnaliseRelacoes();
        return;
    }

    // 3. Fallback: Se o servidor estiver zerado, tenta a varredura automática tradicional de arquivos raw na pasta /data
    try {
        const [resFollowers, resFollowing] = await Promise.all([
            fetch('data/followers_1.json'),
            fetch('data/following.json')
        ]);
        if (!resFollowers.ok || !resFollowing.ok) throw new Error();

        AppState.followers = ParserService.extrairSeguidores(await resFollowers.json());
        AppState.following = ParserService.extrairSeguindo(await resFollowing.json());

        UIService.atualizarStatusUpload(dom.statusFollowers, AppState.followers.size, true);
        UIService.atualizarStatusUpload(dom.statusFollowing, AppState.following.size, true);

        // Deixa o cache salvo no servidor para os próximos carregamentos
        await StorageService.salvarCacheMeta(AppState.followers, AppState.following);
        processarAnaliseRelacoes();
    } catch {
        dom.statusFollowers.textContent = "Aguardando upload manual...";
        dom.statusFollowing.textContent = "Aguardando upload manual...";
    }
};

document.addEventListener('DOMContentLoaded', inicializarAplicacao);