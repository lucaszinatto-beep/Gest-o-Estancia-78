/* ESTÂNCIA 78 – configuração do site próprio (Vercel + Supabase)
   Supabase › Project Settings › API (ou "Connect"):
   - Project URL  → supabaseUrl
   - anon public  → supabaseAnonKey   (chave pública; a segurança vem das regras RLS do banco)
   Deixe "COLE_AQUI" para usar o sistema somente dentro do Claude. */
window.ESTANCIA_CONFIG = {
  supabaseUrl: 'https://roofmiyjlhkxdsjwzvki.supabase.co',
  supabaseAnonKey: 'sb_publishable_qPM_8atK-xnjDuF69rT5OA_Kqs9ZAPB'
};
