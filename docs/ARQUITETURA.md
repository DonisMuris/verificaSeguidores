# Arquitetura

Decisões de design e o motivo de cada uma, para quem for mexer no código.

---

## 1. A restrição que define tudo

**É impossível provar, com um único export, que alguém te seguiu e depois largou.**

Quando a pessoa remove o follow, o perfil dela desaparece de `followers_N.json`. A
prova de que ela já te seguiu é destruída junto com o follow. No arquivo, "nunca te
seguiu" e "te seguiu e sumiu" são exatamente o mesmo estado: ausência.

A limitação é do dado, não da implementação. Toda a arquitetura sai daí.

### A heurística que testei e descartei

A ideia era agrupar follows por proximidade temporal: se você tem trocas recíprocas
confirmadas em determinadas janelas, follows não retribuídos que caem nas mesmas
janelas seriam prováveis iscas.

Medido contra um export real, sobre pouco mais de mil perfis não retribuídos:

| Janela | Casos recuperados |
|---|---|
| 60s | 9 |
| 300s | 21 |
| 3600s | 82 |

Menos de 8% no melhor caso, com falsos positivos indistinguíveis. **Descartada.**
Não vale reimplementar: a informação não está no arquivo.

### A solução: comparar snapshots

Com dois exports em datas diferentes, a diferença entre eles revela exatamente quem
saiu, e os timestamps dizem quem seguiu primeiro.

| Snapshots | Modo | Entrega |
|---|---|---|
| 1 | `suspeita` | quem não retribui + ranking de risco estimado |
| 2+ | `prova` | quem largou, quando, quem veio primeiro, quanto reteve |

Um selo no cabeçalho mostra o modo atual. É decisão de produto: apps concorrentes
afirmam certeza que não têm, e declarar a incerteza é o que diferencia este.

## 2. Modelo de dados

`Map<username, timestamp>`, nunca `Set<string>`.

- o timestamp de `followers_N.json` é **quando ELE te seguiu**;
- o de `following.json` é **quando VOCÊ seguiu**.

A ordem entre os dois é o que sustenta a análise. Uma versão antiga descartava os
timestamps no parser, e por isso não detectava nada.

Um **snapshot** é `{ takenAt, followers: {...}, following: {...} }`, serializável
direto para JSON.

### Vereditos

| Veredito | Condição |
|---|---|
| `BAIT_PROVADO` | sumiu entre dois snapshots, e ele veio primeiro (ou troca instantânea) |
| `SUMIU` | sumiu entre dois snapshots, mas você veio primeiro |
| `BAIT_SUSPEITO` | você seguiu nos últimos 180 dias, sem retorno (só existe em modo suspeita) |
| `NUNCA_RETRIBUIU` | você segue há mais tempo, sem retorno |
| `MUTUO` | vocês dois se seguem |
| `SO_TE_SEGUE` | ele segue, você não |

### Bait Score (0–100)

| Sinal | Peso |
|---|---|
| isca provada entre snapshots | +55 |
| sumiu dos seguidores | +30 |
| troca instantânea (≤10s entre os dois follows) | +25 |
| largou em ≤2 dias | +20 |
| isca suspeita | +20 |
| largou em ≤7 dias | +12 |
| follow seu recente (≤90 dias) | +8 |
| relação com mais de um ano | −15 |

**Guarda importante:** vereditos que não são de risco (`MUTUO`, `SO_TE_SEGUE`)
retornam score 0 **sempre**. Sem isso, amizades recíprocas que se seguiram no mesmo
minuto subiam ao topo do ranking — bug real, já corrigido, com teste de regressão
em `test/analysis.test.js`.

A **troca instantânea** é o sinal mais informativo: dois follows com menos de 10
segundos de diferença indicam follow-back reflexo, que é o comportamento exato que
a tática explora.

## 3. Módulos

```
src/dom-utils.js     helper el() compartilhado
src/icones.js        SVG inline + iniciais do avatar
src/tema.js          claro/escuro
src/parser.js        lê o export preservando timestamps; classifica arquivo
src/zip.js           lê o .zip sem biblioteca
src/analysis.js      diff entre snapshots + score          ← núcleo
src/storage.js       persistência via API (modo servidor)
src/storage-local.js persistência via localStorage (arquivo único)
src/triagem.js       revisão um-a-um, com teclado
src/ui.js            render de cartões, lista, paginação
src/app.js           estado e orquestração
```

A ordem em `build.js` importa: o bundle é uma concatenação num escopo só, então
cada módulo só pode usar o que já foi definido acima dele.

### Dois modos, uma fonte da verdade

`storage.js` e `storage-local.js` expõem a **mesma interface**, então `app.js` roda
igual nos dois sem nenhum `if`. O build troca um pelo outro. É o que permite existir
tanto o arquivo único (duplo clique, `localStorage`) quanto o modo servidor (dados
em `data/`, em disco) sem duplicar lógica.

Fallback: se o navegador bloquear `localStorage` (Safari em `file://`), cai para
memória e avisa o usuário para usar o backup antes de fechar.

### Leitura do `.zip` sem dependência

`src/zip.js` lê o **diretório central** do ZIP, não os headers locais em sequência
— porque só interessam 2 ou 3 entradas de um arquivo com centenas; inflar tudo para
achá-las desperdiçaria memória. A descompressão usa `DecompressionStream('deflate-raw')`,
nativo do navegador.

Um detalhe fácil de errar: o tamanho do nome e do campo extra no header **local**
pode diferir do que está no diretório central. É preciso reler do header local antes
de fatiar os dados.

