/**
 * Comunicação com o servidor local.
 * Agora usa caminho relativo (mesma origem) porque o front é servido pelo próprio
 * Node — não há mais CORS nem porta cruzada. O token vem injetado no HTML.
 */

const BASE_URL = '/api';
const TOKEN = document.querySelector('meta[name="app-token"]')?.content ?? '';

const pedir = async (rota, opcoes = {}) => {
    const res = await fetch(`${BASE_URL}${rota}`, {
        ...opcoes,
        headers: {
            'Content-Type': 'application/json',
            'X-App-Token': TOKEN,
            ...opcoes.headers
        }
    });
    if (!res.ok) {
        const detalhe = await res.json().catch(() => ({}));
        throw new Error(detalhe.error ?? `Erro ${res.status} em ${rota}`);
    }
    return res.json();
};

export const StorageService = {
    /** Todos os snapshots já salvos, do mais antigo ao mais recente. */
    async carregarSnapshots() {
        try {
            const lista = await pedir('/snapshots');
            return Array.isArray(lista) ? lista : [];
        } catch (e) {
            console.warn('Servidor local indisponível:', e.message);
            return [];
        }
    },

    salvarSnapshot(snapshot) {
        return pedir('/snapshots', { method: 'POST', body: JSON.stringify(snapshot) });
    },

    apagarSnapshots() {
        return pedir('/snapshots', { method: 'DELETE' });
    },

    async carregarHistorico() {
        try {
            return new Set(await pedir('/history'));
        } catch {
            return new Set();
        }
    },

    salvarHistorico(historicoSet) {
        return pedir('/history', { method: 'POST', body: JSON.stringify([...historicoSet]) });
    },

    limparHistorico() {
        return pedir('/history', { method: 'POST', body: JSON.stringify([]) });
    }
};
