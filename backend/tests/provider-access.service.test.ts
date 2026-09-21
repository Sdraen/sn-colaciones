import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  createProviderAccessAccount,
  sendProviderAccessPasswordSetupEmail,
  setProviderAccessAccountActive,
} from "../src/services/provider-access.service.js";
import { createProviderAccessRequestSchema } from "../src/schemas/provider-access.schema.js";
import type { Database } from "../src/types/database.js";

const organizationId = "00000000-0000-4000-8000-000000000001";
const deliveryUserId = "00000000-0000-4000-8000-000000000002";
const actorId = "00000000-0000-4000-8000-000000000004";
const redirectTo = "https://colaciones.example.cl/auth/activar";

describe("administración de accesos autorizados por la proveedora", () => {
  it("acepta solamente los roles despacho y administradora Securitas", () => {
    const baseRequest = {
      body: { email: "persona@empresa.cl", fullName: "Persona de prueba" },
      params: {},
      query: {},
    };

    expect(createProviderAccessRequestSchema.safeParse({
      ...baseRequest,
      body: { ...baseRequest.body, role: "delivery" },
    }).success).toBe(true);
    expect(createProviderAccessRequestSchema.safeParse({
      ...baseRequest,
      body: { ...baseRequest.body, role: "company_admin" },
    }).success).toBe(true);
    expect(createProviderAccessRequestSchema.safeParse({
      ...baseRequest,
      body: { ...baseRequest.body, role: "provider_admin" },
    }).success).toBe(false);
  });

  it.each([
    ["delivery", "Encargado de despacho"],
    ["company_admin", "Administradora Securitas"],
  ] as const)("crea una cuenta %s mediante invitación y sin contraseña compartida", async (role, fullName) => {
    const inviteUserByEmail = vi.fn().mockResolvedValue({
      data: { user: { id: deliveryUserId } },
      error: null,
    });
    const single = vi.fn().mockResolvedValue({
      data: {
        id: deliveryUserId,
        full_name: fullName,
        role,
        active: true,
        created_at: "2026-09-17T12:00:00.000Z",
      },
      error: null,
    });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const admin = {
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: null }),
          inviteUserByEmail,
          deleteUser: vi.fn(),
        },
      },
      from: vi.fn(() => ({ insert })),
    } as unknown as SupabaseClient<Database>;

    const account = await createProviderAccessAccount(admin, organizationId, {
      email: " Despacho@Empresa.cl ",
      fullName,
      role,
      actorId,
      passwordSetupRedirectTo: redirectTo,
    });

    expect(inviteUserByEmail).toHaveBeenCalledWith(
      "despacho@empresa.cl",
      expect.objectContaining({
        redirectTo,
        data: { full_name: fullName, role },
      }),
    );
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: deliveryUserId,
        organization_id: organizationId,
        role,
      }),
    );
    expect(account).toMatchObject({
      id: deliveryUserId,
      email: "despacho@empresa.cl",
      accessActivated: false,
      role,
    });
  });

  it("reenvía la creación de clave sólo a un acceso administrado de la organización", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ data: {}, error: null });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: deliveryUserId, active: true },
      error: null,
    });
    const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), maybeSingle };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.in.mockReturnValue(query);
    const auditInsert = vi.fn().mockResolvedValue({ error: null });
    const admin = {
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { user: { email: "despacho@empresa.cl" } },
            error: null,
          }),
        },
        resetPasswordForEmail,
      },
      from: vi.fn((table: string) =>
        table === "audit_events" ? { insert: auditInsert } : query,
      ),
    } as unknown as SupabaseClient<Database>;

    const result = await sendProviderAccessPasswordSetupEmail(
      admin,
      organizationId,
      deliveryUserId,
      actorId,
      redirectTo,
    );

    expect(query.eq).toHaveBeenCalledWith("organization_id", organizationId);
    expect(query.in).toHaveBeenCalledWith("role", ["delivery", "company_admin"]);
    expect(resetPasswordForEmail).toHaveBeenCalledWith(
      "despacho@empresa.cl",
      { redirectTo },
    );
    expect(result).toEqual({ email: "despacho@empresa.cl" });
  });

  it("revokes a managed account through the audited RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { id: deliveryUserId, active: false },
      error: null,
    });
    const client = { rpc } as unknown as SupabaseClient<Database>;

    await expect(
      setProviderAccessAccountActive(client, deliveryUserId, false),
    ).resolves.toEqual({ id: deliveryUserId, active: false });
    expect(rpc).toHaveBeenCalledWith("set_provider_access_active", {
      target_profile_id: deliveryUserId,
      is_active: false,
    });
  });
});
