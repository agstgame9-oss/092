import { Router } from "express";
import { db } from "@workspace/db";
import { charactersTable } from "@workspace/db";
import { eq, count, desc, sql } from "drizzle-orm";

const router = Router();

router.get("/characters/rarity-distribution", async (req, res) => {
  try {
    const rows = await db
      .select({ rarity: charactersTable.rarity, count: count() })
      .from(charactersTable)
      .groupBy(charactersTable.rarity);
    res.json(rows.map((r) => ({ rarity: r.rarity, count: r.count })));
  } catch (err) {
    req.log.error({ err }, "Failed to get rarity distribution");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/characters", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const rarity = req.query.rarity as string | undefined;
    const element = req.query.element as string | undefined;
    const offset = (page - 1) * limit;

    const where = rarity
      ? sql`${charactersTable.rarity} = ${rarity}`
      : element
      ? sql`${charactersTable.element1} = ${element} OR ${charactersTable.element2} = ${element}`
      : undefined;

    const [rows, totalResult] = await Promise.all([
      db
        .select({
          id: charactersTable.id,
          name: charactersTable.name,
          animeSource: charactersTable.animeSource,
          rarity: charactersTable.rarity,
          element1: charactersTable.element1,
          element2: charactersTable.element2,
          baseHp: charactersTable.baseHp,
          baseAtk: charactersTable.baseAtk,
          baseDef: charactersTable.baseDef,
          baseSpd: charactersTable.baseSpd,
          isEnabled: charactersTable.isEnabled,
        })
        .from(charactersTable)
        .where(where)
        .orderBy(desc(charactersTable.rarity))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(charactersTable).where(where),
    ]);

    const total = totalResult[0].count;
    res.json({ data: rows, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    req.log.error({ err }, "Failed to get characters");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/characters", async (req, res) => {
  try {
    const { name, animeSource, rarity, element1, element2, baseHp, baseAtk, baseDef, baseSpd } =
      req.body as Record<string, unknown>;

    if (!name || !animeSource || !rarity || !element1) {
      res.status(400).json({ error: "name, animeSource, rarity, element1 are required" });
      return;
    }

    const validRarities = ["D", "C", "B", "A", "S", "SS", "SSS", "SSS+"];
    if (!validRarities.includes(String(rarity))) {
      res.status(400).json({ error: `Invalid rarity. Use: ${validRarities.join(", ")}` });
      return;
    }

    const mult: Record<string, number> = { D: 1, C: 1.2, B: 1.5, A: 2, S: 3, SS: 4, SSS: 5, "SSS+": 7 };
    const m = mult[String(rarity)] ?? 1;
    const hp = Number(baseHp) || Math.floor(500 * m);
    const atk = Number(baseAtk) || Math.floor(100 * m);
    const def = Number(baseDef) || Math.floor(50 * m);
    const spd = Number(baseSpd) || Math.floor(80 + m * 10);
    const charName = String(name);
    const elem = String(element1);

    // Build skills as proper typed objects matching skillSchema / passiveSchema
    const skill1 = {
      name: `${charName.split(" ")[0]} Strike`,
      description: "A powerful elemental attack",
      energyCost: 0, cooldown: 3, damage: 1.4,
      type: "damage" as const, target: "single" as const, element: elem,
    };
    const skill2 = {
      name: `${elem} Burst`,
      description: "Unleashes elemental power",
      energyCost: 30, cooldown: 5, damage: 1.8,
      type: "damage" as const, target: "single" as const, element: elem,
    };
    const skill3 = {
      name: "Ultimate: Multiverse Clash",
      description: "An ultimate attack drawing power from across dimensions",
      energyCost: 80, cooldown: 8, damage: 2.5,
      type: "ultimate" as const, target: "all" as const, element: elem,
    };
    const passive = {
      name: "Battle Instinct",
      description: "Increases crit rate when HP drops below 50%",
      trigger: "hp_below" as const,
      triggerValue: 50,
      effect: { stat: "critRate", value: 0.1 },
    };

    const [char] = await db.insert(charactersTable).values({
      name: charName,
      animeSource: String(animeSource),
      rarity: String(rarity) as "S",
      element1: elem as "Fire",
      element2: element2 ? (String(element2) as "Fire") : null,
      baseHp: hp, baseAtk: atk, baseDef: def, baseSpd: spd,
      baseCrit: 0.07, baseCritDmg: 1.5,
      skill1, skill2, skill3, passive,
      isEnabled: true,
    }).returning();

    res.json(char);
  } catch (err) {
    req.log.error({ err }, "Failed to create character");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/characters/:id/toggle", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [char] = await db.select().from(charactersTable).where(eq(charactersTable.id, id));
    if (!char) { res.status(404).json({ error: "Character not found" }); return; }

    const [updated] = await db.update(charactersTable)
      .set({ isEnabled: !char.isEnabled })
      .where(eq(charactersTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to toggle character");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/characters/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    await db.delete(charactersTable).where(eq(charactersTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete character");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
