import { expect, test } from '@playwright/test';
import { ageAt, casesOf, patientByDni, sourceFor } from '../support/api';
import { TRAVEL, registerCase, shiftDate } from '../support/case-form';
import { env } from '../support/env';
import { contextFor, openDashboard } from '../support/session';

/**
 * IT-02 a IT-05 (y el registro de IT-07): el médico registra el caso de E2E-VIG-01 tomando
 * paciente, atención, diagnóstico y resultado de laboratorio reales del SIH.
 */
test('IT-02 a IT-05 · El médico registra un caso con datos de registro, hoja clínica, laboratorio y Address Hierarchy', async ({
  browser,
}) => {
  test.info().annotations.push({ type: 'casos', description: 'IT-02, IT-03, IT-04, IT-05 e IT-07 (registro 201)' });
  const { context, page, session } = await contextFor(browser, env.medico);
  const patient = await patientByDni(context.request, env.dni01);
  expect(
    await casesOf(context.request, patient.uuid),
    'E2E-VIG-01 no debe tener casos: restaure la línea base antes de ejecutar',
  ).toHaveLength(0);
  const source = await sourceFor(context.request, patient.uuid);

  await openDashboard(page);
  const result = await registerCase(page, patient, env.dni01, source, true);
  const saved = result.body;

  await test.step('IT-07 El médico registra el caso (201) y queda como profesional del caso', async () => {
    expect(result.status).toBe(201);
    expect(saved.providerUuid).toBe(session.providerUuid);
  });

  await test.step('IT-02 El caso conserva los datos del módulo de registro', async () => {
    expect(saved.patientUuid).toBe(patient.uuid);
    expect(saved.patientIdentifier ?? saved.patientDisplay).toContain(env.dni01);
    expect(saved.patientAge).toBe(ageAt(patient.birthdate, source.encounterDate));
    if (patient.cityVillage)
      expect(String(saved.patientResidence).toLowerCase()).toContain(patient.cityVillage.toLowerCase());
  });

  await test.step('IT-03 El caso referencia la atención y el diagnóstico reales, con CIE-10 del mapping', async () => {
    expect(saved.encounterUuid).toBe(source.encounterUuid);
    expect(saved.diagnosisUuid).toBe(source.diagnosisUuid);
    expect(saved.diagnosisIcd10).toMatch(/^B50/);
  });

  await test.step('IT-04 Clasificación CONFIRMADO y laboratoryObservationUuid guardado', async () => {
    expect(saved.diagnosisType).toBe('CONFIRMADO');
    expect(saved.laboratoryObservationUuid).toBe(source.labObsUuid);
  });

  await test.step('IT-05 El caso guarda el centro poblado elegido (infectionAddressUuid)', async () => {
    expect(result.addressHierarchyRequests).toBeGreaterThan(0);
    expect(saved.infectionAddressUuid).toBeTruthy();
    expect(String(saved.infectionAddressDisplay).toLowerCase()).toContain(env.centerName.toLowerCase());
  });

  await test.step('IT-05 El antecedente de viaje guarda el centro poblado y las fechas', async () => {
    expect(saved.travelHistory).toHaveLength(1);
    const [trip] = saved.travelHistory;
    expect(trip.uuid).toEqual(expect.any(String));
    expect(trip.travelAddress).toEqual(expect.any(String));
    expect(trip.travelAddress).not.toBe(saved.infectionAddressUuid);
    expect(String(trip.travelAddressDisplay).toUpperCase()).toContain(TRAVEL.name);
    expect(trip.startDate).toBe(shiftDate(saved.onsetDate, TRAVEL.startOffset));
    expect(trip.endDate).toBe(shiftDate(saved.onsetDate, TRAVEL.endOffset));
    const [reloaded] = await casesOf(context.request, patient.uuid);
    expect(reloaded.travelHistory).toEqual(saved.travelHistory);
  });

  await context.close();
});
