/**
 * Ícones SVG embutidos.
 *
 * Nada de fonte de ícone via CDN: o app precisa continuar funcionando com duplo
 * clique, offline e sem nenhuma requisição externa. Traçado de 24px no estilo
 * Tabler, herdando a cor do texto via `currentColor`.
 */

const TRACOS = {
    marca: 'M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 11h6',
    lua: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9',
    sol: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4L7 17M17 7l1.4-1.4',
    alerta: 'M12 9v4M12 17h.01M10.2 4l-8.4 14A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-3L13.8 4a2 2 0 0 0-3.5 0z',
    info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 8h.01M11 12h1v4h1',
    checkCirculo: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M9 12l2 2 4-4',
    busca: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14M21 21l-6-6',
    ordenar: 'M3 9l4-4 4 4M7 5v14M21 15l-4 4-4-4M17 19V5',
    triagem: 'M12 3 4 7l8 4 8-4-8-4M4 12l8 4 8-4M4 17l8 4 8-4',
    abrir: 'M12 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6M11 13l9-9M15 4h5v5',
    remover: 'M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 11h6',
    copiar: 'M10 8h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2',
    check: 'M5 12l5 5L20 7',
    fechar: 'M18 6 6 18M6 6l12 12',
    voltar: 'M5 12h14M5 12l6 6M5 12l6-6',
    esquerda: 'M15 6l-6 6 6 6',
    direita: 'M9 6l6 6-6 6',
    baixar: 'M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 11l5 5 5-5M12 4v12',
    subir: 'M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 9l5-5 5 5M12 4v12',
    limpar: 'M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3',
    arquivo: 'M14 3v4a1 1 0 0 0 1 1h4M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z',
    calendario: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM16 3v4M8 3v4M4 11h16',
    pacote: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9'
};

const NS = 'http://www.w3.org/2000/svg';

/** Devolve um <svg> pronto para inserir. Decorativo por padrão. */
export const icone = (nome, tamanho = 16) => {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', tamanho);
    svg.setAttribute('height', tamanho);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.6');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('icone');

    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', TRACOS[nome] ?? '');
    svg.append(path);
    return svg;
};

/**
 * Iniciais para o avatar. O export da Meta não traz foto de perfil, então o
 * monograma é a única âncora visual possível — e é o que permite varrer a
 * lista sem ler cada @.
 */
export const iniciais = (user) => {
    const limpo = String(user ?? '').replace(/[^a-z0-9]/gi, '');
    return (limpo.slice(0, 2) || '?').toUpperCase();
};
