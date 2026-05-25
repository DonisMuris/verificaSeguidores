export const ParserService = {
    extrairSeguidores(json) {
        const lista = new Set();
        json.forEach(item => {
            if (item.string_list_data?.length > 0) {
                const username = item.string_list_data[0].value;
                if (username) lista.add(username);
            }
        });
        return lista;
    },
    
    extrairSeguindo(json) {
        const lista = new Set();
        const entries = json.relationships_following || json.entries || json;
        if (Array.isArray(entries)) {
            entries.forEach(item => {
                if (item.title) {
                    lista.add(item.title);
                } else if (item.string_list_data?.length > 0 && item.string_list_data[0].value) {
                    lista.add(item.string_list_data[0].value);
                }
            });
        }
        return lista;
    },

    async lerArquivoAsync(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try { resolve(JSON.parse(e.target.result)); } 
                catch { reject("Estrutura JSON inválida."); }
            };
            reader.onerror = () => reject("Erro físico no arquivo.");
            reader.readAsText(file);
        });
    }
};