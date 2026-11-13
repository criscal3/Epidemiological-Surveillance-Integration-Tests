-- IT-01: tablas del componente creadas por Liquibase (12 entidades del modelo de datos).
SELECT esperada.nombre AS tabla,
       IF(t.table_name IS NULL, 'FALTA', 'OK') AS estado
FROM (SELECT 'notifiable_event' AS nombre UNION ALL SELECT 'period_case_count'
      UNION ALL SELECT 'surveillance_age_group_config' UNION ALL SELECT 'surveillance_alert'
      UNION ALL SELECT 'surveillance_case_travel' UNION ALL SELECT 'surveillance_case' UNION ALL SELECT 'surveillance_center_coordinates'
      UNION ALL SELECT 'surveillance_coordinate_codes' UNION ALL SELECT 'surveillance_endemic_config'
      UNION ALL SELECT 'surveillance_notification_config' UNION ALL SELECT 'surveillance_outbreak_config'
      UNION ALL SELECT 'surveillance_risk_config') AS esperada
LEFT JOIN information_schema.tables t
       ON t.table_schema = DATABASE() AND t.table_name = esperada.nombre
ORDER BY tabla;

-- Total esperado: 12.
SELECT COUNT(*) AS tablas_del_componente
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND (table_name LIKE 'surveillance\_%' OR table_name IN ('notifiable_event', 'period_case_count'));

