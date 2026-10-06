// Supabase devuelve como máximo 1000 filas por consulta. Para los listados,
// reportes y totales se piden todas las filas por páginas de 1000.
//
// La consulta que se pasa debe tener un orden fijo (por ejemplo, terminar en
// `.order("id")`) para que ninguna fila se repita ni se salte entre páginas.
// Sirve en el servidor y en el navegador.

export const PAGINA = 1000;
const MAX_PAGINAS = 500;

type Respuesta<T> = { data: T[] | null; error: { message: string } | null };

export async function traerTodas<T>(
  armar: (desde: number, hasta: number) => PromiseLike<Respuesta<T>>
): Promise<{ data: T[]; error: { message: string } | null }> {
  const filas: T[] = [];
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const desde = pagina * PAGINA;
    const { data, error } = await armar(desde, desde + PAGINA - 1);
    if (error) return { data: filas, error };
    const lote = data ?? [];
    filas.push(...lote);
    if (lote.length < PAGINA) break;
  }
  return { data: filas, error: null };
}
