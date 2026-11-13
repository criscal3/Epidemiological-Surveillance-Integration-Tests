import { type APIRequestContext, expect } from '@playwright/test';
import { MODULE_API, REST, env } from './env';

export interface PatientInfo {
  uuid: string;
  display: string;
  /** Nombre completo de la persona, sin el identificador. */
  name: string;
  gender: string;
  birthdate: string;
  cityVillage?: string;
}

export interface SourceInfo {
  encounterUuid: string;
  encounterDate: string;
  /** UUID del diagnóstico del encuentro (encounter_diagnosis), no del concepto. */
  diagnosisUuid: string;
  labObsUuid: string;
}

async function json(request: APIRequestContext, url: string) {
  const response = await request.get(url);
  expect(response.ok(), `GET ${url} → ${response.status()}`).toBeTruthy();
  return response.json();
}

/** Paciente registrado en el módulo de registro, buscado por su DNI. */
export async function patientByDni(request: APIRequestContext, dni: string): Promise<PatientInfo> {
  const body = await json(
    request,
    `${REST}/patient?identifier=${encodeURIComponent(dni)}&v=custom:(uuid,display,person:(display,gender,birthdate,preferredAddress:(cityVillage)))`,
  );
  expect(body.results, `paciente con DNI ${dni}`).toHaveLength(1);
  const [patient] = body.results;
  return {
    uuid: patient.uuid,
    display: patient.display,
    name: patient.person.display,
    gender: patient.person.gender,
    birthdate: String(patient.person.birthdate).slice(0, 10),
    cityVillage: patient.person.preferredAddress?.cityVillage,
  };
}

/**
 * Atención de origen del caso: el encuentro del paciente con el diagnóstico del evento notificable
 * y la observación de laboratorio (Gota gruesa) registradas desde la pantalla de Administración.
 */
export async function sourceFor(request: APIRequestContext, patientUuid: string): Promise<SourceInfo> {
  const body = await json(
    request,
    `${REST}/encounter?patient=${patientUuid}&v=custom:(uuid,voided,encounterDatetime,diagnoses:(uuid,voided,diagnosis:(coded:(uuid))),obs:(uuid,voided,concept:(uuid)))`,
  );
  for (const encounter of body.results ?? []) {
    if (encounter.voided) continue;
    const diagnosis = (encounter.diagnoses ?? []).find(
      (d: any) => !d.voided && d.diagnosis?.coded?.uuid === env.eventConceptUuid,
    );
    const obs = (encounter.obs ?? []).find((o: any) => !o.voided && o.concept?.uuid === env.labTestConceptUuid);
    if (diagnosis && obs)
      return {
        encounterUuid: encounter.uuid,
        // Fecha de la atención en America/Lima, como la calcula el formulario (no la fecha UTC).
        encounterDate: limaDate(new Date(encounter.encounterDatetime)),
        diagnosisUuid: diagnosis.uuid,
        labObsUuid: obs.uuid,
      };
  }
  throw new Error(
    `El paciente ${patientUuid} no tiene una atención con el diagnóstico ${env.eventConceptUuid} y la prueba ${env.labTestConceptUuid}.`,
  );
}

export async function casesOf(request: APIRequestContext, patientUuid: string): Promise<any[]> {
  const body = await json(request, `${MODULE_API}/cases?patient=${patientUuid}`);
  return body.results ?? [];
}

export async function alerts(request: APIRequestContext, query: Record<string, string> = {}): Promise<any[]> {
  return json(request, `${MODULE_API}/alerts?${new URLSearchParams(query)}`);
}

export async function eventUuid(request: APIRequestContext): Promise<string> {
  const events: any[] = (await json(request, `${MODULE_API}/events`)).results ?? [];
  const event = events.find((e) => e.conceptUuid === env.eventConceptUuid && e.active !== false);
  expect(event, 'evento notificable activo del diagnóstico').toBeTruthy();
  return event.uuid;
}

/**
 * Reporte geográfico con los filtros por defecto del panel (año en curso hasta hoy, nivel
 * DEPARTAMENTO, casos confirmados, columna origen) y el foco del centro poblado indicado.
 */
export async function geographyFocus(request: APIRequestContext, event: string, center: string) {
  const today = limaNow().date;
  const query = new URLSearchParams({
    event,
    from: `${today.slice(0, 4)}-01-01`,
    to: today,
    zoneLevel: 'DEPARTAMENTO',
    diagnosisType: 'CONFIRMADO',
    column: 'origin',
    period: 'mes',
  });
  const report = await json(request, `${MODULE_API}/reports/geography?${query}`);
  const focus = (report.foci as any[]).find((f) => String(f.label).toLowerCase().includes(center.toLowerCase()));
  return { report, focus };
}

/**
 * Nombre accesible del marcador del foco: «etiqueta: total». El panel acorta la etiqueta al nivel
 * visible (p. ej. «NAPO → CHAMBIRAL»), por lo que se acepta cualquier prefijo de la ruta.
 */
export function focusMarkerName(center: string, total: number): RegExp {
  const escaped = center.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|→ )${escaped}: ${total}$`, 'i');
}

/** Edad en años cumplidos a una fecha (AAAA-MM-DD), como la calcula el componente. */
export function ageAt(birthdate: string, date: string): number {
  return (
    Number(date.slice(0, 4)) - Number(birthdate.slice(0, 4)) - (date.slice(5) < birthdate.slice(5) ? 1 : 0)
  );
}

/** Fecha (AAAA-MM-DD) de un instante en America/Lima (UTC-5, sin horario de verano). */
export function limaDate(value: Date): string {
  return new Date(value.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Fecha y hora actuales en America/Lima. */
export function limaNow(): { date: string; dateTime: string } {
  const local = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 19);
  return { date: local.slice(0, 10), dateTime: local };
}

/** AAAA-MM-DD → DD/MM/AAAA, formato del selector de fecha. */
export const toDisplayDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
