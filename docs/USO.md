# Como usar o Verifica Seguidores

Manual operacional. É a fonte única do que a interface faz; o README aponta para cá
em vez de repetir. Ao mexer na tela, atualize este arquivo.

---

## 1. Escolha um modo e não misture

Existem duas maneiras de rodar, e **cada uma guarda o histórico num lugar diferente**.
Alternar entre elas dá a impressão de que os snapshots sumiram — eles estão lá, no
outro modo.

| | Arquivo único | Servidor local |
|---|---|---|
| Como abre | duplo clique em `VerificaSeguidores.html` | `node server.js` → `http://127.0.0.1:3000` |
| Precisa de Node | não | sim (18+) |
| Onde ficam os snapshots | armazenamento do navegador | `data/snapshots.json`, em disco |
| Some se limpar dados de navegação | **sim**: faça backup | não |
| Limite prático | 60 snapshots | 60 snapshots |

**Recomendação: arquivo único.** É o modo principal, não precisa de terminal, e o
botão de Backup resolve a fragilidade do armazenamento do navegador.

Use o modo servidor se quiser os dados em disco, versionáveis e fora do alcance de
uma limpeza de navegador acidental.

> `index.html` **não abre por duplo clique**. Ele carrega ES Modules, que o navegador
> bloqueia em `file://`, por isso existe o `VerificaSeguidores.html` gerado. `index.html`
> só funciona servido pelo `server.js`.

---

## 2. Primeira vez, do zero até a lista

### Passo 1 — Peça o export ao Instagram

