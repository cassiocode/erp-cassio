import { redirect } from "next/navigation";

// "Materiais" agora se chama "Insumos"; mantém links antigos funcionando
export default function MateriaisAntigo() {
  redirect("/insumos");
}
