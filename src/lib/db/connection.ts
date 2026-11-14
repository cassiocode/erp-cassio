import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { normalizarTexto } from "../texto";
import { rodarMigrations } from "./migrations";

// Guardado em globalThis para sobreviver ao hot reload do `next dev`
const globalComBanco = globalThis as unknown as { __estoqueDb?: DatabaseSync };

/** Caminho do banco: variável DB_PATH ou data/estoque.db */
export function caminhoDoBanco(): string {
  return process.env.DB_PATH ?? path.join(process.cwd(), "data", "estoque.db");
}

export function getDb(): DatabaseSync {
  if (globalComBanco.__estoqueDb) return globalComBanco.__estoqueDb;

  const caminho = caminhoDoBanco();
  if (caminho !== ":memory:") {
    mkdirSync(path.dirname(caminho), { recursive: true });
  }

  const db = new DatabaseSync(caminho);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  // O COLLATE NOCASE só ignora maiúsculas em letras sem acento (A-Z); por isso a função normalizar()
  db.function("normalizar", { deterministic: true }, (valor) =>
    typeof valor === "string" ? normalizarTexto(valor) : valor,
  );
  rodarMigrations(db);

  globalComBanco.__estoqueDb = db;
  return db;
}
