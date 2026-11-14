import type { DatabaseSync } from "node:sqlite";

interface Migration {
  versao: number;
  nome: string;
  sql: string;
}

/**
 * Lista de migrations em ordem. Para mudar o banco no futuro (vendas, etc.),
 * adicione uma nova entrada com versão maior. Nunca edite uma já aplicada.
 */
const migrations: Migration[] = [
  {
    versao: 1,
    nome: "criar_materiais",
    sql: `
      CREATE TABLE materiais (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        categoria TEXT,
        unidade TEXT NOT NULL,
        custo_unitario_centavos INTEGER NOT NULL CHECK (custo_unitario_centavos >= 0),
        quantidade_estoque INTEGER NOT NULL DEFAULT 0 CHECK (quantidade_estoque >= 0),
        estoque_minimo INTEGER NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
        ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
        criado_em TEXT NOT NULL,
        atualizado_em TEXT NOT NULL
      );
      CREATE UNIQUE INDEX idx_materiais_nome ON materiais (nome COLLATE NOCASE);
    `,
  },
];

export function rodarMigrations(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      versao INTEGER PRIMARY KEY,
      nome TEXT NOT NULL,
      aplicada_em TEXT NOT NULL
    )
  `);

  const aplicadas = new Set(
    db
      .prepare("SELECT versao FROM schema_migrations")
      .all()
      .map((linha) => Number(linha.versao)),
  );

  const registrar = db.prepare(
    "INSERT INTO schema_migrations (versao, nome, aplicada_em) VALUES (?, ?, ?)",
  );

  for (const m of migrations) {
    if (aplicadas.has(m.versao)) continue;

    db.exec("BEGIN");
    try {
      db.exec(m.sql);
      registrar.run(m.versao, m.nome, new Date().toISOString());
      db.exec("COMMIT");
    } catch (erro) {
      db.exec("ROLLBACK");
      throw erro;
    }
  }
}
