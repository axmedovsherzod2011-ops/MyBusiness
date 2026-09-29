import type { Express, Request, Response } from "express";
import { initializeDatabase, requireDatabase } from "./db.js";

function toPage(row: Record<string, unknown>) {
  return {
    id: Number(row.id), slug: String(row.slug), title: String(row.title),
    subtitle: String(row.subtitle ?? ""), description: String(row.description ?? ""),
    offerText: String(row.offer_text ?? ""), productIds: Array.isArray(row.product_ids) ? row.product_ids.map(Number) : [],
    active: Boolean(row.active), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    primaryColor: /^#[0-9a-fA-F]{6}$/.test(String(row.primary_color ?? ""))
      ? String(row.primary_color).toLowerCase()
      : "#f4f1f7"
  };
}

export function registerLandingPageRoutes(app: Express): void {
  app.get("/api/v1/landing-pages/:slug", async (req: Request, res: Response) => {
    try {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      await initializeDatabase(); const db = requireDatabase();
      const result = await db.query("SELECT * FROM marketplace_landing_pages WHERE slug=$1 AND active=TRUE", [req.params.slug]);
      if (!result.rowCount) return res.status(404).json({message:"Sahifa topilmadi."});
      res.json({page:toPage(result.rows[0])});
    } catch { res.status(503).json({message:"Sahifani yuklab bo'lmadi."}); }
  });
  app.get("/api/v1/landing-pages/manage", async (_req: Request, res: Response) => {
    try {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0"); await initializeDatabase(); const db=requireDatabase(); const result=await db.query(`
        SELECT lp.*,
          COALESCE((
            SELECT b.primary_color
            FROM marketplace_banners b
            WHERE b.target_type='page'
              AND b.target_value=lp.slug
              AND b.active=TRUE
            ORDER BY b.created_at DESC, b.id DESC
            LIMIT 1
          ), '#f4f1f7') AS primary_color
        FROM marketplace_landing_pages lp
        ORDER BY lp.updated_at DESC, lp.id DESC
      `);
      res.json({pages:result.rows.map(toPage)}); }
    catch { res.status(503).json({message:"Sahifalarni yuklab bo'lmadi."}); }
  });
  app.post("/api/v1/landing-pages", async (req: Request,res: Response)=>{
    const title=typeof req.body?.title==="string"?req.body.title.trim():"";
    const subtitle=typeof req.body?.subtitle==="string"?req.body.subtitle.trim():"";
    const description=typeof req.body?.description==="string"?req.body.description.trim():"";
    const offerText=typeof req.body?.offerText==="string"?req.body.offerText.trim():"";
    const slugRaw=typeof req.body?.slug==="string"?req.body.slug.trim().toLowerCase():"";
    const slug=(slugRaw||title).normalize("NFKD").replace(/[^a-zA-Z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,100);
    const productIds=Array.isArray(req.body?.productIds)?req.body.productIds.map(Number).filter(Number.isInteger):[];
    if(!title||!slug) return res.status(400).json({message:"Sahifa nomi kerak."});
    try {
      await initializeDatabase(); const db=requireDatabase();
      const result=await db.query(`INSERT INTO marketplace_landing_pages (slug,title,subtitle,description,offer_text,product_ids)
        VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,[slug,title,subtitle,description,offerText,productIds]);
      res.status(201).json({page:toPage(result.rows[0])});
    } catch(error:any) {
      if(error?.code==="23505") return res.status(409).json({message:"Bu sahifa slug'i allaqachon mavjud."});
      res.status(500).json({message:"Sahifani saqlab bo'lmadi."});
    }
  });
  app.patch("/api/v1/landing-pages/:id", async (req: Request,res: Response)=>{
    try {
      await initializeDatabase(); const db=requireDatabase();
      const current=await db.query("SELECT * FROM marketplace_landing_pages WHERE id=$1",[req.params.id]);
      if(!current.rowCount) return res.status(404).json({message:"Sahifa topilmadi."});
      const row=current.rows[0];
      const title=typeof req.body?.title==="string"?req.body.title.trim():String(row.title);
      const subtitle=typeof req.body?.subtitle==="string"?req.body.subtitle.trim():String(row.subtitle??"");
      const description=typeof req.body?.description==="string"?req.body.description.trim():String(row.description??"");
      const offerText=typeof req.body?.offerText==="string"?req.body.offerText.trim():String(row.offer_text??"");
      const productIds=Array.isArray(req.body?.productIds)?req.body.productIds.map(Number).filter(Number.isInteger):row.product_ids;
      const active=typeof req.body?.active==="boolean"?req.body.active:Boolean(row.active);
      const result=await db.query(`
        UPDATE marketplace_landing_pages
        SET title=$1,subtitle=$2,description=$3,offer_text=$4,product_ids=$5,active=$6,updated_at=NOW()
        WHERE id=$7
        RETURNING *
      `,[title,subtitle,description,offerText,productIds,active,req.params.id]);
      res.json({page:toPage(result.rows[0])});
    } catch { res.status(500).json({message:"Sahifani yangilab bo'lmadi."}); }
  });
  app.delete("/api/v1/landing-pages/:id", async (req: Request,res: Response)=>{
    try { await initializeDatabase(); const db=requireDatabase(); const result=await db.query("DELETE FROM marketplace_landing_pages WHERE id=$1 RETURNING id",[req.params.id]); if(!result.rowCount)return res.status(404).json({message:"Sahifa topilmadi."}); res.json({ok:true}); }
    catch { res.status(500).json({message:"Sahifani o'chirib bo'lmadi."}); }
  });
}