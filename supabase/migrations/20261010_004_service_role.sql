-- Kalo · las funciones del servidor usan service_role. Como el proyecto no expone tablas solo,
-- también hay que darle acceso explícito (y para las tablas que se creen después).
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
