-- ════════════════════════════════════════════════════════
-- MIGRACIÓN: seed del catálogo de analitos (labs — sub-fase 1B)
-- Pobla analitos_catalogo con ~170 analitos clínicos relevantes
-- para la práctica médica en México. Rangos de referencia en
-- unidades convencionales mexicanas (Salud Digna, Chopo, LAPI,
-- BioNet). Revisión clínica por Angel antes de ejecutar.
-- Ejecutar en Supabase SQL Editor DESPUÉS de sub-fase 1A.
--
-- Notas de criterio:
--   * IMC NO va aquí (es derivado — vive en pacientes.imc).
--   * Rangos sex-dependent solo donde la literatura lo soporta.
--   * Rangos por edad NO en V1 (marcados con `-- verificar:`
--     donde la edad del paciente importa mucho, ej. PSA, DHEA-S).
--   * Unidad única por analito (convención MX).
--   * bands_type: high-bad / low-bad / low-and-high-bad / none.
-- ════════════════════════════════════════════════════════


-- ─── 1. Antropometría ────────────────────────────────────
-- Claves 'peso' y 'talla' son EXACTAS — el trigger de
-- antropometría y el cálculo de IMC en pacientes dependen de
-- ellas. IMC NO va aquí (es derivado).

insert into analitos_catalogo
  (clave, nombre, nombres_alternativos, categoria, unidad, bands_type, rango_default, precision_decimales)
values
  ('peso',               'Peso',               array['peso corporal','peso actual','weight','kilos'],                'antropometria', 'kg', 'none', null, 1),
  ('talla',              'Talla',              array['estatura','altura','height','estatura corporal'],              'antropometria', 'cm', 'none', null, 1),
  ('perimetro_cadera',   'Perímetro de cadera',array['circunferencia de cadera','cadera','hip circumference'],       'antropometria', 'cm', 'none', null, 0);

insert into analitos_catalogo
  (clave, nombre, nombres_alternativos, categoria, unidad, bands_type, rango_default, rango_femenino, rango_masculino, precision_decimales)
values
  ('perimetro_abdominal', 'Perímetro abdominal',
   array['circunferencia abdominal','cintura','perimetro de cintura','waist circumference','CA'],
   'antropometria', 'cm', 'high-bad',
   '{"ok_max":94,"warn_max":102}'::jsonb,
   '{"ok_max":80,"warn_max":88}'::jsonb,
   '{"ok_max":94,"warn_max":102}'::jsonb,
   0),
  ('perimetro_cuello', 'Perímetro de cuello',
   array['circunferencia de cuello','cuello','neck circumference'],
   'antropometria', 'cm', 'high-bad',
   '{"ok_max":39}'::jsonb,
   '{"ok_max":34}'::jsonb,
   '{"ok_max":39}'::jsonb,
   0);


-- ─── 2. Signos vitales ───────────────────────────────────
-- Claves 'ta_sistolica' y 'ta_diastolica' son EXACTAS — el
-- modal "Agregar medición" tiene UX especial que las empareja
-- como una sola captura de TA. Rangos OMS/JNC-8.

insert into analitos_catalogo
  (clave, nombre, nombres_alternativos, categoria, unidad, bands_type, rango_default, precision_decimales)
values
  ('ta_sistolica',          'TA sistólica',
   array['presion sistolica','presión sistólica','TAS','systolic','PAS','tension arterial sistolica'],
   'signos_vitales', 'mmHg', 'high-bad',
   '{"ok_max":120,"warn_max":140}'::jsonb, 0),
  ('ta_diastolica',         'TA diastólica',
   array['presion diastolica','presión diastólica','TAD','diastolic','PAD','tension arterial diastolica'],
   'signos_vitales', 'mmHg', 'high-bad',
   '{"ok_max":80,"warn_max":90}'::jsonb, 0),
  ('frecuencia_cardiaca',   'Frecuencia cardíaca',
   array['FC','pulso','heart rate','HR','lpm','ritmo cardiaco'],
   'signos_vitales', 'lpm', 'low-and-high-bad',
   '{"ok_min":60,"ok_max":100,"warn_min":50,"warn_max":110}'::jsonb, 0),
  ('frecuencia_respiratoria','Frecuencia respiratoria',
   array['FR','respiratory rate','RR','respiraciones por minuto'],
   'signos_vitales', 'rpm', 'low-and-high-bad',
   '{"ok_min":12,"ok_max":20,"warn_min":10,"warn_max":24}'::jsonb, 0),
  ('spo2',                  'Saturación de oxígeno',
   array['SpO2','saturacion O2','oximetria','oxygen saturation','oxigenacion'],
   'signos_vitales', '%', 'low-bad',
   '{"ok_min":95,"warn_min":92}'::jsonb, 0),
  ('temperatura',           'Temperatura corporal',
   array['temp','temperature','T°','temperatura axilar'],
   'signos_vitales', '°C', 'low-and-high-bad',
   '{"ok_min":36.0,"ok_max":37.5,"warn_min":35.5,"warn_max":38.0}'::jsonb, 1);


-- ─── 3. Biometría hemática completa ──────────────────────
-- Sex-dependent: Hb, Hto, eritrocitos (bien establecido
-- en literatura). Diferenciales sin sex-dep en adulto.

insert into analitos_catalogo
  (clave, nombre, nombres_alternativos, categoria, unidad, bands_type, rango_default, precision_decimales)
values
  ('vcm',                   'Volumen corpuscular medio',
   array['MCV','mean corpuscular volume','volumen globular medio','VGM'],
   'hematologia', 'fL', 'low-and-high-bad',
   '{"ok_min":80,"ok_max":100}'::jsonb, 1),
  ('hcm',                   'Hemoglobina corpuscular media',
   array['MCH','mean corpuscular hemoglobin','HGM'],
   'hematologia', 'pg', 'low-and-high-bad',
   '{"ok_min":27,"ok_max":33}'::jsonb, 1),
  ('chcm',                  'Concentración de hemoglobina corpuscular media',
   array['MCHC','mean corpuscular hemoglobin concentration','CHGM'],
   'hematologia', 'g/dL', 'low-and-high-bad',
   '{"ok_min":32,"ok_max":36}'::jsonb, 1),
  ('rdw',                   'Ancho de distribución eritrocitaria',
   array['RDW','red cell distribution width','amplitud de distribucion eritrocitaria'],
   'hematologia', '%', 'high-bad',
   '{"ok_max":14.5}'::jsonb, 1),
  ('leucocitos',            'Leucocitos totales',
   array['WBC','globulos blancos','glóbulos blancos','white blood cells','cuenta leucocitaria'],
   'hematologia', 'x10^3/µL', 'low-and-high-bad',
   '{"ok_min":4.5,"ok_max":11.0}'::jsonb, 2),
  ('neutrofilos_abs',       'Neutrófilos absolutos',
   array['neutros abs','ANC','absolute neutrophil count','neutrofilos totales'],
   'hematologia', 'x10^3/µL', 'low-and-high-bad',
   '{"ok_min":1.8,"ok_max":7.7}'::jsonb, 2),
  ('neutrofilos_porcentaje','Neutrófilos %',
   array['neutros %','neutrophils percent','porcentaje de neutrofilos'],
   'hematologia', '%', 'low-and-high-bad',
   '{"ok_min":40,"ok_max":75}'::jsonb, 1),
  ('linfocitos_abs',        'Linfocitos absolutos',
   array['linfos abs','ALC','absolute lymphocyte count'],
   'hematologia', 'x10^3/µL', 'low-and-high-bad',
   '{"ok_min":1.0,"ok_max":4.0}'::jsonb, 2),
  ('linfocitos_porcentaje', 'Linfocitos %',
   array['linfos %','lymphocytes percent','porcentaje de linfocitos'],
   'hematologia', '%', 'low-and-high-bad',
   '{"ok_min":20,"ok_max":45}'::jsonb, 1),
  ('monocitos_abs',         'Monocitos absolutos',
   array['monos abs','AMC','absolute monocyte count'],
   'hematologia', 'x10^3/µL', 'high-bad',
   '{"ok_max":0.9}'::jsonb, 2),
  ('monocitos_porcentaje',  'Monocitos %',
   array['monos %','monocytes percent'],
   'hematologia', '%', 'high-bad',
   '{"ok_max":10}'::jsonb, 1),
  ('eosinofilos_abs',       'Eosinófilos absolutos',
   array['eos abs','AEC','absolute eosinophil count'],
   'hematologia', 'x10^3/µL', 'high-bad',
   '{"ok_max":0.5}'::jsonb, 2),
  ('eosinofilos_porcentaje','Eosinófilos %',
   array['eos %','eosinophils percent'],
   'hematologia', '%', 'high-bad',
   '{"ok_max":6}'::jsonb, 1),
  ('basofilos_abs',         'Basófilos absolutos',
   array['basos abs','ABC','absolute basophil count'],
   'hematologia', 'x10^3/µL', 'high-bad',
   '{"ok_max":0.2}'::jsonb, 2),
  ('basofilos_porcentaje',  'Basófilos %',
   array['basos %','basophils percent'],
   'hematologia', '%', 'high-bad',
   '{"ok_max":2}'::jsonb, 1),
  ('plaquetas',             'Plaquetas',
   array['PLT','platelets','trombocitos','cuenta plaquetaria'],
   'hematologia', 'x10^3/µL', 'low-and-high-bad',
   '{"ok_min":150,"ok_max":450}'::jsonb, 0),
  ('vpm',                   'Volumen plaquetario medio',
   array['MPV','mean platelet volume','volumen medio plaquetario'],
   'hematologia', 'fL', 'low-and-high-bad',
   '{"ok_min":7.5,"ok_max":11.5}'::jsonb, 1);

