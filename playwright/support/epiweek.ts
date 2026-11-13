/**
 * Semana epidemiológica con el calendario del catálogo: semanas de domingo a sábado y primera
 * semana con al menos 4 días del año (la que contiene el 4 de enero).
 */
const DAY = 86_400_000;

const weekStart = (t: number) => t - new Date(t).getUTCDay() * DAY;
const firstWeek = (year: number) => weekStart(Date.UTC(year, 0, 4));

export function epiWeek(isoDate: string): { year: number; week: number } {
  const t = Date.UTC(Number(isoDate.slice(0, 4)), Number(isoDate.slice(5, 7)) - 1, Number(isoDate.slice(8, 10)));
  let year = new Date(t).getUTCFullYear();
  if (t < firstWeek(year)) year--;
  else if (t >= firstWeek(year + 1)) year++;
  return { year, week: Math.floor((weekStart(t) - firstWeek(year)) / (7 * DAY)) + 1 };
}
