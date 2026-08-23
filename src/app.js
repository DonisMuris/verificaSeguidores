import { StorageService } from './storage.js';
import { ParserService } from './parser.js';
import { ZipService } from './zip.js';
import { dom, UIService, ABA_PADRAO, acharAba } from './ui.js';
import { analisar, criarSnapshot, formatarData, formatarDuracao, resolverDataDoExport, detectarExportParcial, ROTULO_VEREDITO } from './analysis.js';
import { TriagemService } from './triagem.js';
import { TemaService } from './tema.js';

const AppState = {
    followers: new Map(),   // username -> quando ELE te seguiu
    following: new Map(),   // username -> quando VOCÊ seguiu
    snapshots: [],
    historico: new Set(),
    origemListas: { followers: null, following: null },  // 'arquivo' | 'snapshot'
    mtimeArquivos: null,      // File.lastModified dos JSONs carregados
    dataManual: null,         // data que o usuário digitou, se houver
    exportParcial: null,      // export recortado por intervalo de datas
    perfis: [],
    resumo: null,
    aba: ABA_PADRAO,
    pagina: 1
};

/**
 * A data que importa muda por aba: em "eu não sigo de volta" não existe
 * `voceSeguiuEm`, e ordenar por ele deixava a lista inteira empatada em zero.
 */
const carimboRelevante = (p) => p.voceSeguiuEm ?? p.seguiuVoceEm ?? 0;

const ORDENADORES = {
    score: (a, b) => b.score - a.score || carimboRelevante(b) - carimboRelevante(a),
    recente: (a, b) => carimboRelevante(b) - carimboRelevante(a),
    antigo: (a, b) => (carimboRelevante(a) || Infinity) - (carimboRelevante(b) || Infinity),
    alfabetica: (a, b) => a.user.localeCompare(b.user)
};

const temDadosCarregados = () => AppState.followers.size > 0 && AppState.following.size > 0;

/**
 * As duas listas na tela vieram do MESMO export recém-carregado?
 *
 * Meia carga é armadilha: com seguidores novos e um "seguindo" reidratado do
 * snapshot anterior, a análise sai plausível e errada, e o snapshot gravado
 * carregaria duas datas diferentes. Nesse estado o app mostra o que dá, mas não
 * deixa salvar nem trata os dados como um export novo.
 */
const exportNovoNaTela = () =>
    AppState.origemListas.followers === 'arquivo' && AppState.origemListas.following === 'arquivo';

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
        exportNovoNaTela() && temDadosCarregados()
            ? [criarSnapshot(AppState.followers, AppState.following, dataDoExport().takenAt)]
            : [];
    const salvosAnteriores = AppState.snapshots.filter(
        (s) => !provisorio.length || Math.abs(s.takenAt - provisorio[0].takenAt) >= SEG_DIA
    );

    const { perfis, resumo } = analisar([...salvosAnteriores, ...provisorio], AppState.historico);
    AppState.perfis = perfis;
    AppState.resumo = resumo;

    // Enquanto não há análise, a tela inteira é o passo "traga seus arquivos".
    document.body.dataset.estado = resumo ? 'pronto' : 'vazio';
    if (!resumo) dom.guia?.setAttribute('open', '');

    UIService.renderizarContexto(resumo);
    UIService.renderizarAvisoProva(resumo);
    UIService.renderizarLinhaDoTempo(AppState.snapshots);
    UIService.renderizarNavegacao(perfis, resumo, AppState.aba, trocarAba);
    renderizarLista();
};

const listaVisivel = () => {
    const aba = acharAba(AppState.aba);
    const busca = dom.searchInput.value.trim().toLowerCase();
    return AppState.perfis
        .filter((p) => !p.resolvido && aba.filtro(p) && (!busca || p.user.includes(busca)))
        .sort(ORDENADORES[dom.ordenacao.value] ?? ORDENADORES.score);
};