insert into analitos_catalogo
  (clave, nombre, nombres_alternativos, categoria, unidad, bands_type, rango_default, rango_femenino, rango_masculino, precision_decimales)
values
  ('hemoglobina', 'Hemoglobina',
   array['Hb','Hgb','hemoglobin','hemoglobina total'],
   'hematologia', 'g/dL', 'low-and-high-bad',
   '{"ok_min":12,"ok_max":17}'::jsonb,
   '{"ok_min":12.0,"ok_max":15.5}'::jsonb,
   '{"ok_min":13.5,"ok_max":17.5}'::jsonb,
   1),
  ('hematocrito', 'Hematocrito',
   array['Hto','Hct','hematocrit','volumen globular'],
   'hematologia', '%', 'low-and-high-bad',
   '{"ok_min":36,"ok_max":52}'::jsonb,
   '{"ok_min":36,"ok_max":46}'::jsonb,
   '{"ok_min":40,"ok_max":52}'::jsonb,
   1),
  ('eritrocitos', 'Eritrocitos',
   array['RBC','globulos rojos','glóbulos rojos','red blood cells','cuenta eritrocitaria'],
   'hematologia', 'x10^6/µL', 'low-and-high-bad',
   '{"ok_min":4.0,"ok_max":5.9}'::jsonb,
   '{"ok_min":4.0,"ok_max":5.2}'::jsonb,
   '{"ok_min":4.5,"ok_max":5.9}'::jsonb,
   2);


-- ─── 4. Química sanguínea básica y electrolitos ──────────
-- glucosa_ayuno y electrolitos son de alta volumetría.
-- Calcio en mg/dL convencional MX (hay labs que reportan
-- en mmol/L — no aplica aquí).

insert into analitos_catalogo
  (clave, nombre, nombres_alternativos, categoria, unidad, bands_type, rango_default, precision_decimales)
values
  ('glucosa_ayuno',     'Glucosa en ayuno',
   array['glicemia','glucemia','fasting glucose','glucosa basal','glu','glucosa'],
   'quimica', 'mg/dL', 'low-and-high-bad',
   '{"ok_min":70,"ok_max":99,"warn_min":60,"warn_max":125}'::jsonb, 0),
  ('urea',              'Urea',
   array['urea serica','urea sérica','urea en sangre','nitrogeno ureico'],
   'quimica', 'mg/dL', 'high-bad',
   '{"ok_min":15,"ok_max":40}'::jsonb, 0),
  ('bun',               'Nitrógeno ureico en sangre',
   array['BUN','nitrogeno ureico','blood urea nitrogen','nitrogeno de urea'],
   'quimica', 'mg/dL', 'high-bad',
   '{"ok_min":7,"ok_max":20}'::jsonb, 0),
  ('sodio',             'Sodio',
   array['Na','Na+','sodium','sodio serico'],
   'quimica', 'mEq/L', 'low-and-high-bad',
   '{"ok_min":135,"ok_max":145}'::jsonb, 1),
  ('potasio',           'Potasio',
   array['K','K+','potassium','potasio serico'],
   'quimica', 'mEq/L', 'low-and-high-bad',
   '{"ok_min":3.5,"ok_max":5.1}'::jsonb, 2),
  ('cloro',             'Cloro',
   array['Cl','Cl-','chloride','cloruro'],
   'quimica', 'mEq/L', 'low-and-high-bad',
   '{"ok_min":98,"ok_max":107}'::jsonb, 1),
  ('calcio',            'Calcio sérico total',
   array['Ca','calcium','calcio total','calcio serico'],
   'quimica', 'mg/dL', 'low-and-high-bad',
   '{"ok_min":8.5,"ok_max":10.5}'::jsonb, 2),
  ('magnesio',          'Magnesio',
   array['Mg','magnesium','magnesio serico'],
   'quimica', 'mg/dL', 'low-and-high-bad',
   '{"ok_min":1.7,"ok_max":2.4}'::jsonb, 2),
  ('fosforo',           'Fósforo',
   array['P','phosphorus','fosforo serico','fosfato'],
   'quimica', 'mg/dL', 'low-and-high-bad',
   '{"ok_min":2.5,"ok_max":4.5}'::jsonb, 2),
  ('bicarbonato',       'Bicarbonato',
   array['HCO3','bicarbonate','bicarbonato serico','CO2 total'],
   'quimica', 'mEq/L', 'low-and-high-bad',
   '{"ok_min":22,"ok_max":28}'::jsonb, 1),
  ('anion_gap',         'Anion gap',
   array['brecha anionica','brecha aniónica','AG'],
   'quimica', 'mEq/L', 'low-and-high-bad',
   '{"ok_min":8,"ok_max":16}'::jsonb, 1),
  ('osmolaridad_serica','Osmolaridad sérica',
   array['osmolalidad','serum osmolality','osmolaridad plasmatica'],
   'quimica', 'mOsm/kg', 'low-and-high-bad',
   '{"ok_min":275,"ok_max":295}'::jsonb, 0);

insert into analitos_catalogo
  (clave, nombre, nombres_alternativos, categoria, unidad, bands_type, rango_default, rango_femenino, rango_masculino, precision_decimales)
