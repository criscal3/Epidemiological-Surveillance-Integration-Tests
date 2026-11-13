import { expect, test } from '@playwright/test';
import { casesOf, patientByDni } from '../support/api';
import { openEdit, saveEdit } from '../support/case-form';
import { HOME, DASHBOARD, MODULE_API, PRIVILEGES, env } from '../support/env';
import { contextFor, openDashboard } from '../support/session';

const NAV_LINK = { name: 'Vigilancia epidemiológica' };

test('IT-07 · Seguridad del médico: ve el componente, edita su caso y no accede a Configuración', async ({ browser }) => {
  const { context, page, session } = await contextFor(browser, env.medico);
  const patient = await patientByDni(context.request, env.dni01);
  const [registered] = await casesOf(context.request, patient.uuid);
  expect(registered, 'caso registrado en IT-02 a IT-05').toBeTruthy();

  await test.step('Ve el enlace del componente en el inicio del SIH', async () => {
    await page.goto(HOME);
    await expect(page.getByRole('link', NAV_LINK)).toBeVisible();
  });

  await test.step('Edita el caso (200)', async () => {
    await openDashboard(page);
    const dialog = await openEdit(page, env.dni01);
    await dialog.locator('#edit-vaccinationStatus').selectOption('NO');
    const { status, body } = await saveEdit(page, dialog);
    expect(status).toBe(200);
    expect(body.providerUuid).toBe(session.providerUuid);
  });

  await test.step('No accede a Configuración', async () => {
    await openDashboard(page);
    await page.getByRole('tab', { name: 'Configuración' }).click();
    const blocked = page
      .getByRole('tabpanel', { name: 'Configuración' })
      .locator(`[data-required-privilege="${PRIVILEGES.manage}"]`);
    await expect(blocked).toBeVisible();
    await expect(blocked).toContainText('Sección no disponible para su usuario');
  });

  await context.close();
});

test('IT-08 · Seguridad del epidemiólogo: no registra, edita conservando al profesional original', async ({ browser }) => {
  const { context, page } = await contextFor(browser, env.epi);
  const patient = await patientByDni(context.request, env.dni01);
  const [before] = await casesOf(context.request, patient.uuid);

  await test.step('No ve el botón «Nuevo caso»', async () => {
    await openDashboard(page);
    await expect(page.getByRole('heading', { name: 'Casos registrados' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nuevo caso' })).toHaveCount(0);
  });

  await test.step('POST /cases → 403', async () => {
    const response = await context.request.post(`${MODULE_API}/cases`, { data: {} });
    expect(response.status()).toBe(403);
  });

  await test.step('Edita el caso (200) y conserva el proveedor original', async () => {
    const dialog = await openEdit(page, env.dni01);
    await dialog.locator('#edit-vaccinationStatus').selectOption('SI');
    const { status, body } = await saveEdit(page, dialog);
    expect(status).toBe(200);
    expect(body.providerUuid).toBe(before.providerUuid);
    expect(body.vaccinationStatus).toBe('SI');
  });

  await context.close();
});

test('IT-09 · Seguridad sin acceso: sin enlace, sin sección y API rechazada', async ({ browser }) => {
  const { context, page } = await contextFor(browser, env.sinAcceso);

  await test.step('No ve el enlace en el inicio', async () => {
    await page.goto(HOME);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('link', NAV_LINK)).toHaveCount(0);
  });

  await test.step('La URL directa no muestra el componente', async () => {
    await page.goto(DASHBOARD);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Vigilancia epidemiológica' })).toHaveCount(0);
    const notice = await page.getByText('Sección no disponible para su usuario').count();
    test.info().annotations.push({
      type: 'observación',
      description: notice
        ? 'Se muestra el aviso «Sección no disponible para su usuario».'
        : 'El SIH no renderiza la extensión del componente (sin aviso).',
    });
  });

  await test.step('GET y POST /cases rechazados (401 o 403)', async () => {
    const list = await context.request.get(`${MODULE_API}/cases`);
    const create = await context.request.post(`${MODULE_API}/cases`, { data: {} });
    expect([401, 403]).toContain(list.status());
    expect([401, 403]).toContain(create.status());
  });

  await context.close();
});
