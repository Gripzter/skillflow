import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSellValue } from "@/lib/inventory-cosmetics";
import type { CaseItemRarity } from "@/lib/cases";

const supabaseAdmin =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
    : null;

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const inventoryRowId = typeof body?.itemId === "string" ? body.itemId : null;
    if (!inventoryRowId) {
      return NextResponse.json({ error: "itemId required" }, { status: 400 });
    }

    const { data: row, error: rowError } = await supabaseAdmin
      .from("player_inventory")
      .select("id, user_id, item_name, rarity, equipped")
      .eq("id", inventoryRowId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (rowError || !row) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (row.equipped) {
      return NextResponse.json({ error: "Unequip item before selling" }, { status: 400 });
    }

    const rarity = row.rarity as CaseItemRarity;
    const skilliesEarned = getSellValue(rarity);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("balance_sp")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) {
      return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
    }

    const newBalance = Number(profile.balance_sp ?? 0) + skilliesEarned;

    const { error: deleteError } = await supabaseAdmin
      .from("player_inventory")
      .delete()
      .eq("id", inventoryRowId)
      .eq("user_id", user.id);
    if (deleteError) {
      return NextResponse.json({ error: "Failed to remove item" }, { status: 500 });
    }

    const { error: balanceError } = await supabaseAdmin
      .from("profiles")
      .update({ balance_sp: newBalance })
      .eq("id", user.id);
    if (balanceError) {
      return NextResponse.json({ error: "Failed to update balance" }, { status: 500 });
    }

    const { error: txError } = await supabaseAdmin.from("sp_transactions").insert({
      user_id: user.id,
      amount: skilliesEarned,
      type: "item_sell",
      description: `Sold ${row.item_name}`,
    });
    if (txError) {
      return NextResponse.json({ error: "Failed to log transaction" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      skilliesEarned,
      newBalance,
      itemName: row.item_name,
    });
  } catch (e) {
    console.error("[inventory/sell]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to sell item" },
      { status: 500 }
    );
  }
}