const renderizarLista = () => {
    const aba = acharAba(AppState.aba);
    const lista = listaVisivel();

    dom.searchInput.disabled = !AppState.perfis.length;
    if (dom.btnTriagem) dom.btnTriagem.disabled = !lista.length;

    UIService.renderizarDescricaoAba(aba, AppState.resumo, lista.length);
    UIService.renderizarGrade(lista, AppState.pagina, aba, resolverPerfil);
    UIService.renderizarControlesPaginacao(lista.length, AppState.pagina, (novaPagina) => {
        AppState.pagina = novaPagina;
        renderizarLista();
    });
};

const trocarAba = (id) => {
    AppState.aba = id;
    AppState.pagina = 1;
    UIService.renderizarNavegacao(AppState.perfis, AppState.resumo, AppState.aba, trocarAba);
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

    UIService.renderizarNavegacao(AppState.perfis, AppState.resumo, AppState.aba, trocarAba);
    renderizarLista();

    try {
        await StorageService.salvarHistorico(AppState.historico);
        UIService.atualizarBotaoReset(AppState.historico.size);
    } catch (erro) {
        AppState.historico.delete(user);
        if (alvo) alvo.resolvido = false;
        UIService.toast(`Não deu para salvar: ${erro.message}`, 'erro');
        UIService.renderizarNavegacao(AppState.perfis, AppState.resumo, AppState.aba, trocarAba);
        renderizarLista();
    }
};

// -------------------------------------------------------------- entrada de arquivos

/**
 * Entrada única: .zip do export, .json avulsos, ou os dois misturados.
 *
 * Antes havia dois campos rotulados e o usuário tinha de acertar qual arquivo ia
 * em qual — errar aí produzia uma análise invertida sem nenhum aviso. Agora o
 * roteamento é feito pelo conteúdo (ver ParserService.classificar), então soltar
 * tudo de uma vez, em qualquer ordem, dá no mesmo.
 */
const receberArquivos = async (fileList) => {
    const arquivos = Array.from(fileList ?? []);
    if (!arquivos.length) return;

    try {
        const lotes = { followers: [], following: [] };
        const mtime = ParserService.dataDeModificacao(arquivos);

        for (const file of arquivos) {
            const conteudos = ZipService.ehZip(file)
                ? await ZipService.extrairExportInstagram(file)
                : [{ nome: file.name, json: await ParserService.lerArquivoAsync(file) }];

            for (const { nome, json } of conteudos) {
                const tipo = ParserService.classificar(json, nome);
                if (tipo) lotes[tipo].push(json);
            }
        }

        if (!lotes.followers.length && !lotes.following.length) {
            throw new Error(
                'Não reconheci nenhuma lista de seguidores ou de seguindo aqui. ' +
                    'Veja o passo a passo: o export precisa ser em JSON, com "Seguidores e seguindo" marcado.'
            );
        }

        AppState.dataManual = null;
        if (mtime) AppState.mtimeArquivos = Math.max(AppState.mtimeArquivos ?? 0, mtime);

        if (lotes.followers.length) {
            AppState.followers = ParserService.extrairSeguidores(...lotes.followers);
            AppState.origemListas.followers = 'arquivo';
            UIService.atualizarStatusUpload(
                dom.statusFollowers,
                'Seguidores',
                AppState.followers.size,
                lotes.followers.length > 1 ? `${lotes.followers.length} arquivos` : null
            );
        }
        if (lotes.following.length) {
            AppState.following = ParserService.extrairSeguindo(...lotes.following);
            AppState.origemListas.following = 'arquivo';
            UIService.atualizarStatusUpload(dom.statusFollowing, 'Seguindo', AppState.following.size);
        }

        atualizarCampoData();
        avaliarIntegridade();
        reanalisar();
        avisarSobreOQueFalta(lotes);
    } catch (erro) {
        UIService.toast(erro.message, 'erro');
    }
};

/**
 * Meia carga é pior que nenhuma: misturar seguidores novos com um "seguindo"
 * antigo produz uma análise plausível e errada. Vale um aviso explícito.
 */
