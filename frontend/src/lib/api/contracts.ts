export type SideChoice = "ensalada" | "postre" | "ninguno";
export type OrderKind = "regular" | "training" | "extra" | "exceptional";

export interface MenuOptionDto { id: string; category: string; label: string; description: string; dessert: string | null; beverage: string | null; notes: string | null; capacity: number | null; capacityUpdatedAt: string | null; trainingMenu: boolean; availableForWorkers: boolean; visible: boolean; sortOrder: number; }
export interface ServiceDayDto { id: string; serviceDate: string; phase: string; preorderDeadline: string; sameDayOpensAt: string; sameDayClosesAt: string; deliveryClosesAt: string; availabilityPublishedAt: string | null; disabled: boolean; options: MenuOptionDto[]; }
export interface MenuWeekDto { id: string; organizationId: string; startsOn: string; publishedAt: string | null; days: ServiceDayDto[]; }
export interface OrderDto { id: string; serviceDayId: string; menuOptionId: string; dinerId?: string | null; trainingSessionId?: string | null; kind: OrderKind; beneficiaryLabel?: string | null; quantity: number; side: SideChoice; bread: boolean; tea: boolean; status: "confirmed" | "cancelled"; fulfilledAt: string | null; createdAt: string; updatedAt?: string; }
export interface WorkerOrdersDto { menuWeek: MenuWeekDto; orders: OrderDto[]; }
export interface WorkerAccountDto { id: string; fullName: string; employeeCode: string | null; email: string | null; accountCreated: boolean; active: boolean; createdAt: string; }
export interface ExceptionDto { id: string; serviceDayId: string; menuOptionId: string; beneficiaryLabel: string; reason: string; side: SideChoice; bread: boolean; tea: boolean; status: "pending" | "approved" | "rejected"; resolutionNote: string | null; requestedAt: string; resolvedAt: string | null; }
export interface TrainingSessionDto { id: string; name: string; serviceDate: string; expectedAttendees: number; createdAt: string; }
export interface CompanyOperationsDto { menuWeek: { id: string; startsOn: string }; trainingSessions: TrainingSessionDto[]; extraRequests: ExceptionDto[]; orders: OrderDto[]; calendarBlocks: Array<{ id: string; startsOn: string; endsOn: string; kind: string; reason: string }>; }
export interface ReportTotalsDto { requested: number; confirmed: number; cancelled: number; fulfilled: number; byKind: Record<OrderKind, number>; sides: { salad: number; dessert: number; none: number }; bread: number; tea: number; }
export interface OrdersReportDto { period: "daily" | "weekly" | "monthly"; range: { from: string; to: string }; totals: ReportTotalsDto; days: Array<{ serviceDayId: string; serviceDate: string; totals: ReportTotalsDto; menuBreakdown: Array<{ menuOptionId: string; label: string; description: string; confirmed: number }> }>; generatedAt: string; }
export interface NotificationDto { id: string; channel: "in_app" | "email"; eventType: string; title: string; message: string; relatedEntityType: string | null; relatedEntityId: string | null; deliveredAt: string | null; readAt: string | null; createdAt: string; }
export interface ProviderOrderDto extends OrderDto { beneficiary: { id: string | null; fullName: string; employeeCode: string | null; type: string }; training: { id: string; name: string; expectedAttendees: number } | null; exception: { id: string; reason: string; status: string; resolutionNote: string | null } | null; }
export interface ProviderOperationsDto { menu: MenuWeekDto; extraRequests: ExceptionDto[]; orders: ProviderOrderDto[]; }
export interface DailySummaryDto {
  serviceDate: string;
  state: "in_progress" | "final";
  closesAt: string;
  generatedAt: string;
  disabled: boolean;
  pendingExtraRequests: number;
  totals: {
    colations: number;
    delivered: number;
    byKind: { regular: number; training: number; extra: number };
    sides: { ensalada: number; postre: number; ninguno: number };
    bread: number;
    tea: number;
  };
  menuBreakdown: Array<{ menuOptionId: string; label: string; description: string; quantity: number }>;
  components: Array<{ label: string; quantity: number }>;
  trainingGroups: Array<{ id: string; name: string; quantity: number }>;
  manifest: Array<{
    orderId: string;
    beneficiary: string;
    employeeCode: string | null;
    kind: "regular" | "training" | "extra";
    quantity: number;
    menuLabel: string;
    menuDescription: string;
    dessert: string | null;
    beverage: string | null;
    side: SideChoice;
    bread: boolean;
    tea: boolean;
    fulfilledAt: string | null;
  }>;
}
