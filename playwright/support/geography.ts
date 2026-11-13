import { type Page, expect } from '@playwright/test';

/**
 * El panel geográfico aplica por defecto la dirección de la ubicación de la sesión, hasta el nivel
 * de centro poblado. Se espera a que el filtro cargue esos valores y se elige el centro poblado de
 * la prueba, de modo que el mapa muestre su foco.
 */
export async function filterGeographyToCenter(page: Page, center: string) {
  const panel = page.getByRole('tabpanel', { name: 'Información geográfica' });
  const select = panel.getByLabel('Centro poblado', { exact: true });
  const option = select.locator('option').filter({ hasText: new RegExp(`^\\s*${escape(center)}\\b`, 'i') });
  await expect(option, `opción «${center}» en el filtro de centro poblado`).toHaveCount(1);
  await expect(select).toBeEnabled();
  await select.selectOption((await option.getAttribute('value')) ?? '');
}

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
