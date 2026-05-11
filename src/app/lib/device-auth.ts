// Sistema de autenticación de dispositivos
import { supabase } from './supabase';

// Generar un identificador único del dispositivo (fingerprint)
const generateDeviceId = (): string => {
  const navigator = window.navigator;
  const screen = window.screen;

  // Combinar información del dispositivo para crear un fingerprint
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.colorDepth,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0,
    navigator.platform
  ];

  // Crear un hash simple del fingerprint
  const fingerprint = components.join('|');

  // Convertir a un ID más corto usando hash
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return `device_${Math.abs(hash).toString(36)}`;
};

// Obtener información del dispositivo
const getDeviceInfo = () => {
  const navigator = window.navigator;
  const screen = window.screen;

  let deviceType = 'desktop';
  if (/Mobi|Android/i.test(navigator.userAgent)) {
    deviceType = 'mobile';
  } else if (/Tablet|iPad/i.test(navigator.userAgent)) {
    deviceType = 'tablet';
  }

  return {
    device_id: generateDeviceId(),
    device_name: `${deviceType} - ${navigator.platform}`,
    device_type: deviceType,
    user_agent: navigator.userAgent,
    screen_resolution: `${screen.width}x${screen.height}`
  };
};

// Verificar si el dispositivo está autorizado
export const checkDeviceAuthorization = async (): Promise<boolean> => {
  try {
    const deviceInfo = getDeviceInfo();

    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('device_id', deviceInfo.device_id)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return false;
    }

    // Actualizar último acceso
    await supabase
      .from('devices')
      .update({
        last_access: new Date().toISOString(),
        access_count: (data.access_count || 0) + 1
      })
      .eq('device_id', deviceInfo.device_id);

    return true;
  } catch (error) {
    console.error('Error checking device authorization:', error);
    return false;
  }
};

// Registrar un nuevo dispositivo
export const registerDevice = async (): Promise<boolean> => {
  try {
    const deviceInfo = getDeviceInfo();

    // Verificar si ya existe
    const { data: existing } = await supabase
      .from('devices')
      .select('*')
      .eq('device_id', deviceInfo.device_id)
      .single();

    if (existing) {
      // Si existe pero está inactivo, reactivarlo
      if (!existing.is_active) {
        await supabase
          .from('devices')
          .update({
            is_active: true,
            last_access: new Date().toISOString(),
            access_count: (existing.access_count || 0) + 1
          })
          .eq('device_id', deviceInfo.device_id);
      }
      return true;
    }

    // Registrar nuevo dispositivo
    const { error } = await supabase
      .from('devices')
      .insert([{
        device_id: deviceInfo.device_id,
        device_name: deviceInfo.device_name,
        device_type: deviceInfo.device_type,
        user_agent: deviceInfo.user_agent,
        first_access: new Date().toISOString(),
        last_access: new Date().toISOString(),
        access_count: 1,
        is_active: true
      }]);

    if (error) {
      console.error('Error registering device:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error registering device:', error);
    return false;
  }
};

// Revocar autorización del dispositivo
export const revokeDeviceAuthorization = async (): Promise<boolean> => {
  try {
    const deviceInfo = getDeviceInfo();

    const { error } = await supabase
      .from('devices')
      .update({ is_active: false })
      .eq('device_id', deviceInfo.device_id);

    if (error) {
      console.error('Error revoking device:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error revoking device:', error);
    return false;
  }
};