values
  ('creatinina', 'Creatinina',
   array['creat','creatinine','creatinina serica','Cr'],
   'quimica', 'mg/dL', 'high-bad',
   '{"ok_max":1.3}'::jsonb,
   '{"ok_min":0.5,"ok_max":1.1}'::jsonb,
   '{"ok_min":0.7,"ok_max":1.3}'::jsonb,
   2),
  ('acido_urico', 'Ácido úrico',
   array['uric acid','urato','acido urico serico','AU'],
   'quimica', 'mg/dL', 'high-bad',
   '{"ok_min":2.5,"ok_max":7.2}'::jsonb,
   '{"ok_min":2.5,"ok_max":6.0}'::jsonb,
   '{"ok_min":3.5,"ok_max":7.2}'::jsonb,
   1);


-- ─── 5. Perfil lipídico ──────────────────────────────────
-- HDL es sex-dep (ATP III / AHA). Resto universal adulto.

insert into analitos_catalogo
  (clave, nombre, nombres_alternativos, categoria, unidad, bands_type, rango_default, precision_decimales)
values
  ('colesterol_total',    'Colesterol total',
   array['CT','colesterol','total cholesterol','cholesterol','colesterol serico'],
   'quimica', 'mg/dL', 'high-bad',
   '{"ok_max":200,"warn_max":240}'::jsonb, 0),
  ('ldl',                 'Colesterol LDL',
   array['LDL','LDL-c','colesterol malo','low density lipoprotein','c-LDL'],
   'quimica', 'mg/dL', 'high-bad',
   '{"ok_max":100,"warn_max":160}'::jsonb, 0),
  ('vldl',                'Colesterol VLDL',
   array['VLDL','VLDL-c','very low density lipoprotein','c-VLDL'],
   'quimica', 'mg/dL', 'high-bad',
   '{"ok_max":30}'::jsonb, 0),
  ('trigliceridos',       'Triglicéridos',
   array['TG','triglycerides','triglicéridos séricos','trigliceridos sericos'],
   'quimica', 'mg/dL', 'high-bad',
   '{"ok_max":150,"warn_max":200}'::jsonb, 0),
  ('colesterol_no_hdl',   'Colesterol no-HDL',
   array['non-HDL','colesterol no HDL','CT-HDL'],
   'quimica', 'mg/dL', 'high-bad',
   '{"ok_max":130,"warn_max":160}'::jsonb, 0),
  ('indice_ct_hdl',       'Índice CT/HDL',
   array['indice aterogenico','relacion CT/HDL','aterogenic index','castelli index'],
   'quimica', 'ratio', 'high-bad',
   '{"ok_max":5.0,"warn_max":6.0}'::jsonb, 1);

insert into analitos_catalogo
  (clave, nombre, nombres_alternativos, categoria, unidad, bands_type, rango_default, rango_femenino, rango_masculino, precision_decimales)
values
  ('hdl', 'Colesterol HDL',
   array['HDL','HDL-c','colesterol bueno','high density lipoprotein','c-HDL'],
   'quimica', 'mg/dL', 'low-bad',
   '{"ok_min":40}'::jsonb,
   '{"ok_min":50}'::jsonb,
   '{"ok_min":40}'::jsonb,
   0);


-- ─── 6. Función renal ────────────────────────────────────
-- Sin sex-dep directa en este V1 (creatinina ya está en
-- el panel de química). TFG estimada (CKD-EPI) reportada
-- sin factor de raza por consenso NKF-ASN 2021.

insert into analitos_catalogo
  (clave, nombre, nombres_alternativos, categoria, unidad, bands_type, rango_default, precision_decimales)
values
  ('tfg_estimada',               'TFG estimada',
   array['eGFR','tasa de filtracion glomerular','CKD-EPI','filtrado glomerular','GFR'],
   'quimica', 'mL/min/1.73m²', 'low-bad',
   '{"ok_min":90,"warn_min":60}'::jsonb, 0),
  ('microalbuminuria_spot',      'Microalbuminuria spot',
   array['microalbumina en orina','albumina urinaria','urine albumin','albuminuria'],
   'quimica', 'mg/L', 'high-bad',
   '{"ok_max":20}'::jsonb, 1),
  ('relacion_albumina_creatinina_urinaria', 'Relación albúmina/creatinina urinaria',
   array['UACR','ACR','relacion alb/creat','microalbumina/creatinina','RAC'],
   'quimica', 'mg/g', 'high-bad',
   '{"ok_max":30,"warn_max":300}'::jsonb, 1),
  ('cistatina_c',                'Cistatina C',
   array['cystatin C','cistatina c serica','CysC'],
   'quimica', 'mg/L', 'high-bad',
   '{"ok_min":0.5,"ok_max":1.0}'::jsonb, 2),
  ('albuminuria_24h',            'Albúmina urinaria 24h',
   array['albumina 24 horas','urine albumin 24h','proteinuria selectiva'],
   'quimica', 'mg/24h', 'high-bad',
   '{"ok_max":30}'::jsonb, 1),
  ('depuracion_creatinina_24h',  'Depuración de creatinina 24h',
   array['CrCl','creatinine clearance','aclaramiento de creatinina','DepCr'],
   'quimica', 'mL/min', 'low-bad',
   '{"ok_min":90}'::jsonb, 0);


-- ─── 7. Función hepática ─────────────────────────────────
-- AST/ALT/GGT sex-dep (referencias Prati 2002 / Kwo 2017).
-- TGO/TGP son nombres populares MX para AST/ALT.

insert into analitos_catalogo
  (clave, nombre, nombres_alternativos, categoria, unidad, bands_type, rango_default, precision_decimales)
values
  ('fosfatasa_alcalina',  'Fosfatasa alcalina',
   array['FA','ALP','alkaline phosphatase','fosfatasa alcalina total'],
   'quimica', 'U/L', 'high-bad',
   '{"ok_min":40,"ok_max":130}'::jsonb, 0),
  ('ldh',                 'Deshidrogenasa láctica',
   array['DHL','LDH','lactate dehydrogenase','deshidrogenasa del lactato'],
   'quimica', 'U/L', 'high-bad',
   '{"ok_min":120,"ok_max":250}'::jsonb, 0),
  ('bilirrubina_total',   'Bilirrubina total',
   array['BT','BRB total','total bilirubin','bilirrubina sérica total'],
   'quimica', 'mg/dL', 'high-bad',
   '{"ok_max":1.2}'::jsonb, 2),
  ('bilirrubina_directa', 'Bilirrubina directa',
   array['BD','BRB directa','direct bilirubin','conjugada'],
   'quimica', 'mg/dL', 'high-bad',
   '{"ok_max":0.3}'::jsonb, 2),
  ('bilirrubina_indirecta','Bilirrubina indirecta',
   array['BI','BRB indirecta','indirect bilirubin','no conjugada'],
   'quimica', 'mg/dL', 'high-bad',
   '{"ok_max":0.8}'::jsonb, 2),
  ('albumina',            'Albúmina sérica',
   array['alb','albumin','albumina serica'],
   'quimica', 'g/dL', 'low-bad',
   '{"ok_min":3.5,"ok_max":5.0}'::jsonb, 2),
  ('proteinas_totales',   'Proteínas totales',
   array['PT','total protein','proteinas totales sericas'],
   'quimica', 'g/dL', 'low-and-high-bad',
   '{"ok_min":6.0,"ok_max":8.3}'::jsonb, 1),
  ('globulinas',          'Globulinas',
   array['globulin','globulinas totales'],
   'quimica', 'g/dL', 'low-and-high-bad',
   '{"ok_min":2.0,"ok_max":3.5}'::jsonb, 1),
  ('relacion_a_g',        'Relación albúmina/globulina',
   array['A/G','relacion A/G','albumin globulin ratio'],
   'quimica', 'ratio', 'low-and-high-bad',
   '{"ok_min":1.0,"ok_max":2.5}'::jsonb, 2);

