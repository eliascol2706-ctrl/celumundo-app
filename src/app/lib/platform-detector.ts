// Detecta si la aplicación está corriendo en Electron o en navegador web

export type Platform = 'electron' | 'web';

// Detectar plataforma actual
export const detectPlatform = (): Platform => {
  // Verificar si window.electron.isElectron está disponible (solo en Electron)
  if (typeof window !== 'undefined' && window.electron?.isElectron) {
    return 'electron';
  }
  return 'web';
};

/**
 * isPrintingAvailable — retorna true solo en Electron.
 * La impresión solo está disponible en la aplicación de escritorio.
 */
export const isPrintingAvailable = (): boolean => {
  return detectPlatform() === 'electron';
};

// Verificar si la plataforma es Electron (impresoras físicas directas)
export const isElectronPlatform = (): boolean => {
  return detectPlatform() === 'electron';
};

// Obtener mensaje informativo sobre el modo de impresión activo
export const getWebPrintingWarning = (): string => {
  if (isElectronPlatform()) {
    return '';
  }
  return 'Modo web: la impresión usará el diálogo del navegador. Para impresión directa a impresora térmica usa la app de escritorio.';
};

// Clase de error específica para impresión no disponible
export class PrintingNotAvailableError extends Error {
  constructor() {
    super(getWebPrintingWarning());
    this.name = 'PrintingNotAvailableError';
  }
}
