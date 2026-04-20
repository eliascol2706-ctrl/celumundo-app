// Configuración de impresoras para la aplicación

import { supabase, getCurrentUser } from './supabase';
import { isPrintingAvailable, PrintingNotAvailableError } from './platform-detector';

export interface PrinterConfig {
  thermal: string; // Impresora térmica para facturas
  labels: string; // Impresora para etiquetas
  pdf: string; // Impresora para PDFs/documentos
}

export interface LabelPrinterSettings {
  width: number;
  height: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  orientation: 'horizontal' | 'vertical';
  labelsPerRow: number;
  spacing: number;
}

export const defaultLabelSettings: LabelPrinterSettings = {
  width: 50,
  height: 30,
  marginTop: 5,
  marginBottom: 5,
  marginLeft: 5,
  marginRight: 5,
  orientation: 'horizontal',
  labelsPerRow: 2,
  spacing: 2,
};

// Cache en memoria para evitar múltiples queries
let configCache: PrinterConfig | null = null;

// Obtener configuración de impresoras desde Supabase
export const getPrinterConfig = async (): Promise<PrinterConfig> => {
  // Si hay cache, retornar
  if (configCache) {
    return configCache;
  }

  try {
    // Obtener usuario actual del sistema (no de Supabase Auth)
    const user = getCurrentUser();
    if (!user || !user.id) {
      console.warn('⚠️ No hay usuario logueado o falta user.id');
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
    // Obtener usuario actual del sistema (no de Supabase Auth)
    const user = getCurrentUser();
    if (!user || !user.id) {
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

    if (error) {
      console.error('❌ Error al guardar printer_settings:', error);
      throw error;
    }

    // Actualizar cache
    configCache = config;
    console.log('✅ Configuración de impresoras guardada');
  } catch (error) {
    console.error('❌ Error al guardar configuración de impresoras:', error);
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
      const printerNames = printers.map((p: any) => p.name);
      console.log('✅ Impresoras detectadas:', printerNames.length);
      return printerNames;
    } catch (error) {
      console.error('❌ Error al obtener impresoras:', error);
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
  console.log('🖨️ printDirect llamado:', { printerName, type, contentLength: content.length });

  // Verificar si estamos en Electron
  if (!isPrintingAvailable()) {
    console.error('❌ Impresión no disponible (no estamos en Electron)');
    throw new PrintingNotAvailableError();
  }

  if (!window.electron?.printer) {
    console.error('❌ Electron printer no está disponible');
    return false;
  }

  if (!printerName || printerName.trim() === '') {
    console.error('❌ Nombre de impresora vacío');
    alert('No se ha configurado una impresora. Ve a Configuración para seleccionar una impresora.');
    return false;
  }

  try {
    console.log('📤 Enviando a imprimir:', printerName);
    await window.electron.printer.print({
      printer: printerName,
      content,
      type,
    });
    console.log('✅ Impresión enviada exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error al imprimir:', error);
    alert(`Error al imprimir: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    return false;
  }
};

// Cache para configuración de impresora de etiquetas
let labelSettingsCache: LabelPrinterSettings | null = null;

// Obtener configuración de impresora de etiquetas desde Supabase
export const getLabelPrinterSettings = async (): Promise<LabelPrinterSettings> => {
  // Si hay cache, retornar
  if (labelSettingsCache) {
    return labelSettingsCache;
  }

  try {
    // Obtener usuario actual del sistema (no de Supabase Auth)
    const user = getCurrentUser();
    if (!user || !user.id) {
      return defaultLabelSettings;
    }

    // Obtener empresa actual
    const company = localStorage.getItem('current_company') || 'celumundo';

    // Buscar configuración en Supabase
    const { data, error } = await supabase
      .from('label_printer_settings')
      .select('*')
      .eq('user_id', user.id)
      .eq('company', company)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No existe configuración, retornar predeterminada
        return defaultLabelSettings;
      }
      throw error;
    }

    const settings: LabelPrinterSettings = {
      width: data.width || defaultLabelSettings.width,
      height: data.height || defaultLabelSettings.height,
      marginTop: data.margin_top || defaultLabelSettings.marginTop,
      marginBottom: data.margin_bottom || defaultLabelSettings.marginBottom,
      marginLeft: data.margin_left || defaultLabelSettings.marginLeft,
      marginRight: data.margin_right || defaultLabelSettings.marginRight,
      orientation: data.orientation || defaultLabelSettings.orientation,
      labelsPerRow: data.labels_per_row || defaultLabelSettings.labelsPerRow,
      spacing: data.spacing || defaultLabelSettings.spacing,
    };

    // Guardar en cache
    labelSettingsCache = settings;

    return settings;
  } catch (error) {
    console.error('Error al cargar configuración de impresora de etiquetas:', error);
    return defaultLabelSettings;
  }
};

// Guardar configuración de impresora de etiquetas en Supabase
export const saveLabelPrinterSettings = async (settings: LabelPrinterSettings): Promise<void> => {
  try {
    // Obtener usuario actual del sistema (no de Supabase Auth)
    const user = getCurrentUser();
    if (!user || !user.id) {
      throw new Error('Usuario no autenticado');
    }

    // Obtener empresa actual
    const company = localStorage.getItem('current_company') || 'celumundo';

    // Guardar o actualizar en Supabase
    const { error } = await supabase
      .from('label_printer_settings')
      .upsert({
        user_id: user.id,
        company: company,
        width: settings.width,
        height: settings.height,
        margin_top: settings.marginTop,
        margin_bottom: settings.marginBottom,
        margin_left: settings.marginLeft,
        margin_right: settings.marginRight,
        orientation: settings.orientation,
        labels_per_row: settings.labelsPerRow,
        spacing: settings.spacing,
      }, {
        onConflict: 'user_id,company'
      });

    if (error) throw error;

    // Actualizar cache
    labelSettingsCache = settings;
  } catch (error) {
    console.error('Error al guardar configuración de impresora de etiquetas:', error);
    throw error;
  }
};

// Limpiar cache de configuración de impresora de etiquetas
export const clearLabelPrinterSettingsCache = (): void => {
  labelSettingsCache = null;
};

// Declaración de tipos para Electron
declare global {
  interface Window {
    electron?: {
      isElectron: boolean;
      platform: string;
      versions: {
        node: string;
        chrome: string;
        electron: string;
      };
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