insert into analitos_catalogo
  (clave, nombre, nombres_alternativos, categoria, unidad, bands_type, rango_default, rango_femenino, rango_masculino, precision_decimales)
values
  ('ast', 'Aspartato aminotransferasa',
   array['AST','TGO','SGOT','transaminasa glutamica oxalacetica','aspartate aminotransferase'],
   'quimica', 'U/L', 'high-bad',
   '{"ok_max":40}'::jsonb,
   '{"ok_max":32}'::jsonb,
   '{"ok_max":40}'::jsonb,
   0),
  ('alt', 'Alanina aminotransferasa',
   array['ALT','TGP','SGPT','transaminasa glutamica piruvica','alanine aminotransferase'],
   'quimica', 'U/L', 'high-bad',
   '{"ok_max":41}'::jsonb,
   '{"ok_max":33}'::jsonb,
   '{"ok_max":41}'::jsonb,
   0),
  ('ggt', 'Gamma glutamil transferasa',
   array['GGT','gGT','gamma glutamyl transferase','gamma-GT'],
   'quimica', 'U/L', 'high-bad',
   '{"ok_max":55}'::jsonb,
   '{"ok_max":38}'::jsonb,
   '{"ok_max":55}'::jsonb,
   0);


-- ─── 8. Perfil tiroideo ──────────────────────────────────
-- TSH reportado en µUI/mL convencional MX (equivalente a mUI/L).
-- Anticuerpos anti-TPO y anti-TG son high-bad (positividad).

insert into analitos_catalogo
  (clave, nombre, nombres_alternativos, categoria, unidad, bands_type, rango_default, precision_decimales)
values
  ('tsh',                'Hormona estimulante de tiroides',
   array['TSH','tirotropina','thyroid stimulating hormone','hormona tiroestimulante'],
   'endocrino', 'µUI/mL', 'low-and-high-bad',
   '{"ok_min":0.4,"ok_max":4.0}'::jsonb, 2),
  ('t3_total',           'T3 total',
   array['T3','triyodotironina total','total triiodothyronine'],
   'endocrino', 'ng/dL', 'low-and-high-bad',
   '{"ok_min":80,"ok_max":200}'::jsonb, 0),
  ('t3_libre',           'T3 libre',
   array['FT3','T3L','free triiodothyronine','triyodotironina libre'],
   'endocrino', 'pg/mL', 'low-and-high-bad',
   '{"ok_min":2.3,"ok_max":4.2}'::jsonb, 1),
  ('t4_total',           'T4 total',
   array['T4','tiroxina total','total thyroxine'],
   'endocrino', 'µg/dL', 'low-and-high-bad',
   '{"ok_min":4.5,"ok_max":12.0}'::jsonb, 1),
  ('t4_libre',           'T4 libre',
   array['FT4','T4L','free thyroxine','tiroxina libre'],
   'endocrino', 'ng/dL', 'low-and-high-bad',
   '{"ok_min":0.8,"ok_max":1.8}'::jsonb, 2),
  ('anti_tpo',           'Anticuerpos anti-peroxidasa tiroidea',
   array['anti-TPO','TPO Ab','anti peroxidasa','anti-microsomales','antitiroperoxidasa'],
   'endocrino', 'UI/mL', 'high-bad',
   '{"ok_max":35}'::jsonb, 1),
  ('anti_tiroglobulina', 'Anticuerpos anti-tiroglobulina',
   array['anti-Tg','TgAb','anti tiroglobulina','antitiroglobulina'],
   'endocrino', 'UI/mL', 'high-bad',
   '{"ok_max":40}'::jsonb, 1),
  ('tiroglobulina',      'Tiroglobulina',
   array['Tg','thyroglobulin','tiroglobulina serica'],
   'endocrino', 'ng/mL', 'high-bad',
   '{"ok_max":55}'::jsonb, 1);


-- ─── 9. Marcadores inflamatorios ─────────────────────────
-- VSG sex-dep (Westergren). PCR ultrasensible usada para
-- estratificación de riesgo CV (AHA/CDC).

insert into analitos_catalogo
  (clave, nombre, nombres_alternativos, categoria, unidad, bands_type, rango_default, precision_decimales)
values
  ('pcr',                 'Proteína C reactiva',
   array['PCR','CRP','c-reactive protein','proteina C reactiva convencional'],
   'inmunologia', 'mg/dL', 'high-bad',
   '{"ok_max":1.0}'::jsonb, 2),
  ('pcr_ultrasensible',   'PCR ultrasensible',
   array['hs-CRP','PCRus','PCR us','PCR de alta sensibilidad','high sensitivity CRP'],
   'inmunologia', 'mg/L', 'high-bad',
   '{"ok_max":3.0,"warn_max":10.0}'::jsonb, 2),
  ('procalcitonina',      'Procalcitonina',
   array['PCT','procalcitonin','pro-calcitonina'],
   'inmunologia', 'ng/mL', 'high-bad',
   '{"ok_max":0.1,"warn_max":0.5}'::jsonb, 2),
  ('haptoglobina',        'Haptoglobina',
   array['Hp','haptoglobin'],
   'inmunologia', 'mg/dL', 'low-and-high-bad',
   '{"ok_min":30,"ok_max":200}'::jsonb, 0);

insert into analitos_catalogo
  (clave, nombre, nombres_alternativos, categoria, unidad, bands_type, rango_default, rango_femenino, rango_masculino, precision_decimales)
values
  ('vsg', 'Velocidad de sedimentación globular',
   array['VSG','ESR','erythrocyte sedimentation rate','sedimentacion globular','eritrosedimentacion'],
   'inmunologia', 'mm/h', 'high-bad',
   '{"ok_max":20}'::jsonb,
   '{"ok_max":20}'::jsonb,
   '{"ok_max":15}'::jsonb,
   0);


-- ─── 10. Glucosa y diabetes ──────────────────────────────
-- HbA1c precisión 1 decimal (unidad % NGSP convencional MX).
-- Curva de tolerancia = valor a las 2h tras carga 75g.

insert into analitos_catalogo
  (clave, nombre, nombres_alternativos, categoria, unidad, bands_type, rango_default, precision_decimales)
values
  ('hba1c',                     'Hemoglobina glucosilada',
   array['HbA1c','A1c','hemoglobina glicada','hemoglobina glicosilada','glycated hemoglobin','hemoglobina glucada'],
   'quimica', '%', 'high-bad',
   '{"ok_max":5.7,"warn_max":6.5}'::jsonb, 1),
  ('glucosa_postprandial_2h',   'Glucosa postprandial 2h',
   array['glucosa postprandial','GPP','glucosa 2 horas','postprandial glucose','glicemia postprandial'],
   'quimica', 'mg/dL', 'high-bad',
   '{"ok_max":140,"warn_max":200}'::jsonb, 0),
  ('curva_tolerancia_glucosa_2h','Curva de tolerancia a la glucosa 2h',
   array['CTGO','OGTT','curva de tolerancia oral','glucose tolerance test','tolerancia a la glucosa'],
   'quimica', 'mg/dL', 'high-bad',
   '{"ok_max":140,"warn_max":200}'::jsonb, 0),
  ('insulina_basal',            'Insulina basal',
   array['insulina ayuno','fasting insulin','insulina serica basal'],
   'endocrino', 'µUI/mL', 'low-and-high-bad',
   '{"ok_min":2.6,"ok_max":24.9}'::jsonb, 1),
  ('homa_ir',                   'HOMA-IR',
   array['indice HOMA','insulin resistance index','homa','resistencia a la insulina'],
   'quimica', 'index', 'high-bad',
   '{"ok_max":2.5}'::jsonb, 2),
  ('peptido_c',                 'Péptido C',
   array['C-peptide','peptido c serico','conexion de peptido C'],
   'endocrino', 'ng/mL', 'low-and-high-bad',
   '{"ok_min":0.8,"ok_max":3.1}'::jsonb, 2),
  ('fructosamina',              'Fructosamina',
   array['albumina glicada','fructosamine','glicoalbumina'],
   'quimica', 'µmol/L', 'high-bad',
   '{"ok_max":285}'::jsonb, 0);


