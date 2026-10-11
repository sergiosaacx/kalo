-- Kalo · meta de peso: ajuste de calorías que la persona aceptó según cómo va su peso
--   ajuste_kcal:   kcal extra (o de menos) sobre el objetivo calculado
--   ajuste_desde:  desde esa fecha se mide de nuevo el ritmo real (los pesos anteriores ya se usaron)
alter table public.perfiles add column if not exists ajuste_kcal integer not null default 0;
alter table public.perfiles add column if not exists ajuste_desde date;
