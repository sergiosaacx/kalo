-- Kalo · «Tu salud»: condiciones que cambian el metabolismo (tiroides, ajuste del médico)
--   { tiroides: 'hipo'|'hiper'|null, medicamento: 'si'|'no'|'nose'|null, conMedico: bool, medico: int (%)|null, ninguna: bool }
alter table public.perfiles add column if not exists salud jsonb;
