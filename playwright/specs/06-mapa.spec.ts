import { expect, test } from '@playwright/test';
import { eventUuid, focusMarkerName, geographyFocus } from '../support/api';
import { env } from '../support/env';
import { filterGeographyToCenter } from '../support/geography';
import { contextFor, openDashboard } from '../support/session';

const RISK: Record<string, string> = { VERY_HIGH: 'Muy Alto', HIGH: 'Alto', MEDIUM: 'Mediano', LOW: 'Bajo' };

test('IT-13 · OpenStreetMap: capas cargadas y foco en su centro poblado con el nivel de riesgo', async ({ browser }) => {
  const { context, page } = await contextFor(browser, env.epi);
  const event = await eventUuid(context.request);

  await openDashboard(page);
  await page.getByRole('tab', { name: 'Información geográfica' }).click();
  const tile = page.waitForResponse((r) => r.url().startsWith('https://tile.openstreetmap.org/') && r.ok());
  await page.locator('#geo-event').selectOption(event);
  await filterGeographyToCenter(page, env.centerName);
  await test.step('Se cargan las teselas de OpenStreetMap', async () => {
    await tile;
    await expect(page.getByRole('img', { name: 'Distribución geográfica de focos' })).toBeVisible();
    await expect(page.getByText('© OpenStreetMap', { exact: false })).toBeVisible();
  });

  await test.step('El foco aparece en su centro poblado con el nivel de riesgo del reporte', async () => {
    // El reporte se consulta a la API con los filtros por defecto del panel; la interfaz debe mostrar ese foco.
    const { focus } = await geographyFocus(context.request, event, env.centerName);
    expect(focus, `foco de ${env.centerName}`).toBeTruthy();
    expect(focus.latitude, 'coordenadas cargadas').not.toBeNull();
    expect(focus.total).toBeGreaterThanOrEqual(2);
    const marker = page.getByRole('button', { name: focusMarkerName(env.centerName, focus.total) });
    await expect(marker).toBeVisible();
    const title = marker.locator('xpath=ancestor::*[local-name()="g"][1]/*[local-name()="title"]');
    await expect(title).toContainText(RISK[focus.risk]);
    await page.screenshot({ path: 'resultados/it-13-mapa.png', fullPage: true });
  });

  await context.close();
});