const avisarSobreOQueFalta = (lotes) => {
    const faltando = !lotes.followers.length
        ? { arquivo: 'followers_1.json', rotulo: 'seguidores' }
        : !lotes.following.length
          ? { arquivo: 'following.json', rotulo: 'quem você segue' }
          : null;

    if (!faltando) {
        UIService.toast('Arquivos lidos. Salve como snapshot para comparar depois.', 'ok');
        return;
    }

    const outraOrigem = !lotes.followers.length
        ? AppState.origemListas.followers
        : AppState.origemListas.following;

    UIService.toast(
        outraOrigem === 'snapshot'
            ? `Falta a lista de ${faltando.rotulo} (${faltando.arquivo}) deste export — ` +
                  'a que está na tela veio do snapshot anterior e vai misturar as duas datas.'
            : `Falta a lista de ${faltando.rotulo} (${faltando.arquivo}).`,
        'erro'
    );
};

/**
 * Export recortado por intervalo de datas é o erro mais caro que o usuário pode
 * cometer: o arquivo parece válido e transforma seguidores antigos ausentes em
 * falsos "te largou". Avisamos assim que dá para perceber, e de novo na hora de
 * salvar — porque é o snapshot gravado que contamina a análise, não a leitura.
 */
const avaliarIntegridade = () => {
    AppState.exportParcial = null;
    if (!temDadosCarregados()) return;

    const r = detectarExportParcial(AppState.followers, AppState.following);
    if (!r.parcial) return;

    AppState.exportParcial = r;
    UIService.toast(
        `Export parece recortado: o seguidor mais antigo é de ${formatarData(r.inicioFollowers)}, ` +
            'mas você segue gente desde ' + formatarData(r.inicioFollowing) + '. ' +
            'Refaça escolhendo "Todo o período".',
        'erro'
    );
};

const ROTULO_ORIGEM = {
    arquivo: 'detectada da data do arquivo',
    conteudo: 'estimada pelo conteúdo — confira',
    manual: 'definida por você'
};

/**
 * Mostra a data que será gravada, para o usuário conferir e corrigir — e decide
 * se há o que salvar.
 *
 * Só dá para salvar o que acabou de vir de arquivo. Quando os dados na tela são
 * a reidratação do último snapshot, o botão ficava aceso oferecendo regravar o
 * que já está gravado, com uma data deduzida do conteúdo (mais antiga que a real,
 * porque o mtime do arquivo já se perdeu) — ou seja, sujando o histórico.
 */
const atualizarCampoData = () => {
    const podeSalvar = temDadosCarregados() && exportNovoNaTela();
    dom.dataSnapshot.disabled = !podeSalvar;
    dom.btnSalvarSnapshot.disabled = !podeSalvar;

    if (!podeSalvar) {
        const metadeVeioDeArquivo =
            AppState.origemListas.followers === 'arquivo' ||
            AppState.origemListas.following === 'arquivo';

        dom.dataSnapshot.value = '';
        dom.origemData.textContent = !temDadosCarregados()
            ? 'carregue os arquivos'
            : metadeVeioDeArquivo
              ? 'falta a outra metade deste export'
              : 'este export já está guardado';
        dom.btnSalvarSnapshot.textContent = 'Salvar como snapshot';
        return;
    }

    const { takenAt, origem } = dataDoExport();
    dom.dataSnapshot.value = paraInputDate(takenAt);
    dom.dataSnapshot.max = paraInputDate(Math.floor(Date.now() / 1000));
    dom.origemData.textContent = ROTULO_ORIGEM[origem];
    dom.btnSalvarSnapshot.textContent = `Salvar snapshot de ${formatarData(takenAt)}`;
};

const salvarSnapshot = async () => {
    if (!temDadosCarregados()) return;
    dom.btnSalvarSnapshot.disabled = true;
    try {
        const parcial = AppState.exportParcial;
        if (parcial) {
            const seguir = confirm(
                'Este export parece recortado por intervalo de datas.\n\n' +
                `O seguidor mais antigo é de ${formatarData(parcial.inicioFollowers)}, mas você segue ` +
                `pessoas desde ${formatarData(parcial.inicioFollowing)} — uma diferença de ` +
                `${parcial.defasagemDias} dias.\n\n` +
                'Salvar assim faz o app tratar todo seguidor antigo ausente como se tivesse te ' +
                'largado, contaminando a análise. O certo é refazer o export marcando ' +
                '"Todo o período".\n\nSalvar mesmo assim?'
            );
            if (!seguir) {
                UIService.toast('Nada foi salvo. Refaça o export com "Todo o período".', 'info');
                return;
            }
        }

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
        // Guardado: daqui em diante estes dados SÃO o snapshot, não um export solto.
        AppState.origemListas = { followers: 'snapshot', following: 'snapshot' };
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
        atualizarCampoData();
    }
};

