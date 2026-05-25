const BASE_URL = 'http://localhost:3000/api';

export const StorageService = {
    async carregarHistorico() {
        try {
            const res = await fetch(`${BASE_URL}/history`);
            return new Set(await res.json());
        } catch { return new Set(); }
    },

    async salvarHistorico(historicoSet) {
        try {
            await fetch(`${BASE_URL}/history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([...historicoSet])
            });
        } catch (e) { console.error("Falha ao salvar histórico", e); }
    },

    async limparHistorico() {
        try {
            await fetch(`${BASE_URL}/history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([])
            });
        } catch (e) { console.error(e); }
    },

    // NOVOS: Métodos para persistir o cache das listas da Meta no servidor
    async carregarCacheMeta() {
        try {
            const resFollowers = await fetch(`${BASE_URL}/followers`);
            const resFollowing = await fetch(`${BASE_URL}/following`);
            
            return {
                followers: new Set(await resFollowers.json()),
                following: new Set(await resFollowing.json())
            };
        } catch {
            return { followers: new Set(), following: new Set() };
        }
    },

    async salvarCacheMeta(followersSet, followingSet) {
        try {
            await fetch(`${BASE_URL}/followers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([...followersSet])
            });
            await fetch(`${BASE_URL}/following`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([...followingSet])
            });
        } catch (e) { console.error("Erro ao sincronizar cache no servidor.", e); }
    }
};