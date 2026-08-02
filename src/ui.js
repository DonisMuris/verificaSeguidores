import { VEREDITO, ROTULO_VEREDITO, formatarDuracao, formatarData } from './analysis.js';
import { el } from './dom-utils.js';

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
    linhaDoTempo: document.getElementById('linha-do-tempo')
};

const CLASSE_BADGE = {
    [VEREDITO.BAIT_PROVADO]: 'badge badge-critico',
    [VEREDITO.SUMIU]: 'badge badge-alerta',
    [VEREDITO.BAIT_SUSPEITO]: 'badge badge-atencao',
    [VEREDITO.NUNCA_RETRIBUIU]: 'badge badge-neutro',
    [VEREDITO.MUTUO]: 'badge badge-ok',
    [VEREDITO.SO_TE_SEGUE]: 'badge badge-ok'
};

export const ABAS = [
    { id: 'RANKING', rotulo: 'Ranking de iscas', filtro: (p) => p.score > 0 },
    { id: VEREDITO.BAIT_PROVADO, rotulo: 'Isca confirmada', filtro: (p) => p.veredito === VEREDITO.BAIT_PROVADO },
    { id: VEREDITO.SUMIU, rotulo: 'Te largaram', filtro: (p) => p.veredito === VEREDITO.SUMIU },
    { id: 'NAO_RETRIBUEM', rotulo: 'Não te seguem', filtro: (p) => p.veredito === VEREDITO.NUNCA_RETRIBUIU || p.veredito === VEREDITO.BAIT_SUSPEITO },
    { id: VEREDITO.SO_TE_SEGUE, rotulo: 'Te seguem e você não', filtro: (p) => p.veredito === VEREDITO.SO_TE_SEGUE }
];

