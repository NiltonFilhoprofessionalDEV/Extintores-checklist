import { NextResponse } from "next/server";
import {
  extensionForMime,
  getFloorManagerFromRequest,
  publicMapObjectUrl,
  slugifyFloorKey,
} from "@/lib/auth/floor-management-server";
import { getSupabaseAdminClient } from "@/lib/supabase/server-admin";

const MAX_BYTES = 10 * 1024 * 1024;

export async function GET(request: Request) {
  try {
    const manager = await getFloorManagerFromRequest(request);
    if (!manager) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const supabaseAdmin = getSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from("base_floors")
      .select("id,base_id,key,label,sort_order,image_path,image_width,image_height,created_at,updated_at")
      .eq("base_id", manager.base_id)
      .order("sort_order", { ascending: true });

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
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Envie a imagem do mapa." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Imagem maior que 10 MB." }, { status: 400 });
    }

    const ext = extensionForMime(file.type);
    if (!ext) {
      return NextResponse.json({ error: "Use JPG, PNG ou WebP." }, { status: 400 });
    }

    const key = slugifyFloorKey(keyRaw || label);
    if (!key) return NextResponse.json({ error: "Chave do mapa inválida." }, { status: 400 });

    const supabaseAdmin = getSupabaseAdminClient();
    const objectPath = `${manager.base_id}/${key}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage.from("mapas").upload(objectPath, buffer, {
      contentType: file.type,
      upsert: true,
    });
    if (uploadError) {
      return NextResponse.json(
        {
          error:
            uploadError.message.includes("Bucket not found")
              ? "Bucket 'mapas' não existe. Execute docs/migration_mapas_storage.sql no Supabase."
              : uploadError.message,
        },
        { status: 400 },
      );
    }

    const imagePath = publicMapObjectUrl(objectPath);
    const { data, error } = await supabaseAdmin
      .from("base_floors")
      .insert({
        base_id: manager.base_id,
        key,
        label,
        sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
        image_path: imagePath,
        image_width: Number.isFinite(imageWidth) && imageWidth > 0 ? Math.round(imageWidth) : 14042,
        image_height: Number.isFinite(imageHeight) && imageHeight > 0 ? Math.round(imageHeight) : 9934,
      })
      .select("id,base_id,key,label,sort_order,image_path,image_width,image_height")
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
      .select("id,base_id,key,image_path")
      .eq("id", id)
      .eq("base_id", manager.base_id)
      .maybeSingle<{ id: string; base_id: string; key: string; image_path: string }>();

    if (currentError || !current) {
      return NextResponse.json({ error: "Mapa/setor não encontrado." }, { status: 404 });
    }

    const label = form.has("label") ? String(form.get("label") ?? "").trim() : null;
    const sortOrderRaw = form.get("sort_order");
    const updates: Record<string, unknown> = {};
    if (label) updates.label = label;
    if (sortOrderRaw != null && String(sortOrderRaw) !== "") {
      const sortOrder = Number(sortOrderRaw);
      if (Number.isFinite(sortOrder)) updates.sort_order = sortOrder;
    }

    const file = form.get("file");
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "Imagem maior que 10 MB." }, { status: 400 });
      }
      const ext = extensionForMime(file.type);
      if (!ext) return NextResponse.json({ error: "Use JPG, PNG ou WebP." }, { status: 400 });

      const objectPath = `${manager.base_id}/${current.key}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error: uploadError } = await supabaseAdmin.storage.from("mapas").upload(objectPath, buffer, {
        contentType: file.type,
        upsert: true,
      });
      if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });
      updates.image_path = publicMapObjectUrl(objectPath);

      const imageWidth = Number(form.get("image_width") || 0);
      const imageHeight = Number(form.get("image_height") || 0);
      if (imageWidth > 0) updates.image_width = Math.round(imageWidth);
      if (imageHeight > 0) updates.image_height = Math.round(imageHeight);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("base_floors")
      .update(updates)
      .eq("id", id)
      .eq("base_id", manager.base_id)
      .select("id,base_id,key,label,sort_order,image_path,image_width,image_height")
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
