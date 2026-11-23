# Estoque de Canecas

Controle simples de insumos (e, nas próximas etapas, produtos e vendas) para uso pessoal, rodando local.
Next.js + TypeScript + SQLite (`node:sqlite`, embutido no Node) + Tailwind + zod.

## Requisitos
- Node.js 24 ou superior (usa o módulo `node:sqlite`, sem dependências nativas)

## Instalar
```bash
npm install
```

## Rodar
```bash
npm run dev
```
Abra http://localhost:3000 (vai para `/insumos`).

## Telas
- **Vendas** (`/vendas`): cada lançamento é **Venda** (entregue, tira do estoque), **Pré-venda**
  (entrega futura com data prevista; já tira do estoque) ou **Rascunho** (não mexe no estoque). Todos podem
  ser **editados** (até trocar o tipo; o estoque acompanha a diferença). **Cancelar** uma venda ou
  pré-venda devolve ao estoque os insumos que ela tirou. A lista mostra as pré-vendas no topo, pela entrega mais próxima. **Concluir** uma pré-venda não
  baixa de novo. Se uma venda, pré-venda ou baixa deixar o estoque **da categoria** negativo (soma de todos os
  insumos dela: caneca preta Top + Trix), aparece o aviso de para qual pré-venda vai faltar material (a entrega mais próxima tem prioridade) e a pré-venda fica marcada com
  "Falta". Lista com faturamento, custo e lucro (só vendas concluídas).
  Cada venda tem a **quantidade de canecas** de cada kit (dá para misturar branca e preta). **Desconto
  progressivo** só sobre o preço das canecas: 3 a 5 canecas = 5%, 6 ou mais = 10%. O desconto pode ser
  trocado por outro valor (ex.: 20%) ou tirado; ele reduz o preço e o lucro, o custo não muda. **Nova venda** (`/vendas/nova`): escolha o kit
  (caneca branca R$ 29,90 ou caneca preta R$ 34,90, os dois já com a caixa de porcelana 325 ml), ajuste
  quantidades, adicione outros insumos (laço...) e edite o preço. Os kits já trazem 1 folha de papel de
  sublimação. O kit pede **categorias** (1 caneca preta + 1 caixa para caneca + 1 papel): cada uma vira o
  insumo de **maior estoque** da categoria, e dá para trocar na linha (ex.: Top no lugar da Trix). Toda venda soma um custo fixo de energia de R$ 0,50 (dá para desmarcar). A venda tira os
  insumos do estoque e guarda o custo do dia; apagar a venda devolve os insumos.
  Insumos com **margem de lucro** (definida no cadastro do insumo) somam no preço quando adicionados fora do
  kit: custo × (1 + margem). Ex.: trufa de R$ 5,99 com 50% soma R$ 8,99.
- **Entregas** (`/entregas`): as pré-vendas a entregar, pela data mais próxima (atrasada, hoje, amanhã...),
  com material OK/sem material e quanto falta receber. **Concluir** = entregou (vira venda, sem tirar do
  estoque de novo). **Alterar** = informar a nova data de entrega.
- **Insumos** (`/insumos`): itens que compõem o custo dos produtos (canecas branca e preta, caixas,
  embalagens, papel, tinta, brindes). No cadastro você informa a primeira compra: **total pago** e
  **quantidade comprada** (ex.: 12 canecas por R$ 126,00 = R$ 10,50 cada). Ao digitar o nome, aparecem
  os insumos já cadastrados. A quantidade em estoque pode ficar negativa.
  Todo insumo tem uma **categoria** (obrigatória), com filtro na lista.
- **Padrão da venda** (`/insumos/kits`, botão na tela de Insumos): os kits da nova venda. Para cada kit:
  nome, preço por caneca, se aparece na venda e as **categorias com quantidade** que saem do estoque a cada
  caneca (ex.: + 1 Sacola). Dá para criar kits novos. Vale para as próximas vendas; as gravadas não mudam.
- **Categorias** (`/categorias`): o tipo do material, independente do fornecedor. Bases de caneca:
  **Caneca cor branca** e **Caneca Cor Preta c/ Tarja Branca** (Top, Trix...). Crie, renomeie e inative
  categorias aqui; a lista mostra quantos insumos ativos e o estoque somado de cada uma.
- **Compras do insumo** (`/insumos/:id/compras`): lance novas compras (8 em estoque + 12 comprados = 20).
  O custo do insumo é a **média ponderada** das compras. Apagar uma compra tira a quantidade do estoque.
  Cada compra diz se a **entrega foi realizada**. Compra **pendente de entrega** (com previsão) **não conta
  no estoque** até você clicar em **Chegou**; dá para **alterar a previsão**. A lista de insumos mostra o
  total pendente e a próxima previsão. O custo médio já considera as compras pendentes (já foram pagas).

- **Baixas** (`/baixas`): tira insumos do estoque sem venda (estrago, quebra...), com quantidade e motivo
  em texto livre. Guarda o custo médio do dia (para o futuro dashboard). Apagar a baixa devolve ao estoque.

O custo total de cada produto (soma dos insumos usados) fica na futura tela de produtos.

## Banco de dados
- Arquivo: `data/estoque.db` (criado automaticamente). Ele **vai para o git** (repositório privado);
  backups e os arquivos `-wal`/`-shm` do SQLite ficam fora.
- Antes de commitar o banco, grave as alterações pendentes no arquivo principal: `npm run db:checkpoint`.
- Para usar outro caminho: variável de ambiente `DB_PATH`.
- Migrations rodam sozinhas na primeira conexão (tabela `schema_migrations`).
  Antes de atualizar o sistema, vale fazer backup: **pare o `npm run dev`** e copie `data/estoque.db`
  (com o sistema rodando, as alterações recentes ficam no arquivo `estoque.db-wal` e a cópia sai incompleta).

## Dados de exemplo
```bash
npm run db:seed
```
Insere insumos de exemplo (caneca branca, caneca preta, caixa, plástico bolha, papel, tinta,
fita térmica, bombom). Não duplica se já existirem.

## Testes
```bash
npm test
```
Os testes usam banco em memória e não mexem em `data/estoque.db`.

## Observação
Insumos não são apagados: use **Inativar/Reativar**, para preservar o histórico de produtos e vendas.
