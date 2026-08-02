import { el } from './dom-utils.js';
import { icone, iniciais } from './icones.js';

/**
 * Modo triagem: um perfil por vez, com teclado.
 *
 * O problema que resolve: revisar 235 perfis numa grade obriga a abrir cada
 * link, voltar, procurar onde parou e repetir. Aqui a lista vira uma fila —
 * você decide, ela avança sozinha, e dá para voltar atrás.
 *
 * Detalhe que mais economiza tempo: o perfil abre sempre na MESMA aba
 * (window.open com nome fixo), em vez de acumular uma aba por perfil.
 */

const NOME_ABA_PERFIL = 'verificaSeguidoresPerfil';

export const TriagemService = {
    ativa: false,
    lista: [],
    indice: 0,
    decisoes: [],
    onResolver: null,
    onFechar: null,
    raiz: null,
    _teclado: null,

    abrir(lista, { onResolver, onFechar, rotulos }) {
        if (!lista.length) return false;
        this.lista = [...lista];
        this.indice = 0;
        this.decisoes = [];
        this.onResolver = onResolver;
        this.onFechar = onFechar;
        this.rotulos = rotulos ?? {};
        this.ativa = true;

        this.raiz = el('div', 'triagem');
        document.body.append(this.raiz);
        document.body.style.overflow = 'hidden';

        this._teclado = (e) => this.tecla(e);
        document.addEventListener('keydown', this._teclado);

        this.render();
        return true;
    },

    fechar() {
        if (!this.ativa) return;
        this.ativa = false;
        document.removeEventListener('keydown', this._teclado);
        document.body.style.overflow = '';
        this.raiz?.remove();
        this.raiz = null;
        this.onFechar?.(this.decisoes.filter((d) => d.acao === 'unfollow').length);
    },

    tecla(e) {
        if (!this.ativa) return;
        const atalhos = {
            Escape: () => this.fechar(),
            ArrowRight: () => this.avancar('manter'),
            ArrowLeft: () => this.voltar(),
            Enter: () => this.avancar('manter'),
            ' ': () => this.avancar('unfollow'),
            u: () => this.avancar('unfollow'),
            U: () => this.avancar('unfollow'),
            o: () => this.abrirPerfil(),
            O: () => this.abrirPerfil()
        };
        const acao = atalhos[e.key];
        if (!acao) return;
        e.preventDefault();
        acao();
    },

    perfilAtual() {
        return this.lista[this.indice] ?? null;
    },

    /** Abre sempre na mesma aba nomeada, em vez de empilhar uma por perfil. */
    abrirPerfil() {
        const p = this.perfilAtual();
        if (!p) return;
        window.open(
            `https://instagram.com/${encodeURIComponent(p.user)}/`,
            NOME_ABA_PERFIL,
            'noopener'
        );
    },

    avancar(acao) {
        const p = this.perfilAtual();
        if (!p) return;

        this.decisoes.push({ user: p.user, acao });
        if (acao === 'unfollow') this.onResolver?.(p.user);

        if (this.indice >= this.lista.length - 1) {
            this.render(true);
            return;
        }
        this.indice += 1;
        this.render();
    },

    /** Volta um passo. Decisões de unfollow não são desfeitas em silêncio. */
    voltar() {
        if (this.indice === 0) return;
        this.indice -= 1;
        this.decisoes.pop();
        this.render();
    },

    render(finalizado = false) {
        if (!this.raiz) return;
        this.raiz.replaceChildren();

        const painel = el('div', 'triagem-painel');

        if (finalizado || !this.perfilAtual()) {
            const marcados = this.decisoes.filter((d) => d.acao === 'unfollow').length;
            const marca = el('div', 'triagem-fim-icone');
            marca.append(icone('checkCirculo', 40));
            painel.append(
                marca,
                el('h2', 'triagem-fim-titulo', 'Fila concluída'),
                el(
                    'p',
                    'triagem-fim-texto',
                    `${this.lista.length} perfis revisados. ${marcados} marcados como "parei de seguir".`
                ),
                el(
                    'p',
                    'triagem-fim-nota',
                    'Marcar aqui só remove o perfil da sua lista de trabalho. O unfollow em si você faz no Instagram.'
                )
            );
            const btn = el('button', 'triagem-btn triagem-btn-principal', 'Fechar');
            btn.addEventListener('click', () => this.fechar());
            painel.append(btn);
            this.raiz.append(painel);
            btn.focus();
            return;
        }

        const p = this.perfilAtual();

        // Cabeçalho: progresso e saída
        const topo = el('div', 'triagem-topo');
        topo.append(el('span', 'triagem-progresso', `${this.indice + 1} de ${this.lista.length}`));
        const btnSair = el('button', 'triagem-sair');
        btnSair.title = 'Sair (Esc)';
        btnSair.setAttribute('aria-label', 'Sair da triagem');
        btnSair.append(icone('fechar', 15));
        btnSair.addEventListener('click', () => this.fechar());
        topo.append(btnSair);

        const barra = el('div', 'triagem-barra');
        const preenchida = el('div', 'triagem-barra-fill');
        preenchida.style.width = `${((this.indice + 1) / this.lista.length) * 100}%`;
        barra.append(preenchida);

        // Corpo: avatar + identidade, depois os detalhes
        const nivel = this.faixaRisco(p.score);
        const corpo = el('div', 'triagem-corpo');

        const cabecalho = el('div', 'triagem-cabecalho');
        const avatar = el('div', 'triagem-avatar', iniciais(p.user));
        avatar.dataset.nivel = nivel;

        const identidade = el('div');
        identidade.append(el('div', 'triagem-user', `@${p.user}`));
        const selos = el('div', 'triagem-selos');
        selos.append(el('span', `triagem-badge risco-${nivel}`, this.rotulos[p.veredito] ?? p.veredito));
        if (p.score > 0) selos.append(el('span', 'triagem-score', `risco ${p.score}`));
        identidade.append(selos);

        cabecalho.append(avatar, identidade);
        corpo.append(cabecalho);

        const meta = el('div', 'triagem-meta');
        for (const texto of this.linhasMeta(p)) meta.append(el('span', null, texto));
        if (meta.childElementCount) corpo.append(meta);

        if (p.motivos?.length) {
            const ul = el('ul', 'triagem-motivos');
            for (const m of p.motivos.slice(0, 3)) ul.append(el('li', null, m));
            corpo.append(ul);
        }

        // Ações
        const acoes = el('div', 'triagem-acoes');

        const btnAbrir = el('button', 'triagem-btn triagem-btn-abrir');
        btnAbrir.append(icone('abrir', 17), el('span', null, 'Abrir'), el('kbd', null, 'O'));
        btnAbrir.addEventListener('click', () => this.abrirPerfil());

        const btnManter = el('button', 'triagem-btn');
        btnManter.append(icone('check', 17), el('span', null, 'Manter'), el('kbd', null, '→'));
        btnManter.addEventListener('click', () => this.avancar('manter'));

        const btnUnfollow = el('button', 'triagem-btn triagem-btn-unfollow');
        btnUnfollow.append(icone('remover', 17), el('span', null, 'Remover'), el('kbd', null, 'Espaço'));
        btnUnfollow.addEventListener('click', () => this.avancar('unfollow'));

        acoes.append(btnAbrir, btnManter, btnUnfollow);

        const rodape = el('div', 'triagem-rodape');
        const btnVoltar = el('button', 'triagem-voltar');
        btnVoltar.append(icone('voltar', 14), el('span', null, 'Voltar'));
        btnVoltar.disabled = this.indice === 0;
        btnVoltar.addEventListener('click', () => this.voltar());
        rodape.append(btnVoltar);
        rodape.append(el('span', 'triagem-dica', 'O abre · → mantém · Espaço remove · ← volta'));

        painel.append(topo, barra, corpo, acoes, rodape);
        this.raiz.append(painel);
        // Cada perfil recomeça do topo: sem isso, um perfil com muitos motivos
        // deixaria o seguinte aberto no meio.
        this.raiz.scrollTop = 0;
    },

    faixaRisco(score) {
        if (score >= 70) return 'alto';
        if (score >= 30) return 'medio';
        return 'baixo';
    },

    linhasMeta(p) {
        const linhas = [];
        if (p.retencaoMaxSeg != null && p.fmtRetencao) linhas.push(`reteve ~${p.fmtRetencao}`);
        if (p.quemVeioPrimeiro === 'ELES') linhas.push('ele veio primeiro');
        if (p.quemVeioPrimeiro === 'SIMULTANEO') linhas.push('troca instantânea');
        if (p.fmtSeguidoEm) linhas.push(`você seguiu ${p.fmtSeguidoEm}`);
        return linhas;
    }
};
