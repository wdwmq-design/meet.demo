import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || "YOUR_URL"
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || "YOUR_ANON_KEY"

const isConfigured = supabaseUrl && supabaseKey && !supabaseUrl.includes("YOUR_") && !supabaseKey.includes("YOUR_")

if (!isConfigured) {
  console.warn("Supabase credentials are not configured. Realtime data is disabled. Add REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in .env.")
}

const emptyChannel = () => ({
  on: () => ({ subscribe: () => ({}) }),
  subscribe: () => ({}),
  unsubscribe: () => ({}),
})

const emptySupabase = {
  channel: emptyChannel,
  removeChannel: () => {},
  from: () => ({
    select: () => ({ data: null, error: null }),
    insert: () => ({ data: null, error: null }),
  }),
}

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : emptySupabase

