-- Atualiza matching de tipo ABC/BC (inventário) ↔ PQS ABC/BC (estoque).
-- Execute no SQL Editor se a substituição de pó químico ainda não encontrar estoque.

create or replace function public.extintor_tipo_match_key(t text)
returns text
language plpgsql
immutable
as $$
declare
  v text;
begin
  v := regexp_replace(
    translate(
      upper(trim(translate(coalesce(t, ''), '₂', '2'))),
      'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'AAAAAEEEEIIIIOOOOOUUUUCN'
    ),
    '\s+',
    '',
    'g'
  );

  if v = '' then return ''; end if;
  if v like '%CO2%' or v = 'CO' then return 'CO2'; end if;
  if v like '%AGUA%' then return 'AGUA'; end if;
  if v like '%ESPUMA%' then return 'ESPUMA'; end if;

  if v like '%PQS%' or v like '%POQUIMICO%' or v like '%QUIMICO%' or v like '%POLVO%' or v like '%SECO%' then
    if v like '%ABC%' then return 'PQSABC'; end if;
    if v like '%BC%' then return 'PQSBC'; end if;
    return 'PQS';
  end if;

  if v = 'ABC' then return 'PQSABC'; end if;
  if v = 'BC' then return 'PQSBC'; end if;

  return v;
end;
$$;
