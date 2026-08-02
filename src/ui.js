import { VEREDITO, ROTULO_VEREDITO, formatarDuracao, formatarData } from './analysis.js';
import { el } from './dom-utils.js';
import { icone, iniciais } from './icones.js';

export const dom = {
    followersInput: document.getElementById('followersInput'),
    followingInput: document.getElementById('followingInput'),
    btnSalvarSnapshot: document.getElementById('btnSalvarSnapshot'),
    dataSnapshot: document.getElementById('dataSnapshot'),
    origemData: document.getElementById('origem-data'),
    searchInput: document.getElementById('searchInput'),
    ordenacao: document.getElementById('ordenacao'),
    btnResetHistory: document.getElementById('btnResetHistory'),
    btnTriagem: document.getElementById('btnTriagem'),
    btnTema: document.getElementById('btnTema'),
    btnExportarBackup: document.getElementById('btnExportarBackup'),
    inputImportarBackup: document.getElementById('inputImportarBackup'),
    usersGrid: document.getElementById('users-grid'),
    paginationControls: document.getElementById('pagination-controls'),
    statusFollowers: document.getElementById('status-followers'),
    statusFollowing: document.getElementById('status-following'),
    statsBar: document.getElementById('stats-bar'),
    abas: document.getElementById('abas'),
    listTitle: document.getElementById('list-title'),
    avisoProva: document.getElementById('aviso-prova'),
    linhaDoTempo: document.getElementById('linha-do-tempo'),
    marcaIcone: document.getElementById('marca-icone'),
    seloModo: document.getElementById('selo-modo'),
    iconeBusca: document.getElementById('icone-busca'),
    iconeRestaurar: document.getElementById('icone-restaurar')
};

const CLASSE_BADGE = {
    [VEREDITO.BAIT_PROVADO]: 'badge badge-critico',
    [VEREDITO.SUMIU]: 'badge badge-alerta',
    [VEREDITO.BAIT_SUSPEITO]: 'badge badge-atencao',
    [VEREDITO.NUNCA_RETRIBUIU]: 'badge badge-neutro',
    [VEREDITO.MUTUO]: 'badge badge-ok',
    [VEREDITO.SO_TE_SEGUE]: 'badge badge-ok'
};

/** Rótulo curto para o segmentado; `titulo` carrega a explicação completa. */
export const ABAS = [
    { id: 'RANKING', rotulo: 'Iscas', titulo: 'Ranking de risco', filtro: (p) => p.score > 0 },
    { id: VEREDITO.BAIT_PROVADO, rotulo: 'Confirmadas', titulo: 'Isca confirmada entre dois snapshots', filtro: (p) => p.veredito === VEREDITO.BAIT_PROVADO },
    { id: VEREDITO.SUMIU, rotulo: 'Te largaram', titulo: 'Te seguiam antes e não seguem mais', filtro: (p) => p.veredito === VEREDITO.SUMIU },
    { id: 'NAO_RETRIBUEM', rotulo: 'Não seguem', titulo: 'Você segue e não há retorno', filtro: (p) => p.veredito === VEREDITO.NUNCA_RETRIBUIU || p.veredito === VEREDITO.BAIT_SUSPEITO },
    { id: VEREDITO.SO_TE_SEGUE, rotulo: 'Te seguem', titulo: 'Te seguem sem retribuição sua', filtro: (p) => p.veredito === VEREDITO.SO_TE_SEGUE }
];

/** Faixa de risco, usada por avatar, medidor e badge. */
const nivelRisco = (score) => (score >= 70 ? 'alto' : score >= 30 ? 'medio' : 'baixo');