dom.dataSnapshot?.addEventListener('change', () => {
    const valor = dom.dataSnapshot.value;
    AppState.dataManual = valor ? deInputDate(valor) : null;
    atualizarCampoData();
});

// -------------------------------------------------------------- listeners

dom.arquivosInput?.addEventListener('change', (e) => {
    receberArquivos(e.target.files);
    // Zerar permite recarregar o MESMO arquivo depois de refazer o export.
    e.target.value = '';
});

/**
 * Soltar em qualquer lugar da página vale, não só dentro do retângulo tracejado:
 * mirar a caixa certa é justamente o tipo de precisão que faz alguém desistir.
 * O contador existe porque `dragleave` dispara ao cruzar cada elemento filho.
 */
let profundidadeArrasto = 0;
const marcarArrasto = (ativo) => dom.dropzone?.classList.toggle('arrastando', ativo);

document.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    profundidadeArrasto += 1;
    marcarArrasto(true);
});
document.addEventListener('dragover', (e) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
});
document.addEventListener('dragleave', () => {
    profundidadeArrasto = Math.max(0, profundidadeArrasto - 1);
    if (!profundidadeArrasto) marcarArrasto(false);
});
document.addEventListener('drop', (e) => {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    profundidadeArrasto = 0;
    marcarArrasto(false);
    receberArquivos(e.dataTransfer.files);
});

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

dom.btnTriagem?.addEventListener('click', () => {
    const lista = listaVisivel();
    if (!lista.length) {
        UIService.toast('Nenhum perfil nesta lista para revisar.', 'info');
        return;
    }
    // Pré-formata o que a triagem exibe, para ela não depender do motor.
    const fila = lista.map((p) => ({
        ...p,
        fmtRetencao: p.retencaoMaxSeg != null ? formatarDuracao(p.retencaoMaxSeg) : null,
        fmtSeguidoEm: p.voceSeguiuEm != null ? formatarData(p.voceSeguiuEm) : null
    }));

    TriagemService.abrir(fila, {
        rotulos: ROTULO_VEREDITO,
        onResolver: (user) => resolverPerfil(user),
        onFechar: (marcados) => {
            UIService.renderizarNavegacao(AppState.perfis, AppState.resumo, AppState.aba, trocarAba);
            renderizarLista();
            if (marcados) UIService.toast(`${marcados} perfil(is) marcados na triagem.`, 'ok');
        }
    });
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
        reidratarUltimoSnapshot('Do backup');
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

/** Abre a tela já com dados: o último export guardado vale mais que uma tela vazia. */
const reidratarUltimoSnapshot = (origem) => {
    const ultimo = AppState.snapshots.at(-1);
    if (!ultimo) return false;

    AppState.followers = new Map(Object.entries(ultimo.followers ?? {}));
    AppState.following = new Map(Object.entries(ultimo.following ?? {}));
    AppState.origemListas = { followers: 'snapshot', following: 'snapshot' };
    UIService.atualizarStatusUpload(dom.statusFollowers, 'Seguidores', AppState.followers.size, origem);
    UIService.atualizarStatusUpload(dom.statusFollowing, 'Seguindo', AppState.following.size, origem);
    atualizarCampoData();
    return true;
};

const inicializar = async () => {
    UIService.montarIconesFixos();
    TemaService.iniciar(dom.btnTema);

    const [historico, snapshots] = await Promise.all([
        StorageService.carregarHistorico(),
        StorageService.carregarSnapshots()
    ]);

    AppState.historico = historico;
    AppState.snapshots = snapshots;
    UIService.atualizarBotaoReset(historico.size);
    reidratarUltimoSnapshot('do último snapshot');

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
