# Estoque de Canecas

Controle simples de estoque (e, nas próximas etapas, vendas) para uso pessoal, rodando local.
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
Abra http://localhost:3000 (vai para `/materiais`).

## Banco de dados
- Arquivo: `data/estoque.db` (criado automaticamente; a pasta `data/` não vai para o git).
- Para usar outro caminho: variável de ambiente `DB_PATH`.
- Migrations rodam sozinhas na primeira conexão (tabela `schema_migrations`).

## Dados de exemplo
```bash
npm run db:seed
```
Insere caneca, caixa, embalagem e bombom (não duplica se já existirem).

## Testes
```bash
npm test
```

## Observação
Materiais não são apagados: use **Inativar/Reativar**, para preservar o histórico das vendas futuras.
