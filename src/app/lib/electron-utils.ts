// Electron utilities for the renderer process

// Type definition for the Electron API exposed via preload script
declare global {
  interface Window {
    electron?: {
      platform: string;
      versions: {
        node: string;
        chrome: string;
        electron: string;
      };
      onGlobalShortcut: (callback: (key: string) => void) => void;
      removeGlobalShortcutListener: () => void;
      isElectron: boolean;
    };
  }
}

/**
 * Check if the app is running in Electron
 */
export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && window.electron?.isElectron === true;
};

/**
 * Get the platform the app is running on
 */
export const getPlatform = (): string => {
  if (isElectron() && window.electron) {
    return window.electron.platform;
  }
  return 'web';
};

/**
 * Register a callback for global shortcuts (F1-F12) in Electron
 * In web mode, this does nothing
 */
export const onGlobalShortcut = (callback: (key: string) => void): void => {
  if (isElectron() && window.electron) {
    window.electron.onGlobalShortcut(callback);
  }
};

/**
 * Remove the global shortcut listener
 */
export const removeGlobalShortcutListener = (): void => {
  if (isElectron() && window.electron) {
    window.electron.removeGlobalShortcutListener();
  }
};

/**
 * Get Electron version information
 */
export const getElectronVersions = () => {
  if (isElectron() && window.electron) {
    return window.electron.versions;
  }
  return null;
};
