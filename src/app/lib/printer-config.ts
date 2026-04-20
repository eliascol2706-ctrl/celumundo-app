// Configuración de impresoras para la aplicación

import { supabase } from './supabase';
import { isPrintingAvailable, PrintingNotAvailableError } from './platform-detector';

export interface PrinterConfig {
  thermal: string; // Impresora térmica para facturas
  labels: string; // Impresora para etiquetas
  pdf: string; // Impresora para PDFs/documentos
}

// Cache en memoria para evitar múltiples queries
let configCache: PrinterConfig | null = null;

// Obtener configuración de impresoras desde Supabase
export const getPrinterConfig = async (): Promise<PrinterConfig> => {
  // Si hay cache, retornar
  if (configCache) {
    return configCache;
  }

  try {
    // Obtener usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { thermal: '', labels: '', pdf: '' };
    }

    // Obtener empresa actual
    const company = localStorage.getItem('current_company') || 'celumundo';

    // Buscar configuración en Supabase
    const { data, error } = await supabase
      .from('printer_settings')
      .select('thermal_printer, label_printer, pdf_printer')
      .eq('user_id', user.id)
      .eq('company', company)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No existe configuración, retornar vacío
        return { thermal: '', labels: '', pdf: '' };
      }
      throw error;
    }

    const config: PrinterConfig = {
      thermal: data.thermal_printer || '',
      labels: data.label_printer || '',
      pdf: data.pdf_printer || '',
    };

    // Guardar en cache
    configCache = config;

    return config;
  } catch (error) {
    console.error('Error al cargar configuración de impresoras:', error);
    return { thermal: '', labels: '', pdf: '' };
  }
};

// Versión síncrona que usa el cache (para compatibilidad con código existente)
export const getPrinterConfigSync = (): PrinterConfig => {
  return configCache || { thermal: '', labels: '', pdf: '' };
};

// Guardar configuración de impresoras en Supabase
export const savePrinterConfig = async (config: PrinterConfig): Promise<void> => {
  try {
    // Obtener usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuario no autenticado');
    }

    // Obtener empresa actual
    const company = localStorage.getItem('current_company') || 'celumundo';

    // Guardar o actualizar en Supabase
    const { error } = await supabase
      .from('printer_settings')
      .upsert({
        user_id: user.id,
        company: company,
        thermal_printer: config.thermal,
        label_printer: config.labels,
        pdf_printer: config.pdf,
      }, {
        onConflict: 'user_id,company'
      });

    if (error) throw error;

    // Actualizar cache
    configCache = config;
  } catch (error) {
    console.error('Error al guardar configuración de impresoras:', error);
    throw error;
  }
};

// Limpiar cache (útil al cambiar de empresa)
export const clearPrinterConfigCache = (): void => {
  configCache = null;
};

// Obtener lista de impresoras disponibles (desde Electron)
export const getAvailablePrinters = async (): Promise<string[]> => {
  // Solo disponible en Electron
  if (!isPrintingAvailable()) {
    return [];
  }

  if (window.electron?.printer) {
    try {
      const printers = await window.electron.printer.getPrinters();
      return printers.map((p: any) => p.name);
    } catch (error) {
      console.error('Error al obtener impresoras:', error);
      return [];
    }
  }
  return [];
};

// Imprimir documento directamente
export const printDirect = async (
  printerName: string,
  content: string,
  type: 'thermal' | 'pdf' | 'label' = 'thermal'
): Promise<boolean> => {
  // Verificar si estamos en Electron
  if (!isPrintingAvailable()) {
    throw new PrintingNotAvailableError();
  }

  if (!window.electron?.printer) {
    console.error('Electron printer no está disponible');
    return false;
  }

  try {
    await window.electron.printer.print({
      printer: printerName,
      content,
      type,
    });
    return true;
  } catch (error) {
    console.error('Error al imprimir:', error);
    return false;
  }
};

// Declaración de tipos para Electron
declare global {
  interface Window {
    electron?: {
      printer: {
        getPrinters: () => Promise<Array<{ name: string; displayName?: string }>>;
        print: (options: {
          printer: string;
          content: string;
          type: 'thermal' | 'pdf' | 'label';
        }) => Promise<void>;
      };
    };
  }
}
