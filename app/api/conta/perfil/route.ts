import { NextResponse } from "next/server";
import { getAuthenticatedAccountFromRequest } from "@/lib/auth/account-server";
import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";

export async function PATCH(request: Request) {
  try {
    const account = await getAuthenticatedAccountFromRequest(request);
    if (!account) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const body = (await request.json()) as { nome?: string };
    const nome = body.nome?.trim() ?? "";

    if (nome.length < 2) {
      return NextResponse.json(
        { error: "Informe seu nome completo (mínimo 2 caracteres)." },
        { status: 400 },
      );
    }

    if (nome.length > 120) {
      return NextResponse.json({ error: "Nome muito longo (máximo 120 caracteres)." }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ nome })
      .eq("id", account.userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      profile: { ...account.profile, nome },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar perfil." },
      { status: 500 },
    );
  }
}
