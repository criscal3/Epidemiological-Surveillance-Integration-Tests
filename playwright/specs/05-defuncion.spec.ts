import { expect, test } from '@playwright/test';
import { alerts, casesOf, limaNow, patientByDni } from '../support/api';
import { openEdit, saveEdit } from '../support/case-form';
import { REST, env } from '../support/env';
import { contextFor, openDashboard } from '../support/session';

/**
 * IT-06 se ejecuta después del registro semanal para no alterar sus datos. La defunción se
 * registra con el recurso persona del SIH (el mismo que usa la acción «Marcar como fallecido»).
 */
test('IT-06 · Defunción: con la defunción registrada en el SIH se habilita la atribución y se genera la alerta', async ({
  browser,
}) => {
  const admin = await contextFor(browser, env.admin);
  const patient = await patientByDni(admin.context.request, env.dni01);
  const [registered] = await casesOf(admin.context.request, patient.uuid);
  expect(registered?.diagnosisType, 'caso confirmado de E2E-VIG-01').toBe('CONFIRMADO');

  await test.step('Se registra la defunción del paciente en el SIH', async () => {
    const response = await admin.context.request.post(`${REST}/person/${patient.uuid}`, {
      data: { dead: true, deathDate: `${limaNow().dateTime}.000-0500`, causeOfDeath: env.causeOfDeathConceptUuid },
    });
    expect(response.status(), await response.text()).toBe(200);
  });
  await admin.context.close();

  const { context, page } = await contextFor(browser, env.epi);
  const updated = await test.step('Se edita el caso y se marca la defunción como atribuible', async () => {
    await openDashboard(page);
    const dialog = await openEdit(page, env.dni01);
    const attribution = dialog.locator('#edit-deathAttribution');
    await expect(attribution).toBeVisible();
    await expect(attribution).toBeEnabled();
    await attribution.selectOption('SI');
    const { status, body } = await saveEdit(page, dialog);
    expect(status).toBe(200);
    expect(body.patientDeathDate).toBeTruthy();
    expect(body.deathAttribution).toBe('SI');
    return body;
  });

  await test.step('Se genera la alerta de defunción atribuible', async () => {
    const death = (await alerts(context.request, { reason: 'DEATH' })).filter((a) => a.caseUuid === updated.uuid);
    expect(death).toHaveLength(1);
  });

  await context.close();
});
