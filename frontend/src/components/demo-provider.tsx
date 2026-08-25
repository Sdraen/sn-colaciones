"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { initialMenus } from "@/lib/demo-data";
import type {
  ExceptionalRequest,
  ExtraOrder,
  MenuDay,
  Order,
  SideChoice,
} from "@/types/domain";

export interface TrainingGroup {
  id: string;
  dayId: string;
  name: string;
  attendeeCount: number;
  menuOptionId: string;
  side: SideChoice;
  bread: boolean;
  tea: boolean;
  createdAt: string;
}

interface SaveOrderInput {
  dayId: string;
  menuOptionId: string;
  side: SideChoice;
  bread: boolean;
  tea: boolean;
}

interface DemoContextValue {
  userName: string;
  menus: MenuDay[];
  orders: Record<string, Order>;
  extras: ExtraOrder[];
  trainingGroups: TrainingGroup[];
  exceptions: ExceptionalRequest[];
  setUserName: (name: string) => void;
  saveOrder: (input: SaveOrderInput) => void;
  cancelOrder: (dayId: string) => void;
  updateMenuOption: (
    dayId: string,
    optionId: string,
    fields: { description?: string; available?: boolean },
  ) => void;
  addExtra: (input: Omit<ExtraOrder, "id" | "createdAt">) => void;
  addTrainingGroup: (
    input: Omit<TrainingGroup, "id" | "createdAt">,
  ) => void;
  requestException: (
    input: Omit<ExceptionalRequest, "id" | "createdAt" | "status">,
  ) => void;
  resolveException: (
    requestId: string,
    status: "approved" | "rejected",
  ) => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [userName, setUserName] = useState("Usuario demo");
  const [menus, setMenus] = useState<MenuDay[]>(initialMenus);
  const [orders, setOrders] = useState<Record<string, Order>>({});
  const [extras, setExtras] = useState<ExtraOrder[]>([]);
  const [trainingGroups, setTrainingGroups] = useState<TrainingGroup[]>([
    {
      id: "training-demo-1",
      dayId: "2026-08-24",
      name: "Inducción nuevos ingresos",
      attendeeCount: 30,
      menuOptionId: "lun-p1",
      side: "ensalada",
      bread: true,
      tea: false,
      createdAt: "Hoy, 09:10",
    },
  ]);
  const [exceptions, setExceptions] = useState<ExceptionalRequest[]>([
    {
      id: "exception-demo-1",
      dayId: "2026-08-24",
      personLabel: "Visita técnica",
      menuOptionId: "lun-p1",
      reason: "Personal externo informado después del cierre.",
      status: "pending",
      createdAt: "Hoy, 10:18",
    },
  ]);

  const value = useMemo<DemoContextValue>(
    () => ({
      userName,
      menus,
      orders,
      extras,
      trainingGroups,
      exceptions,
      setUserName,
      saveOrder(input) {
        setOrders((current) => ({
          ...current,
          [input.dayId]: {
            id: `order-${input.dayId}`,
            ...input,
            workerName: userName,
            status: "confirmed",
            createdAt: "Ahora",
          },
        }));
      },
      cancelOrder(dayId) {
        setOrders((current) => {
          const next = { ...current };
          delete next[dayId];
          return next;
        });
      },
      updateMenuOption(dayId, optionId, fields) {
        setMenus((current) =>
          current.map((day) =>
            day.id === dayId
              ? {
                  ...day,
                  options: day.options.map((menuOption) =>
                    menuOption.id === optionId
                      ? { ...menuOption, ...fields }
                      : menuOption,
                  ),
                }
              : day,
          ),
        );
      },
      addExtra(input) {
        setExtras((current) => [
          ...current,
          { ...input, id: `extra-${Date.now()}`, createdAt: "Ahora" },
        ]);
      },
      addTrainingGroup(input) {
        setTrainingGroups((current) => [
          ...current,
          { ...input, id: `training-${Date.now()}`, createdAt: "Ahora" },
        ]);
      },
      requestException(input) {
        setExceptions((current) => [
          ...current,
          {
            ...input,
            id: `exception-${Date.now()}`,
            status: "pending",
            createdAt: "Ahora",
          },
        ]);
      },
      resolveException(requestId, status) {
        setExceptions((current) =>
          current.map((request) =>
            request.id === requestId ? { ...request, status } : request,
          ),
        );
      },
    }),
    [exceptions, extras, menus, orders, trainingGroups, userName],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error("useDemo debe utilizarse dentro de DemoProvider");
  }
  return context;
}
