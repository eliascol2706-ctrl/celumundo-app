// Función para revertir facturas (eliminar y restaurar inventario)

import { supabase, getCurrentCompany, getCurrentUser } from './supabase';

interface RevertInvoiceResult {
  success: boolean;
  message: string;
}

// Obtener la fecha en zona horaria Colombia (GMT-5) en formato YYYY-MM-DD
const getColombiaDateStr = (date: Date): string => {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
};

// Verificar si una factura puede ser revertida (mismo día en zona horaria Colombia)
export const canRevertInvoice = (invoiceCreatedAt: string): boolean => {
  const createdAt = new Date(invoiceCreatedAt);
  const now = new Date();
  return getColombiaDateStr(createdAt) === getColombiaDateStr(now);
};

// Mantener compatibilidad — ya no aplica tiempo en minutos, retorna 0 si expiró
export const getRevertTimeRemaining = (invoiceCreatedAt: string): number => {
  return canRevertInvoice(invoiceCreatedAt) ? 1 : 0;
};

// Revertir factura: la marca como 'anulada' y restaura el inventario
export const revertInvoice = async (invoiceId: string): Promise<RevertInvoiceResult> => {
  try {
    const company = getCurrentCompany();
    const currentUser = getCurrentUser();

    if (!currentUser) {
      return { success: false, message: 'Usuario no autenticado' };
    }

    // 1. Obtener la factura completa antes de eliminarla
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('company', company)
      .single();

    if (invoiceError || !invoice) {
      return { success: false, message: 'Factura no encontrada' };
    }

    // 2. Verificar que la factura no esté en confirmación
    if (invoice.status === 'pending_confirmation') {
      return { success: false, message: 'No se pueden revertir facturas en confirmación' };
    }

    // 3. Verificar que la factura sea del día actual (zona horaria Colombia)
    if (!canRevertInvoice(invoice.created_at)) {
      return { success: false, message: 'Solo se pueden revertir facturas del día actual' };
    }

    // 4. Restaurar el stock de cada producto
    for (const item of invoice.items) {
      // Saltar productos comunes (no están en inventario)
      if (item.productId.startsWith('common-')) continue;

      const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', item.productId)
        .eq('company', company)
        .single();

      if (productError || !product) {
        console.error(`Producto ${item.productId} no encontrado`);
        continue;
      }

      // Restaurar stock
      const newStock = product.stock + item.quantity;
      let newRegisteredIds = product.registered_ids;

      // Si la factura usó IDs únicas, restaurarlas
      if (item.unitIds && item.unitIds.length > 0) {
        // Importar función para restaurar IDs
        const { restoreReturnedIds } = await import('./unit-ids-utils');

        // Restaurar las IDs (quita el flag disabled, conserva notas)
        // Esto funciona tanto para IDs vendidas (disabled sin reservedBy)
        // como para IDs deshabilitadas (disabled con reservedBy)
        newRegisteredIds = restoreReturnedIds(product.registered_ids, item.unitIds);
      }

      // Actualizar producto
      await supabase
        .from('products')
        .update({
          stock: newStock,
          registered_ids: newRegisteredIds,
        })
        .eq('id', item.productId)
        .eq('company', company);

      // Registrar movimiento de reversión
      await supabase.from('movements').insert({
        company: company,
        type: 'entry',
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        reason: 'Reversión de factura',
        reference: `Factura ${invoice.number}`,
        user_name: currentUser.username || 'Sistema',
        unit_ids: item.unitIds || [],
      });
    }

    // 5. Si es factura a crédito, eliminar los pagos asociados (ya no aplican)
    if (invoice.is_credit) {
      await supabase
        .from('credit_payments')
        .delete()
        .eq('invoice_id', invoiceId)
        .eq('company', company);
    }

    // 6. Marcar la factura como 'anulada' (no se elimina, queda como registro)
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        status: 'anulada',
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .eq('company', company);

    if (updateError) {
      console.error('Error al anular factura:', updateError);
      return { success: false, message: 'Error al anular la factura' };
    }

    return {
      success: true,
      message: `Factura #${invoice.number} anulada. El inventario fue restaurado.`,
    };
  } catch (error) {
    console.error('Error al revertir factura:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error desconocido al revertir factura',
    };
  }
};
