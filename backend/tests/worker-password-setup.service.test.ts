import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  createWorkerAccount,
  sendWorkerPasswordSetupEmail,
} from "../src/services/worker-admin.service.js";
import type { Database } from "../src/types/database.js";

const organizationId = "00000000-0000-4000-8000-000000000001";
const authUserId = "00000000-0000-4000-8000-000000000002";
const dinerId = "00000000-0000-4000-8000-000000000003";
const redirectTo = "https://colaciones.example.cl/auth/activar";

describe("acceso con contraseña de trabajadores", () => {
  it("crea el usuario mediante invitación y nunca asigna una contraseña administrativa", async () => {
    const inviteUserByEmail = vi.fn().mockResolvedValue({
      data: { user: { id: authUserId } },
      error: null,
    });
    const profileInsert = vi.fn().mockResolvedValue({ error: null });
    const dinerInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: { id: dinerId }, error: null }),
      })),
    }));
    const admin = {
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: null }),
          inviteUserByEmail,
          deleteUser: vi.fn(),
        },
      },
      from: vi.fn((table: string) => {
        if (table === "profiles") return { insert: profileInsert };
        if (table === "diners") return { insert: dinerInsert };
        throw new Error(`Tabla inesperada: ${table}`);
      }),
    } as unknown as SupabaseClient<Database>;

    const worker = await createWorkerAccount(admin, organizationId, {
      email: " Trabajador@Empresa.cl ",
      fullName: "Trabajador Prueba",
      passwordSetupRedirectTo: redirectTo,
    });

    expect(inviteUserByEmail).toHaveBeenCalledWith(
      "trabajador@empresa.cl",
      expect.objectContaining({
        redirectTo,
        data: { full_name: "Trabajador Prueba", role: "worker" },
      }),
    );
    expect(worker).toMatchObject({
      id: dinerId,
      email: "trabajador@empresa.cl",
      accountCreated: true,
      accessActivated: false,
    });
  });

  it("reenvía la creación de clave sólo al correo vinculado al trabajador", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ data: {}, error: null });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: dinerId, auth_user_id: authUserId, active: true },
      error: null,
    });
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle,
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    const admin = {
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { user: { email: "trabajador@empresa.cl" } },
            error: null,
          }),
        },
        resetPasswordForEmail,
      },
      from: vi.fn(() => query),
    } as unknown as SupabaseClient<Database>;

    const result = await sendWorkerPasswordSetupEmail(
      admin,
      organizationId,
      dinerId,
      redirectTo,
    );

    expect(query.eq).toHaveBeenCalledWith("organization_id", organizationId);
    expect(resetPasswordForEmail).toHaveBeenCalledWith(
      "trabajador@empresa.cl",
      { redirectTo },
    );
    expect(result).toEqual({ email: "trabajador@empresa.cl" });
  });
});
