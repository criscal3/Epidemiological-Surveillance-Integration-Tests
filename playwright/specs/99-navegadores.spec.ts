import { type Page, expect, test } from '@playwright/test';
import { eventUuid, focusMarkerName, geographyFocus } from '../support/api';
import { env } from '../support/env';
import { filterGeographyToCenter } from '../support/geography';
import { login, openDashboard } from '../support/session';

/**
 * RNF de compatibilidad: recorrido de solo lectura por las secciones principales, sobre los casos
 * registrados en el escenario. Se ejecuta en cada navegador y dispositivo configurado.
 */
async function noHorizontalOverflow(page: Page, section: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `«${section}» no se desborda horizontalmente`).toBeLessThanOrEqual(1);
}

async function evidence(page: Page, name: string) {
  await test.info().attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}

test('RNF · Compatibilidad con navegadores y dispositivos', async ({ page, browser, browserName, isMobile }) => {
  const project = test.info().project.name;
  test.info().annotations.push({ type: 'navegador', description: `${project}: ${browserName} ${browser.version()}` });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await login(page.context(), env.epi);
  const event = await eventUuid(page.context().request);
  const sections: { tab: string; check: () => Promise<void> }[] = [
    {
      tab: 'Casos',
      check: async () => {
        await expect(page.getByRole('heading', { name: 'Casos registrados' })).toBeVisible();
        await expect(page.getByRole('row').filter({ hasText: env.dni01 })).toHaveCount(1);
      },
    },
    {
      tab: 'Registros semanales',
      check: async () => {
        await expect(page.getByRole('row').filter({ hasText: env.dni02 })).toHaveCount(1);
      },
    },
    {
      tab: 'Alertas',
      check: async () => {
        await expect(page.getByRole('table', { name: 'Alertas' })).toBeVisible();
      },
    },
    {
      tab: 'Información geográfica',
      check: async () => {
        await page.locator('#geo-event').selectOption(event);
        await filterGeographyToCenter(page, env.centerName);
        const { focus } = await geographyFocus(page.context().request, event, env.centerName);
        expect(focus, `foco de ${env.centerName}`).toBeTruthy();
        await expect(page.getByRole('img', { name: 'Distribución geográfica de focos' })).toBeVisible();
        // Mismo marcador que verifica IT-13: «…→ centro poblado: total de casos».
        await expect(page.getByRole('button', { name: focusMarkerName(env.centerName, focus.total) })).toBeAttached();
      },
    },
  ];

  await openDashboard(page);
  for (const section of sections) {
    await test.step(section.tab, async () => {
      const tab = page.getByRole('tab', { name: section.tab, exact: true });
      await tab.scrollIntoViewIfNeeded();
      await tab.click();
      await section.check();
      if (isMobile) await noHorizontalOverflow(page, section.tab);
      await evidence(page, `${project} – ${section.tab}`);
    });
  }

  expect(errors, 'errores de JavaScript en la página').toEqual([]);
});
