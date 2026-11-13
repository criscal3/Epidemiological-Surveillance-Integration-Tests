/** Variables del entorno de pruebas. Las claves se leen de .env (no versionado). */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable ${name} en .env (vea .env.example).`);
  return value;
}

export interface Credentials {
  username: string;
  password: string;
}

const user = (prefix: string): Credentials => ({
  username: required(`${prefix}_USER`),
  password: required(`${prefix}_PASS`),
});

export const env = {
  admin: user('ADMIN'),
  medico: user('MEDICO'),
  epi: user('EPI'),
  sinAcceso: user('SIN_ACCESO'),
  locationUuid: required('LOCATION_UUID'),
  dni01: required('DNI_01'),
  dni02: required('DNI_02'),
  centerQuery: required('CENTER_QUERY'),
  centerName: required('CENTER_NAME'),
  eventConceptUuid: process.env.EVENT_CONCEPT_UUID ?? '094d1472-74d0-4f3b-9ba2-3958cf0edea8',
  labTestConceptUuid: process.env.LAB_TEST_CONCEPT_UUID ?? '450efcc9-ddcd-4ecd-b999-e585ccb583eb',
  causeOfDeathConceptUuid:
    process.env.CAUSE_OF_DEATH_CONCEPT_UUID ?? process.env.EVENT_CONCEPT_UUID ?? '094d1472-74d0-4f3b-9ba2-3958cf0edea8',
};

export const REST = '/openmrs/ws/rest/v1';
export const MODULE_API = `${REST}/sihsalusepidemiologicalsurveillance`;
export const DASHBOARD = '/openmrs/spa/home/epidemiological-surveillance';
export const HOME = '/openmrs/spa/home';

/** Privilegios del componente, tal como figuran en config.xml. */
export const PRIVILEGES = {
  access: 'app:home.epidemiologicalSurveillance',
  manage: 'Vigilancia Epidemiologica: Configurar',
};
