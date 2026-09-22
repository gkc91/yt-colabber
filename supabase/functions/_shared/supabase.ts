import { createClient } from "npm:@supabase/supabase-js@2";

export const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

// İstek yapan kullanıcıyı JWT'den çöz (client'tan gelen çağrılar için)
export const userFromRequest = async (req: Request) => {
  const auth = req.headers.get("Authorization") ?? "";
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Response("unauthorized", { status: 401 });
  return data.user;
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
