-- Kalo · fotos de queso pera y huevos revueltos (GPT Image 2.5, estilo A)
update public.alimentos set foto_url = 'https://sergiosaacx.github.io/kalo/fotos/' || id || '.jpg' where id in ('queso-pera', 'huevos-revueltos');
