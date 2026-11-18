import { type Locator, type Page, expect, test } from '@playwright/test';
import { type PatientInfo, type SourceInfo, ageAt, casesOf, limaNow, toDisplayDate } from './api';
import { MODULE_API, env } from './env';
import { Tarea } from './pasos';

const SEX: Record<string, string> = { F: 'Femenino', M: 'Masculino', O: 'Otro', U: 'Sin información' };

/**
 * Antecedente de viaje de los casos de prueba: centro poblado SANTA CLOTILDE (1601070001), desde
 * 3 días hasta 1 día antes de la fecha de inicio de síntomas (que el formulario toma de la atención).
 */
export const TRAVEL = { code: '1601070001', name: 'SANTA CLOTILDE', startOffset: -3, endOffset: -1 };

/** Suma días a una fecha ISO (AAAA-MM-DD) sin depender de la zona horaria. */
export function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface RegisteredCase {
  status: number;
  body: any;
  addressHierarchyRequests: number;
}

/**
 * Registra un caso desde el formulario «Nuevo caso», tal como lo hace el médico.
 * Cada paso se registra con test.step para que el reporte muestre qué integración se verificó.
 */
export async function registerCase(
  page: Page,
  patient: PatientInfo,
  dni: string,
  source: SourceInfo,
  withTravel = false,
): Promise<RegisteredCase> {
  // «Nuevo caso» abre el formulario: es navegación dentro del componente, no un paso (RE 1.2).
  await page.getByRole('button', { name: 'Nuevo caso' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo caso' });
  const tarea = new Tarea('Registrar un caso');
  await expect(dialog).toBeVisible();

  await test.step('IT-02 Registro de pacientes: búsqueda y datos precargados', async () => {
    const search = page.waitForResponse((r) => r.url().includes('/ws/rest/v1/patient?') && r.ok());
    await dialog.locator('#case-patient').fill(dni);
    await search;
    await dialog.getByRole('option', { name: new RegExp(`DNI: ${dni}`) }).click();
    const tile = dialog.locator('.cds--tile').filter({ hasText: `DNI: ${dni}` });
    await expect(tile).toBeVisible();
    await expect(tile).toContainText(SEX[patient.gender] ?? patient.gender);
    await expect(tile).toContainText(`${ageAt(patient.birthdate, limaNow().date)} años`);
  });

  await test.step('IT-03 Hoja clínica: atención de origen real', async () => {
    const encounter = dialog.locator('#case-sourceEncounterUuid');
    await expect(encounter.locator(`option[value="${source.encounterUuid}"]`)).toHaveCount(1);
    await encounter.selectOption(source.encounterUuid);
    await tarea.paso('Seleccionar el paciente y la atención de origen → Continuar', () =>
      dialog.getByRole('button', { name: 'Continuar' }).click(),
    );
  });

  await test.step('IT-03 Hoja clínica: diagnóstico real con su código CIE-10', async () => {
    const diagnosis = dialog.locator('#case-disease-diagnosis');
    const option = diagnosis.locator(`option[value="${source.diagnosisUuid}"]`);
    await expect(option).toHaveCount(1);
    await expect(option).toHaveText(/^B50/);
    await diagnosis.selectOption(source.diagnosisUuid);
  });

  await dialog.locator('#case-origin').selectOption('AUTOCTONO');

  let addressHierarchyRequests = 0;
  await test.step('IT-05 Address Hierarchy: lugar probable de infección', async () => {
    const counter = (r: { url(): string }) => {
      if (r.url().includes('/module/addresshierarchy/')) addressHierarchyRequests++;
    };
    page.on('response', counter);
    await dialog.locator('#infection-address-search').fill(env.centerQuery);
    const option = dialog.getByRole('list').getByRole('button', { name: new RegExp(escape(env.centerName), 'i') });
    await expect(option.first()).toBeVisible();
    await option.first().click();
    await expect(dialog.getByRole('button', { name: 'Cambiar lugar' })).toBeVisible();
    page.off('response', counter);
    expect(addressHierarchyRequests, 'consultas al módulo Address Hierarchy').toBeGreaterThan(0);
  });

  await fillDate(dialog.locator('#case-onset'), source.encounterDate);
  if (withTravel) {
    await test.step('IT-05 Address Hierarchy: antecedente de viaje (centro poblado y fechas)', async () => {
      await dialog.getByRole('button', { name: 'Agregar viaje' }).click();
      const trip = dialog.getByRole('group', { name: 'Viaje 1', exact: true });
      await trip.getByRole('searchbox').fill(TRAVEL.code);
      await trip
        .getByRole('list')
        .getByRole('button', { name: new RegExp(`${escape(TRAVEL.name)} \\(${TRAVEL.code}\\)`, 'i') })
        .first()
        .click();
      await fillDate(trip.getByLabel('Fecha de inicio', { exact: true }), shiftDate(source.encounterDate, TRAVEL.startOffset));
      await fillDate(trip.getByLabel('Fecha de fin', { exact: true }), shiftDate(source.encounterDate, TRAVEL.endOffset));
    });
  }

  await test.step('IT-04 Laboratorio: clasificación automática desde el resultado', async () => {
    const lab = dialog.locator('#case-laboratoryResultUuid');
    await expect(lab.locator(`option[value="${source.labObsUuid}"]`)).toHaveCount(1);
    await lab.selectOption(source.labObsUuid);
    await expect(dialog.locator('#case-status')).toHaveValue('CONFIRMED');
  });

  await dialog.locator('#case-habitualResidence').selectOption('1');
  await dialog.locator('#case-vaccinationStatus').selectOption('IGN');
  await dialog.locator('#case-investigationForm').selectOption('NO');
  await dialog.locator('#case-surveillanceType').selectOption('PASIVA');
  // Con segundos en 00, el campo datetime-local guarda el valor sin ellos («HH:mm»); se escribe igual.
  await dialog.locator('#case-notificationDate').fill(limaNow().dateTime.replace(/:00$/, ''));
  await tarea.paso('Completar los datos del caso → Continuar', () =>
    dialog.getByRole('button', { name: 'Continuar' }).click(),
  );

  await expect(dialog.getByRole('heading', { name: 'Revisa antes de registrar' })).toBeVisible();
  const response = await captureResponse(
    page,
    'POST',
    (url) => url.endsWith(`${MODULE_API}/cases`),
    () =>
      tarea.paso('Revisar el resumen del caso → Registrar caso', () =>
        dialog.getByRole('button', { name: 'Registrar caso', exact: true }).click(),
      ),
    async () => (await casesOf(page.context().request, patient.uuid))[0],
  );
  tarea.cerrar();
  return { ...response, addressHierarchyRequests };
}

/**
 * Tras guardar, el componente recarga la página y el navegador descarta el cuerpo de la respuesta.
 * Las peticiones pasan por el service worker del SIH, por lo que no se interceptan: el estado HTTP
 * se toma de la respuesta y el caso guardado se lee desde la API.
 */
export async function captureResponse(
  page: Page,
  method: string,
  matches: (url: string) => boolean,
  action: () => Promise<unknown>,
  readBack: (url: string) => Promise<any>,
): Promise<{ status: number; body: any }> {
  const pending = page.waitForResponse((r) => r.request().method() === method && matches(r.url()));
  await action();
  const response = await pending;
  return { status: response.status(), body: await readBack(response.url()) };
}

/** Selector de fecha de Carbon: se escribe DD/MM/AAAA y se confirma con Tab. */
async function fillDate(input: Locator, iso: string) {
  await input.fill(toDisplayDate(iso));
  await input.press('Tab');
}

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Abre el modal de edición de un caso desde la tabla de casos, buscando la fila por DNI. */
const ediciones = new WeakMap<Locator, Tarea>();

export async function openEdit(page: Page, dni: string) {
  const tarea = new Tarea('Editar un caso');
  const row = page.getByRole('row').filter({ hasText: dni });
  await expect(row).toHaveCount(1);
  await tarea.paso('Seleccionar el caso en la tabla de casos → Editar', () =>
    row.getByRole('button', { name: 'Editar' }).click(),
  );
  const dialog = page.getByRole('dialog').filter({ has: page.locator('#edit-origin') });
  await expect(dialog.locator('#edit-origin')).toBeVisible();
  ediciones.set(dialog, tarea);
  return dialog;
}

/** Guarda la edición y devuelve la respuesta del PUT /cases/{uuid}. */
export async function saveEdit(page: Page, dialog: Locator) {
  const tarea = ediciones.get(dialog) ?? new Tarea('Editar un caso');
  const result = await captureResponse(
    page,
    'PUT',
    (url) => url.includes(`${MODULE_API}/cases/`),
    () => tarea.paso('Modificar los datos del caso → Guardar', () => dialog.getByRole('button', { name: 'Guardar' }).click()),
    async (url) => {
      const uuid = url.split('/cases/')[1].split('?')[0];
      const response = await page.context().request.get(`${MODULE_API}/cases/${uuid}`);
      expect(response.ok(), `GET /cases/${uuid}`).toBeTruthy();
      return response.json();
    },
  );
  tarea.cerrar();
  return result;
}
