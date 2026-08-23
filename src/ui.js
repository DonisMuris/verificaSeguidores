import { VEREDITO, ROTULO_VEREDITO, formatarDuracao, formatarData } from './analysis.js';
import { el } from './dom-utils.js';
import { icone, iniciais } from './icones.js';

export const dom = {
    arquivosInput: document.getElementById('arquivosInput'),
    dropzone: document.getElementById('dropzone'),
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
    abaDescricao: document.getElementById('aba-descricao'),
    contexto: document.getElementById('contexto'),
    avisoProva: document.getElementById('aviso-prova'),
    linhaDoTempo: document.getElementById('linha-do-tempo'),
    guia: document.getElementById('guia'),
    marcaIcone: document.getElementById('marca-icone'),
    seloModo: document.getElementById('selo-modo'),
    iconeBusca: document.getElementById('icone-busca'),
    iconeSolta: document.getElementById('icone-solta'),
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

const pct = (v) => `${Math.round((v ?? 0) * 100)}%`;
const num = (v) => (v ?? 0).toLocaleString('pt-BR');

/**
 * As quatro perguntas que o usuário realmente faz, nesta ordem.
 *
 * Antes as abas eram nomeadas pelo vocabulário do motor ("Iscas", "Confirmadas",
 * "Não seguem", "Te seguem") — duas delas quase idênticas na leitura rápida, e a
 * diferença entre "não seguem" e "te seguem" era uma palavra. Aqui cada aba diz
 * a direção da relação por extenso, e `descricao` repete a regra logo abaixo.
 *
 * "Largaram depois que segui" é subconjunto de "não me seguem de volta"; a
 * descrição avisa disso em vez de deixar o usuário achar que os números não fecham.
 */
export const ABAS = [
    {
        id: 'NAO_ME_SEGUEM',
        rotulo: 'Não me seguem de volta',
        filtro: (p) => p.voceSegueAgora && !p.teSegueAgora,
        metrica: (resumo, total) => ({
            nota: resumo.seguindo ? `de ${num(resumo.seguindo)} que você segue` : null,
            notaPerigo: true,
            proporcao: resumo.seguindo ? total / resumo.seguindo : 0,
            perigo: true
        }),
        descricao: () =>
            'Você segue estes perfis e não recebe follow de volta. É daqui que sai a limpeza da sua lista.'
    },
    {
        id: 'LARGARAM',
        rotulo: 'Largaram depois que eu segui',
        filtro: (p) =>
            p.veredito === VEREDITO.BAIT_PROVADO ||
            p.veredito === VEREDITO.SUMIU ||
            p.veredito === VEREDITO.BAIT_SUSPEITO,
        metrica: (resumo) => ({
            nota: resumo.temProva ? 'confirmado' : 'suspeita',
            notaPerigo: resumo.temProva
        }),
        descricao: (resumo) =>
            resumo.temProva
                ? 'Estavam nos seus seguidores num export anterior e sumiram no seguinte — enquanto você continua seguindo. Isto é comparação entre snapshots, não estimativa.'
                : 'Suspeitas, não prova: são follows recentes seus que nunca voltaram. Quem te larga some da lista sem deixar rastro, então só um segundo export mostra quem realmente removeu o follow.',
        rodape: 'Estes perfis também aparecem em "Não me seguem de volta".'
    },
    {
        id: 'NAO_SIGO',
        rotulo: 'Eu não sigo de volta',
        filtro: (p) => p.veredito === VEREDITO.SO_TE_SEGUE,
        metrica: (resumo) => ({ nota: `de ${num(resumo.seguidores)} seguidores` }),
        descricao: () => 'Seguem você e você ainda não retribuiu.'
    },
    {
        id: 'MUTUOS',
        rotulo: 'Seguem-se mutuamente',
        filtro: (p) => p.veredito === VEREDITO.MUTUO,
        metrica: (resumo) => ({
            nota: `${pct(resumo.taxaReciprocidade)} de reciprocidade`,
            proporcao: resumo.taxaReciprocidade
        }),
        descricao: () => 'Vocês dois se seguem. Nada a fazer aqui — está listado só para fechar a conta.'
    }
];

export const ABA_PADRAO = ABAS[0].id;

export const acharAba = (id) => ABAS.find((a) => a.id === id) ?? ABAS[0];

/** Faixa de risco, usada por avatar, medidor e badge. */
const nivelRisco = (score) => (score >= 70 ? 'alto' : score >= 30 ? 'medio' : 'baixo');

const contarAba = (perfis, aba) => perfis.filter((p) => !p.resolvido && aba.filtro(p)).length;

export const UIService = {
    itemsPerPage: 24,

    /**
     * Cartões de métrica E navegação ao mesmo tempo.
     *
     * Antes eram dois controles empilhados: uma barra de números e, logo abaixo,
     * um segmentado de abas que filtrava por esses mesmos números. Unir os dois
     * elimina a tradução mental entre "N não retribuem" e a aba que os mostra.
     */
    renderizarNavegacao(perfis, resumo, abaAtiva, onTrocarAba) {
        dom.statsBar.replaceChildren();
        this.renderizarSeloModo(resumo);
        if (!resumo) return;

        for (const aba of ABAS) {
            const total = contarAba(perfis, aba);
            const m = aba.metrica?.(resumo, total) ?? {};
            const ativo = aba.id === abaAtiva;

            const btn = el('button', `card-nav ${ativo ? 'ativo' : ''}`);
            btn.setAttribute('aria-pressed', String(ativo));
            btn.append(el('span', 'card-nav-rotulo', aba.rotulo));

            const valor = el('span', 'card-nav-valor');
            valor.append(el('span', 'number', num(total)));
            if (m.nota) valor.append(el('span', `nota ${m.notaPerigo ? 'perigo' : ''}`, m.nota));
            btn.append(valor);

            if (m.proporcao != null) {
                const trilho = el('span', 'trilho');
                const preenchido = el('i', m.perigo ? 'perigo' : null);
                preenchido.style.width = `${Math.min(100, Math.round(m.proporcao * 100))}%`;
                trilho.append(preenchido);
                btn.append(trilho);
            }

            btn.addEventListener('click', () => onTrocarAba(aba.id));
            dom.statsBar.append(btn);
        }
    },

    /** Uma frase abaixo dos cartões dizendo exatamente o que a aba ativa lista. */
    renderizarDescricaoAba(aba, resumo, total) {
        if (!dom.abaDescricao) return;
        dom.abaDescricao.replaceChildren();
        if (!resumo) return;

        dom.abaDescricao.append(
            el('strong', null, `${num(total)} ${total === 1 ? 'perfil' : 'perfis'}. `),
            el('span', null, aba.descricao?.(resumo) ?? '')
        );
        if (aba.rodape) dom.abaDescricao.append(' ', el('em', null, aba.rodape));
    },

    /** Números de fundo que não são navegação: contexto, não decisão. */
    renderizarContexto(resumo) {
        if (!dom.contexto) return;
        dom.contexto.replaceChildren();
        if (!resumo) return;

        const item = (valor, rotulo) => {
            const s = el('span');
            s.append(el('b', null, valor), ` ${rotulo}`);
            return s;
        };
        dom.contexto.append(
            item(num(resumo.seguidores), 'seguidores'),
            item(num(resumo.seguindo), 'seguindo'),
            item(formatarData(resumo.ultimoSnapshot), 'é a data deste export')
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
     * provar quem removeu o follow. Ser honesto sobre isso é o que separa esta
     * ferramenta dos apps que inventam números.
     */
    renderizarAvisoProva(resumo) {
        dom.avisoProva.replaceChildren();
        if (!resumo) return;

        const caixa = el('div', resumo.temProva ? 'aviso aviso-ok' : 'aviso');
        caixa.append(icone(resumo.temProva ? 'checkCirculo' : 'info', 18));
        const texto = el('div');

        if (resumo.temProva) {
            texto.append(
                el('strong', null, `${resumo.snapshots} exports comparados`),
                el('span', null,
                    `Janela de ${formatarData(resumo.primeiroSnapshot)} a ${formatarData(resumo.ultimoSnapshot)}. ` +
                    'Quem largou você é dado apurado nessa diferença, não estimativa.')
            );
        } else {
            texto.append(
                el('strong', null, 'Falta um segundo export para provar quem te largou'),
                el('span', null,
                    'Quem te larga some do arquivo de seguidores e leva a prova junto. Salve este export como ' +
                    'snapshot, peça outro daqui a algumas semanas e o app passa a confirmar em vez de estimar.')
            );
        }
        caixa.append(texto);
        dom.avisoProva.append(caixa);
    },

    renderizarLinhaDoTempo(snapshots) {
        dom.linhaDoTempo.replaceChildren();
        if (snapshots.length < 1) return;

        const trilha = el('div', 'timeline');
        snapshots.forEach((s, i) => {
            const ponto = el('span', 'timeline-item');
            ponto.append(icone('calendario', 13), el('span', null, formatarData(s.takenAt)));
            ponto.title = `${Object.keys(s.followers ?? {}).length} seguidores · ${Object.keys(s.following ?? {}).length} seguindo`;
            if (i === snapshots.length - 1) ponto.classList.add('atual');
            trilha.append(ponto);
        });
        dom.linhaDoTempo.append(
            el('div', 'timeline-title', `Exports guardados (${snapshots.length})`),
            trilha
        );
    },

    atualizarStatusUpload(elemento, rotulo, tamanho, origem) {
        if (!elemento) return;
        elemento.replaceChildren(
            icone('check', 13),
            el('span', null, `${rotulo}: ${num(tamanho)}${origem ? ` · ${origem}` : ''}`)
        );
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
        dom.iconeSolta?.replaceChildren(icone('pacote', 20));
        dom.iconeRestaurar?.replaceChildren(icone('subir', 15));
        dom.btnExportarBackup?.replaceChildren(icone('baixar', 15));
        dom.btnTriagem?.prepend(icone('triagem', 15));
    },

    renderizarGrade(lista, currentPage, aba, onResolver) {
        dom.usersGrid.replaceChildren();

        if (!lista.length) {
            dom.usersGrid.append(this.vazio(aba));
            return;
        }

        const inicio = (currentPage - 1) * this.itemsPerPage;
        for (const p of lista.slice(inicio, inicio + this.itemsPerPage)) {
            dom.usersGrid.append(this.criarCard(p, onResolver));
        }
    },

    /** Lista vazia não é erro: cada aba tem um motivo diferente para estar vazia. */
    vazio(aba) {
        const MENSAGENS = {
            NAO_ME_SEGUEM: ['Todo mundo retribui', 'Nenhum perfil que você segue está sem follow de volta.'],
            LARGARAM: ['Ninguém removeu o follow', 'Nenhum perfil sumiu da sua lista de seguidores depois que você retribuiu.'],
            NAO_SIGO: ['Você retribuiu todo mundo', 'Nenhum seguidor está esperando follow de volta.'],
            MUTUOS: ['Nenhuma relação mútua', 'Ninguém que você segue segue você de volta.']
        };
        const [titulo, texto] = MENSAGENS[aba?.id] ?? ['Nada por aqui', 'Nenhum perfil nesta categoria.'];
        const caixa = el('div', 'status-message');
        caixa.append(el('strong', null, titulo), el('span', null, texto));
        return caixa;
    },

    /**
     * Linha de contexto do perfil. Escrita por veredito, não por campo: numa aba
     * de "eu não sigo de volta" a data que importa é quando ELE te seguiu, e o
     * texto genérico de antes ("você seguiu em…") simplesmente não se aplicava.
     */
    linhasMeta(p) {
        const linhas = [];

        if (p.veredito === VEREDITO.SO_TE_SEGUE) {
            if (p.seguiuVoceEm != null) linhas.push(`te segue desde ${formatarData(p.seguiuVoceEm)}`);
            return linhas;
        }

        if (p.veredito === VEREDITO.MUTUO) {
            if (p.voceSeguiuEm != null) linhas.push(`você seguiu ${formatarData(p.voceSeguiuEm)}`);
            if (p.trocaInstantanea) linhas.push('troca instantânea');
            return linhas;
        }

        if (p.voceSeguiuEm != null) linhas.push(`você seguiu ${formatarData(p.voceSeguiuEm)}`);
        if (p.perdidoEntre) {
            linhas.push(`sumiu entre ${formatarData(p.perdidoEntre[0])} e ${formatarData(p.perdidoEntre[1])}`);
        }
        if (p.retencaoMaxSeg != null) linhas.push(`durou ~${formatarDuracao(p.retencaoMaxSeg)}`);
        if (p.quemVeioPrimeiro === 'ELES') linhas.push('ele seguiu primeiro');
        if (p.quemVeioPrimeiro === 'SIMULTANEO') linhas.push('troca instantânea');
        return linhas;
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
        for (const texto of this.linhasMeta(p)) meta.append(el('span', null, texto));
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

        // Mútuo não tem pendência: sem botão, o card fica só informativo.
        if (p.veredito !== VEREDITO.MUTUO) {
            const pendente = p.voceSegueAgora && !p.teSegueAgora;
            const btnResolver = el('button', `btn-icone ${pendente ? 'perigo' : ''}`);
            btnResolver.title = pendente ? 'Já parei de seguir' : 'Já resolvi este';
            btnResolver.setAttribute('aria-label', `Tirar ${p.user} da lista`);
            btnResolver.append(icone(pendente ? 'remover' : 'check', 15));
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
                dom.statsBar.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        const vida = tipo === 'erro' ? 6000 : 2600;
        setTimeout(() => t.classList.add('sai'), vida);
        setTimeout(() => t.remove(), vida + 400);
    }
};