export const UIService = {
    itemsPerPage: 24,

    renderizarResumo(resumo) {
        dom.statsBar.replaceChildren();
        if (!resumo) return;

        const caixas = [
            ['Seguidores', resumo.seguidores],
            ['Seguindo', resumo.seguindo],
            ['Não retribuem', resumo.naoRetribuem],
            ['Reciprocidade', `${Math.round(resumo.taxaReciprocidade * 100)}%`],
            [
                resumo.temProva ? 'Iscas confirmadas' : 'Iscas prováveis',
                resumo.temProva ? resumo.baitProvado : resumo.baitSuspeito
            ]
        ];

        for (const [rotulo, valor] of caixas) {
            const box = el('div', 'stat-box');
            box.append(el('div', 'number', String(valor)), el('div', 'label', rotulo));
            dom.statsBar.append(box);
        }
    },

    /**
     * O aviso mais importante da interface: com um snapshot só, o app não tem como
     * provar bait. Ser honesto sobre isso é o que separa esta ferramenta dos apps
     * que inventam números.
     */
    renderizarAvisoProva(resumo) {
        dom.avisoProva.replaceChildren();
        if (!resumo) return;

        const caixa = el('div', resumo.temProva ? 'aviso aviso-ok' : 'aviso aviso-info');

        if (resumo.temProva) {
            caixa.append(
                el('strong', null, `${resumo.snapshots} snapshots comparados. `),
                el('span', null,
                    `Janela de ${formatarData(resumo.primeiroSnapshot)} a ${formatarData(resumo.ultimoSnapshot)}. ` +
                    'Os vereditos de "isca confirmada" são provados por diferença entre snapshots, não estimados.')
            );
        } else {
            caixa.append(
                el('strong', null, 'Só um snapshot carregado. '),
                el('span', null,
                    'Quando alguém te larga, o perfil some do arquivo de seguidores e a prova vai junto — ' +
                    'por isso os vereditos abaixo são suspeitas, não confirmações. ' +
                    'Baixe um novo export daqui a alguns dias e salve como segundo snapshot: a partir daí ' +
                    'o app passa a provar exatamente quem te largou depois que você seguiu de volta.')
            );
        }
        dom.avisoProva.append(caixa);
    },

    renderizarLinhaDoTempo(snapshots) {
        dom.linhaDoTempo.replaceChildren();
        if (!snapshots.length) return;

        const trilha = el('div', 'timeline');
        snapshots.forEach((s, i) => {
            const ponto = el('span', 'timeline-item', formatarData(s.takenAt));
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
            btn.append(el('span', null, aba.rotulo), el('span', 'aba-contagem', String(total)));
            btn.addEventListener('click', () => onTrocarAba(aba.id));
            dom.abas.append(btn);
        }
    },

    atualizarStatusUpload(elemento, tamanho, origem = 'Carregado') {
        elemento.textContent = `${origem} (${tamanho})`;
        elemento.style.color = '#38bdf8';
    },

    atualizarBotaoReset(historicoSize) {
        dom.btnResetHistory.style.display = historicoSize > 0 ? 'block' : 'none';
        dom.btnResetHistory.textContent = `Limpar histórico (${historicoSize})`;
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

        const topo = el('div', 'card-topo');
        const link = el('a', 'user-link', `@${p.user}`);
        link.href = `https://instagram.com/${encodeURIComponent(p.user)}/`;
        // Alvo nomeado (e não _blank): todo perfil reusa a MESMA aba, em vez de
        // abrir uma nova a cada clique e obrigar a fechar tudo depois.
        link.target = 'verificaSeguidoresPerfil';
        link.rel = 'noopener noreferrer';
        topo.append(link, el('span', CLASSE_BADGE[p.veredito] ?? 'badge', ROTULO_VEREDITO[p.veredito]));

        const meta = el('div', 'card-meta');
        if (p.score > 0) meta.append(el('span', 'score', `Risco ${p.score}`));
        if (p.retencaoMaxSeg != null) meta.append(el('span', null, `reteve ~${formatarDuracao(p.retencaoMaxSeg)}`));
        if (p.quemVeioPrimeiro === 'ELES') meta.append(el('span', null, 'veio primeiro'));
        if (p.quemVeioPrimeiro === 'SIMULTANEO') meta.append(el('span', null, 'troca instantânea'));
        if (p.voceSeguiuEm != null) meta.append(el('span', null, `você seguiu ${formatarData(p.voceSeguiuEm)}`));

        const acoes = el('div', 'card-acoes');

        const btnCopiar = el('button', 'btn-acao', 'Copiar');
        btnCopiar.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(p.user);
                btnCopiar.textContent = 'Copiado';
                btnCopiar.classList.add('ok');
                setTimeout(() => {
                    btnCopiar.textContent = 'Copiar';
                    btnCopiar.classList.remove('ok');
                }, 1200);
            } catch {
                btnCopiar.textContent = 'Falhou';
            }
        });
        acoes.append(btnCopiar);

        if (p.voceSegueAgora) {
            const btnResolver = el('button', 'btn-acao btn-resolver', 'Parei de seguir');
            btnResolver.addEventListener('click', () => onResolver(p.user, btnResolver));
            acoes.append(btnResolver);
        }

        card.append(topo, meta);
        if (p.motivos.length) {
            const motivos = el('ul', 'card-motivos');
            for (const m of p.motivos.slice(0, 3)) motivos.append(el('li', null, m));
            card.append(motivos);
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
        };

        const janela = 2;
        const paginas = new Set([1, totalPages]);
        for (let i = currentPage - janela; i <= currentPage + janela; i++) {
            if (i >= 1 && i <= totalPages) paginas.add(i);
        }

        criar('Anterior', currentPage - 1, currentPage === 1);
        let ultima = 0;
        for (const p of [...paginas].sort((a, b) => a - b)) {
            if (p - ultima > 1) dom.paginationControls.append(el('span', 'reticencias', '…'));
            criar(p, p, false, p === currentPage);
            ultima = p;
        }
        criar('Próximo', currentPage + 1, currentPage === totalPages);
    },

    toast(mensagem, tipo = 'info') {
        const t = el('div', `toast toast-${tipo}`, mensagem);
        document.body.append(t);
        setTimeout(() => t.classList.add('sai'), 2600);
        setTimeout(() => t.remove(), 3000);
    }
};
