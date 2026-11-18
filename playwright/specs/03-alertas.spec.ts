import { expect, test } from '@playwright/test';
import { alerts, casesOf, patientByDni, sourceFor } from '../support/api';
import { TRAVEL, registerCase } from '../support/case-form';
import { env } from '../support/env';
import { Tarea } from '../support/pasos';
import { contextFor, openDashboard } from '../support/session';

test('IT-10 · Alertas en tiempo real: la alerta del caso nuevo llega sin recargar y se atiende', async ({ browser }) => {
  const epi = await contextFor(browser, env.epi);
  const medico = await contextFor(browser, env.medico);
  const patient = await patientByDni(medico.context.request, env.dni02);
  expect(await casesOf(medico.context.request, patient.uuid), 'E2E-VIG-02 aún sin casos').toHaveLength(0);
  const source = await sourceFor(medico.context.request, patient.uuid);

  let reloads = 0;
  await test.step('El epidemiólogo abre la bandeja de alertas (SSE /alerts/stream)', async () => {
    const stream = epi.page.waitForRequest((r) => r.url().includes('/alerts/stream'));
    await openDashboard(epi.page);
    await epi.page.getByRole('tab', { name: 'Alertas', exact: true }).click();
    await stream;
    await epi.page.locator('#alert-reason').selectOption('IMMEDIATE_EVENT');
    epi.page.on('load', () => reloads++);
  });

  const created = await test.step('El médico registra el caso de E2E-VIG-02 en otra sesión', async () => {
    await openDashboard(medico.page);
    const result = await registerCase(medico.page, patient, env.dni02, source, true);
    expect(result.status).toBe(201);
    expect(result.body.travelHistory).toHaveLength(1);
    expect(String(result.body.travelHistory[0].travelAddressDisplay).toUpperCase()).toContain(TRAVEL.name);
    return result.body;
  });

  await test.step('La alerta aparece en la bandeja sin recargar la página', async () => {
    const row = epi.page
      .getByRole('row')
      .filter({ hasText: 'Evento notificable' })
      .filter({ hasText: created.patientDisplay })
      .filter({ hasText: 'Pendiente' });
    await expect(row).toHaveCount(1, { timeout: 60_000 });
    expect(reloads, 'la bandeja no se recargó').toBe(0);
    const tarea = new Tarea('Atender una alerta');
    await tarea.paso('Ubicar la alerta en la bandeja de alertas → Marcar como atendida', () =>
      row.getByRole('button', { name: 'Marcar como atendida' }).click(),
    );
    await expect(epi.page.getByText('Alerta marcada como atendida')).toBeVisible();
    tarea.cerrar();
  });

  await test.step('La alerta queda ATTENDED en el backend', async () => {
    const immediate = (await alerts(epi.context.request, { reason: 'IMMEDIATE_EVENT' })).filter(
      (a) => a.caseUuid === created.uuid,
    );
    expect(immediate).toHaveLength(1);
    expect(immediate[0].status).toBe('ATTENDED');
  });

  await medico.context.close();
  await epi.context.close();
});

test('IT-11 · Alerta de brote: el segundo caso autóctono supera la regla del foco', async ({ browser }) => {
  const { context, page } = await contextFor(browser, env.epi);
  const outbreak = (await alerts(context.request, { type: 'OUTBREAK', reason: 'FOCUS_CASES' })).filter((a) =>
    String(a.additionalInformation).includes('casos: 2'),
  );

  await test.step('El backend generó la alerta con centro poblado, motivo y cálculo', async () => {
    expect(outbreak, 'una alerta FOCUS_CASES con 2 casos').toHaveLength(1);
    expect(outbreak[0].center).toBeTruthy();
    expect(outbreak[0].additionalInformation).toContain('superar: 1');
  });

  await test.step('La bandeja muestra la alerta de brote', async () => {
    await openDashboard(page);
    await page.getByRole('tab', { name: 'Alertas', exact: true }).click();
    await page.locator('#alert-type').selectOption('OUTBREAK');
    const row = page
      .getByRole('row')
      .filter({ hasText: 'Superación de casos por origen y clasificación previa del foco' })
      .filter({ hasText: 'casos: 2' });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(String(outbreak[0].center));
  });

  await context.close();
});
