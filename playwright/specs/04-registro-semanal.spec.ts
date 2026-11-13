import fs from 'node:fs';
import path from 'node:path';
import { type Page, expect, test } from '@playwright/test';
import ExcelJS from 'exceljs';
import { limaNow } from '../support/api';
import { MODULE_API, env } from '../support/env';
import { epiWeek } from '../support/epiweek';
import { contextFor, openDashboard } from '../support/session';

const DOWNLOADS = path.resolve(__dirname, '..', 'descargas');

/** Tabla exportada → filas indexadas por DNI con las columnas de etnia. */
function ethnicityByDni(rows: string[][]) {
  const [header, ...data] = rows;
  const col = (label: string) => {
    const index = header.indexOf(label);
    expect(index, `columna «${label}» en el archivo`).toBeGreaterThanOrEqual(0);
    return index;
  };
  const dni = col('DNI');
  const ethnicity = col('Etnia');
  const group = col('Grupo de etnia');
  return new Map(data.map((r) => [r[dni], { ethnicity: r[ethnicity] ?? '', group: r[group] ?? '' }]));
}

function parseCsv(text: string): string[][] {
  return text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => m[1].replace(/""/g, '"')));
}

async function download(page: Page, option: string) {
  await page.getByRole('button', { name: 'Exportar' }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: option }).click();
  const file = await pending;
  fs.mkdirSync(DOWNLOADS, { recursive: true });
  const target = path.join(DOWNLOADS, file.suggestedFilename());
  await file.saveAs(target);
  return target;
}

function expectEthnicity(rows: Map<string, { ethnicity: string; group: string }>) {
  const first = rows.get(env.dni01);
  const second = rows.get(env.dni02);
  expect(first, 'fila de E2E-VIG-01').toBeTruthy();
  expect(second, 'fila de E2E-VIG-02').toBeTruthy();
  expect(String(first!.group)).toBe('4');
  expect(String(first!.ethnicity)).toMatch(/^\d+$/);
  expect(String(second!.group)).toBe('1');
  expect(String(second!.ethnicity)).toBe('');
}

test('IT-12 · Registro semanal: filas reales con etnia MINSA y exportación xlsx y csv', async ({ browser }) => {
  const { context, page } = await contextFor(browser, env.epi);
  const { year, week } = epiWeek(limaNow().date);

  await test.step(`GET /weekly-records (año ${year}, semana ${week})`, async () => {
    const response = await context.request.get(`${MODULE_API}/weekly-records?year=${year}&week=${week}`);
    expect(response.status()).toBe(200);
    const rows: any[] = (await response.json()).rows ?? [];
    const first = rows.find((r) => r.dni === env.dni01);
    const second = rows.find((r) => r.dni === env.dni02);
    expect(first, 'E2E-VIG-01 notificado en la semana').toBeTruthy();
    expect(second, 'E2E-VIG-02 notificado en la semana').toBeTruthy();
    expect(first.ethnicityGroup).toBe(4);
    expect(typeof first.ethnicity).toBe('number');
    expect(second.ethnicityGroup).toBe(1);
    expect(second.ethnicity).toBeNull();
  });

  await openDashboard(page);
  await page.getByRole('tab', { name: 'Registros semanales' }).click();
  await expect(page.getByRole('row').filter({ hasText: env.dni01 })).toHaveCount(1);
  await expect(page.getByRole('row').filter({ hasText: env.dni02 })).toHaveCount(1);

  await test.step('Exportación CSV con las columnas de etnia', async () => {
    const file = await download(page, 'Exportar CSV (.csv)');
    expectEthnicity(ethnicityByDni(parseCsv(fs.readFileSync(file, 'utf8'))));
    await test.info().attach('registro-semanal.csv', { path: file });
  });

  await test.step('Exportación Excel con las columnas de etnia', async () => {
    const file = await download(page, 'Exportar Excel (.xlsx)');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file);
    const rows: string[][] = [];
    workbook.worksheets[0].eachRow((row) => {
      const values = row.values as unknown[];
      rows.push(values.slice(1).map((v) => (v == null ? '' : String(v))));
    });
    expectEthnicity(ethnicityByDni(rows));
    await test.info().attach('registro-semanal.xlsx', { path: file });
  });

  await context.close();
});
