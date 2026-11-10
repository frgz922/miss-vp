'use client';
import { useEffect, useState } from 'react';
import { getSupabase } from './supabase';

// Ajustes públicos del certamen (votación abierta, finalistas publicadas…).
// Devuelve null mientras carga.
export function useSettings() {
  const [settings, setSettings] = useState(null);
  useEffect(() => {
    getSupabase().from('settings').select('*').eq('id', 1).single()
      .then(({ data }) => setSettings(data || {}))
      .catch(() => setSettings({}));
  }, []);
  return settings;
}
