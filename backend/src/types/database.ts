export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppRole = "worker" | "company_admin" | "provider_admin" | "delivery";
export type MenuCategory =
  | "principal"
  | "vegetariano"
  | "hipocalorico"
  | "sandwich"
  | "handroll"
  | "especial";
export type OrderKind = "regular" | "training" | "extra" | "exceptional";
export type OrderStatus = "confirmed" | "cancelled";
export type SideChoice = "ensalada" | "postre" | "ninguno";

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          timezone: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          timezone?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["organizations"]["Insert"]>;
        Relationships: Relationship[];
      };
      profiles: {
        Row: {
          id: string;
          organization_id: string;
          full_name: string;
          role: AppRole;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          organization_id: string;
          full_name: string;
          role?: AppRole;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: Relationship[];
      };
      audit_events: {
        Row: {
          id: number;
          organization_id: string;
          actor_id: string | null;
          entity_type: string;
          entity_id: string | null;
          action: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: never;
          organization_id: string;
          actor_id?: string | null;
          entity_type: string;
          entity_id?: string | null;
          action: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_events"]["Insert"]>;
        Relationships: Relationship[];
      };
      service_calendar_blocks: {
        Row: {
          id: string;
          organization_id: string;
          starts_on: string;
          ends_on: string;
          kind: "holiday" | "vacation" | "no_service" | "special";
          reason: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          starts_on: string;
          ends_on: string;
          kind: "holiday" | "vacation" | "no_service" | "special";
          reason: string;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["service_calendar_blocks"]["Insert"]>;
        Relationships: Relationship[];
      };
      diners: {
        Row: {
          id: string;
          organization_id: string;
          auth_user_id: string | null;
          full_name: string;
          type: "worker" | "trainee" | "external";
          employee_code: string | null;
          active_from: string | null;
          active_until: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          auth_user_id?: string | null;
          full_name: string;
          type: "worker" | "trainee" | "external";
          employee_code?: string | null;
          active_from?: string | null;
          active_until?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["diners"]["Insert"]>;
        Relationships: Relationship[];
      };
      menu_weeks: {
        Row: {
          id: string;
          organization_id: string;
          starts_on: string;
          published_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          starts_on: string;
          published_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["menu_weeks"]["Insert"]>;
        Relationships: Relationship[];
      };
      service_days: {
        Row: {
          id: string;
          menu_week_id: string;
          service_date: string;
          phase: "draft" | "preorder_open" | "preorder_closed" | "same_day_open" | "closed";
          preorder_deadline: string;
          same_day_opens_at: string;
          same_day_closes_at: string;
          delivery_closes_at: string;
          availability_published_at: string | null;
          disabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          menu_week_id: string;
          service_date: string;
          phase?: "draft" | "preorder_open" | "preorder_closed" | "same_day_open" | "closed";
          preorder_deadline: string;
          same_day_opens_at: string;
          same_day_closes_at: string;
          delivery_closes_at: string;
          availability_published_at?: string | null;
          disabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["service_days"]["Insert"]>;
        Relationships: Relationship[];
      };
      service_delivery_tracking: {
        Row: {
          service_day_id: string;
          organization_id: string;
          arrived_at: string | null;
          arrived_by: string | null;
          delivered_at: string | null;
          delivered_by: string | null;
          receipt_confirmed_at: string | null;
          receipt_confirmed_by: string | null;
          updated_at: string;
        };
        Insert: {
          service_day_id: string;
          organization_id: string;
          arrived_at?: string | null;
          arrived_by?: string | null;
          delivered_at?: string | null;
          delivered_by?: string | null;
          receipt_confirmed_at?: string | null;
          receipt_confirmed_by?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["service_delivery_tracking"]["Insert"]>;
        Relationships: Relationship[];
      };
      menu_options: {
        Row: {
          id: string;
          service_day_id: string;
          category: MenuCategory;
          label: string;
          description: string;
          capacity: number | null;
          capacity_updated_at: string | null;
          available_for_training: boolean;
          available_for_workers: boolean;
          dessert: string | null;
          beverage: string | null;
          notes: string | null;
          visible: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          service_day_id: string;
          category: MenuCategory;
          label: string;
          description: string;
          capacity?: number | null;
          capacity_updated_at?: string | null;
          available_for_training?: boolean;
          available_for_workers?: boolean;
          dessert?: string | null;
          beverage?: string | null;
          notes?: string | null;
          visible?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["menu_options"]["Insert"]>;
        Relationships: Relationship[];
      };
      notifications: {
        Row: {
          id: string;
          organization_id: string;
          recipient_profile_id: string;
          channel: "in_app" | "email";
          event_type: string;
          title: string;
          body: string;
          related_entity_type: string | null;
          related_entity_id: string | null;
          delivered_at: string | null;
          read_at: string | null;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          recipient_profile_id: string;
          channel?: "in_app" | "email";
          event_type: string;
          title: string;
          body: string;
          related_entity_type?: string | null;
          related_entity_id?: string | null;
          delivered_at?: string | null;
          read_at?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: Relationship[];
      };
      training_sessions: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          service_date: string;
          expected_attendees: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          service_date: string;
          expected_attendees: number;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["training_sessions"]["Insert"]>;
        Relationships: Relationship[];
      };
      exception_requests: {
        Row: {
          id: string;
          service_day_id: string;
          menu_option_id: string;
          beneficiary_label: string;
          reason: string;
          side: SideChoice;
          bread: boolean;
          tea: boolean;
          status: "pending" | "approved" | "rejected";
          requested_by: string;
          resolved_by: string | null;
          resolution_note: string | null;
          requested_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          service_day_id: string;
          menu_option_id: string;
          beneficiary_label: string;
          reason: string;
          side?: SideChoice;
          bread?: boolean;
          tea?: boolean;
          status?: "pending" | "approved" | "rejected";
          requested_by: string;
          resolved_by?: string | null;
          resolution_note?: string | null;
          requested_at?: string;
          resolved_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["exception_requests"]["Insert"]>;
        Relationships: Relationship[];
      };
      orders: {
        Row: {
          id: string;
          service_day_id: string;
          menu_option_id: string;
          diner_id: string | null;
          training_session_id: string | null;
          exception_request_id: string | null;
          created_by: string;
          kind: OrderKind;
          beneficiary_label: string | null;
          quantity: number;
          side: SideChoice;
          bread: boolean;
          tea: boolean;
          status: OrderStatus;
          fulfilled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          service_day_id: string;
          menu_option_id: string;
          diner_id?: string | null;
          training_session_id?: string | null;
          exception_request_id?: string | null;
          created_by: string;
          kind: OrderKind;
          beneficiary_label?: string | null;
          quantity?: number;
          side: SideChoice;
          bread?: boolean;
          tea?: boolean;
          status?: OrderStatus;
          fulfilled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
        Relationships: Relationship[];
      };
    };
    Views: Record<string, never>;
    Functions: {
      cancel_regular_order: {
        Args: { target_order_id: string };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      confirm_service_receipt: {
        Args: { target_service_day_id: string };
        Returns: Database["public"]["Tables"]["service_delivery_tracking"]["Row"];
      };
      create_extra_order: {
        Args: {
          target_service_day_id: string;
          target_menu_option_id: string;
          beneficiary_name: string;
          selected_side: SideChoice;
          include_bread: boolean;
          include_tea: boolean;
        };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      create_training_order: {
        Args: {
          target_service_day_id: string;
          target_menu_option_id: string;
          training_name: string;
          attendee_count: number;
          selected_side: SideChoice;
          include_bread: boolean;
          include_tea: boolean;
        };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      mark_order_fulfilled: {
        Args: { target_order_id: string; delivered: boolean };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      request_exceptional_order: {
        Args: {
          target_service_day_id: string;
          target_menu_option_id: string;
          beneficiary_name: string;
          request_reason: string;
          selected_side: SideChoice;
          include_bread: boolean;
          include_tea: boolean;
        };
        Returns: Database["public"]["Tables"]["exception_requests"]["Row"];
      };
      record_delivery_event: {
        Args: { target_service_day_id: string; event_name: "arrived" | "delivered" };
        Returns: Database["public"]["Tables"]["service_delivery_tracking"]["Row"];
      };
      publish_menu_week: {
        Args: { target_menu_week_id: string };
        Returns: Database["public"]["Tables"]["menu_weeks"]["Row"];
      };
      resolve_exception_request: {
        Args: {
          target_exception_id: string;
          decision: "approved" | "rejected";
          rejection_note?: string | null;
        };
        Returns: Database["public"]["Tables"]["exception_requests"]["Row"];
      };
      save_regular_order: {
        Args: {
          target_service_day_id: string;
          target_menu_option_id: string;
          selected_side: SideChoice;
          include_bread: boolean;
          include_tea: boolean;
        };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      save_menu_week_draft: {
        Args: { target_starts_on: string; week_days: Json };
        Returns: Database["public"]["Tables"]["menu_weeks"]["Row"];
      };
      set_menu_option_availability: {
        Args: {
          target_menu_option_id: string;
          informed_capacity: number | null;
          is_visible?: boolean | null;
        };
        Returns: Database["public"]["Tables"]["menu_options"]["Row"];
      };
    };
    Enums: {
      app_role: AppRole;
      menu_category: MenuCategory;
      order_kind: OrderKind;
      order_status: OrderStatus;
      side_choice: SideChoice;
    };
    CompositeTypes: Record<string, never>;
  };
}