-- ─── 11. Coagulación ─────────────────────────────────────

insert into analitos_catalogo
  (clave, nombre, nombres_alternativos, categoria, unidad, bands_type, rango_default, precision_decimales)
values
  ('tp',             'Tiempo de protrombina',
   array['TP','PT','protrombina','prothrombin time'],
   'coagulacion', 'segundos', 'low-and-high-bad',
   '{"ok_min":11.0,"ok_max":13.5}'::jsonb, 1),
  ('tpt',            'Tiempo parcial de tromboplastina',
   array['TPT','TTPa','aPTT','PTT','partial thromboplastin time','TP parcial activado'],
   'coagulacion', 'segundos', 'low-and-high-bad',
   '{"ok_min":25,"ok_max":35}'::jsonb, 1),
  ('inr',            'INR',
   array['INR','razon normalizada internacional','international normalized ratio'],
   'coagulacion', 'ratio', 'low-and-high-bad',
   '{"ok_min":0.8,"ok_max":1.2}'::jsonb, 2),
  ('fibrinogeno',    'Fibrinógeno',
   array['fibrinogen','factor I','factor de la coagulacion I'],
   'coagulacion', 'mg/dL', 'low-and-high-bad',
   '{"ok_min":200,"ok_max":400}'::jsonb, 0),
  ('dimero_d',       'Dímero D',
   array['D-dimer','DD','dimero-d','dimero d'],
   'coagulacion', 'ng/mL', 'high-bad',
   '{"ok_max":500}'::jsonb, 0),
  ('tiempo_trombina','Tiempo de trombina',
   array['TT','thrombin time'],
   'coagulacion', 'segundos', 'low-and-high-bad',
   '{"ok_min":14,"ok_max":21}'::jsonb, 1);


-- ─── 12. Hormonal básico ─────────────────────────────────
-- La mayoría de hormonas reproductivas son sex-dep y, en ♀,
-- varían por fase del ciclo y menopausia. Rangos declarados
-- corresponden a adulto en edad reproductiva / fase folicular.
-- Para adulto mayor o fases específicas usar criterio clínico.

insert into analitos_catalogo
  (clave, nombre, nombres_alternativos, categoria, unidad, bands_type, rango_default, precision_decimales)
values
  ('cortisol_matutino',  'Cortisol matutino',
   array['cortisol AM','cortisol 8am','morning cortisol','cortisol basal'],
   'endocrino', 'µg/dL', 'low-and-high-bad',
   '{"ok_min":6.2,"ok_max":19.4}'::jsonb, 1),
  ('cortisol_vespertino','Cortisol vespertino',
   array['cortisol PM','cortisol 5pm','afternoon cortisol','cortisol tarde'],
   'endocrino', 'µg/dL', 'high-bad',
   '{"ok_max":10}'::jsonb, 1),
  ('acth',               'ACTH',
   array['ACTH','corticotropina','hormona adrenocorticotropica','adrenocorticotropic hormone'],
   'endocrino', 'pg/mL', 'low-and-high-bad',
   '{"ok_min":7.2,"ok_max":63}'::jsonb, 1),
  ('hormona_crecimiento','Hormona del crecimiento',
   array['GH','hGH','somatotropina','growth hormone','hormona somatotrópica'],
   'endocrino', 'ng/mL', 'high-bad',
   '{"ok_max":10}'::jsonb, 1),
  ('igf_1',              'IGF-1',
   array['IGF-1','somatomedina C','insulin-like growth factor 1','factor de crecimiento insulinico 1'],
   'endocrino', 'ng/mL', 'low-and-high-bad',
   '{"ok_min":80,"ok_max":330}'::jsonb, 0);  -- verificar: rangos varían ampliamente por edad (pico 20-30 años, baja en mayores)

insert into analitos_catalogo
  (clave, nombre, nombres_alternativos, categoria, unidad, bands_type, rango_default, rango_femenino, rango_masculino, precision_decimales)
values
  ('prolactina', 'Prolactina',
   array['PRL','prolactin','hormona lactogena'],
   'endocrino', 'ng/mL', 'high-bad',
   '{"ok_max":25}'::jsonb,
   '{"ok_max":25}'::jsonb,
   '{"ok_max":17}'::jsonb,
   1),
  ('lh', 'Hormona luteinizante',  -- verificar: rangos ♀ corresponden a fase folicular; ovulatoria/lútea/postmenopausia difieren
   array['LH','luteinizing hormone','hormona luteinizante'],
   'endocrino', 'mUI/mL', 'low-and-high-bad',
   '{"ok_min":1.7,"ok_max":8.6}'::jsonb,
   '{"ok_min":2.4,"ok_max":12.6}'::jsonb,
   '{"ok_min":1.7,"ok_max":8.6}'::jsonb,
   1),
  ('fsh', 'Hormona folículo-estimulante',  -- verificar: rangos ♀ corresponden a fase folicular
   array['FSH','follicle stimulating hormone','hormona foliculoestimulante'],
   'endocrino', 'mUI/mL', 'low-and-high-bad',
   '{"ok_min":1.5,"ok_max":12.4}'::jsonb,
   '{"ok_min":3.5,"ok_max":12.5}'::jsonb,
   '{"ok_min":1.5,"ok_max":12.4}'::jsonb,
   1),
  ('estradiol', 'Estradiol',  -- verificar: rangos ♀ corresponden a fase folicular temprana (postmenopausia <10)
   array['E2','estradiol 17-beta','estradiol serico'],
   'endocrino', 'pg/mL', 'low-and-high-bad',
   '{"ok_min":10,"ok_max":160}'::jsonb,
   '{"ok_min":12,"ok_max":166}'::jsonb,
   '{"ok_min":10,"ok_max":40}'::jsonb,
   0),
  ('progesterona', 'Progesterona',  -- verificar: rangos ♀ varían dramáticamente por fase del ciclo (folicular <1, lutea 5-20)
   array['P4','progesterone','progesterona serica'],
   'endocrino', 'ng/mL', 'low-and-high-bad',
   '{"ok_min":0.1,"ok_max":20}'::jsonb,
   '{"ok_min":0.1,"ok_max":20}'::jsonb,
   '{"ok_min":0.1,"ok_max":0.6}'::jsonb,
   2),
  ('testosterona_total', 'Testosterona total',  -- verificar: rangos ♂ bajan con la edad (>50 años: límite inferior puede ser 200)
   array['testosterona','total testosterone','testosterona serica','T total'],
   'endocrino', 'ng/dL', 'low-and-high-bad',
   '{"ok_min":15,"ok_max":1100}'::jsonb,
   '{"ok_min":15,"ok_max":70}'::jsonb,
   '{"ok_min":280,"ok_max":1100}'::jsonb,
   0),
  ('testosterona_libre', 'Testosterona libre',
   array['free testosterone','T libre','FT','testosterona biodisponible'],
   'endocrino', 'pg/mL', 'low-and-high-bad',
   '{"ok_min":0.3,"ok_max":27}'::jsonb,
   '{"ok_min":0.3,"ok_max":3.2}'::jsonb,
   '{"ok_min":9,"ok_max":27}'::jsonb,
   1),
  ('shbg', 'Globulina transportadora de hormonas sexuales',
   array['SHBG','sex hormone binding globulin','globulina fijadora de hormonas sexuales'],
   'endocrino', 'nmol/L', 'low-and-high-bad',
   '{"ok_min":10,"ok_max":144}'::jsonb,
   '{"ok_min":18,"ok_max":144}'::jsonb,
   '{"ok_min":10,"ok_max":57}'::jsonb,
   1),
  ('dhea_s', 'DHEA-S',  -- verificar: rangos varían ampliamente por edad (pico 20-30, baja significativamente >50 años)
   array['DHEA sulfato','dehidroepiandrosterona sulfato','DHEAS','sulfato de dehidroepiandrosterona'],
   'endocrino', 'µg/dL', 'low-and-high-bad',
   '{"ok_min":35,"ok_max":430}'::jsonb,
   '{"ok_min":35,"ok_max":280}'::jsonb,
   '{"ok_min":80,"ok_max":430}'::jsonb,
   0);


