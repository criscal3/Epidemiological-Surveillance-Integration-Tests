-- Precondiciones de IT-11, IT-12 e IT-13. Ejecutar sobre la línea base, antes de Playwright.
-- Edite los tres valores siguientes:
SET @dni01  = '79202224';
SET @dni02  = '78432455';
SET @centro = '%CHAMBIRAL%';

-- 1) Etnias con código MINSA (fuente MINSA-ETNIAS, mapeo SAME-AS), para elegir la del paciente.
--    Grupo 4 (indígena amazónico con código): códigos 1 a 55, salvo 2, 19, 40 y 49 (que son grupo 3).
--    El código 58 es Mestizo: grupo 1 sin código de etnia.
SELECT CAST(crt.code AS UNSIGNED) AS codigo_minsa,
       CASE WHEN CAST(crt.code AS UNSIGNED) IN (2, 19, 40, 49) THEN 3
            WHEN CAST(crt.code AS UNSIGNED) BETWEEN 1 AND 55 THEN 4
            WHEN crt.code = '56' THEN 2 WHEN crt.code = '58' THEN 1
            WHEN crt.code = '59' THEN 5 ELSE 6 END AS grupo,
       (SELECT cn.name FROM concept_name cn
         WHERE cn.concept_id = crm.concept_id AND cn.voided = 0
         ORDER BY cn.locale = 'es' DESC, cn.locale_preferred DESC LIMIT 1) AS respuesta
FROM concept_reference_map crm
JOIN concept_reference_term crt ON crt.concept_reference_term_id = crm.concept_reference_term_id AND crt.retired = 0
JOIN concept_reference_source crs ON crs.concept_source_id = crt.concept_source_id AND crs.name = 'MINSA-ETNIAS'
JOIN concept_map_type cmt ON cmt.concept_map_type_id = crm.concept_map_type_id AND cmt.name = 'SAME-AS'
ORDER BY codigo_minsa;

-- 2) Etnia registrada en los pacientes de prueba y el resultado que espera IT-12.
--    E2E-VIG-01: grupo 4 con código. E2E-VIG-02: grupo 1 (Mestizo, código 58) sin código.
SELECT pi.identifier AS dni,
       (SELECT cn.name FROM concept_name cn
         WHERE cn.concept_id = pa.value AND cn.voided = 0
         ORDER BY cn.locale = 'es' DESC, cn.locale_preferred DESC LIMIT 1) AS etnia,
       (SELECT crt.code
          FROM concept_reference_map crm
          JOIN concept_reference_term crt ON crt.concept_reference_term_id = crm.concept_reference_term_id AND crt.retired = 0
          JOIN concept_reference_source crs ON crs.concept_source_id = crt.concept_source_id AND crs.name = 'MINSA-ETNIAS'
          JOIN concept_map_type cmt ON cmt.concept_map_type_id = crm.concept_map_type_id AND cmt.name = 'SAME-AS'
         WHERE crm.concept_id = pa.value LIMIT 1) AS codigo_minsa
FROM patient_identifier pi
LEFT JOIN person_attribute pa
       ON pa.person_id = pi.patient_id AND pa.voided = 0
      AND pa.person_attribute_type_id = (SELECT person_attribute_type_id FROM person_attribute_type
                                          WHERE uuid = '8d871386-c2cc-11de-8d13-0010c6dffd0f')
WHERE pi.identifier IN (@dni01, @dni02) AND pi.voided = 0;

-- 3) Centro poblado de infección: debe tener coordenadas (IT-13) y ningún caso previo (IT-11).
--    Con casos autóctonos previos el foco ya no sería «eliminado» y la regla it11-foco no alertaría.
-- Las coordenadas se toman como lo hace el mapa: por ID del centro o por su código territorial.
SELECT e.address_hierarchy_entry_id AS id,
       e.name                       AS centro_poblado,
       e.user_generated_id          AS codigo,
       COALESCE(c.latitude, k.latitude)   AS latitude,
       COALESCE(c.longitude, k.longitude) AS longitude,
       (SELECT COUNT(*) FROM surveillance_case sc
         WHERE sc.infection_address = e.address_hierarchy_entry_id AND sc.voided = 0) AS casos_previos
FROM address_hierarchy_entry e
JOIN address_hierarchy_level l ON l.address_hierarchy_level_id = e.level_id AND l.address_field = 'CITY_VILLAGE'
LEFT JOIN surveillance_center_coordinates c ON c.address_hierarchy_entry_id = e.address_hierarchy_entry_id
LEFT JOIN surveillance_coordinate_codes k ON k.center_code = e.user_generated_id
WHERE e.name LIKE @centro;

-- 4) Centro poblado del antecedente de viaje (IT-05): SANTA CLOTILDE, código 1601070001.
--    Debe existir una sola vez en el nivel de centro poblado.
SELECT e.address_hierarchy_entry_id AS id, e.name AS centro_poblado, e.user_generated_id AS codigo
FROM address_hierarchy_entry e
JOIN address_hierarchy_level l ON l.address_hierarchy_level_id = e.level_id AND l.address_field = 'CITY_VILLAGE'
WHERE e.user_generated_id = '1601070001';
