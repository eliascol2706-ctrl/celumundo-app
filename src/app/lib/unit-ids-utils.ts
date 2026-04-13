/**
 * Utilidades para manejar IDs únicas con notas
 */

export type UnitIdWithNote = {
  id: string;
  note: string;
  disabled?: boolean; // Para facturas en confirmación o cambios en espera
  reservedBy?: string; // ID de la factura/cambio que la reservó
  reservationType?: 'invoice' | 'exchange'; // Tipo de reserva
};

/**
 * Extrae solo los IDs de un array de objetos {id, note}
 */
export function extractIds(registeredIds: UnitIdWithNote[]): string[] {
  return registeredIds.map(item => item.id);
}

/**
 * Convierte un array de strings a objetos {id, note}
 */
export function convertToIdsWithNotes(ids: string[]): UnitIdWithNote[] {
  return ids.map(id => ({ id, note: '' }));
}

/**
 * Genera la siguiente ID única basándose en las existentes
 */
export function generateNextUnitId(registeredIds: UnitIdWithNote[]): string {
  if (!registeredIds || registeredIds.length === 0) {
    return "0001";
  }
  
  // Ordenar y encontrar el último número
  const numbers = registeredIds
    .map(item => parseInt(item.id))
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b);
  
  const lastNumber = numbers[numbers.length - 1] || 0;
  const nextNumber = lastNumber + 1;
  
  return nextNumber.toString().padStart(4, "0");
}

/**
 * Genera múltiples IDs únicas consecutivas
 */
export function generateMultipleUnitIds(registeredIds: UnitIdWithNote[], count: number): string[] {
  const newIds: string[] = [];
  let currentIds = [...registeredIds];
  
  for (let i = 0; i < count; i++) {
    const nextId = generateNextUnitId(currentIds);
    newIds.push(nextId);
    currentIds.push({ id: nextId, note: '' });
  }
  
  return newIds;
}

/**
 * Obtiene la nota de una ID específica
 */
export function getNoteForId(registeredIds: UnitIdWithNote[], id: string): string {
  const item = registeredIds.find(item => item.id === id);
  return item?.note || '';
}

/**
 * Crea un mapa de notas por ID
 */
export function createNotesMap(registeredIds: UnitIdWithNote[]): { [id: string]: string } {
  const map: { [id: string]: string } = {};
  registeredIds.forEach(item => {
    map[item.id] = item.note;
  });
  return map;
}

/**
 * Filtra solo las IDs disponibles (no inhabilitadas)
 */
export function getAvailableIds(registeredIds: UnitIdWithNote[]): UnitIdWithNote[] {
  return registeredIds.filter(item => !item.disabled);
}

/**
 * Inhabilita IDs específicas (para facturas en confirmación)
 */
export function disableIds(registeredIds: UnitIdWithNote[], idsToDisable: string[], invoiceId: string): UnitIdWithNote[] {
  return registeredIds.map(item => {
    if (idsToDisable.includes(item.id)) {
      return { ...item, disabled: true, reservedBy: invoiceId };
    }
    return item;
  });
}

/**
 * Habilita IDs inhabilitadas por una factura específica
 */
export function enableIds(registeredIds: UnitIdWithNote[], invoiceId: string): UnitIdWithNote[] {
  return registeredIds.map(item => {
    if (item.reservedBy === invoiceId) {
      const { disabled, reservedBy, ...rest } = item;
      return rest;
    }
    return item;
  });
}

/**
 * Elimina IDs definitivamente
 */
export function removeIds(registeredIds: UnitIdWithNote[], idsToRemove: string[]): UnitIdWithNote[] {
  return registeredIds.filter(item => !idsToRemove.includes(item.id));
}

/**
 * Restaura IDs al inventario con marca de "en cambio" (para cambios pendientes)
 */
export function restoreIdsForExchange(
  registeredIds: UnitIdWithNote[],
  idsToRestore: string[],
  exchangeId: string
): UnitIdWithNote[] {
  const newIds = idsToRestore.map(id => ({
    id,
    note: '',
    disabled: true,
    reservedBy: exchangeId,
    reservationType: 'exchange' as const
  }));

  return [...newIds, ...registeredIds];
}

/**
 * Libera IDs marcadas como "en cambio" cuando se cancela un cambio
 */
export function releaseExchangeIds(registeredIds: UnitIdWithNote[], exchangeId: string): UnitIdWithNote[] {
  return registeredIds.filter(item => !(item.reservedBy === exchangeId && item.reservationType === 'exchange'));
}
