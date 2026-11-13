import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

/**
 * «escenario» ejecuta IT-02 a IT-13 en orden (un worker), porque reproducen un único escenario:
 * el médico registra los casos, el epidemiólogo los edita y atiende las alertas, y los reportes
 * consultan esos mismos casos. Antes de cada corrida se restaura la línea base.
 *
 * Los proyectos de compatibilidad (RNF de navegadores) dependen del escenario: corren después,
 * solo lectura, sobre los casos ya registrados.
 */
const COMPATIBILIDAD = /99-navegadores\.spec\.ts/;
const compat = (name: string, use: Record<string, unknown>) => ({
  name,
  testMatch: COMPATIBILIDAD,
  dependencies: ['escenario'],
  use,
});

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 3 * 60 * 1000,
  expect: { timeout: 30 * 1000 },
  outputDir: 'resultados/artefactos',
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'reporte-html' }],
    ['json', { outputFile: 'resultados/resultados.json' }],
  ],
  use: {
    baseURL: process.env.SPA_URL ?? 'http://localhost:8080',
    locale: 'es-PE',
    timezoneId: 'America/Lima',
    acceptDownloads: true,
    trace: 'on',
    screenshot: 'on',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'escenario', testIgnore: COMPATIBILIDAD, use: { ...devices['Desktop Chrome'] } },
    // Escritorio: Chrome y Edge instalados en el equipo; Firefox de Playwright.
    compat('Google Chrome', { ...devices['Desktop Chrome'], channel: 'chrome' }),
    compat('Microsoft Edge', { ...devices['Desktop Edge'], channel: 'msedge' }),
    compat('Mozilla Firefox', { ...devices['Desktop Firefox'] }),
    // Tablets y smartphones (emulación de pantalla, táctil y agente de usuario). Android usa el Chrome
    // instalado; iOS, el WebKit de Playwright 1.65.0 (Safari 27). Firefox es el de Playwright 1.65.0 (159).
    compat('Android smartphone (Pixel 7)', { ...devices['Pixel 7'], channel: 'chrome' }),
    compat('Android tablet (Galaxy Tab S4)', { ...devices['Galaxy Tab S4'], channel: 'chrome' }),
    compat('iOS smartphone (iPhone 14, WebKit)', { ...devices['iPhone 14'] }),
    compat('iOS tablet (iPad, WebKit)', { ...devices['iPad (gen 7)'] }),
  ],
});
