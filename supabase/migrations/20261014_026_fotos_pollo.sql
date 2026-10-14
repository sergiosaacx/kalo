-- Kalo · fotos de pollo sudado y pollo frito (GPT Image 2.5, estilo A)
update public.alimentos set foto_url = 'https://sergiosaacx.github.io/kalo/fotos/' || id || '.jpg' where id in ('pollo-sudado', 'pollo-frito');
