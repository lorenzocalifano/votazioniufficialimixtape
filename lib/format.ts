/** "oggi 23:04", "ieri 21:40", oppure "21/08 19:15" se più vecchio di ieri. */
export function formatRelativeDay(dateIso: string): string {
  const date = new Date(dateIso);
  const now = new Date();

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  const time = date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  if (diffDays === 0) return `oggi ${time}`;
  if (diffDays === 1) return `ieri ${time}`;
  const day = date.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
  return `${day} ${time}`;
}
