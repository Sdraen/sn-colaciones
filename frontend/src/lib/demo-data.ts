import type { MenuCategory, MenuDay, MenuOption } from "@/types/domain";

function option(
  id: string,
  label: string,
  description: string,
  category: MenuCategory = "principal",
): MenuOption {
  return { id, label, description, category, available: true };
}

export const initialMenus: MenuDay[] = [
  {
    id: "2026-08-24",
    dayName: "Lunes",
    dayShort: "Lun",
    dayNumber: "24",
    dateLabel: "Lunes 24 de agosto",
    cutoffLabel: "Reserva anticipada hasta las 22:00",
    options: [
      option("lun-p1", "Principal 1", "Churrasco con arroz"),
      option("lun-p2", "Principal 2", "Albóndigas en salsa con tallarines"),
      option(
        "lun-veg",
        "Vegetariano",
        "Champiñón salteado, huevo duro y ensaladas",
        "vegetariano",
      ),
      option(
        "lun-hipo",
        "Hipocalórico",
        "Palta rellena con atún y verduras",
        "hipocalorico",
      ),
      option("lun-hand", "Handroll", "Pollo o vegetariano", "handroll"),
    ],
  },
  {
    id: "2026-08-25",
    dayName: "Martes",
    dayShort: "Mar",
    dayNumber: "25",
    dateLabel: "Martes 25 de agosto",
    cutoffLabel: "Reserva anticipada hasta las 22:00",
    options: [
      option("mar-p1", "Principal 1", "Pollo al jugo con papas doradas"),
      option("mar-p2", "Principal 2", "Lentejas con longaniza"),
      option(
        "mar-veg",
        "Vegetariano",
        "Guiso de lentejas con verduras",
        "vegetariano",
      ),
      option(
        "mar-hipo",
        "Hipocalórico",
        "Pechuga a la plancha con ensaladas mixtas",
        "hipocalorico",
      ),
    ],
  },
  {
    id: "2026-08-26",
    dayName: "Miércoles",
    dayShort: "Mié",
    dayNumber: "26",
    dateLabel: "Miércoles 26 de agosto",
    cutoffLabel: "Reserva anticipada hasta las 22:00",
    options: [
      option("mie-p1", "Principal 1", "Carne mongoliana con arroz"),
      option("mie-p2", "Principal 2", "Cazuela de pollo"),
      option("mie-veg", "Vegetariano", "Pastel de verduras", "vegetariano"),
      option(
        "mie-hipo",
        "Hipocalórico",
        "Tortilla de atún con quinoa y ensaladas",
        "hipocalorico",
      ),
      option(
        "mie-sand",
        "Sándwich",
        "Ciabatta de carne mechada",
        "sandwich",
      ),
    ],
  },
  {
    id: "2026-08-27",
    dayName: "Jueves",
    dayShort: "Jue",
    dayNumber: "27",
    dateLabel: "Jueves 27 de agosto",
    cutoffLabel: "Reserva anticipada hasta las 22:00",
    options: [
      option("jue-p1", "Principal 1", "Lomo de cerdo con papas doradas"),
      option(
        "jue-p2",
        "Principal 2",
        "Fetuccini con pollo y salsa de espinaca",
      ),
      option(
        "jue-veg",
        "Vegetariano",
        "Salsa de champiñón con tallarines",
        "vegetariano",
      ),
      option(
        "jue-hipo",
        "Hipocalórico",
        "Palta rellena con atún y mix de ensaladas",
        "hipocalorico",
      ),
    ],
  },
  {
    id: "2026-08-28",
    dayName: "Viernes",
    dayShort: "Vie",
    dayNumber: "28",
    dateLabel: "Viernes 28 de agosto",
    cutoffLabel: "Reserva anticipada hasta las 22:00",
    options: [
      option("vie-p1", "Principal 1", "Pastel de papas"),
      option("vie-p2", "Principal 2", "Carbonada"),
      option(
        "vie-veg",
        "Vegetariano",
        "Hamburguesa de lentejas y verduras",
        "vegetariano",
      ),
      option(
        "vie-hipo",
        "Hipocalórico",
        "Huevo relleno con pasta de ave y cuscús",
        "hipocalorico",
      ),
    ],
  },
  {
    id: "2026-08-29",
    dayName: "Sábado",
    dayShort: "Sáb",
    dayNumber: "29",
    dateLabel: "Sábado 29 de agosto",
    cutoffLabel: "Reserva anticipada hasta las 22:00",
    options: [
      option(
        "sab-p1",
        "Principal",
        "Pechuga de pollo con fideos en salsa blanca",
      ),
      option(
        "sab-hipo",
        "Hipocalórico",
        "Tomate relleno con pollo, verduras y cuscús",
        "hipocalorico",
      ),
    ],
  },
  {
    id: "2026-08-30",
    dayName: "Domingo",
    dayShort: "Dom",
    dayNumber: "30",
    dateLabel: "Domingo 30 de agosto",
    cutoffLabel: "Reserva anticipada hasta las 22:00",
    options: [
      option("dom-p1", "Principal", "Pollo asado con arroz primavera"),
      option(
        "dom-hipo",
        "Hipocalórico",
        "Omelette de verduras con ensalada",
        "hipocalorico",
      ),
    ],
  },
];

export const baseOrderCounts: Record<string, Record<string, number>> = {
  "2026-08-24": {
    "lun-p1": 17,
    "lun-p2": 13,
    "lun-veg": 5,
    "lun-hipo": 8,
    "lun-hand": 12,
  },
  "2026-08-25": {
    "mar-p1": 20,
    "mar-p2": 16,
    "mar-veg": 6,
    "mar-hipo": 10,
  },
};

export const fictionalWorkerCount = 86;
