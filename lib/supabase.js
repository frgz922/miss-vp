import { createClient } from '@supabase/supabase-js';

let client;

// Se crea solo en el navegador (al usarse), así el build no necesita las claves.
export function getSupabase() {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_KEY
    );
  }
  return client;
}
