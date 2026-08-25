export type MenuCategory =
  | "principal"
  | "vegetariano"
  | "hipocalorico"
  | "sandwich"
  | "handroll"
  | "especial";

export type SideChoice = "ensalada" | "postre" | "ninguno";

export interface MenuOption {
  id: string;
  category: MenuCategory;
  label: string;
  description: string;
  available: boolean;
}

export interface MenuDay {
  id: string;
  dayName: string;
  dayShort: string;
  dayNumber: string;
  dateLabel: string;
  cutoffLabel: string;
  options: MenuOption[];
}

export interface Order {
  id: string;
  dayId: string;
  workerName: string;
  menuOptionId: string;
  side: SideChoice;
  bread: boolean;
  tea: boolean;
  status: "confirmed" | "cancelled";
  createdAt: string;
}

export interface ExtraOrder {
  id: string;
  dayId: string;
  personLabel: string;
  menuOptionId: string;
  createdAt: string;
}

export interface ExceptionalRequest {
  id: string;
  dayId: string;
  personLabel: string;
  menuOptionId: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}
