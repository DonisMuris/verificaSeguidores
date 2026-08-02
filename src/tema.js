import { icone } from './icones.js';

/**
 * Alternância de tema.
 *
 * A troca em si acontece só nos tokens CSS (`[data-tema="escuro"]` no <html>);
 * nenhuma regra de layout sabe que existe modo escuro. Aqui fica apenas a
 * decisão de qual tema vale e a persistência.
 *
 * A aplicação inicial NÃO é feita aqui: um script solto no <head> já resolveu
 * isso antes da primeira pintura, senão a página piscaria branca ao abrir no
 * escuro. Este módulo assume o estado que aquele script deixou.
 */

const CHAVE = 'verificaSeguidores.tema';

const lerTema = () => {
    try {
        return localStorage.getItem(CHAVE);
    } catch {
        return null;
    }
};

const gravarTema = (valor) => {
    try {
        localStorage.setItem(CHAVE, valor);
    } catch {
        /* Sem armazenamento, o tema vale só nesta sessão. */
    }
};

export const TemaService = {
    botao: null,

    estaEscuro() {
        return document.documentElement.dataset.tema === 'escuro';
    },

    aplicar(escuro) {
        if (escuro) document.documentElement.dataset.tema = 'escuro';
        else delete document.documentElement.dataset.tema;
        gravarTema(escuro ? 'escuro' : 'claro');
        this.sincronizarBotao();
    },

    alternar() {
        this.aplicar(!this.estaEscuro());
    },

    /** O ícone anuncia o destino da ação, não o estado atual. */
    sincronizarBotao() {
        if (!this.botao) return;
        const escuro = this.estaEscuro();
        this.botao.replaceChildren(icone(escuro ? 'sol' : 'lua', 16));
        this.botao.title = escuro ? 'Voltar ao modo claro' : 'Ativar modo escuro';
        this.botao.setAttribute('aria-pressed', String(escuro));
    },

    iniciar(botao) {
        this.botao = botao;
        this.sincronizarBotao();
        botao?.addEventListener('click', () => this.alternar());

        // Enquanto o usuário não escolher explicitamente, acompanha o sistema.
        window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.(
            'change',
            (e) => {
                if (!lerTema()) this.aplicar(e.matches);
            }
        );
    }
};