ZIP64 é detectado e recusado com mensagem clara, em vez de produzir lixo.

### Classificação de arquivo

O usuário solta tudo de uma vez e o app decide o que é o quê:

- `following.json` chega embrulhado em `{ relationships_following: [...] }` — o
  conteúdo identifica sozinho, mesmo renomeado;
- `followers_N.json` vem como **array puro**, sem marca interna. Aqui o nome é
  obrigatório, porque `close_friends.json` é um array com o formato **idêntico**.
  Chutar "array = seguidores" misturaria a lista de melhores amigos na análise, e o
  usuário não teria como perceber.

## 4. Interface

**Os cartões de métrica são as abas.** Antes eram dois controles empilhados: uma
barra mostrando "N não retribuem" e, abaixo, um segmentado que filtrava por
esses mesmos N — cabia ao usuário descobrir que falavam da mesma coisa.

As abas são nomeadas pelas perguntas de quem usa, não pelo vocabulário do motor:

| Aba | Filtro |
|---|---|
| Não me seguem de volta | `voceSegueAgora && !teSegueAgora` |
| Largaram depois que eu segui | `BAIT_PROVADO \|\| SUMIU \|\| BAIT_SUSPEITO` |
| Eu não sigo de volta | `SO_TE_SEGUE` |
| Seguem-se mutuamente | `MUTUO` |

A segunda é subconjunto da primeira, e a descrição abaixo dos cartões avisa. Sem esse
aviso os números não fecham e o usuário desconfia da conta. As outras três particionam
o total, com teste garantindo.

**Tema.** Tokens CSS no `:root`, trocados por `[data-tema="escuro"]`. Nenhuma regra
de layout sabe que existe modo escuro. A aplicação inicial fica num script solto no
`<head>`, antes da primeira pintura, sem isso a página pisca branca ao abrir no
escuro. Paleta medida em WCAG AA nos dois temas.

## 5. Build

`node build.js` concatena `src/` dentro de `index.html`, tirando `import`/`export`,
e gera `VerificaSeguidores.html`.

Como o bundle é um escopo só, duas declarações homônimas em módulos diferentes
colidem — algo que os imports ES escondem. O build **detecta e falha**, em vez de
gerar um HTML que quebra no navegador.

### Modo release

`node build.js --release --saida public/index.html` remove os comentários do JS e do
CSS antes de publicar.

O scanner de comentários é o código de maior risco do repositório. Um
`replace(/\/\/.*$/gm, '')` quebraria este projeto especificamente, porque ele tem
`'https://www.instagram.com/'` em strings por toda parte e regexes com barras dentro.

A implementação é uma máquina de estados sobre código, string, template literal e
regex, com pilha para distinguir se um `}` fecha bloco ou interpolação. Sem ela,
`${lista.map((x) => { return x; })}` encerraria a interpolação na chave errada e o
resto do arquivo viraria texto.

Distinguir `/` de divisão de `/` de início de regex usa a regra clássica: depois de
identificador, número, `)` ou `]` é divisão; depois de qualquer outra coisa, ou de
palavra-chave como `return`, é regex.

Nada é colapsado em linha — comentário de linha vira vazio preservando a quebra,
bloco vira um espaço — para que a inserção automática de ponto e vírgula não mude o
significado do programa.

Antes de escrever, o build **valida** que o resultado ainda parseia e que a operação
é idempotente. Tudo entra normalizado em LF: várias regras assumem `\n` puro e
falhavam em silêncio no Windows, fazendo o mesmo commit gerar arquivos diferentes
por sistema operacional.

### Cabeçalhos

O build gera o `_headers` junto do artefato. O item que importa é
`connect-src 'none'`: o navegador passa a **impedir** qualquer requisição saindo da
página. A promessa de privacidade deixa de ser texto e vira algo que o usuário
confere na aba Rede.

Consequência aceita conscientemente: adicionar analytics ou qualquer script externo
exige afrouxar isso, e aí a garantia acaba.

## 6. Segurança do modo servidor

Bugs reais já corrigidos, que não devem voltar:

- **CORS `*` + bind em todas as interfaces** — qualquer site aberto em outra aba
  conseguia ler a lista de seguidores e sobrescrever o histórico. Hoje: bind em
  `127.0.0.1` e token de sessão gerado por execução, injetado no HTML.
- **Escrita não atômica**: hoje grava em temporário e renomeia, com fila serial
  por arquivo.
- **Path traversal** bloqueado, e a pasta `data/` não é servida por HTTP.

## 7. Caminhos avaliados e recusados

**Extensão de navegador que lê o DOM ou a API interna do Instagram.** Seria a única
forma de eliminar a fricção de pedir o export manualmente, e é exatamente a parte
que viola os Termos, com risco de banimento para o usuário e remoção da loja. A Meta
já processou BrandTotal, Bright Data e Voyager Labs. **Não fazer.**

**Processar no servidor.** Resolveria o "esconder a implementação", mas destrói o
argumento de privacidade e coloca o projeto como controlador de dados pessoais de
terceiros que nunca consentiram. **Não fazer.**

**API oficial.** Não existe rota que devolva a lista de seguidores. A Graph API dá
`followers_count` e demografia agregada; a Basic Display foi descontinuada. O export
"Baixe suas informações" é o único caminho legítimo.

## 8. Custo conhecido

A fricção de pedir o export manualmente derruba conversão e **é irremovível** sem
violar os Termos. Mitigação: aceitar o `.zip` inteiro (feito), onboarding guiado
(feito) e deixar claro que a recorrência do snapshot é o que faz a ferramenta
funcionar.