export const UIService = {
    itemsPerPage: 24,

    /** Cartão de métrica: rótulo, número, nota e barra opcional de proporção. */
    criarCartao({ rotulo, numero, nota, notaPerigo, proporcao, perigo }) {
        const box = el('div', 'stat-box');
        box.append(el('div', 'label', rotulo));

        const valor = el('div', 'valor');
        valor.append(el('span', 'number', String(numero)));
        if (nota) valor.append(el('span', `nota ${notaPerigo ? 'perigo' : ''}`, nota));
        box.append(valor);

        if (proporcao != null) {
            const trilho = el('div', 'trilho');
            const preenchido = el('i', perigo ? 'perigo' : null);
            preenchido.style.width = `${Math.min(100, Math.round(proporcao * 100))}%`;
            trilho.append(preenchido);
            box.append(trilho);
        }
        return box;
    },

    renderizarResumo(resumo) {
        dom.statsBar.replaceChildren();
        this.renderizarSeloModo(resumo);
        if (!resumo) return;

        const pctNaoRetribuem = resumo.seguindo ? resumo.naoRetribuem / resumo.seguindo : 0;

        dom.statsBar.append(
            this.criarCartao({
                rotulo: 'Não retribuem',
                numero: resumo.naoRetribuem.toLocaleString('pt-BR'),
                nota: `${Math.round(pctNaoRetribuem * 100)}%`,
                notaPerigo: true,
                proporcao: pctNaoRetribuem,
                perigo: true
            }),
            this.criarCartao({
                rotulo: 'Reciprocidade',
                numero: `${Math.round(resumo.taxaReciprocidade * 100)}%`,
                nota: `${resumo.mutuos.toLocaleString('pt-BR')} mútuos`,
                proporcao: resumo.taxaReciprocidade
            }),
            this.criarCartao({
                rotulo: 'Seguidores',
                numero: resumo.seguidores.toLocaleString('pt-BR'),
                nota: `${resumo.seguindo.toLocaleString('pt-BR')} seguindo`
            }),
            this.criarCartao({
                rotulo: resumo.temProva ? 'Iscas confirmadas' : 'Iscas prováveis',
                numero: resumo.temProva ? resumo.baitProvado : resumo.baitSuspeito,
                nota: resumo.temProva ? 'provado' : 'estimado',
                notaPerigo: resumo.temProva
            })
        );
    },

    /** Selo no topo: diz de longe se o app está provando ou supondo. */
    renderizarSeloModo(resumo) {
        if (!dom.seloModo) return;
        if (!resumo) {
            dom.seloModo.hidden = true;
            return;
        }
        dom.seloModo.hidden = false;
        dom.seloModo.className = `selo ${resumo.temProva ? 'selo-ok' : 'selo-alerta'}`;
        dom.seloModo.replaceChildren(
            icone(resumo.temProva ? 'checkCirculo' : 'alerta', 14),
            el('span', null, resumo.temProva ? 'modo prova' : 'modo suspeita')
        );
    },

    /**
     * O aviso mais importante da interface: com um snapshot só, o app não tem como
     * provar bait. Ser honesto sobre isso é o que separa esta ferramenta dos apps
     * que inventam números.
     */
    renderizarAvisoProva(resumo) {
        dom.avisoProva.replaceChildren();
        if (!resumo) return;

        const caixa = el('div', resumo.temProva ? 'aviso aviso-ok' : 'aviso');
        caixa.append(icone(resumo.temProva ? 'checkCirculo' : 'info', 18));
        const texto = el('div');

        if (resumo.temProva) {
            texto.append(
                el('strong', null, `${resumo.snapshots} snapshots comparados`),
                el('span', null,
                    `Janela de ${formatarData(resumo.primeiroSnapshot)} a ${formatarData(resumo.ultimoSnapshot)}. ` +
                    'As iscas confirmadas são provadas pela diferença entre snapshots, não estimadas.')
            );
        } else {
            texto.append(
                el('strong', null, 'Falta um segundo export para provar'),
                el('span', null,
                    'Quem te larga some do arquivo de seguidores e leva a prova junto. ' +
                    'Com dois snapshots o app confirma em vez de estimar.')
            );
        }
        caixa.append(texto);
        dom.avisoProva.append(caixa);
    },

    renderizarLinhaDoTempo(snapshots) {
        dom.linhaDoTempo.replaceChildren();
        if (!snapshots.length) return;

        const trilha = el('div', 'timeline');
        snapshots.forEach((s, i) => {
            const ponto = el('span', 'timeline-item');
            ponto.append(icone('calendario', 13), el('span', null, formatarData(s.takenAt)));
            ponto.title = `${Object.keys(s.followers ?? {}).length} seguidores · ${Object.keys(s.following ?? {}).length} seguindo`;
            if (i === snapshots.length - 1) ponto.classList.add('atual');
            trilha.append(ponto);
        });
        dom.linhaDoTempo.append(
            el('div', 'timeline-title', `Snapshots salvos (${snapshots.length})`),
            trilha
        );
    },

    renderizarAbas(perfis, abaAtiva, onTrocarAba) {
        dom.abas.replaceChildren();
        for (const aba of ABAS) {
            const total = perfis.filter((p) => aba.filtro(p) && !p.resolvido).length;
            const btn = el('button', `aba ${aba.id === abaAtiva ? 'ativa' : ''}`);
            btn.title = aba.titulo ?? aba.rotulo;
            btn.append(el('span', null, aba.rotulo), el('span', 'aba-contagem', String(total)));
            btn.addEventListener('click', () => onTrocarAba(aba.id));
            dom.abas.append(btn);
        }
    },

    atualizarStatusUpload(elemento, tamanho, origem = 'Carregado') {
        elemento.textContent = `${origem} (${tamanho})`;
        // Cor vem da CSS, não daqui: um hex cravado no JS ignoraria o tema.
        elemento.classList.add('carregado');
    },

    atualizarBotaoReset(historicoSize) {
        dom.btnResetHistory.style.display = historicoSize > 0 ? 'inline-flex' : 'none';
        dom.btnResetHistory.title = `Limpar histórico (${historicoSize})`;
        dom.btnResetHistory.replaceChildren(icone('limpar', 15));
    },

    /** Ícones que ficam fixos no HTML e não dependem de estado. */
    montarIconesFixos() {
        dom.marcaIcone?.replaceChildren(icone('marca', 17));
        dom.iconeBusca?.replaceChildren(icone('busca', 15));
        dom.iconeRestaurar?.replaceChildren(icone('subir', 15));
        dom.btnExportarBackup?.replaceChildren(icone('baixar', 15));
        dom.btnTriagem?.prepend(icone('triagem', 15));
    },

    renderizarGrade(lista, currentPage, onResolver) {
        dom.usersGrid.replaceChildren();

        if (!lista.length) {
            dom.usersGrid.append(el('div', 'status-message', 'Nenhum perfil nesta categoria.'));
            return;
        }

        const inicio = (currentPage - 1) * this.itemsPerPage;
        for (const p of lista.slice(inicio, inicio + this.itemsPerPage)) {
            dom.usersGrid.append(this.criarCard(p, onResolver));
        }
    },

    criarCard(p, onResolver) {
        const card = el('div', 'user-card');
        const nivel = nivelRisco(p.score);

        // O export da Meta não traz foto: o monograma é a única âncora visual
        // possível, e a cor dele carrega o veredito.
        const avatar = el('div', 'avatar', iniciais(p.user));
        avatar.dataset.nivel = nivel;

        const info = el('div', 'card-info');
        const topo = el('div', 'card-topo');
        const link = el('a', 'user-link', `@${p.user}`);
        link.href = `https://instagram.com/${encodeURIComponent(p.user)}/`;
        // Alvo nomeado (e não _blank): todo perfil reusa a MESMA aba.
        link.target = 'verificaSeguidoresPerfil';
        link.rel = 'noopener noreferrer';
        topo.append(link, el('span', CLASSE_BADGE[p.veredito] ?? 'badge', ROTULO_VEREDITO[p.veredito]));

        const meta = el('div', 'card-meta');
        if (p.retencaoMaxSeg != null) meta.append(el('span', null, `reteve ~${formatarDuracao(p.retencaoMaxSeg)}`));
        if (p.quemVeioPrimeiro === 'ELES') meta.append(el('span', null, 'veio primeiro'));
        if (p.quemVeioPrimeiro === 'SIMULTANEO') meta.append(el('span', null, 'troca instantânea'));
        if (p.voceSeguiuEm != null) meta.append(el('span', null, `você seguiu ${formatarData(p.voceSeguiuEm)}`));
        info.append(topo, meta);

        card.append(avatar, info);

        // Medidor: o número diz o valor, a barra deixa comparar de relance.
        if (p.score > 0) {
            const medidor = el('div', 'medidor');
            medidor.title = `Risco ${p.score} de 100`;
            medidor.append(el('span', `medidor-valor ${nivel === 'alto' ? 'perigo' : ''}`, String(p.score)));
            const trilho = el('span', 'medidor-trilho');
            const preenchido = el('i', nivel === 'alto' ? 'perigo' : nivel === 'medio' ? 'atencao' : null);
            preenchido.style.width = `${p.score}%`;
            trilho.append(preenchido);
            medidor.append(trilho);
            card.append(medidor);
        }

        const acoes = el('div', 'card-acoes');

        const btnCopiar = el('button', 'btn-icone');
        btnCopiar.title = 'Copiar @';
        btnCopiar.setAttribute('aria-label', `Copiar ${p.user}`);
        btnCopiar.append(icone('copiar', 15));
        btnCopiar.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(p.user);
                btnCopiar.replaceChildren(icone('check', 15));
                btnCopiar.classList.add('ok');
                setTimeout(() => {
                    btnCopiar.replaceChildren(icone('copiar', 15));
                    btnCopiar.classList.remove('ok');
                }, 1200);
            } catch {
                /* Área de transferência bloqueada: o @ continua visível no card. */
            }
        });
        acoes.append(btnCopiar);

        if (p.voceSegueAgora) {
            const btnResolver = el('button', 'btn-icone perigo');
            btnResolver.title = 'Marcar que parei de seguir';
            btnResolver.setAttribute('aria-label', `Marcar ${p.user} como resolvido`);
            btnResolver.append(icone('remover', 15));
            btnResolver.addEventListener('click', () => onResolver(p.user, btnResolver));
            acoes.append(btnResolver);
        }

        card.append(acoes);
        return card;
    },

    /** Paginação com janela deslizante — antes renderizava um botão por página. */
    renderizarControlesPaginacao(totalItems, currentPage, onPageChange) {
        dom.paginationControls.replaceChildren();
        const totalPages = Math.ceil(totalItems / this.itemsPerPage) || 1;
        if (totalPages <= 1) return;

        const criar = (texto, destino, desativado = false, ativo = false) => {
            const btn = el('button', `pagination-button ${ativo ? 'active' : ''}`, String(texto));
            btn.disabled = desativado;
            btn.addEventListener('click', () => {
                onPageChange(destino);
                dom.listTitle.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            dom.paginationControls.append(btn);
            return btn;
        };

        const janela = 2;
        const paginas = new Set([1, totalPages]);
        for (let i = currentPage - janela; i <= currentPage + janela; i++) {
            if (i >= 1 && i <= totalPages) paginas.add(i);
        }

        const btnAnterior = criar('', currentPage - 1, currentPage === 1);
        btnAnterior.replaceChildren(icone('esquerda', 15));
        btnAnterior.setAttribute('aria-label', 'Página anterior');
        let ultima = 0;
        for (const p of [...paginas].sort((a, b) => a - b)) {
            if (p - ultima > 1) dom.paginationControls.append(el('span', 'reticencias', '…'));
            criar(p, p, false, p === currentPage);
            ultima = p;
        }
        const btnProximo = criar('', currentPage + 1, currentPage === totalPages);
        btnProximo.replaceChildren(icone('direita', 15));
        btnProximo.setAttribute('aria-label', 'Próxima página');
    },

    toast(mensagem, tipo = 'info') {
        const t = el('div', `toast toast-${tipo}`);
        t.append(icone(tipo === 'erro' ? 'alerta' : tipo === 'ok' ? 'checkCirculo' : 'info', 16), el('span', null, mensagem));
        document.body.append(t);
        setTimeout(() => t.classList.add('sai'), 2600);
        setTimeout(() => t.remove(), 3000);
    }
};
