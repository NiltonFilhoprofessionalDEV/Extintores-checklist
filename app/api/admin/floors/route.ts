import { NextResponse } from "next/server";
import {
  countPositionedEquipmentOnFloor,
  extensionForMime,
  getFloorManagerFromRequest,
  publicMapObjectUrl,
  slugifyFloorKey,
  uploadMapImagesToStorage,
} from "@/lib/auth/floor-management-server";
import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";

const MAX_BYTES = 10 * 1024 * 1024;

const FLOOR_SELECT =
  "id,base_id,key,label,sort_order,image_path,image_path_preview,image_width,image_height,needs_position_review,active,created_at,updated_at";

export async function GET(request: Request) {
  try {
    const manager = await getFloorManagerFromRequest(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const supabaseAdmin = getSupabaseAdminClient();
    let { data, error } = await supabaseAdmin
      .from("base_floors")
      .select(FLOOR_SELECT)
      .eq("base_id", manager.base_id)
      .order("sort_order", { ascending: true });

    if (error && /image_path_preview|needs_position_review|active|schema cache|column/i.test(error.message)) {
      const retry = await supabaseAdmin
        .from("base_floors")
        .select("id,base_id,key,label,sort_order,image_path,image_width,image_height,created_at,updated_at")
        .eq("base_id", manager.base_id)
        .order("sort_order", { ascending: true });
      if (!retry.error) {
        data = retry.data as typeof data;
        error = retry.error;
      }
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ floors: data ?? [], base_id: manager.base_id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao listar mapas/setores." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const manager = await getFloorManagerFromRequest(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const form = await request.formData();
    const label = String(form.get("label") ?? "").trim();
    const keyRaw = String(form.get("key") ?? "").trim();
    const sortOrder = Number(form.get("sort_order") ?? 0);
    const imageWidth = Number(form.get("image_width") || 14042);
    const imageHeight = Number(form.get("image_height") || 9934);
    const file = form.get("file");

    if (!label) return NextResponse.json({ error: "Informe o nome do setor/mapa." }, { status: 400 });

    const key = slugifyFloorKey(keyRaw || label);
    if (!key) return NextResponse.json({ error: "Chave do mapa inválida." }, { status: 400 });

    const supabaseAdmin = getSupabaseAdminClient();
    const hasFile = file instanceof File && file.size > 0;

    if (!hasFile) {
      const { data, error } = await supabaseAdmin
        .from("base_floors")
        .insert({
          base_id: manager.base_id,
          key,
          label,
          sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
          image_path: "",
          image_width: Number.isFinite(imageWidth) && imageWidth > 0 ? Math.round(imageWidth) : 14042,
          image_height: Number.isFinite(imageHeight) && imageHeight > 0 ? Math.round(imageHeight) : 9934,
        })
        .select(FLOOR_SELECT)
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true, floor: data });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Imagem maior que 10 MB." }, { status: 400 });
    }

    const ext = extensionForMime(file.type);
    if (!ext) {
      return NextResponse.json({ error: "Use JPG, PNG ou WebP." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadMapImagesToStorage(
      supabaseAdmin,
      manager.base_id,
      key,
      buffer,
      file.type,
    );

    const { data, error } = await supabaseAdmin
      .from("base_floors")
      .insert({
        base_id: manager.base_id,
        key,
        label,
        sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
        image_path: uploaded.image_path,
        image_path_preview: uploaded.image_path_preview,
        image_width: uploaded.image_width,
        image_height: uploaded.image_height,
        needs_position_review: false,
      })
      .select(FLOOR_SELECT)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, floor: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao criar mapa/setor." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const manager = await getFloorManagerFromRequest(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const form = await request.formData();
    const id = String(form.get("id") ?? "").trim();
    if (!id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });

    const supabaseAdmin = getSupabaseAdminClient();
    const { data: current, error: currentError } = await supabaseAdmin
      .from("base_floors")
      .select("id,base_id,key,label,image_path")
      .eq("id", id)
      .eq("base_id", manager.base_id)
      .maybeSingle<{ id: string; base_id: string; key: string; label: string; image_path: string }>();

    if (currentError || !current) {
      return NextResponse.json({ error: "Mapa/setor não encontrado." }, { status: 404 });
    }

    const label = form.has("label") ? String(form.get("label") ?? "").trim() : null;
    const sortOrderRaw = form.get("sort_order");
    const confirmReplace = String(form.get("confirm_replace") ?? "") === "1";
    const updates: Record<string, unknown> = {};
    if (label) updates.label = label;
    if (sortOrderRaw != null && String(sortOrderRaw) !== "") {
      const sortOrder = Number(sortOrderRaw);
      if (Number.isFinite(sortOrder)) updates.sort_order = sortOrder;
    }

    const file = form.get("file");
    if (file instanceof File && file.size > 0) {
      const positionedCount = await countPositionedEquipmentOnFloor(
        supabaseAdmin,
        manager.base_id,
        current.id,
        current.label,
      );

      if (positionedCount > 0 && !confirmReplace) {
        return NextResponse.json(
          {
            error:
              "Esta planta possui equipamentos posicionados. Substituir a imagem pode exigir revisão das posições.",
            needs_position_review: true,
            positioned_count: positionedCount,
          },
          { status: 409 },
        );
      }

      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "Imagem maior que 10 MB." }, { status: 400 });
      }
      const ext = extensionForMime(file.type);
      if (!ext) return NextResponse.json({ error: "Use JPG, PNG ou WebP." }, { status: 400 });

      const buffer = Buffer.from(await file.arrayBuffer());
      const uploaded = await uploadMapImagesToStorage(
        supabaseAdmin,
        manager.base_id,
        current.key,
        buffer,
        file.type,
      );

      updates.image_path = uploaded.image_path;
      updates.image_path_preview = uploaded.image_path_preview;
      updates.image_width = uploaded.image_width;
      updates.image_height = uploaded.image_height;
      if (positionedCount > 0) {
        updates.needs_position_review = true;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("base_floors")
      .update(updates)
      .eq("id", id)
      .eq("base_id", manager.base_id)
      .select(FLOOR_SELECT)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, floor: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar mapa/setor." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const manager = await getFloorManagerFromRequest(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const body = (await request.json()) as { id?: string };
    if (!body.id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });

    const supabaseAdmin = getSupabaseAdminClient();
    const { error } = await supabaseAdmin
      .from("base_floors")
      .delete()
      .eq("id", body.id)
      .eq("base_id", manager.base_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao excluir mapa/setor." },
      { status: 500 },
    );
  }
}
