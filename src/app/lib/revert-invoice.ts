// Función para revertir facturas (eliminar y restaurar inventario)

import { supabase, getCurrentCompany, getCurrentUser } from './supabase';

interface RevertInvoiceResult {
  success: boolean;
  message: string;
}

// Verificar si una factura puede ser revertida (menos de 30 minutos de creación)
export const canRevertInvoice = (invoiceCreatedAt: string): boolean => {
  const createdAt = new Date(invoiceCreatedAt);
  const now = new Date();
  const diffInMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

  return diffInMinutes <= 30;
};

// Obtener tiempo restante para revertir en minutos
export const getRevertTimeRemaining = (invoiceCreatedAt: string): number => {
  const createdAt = new Date(invoiceCreatedAt);
  const now = new Date();
  const diffInMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

  return Math.max(0, Math.ceil(30 - diffInMinutes));
};

// Revertir factura: elimina la factura y restaura el inventario
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

    // 3. Verificar que no hayan pasado más de 30 minutos
    if (!canRevertInvoice(invoice.created_at)) {
      return { success: false, message: 'Solo se pueden revertir facturas creadas hace menos de 30 minutos' };
    }

    // 4. Restaurar el stock de cada producto
    for (const item of invoice.items) {
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
        // Habilitar las IDs que fueron deshabilitadas
        newRegisteredIds = product.registered_ids.map((regId: any) => {
          if (item.unitIds.includes(regId.id) && regId.disabled_by === invoiceId) {
            return {
              ...regId,
              disabled: false,
              disabled_by: null,
              disabled_at: null,
            };
          }
          return regId;
        });
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

    // 5. Si es factura a crédito, eliminar los pagos asociados
    if (invoice.is_credit) {
      await supabase
        .from('credit_payments')
        .delete()
        .eq('invoice_id', invoiceId)
        .eq('company', company);
    }

    // 6. Eliminar la factura
    const { error: deleteError } = await supabase
      .from('invoices')
      .delete()
      .eq('id', invoiceId)
      .eq('company', company);

    if (deleteError) {
      console.error('Error al eliminar factura:', deleteError);
      return { success: false, message: 'Error al eliminar la factura' };
    }

    return {
      success: true,
      message: `Factura #${invoice.number} revertida exitosamente. Stock restaurado.`,
    };
  } catch (error) {
    console.error('Error al revertir factura:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error desconocido al revertir factura',
    };
  }
};
