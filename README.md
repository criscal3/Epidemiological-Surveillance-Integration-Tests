# Pruebas de integración (RE 4.1) – Componente de Vigilancia Epidemiológica

Pruebas de integración del **Componente de Vigilancia Epidemiológica** del SIH.SALUS (sistema de
información hospitalario del Hospital Santa Clotilde, basado en OpenMRS O3). Corresponden al
Resultado Esperado 4.1 de la tesis *Desarrollo de un sistema de información hospitalario para el
Hospital Santa Clotilde. Componente de Vigilancia Epidemiológica* (PUCP, 2026).

## Versiones evaluadas

| Pieza | Repositorio | Versión probada |
|---|---|---|
| Backend (OMOD 1.0.0-SNAPSHOT) | [sihsalus/Epidemiological-Surveillance](https://github.com/sihsalus/Epidemiological-Surveillance) | commit `edcf9e4` |
| Frontend (`esm-epidemiological-surveillance-app`) | [sihsalus/sihsalus-frontend](https://github.com/sihsalus/sihsalus-frontend/tree/epidemiological-surveillance_Cristian), rama `epidemiological-surveillance_Cristian` | commit `566891d` |
| Distribución | [sihsalus/sihsalus](https://github.com/sihsalus/sihsalus), réplica local con Docker | — |

Corrida final: 12 de noviembre de 2026. Newman: 21 aserciones (corrida 1) y 28 (corrida 2), sin
fallos. Playwright: 16 de 16 pruebas aprobadas (9 del escenario y 7 de compatibilidad). SQL: 12
tablas del componente creadas y auditoría de IT-07 e IT-08 conforme.

## Requisitos

- Réplica local de la distro `sihsalus/sihsalus` levantada con Docker (en Windows, desde WSL), con
  el OMOD del componente instalado.
- Frontend `sihsalus-frontend` en la rama indicada, servido con `yarn start`.
- Node.js 20 o superior y Git Bash (Windows) para Playwright y Newman.
- Google Chrome y Microsoft Edge instalados (las pruebas de compatibilidad usan los del equipo).

## Seguridad

Las credenciales de los usuarios de prueba se leen de `playwright/.env`, que **no** se versiona
(vea `playwright/.env.example`). La colección y el *environment* de Postman no guardan claves.
Los reportes generados (`reportes/`, `playwright/reporte-html/`, `playwright/resultados/`) tampoco
se versionan: los de Newman incluyen la cabecera `Authorization` de las peticiones. Todos los
datos de prueba son sintéticos.

## Alcance

Pruebas IT-01 a IT-13 contra la réplica local de la distro `sihsalus/sihsalus`, con el OMOD y el
microfrontend del componente. Se usan:

- **Postman/Newman** para la API (`postman/`).
- **Playwright** para la interfaz (`playwright/`).
- **SQL** para lo que solo consta en la base de datos (`sql/`).

| Caso | Herramienta | Dónde |
|---|---|---|
| IT-01 Carga en el backend | Postman + SQL | Corrida 1 (IT-01a–c) y `sql/it01-tablas.sql` |
| IT-02 Registro de pacientes | Playwright | `01-registro-medico` |
| IT-03 Hoja clínica | Playwright + Postman | `01-registro-medico` y corrida 2 |
| IT-04 Laboratorio | Playwright | `01-registro-medico` |
| IT-05 Address Hierarchy (lugar de infección y antecedente de viaje) | Playwright + Postman | `01-registro-medico`, `03-alertas` y corrida 2 |
| IT-06 Defunción | Playwright + Postman | `05-defuncion` y corrida 2 |
| IT-07 Seguridad: médico | Playwright + Postman + SQL | `01-registro-medico`, `02-seguridad`, corrida 2 y `sql/it07-it08-auditoria.sql` |
| IT-08 Seguridad: epidemiología | Playwright + Postman + SQL | `02-seguridad`, corrida 2 y `sql/it07-it08-auditoria.sql` |
| IT-09 Seguridad: sin acceso | Playwright + Postman | `02-seguridad` y corrida 2 |
| IT-10 Alertas en tiempo real | Playwright | `03-alertas` |
| IT-11 Alerta de brote | Postman (regla) + Playwright | Corrida 1 (IT-11a), `03-alertas` y corrida 2 |
| IT-12 Registro semanal | Postman + Playwright | `04-registro-semanal` y corrida 2 |
| IT-13 OpenStreetMap | Playwright | `06-mapa` |
| RNF-03 Pasos de las tareas principales | Playwright | anotaciones en todo el escenario y `07-consultas` |

Las pruebas reproducen un único escenario en orden:

1. El médico registra el caso de E2E-VIG-01 y luego el de E2E-VIG-02.
2. El segundo caso genera la alerta inmediata (IT-10) y la de brote (IT-11).
3. El registro semanal y el mapa consultan esos dos casos.
4. Al final se registra la defunción de E2E-VIG-01.

Por eso **cada corrida parte de la línea base restaurada**.

## 1. Preparación de la línea base (una sola vez)

Todo lo que se cree aquí debe quedar en la copia de la base de datos. Al terminar, vuelva a ejecutar
`backup_dump.sh` y use esa copia como línea base de integración.

### Usuarios y roles

| Usuario | Privilegios del componente | Además |
|---|---|---|
| `medico.prueba` | `app:home.epidemiologicalSurveillance`, Ver Casos, Registrar Casos, Editar Casos | Rol clínico del SIH (lectura de pacientes, atenciones, observaciones, ubicaciones y proveedores) y **cuenta de proveedor** |
| `epi.prueba` | `app:home…`, Ver Casos, Editar Casos, Ver Indicadores, Configurar | Los mismos privilegios clínicos de lectura. La bandeja de alertas exige los cinco privilegios de esta fila |
| `sin.acceso` | Ninguno del componente | Ya creado |

### Pacientes (módulo de registro)

Cree dos pacientes ficticios. Ambos con:
- nombres, apellidos, DNI y fecha de nacimiento;
- seguro SEGURO PRIVADO, sin número;
- dirección con centro poblado.

- **E2E-VIG-01**: una etnia **específica** con código MINSA entre 1 y 55 (salvo 2, 19, 40 y 49),
  por ejemplo un pueblo amazónico de la zona. No use la opción genérica «Indígena Amazónico»: no
  tiene código, solo grupo, y IT-12 espera grupo 4 **con** código.
- **E2E-VIG-02**: etnia **Mestizo** (código 58 → grupo 1, sin código de etnia).

El código exacto no importa; la consulta 1 de `sql/precondiciones.sql` lista las etnias con su
código y grupo, y la consulta 2 confirma lo que quedó registrado en cada paciente.

### Atenciones (Administración, usuario admin)

Registre una atención para cada paciente, **el mismo día** (deben caer en la misma semana
epidemiológica), en la ubicación de `LOCATION_UUID`. Cada atención lleva:
- Diagnóstico **MALARIA GRAVE** (`094d1472-…`), Definitivo.
- Observación **Gota gruesa** (`450efcc9-…`) = **Positivo**.
- Código prestacional **056 – Consulta externa**.

### Centro poblado de infección

1. Elija un centro poblado **sin casos previos** del evento; por ejemplo, el de residencia de
   los pacientes. Las pruebas no lo comprueban por sí mismas: verifíquelo con la consulta 3 de
   `sql/precondiciones.sql` (`casos_previos = 0` y coordenadas cargadas).
2. Cargue sus coordenadas en *Configuración → Cargar coordenadas de centros poblados* (IT-13).
3. Anote dos textos para `.env`:
   - `CENTER_QUERY`: lo que se escribe en el buscador del formulario.
   - `CENTER_NAME`: el texto con que aparece la opción.

### Centro poblado del antecedente de viaje

Ambos casos registran como antecedente de viaje el centro poblado **SANTA CLOTILDE (1601070001)**,
desde 3 días hasta 1 día antes de la fecha de inicio de síntomas (constante `TRAVEL` en
`playwright/support/case-form.ts`). La consulta 4 de `sql/precondiciones.sql` debe devolver una
sola fila para ese código.

### Respaldo

```bash
cd ~/sihsalus
export MYSQL_ROOT_PASSWORD="$(grep -E '^MYSQL_ROOT_PASSWORD=' .env | cut -d= -f2-)"
./scripts/backup/backup_dump.sh
```

## 2. Instalación (una sola vez, en Git Bash)

```bash
cd pruebas-integracion/playwright
npm ci                         # o npm install la primera vez
npx playwright install chromium firefox webkit   # Chrome y Edge se usan los instalados
cp .env.example .env           # complete claves, DNI, LOCATION_UUID y centro poblado
```

## 3. Ejecución

```bash
# a) Restaurar la línea base (WSL) y reiniciar el backend
cd ~/sihsalus && ./scripts/backup/restore_dump.sh <respaldo> && docker compose restart backend

# b) Frontend local (otra terminal, rama epidemiological-surveillance_Cristian)
SIHSALUS_BACKEND_URL=http://localhost yarn start

# c0) Precondiciones (WSL): etnias de los pacientes y centro poblado sin casos y con coordenadas
docker compose exec -T <servicio-db> sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" openmrs' < sql/precondiciones.sql

# c) Postman, corrida 1: referencias, IT-01 y regla de IT-11
cd pruebas-integracion && ./newman.sh 1

# d) SQL de IT-01 (WSL; el servicio de base de datos es el que muestre `docker compose ps`)
docker compose exec -T <servicio-db> sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" openmrs' < sql/it01-tablas.sql

# e) Playwright: escenario IT-02 a IT-13 y, después, compatibilidad de navegadores (RNF)
cd playwright && npx playwright test
#    Solo el escenario:                     npx playwright test --project=escenario
#    Repetir un navegador sin el escenario:  npx playwright test --project="Mozilla Firefox" --no-deps

# f) Postman, corrida 2: verificaciones de API
cd .. && ./newman.sh 2

# g) SQL de auditoría (IT-07 e IT-08)
docker compose exec -T <servicio-db> sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" openmrs' < sql/it07-it08-auditoria.sql
```

## 4. Evidencias

- **Playwright:** `playwright/reporte-html/` (ábralo con `npm run report`). Cada prueba guarda
  traza, capturas y video si falla, y los pasos llevan el número de caso (IT-xx). Los archivos
  exportados en IT-12 quedan en `playwright/descargas/` y adjuntos en el reporte.
- **Postman:** `reportes/newman-corrida-1.html` y `reportes/newman-corrida-2.html`.
- **SQL:** salida de los dos scripts (captura de pantalla).

Estas carpetas no se versionan (vea *Seguridad*); se regeneran en cada corrida.

Al terminar una corrida, mueva el reporte de Playwright a `reportes/` con un nombre que indique la
corrida, ya que la siguiente ejecución lo sobrescribe. La carpeta `reportes/` queda así:

| Archivo o carpeta | Corrida |
|---|---|
| `newman-corrida-1.html` | Postman, corrida 1 (antes de Playwright) |
| `newman-corrida-2.html` | Postman, corrida 2 (después de Playwright) |
| `playwright-con-internet/` | Playwright con conexión a Internet |
| `playwright-sin-internet/` | Playwright sin conexión a Internet (RNF-01) |

Para abrir uno de ellos: `npx playwright show-report ../reportes/playwright-con-internet` (desde `playwright/`).

## Compatibilidad de navegadores (RNF)

`specs/99-navegadores.spec.ts` recorre en modo de solo lectura Casos, Registros semanales, Alertas e
Información geográfica. Lo hace en estos perfiles:

| Perfil | Motor | Versión |
|---|---|---|
| Google Chrome | Chrome instalado en el equipo | la instalada (queda en el reporte) |
| Microsoft Edge | Edge instalado en el equipo | la instalada (queda en el reporte) |
| Mozilla Firefox | Firefox de Playwright 1.65.0 | 159.0 |
| Android smartphone y tablet | Chrome instalado en el equipo, emulando Pixel 7 y Galaxy Tab S4 | la instalada (157.0.8103.79 en la corrida final) |
| iOS smartphone y tablet | WebKit de Playwright 1.65.0, emulando iPhone 14 e iPad | 27.2 |

En cada perfil verifica:
- que cada sección se muestre;
- que no haya errores de JavaScript;
- en móviles, que la página no se desborde horizontalmente.

Además, guarda una captura por sección. Los perfiles dependen del escenario, así que solo corren
si este pasó. Los dispositivos móviles se emulan (pantalla, táctil y agente de usuario); la
verificación en dispositivos físicos no forma parte de estas pruebas.

## Pasos de las tareas principales (RNF-03)

`support/pasos.ts` cuenta los pasos de cada tarea principal con la definición del RE 1.2: un paso es
cada pantalla o acción con la que el usuario confirma una selección o una operación dentro del
componente. No cuentan los clics ni el llenado de campos dentro de una misma pantalla, el inicio de
sesión ni la navegación del SIH.SALUS hasta el componente. Cada tarea deja en el reporte HTML una
anotación `RNF-03` con su número de pasos y su secuencia, y la prueba falla si supera 3.

| Tarea | Pasos contados | Dónde |
|---|---|---|
| Registrar un caso | 3: Continuar → Continuar → Registrar caso | `registerCase` (`01-registro-medico`, `03-alertas`) |
| Editar un caso | 2: Editar → Guardar | `openEdit` y `saveEdit` (`02-seguridad`, `05-defuncion`) |
| Descargar el registro semanal | 2: semana de notificación (por defecto, la actual) → Exportar y formato | `04-registro-semanal` |
| Atender una alerta | 1: Marcar como atendida | `03-alertas` |
| Consultar la información epidemiológica | 1 por sección: elegir la sección y el filtro; la información se actualiza sin otra acción | `07-consultas` (temporal, indicadores, demográfica y geográfica) |

Para ver el conteo, abra el reporte (`npm run report`) y revise las anotaciones de cada prueba.

## Notas

- IT-05: el formulario actual no usa listas en cascada (departamento → provincia → distrito →
  centro poblado), sino una búsqueda única. La búsqueda consulta Address Hierarchy por centro
  poblado, distrito y provincia, y la prueba verifica esas consultas y el `infectionAddressUuid`
  guardado.
- IT-06: la defunción se registra con el recurso persona del SIH (`POST /person/{uuid}`), el
  mismo que usa la acción del SIH para marcar a un paciente como fallecido. Después se marca
  «Defunción atribuible = Sí»: la alerta solo se genera con esa atribución.
- IT-07: la pestaña Configuración es visible, pero su contenido muestra «Sección no disponible
  para su usuario».
- IT-09: si el SIH no renderiza el componente para un usuario sin privilegio, la prueba registra
  en el reporte si apareció o no el aviso «Sección no disponible».
- IT-11 reemplaza la regla de foco por defecto (mínimo 0) por `it11-foco`: más de 1 caso
  autóctono en un foco eliminado.

## Licencia

[Mozilla Public License 2.0](LICENSE)
