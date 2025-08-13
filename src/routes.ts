import { Router, Request, Response } from "express";
import { db, mapRowToLead, Lead, LeadStage } from "./db";

type SortField = "createdAt" | "updatedAt" | "value" | "name";
type SortOrder = "asc" | "desc";

const router = Router();

// SSE clients registry
type SseClient = { id: number; res: Response };
const sseClients = new Map<number, SseClient>();
let sseClientSeq = 1;

function sseSend(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const { res } of sseClients.values()) {
    try {
      res.write(payload);
    } catch {
      // ignore broken pipe
    }
  }
}

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const clientId = sseClientSeq++;
  sseClients.set(clientId, { id: clientId, res });
  res.write(`event: connected\ndata: ${JSON.stringify({ id: clientId })}\n\n`);

  req.on("close", () => {
    sseClients.delete(clientId);
  });
});

router.get("/leads", (req, res) => {
  const stage = (req.query.stage as LeadStage | undefined) ?? undefined;
  const q = (req.query.q as string | undefined)?.trim();
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "25"), 10) || 25, 1), 100);
  const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);
  const sort = ((req.query.sort as string) || "createdAt") as SortField;
  const order = ((req.query.order as string) || "desc").toLowerCase() as SortOrder;

  const allowedSort: Record<SortField, string> = {
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    value: "value",
    name: "name",
  };
  const sortCol = allowedSort[sort] ?? "createdAt";
  const orderSql = order === "asc" ? "ASC" : "DESC";

  const where: string[] = [];
  const params: any[] = [];
  if (stage) {
    where.push("stage = ?");
    params.push(stage);
  }
  if (q) {
    where.push("(LOWER(name) LIKE ? OR LOWER(company) LIKE ? OR LOWER(notes) LIKE ?)");
    const like = `%${q.toLowerCase()}%`;
    params.push(like, like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = db
    .prepare(
      `SELECT * FROM leads ${whereSql} ORDER BY ${sortCol} ${orderSql} LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  const items = rows.map(mapRowToLead);
  res.json({ items, count: items.length });
});

router.post("/leads", (req, res) => {
  const { name, company, value, notes } = req.body as {
    name: string;
    company?: string;
    value?: number;
    notes?: string;
  };

  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "name is required" });
  }

  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO leads (name, company, value, notes, stage, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 'OPEN', ?, ?)`
    )
    .run(name, company ?? null, value ?? null, notes ?? null, now, now);

  const row = db.prepare("SELECT * FROM leads WHERE id = ?").get(info.lastInsertRowid as number);
  res.status(201).json(mapRowToLead(row));
});

router.get("/leads/:id", (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM leads WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(mapRowToLead(row));
});

router.patch("/leads/:id", (req, res) => {
  const id = Number(req.params.id);
  const { name, company, value, notes } = req.body as Partial<{
    name: string;
    company: string;
    value: number;
    notes: string;
  }>;

  const existing = db.prepare("SELECT * FROM leads WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "not found" });

  const updates: string[] = [];
  const params: any[] = [];
  if (name !== undefined) {
    updates.push("name = ?");
    params.push(name);
  }
  if (company !== undefined) {
    updates.push("company = ?");
    params.push(company);
  }
  if (value !== undefined) {
    updates.push("value = ?");
    params.push(value);
  }
  if (notes !== undefined) {
    updates.push("notes = ?");
    params.push(notes);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: "no fields to update" });
  }

  updates.push("updatedAt = ?");
  params.push(new Date().toISOString());
  params.push(id);

  db.prepare(`UPDATE leads SET ${updates.join(", ")} WHERE id = ?`).run(...params);
  const row = db.prepare("SELECT * FROM leads WHERE id = ?").get(id);
  res.json(mapRowToLead(row));
});

router.post("/leads/:id/stage", (req, res) => {
  const id = Number(req.params.id);
  const { stage } = req.body as { stage: LeadStage };
  if (!stage || !["OPEN", "WON", "LOST"].includes(stage)) {
    return res.status(400).json({ error: "invalid stage" });
  }

  const existing = db.prepare("SELECT * FROM leads WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "not found" });

  db.prepare("UPDATE leads SET stage = ?, updatedAt = ? WHERE id = ?").run(
    stage,
    new Date().toISOString(),
    id
  );
  const row = db.prepare("SELECT * FROM leads WHERE id = ?").get(id);
  const lead = mapRowToLead(row);
  res.json(lead);

  if (stage === "WON") sseSend("lead:won", lead);
  if (stage === "LOST") sseSend("lead:lost", lead);
});

router.delete("/leads/:id", (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare("DELETE FROM leads WHERE id = ?").run(id);
  if (info.changes === 0) return res.status(404).json({ error: "not found" });
  res.status(204).send();
});

type StatsRow = {
  total: number;
  openCount: number;
  wonCount: number;
  lostCount: number;
  totalValue: number | null;
  wonValue: number | null;
};

router.get("/stats", (_req, res) => {
  const row = (db.prepare(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN stage = 'OPEN' THEN 1 ELSE 0 END) AS openCount,
       SUM(CASE WHEN stage = 'WON' THEN 1 ELSE 0 END) AS wonCount,
       SUM(CASE WHEN stage = 'LOST' THEN 1 ELSE 0 END) AS lostCount,
       SUM(value) AS totalValue,
       SUM(CASE WHEN stage = 'WON' THEN value ELSE 0 END) AS wonValue
     FROM leads`
  ).get() as StatsRow | undefined) ?? {
    total: 0,
    openCount: 0,
    wonCount: 0,
    lostCount: 0,
    totalValue: 0,
    wonValue: 0,
  };

  res.json({
    total: Number(row.total),
    openCount: Number(row.openCount),
    wonCount: Number(row.wonCount),
    lostCount: Number(row.lostCount),
    totalValue: row.totalValue !== null ? Number(row.totalValue) : 0,
    wonValue: row.wonValue !== null ? Number(row.wonValue) : 0,
  });
});

export default router;