-- ─── 13. Marcadores cardíacos ────────────────────────────
-- Troponina I convencional (no hs). BNP para FE reducida,
-- NT-proBNP más estable. CK total sex-dep.

insert into analitos_catalogo
  (clave, nombre, nombres_alternativos, categoria, unidad, bands_type, rango_default, precision_decimales)
values
  ('troponina_i',  'Troponina I',
   array['TnI','cTnI','cardiac troponin I','troponina I cardiaca'],
   'cardiaco', 'ng/mL', 'high-bad',
   '{"ok_max":0.04}'::jsonb, 3),
  ('troponina_t',  'Troponina T',
   array['TnT','cTnT','cardiac troponin T','troponina T cardiaca'],
   'cardiaco', 'ng/mL', 'high-bad',
   '{"ok_max":0.014}'::jsonb, 3),
  ('ck_mb',        'CK-MB',
   array['CKMB','creatine kinase MB','creatin cinasa MB','isoenzima MB'],
   'cardiaco', 'ng/mL', 'high-bad',
   '{"ok_max":6.3}'::jsonb, 1),
  ('bnp',          'Péptido natriurético cerebral',
   array['BNP','B-type natriuretic peptide','peptido natriuretico tipo B'],
   'cardiaco', 'pg/mL', 'high-bad',
   '{"ok_max":100}'::jsonb, 0),
  ('nt_probnp',    'NT-proBNP',
   array['NT-proBNP','proBNP','N-terminal proBNP','pro-peptido natriuretico tipo B N-terminal'],
   'cardiaco', 'pg/mL', 'high-bad',
   '{"ok_max":125,"warn_max":450}'::jsonb, 0);  -- verificar: cutoff 125 para <75 años; >75 años usar 450

insert into analitos_catalogo
  (clave, nombre, nombres_alternativos, categoria, unidad, bands_type, rango_default, rango_femenino, rango_masculino, precision_decimales)
values
  ('ck_total', 'Creatina cinasa total',
   array['CK','CPK','creatine kinase','creatin cinasa total','CK total'],
   'cardiaco', 'U/L', 'high-bad',
   '{"ok_max":190}'::jsonb,
   '{"ok_max":170}'::jsonb,
   '{"ok_max":190}'::jsonb,
   0),
  ('mioglobina', 'Mioglobina',
   array['Mb','myoglobin','mioglobina serica'],
   'cardiaco', 'ng/mL', 'high-bad',
   '{"ok_max":90}'::jsonb,
   '{"ok_max":70}'::jsonb,
   '{"ok_max":90}'::jsonb,
   0);


-- ─── 14. Marcadores tumorales comunes ────────────────────
-- PSA: cutoff 4.0 estándar adulto 40-65. PSA libre y
-- relación libre/total para zona gris (4-10).

insert into analitos_catalogo
  (clave, nombre, nombres_alternativos, categoria, unidad, bands_type, rango_default, precision_decimales)
values
  ('ca_125',                      'CA 125',
   array['CA-125','cancer antigen 125','antigeno carbohidrato 125'],
   'marcador_tumoral', 'U/mL', 'high-bad',
   '{"ok_max":35}'::jsonb, 1),
  ('ca_19_9',                     'CA 19-9',
   array['CA-19-9','cancer antigen 19-9','antigeno carbohidrato 19-9'],
   'marcador_tumoral', 'U/mL', 'high-bad',
   '{"ok_max":37}'::jsonb, 1),
  ('ca_15_3',                     'CA 15-3',
   array['CA-15-3','cancer antigen 15-3','antigeno carbohidrato 15-3'],
   'marcador_tumoral', 'U/mL', 'high-bad',
   '{"ok_max":30}'::jsonb, 1),
  ('cea',                         'Antígeno carcinoembrionario',  -- verificar: cutoff 5 para no fumadores, 10 para fumadores
   array['CEA','ACE','carcinoembryonic antigen','antigeno carcino-embrionario'],
   'marcador_tumoral', 'ng/mL', 'high-bad',
   '{"ok_max":5}'::jsonb, 2),
  ('afp',                         'Alfafetoproteína',
   array['AFP','alpha-fetoprotein','alfa fetoproteina','alpha feto proteina'],
   'marcador_tumoral', 'ng/mL', 'high-bad',
   '{"ok_max":8.1}'::jsonb, 1),
  ('beta_hcg_cuantitativa',       'Beta-hCG cuantitativa',
   array['beta hCG','β-hCG','hCG cuantitativa','gonadotropina corionica humana','fraccion beta'],
   'marcador_tumoral', 'mUI/mL', 'high-bad',
   '{"ok_max":5}'::jsonb, 1),
  ('ca_72_4',                     'CA 72-4',
   array['CA-72-4','cancer antigen 72-4','TAG-72'],
   'marcador_tumoral', 'U/mL', 'high-bad',
   '{"ok_max":6.9}'::jsonb, 1),
  ('enolasa_neuroespecifica',     'Enolasa neuroespecífica',
   array['NSE','neuron specific enolase','enolasa neuronal'],
   'marcador_tumoral', 'ng/mL', 'high-bad',
   '{"ok_max":16.3}'::jsonb, 1),
  ('relacion_psa_libre_total',    'Relación PSA libre/total',
   array['PSA free ratio','indice PSA libre','relacion PSA L/T','%PSA libre'],
   'marcador_tumoral', '%', 'low-bad',
   '{"ok_min":25}'::jsonb, 1);

insert into analitos_catalogo
  (clave, nombre, nombres_alternativos, categoria, unidad, bands_type, rango_default, rango_femenino, rango_masculino, precision_decimales)
values
  ('psa_total', 'Antígeno prostático específico total',  -- verificar: cutoff 4.0 es adulto 40-65; >70 años puede usarse hasta 6.5
   array['PSA','PSA total','APE','antigeno prostatico','prostate specific antigen'],
   'marcador_tumoral', 'ng/mL', 'high-bad',
   '{"ok_max":4.0}'::jsonb,
   null,
   '{"ok_max":4.0}'::jsonb,
   2),
  ('psa_libre', 'PSA libre',
   array['free PSA','PSA libre fraccion','fPSA'],
   'marcador_tumoral', 'ng/mL', 'low-and-high-bad',
   '{"ok_min":0.5,"ok_max":2.0}'::jsonb,
   null,
   '{"ok_min":0.5,"ok_max":2.0}'::jsonb,
   2);


