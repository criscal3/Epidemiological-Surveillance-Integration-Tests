import { expect, test } from '@playwright/test';

/** RNF-03: las tareas principales se completan en un máximo de 3 pasos. */
export const MAXIMO_PASOS = 3;

/**
 * Cuenta los pasos de una tarea principal con la definición del RE 1.2: un paso es cada pantalla
 * o acción con la que el usuario confirma una selección o una operación dentro del componente
 * (Continuar, Registrar caso, Guardar, Exportar, Marcar como atendida…). No cuentan los clics ni
 * el llenado de campos dentro de una misma pantalla, el inicio de sesión ni la navegación del
 * SIH.SALUS hasta el componente.
 */
export class Tarea {
  private readonly pasos: string[] = [];

  constructor(readonly nombre: string) {}

  /** Ejecuta la acción con la que el usuario confirma el paso y la registra. */
  async paso<T>(descripcion: string, accion: () => Promise<T>): Promise<T> {
    this.pasos.push(descripcion);
    return accion();
  }

  /** Deja el conteo en el reporte (anotación RNF-03) y verifica el máximo. */
  cerrar(): number {
    const detalle = this.pasos.map((paso, index) => `${index + 1}. ${paso}`).join(' | ');
    test.info().annotations.push({
      type: 'RNF-03',
      description: `${this.nombre}: ${this.pasos.length} paso(s) — ${detalle}`,
    });
    expect(this.pasos.length, `RNF-03 · ${this.nombre}: al menos un paso`).toBeGreaterThan(0);
    expect(this.pasos.length, `RNF-03 · ${this.nombre}: máximo ${MAXIMO_PASOS} pasos`).toBeLessThanOrEqual(
      MAXIMO_PASOS,
    );
    return this.pasos.length;
  }
}
