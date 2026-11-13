#!/usr/bin/env bash
# Ejecuta la colección de Postman con Newman y genera un reporte HTML.
#   ./newman.sh 1   → carpetas 0 y 1 (antes de Playwright)
#   ./newman.sh 2   → carpetas 0 y 2 (después de Playwright)
# Las claves se toman de playwright/.env; no se escriben en ningún archivo de Postman.
set -euo pipefail
cd "$(dirname "$0")"
set -a; source playwright/.env; set +a

case "${1:-}" in
  1) folder="1 · IT-01 y precondición de IT-11 (antes de Playwright)" ;;
  2) folder="2 · Verificaciones de API (después de Playwright)" ;;
  *) echo "Uso: ./newman.sh 1|2"; exit 1 ;;
esac

mkdir -p reportes
npx -y -p newman@6.2.1 -p newman-reporter-htmlextra@1.23.1 newman run \
  postman/vigilancia-integracion.postman_collection.json \
  -e postman/local.postman_environment.json \
  --folder "0 · Sesiones y referencias" --folder "$folder" \
  --env-var "adminUser=$ADMIN_USER" --env-var "adminPass=$ADMIN_PASS" \
  --env-var "medicoUser=$MEDICO_USER" --env-var "medicoPass=$MEDICO_PASS" \
  --env-var "epiUser=$EPI_USER" --env-var "epiPass=$EPI_PASS" \
  --env-var "sinAccesoUser=$SIN_ACCESO_USER" --env-var "sinAccesoPass=$SIN_ACCESO_PASS" \
  --env-var "dni01=$DNI_01" --env-var "dni02=$DNI_02" \
  --env-var "eventConceptUuid=${EVENT_CONCEPT_UUID:-094d1472-74d0-4f3b-9ba2-3958cf0edea8}" \
  -r cli,htmlextra \
  --reporter-htmlextra-export "reportes/newman-corrida-$1.html" \
  --reporter-htmlextra-title "Vigilancia Epidemiológica – Postman corrida $1"