No app ou em [accountscenter.instagram.com](https://accountscenter.instagram.com):

```
Perfil → Menu (☰) → Central de Contas
      → Suas informações e permissões
      → Baixar suas informações
      → Criar exportação → Exportar para o dispositivo
```

Marque exatamente assim:

| Opção | Escolha | Por quê |
|---|---|---|
| Quais informações | **só "Seguidores e seguindo"** | a cópia completa demora horas ou dias; esta sai em minutos |
| Intervalo de datas | **Todo o período** | recorte curto corta seguidores antigos e faz todos eles parecerem que te largaram |
| Formato | **JSON** | em HTML o app não consegue ler |
| Qualidade de mídia | tanto faz | não baixa fotos |

O Instagram avisa por notificação ou e-mail quando fica pronto. O link fica em
**Downloads disponíveis**, na mesma tela, e expira em poucos dias.

### Passo 2 — Arraste o `.zip` para a página

Não descompacte. Solte o arquivo em **qualquer ponto** da página — o app abre o zip
no próprio navegador, acha `followers_N.json` e `following.json` lá dentro e ignora
o resto.

Se preferir descompactar, os arquivos estão em `connections/followers_and_following/`.
Solte os dois de uma vez; a ordem não importa, porque o app identifica cada lista
pelo conteúdo. Havendo `followers_2.json`, `followers_3.json`… selecione **todos**
(segure `Ctrl` ao clicar) — carregar só o primeiro faz a conta sair errada.

Os dois selos abaixo da zona de upload confirmam o que entrou:
`Seguidores: 812` · `Seguindo: 1.203`.

### Passo 3 — Confira a data e salve o snapshot

O campo **Data do export** vem preenchido sozinho. A legenda embaixo diz de onde
veio a data:

- *detectada da data do arquivo* — confiável, é quando a Meta gerou o export;
- *estimada pelo conteúdo, confira*: o carimbo do arquivo se perdeu porque ele foi
  copiado, editado ou veio de outro fuso. Corrija na mão se souber a data certa;
- *definida por você* — você digitou.

Clique em **Salvar snapshot de \<data\>**. Sem isso o app analisa a tela, mas não
guarda nada, e é o histórico guardado que faz a ferramenta funcionar de verdade.

O botão só acende quando as **duas listas vieram do mesmo export recém-carregado**.
Se estiver apagado, a legenda diz o motivo:

- *carregue os arquivos* — nada foi carregado;
- *falta a outra metade deste export* — só um dos dois arquivos entrou;
- *este export já está guardado* — a tela está mostrando o último snapshot salvo,
  não há novidade para gravar.

### Passo 4 — Repita daqui a algumas semanas

É o passo que a maioria pula, e é o único que transforma suspeita em prova.
Uma vez a cada duas ou quatro semanas já dá um bom histórico.

---

## 3. Lendo a tela

### O selo do cabeçalho

- 🟠 **modo suspeita**: você tem 1 snapshot. O app sabe dizer quem não te segue
  de volta, mas não tem como saber quem *removeu* o follow.
- 🟢 **modo prova**: 2 ou mais snapshots. Quem largou é apurado na diferença
  entre eles, não estimado.

**Por que isso importa:** quando alguém te larga, o perfil simplesmente some do
arquivo de seguidores e leva junto a prova de que já te seguiu. Nenhum export
isolado consegue recuperar isso — quem diz que consegue está inventando.

### Os quatro cartões (são as abas — clique para filtrar)

| Cartão | Quem aparece | O que fazer |
|---|---|---|
| **Não me seguem de volta** | você segue, não recebe follow de volta | é a lista de faxina |
| **Largaram depois que eu segui** | o follow existia e sumiu | com 1 snapshot são *suspeitas*; com 2+, *confirmado* |
| **Eu não sigo de volta** | te seguem e você não retribuiu | decidir a quem retribuir |
| **Seguem-se mutuamente** | relação recíproca | nada — está ali para fechar a conta |

"Largaram" é **subconjunto** do primeiro cartão, por isso os números não somam o
total. A frase logo abaixo dos cartões repete isso e descreve a lista aberta.

### As etiquetas de cada linha

| Etiqueta | Significa |
|---|---|
| **Isca confirmada** | te seguiu primeiro (ou troca instantânea), você retribuiu, e ele sumiu — comprovado entre dois snapshots |
| **Te largou** | te seguia e não segue mais, mas **você** seguiu primeiro — some, mas não é o padrão da isca |
| **Isca provável** | você seguiu nos últimos 180 dias e não houve retorno. É palpite, não prova |
| **Nunca retribuiu** | você segue há mais tempo, sem retorno |
| **Te segue** | segue você, você não retribuiu |
| **Mútuo** | vocês dois se seguem |

### O número à direita (risco, 0 a 100)

Some os sinais que apareceram, e a barra deixa comparar de relance:

| Sinal | Peso |
|---|---|
| isca confirmada entre snapshots | +55 |
| sumiu dos seus seguidores | +30 |
| **troca instantânea** (menos de 10s entre os dois follows) | +25 |
| te largou em até 2 dias | +20 |
| isca provável | +20 |
| te largou em até 1 semana | +12 |
| follow seu recente (90 dias) | +8 |
| relação durou mais de um ano | −15 |

**Troca instantânea** é o sinal mais revelador: vocês se seguiram com menos de 10
segundos de diferença, ou seja, foi follow-back reflexo — exatamente o comportamento
que a tática explora.

Mútuos e "te segue" têm risco **sempre 0**, mesmo com troca instantânea. Sem essa
regra, amizades recíprocas poluíam o topo do ranking.

### Barra de ferramentas

- **Buscar perfil**: filtra por trecho do @, dentro da aba aberta.
- **Ordenar**: Maior risco (padrão) · Mais recente · Mais antigo · A–Z. "Recente"
  usa a data que importa em cada aba: seu follow, ou o follow dele quando você não segue.
- **Revisar um a um**: abre a triagem (seção 4).
- **↓ Backup** / **↑ Restaurar**: seção 5.
- **🗑 Limpar histórico**: só aparece quando há perfis marcados; devolve todos à lista.

A lista mostra 24 por página. Clicar no `@` abre o perfil **sempre na mesma aba**
do navegador, em vez de acumular uma por perfil.

---

## 4. Triagem: revisar um a um

Feita para as listas grandes, onde a grade não ajuda. Vira uma fila: você decide,
ela avança, e dá para voltar atrás.

| Tecla | Ação |
|---|---|
| `O` | abre o perfil no Instagram (mesma aba, sempre) |
| `→` ou `Enter` | manter, próximo |
| `Espaço` ou `U` | marcar "parei de seguir", próximo |
| `←` | voltar um |
| `Esc` | sair |

**Marcar não faz nada no Instagram.** O app nunca toca na sua conta — ele só tira o
perfil da sua lista de trabalho para você não revisitar. O unfollow você dá lá, na mão.

O botão de ícone nas linhas da grade faz o mesmo, um perfil por vez.

---

## 5. Backup e restauração

No modo arquivo único, os snapshots ficam no armazenamento do navegador. **Limpar os
dados de navegação apaga tudo.** Perder snapshots antigos é perder a única prova
daquele intervalo, não dá para reconstruir depois.

- **↓ Backup** gera `verifica-seguidores-backup-AAAA-MM-DD.json` com todos os
  snapshots e o histórico. Guarde junto com seus outros backups.
- **↑ Restaurar** mescla o arquivo com o que já existe, sem duplicar snapshots do
  mesmo dia. Serve também para levar o histórico a outro computador ou navegador.

No modo servidor não há botão: os dados já estão em `data/snapshots.json` e
`data/unfollowed_history.json`. Faça backup copiando a pasta `data/`.

---

## 6. Quando algo dá errado

| Mensagem ou sintoma | O que houve | Solução |
|---|---|---|
| *"não é um JSON válido"* | export veio em HTML | refaça o pedido escolhendo **JSON** |
| *"Não reconheci nenhuma lista…"* | o arquivo não é `followers_N.json` nem `following.json` | confira o nome; arquivos renomeados só são aceitos se o conteúdo se identificar, o que não acontece com o de seguidores |
| *"Este .zip é grande demais (ZIP64)"* | você pediu a cópia completa da conta | descompacte e envie os `.json`, ou refaça marcando só "Seguidores e seguindo" |
| *"Seu navegador não sabe abrir .zip"* | navegador antigo | descompacte e envie os `.json`, ou atualize (Chrome 80+, Firefox 113+, Safari 16.4+) |
| *"Export parece recortado"* | intervalo de datas limitado no pedido | **refaça com "Todo o período"**. Salvar assim faz todo seguidor antigo ausente virar um falso "te largou" |
| *"Já existe um snapshot de \<data\>"* | dois exports do mesmo dia | se for outra data, cancele e corrija o campo. Substituir apaga a comparação daquele intervalo |
| *"Seu navegador não permite salvar dados"* | Safari abrindo do disco | use Chrome, Edge ou Firefox, ou clique em **Backup** antes de fechar |
| *"O armazenamento do navegador encheu"* | muitos snapshots | exporte um backup e limpe os dados do site |
| Números menores que o esperado | há `followers_2.json`, `_3`… e só o primeiro entrou | selecione todos, ou arraste o `.zip`, que já pega todos |
| Sumiram meus snapshots | limpou dados de navegação, **ou trocou de modo** | restaure um backup; confira se está no mesmo modo de antes (seção 1) |
| A tela abre vazia | nada carregado ainda | arraste o `.zip` do export |

---

## 7. Privacidade, em uma linha

Nada sai da sua máquina: sem login, sem servidor remoto, sem telemetria, e o app
nunca se conecta ao Instagram — só lê o arquivo que a própria Meta te entregou.

Isso **não pode banir sua conta**, justamente porque não há contato com o Instagram.
Aplicativos que mostram sua lista de seguidores *sem* pedir esse export estão
necessariamente raspando o site ou usando seu login — prática proibida nos Termos e
a principal causa dos bloqueios ligados a "apps de unfollowers".

---

## 8. Mexendo no código

```bash
node build.js          # regera VerificaSeguidores.html a partir de src/ + index.html
node server.js         # modo servidor, em http://127.0.0.1:3000
npm run build:release  # versão publicável, sem comentários, em public/
```

Depois de alterar qualquer coisa em `src/` ou `index.html`, **rode `node build.js`** —
senão o arquivo único continua com a versão antiga. Sem dependências: nada de
`npm install`.
