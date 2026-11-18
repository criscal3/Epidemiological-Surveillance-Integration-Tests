import { expect, test } from '@playwright/test';
import { MODULE_API, env } from '../support/env';
import { Tarea } from '../support/pasos';
import { contextFor, openDashboard } from '../support/session';

/**
 * RNF-03 · Consultar la información epidemiológica: el usuario elige la sección y sus filtros, y
 * la información se vuelve a calcular sin otra acción (no hay botón de consultar o aplicar).
 * Solo lectura: se ejecuta sobre los casos registrados en el escenario.
 */
const SECCIONES = [
  { tab: 'Información temporal', filtro: '#report-diagnosis', recurso: `${MODULE_API}/reports?` },
  { tab: 'Indicadores', filtro: '#indicators-diagnosis', recurso: `${MODULE_API}/reports/indicators?` },
  { tab: 'Información demográfica', filtro: '#demographic-diagnosis', recurso: `${MODULE_API}/reports/demographics?` },
  { tab: 'Información geográfica', filtro: '#geo-diagnosis', recurso: `${MODULE_API}/reports/geography?` },
];

test('RNF-03 · Consultar la información epidemiológica en un paso por sección', async ({ browser }) => {
  const { context, page } = await contextFor(browser, env.epi);
  await openDashboard(page);

  for (const { tab, filtro, recurso } of SECCIONES) {
    await test.step(`${tab}: cambiar el filtro «Casos incluidos» actualiza la información`, async () => {
      const tarea = new Tarea(`Consultar ${tab.toLowerCase()}`);
      await tarea.paso('Seleccionar la sección y los filtros (la información se actualiza sola)', async () => {
        await page.getByRole('tab', { name: tab, exact: true }).click();
        const seccion = page.getByRole('region', { name: tab, exact: true });
        await expect(seccion.locator(filtro)).toBeVisible();
        await expect(seccion.getByRole('button', { name: /^(Consultar|Aplicar|Buscar|Generar)\b/ })).toHaveCount(0);
        const consulta = page.waitForResponse(
          (r) => r.url().includes(recurso) && r.url().includes('diagnosisType=TODOS') && r.ok(),
        );
        await seccion.locator(filtro).selectOption('TODOS');
        await consulta;
      });
      tarea.cerrar();
    });
  }

  await context.close();
});
