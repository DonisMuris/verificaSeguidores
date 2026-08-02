# Verifica Seguidores

Descobre quem te segue, espera você seguir de volta e depois remove o follow — te deixando na posição de "fã" de alguém que nunca quis te seguir.

Funciona a partir do **seu próprio arquivo de dados do Instagram**. Não pede login, não pede senha e não acessa o Instagram. Nada sai do seu computador.

---

## Início rápido

**Não instala nada.** O projeto não tem dependências: nenhum `npm install`, nenhum ambiente virtual, nenhum resíduo para limpar depois.

1. Baixe seus dados do Instagram em **formato JSON** ([passo a passo detalhado abaixo](#como-baixar-seus-dados-no-instagram)).
2. Descompacte o `.zip` e localize `connections/followers_and_following/`.
3. Dê **duplo clique em `VerificaSeguidores.html`**.
4. Carregue `followers_1.json` e `following.json` e clique em **Salvar como snapshot**.
5. **Repita daqui a alguns dias** com um export novo — é aí que a ferramenta prova quem te largou.

Só isso. Sem terminal, sem servidor, sem Node.

> O arquivo ocupa ~55 KB e guarda os dados no armazenamento do próprio navegador.
> Para apagar tudo: use **Limpar histórico** ou limpe os dados do site no navegador.

---

## Como baixar seus dados no Instagram

### 1. Peça o export para a Meta

No app do Instagram, ou em [accountscenter.instagram.com](https://accountscenter.instagram.com):

```
Perfil → Menu (☰) → Central de Contas
      → Suas informações e permissões
      → Exportar suas informações        (nome antigo: "Baixar suas informações")
      → Criar exportação → Exportar para o dispositivo
```

Escolha assim:

| Opção | O que selecionar |
|---|---|
| Conta | Sua conta do Instagram |
| Quais informações | **Selecionar tipos de informações** → marque só **Seguidores e seguindo** |
| **Intervalo de datas** | **Todo o período** — nunca "Último ano" |
| **Formato** | **JSON** — obrigatório |
| Qualidade de mídia | Irrelevante (não baixa fotos) |

> **Três armadilhas comuns:**
> Escolher **HTML** em vez de JSON — o app não consegue ler, e é preciso refazer o pedido.
> Pedir a **cópia completa** — demora horas ou dias. Marcando só "Seguidores e seguindo", costuma sair em minutos.
> Deixar o **intervalo de datas** em "Último ano" — a Meta corta a lista de seguidores e mantém a de seguindo. O arquivo parece válido, mas quem te segue há mais tempo some dele. O app detecta e avisa, mas o certo é marcar "Todo o período".

O Instagram avisa quando ficar pronto. O download fica em **Downloads disponíveis**, dentro da mesma tela, e expira em poucos dias.

### 2. Ache os dois arquivos dentro do .zip

Descompacte o arquivo baixado. A estrutura é esta:

```
seu-export/
└── connections/
    └── followers_and_following/
        ├── followers_1.json      ← carregue no campo "Seguidores"
        └── following.json        ← carregue no campo "Seguindo"
```

Se existirem `followers_2.json`, `followers_3.json`… (contas com muitos seguidores), **selecione todos juntos** no campo "Seguidores" — segure `Ctrl` ao clicar. Carregar só o primeiro faz a conta sair errada, sem aviso.

Os outros arquivos da pasta não são usados.

### 3. Onde colocar os arquivos?

**Em lugar nenhum.** Não existe pasta de destino. Você clica nos campos do app e seleciona os arquivos onde eles já estiverem — Downloads, Área de Trabalho, um pendrive, tanto faz.

O app apenas lê o conteúdo na hora. Não copia, não move e não envia nada para lugar algum.

---

## Por que preciso baixar duas vezes?

Quando alguém deixa de te seguir, o perfil simplesmente **desaparece** do seu arquivo de seguidores. Não fica registro nenhum. Com um arquivo só, é impossível distinguir quem nunca te seguiu de quem te seguiu e sumiu.

Comparando dois arquivos de datas diferentes, a diferença entre eles revela exatamente quem saiu — e os horários registrados provam quem seguiu primeiro.

| Você tem | O app entrega |
|---|---|
| 1 export | Quem não te segue de volta, com **suspeitas** ranqueadas |
| 2 ou mais | **Prova**: quem te largou, quando, quem seguiu primeiro e por quanto tempo te reteve |

A tela avisa em qual dos dois modos você está. Quanto mais exports acumular, mais completo fica o histórico. Um a cada duas semanas já dá um bom retrato.

---

## Entendendo a tela

**Abas**

| Aba | Significado |
|---|---|
| Ranking de iscas | Todos os perfis com algum risco, do pior para o melhor |
| Isca confirmada | Te seguiu primeiro, você retribuiu, e ele sumiu depois — comprovado |
| Te largaram | Te seguia antes e não segue mais |
| Não te seguem | Você segue e não há retorno |
| Te seguem e você não | Perfis que te seguem sem retribuição sua |

**Números do topo**

- **Reciprocidade** — quantos, dos perfis que você segue, te seguem de volta.
- **Não retribuem** — total de perfis que você segue sem retorno.
- **Iscas confirmadas / prováveis** — muda conforme você tenha 1 ou 2+ exports.

**Nos cartões**

- **Risco (0 a 100)** — combina a força da prova, a velocidade do descarte e se houve troca instantânea de follows.
- **Troca instantânea** — vocês se seguiram com menos de 10 segundos de diferença. É a marca do follow-back reflexo, exatamente o comportamento explorado por quem usa a tática.
- **Reteve ~X** — quanto tempo a pessoa te manteve seguindo antes de remover.
- **Copiar** — copia o @ para colar na busca do Instagram (útil quando o perfil trocou de nome).
- **Parei de seguir** — some o perfil da sua lista de trabalho, para você não revisitar. Não faz nada no Instagram; a ação lá é sua, manualmente.

**Backup e Restaurar**

Seus snapshots ficam no navegador. Limpar os dados de navegação apaga tudo. Use **Backup** de vez em quando para gerar um arquivo — e **Restaurar** para trazer o histórico de volta ou levá-lo para outro computador.

---

## Privacidade

- Roda inteiramente no seu computador. Não há conta, nuvem, telemetria ou envio de dados.
- O app nunca se conecta ao Instagram — só lê o arquivo que a própria Meta te entregou.
- Seus arquivos de dados ficam onde você os deixou; o app não os copia.

### Isso pode banir minha conta?

Não, porque não há nenhum contato com o Instagram.

Vale o alerta: aplicativos que mostram sua lista de seguidores **sem pedir esse arquivo** estão necessariamente raspando o Instagram ou usando seu login — prática proibida nos Termos de Uso e principal causa dos bloqueios associados a "apps de unfollowers". Não existe API oficial que forneça a lista de seguidores. Se um app mostra a lista sem pedir seu export, ele está te colocando em risco.

---

## Problemas comuns

| Sintoma | Solução |
|---|---|
| "não é um JSON válido" | Você baixou o export em HTML. Refaça o pedido escolhendo **JSON**. |
| Números menores que o esperado | Você tem mais de um `followers_N.json` e carregou só o primeiro. Selecione todos juntos. |
| A tela abre vazia | Carregue os dois arquivos e clique em **Salvar como snapshot**. |
| "Seu navegador não permite salvar dados" | Raro, acontece no Safari abrindo o arquivo do disco. Use Chrome, Edge ou Firefox — ou clique em **Backup** antes de fechar. |
| Perdi meus snapshots | Provavelmente limpou os dados de navegação. Restaure um backup, ou recarregue os exports. |
| Faltam seguidores na conta | O export foi pedido com intervalo de datas limitado. Refaça marcando **Todo o período**. O app avisa quando detecta o recorte. |
| Não acho os arquivos no .zip | Eles ficam em `connections/followers_and_following/`. Se essa pasta não existe, o export foi pedido sem marcar "Seguidores e seguindo". |

---

## Modo servidor (opcional)

Existe também uma versão que roda com Node e guarda os snapshots em arquivo, na pasta `data/`, em vez do navegador. Útil se você prefere os dados em disco.

```bash
node server.js     # depois abra http://127.0.0.1:3000
```

Requer [Node.js 18+](https://nodejs.org). Continua sem dependências externas.

Para regenerar o `VerificaSeguidores.html` depois de alterar algo em `src/`:

```bash
node build.js
```

---

## Licença

MIT — veja [LICENSE](LICENSE).
