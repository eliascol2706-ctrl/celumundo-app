// Utilidades para manejo de strings

/**
 * Normaliza un string removiendo acentos/tildes y convirtiéndolo a minúsculas
 * Ejemplo: "Baterías" -> "baterias"
 */
export function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Verifica si un string incluye otro, ignorando acentos y mayúsculas
 * Ejemplo: "Baterías".includes("baterias") -> true
 */
export function includesIgnoreAccents(text: string, search: string): boolean {
  if (!text || !search) return false;
  return normalizeString(text).includes(normalizeString(search));
}
