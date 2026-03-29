/**
 * Copia texto al portapapeles usando diferentes métodos según disponibilidad
 * Implementa fallbacks para entornos donde el Clipboard API está bloqueado
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  // Método 1: Intentar usar el Clipboard API moderno
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // Si falla, intentar con el método antiguo
      console.warn('Clipboard API bloqueado, usando fallback:', err);
    }
  }

  // Método 2: Usar el método antiguo con execCommand (más compatible)
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Hacer el textarea invisible pero funcional
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');
    
    document.body.appendChild(textArea);
    
    // Seleccionar el contenido
    if (navigator.userAgent.match(/ipad|ipod|iphone/i)) {
      // Para iOS
      const range = document.createRange();
      range.selectNodeContents(textArea);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      textArea.setSelectionRange(0, text.length);
    } else {
      // Para otros navegadores
      textArea.select();
      textArea.setSelectionRange(0, text.length);
    }
    
    // Ejecutar el comando de copiar
    const successful = document.execCommand('copy');
    
    // Limpiar
    document.body.removeChild(textArea);
    
    return successful;
  } catch (err) {
    console.error('Error al copiar al portapapeles:', err);
    return false;
  }
};
