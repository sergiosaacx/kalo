-- Kalo · la medida que se escogió al anotar («1 puntica», «1 alita»…): con solo los gramos no se sabe si 36 g fueron 6 punticas o 2 alitas
alter table public.plan_items add column if not exists medida text;
