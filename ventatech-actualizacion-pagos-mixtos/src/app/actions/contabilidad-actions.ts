"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getResumenContable } from "@/lib/contabilidad/queries";
import { getUsuarioActual } from "@/lib/get-usuario-actual";

export type GastoActionState = { error?: string; success?: string; id?: string };

async function requireContabilidad() {
  const actual = await getUsuarioActual();
  if (!actual || !(actual.es_admin || actual.perm_contabilidad)) {
    throw new Error("Sin permiso para ver contabilidad");
  }
}

export async function obtenerResumenAction(desde: string, hasta: string) {
  await requireContabilidad();
  return getResumenContable(desde, hasta);
}

export async function guardarGastoAction(
  _prev: GastoActionState,
  formData: FormData
): Promise<GastoActionState> {
  // Un gasto en cero o negativo sumaba dinero a la utilidad y al efectivo
  // esperado de la caja.
  const monto = Math.round(Number(formData.get("monto") || 0) * 100) / 100;
  if (!Number.isFinite(monto) || monto <= 0) return { error: "El monto del gasto debe ser mayor que cero" };
  const supabase = await createClient();
  const id = formData.get("id");

  const { data, error } = await supabase.rpc("guardar_gasto", {
    p_id: id ? String(id) : null,
    p_descripcion: String(formData.get("descripcion") ?? ""),
    p_categoria_gasto: String(formData.get("categoria_gasto") ?? "General"),
    p_monto: monto,
    p_metodo_pago: String(formData.get("metodo_pago") ?? "efectivo"),
    p_notas: String(formData.get("notas") ?? ""),
  });

  if (error) return { error: error.message };
  revalidatePath("/contabilidad");
  return { success: "Gasto guardado", id: data as string };
}

export async function eliminarGastoAction(id: string): Promise<GastoActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("eliminar_gasto", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/contabilidad");
  return { success: "Gasto eliminado" };
}
