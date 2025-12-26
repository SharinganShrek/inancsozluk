import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://raejvigwblergcwgpkes.supabase.co";
const supabaseAnonKey = "sb_publishable_P1xvOMLfKxBVXyg23AeHsQ_vnIIqGPK";

// Simple singleton client to use on the client side
export const supabase = createClient(supabaseUrl, supabaseAnonKey);



