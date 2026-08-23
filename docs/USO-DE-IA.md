# Uso de IA neste projeto

Documento de transparência. Descreve onde assistentes de IA entraram no
desenvolvimento, o que continua sendo responsabilidade humana e quais garantias
existem sobre o que foi entregue.

Está aqui por uma razão simples: ferramenta usada às claras é prática de engenharia,
usada às escondidas é problema de confiança. Quem avalia o repositório merece saber
qual foi o processo.

## Onde a IA foi usada

Parte da implementação, dos testes e da documentação foi escrita com apoio de um
assistente de IA, em sessões conduzidas pelo autor. Na prática, cobriu:

- escrita de código a partir de decisões já tomadas;
- refatoração de trechos existentes;
- redação da suíte de testes e da documentação;
- revisão de código em busca de casos não tratados.

## O que não foi delegado

**Decisões de produto e arquitetura.** O que o app faz, o que ele se recusa a
afirmar, quais caminhos foram descartados por violarem os Termos da Meta e como os
vereditos são nomeados: tudo isso é decisão do autor, tomada antes de qualquer linha
ser escrita.

**A validação empírica.** A conclusão central do projeto, de que a heurística de
agrupamento temporal recupera menos de 8% dos casos, veio de medição contra um export
real. Não é afirmação de modelo, é resultado de execução. O mesmo vale para os
números que sustentam o Bait Score.

**A decisão de commitar.** Nenhuma alteração entrou no repositório sem revisão.

## Como o resultado é verificado

O processo não depende de confiar no que a ferramenta produziu:

- **52 testes** (`npm test`), com cobertura escolhida por risco. O scanner de
  comentários do build, por exemplo, valida que o resultado ainda parseia, que a
  operação é idempotente e que o motor produz saída idêntica antes e depois.
- **CI em Node 20, 22 e 24**, que também confere se o artefato versionado bate com o
  que o código gera.
- **Verificação em produção**: depois do deploy, o HTML servido é comparado byte a
  byte com o build local, e os cabeçalhos de segurança são conferidos na resposta
  real.

Bugs introduzidos durante o trabalho assistido foram encontrados por esses
mecanismos e estão registrados no [CHANGELOG](../CHANGELOG.md). Alguns exemplos: o
scanner de comentários quebrava em template literal com chaves aninhadas, o build de
release gerava arquivos diferentes no Windows e no Linux, e o diagrama SVG tinha
comentário XML inválido que impedia a renderização.

## Acesso a dados durante o desenvolvimento

O assistente teve acesso ao ambiente de desenvolvimento local, incluindo a pasta
`data/`, que contém o export real do autor. Isso foi necessário para validar o
parser e o motor contra dados verdadeiros.

Duas consequências, ambas verificáveis:

- **Nada disso foi versionado.** `data/` está no `.gitignore` desde a linha 2 do
  primeiro commit, e nenhum arquivo de dados aparece em commit nenhum do histórico.
- **Os materiais públicos usam dados sintéticos.** Os screenshots da documentação
  vêm de um gerador determinístico de perfis inventados, com semente fixa.
  Nenhum @ real aparece em imagem ou texto publicado.

## Limites que valem declarar

Assistente de IA erra, e erra de um jeito específico: produz código plausível que
falha em caso de borda, e texto confiante sobre coisas que não verificou. As defesas
adotadas foram testes contra dados reais, validação automática no build e
conferência do que está em produção, em vez de confiar na saída.

Se você encontrar algo neste repositório que contradiga o que está escrito aqui,
abra uma issue. O documento existe para ser cobrado.