-- ─── 15. Vitaminas y minerales ───────────────────────────
-- Vitamina D 25-OH en ng/mL (convención MX; nmol/L = ng/mL × 2.5).
-- Ferritina en ng/mL (convención MX; equivalente a µg/L).
-- Hierro, ferritina sex-dep (mujeres pre-menopausia más bajo).

insert into analitos_catalogo
  (clave, nombre, nombres_alternativos, categoria, unidad, bands_type, rango_default, precision_decimales)
values
  ('vitamina_d_25oh',              'Vitamina D 25-OH',
   array['vitamina D','25 OH vit D','25-hidroxivitamina D','25(OH)D','vit D total','calcidiol'],
   'vitaminas_minerales', 'ng/mL', 'low-bad',
   '{"ok_min":30,"warn_min":20}'::jsonb, 0),
  ('vitamina_b12',                 'Vitamina B12',
   array['B12','cobalamina','cyanocobalamin','vitamina B 12'],
   'vitaminas_minerales', 'pg/mL', 'low-bad',
   '{"ok_min":200,"warn_min":150}'::jsonb, 0),
  ('acido_folico',                 'Ácido fólico',
   array['folato','B9','folate','acido folico serico','vitamina B9'],
   'vitaminas_minerales', 'ng/mL', 'low-bad',
   '{"ok_min":3,"warn_min":2}'::jsonb, 1),
  ('transferrina',                 'Transferrina',
   array['transferrin','TRF','transferrina serica'],
   'vitaminas_minerales', 'mg/dL', 'low-and-high-bad',
   '{"ok_min":200,"ok_max":360}'::jsonb, 0),
  ('capacidad_total_fijacion_hierro','Capacidad total de fijación de hierro',
   array['TIBC','total iron binding capacity','capacidad total de union al hierro','CTFH'],
   'vitaminas_minerales', 'µg/dL', 'low-and-high-bad',
   '{"ok_min":240,"ok_max":450}'::jsonb, 0),
  ('saturacion_transferrina',      'Saturación de transferrina',
   array['% saturacion','IST','transferrin saturation','indice de saturacion de transferrina'],
   'vitaminas_minerales', '%', 'low-and-high-bad',
   '{"ok_min":20,"ok_max":50}'::jsonb, 1),
  ('zinc',                         'Zinc sérico',
   array['Zn','zinc serico','serum zinc'],
   'vitaminas_minerales', 'µg/dL', 'low-and-high-bad',
   '{"ok_min":70,"ok_max":120}'::jsonb, 0),
  ('selenio',                      'Selenio',
   array['Se','selenium','selenio serico'],
   'vitaminas_minerales', 'µg/L', 'low-and-high-bad',
   '{"ok_min":70,"ok_max":150}'::jsonb, 0),
  ('vitamina_a',                   'Vitamina A',
   array['retinol','vit A','vitamina A serica'],
   'vitaminas_minerales', 'µg/dL', 'low-and-high-bad',
   '{"ok_min":30,"ok_max":80}'::jsonb, 1),
  ('vitamina_e',                   'Vitamina E',
   array['alfa-tocoferol','tocoferol','vit E','alpha-tocopherol'],
   'vitaminas_minerales', 'mg/L', 'low-and-high-bad',
   '{"ok_min":5,"ok_max":18}'::jsonb, 1);

insert into analitos_catalogo
  (clave, nombre, nombres_alternativos, categoria, unidad, bands_type, rango_default, rango_femenino, rango_masculino, precision_decimales)
values
  ('hierro_serico', 'Hierro sérico',
   array['Fe','iron','ferremia','hierro','Fe serico'],
   'vitaminas_minerales', 'µg/dL', 'low-and-high-bad',
   '{"ok_min":50,"ok_max":175}'::jsonb,
   '{"ok_min":50,"ok_max":170}'::jsonb,
   '{"ok_min":65,"ok_max":175}'::jsonb,
   0),
  ('ferritina', 'Ferritina',  -- verificar: rangos ♀ corresponden a pre-menopausia; postmenopausia se asemeja al ♂
   array['ferritin','ferritina serica','Ft'],
   'vitaminas_minerales', 'ng/mL', 'low-and-high-bad',
   '{"ok_min":13,"ok_max":400}'::jsonb,
   '{"ok_min":13,"ok_max":150}'::jsonb,
   '{"ok_min":30,"ok_max":400}'::jsonb,
   0);


-- ─── 16. Específicos ortopedia/reumatología ──────────────
-- FR, anti-CCP, anti-DNA, complementos y autoanticuerpos →
-- `inmunologia`. Marcadores de metabolismo óseo (PTH, beta-
-- CTX, P1NP, osteocalcina, calcio iónico, vit D3 1,25) →
-- `hueso`. FA ósea existe en FA total (panel 7) y como
-- isoforma específica aquí.

insert into analitos_catalogo
  (clave, nombre, nombres_alternativos, categoria, unidad, bands_type, rango_default, precision_decimales)
values
  ('factor_reumatoide',        'Factor reumatoide',
   array['FR','RF','rheumatoid factor','factor reumatoide serico'],
   'inmunologia', 'UI/mL', 'high-bad',
   '{"ok_max":14}'::jsonb, 1),
  ('anti_ccp',                 'Anti-CCP',
   array['anti-CCP','ACPA','anti-peptidos citrulinados ciclicos','anticuerpos anti peptido citrulinado'],
   'inmunologia', 'U/mL', 'high-bad',
   '{"ok_max":20}'::jsonb, 1),
  ('anti_dna',                 'Anti-DNA de doble cadena',
   array['anti-DNA','anti-dsDNA','anticuerpos anti DNA','anti ADN'],
   'inmunologia', 'UI/mL', 'high-bad',
   '{"ok_max":7}'::jsonb, 1),
  ('complemento_c3',           'Complemento C3',
   array['C3','complement C3','complemento C3 serico'],
   'inmunologia', 'mg/dL', 'low-and-high-bad',
   '{"ok_min":90,"ok_max":180}'::jsonb, 0),
  ('complemento_c4',           'Complemento C4',
   array['C4','complement C4','complemento C4 serico'],
   'inmunologia', 'mg/dL', 'low-and-high-bad',
   '{"ok_min":10,"ok_max":40}'::jsonb, 0),
  ('anti_ssa_ro',              'Anti-SSA/Ro',
   array['anti-Ro','anti-SSA','SSA antibodies','anticuerpos anti Ro'],
   'inmunologia', 'U/mL', 'high-bad',
   '{"ok_max":20}'::jsonb, 1),
  ('anti_ssb_la',              'Anti-SSB/La',
   array['anti-La','anti-SSB','SSB antibodies','anticuerpos anti La'],
   'inmunologia', 'U/mL', 'high-bad',
   '{"ok_max":20}'::jsonb, 1),
  ('anti_sm',                  'Anti-Sm',
   array['anti-Smith','Sm antibodies','anticuerpos anti Sm'],
   'inmunologia', 'U/mL', 'high-bad',
   '{"ok_max":20}'::jsonb, 1),
  ('anti_rnp',                 'Anti-RNP',
   array['anti-U1RNP','RNP antibodies','anticuerpos anti RNP','anti-ribonucleoproteina'],
   'inmunologia', 'U/mL', 'high-bad',
   '{"ok_max":20}'::jsonb, 1),
  ('anti_scl_70',              'Anti-Scl-70',
   array['anti-topoisomerasa I','Scl-70 antibodies','anti-topo I'],
   'inmunologia', 'U/mL', 'high-bad',
   '{"ok_max":20}'::jsonb, 1),
  ('anca_c',                   'c-ANCA (anti-PR3)',
   array['cANCA','anti-PR3','proteinase 3','anti-proteinasa 3','ANCA citoplasmatico'],
   'inmunologia', 'U/mL', 'high-bad',
   '{"ok_max":20}'::jsonb, 1),
  ('anca_p',                   'p-ANCA (anti-MPO)',
   array['pANCA','anti-MPO','mieloperoxidasa','anti-mieloperoxidasa','ANCA perinuclear'],
   'inmunologia', 'U/mL', 'high-bad',
   '{"ok_max":20}'::jsonb, 1),
  ('calcio_ionico',            'Calcio iónico',
   array['Ca ionico','ionized calcium','calcio libre','calcio i'],
   'hueso', 'mg/dL', 'low-and-high-bad',
   '{"ok_min":4.65,"ok_max":5.28}'::jsonb, 2),
  ('pth',                      'Hormona paratiroidea',
   array['PTH','paratohormona','parathormona','parathyroid hormone','PTH intacta'],
   'hueso', 'pg/mL', 'low-and-high-bad',
   '{"ok_min":15,"ok_max":65}'::jsonb, 1),
  ('fosfatasa_alcalina_osea',  'Fosfatasa alcalina ósea',
   array['FA osea','BAP','bone alkaline phosphatase','isoenzima osea'],
   'hueso', 'µg/L', 'low-and-high-bad',
   '{"ok_min":5,"ok_max":25}'::jsonb, 1),
  ('beta_ctx',                 'Beta-CTX',
   array['β-CrossLaps','CTX','C-telopeptido','bCTx','beta-crosslaps','telopeptido colageno'],
   'hueso', 'pg/mL', 'low-and-high-bad',
   '{"ok_min":100,"ok_max":700}'::jsonb, 0),
  ('p1np',                     'P1NP',
   array['PINP','propeptido N-terminal del procolageno tipo 1','procollagen type 1 N-terminal'],
   'hueso', 'ng/mL', 'low-and-high-bad',
   '{"ok_min":20,"ok_max":80}'::jsonb, 1),
  ('osteocalcina',             'Osteocalcina',
   array['OC','osteocalcin','proteina Gla osea','BGP'],
   'hueso', 'ng/mL', 'low-and-high-bad',
   '{"ok_min":10,"ok_max":40}'::jsonb, 1),
  ('vitamina_d3_1_25',         'Vitamina D 1,25-dihidroxi',
   array['calcitriol','1,25 OH2 D','1,25 dihidroxivitamina D','D activa'],
   'hueso', 'pg/mL', 'low-and-high-bad',
   '{"ok_min":20,"ok_max":80}'::jsonb, 1);


