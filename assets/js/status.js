// assets/js/logic/status.js
export function zoneStatusFromTasks(tasksForZone = []) {
  const ests = tasksForZone.map(t => String(t.estado || "").toLowerCase());

  if (ests.some(e => e === "en proceso")) return "En proceso";
  if (ests.some(e => e === "pendiente")) return "Pendiente";
  if (ests.some(e => e === "finalizada" || e === "finalizado")) return "Completada";

  return "Pendiente"; // o "Sin tareas" si quieres manejarlo aparte
}
