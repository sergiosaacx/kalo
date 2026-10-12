-- Kalo · la arepa de harina precocida se busca por la marca (Promasa, P.A.N., Areparina) o como «arepa de harina»
update public.alimentos set
  sinonimos = array['arepa', 'arepa de Promasa', 'arepa de harina', 'arepa de P.A.N.', 'Areparina', 'masarepa'],
  busqueda = 'arepa de maiz blanco arepa arepa de promasa promasa arepa de harina harina pan p.a.n. areparina masarepa'
where id = 'arepa-maiz-blanco';
update public.alimentos set
  sinonimos = array['arepa de Promasa amarilla', 'arepa de harina amarilla', 'masarepa amarilla'],
  busqueda = 'arepa de maiz amarillo arepa amarilla arepa de promasa amarilla promasa arepa de harina amarilla harina pan areparina masarepa amarilla'
where id = 'arepa-maiz-amarillo';
