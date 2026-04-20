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

// Verificar si la impresión está disponible
export const isPrintingAvailable = (): boolean => {
  return detectPlatform() === 'electron';
};

// Obtener mensaje de advertencia para web
export const getWebPrintingWarning = (): string => {
  return 'La impresión directa solo está disponible en la aplicación de escritorio. Por favor, usa la versión de escritorio para imprimir documentos.';
};

// Clase de error específica para impresión no disponible
export class PrintingNotAvailableError extends Error {
  constructor() {
    super(getWebPrintingWarning());
    this.name = 'PrintingNotAvailableError';
  }
}
