-- Kalo · «Añadidos»: lo que se le pone a un alimento (panela al café, aceite al arroz, lo de un batido propio)
--   [{ alimento_id, cantidad }] — cantidad en porciones base de ese alimento, igual que los ítems
alter table public.plan_items add column if not exists anadidos jsonb;
alter table public.opcion_items add column if not exists anadidos jsonb;
