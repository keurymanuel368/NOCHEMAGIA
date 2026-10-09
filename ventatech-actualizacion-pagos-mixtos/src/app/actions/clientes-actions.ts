"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ClienteActionState = { error?: string; success?: string; id?: string };

export async function guardarClienteAction(
  _prev: ClienteActionState,
  formData: FormData
): Promise<ClienteActionState> {
  const supabase = await createClient();
  const id = formData.get("id");

  const { data, error } = await supabase.rpc("guardar_cliente", {
    p_id: id ? String(id) : null,
    p_nombre: String(formData.get("nombre") ?? ""),
    p_cedula: String(formData.get("cedula") ?? ""),
    p_telefono: String(formData.get("telefono") ?? ""),
    p_email: String(formData.get("email") ?? ""),
    p_direccion: String(formData.get("direccion") ?? ""),
    p_limite_credito: Number(formData.get("limite_credito") || 0),
    p_activo: true,
  });

  if (error) return { error: error.message };
  revalidatePath("/clientes");
  revalidatePath("/fiado");
  return { success: "Cliente guardado", id: data as string };
}

export async function eliminarClienteAction(id: string): Promise<ClienteActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("eliminar_cliente", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/clientes");
  return { success: "Cliente eliminado" };
}

export async function registrarAbonoAction(input: {
  deudaId: string;
  monto: number;
  metodoPago: string;
  notas?: string;
}): Promise<ClienteActionState> {
  const monto = Math.round(Number(input.monto) * 100) / 100;
  if (!Number.isFinite(monto) || monto <= 0) return { error: "Monto inválido" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_abono", {
    p_deuda_id: input.deudaId,
    p_monto: monto,
    p_metodo_pago: input.metodoPago,
    p_notas: input.notas ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/clientes");
  revalidatePath("/fiado");
  return { success: "Abono registrado" };
}

export async function saldarTodoAction(input: {
  clienteId: string;
  metodoPago: string;
  notas?: string;
}): Promise<ClienteActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("saldar_todo_cliente", {
    p_cliente_id: input.clienteId,
    p_metodo_pago: input.metodoPago,
    p_notas: input.notas ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/clientes");
  revalidatePath("/fiado");
  return { success: "Deuda saldada" };
}
