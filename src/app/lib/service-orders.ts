import { supabase, getCurrentCompany } from './supabase';

export interface ServiceOrder {
  id: string;
  company: 'celumundo' | 'repuestos';
  received_date: string;
  payment_status: 'pending' | 'paid' | 'cancelled';
  final_price?: number;
  customer_name?: string;
  customer_phone?: string;
  device_type?: string;
  brand?: string;
  model?: string;
  issue_description?: string;
  diagnosis?: string;
  repair_notes?: string;
  warranty_days?: number;
  technician_name?: string;
  delivery_date?: string;
}

export async function getServiceOrders(): Promise<ServiceOrder[]> {
  try {
    const company = getCurrentCompany();
    const { data, error } = await supabase
      .from('service_orders')
      .select('*')
      .eq('company', company)
      .order('received_date', { ascending: false });

    if (error) {
      // Si la tabla no existe, retornar array vacío sin mostrar error
      if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
        return [];
      }
      console.error('Error fetching service orders:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getServiceOrders:', error);
    return [];
  }
}
