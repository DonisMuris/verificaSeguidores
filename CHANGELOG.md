# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versionamento em [SemVer](https://semver.org/lang/pt-BR/).

## [2.1.0] - 2026-08-22

### Adicionado

- Entrada única que aceita o **`.zip` do export inteiro**, com solta em qualquer
  ponto da página. `src/zip.js` lê o diretório central do ZIP e descomprime com
  `DecompressionStream` nativo, sem biblioteca, mantendo zero dependências.
- Roteamento de arquivo por conteúdo: soltar `followers` e `following` juntos, em
  qualquer ordem, funciona. Não há mais dois campos rotulados para acertar.
- **Build de release** (`npm run build:release`) que remove comentários de JS e CSS
  do artefato publicado, com validação de que o resultado ainda parseia e é
  idempotente.
- Cabeçalhos de segurança gerados junto do build, com `connect-src 'none'` —
  o navegador passa a bloquear qualquer requisição saindo da página.
- Rodapé de privacidade na página, exigido pela LGPD quando o app deixa de ser local.
- **52 testes** com `node:test`, e CI em Node 20, 22 e 24.
- Documentação separada por público: `docs/USO.md` (manual), `docs/ARQUITETURA.md`
  (decisões de design), `docs/MELHORIAS.md` (itens em aberto, com o motivo de cada
  um) e `docs/USO-DE-IA.md` (transparência sobre ferramentas assistidas).
- Screenshots e diagrama gerados a partir de dados sintéticos.
- Publicação em Cloudflare Workers com assets estáticos.

### Alterado

- **Navegação reorganizada pelas perguntas do usuário.** As cinco abas nomeadas
  pelo motor (*Iscas · Confirmadas · Te largaram · Não seguem · Te seguem*) viraram
  quatro: não me seguem de volta · largaram depois que eu segui · eu não sigo de
  volta · seguem-se mutuamente.
- Os cartões de métrica **são** as abas. Antes eram dois controles concorrentes,
  um mostrando o número e outro filtrando por ele.
- Estado vazio dedicado: sem dados, a tela inteira vira o passo de upload.
- Ordenação por data passa a usar o carimbo que faz sentido em cada aba.

### Corrigido

- Salvar snapshot ficava habilitado com dados reidratados do último snapshot,
  oferecendo regravar o que já estava gravado com data deduzida do conteúdo.
- Carregar só metade do export sobre um snapshot anterior produzia análise
  plausível e errada, em silêncio. Agora avisa e bloqueia.
- Ordenação por data ficava empatada em zero na aba "eu não sigo de volta".
- `formatarDuracao` dizia "1 meses".

## [2.0.0] - 2026-08-02

### Adicionado

- Detecção de follow-back bait comparando snapshots no tempo, com os modos
  **suspeita** (1 export) e **prova** (2+).
- Versão autossuficiente em arquivo único, que roda com duplo clique.
- Modo triagem: revisão um-a-um com teclado, reusando a mesma aba do navegador.
- Modo escuro.
- Detecção de export recortado por intervalo de datas — o erro mais caro que o
  usuário pode cometer, porque o arquivo parece válido e transforma todo seguidor
  antigo ausente num falso "te largou".
- Redesign com componentes, ícones SVG inline e medidores de risco.

### Corrigido

- Data do snapshot vem do export e do mtime do arquivo, não do relógio.
- Parser passa a preservar timestamps — era o que impedia toda a detecção.
- Leitura de `followers_1..N`; antes lia só o primeiro e errava em silêncio para
  contas grandes.
- CORS aberto e bind em todas as interfaces no modo servidor.

## [1.0.0] - 2026-05-25

Primeira versão. Scripts em Python que liam o export local e serviam uma página
estática; substituídos por JavaScript ainda em maio.
