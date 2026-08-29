import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../errors/app-error.js";
import { throwSupabaseError } from "../lib/supabase-error.js";
import type { Database, SideChoice } from "../types/database.js";
import { getMenuWeek } from "./menu.service.js";

type UserDatabaseClient = SupabaseClient<Database>;

export async function saveRegularOrder(
  supabase: UserDatabaseClient,
  input: {
    serviceDayId: string;
    menuOptionId: string;
    side: SideChoice;
    bread: boolean;
    tea: boolean;
  },
) {
  const { data, error } = await supabase.rpc("save_regular_order", {
    target_service_day_id: input.serviceDayId,
    target_menu_option_id: input.menuOptionId,
    selected_side: input.side,
    include_bread: input.bread,
    include_tea: input.tea,
  });
  if (error) throwSupabaseError(error, "No fue posible guardar el pedido");
  if (!data) throw new AppError("La base de datos no devolvió el pedido", 503, "ORDER_SAVE_EMPTY");
  return serializeOrder(data);
}

export async function cancelRegularOrder(supabase: UserDatabaseClient, orderId: string) {
  const { data, error } = await supabase.rpc("cancel_regular_order", {
    target_order_id: orderId,
  });
  if (error) throwSupabaseError(error, "No fue posible cancelar el pedido");
  if (!data) throw new AppError("No se encontró el pedido", 404, "ORDER_NOT_FOUND");
  return serializeOrder(data);
}

export async function listWorkerOrders(
  supabase: UserDatabaseClient,
  userId: string,
  startsOn?: string,
) {
  const { data: diner, error: dinerError } = await supabase
    .from("diners")
    .select("id")
    .eq("auth_user_id", userId)
    .eq("active", true)
    .maybeSingle();
  if (dinerError) throwSupabaseError(dinerError, "No fue posible consultar al trabajador");
  if (!diner) {
    throw new AppError(
      "El trabajador no tiene un comensal activo asociado",
      422,
      "DINER_NOT_FOUND",
    );
  }

  const menu = await getMenuWeek(supabase, { startsOn, includeDrafts: false });
  const serviceDayIds = menu.days.map((day) => day.id);
  if (serviceDayIds.length === 0) return { menuWeek: menu, orders: [] };

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select(
      "id, service_day_id, menu_option_id, diner_id, kind, quantity, side, bread, tea, status, fulfilled_at, created_at, updated_at",
    )
    .eq("diner_id", diner.id)
    .in("service_day_id", serviceDayIds)
    .order("created_at", { ascending: true });
  if (ordersError) throwSupabaseError(ordersError, "No fue posible consultar los pedidos");

  const optionById = new Map(
    menu.days.flatMap((day) => day.options.map((option) => [option.id, option] as const)),
  );

  return {
    menuWeek: menu,
    orders: orders.map((order) => ({
      ...serializeOrder(order),
      menuOption: optionById.get(order.menu_option_id) ?? null,
    })),
  };
}

type SerializableOrder = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  | "id"
  | "service_day_id"
  | "menu_option_id"
  | "diner_id"
  | "kind"
  | "quantity"
  | "side"
  | "bread"
  | "tea"
  | "status"
  | "fulfilled_at"
  | "created_at"
  | "updated_at"
>;

function serializeOrder(order: SerializableOrder) {
  return {
    id: order.id,
    serviceDayId: order.service_day_id,
    menuOptionId: order.menu_option_id,
    dinerId: order.diner_id,
    kind: order.kind,
    quantity: order.quantity,
    side: order.side,
    bread: order.bread,
    tea: order.tea,
    status: order.status,
    fulfilledAt: order.fulfilled_at,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}
