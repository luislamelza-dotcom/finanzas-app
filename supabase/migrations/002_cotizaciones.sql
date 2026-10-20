-- Reloj de cotizaciones: días hábiles 18:07 Argentina (21:07 UTC) llama a la función "cotizaciones".
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('cotizaciones-diarias', '7 21 * * 1-5',
  $$ select net.http_post(url := 'https://pjuunwpnhzdiaiukywkm.supabase.co/functions/v1/cotizaciones',
       headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <ANON_KEY>'),
       body := '{}'::jsonb, timeout_milliseconds := 60000) $$);
