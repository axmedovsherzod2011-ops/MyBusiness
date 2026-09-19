import { Router, type Response } from "express";
import { and, desc, eq, ilike } from "drizzle-orm";
import { db } from "../db/index.js";
import { branches, customers, inventory, orders, orderItems, payments, products, users, warehouses } from "../db/schema.js";
import { requireFirebaseAuth, type AuthenticatedRequest } from "../auth/middleware.js";

export const dataRouter = Router();
dataRouter.use(requireFirebaseAuth);

async function context(req: AuthenticatedRequest) {
  const u = await db.query.users.findFirst({ where: eq(users.authSubject, req.firebaseUser!.uid) });
  if (!u) throw new Error("USER_NOT_FOUND");
  return u;
}
function fail(res: Response, error: unknown) {
  console.error(error);
  return res.status(500).json({ error: "INTERNAL_ERROR", message: "Could not complete the request." });
}

dataRouter.get("/bootstrap", async (req,res)=>{ try {
  const u=await context(req);
  const [cs,ps,os,bs,ws,py]=await Promise.all([
    db.select().from(customers).where(eq(customers.companyId,u.companyId)).orderBy(desc(customers.createdAt)).limit(100),
    db.select().from(products).where(eq(products.companyId,u.companyId)).orderBy(desc(products.createdAt)).limit(100),
    db.select({id:orders.id,orderNumber:orders.orderNumber,status:orders.status,total:orders.total,createdAt:orders.createdAt,customerName:customers.name}).from(orders).leftJoin(customers,eq(orders.customerId,customers.id)).where(eq(orders.companyId,u.companyId)).orderBy(desc(orders.createdAt)).limit(100),
    db.select().from(branches).where(eq(branches.companyId,u.companyId)).orderBy(branches.name),
    db.select().from(warehouses).where(eq(warehouses.companyId,u.companyId)).orderBy(warehouses.name),
    db.select().from(payments).where(eq(payments.companyId,u.companyId)).orderBy(desc(payments.createdAt)).limit(100)
  ]);
  return res.json({user:u,customers:cs,products:ps,orders:os,branches:bs,warehouses:ws,payments:py});
} catch(e){return fail(res,e);} });

dataRouter.get("/customers",async(req,res)=>{try{const u=await context(req);const q=String(req.query.q??"").trim();const where=q?and(eq(customers.companyId,u.companyId),ilike(customers.name,"%"+q+"%")):eq(customers.companyId,u.companyId);return res.json(await db.select().from(customers).where(where).orderBy(desc(customers.createdAt)));}catch(e){return fail(res,e)}});
dataRouter.post("/customers",async(req,res)=>{try{const u=await context(req);const [row]=await db.insert(customers).values({companyId:u.companyId,code:String(req.body.code||"CUS-"+Date.now().toString().slice(-6)),name:String(req.body.name||"New customer"),phone:req.body.phone||null,address:req.body.address||null,notes:req.body.notes||null,creditLimit:String(req.body.creditLimit||0)}).returning();return res.status(201).json(row)}catch(e){return fail(res,e)}});
dataRouter.patch("/customers/:id",async(req,res)=>{try{const u=await context(req);const [row]=await db.update(customers).set({name:req.body.name,phone:req.body.phone,address:req.body.address,notes:req.body.notes,creditLimit:req.body.creditLimit,updatedAt:new Date()}).where(and(eq(customers.id,req.params.id),eq(customers.companyId,u.companyId))).returning();return res.json(row)}catch(e){return fail(res,e)}});

dataRouter.get("/products",async(req,res)=>{try{const u=await context(req);const q=String(req.query.q??"").trim();const where=q?and(eq(products.companyId,u.companyId),ilike(products.name,"%"+q+"%")):eq(products.companyId,u.companyId);return res.json(await db.select().from(products).where(where).orderBy(desc(products.createdAt)));}catch(e){return fail(res,e)}});
dataRouter.post("/products",async(req,res)=>{try{const u=await context(req);const [row]=await db.insert(products).values({companyId:u.companyId,sku:String(req.body.sku||"SKU-"+Date.now().toString().slice(-6)),name:String(req.body.name||"New product"),unit:String(req.body.unit||"pcs"),barcode:req.body.barcode||null,costPrice:String(req.body.costPrice||0),salePrice:String(req.body.salePrice||0)}).returning();return res.status(201).json(row)}catch(e){return fail(res,e)}});

dataRouter.get("/inventory",async(req,res)=>{try{const u=await context(req);const rows=await db.select({warehouseId:inventory.warehouseId,productId:inventory.productId,quantity:inventory.quantity,warehouse:warehouses.name,product:products.name,sku:products.sku}).from(inventory).innerJoin(warehouses,eq(inventory.warehouseId,warehouses.id)).innerJoin(products,eq(inventory.productId,products.id)).where(eq(warehouses.companyId,u.companyId));return res.json(rows)}catch(e){return fail(res,e)}});

dataRouter.get("/payments",async(req,res)=>{try{const u=await context(req);return res.json(await db.select().from(payments).where(eq(payments.companyId,u.companyId)).orderBy(desc(payments.createdAt)));}catch(e){return fail(res,e)}});

dataRouter.get("/orders",async(req,res)=>{try{const u=await context(req);return res.json(await db.select({id:orders.id,orderNumber:orders.orderNumber,status:orders.status,total:orders.total,subtotal:orders.subtotal,discount:orders.discount,notes:orders.notes,createdAt:orders.createdAt,customer:customers.name}).from(orders).innerJoin(customers,eq(orders.customerId,customers.id)).where(eq(orders.companyId,u.companyId)).orderBy(desc(orders.createdAt)));}catch(e){return fail(res,e)}});

dataRouter.get("/branches",async(req,res)=>{try{const u=await context(req);return res.json(await db.select().from(branches).where(eq(branches.companyId,u.companyId)));}catch(e){return fail(res,e)}});
dataRouter.post("/branches",async(req,res)=>{try{const u=await context(req);const [row]=await db.insert(branches).values({companyId:u.companyId,name:String(req.body.name||"New branch"),code:String(req.body.code||"BR-"+Date.now().toString().slice(-5)),address:req.body.address||null,phone:req.body.phone||null}).returning();return res.status(201).json(row)}catch(e){return fail(res,e)}});
dataRouter.get("/warehouses",async(req,res)=>{try{const u=await context(req);return res.json(await db.select().from(warehouses).where(eq(warehouses.companyId,u.companyId)));}catch(e){return fail(res,e)}});

dataRouter.get("/dashboard",async(req,res)=>{try{
  const u=await context(req);
  const [allOrders,allCustomers,recent]=await Promise.all([
    db.select().from(orders).where(eq(orders.companyId,u.companyId)),
    db.select().from(customers).where(eq(customers.companyId,u.companyId)),
    db.select({id:orders.id,orderNumber:orders.orderNumber,total:orders.total,status:orders.status,customer:customers.name,createdAt:orders.createdAt}).from(orders).innerJoin(customers,eq(orders.customerId,customers.id)).where(eq(orders.companyId,u.companyId)).orderBy(desc(orders.createdAt)).limit(8)
  ]);
  const sales=allOrders.filter(x=>x.status==="completed").reduce((n,x)=>n+Number(x.total),0);
  return res.json({sales,orders:allOrders.length,customers:allCustomers.length,recent});
}catch(e){return fail(res,e)}});

export default dataRouter;
