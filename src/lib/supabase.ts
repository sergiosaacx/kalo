import { createClient } from '@supabase/supabase-js';

// Llave pública (anon): está hecha para ir en la app; lo que protege los datos son las reglas RLS.
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://fdrgwfgbsxegeuxtxmwa.supabase.co';
const KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkcmd3Zmdic3hlZ2V1eHR4bXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2NDg2NTUsImV4cCI6MjEwNzIyNDY1NX0.NjUTSjAcvZ5M4AVK5u68x9TFsZKcrNgcfsRdmuRAmLw';

export const supabase = createClient(URL, KEY);
