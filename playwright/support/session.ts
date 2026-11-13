import { type Browser, type BrowserContext, type Page, expect } from '@playwright/test';
import { type Credentials, DASHBOARD, REST, env } from './env';

export interface SessionInfo {
  userUuid: string;
  username: string;
  providerUuid?: string;
}

/**
 * Inicia sesión con la API de sesión de OpenMRS a través del proxy del frontend local, de modo
 * que la cookie quede en el mismo origen que la SPA. Luego fija la ubicación de sesión.
 */
export async function login(context: BrowserContext, user: Credentials): Promise<SessionInfo> {
  const authorization = `Basic ${Buffer.from(`${user.username}:${user.password}`).toString('base64')}`;
  const response = await context.request.get(
    `${REST}/session?v=custom:(authenticated,user:(uuid,username),currentProvider:(uuid))`,
    { headers: { Authorization: authorization } },
  );
  expect(response.ok(), `inicio de sesión de ${user.username}`).toBeTruthy();
  const body = await response.json();
  expect(body.authenticated, `credenciales de ${user.username}`).toBe(true);
  // Los avisos emergentes del SIH (toasts) se apilan sobre las pestañas y botones e interceptan los
  // clics. Se siguen mostrando, pero dejan pasar el puntero; no afecta a lo que se verifica.
  await context.addInitScript(() => {
    const style = () => {
      const tag = document.createElement('style');
      tag.textContent = '.omrs-toasts-container, .omrs-toasts-container * { pointer-events: none !important; }';
      document.head.appendChild(tag);
    };
    if (document.head) style();
    else document.addEventListener('DOMContentLoaded', style);
  });
  // Un usuario sin privilegios puede no poder fijar la ubicación; no es parte de lo que se prueba.
  await context.request.post(`${REST}/session`, { data: { sessionLocation: env.locationUuid, locale: 'es' } });
  return {
    userUuid: body.user?.uuid,
    username: body.user?.username,
    providerUuid: body.currentProvider?.uuid,
  };
}

/** Crea un contexto de navegador independiente con la sesión del usuario indicado. */
export async function contextFor(browser: Browser, user: Credentials) {
  const context = await browser.newContext();
  const session = await login(context, user);
  const page = await context.newPage();
  return { context, page, session };
}

/** Abre el componente y espera a que cargue el catálogo. */
export async function openDashboard(page: Page) {
  await page.goto(DASHBOARD);
  await expect(page.getByRole('heading', { name: 'Vigilancia epidemiológica' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Casos', exact: true })).toBeVisible();
}
