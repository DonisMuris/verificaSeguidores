// Armazenamento temporário dos dados extraídos
let dbSeguidores = new Set();
let dbSeguindo = new Set();

const btnVerificar = document.getElementById('btnVerificar');

// Função auxiliar para ler arquivos usando FileReader Promise
const processarArquivoJson = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                resolve(JSON.parse(e.target.result));
            } catch (err) {
                reject("Arquivo JSON inválido ou corrompido.");
            }
        };
        reader.onerror = () => reject("Erro na leitura física do arquivo.");
        reader.readAsText(file);
    });
};

// Gerencia a ativação do botão de análise
const checarProntidao = () => {
    if (dbSeguidores.size > 0 && dbSeguindo.size > 0) {
        btnVerificar.disabled = false;
    } else {
        btnVerificar.disabled = true;
    }
};

// Ouvinte para o arquivo de SEGUIDORES
document.getElementById('followersInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const json = await processarArquivoJson(file);
        dbSeguidores.clear();

        // Mapeia a estrutura padrão do array raiz do followers_1.json
        json.forEach(item => {
            if (item.string_list_data && item.string_list_data.length > 0) {
                const valor = item.string_list_data[0].value;
                if (valor) dbSeguidores.add(valor);
            }
        });

        document.getElementById('status-followers').textContent = `Carregado (${dbSeguidores.size} itens)`;
        document.getElementById('status-followers').style.color = '#4cd137';
        checarProntidao();
    } catch (erro) {
        alert(erro);
    }
});

// Ouvinte para o arquivo de SEGUINDO (following)
document.getElementById('followingInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const json = await processarArquivoJson(file);
        dbSeguindo.clear();

        // Mapeia a estrutura dentro de 'relationships_following'
        const targetList = json.relationships_following || json;
        targetList.forEach(item => {
            if (item.string_list_data && item.string_list_data.length > 0) {
                const valor = item.string_list_data[0].value;
                if (valor) dbSeguindo.add(valor);
            }
        });

        document.getElementById('status-following').textContent = `Carregado (${dbSeguindo.size} itens)`;
        document.getElementById('status-following').style.color = '#4cd137';
        checarProntidao();
    } catch (erro) {
        alert(erro);
    }
});

// Processamento da Diferença ao Clicar no Botão
btnVerificar.addEventListener('click', () => {
    // Quem eu sigo (dbSeguindo) mas não está no meu set de seguidores (dbSeguidores)
    const naoSeguemVolta = [...dbSeguindo].filter(user => !dbSeguidores.has(user)).sort();

    // Renderiza nos contadores da interface
    document.getElementById('count-followers').textContent = dbSeguidores.size;
    document.getElementById('count-following').textContent = dbSeguindo.size;
    document.getElementById('count-unfollow').textContent = naoSeguemVolta.length;
    document.getElementById('list-title').textContent = `Não te seguem de volta (${naoSeguemVolta.length})`;

    const container = document.getElementById('users-list');
    container.innerHTML = '';

    if (naoSeguemVolta.length === 0) {
        container.innerHTML = '<div class="empty"><p>Nenhum perfil encontrado com esse critério.</p></div>';
        return;
    }

    // Criação dos cards com link externo
    naoSeguemVolta.forEach(user => {
        const card = document.createElement('a');
        card.href = `https://instagram.com/${user}/`;
        card.target = '_blank';
        card.className = 'user-card';
        card.textContent = `@${user}`;
        container.appendChild(card);
    });
});