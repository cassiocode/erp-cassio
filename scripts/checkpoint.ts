import { caminhoDoBanco, getDb } from "../src/lib/db/connection";

// Grava no data/estoque.db o que ainda está no arquivo -wal, para o commit levar o banco completo.
const resultado = getDb().prepare("PRAGMA wal_checkpoint(TRUNCATE)").get() as { busy: number; log: number; checkpointed: number };

if (resultado.busy) {
  console.error("O banco está em uso agora; tente de novo em alguns segundos (ou pare o npm run dev).");
  process.exit(1);
}
console.log(`Checkpoint ok em ${caminhoDoBanco()}: ${resultado.checkpointed} página(s) gravada(s).`);
