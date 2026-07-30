# Verifica Seguidores

Descobre quem te segue, espera você seguir de volta e depois remove o follow — te deixando na posição de "fã" de alguém que nunca quis te seguir.

Funciona a partir do **seu próprio arquivo de dados do Instagram**. Não pede login, não pede senha e não acessa o Instagram. Nada sai do seu computador.

---

## Início rápido

**Você precisa de:** [Node.js 18+](https://nodejs.org) instalado e o seu arquivo de dados do Instagram (passo 1).

### 1. Baixe seus dados do Instagram

No app do Instagram ou no site:

**Perfil → Menu (☰) → Central de Contas → Suas informações e permissões → Baixar suas informações → Baixar ou transferir informações**

Escolha:

| Opção | O que selecionar |
|---|---|
| Conta | Sua conta do Instagram |
| Quais informações | **Selecionar tipos de informações** → marque só **Seguidores e seguindo** |
| Onde entregar | Baixar no dispositivo |
| Formato | **JSON** (não HTML) |
| Intervalo | Todo o período |

O Instagram envia um `.zip` por e-mail — normalmente em alguns minutos.

### 2. Descompacte e ache os dois arquivos

Dentro do `.zip`, vá em `connections/followers_and_following/` e localize:

- `followers_1.json` (se houver `followers_2.json`, `followers_3.json`… guarde todos)
- `following.json`

### 3. Rode o app

Abra o terminal na pasta do projeto:

```bash
node server.js
```

Depois abra **http://127.0.0.1:3000** no navegador.

> Não use Live Server nem abra o `index.html` direto — o próprio comando acima entrega a interface.

### 4. Carregue e salve

1. Clique em **Seguidores** e selecione o `followers_1.json` (se tiver `_2`, `_3`…, selecione todos de uma vez).
2. Clique em **Seguindo** e selecione o `following.json`.
3. Clique em **Salvar como snapshot**.

Pronto. O app já mostra quem não te segue de volta.

### 5. Volte daqui a alguns dias

Baixe um export novo, repita os passos 2 a 4. **É aqui que a ferramenta fica útil de verdade:** com dois arquivos em datas diferentes ela para de supor e passa a provar exatamente quem te largou, quando, e quanto tempo te manteve seguindo.

Para parar o app: `Ctrl + C` no terminal.

---

## Por que preciso baixar duas vezes?

Quando alguém deixa de te seguir, o perfil simplesmente **desaparece** do seu arquivo de seguidores. Não fica registro. Com um arquivo só, é impossível saber se a pessoa nunca te seguiu ou se te seguiu e sumiu.

Comparando dois arquivos de datas diferentes, a diferença entre eles revela exatamente quem saiu.

| Você tem | O app entrega |
|---|---|
| 1 export | Quem não te segue de volta, com **suspeitas** ranqueadas |
| 2 ou mais | **Prova**: quem te largou, quando, quem seguiu primeiro e por quanto tempo te reteve |

A tela avisa em qual dos dois modos você está. Quanto mais exports você acumular, mais completo fica o histórico.

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

## Privacidade

- Roda inteiramente no seu computador. Não há conta, nuvem, telemetria ou envio de dados.
- O servidor aceita conexões **somente do seu próprio computador** e exige uma chave gerada a cada execução, então nenhum site aberto em outra aba consegue acessar seus dados.
- Seus arquivos ficam na pasta `data/`, que o Git ignora — não vão para o GitHub se você publicar o projeto.
- Para apagar tudo: pare o app e delete a pasta `data/`.

## Isso pode banir minha conta?

Não. O app nunca se conecta ao Instagram — ele apenas lê o arquivo que a própria Meta te entregou.

Vale o alerta: aplicativos que mostram sua lista de seguidores **sem pedir esse arquivo** estão necessariamente raspando o Instagram ou usando seu login, prática proibida nos Termos de Uso e principal causa dos bloqueios associados a "apps de unfollowers". Não existe API oficial que forneça a lista de seguidores. Se um app mostra a lista sem pedir seu export, ele está te colocando em risco.

## Problemas comuns

| Sintoma | Solução |
|---|---|
| `node: command not found` | Instale o [Node.js](https://nodejs.org) e reabra o terminal. |
| A página não abre | Confirme que o terminal está rodando e use `http://127.0.0.1:3000`. |
| `EADDRINUSE` | A porta 3000 está ocupada. Rode `PORT=3001 node server.js` e abra na porta 3001. |
| "não é um JSON válido" | Você baixou o export em HTML. Refaça o pedido escolhendo **JSON**. |
| Números menores que o esperado | Você tem mais de um `followers_N.json` e carregou só o primeiro. Selecione todos juntos. |
| A tela abre vazia | Carregue os dois arquivos e clique em **Salvar como snapshot**. |

## Licença

MIT — veja [LICENSE](LICENSE).
