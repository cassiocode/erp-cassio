/** Data de hoje no fuso local, como AAAA-MM-DD (formato do <input type="date"> e do banco). */
export function hojeISO(agora = new Date()): string {
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

/** "2026-11-14" -> "14/11/2026" */
export function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}
