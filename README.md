# Instagram Unfollow Checker (Local e Offline)

Uma ferramenta web front-end desenvolvida para identificar quais perfis você segue no Instagram, mas que não te seguem de volta. 

Diferente de aplicativos de terceiros que exigem login e violam as diretrizes de automação da Meta, este projeto funciona de forma 100% offline, processando os dados diretamente no navegador do usuário via FileReader API. Não há requisições externas, garantindo que não existam riscos de banimento ou de vazamento de credenciais.

## Funcionalidades
- Analise Offline: Sem requisições de rede, cookies ou tráfego de credenciais.
- Upload Separado: Interface assíncrona controlada por estado para evitar conflitos na leitura e processamento dos arquivos.
- Links Diretos: Gera cards que redirecionam o usuário direto para o perfil correspondente na web para ação manual.

## Tecnologias Utilizadas
- HTML5 (Estruturação e manipulação nativa do DOM)
- CSS3 (Interface responsiva com estilização moderna)
- JavaScript ES6+ (FileReader, Promises, objetos Set e manipulação de arrays)
- Live Server (Ambiente de desenvolvimento local)

## Estrutura do Projeto

├── data/               # Pasta local contendo os arquivos JSON exportados (Ignorada no Git)
├── src/
│   └── app.js          # Lógica de extração, parsing e cálculo de intersecção
├── index.html          # Interface do usuário e painel de controle
└── .gitignore          # Proteção de arquivos locais confidenciais

## Instruções de Uso

### 1. Exportando seus dados do Instagram
1. Acesse a Central de Contas da Meta pelo endereço accountscenter.instagram.com.
2. Vá em "Suas informações e permissões", depois em "Baixar suas informações" e clique em "Solicitar download".
3. Selecione apenas a sua conta do Instagram e marque a opção "Tipos específicos de informações".
4. Selecione a caixa "Seguidores e seguindo".
5. Configuração Obrigatória: Altere o intervalo de datas para "Desde o início" e mude o formato de exportação para JSON.
6. Envie a solicitação. Quando o arquivo .zip estiver pronto, baixe e extraia o conteúdo em seu computador.

### 2. Rodando o Projeto Localmente
1. Mova os arquivos extraídos (following.json e followers_1.json) para a pasta data/ localizada na raiz do projeto.
2. Abra a pasta raiz do projeto no VS Code.
3. Clique com o botão direito sobre o arquivo index.html e selecione a opção "Open with Live Server".
4. Na interface aberta no navegador, selecione individualmente o arquivo de seguidores e o arquivo de seguindo nos respectivos campos.
5. Clique no botão "Analisar Seguidores" para gerar a lista de perfis interativos.

## Seguranca e Privacidade
Este projeto foi construído sob os princípios de privacidade desde a concepção (Privacy by Design). Ele apenas consome dados disponibilizados nativamente pelo direito de portabilidade do usuário (LGPD/GDPR). Nenhuma informação é coletada, enviada ou armazenada externamente.