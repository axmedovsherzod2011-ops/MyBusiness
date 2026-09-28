import type { Express, Request, Response } from "express";
import express from "express";
import { deleteProductImageByUrl, uploadProductImage } from "./storage.js";

export function registerUploadRoutes(app: Express): void {
  app.post(
    "/api/v1/uploads/product-image",
    express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "12mb" }),
    async (req: Request, res: Response) => {
      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      const contentTypeHeader = req.headers["content-type"];
      const contentType = (typeof contentTypeHeader === "string" ? contentTypeHeader : "").split(";")[0].toLowerCase();
      if (!body.length) {
        res.status(400).json({ message: "Rasm fayli bo'sh." });
        return;
      }
      if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
        res.status(400).json({ message: "Faqat JPG, PNG yoki WebP rasm qabul qilinadi." });
        return;
      }
      try {
        res.status(201).json({ image: await uploadProductImage(body, contentType) });
      } catch (error) {
        console.error("Product image upload failed", error);
        res.status(503).json({ message: "Rasm storage'ga yuklanmadi." });
      }
    },
  );

  app.delete("/api/v1/uploads/product-image", express.json({ limit: "16kb" }), async (req: Request, res: Response) => {
    const deleteBody = (req.body ?? {}) as Record<string, unknown>;
    const url = typeof deleteBody.url === "string" ? deleteBody.url.trim() : "";
    if (!url) {
      res.status(400).json({ message: "Rasm URL kerak." });
      return;
    }
    try {
      await deleteProductImageByUrl(url);
      res.json({ ok: true });
    } catch (error) {
      console.error("Product image delete failed", error);
      res.status(503).json({ message: "Rasmni storage'dan o'chirib bo'lmadi." });
    }
  });
}
