# Instagram Unfollow Checker (Full-Stack)

Uma ferramenta web local e privada desenvolvida para cruzar os dados de exportação do Instagram (Meta) e identificar perfis que não o seguem de volta. O projeto conta com um Front-End modular e um Back-End leve em Node.js para persistência de dados em disco.

## Funcionalidades

- Deteção Automática e Cache Local: Os arquivos JSON da Meta são guardados de forma persistente no servidor após o primeiro carregamento, eliminando a necessidade de novos uploads ao atualizar a página.
- Histórico Vitalício: Perfis marcados como "Parei de seguir" são gravados em um arquivo físico e removidos da sua vista de trabalho atual.
- Arquitetura Modular: Divisão clara de responsabilidades no Front-End seguindo o Princípio da Responsabilidade Única (SRP).
- Interface Otimizada: Paginação fluida, barra de pesquisa em tempo real e botão de cópia rápida para lidar com perfis desativados ou modificados.

## Tecnologias Utilizadas

- Front-End: HTML5, CSS3, JavaScript Nativo (ES6 Modules)
- Back-End: Node.js (Módulos nativos http e fs, sem dependências externas)

## Estrutura de Arquivos

├── index.html          # Interface estrutural do usuário
├── server.js           # Servidor local em Node.js (API de sincronização)
├── data/
│   ├── cached_followers.json    # Cache de seguidores (gerado automaticamente)
│   ├── cached_following.json    # Cache de perfis seguidos (gerado automaticamente)
│   └── unfollowed_history.json  # Histórico persistente de unfollows concluídos
└── src/
    ├── app.js          # Orquestrador principal (Core do Ciclo de Vida)
    ├── storage.js      # Camada de comunicação assíncrona com a API local
    ├── parser.js       # Motor de tratamento de dados brutos da Meta
    └── ui.js           # Gestão do DOM, renderização de tabelas e paginação

## Como Executar o Projeto

### 1. Requisitos Prévios
- Node.js instalado no sistema.
- Extensão de servidor local (como o Live Server do VS Code).

### 2. Passo a Passo

1. Clone o repositório para a sua máquina local.
2. Extraia os arquivos followers_1.json e following.json do seu backup do Instagram e coloque-os (opcionalmente) dentro da pasta /data.
3. Abra o terminal na raiz do projeto e inicie o servidor de persistência:
   node server.js
4. Inicie o Front-End abrindo o arquivo index.html através do Live Server (geralmente executado em http://127.0.0.1:5500).
5. Se for o primeiro acesso, faça o upload manual dos arquivos na interface para que o servidor gere o cache definitivo em disco.

---
Desenvolvido com foco em boas práticas de arquitetura de software, otimização de conjuntos (Set em JS) e privacidade de dados.