# Melhorias em aberto

O app está em um ponto funcional que cobre os experimentos para os quais foi feito.
Os itens abaixo foram levantados, avaliados e deixados de fora por decisão, não por
esquecimento. Cada um traz o motivo e o que já existe pronto no código.

Ordem: por relação entre valor e custo, do maior para o menor.

---

## 1. Segundo snapshot para ativar o modo prova

**Não é código, é uso.** O motor já faz tudo; falta um export novo salvo em outra
data. Até isso acontecer, o app roda permanentemente em modo suspeita e a metade mais
interessante da análise fica inativa.

Custo: zero de desenvolvimento. Só depende de pedir o export de novo e clicar em
salvar.

## 2. Modo demonstração dentro do app

Hoje, quem abre a demo sem ter um export em mãos vê a tela de upload e vai embora.
O gerador de dados sintéticos usado nos screenshots da documentação já produz um
conjunto determinístico; falta trazer isso para dentro do app, atrás de um botão
"ver com dados de exemplo" no estado vazio.

Ganho direto para portfólio: transforma o link em algo que a pessoa consegue avaliar
em cinco segundos.

Custo estimado: uma tarde. A geração de dados já está resolvida; falta empacotar como
módulo e ligar num botão.

## 3. Export CSV/PDF do ranking

Adiado por decisão de escopo. A lista já é acionável na própria tela e cada linha tem
botão de copiar o @, então exportar é conveniência e não desbloqueia nada.

Custo estimado: uma tarde, quando houver motivo.

## 4. Multi-idioma

Levantamento feito: cerca de 77 strings no JS, concentradas em `ui.js` e `app.js`, e
cerca de 408 palavras no `index.html`. Extrair para um dicionário e detectar o idioma
do navegador é meio dia.

O que trava não é o volume. O tutorial cita rótulos do menu do Instagram
("Central de Contas", "Baixar suas informações"), e esses nomes mudam em cada idioma.
Caminho de menu traduzido de cabeça manda a pessoa procurar um item que não existe,
o que é pior do que deixar em inglês. Cada idioma precisa de alguém conferindo no
app real.

Conclusão: só faz sentido com um falante nativo por idioma disponível para revisar.

## 5. Preencher o histórico com `recently_unfollowed_profiles.json`

O parser já tem `extrairUnfollowsQueVoceFez()` implementado e testado contra um
arquivo real: quase todos os perfis listados já não estavam mais no following, o que
confirma que a fonte é confiável para essa finalidade.

Falta ligar na interface. Serviria para marcar automaticamente como resolvido quem o
usuário já deixou de seguir, em vez de exigir que ele repita na mão o que já fez no
Instagram.

A função está exportada e sem uso hoje. Está mantida de propósito, não é código
morto por descuido.

## 6. IndexedDB no lugar do localStorage

Só vira necessário se os snapshots passarem de uns 5 MB, o que significa muitas
dezenas deles. O limite atual é 60 snapshots, e o `storage-local.js` já trata
`QuotaExceededError` com mensagem clara e orientação de backup.

Enquanto o erro for tratado e o usuário souber o que fazer, trocar a camada de
persistência é otimização prematura.

## 7. Migração para PWA (Vite + TypeScript)

Só se o projeto virar produto de fato. O arquivo único já entrega o essencial do que
uma PWA local-first daria: roda offline, não depende de servidor, guarda estado
local.

Migrar significa trocar `build.js` por Vite e assumir dependências, perdendo a
propriedade de "clonar e rodar sem instalar nada" — que hoje é parte do argumento
técnico do projeto.

---

## Limitações conhecidas que não têm solução

Não são pendências, são características do problema.

**A fricção de pedir o export é irremovível.** Automatizar a coleta exigiria raspar o
Instagram ou usar o login do usuário, o que viola os Termos e é a causa habitual de
banimento associado a apps de unfollowers. A Meta já processou BrandTotal, Bright
Data e Voyager Labs. Não existe API oficial que devolva a lista de seguidores.

**Um export isolado não prova quem largou.** Detalhado em
[ARQUITETURA.md](ARQUITETURA.md#1-a-restrição-que-define-tudo). A heurística de
agrupamento temporal foi testada e recuperou menos de 8% dos casos.

**O export não traz foto de perfil.** Por isso o avatar é um monograma. Buscar as
fotos exigiria bater no Instagram, o que o app não faz.