-- ─── 17. Otros relevantes ────────────────────────────────
-- Ginecología (AMH, tratada con rango ♀ edad reproductiva),
-- marcadores virales cuantitativos (hep B/C/VIH en índice),
-- enzimas pancreáticas, inmunoglobulinas, misceláneos.

insert into analitos_catalogo
  (clave, nombre, nombres_alternativos, categoria, unidad, bands_type, rango_default, precision_decimales)
values
  ('amh',                      'Hormona antimülleriana',  -- verificar: rango aplica solo a ♀ edad reproductiva; en menopausia <0.16
   array['AMH','anti-mullerian hormone','hormona antimulleriana','hormona antimulerriana'],
   'endocrino', 'ng/mL', 'low-and-high-bad',
   '{"ok_min":1.0,"ok_max":4.0}'::jsonb, 2),
  ('ag_hbs_cuantitativo',      'Antígeno HBs cuantitativo',
   array['HBsAg cuant','ag superficie hep B','HBV surface antigen','antigeno australia'],
   'otros', 'UI/mL', 'high-bad',
   '{"ok_max":0.05}'::jsonb, 2),
  ('anti_vhc_indice',          'Anti-VHC índice',
   array['anti-HCV','hepatitis C antibody','anticuerpos anti hep C','indice HCV'],
   'otros', 'índice', 'high-bad',
   '{"ok_max":1.0}'::jsonb, 2),
  ('anti_vih_indice',          'Anti-VIH 1/2 índice',
   array['anti-HIV','HIV antibody','anticuerpos anti VIH','indice HIV','VIH serologia'],
   'otros', 'índice', 'high-bad',
   '{"ok_max":1.0}'::jsonb, 2),
  ('lipasa',                   'Lipasa sérica',
   array['lipase','lipasa pancreatica','serum lipase'],
   'quimica', 'U/L', 'high-bad',
   '{"ok_min":10,"ok_max":60}'::jsonb, 0),
  ('amilasa',                  'Amilasa sérica',
   array['amylase','amilasa pancreatica','serum amylase'],
   'quimica', 'U/L', 'high-bad',
   '{"ok_min":30,"ok_max":110}'::jsonb, 0),
  ('igg_total',                'IgG total',
   array['IgG','inmunoglobulina G','immunoglobulin G'],
   'inmunologia', 'mg/dL', 'low-and-high-bad',
   '{"ok_min":700,"ok_max":1600}'::jsonb, 0),
  ('iga_total',                'IgA total',
   array['IgA','inmunoglobulina A','immunoglobulin A'],
   'inmunologia', 'mg/dL', 'low-and-high-bad',
   '{"ok_min":70,"ok_max":400}'::jsonb, 0),
  ('igm_total',                'IgM total',
   array['IgM','inmunoglobulina M','immunoglobulin M'],
   'inmunologia', 'mg/dL', 'low-and-high-bad',
   '{"ok_min":40,"ok_max":230}'::jsonb, 0),
  ('ige_total',                'IgE total',
   array['IgE','inmunoglobulina E','immunoglobulin E'],
   'inmunologia', 'UI/mL', 'high-bad',
   '{"ok_max":100}'::jsonb, 0),
  ('homocisteina',             'Homocisteína',
   array['Hcy','homocysteine','homocisteina serica'],
   'quimica', 'µmol/L', 'high-bad',
   '{"ok_max":15}'::jsonb, 1),
  ('acido_lactico',            'Ácido láctico',
   array['lactate','lactato','acido lactico serico'],
   'quimica', 'mmol/L', 'high-bad',
   '{"ok_min":0.5,"ok_max":2.2}'::jsonb, 1),
  ('amonio',                   'Amonio sérico',
   array['NH3','ammonia','amoniaco serico','amonio plasmatico'],
   'quimica', 'µg/dL', 'high-bad',
   '{"ok_min":15,"ok_max":45}'::jsonb, 0),
  ('beta_2_microglobulina',    'Beta-2 microglobulina',
   array['B2M','β2-microglobulina','beta 2 microglobulin','B2-microglobulina'],
   'otros', 'mg/L', 'high-bad',
   '{"ok_max":2.7}'::jsonb, 2),
  ('reticulocitos_porcentaje', 'Reticulocitos %',
   array['retis %','reticulocyte count','porcentaje de reticulocitos'],
   'hematologia', '%', 'low-and-high-bad',
   '{"ok_min":0.5,"ok_max":2.5}'::jsonb, 2),
  ('proteinuria_24h',          'Proteinuria 24h',
   array['proteinas en orina 24h','proteinas 24 horas','urine protein 24h','proteinas urinarias'],
   'quimica', 'mg/24h', 'high-bad',
   '{"ok_max":150}'::jsonb, 0);

-- ════════════════════════════════════════════════════════
-- Fin del seed. Verificación rápida post-ejecución:
--   select categoria, count(*) from analitos_catalogo group by categoria order by 1;
--   select count(*) from analitos_catalogo;  -- debe ser ≥130
-- ════════════════════════════════════════════════════════
