export const dom = {
    followersInput: document.getElementById('followersInput'),
    followingInput: document.getElementById('followingInput'),
    btnVerificar: document.getElementById('btnVerificar'),
    searchInput: document.getElementById('searchInput'),
    btnResetHistory: document.getElementById('btnResetHistory'),
    usersGrid: document.getElementById('users-grid'),
    paginationControls: document.getElementById('pagination-controls'),
    statusFollowers: document.getElementById('status-followers'),
    statusFollowing: document.getElementById('status-following'),
    countFollowers: document.getElementById('count-followers'),
    countFollowing: document.getElementById('count-following'),
    countUnfollow: document.getElementById('count-unfollow'),
    listTitle: document.getElementById('list-title')
};

export const UIService = {
    itemsPerPage: 24,

    atualizarPainelContagem(followersSize, followingSize, unfollowersSize) {
        dom.countFollowers.textContent = followersSize;
        dom.countFollowing.textContent = followingSize;
        dom.countUnfollow.textContent = unfollowersSize;
    },

    atualizarStatusUpload(elemento, tamanho, isAuto = false) {
        elemento.textContent = `${isAuto ? 'Auto-detectado' : 'Carregado'} (${tamanho})`;
        elemento.style.color = '#0ea5e9';
    },

    atualizarBotaoReset(historicoSize) {
        if (historicoSize > 0) {
            dom.btnResetHistory.style.display = 'block';
            dom.btnResetHistory.textContent = `Limpar Histórico (${historicoSize})`;
        } else {
            dom.btnResetHistory.style.display = 'none';
        }
    },

    renderizarGrade(list, currentPage, onUnfollowAction) {
        dom.usersGrid.innerHTML = '';
        
        if (list.length === 0) {
            dom.usersGrid.innerHTML = '<div class="status-message">Nenhum perfil pendente encontrado.</div>';
            return;
        }

        const inicio = (currentPage - 1) * this.itemsPerPage;
        const fim = inicio + this.itemsPerPage;
        const sliceDaPagina = list.slice(inicio, fim);

        sliceDaPagina.forEach(user => {
            const card = document.createElement('div');
            card.className = 'user-card';

            const link = document.createElement('a');
            link.href = `https://instagram.com/${user}/`;
            link.target = '_blank';
            link.className = 'user-link';
            link.textContent = `@${user}`;

            const btnAction = document.createElement('button');
            btnAction.className = 'btn-unfollow-action';
            btnAction.textContent = 'Parei de seguir';
            btnAction.addEventListener('click', () => onUnfollowAction(user));

            card.appendChild(link);
            card.appendChild(btnAction);
            dom.usersGrid.appendChild(card);
        });
    },

    renderizarControlesPaginacao(totalItems, currentPage, onPageChange) {
        dom.paginationControls.innerHTML = '';
        const totalPages = Math.ceil(totalItems / this.itemsPerPage) || 1;
        
        if (totalPages <= 1) return;

        const criarBotao = (texto, destino, isDisabled = false, isActive = false) => {
            const btn = document.createElement('button');
            btn.className = `pagination-button ${isActive ? 'active' : ''}`;
            btn.textContent = texto;
            btn.disabled = isDisabled;
            btn.addEventListener('click', () => {
                onPageChange(destino);
                window.scrollTo({ top: dom.listTitle.offsetTop - 20, behavior: 'smooth' });
            });
            dom.paginationControls.appendChild(btn);
        };

        criarBotao('Anterior', currentPage - 1, currentPage === 1);

        for (let i = 1; i <= totalPages; i++) {
            criarBotao(i, i, false, currentPage === i);
        }

        criarBotao('Próximo', currentPage + 1, currentPage === totalPages);
    }
};