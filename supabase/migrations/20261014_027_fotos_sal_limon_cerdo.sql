-- Kalo · fotos de sal, jugo de limón y carne de cerdo (GPT Image 2.5, estilo A)
update public.alimentos set foto_url = 'https://sergiosaacx.github.io/kalo/fotos/' || id || '.jpg' where id in ('sal', 'limon-exprimido', 'carne-cerdo');
