-- IT-07 / IT-08: quién registró y quién modificó por última vez cada caso.
-- Esperado: creador = medico.prueba; modificador = epi.prueba (última edición antes de IT-06,
-- o la del responsable que marcó la defunción); el profesional del caso sigue siendo el del médico.
SELECT sc.uuid                              AS caso,
       (SELECT pi.identifier
          FROM patient_identifier pi
          JOIN patient_identifier_type pit ON pit.patient_identifier_type_id = pi.identifier_type
         WHERE pi.patient_id = sc.patient_id AND pi.voided = 0 AND pit.name = 'DNI'
         LIMIT 1)                           AS dni,
       uc.username                          AS creador,
       sc.date_created                      AS fecha_registro,
       um.username                          AS modificador,
       sc.date_changed                      AS fecha_modificacion,
       pu.username                          AS usuario_del_profesional
FROM surveillance_case sc
LEFT JOIN users uc ON uc.user_id = sc.creator
LEFT JOIN users um ON um.user_id = sc.changed_by
LEFT JOIN provider pr ON pr.provider_id = sc.provider_id
LEFT JOIN users pu ON pu.person_id = pr.person_id
WHERE sc.voided = 0
ORDER BY sc.date_created;
