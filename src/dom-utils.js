/**
 * Helpers de DOM compartilhados.
 *
 * Vive em módulo próprio porque o build concatena todos os arquivos num único
 * escopo: duas declarações de `el` em módulos diferentes funcionam com imports
 * ES, mas colidem no arquivo gerado.
 */

/** Cria um elemento com classe e texto opcionais. */
export const el = (tag, classe, texto) => {
    const n = document.createElement(tag);
    if (classe) n.className = classe;
    if (texto != null) n.textContent = texto;
    return n;
};
