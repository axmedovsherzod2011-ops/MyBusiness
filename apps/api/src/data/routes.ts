import { Router, type Response } from "express";
import { and, desc, eq, ilike } from "drizzle-orm";
import { db } from "../db/index.js";
import { branches, customers, inventory, orders, orderItems, payments, products, users, warehouses, suppliers, purchases, purchaseItems, routes, visits, promotions, tasks, deliveries, integrations, notifications } from "../db/schema.js";
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


async function companyUser(req: AuthenticatedRequest) { return context(req); }
function bodyString(v: unknown, fallback = "") { return typeof v === "string" && v.trim() ? v.trim() : fallback; }
function bodyNumber(v: unknown, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }

dataRouter.get("/suppliers", async(req,res)=>{try{const u=await companyUser(req);return res.json(await db.select().from(suppliers).where(eq(suppliers.companyId,u.companyId)).orderBy(desc(suppliers.createdAt)));}catch(e){return fail(res,e)}});
dataRouter.post("/suppliers", async(req,res)=>{try{const u=await companyUser(req);const [row]=await db.insert(suppliers).values({companyId:u.companyId,code:bodyString(req.body.code,"SUP-"+Date.now().toString().slice(-6)),name:bodyString(req.body.name,"New supplier"),phone:bodyString(req.body.phone)||null,address:bodyString(req.body.address)||null}).returning();return res.status(201).json(row)}catch(e){return fail(res,e)}});

dataRouter.get("/tasks", async(req,res)=>{try{const u=await companyUser(req);return res.json(await db.select().from(tasks).where(eq(tasks.companyId,u.companyId)).orderBy(desc(tasks.createdAt)));}catch(e){return fail(res,e)}});
dataRouter.post("/tasks", async(req,res)=>{try{const u=await companyUser(req);const [row]=await db.insert(tasks).values({companyId:u.companyId,title:bodyString(req.body.title,"Untitled task"),description:bodyString(req.body.description)||null,priority:req.body.priority||"normal",status:req.body.status||"open",ownerId:bodyString(req.body.ownerId)||null,dueAt:req.body.dueAt?new Date(req.body.dueAt):null}).returning();return res.status(201).json(row)}catch(e){return fail(res,e)}});
dataRouter.patch("/tasks/:id", async(req,res)=>{try{const u=await companyUser(req);const [row]=await db.update(tasks).set({status:req.body.status,priority:req.body.priority,updatedAt:new Date()}).where(and(eq(tasks.id,req.params.id),eq(tasks.companyId,u.companyId))).returning();return res.json(row)}catch(e){return fail(res,e)}});

dataRouter.get("/routes", async(req,res)=>{try{const u=await companyUser(req);return res.json(await db.select().from(routes).where(eq(routes.companyId,u.companyId)).orderBy(desc(routes.routeDate)));}catch(e){return fail(res,e)}});
dataRouter.post("/routes", async(req,res)=>{try{const u=await companyUser(req);const [row]=await db.insert(routes).values({companyId:u.companyId,name:bodyString(req.body.name,"New route"),routeDate:req.body.routeDate?new Date(req.body.routeDate):new Date(),ownerId:bodyString(req.body.ownerId)||null,notes:bodyString(req.body.notes)||null}).returning();return res.status(201).json(row)}catch(e){return fail(res,e)}});
dataRouter.get("/visits", async(req,res)=>{try{const u=await companyUser(req);return res.json(await db.select({id:visits.id,status:visits.status,outcome:visits.outcome,notes:visits.notes,createdAt:visits.createdAt,customer:customers.name}).from(visits).innerJoin(customers,eq(visits.customerId,customers.id)).where(eq(visits.companyId,u.companyId)).orderBy(desc(visits.createdAt)));}catch(e){return fail(res,e)}});
dataRouter.post("/visits", async(req,res)=>{try{const u=await companyUser(req);const [row]=await db.insert(visits).values({companyId:u.companyId,customerId:req.body.customerId,userId:u.id,routeId:bodyString(req.body.routeId)||null,status:req.body.status||"planned",notes:bodyString(req.body.notes)||null}).returning();return res.status(201).json(row)}catch(e){return fail(res,e)}});

dataRouter.get("/promotions", async(req,res)=>{try{const u=await companyUser(req);return res.json(await db.select().from(promotions).where(eq(promotions.companyId,u.companyId)).orderBy(desc(promotions.createdAt)));}catch(e){return fail(res,e)}});
dataRouter.post("/promotions", async(req,res)=>{try{const u=await companyUser(req);const [row]=await db.insert(promotions).values({companyId:u.companyId,name:bodyString(req.body.name,"New promotion"),status:req.body.status||"draft",discount:String(bodyNumber(req.body.discount)),startDate:req.body.startDate?new Date(req.body.startDate):null,endDate:req.body.endDate?new Date(req.body.endDate):null,notes:bodyString(req.body.notes)||null}).returning();return res.status(201).json(row)}catch(e){return fail(res,e)}});

dataRouter.get("/deliveries", async(req,res)=>{try{const u=await companyUser(req);return res.json(await db.select({id:deliveries.id,status:deliveries.status,plannedAt:deliveries.plannedAt,deliveredAt:deliveries.deliveredAt,address:deliveries.address,orderNumber:orders.orderNumber,customer:customers.name}).from(deliveries).innerJoin(orders,eq(deliveries.orderId,orders.id)).innerJoin(customers,eq(orders.customerId,customers.id)).where(eq(deliveries.companyId,u.companyId)).orderBy(desc(deliveries.createdAt)));}catch(e){return fail(res,e)}});
dataRouter.post("/deliveries", async(req,res)=>{try{const u=await companyUser(req);const [row]=await db.insert(deliveries).values({companyId:u.companyId,orderId:req.body.orderId,driverId:bodyString(req.body.driverId)||null,status:req.body.status||"planned",plannedAt:req.body.plannedAt?new Date(req.body.plannedAt):null,address:bodyString(req.body.address)||null,notes:bodyString(req.body.notes)||null}).returning();return res.status(201).json(row)}catch(e){return fail(res,e)}});

dataRouter.get("/integrations", async(req,res)=>{try{const u=await companyUser(req);return res.json(await db.select().from(integrations).where(eq(integrations.companyId,u.companyId)).orderBy(integrations.name));}catch(e){return fail(res,e)}});
dataRouter.post("/integrations", async(req,res)=>{try{const u=await companyUser(req);const [row]=await db.insert(integrations).values({companyId:u.companyId,name:bodyString(req.body.name,"Integration"),provider:bodyString(req.body.provider,"custom"),endpoint:bodyString(req.body.endpoint)||null,status:"disconnected"}).returning();return res.status(201).json(row)}catch(e){return fail(res,e)}});

dataRouter.get("/notifications", async(req,res)=>{try{const u=await companyUser(req);return res.json(await db.select().from(notifications).where(eq(notifications.userId,u.id)).orderBy(desc(notifications.createdAt)).limit(100));}catch(e){return fail(res,e)}});

dataRouter.get("/team", async(req,res)=>{try{const u=await companyUser(req);return res.json(await db.select({id:users.id,fullName:users.fullName,email:users.email,phone:users.phone,status:users.status,createdAt:users.createdAt}).from(users).where(eq(users.companyId,u.companyId)).orderBy(users.fullName));}catch(e){return fail(res,e)}});

dataRouter.get("/finance/summary", async(req,res)=>{try{const u=await companyUser(req);const [os,ps,cs]=await Promise.all([db.select({total:orders.total,status:orders.status}).from(orders).where(eq(orders.companyId,u.companyId)),db.select({amount:payments.amount,status:payments.status}).from(payments).where(eq(payments.companyId,u.companyId)),db.select({creditLimit:customers.creditLimit}).from(customers).where(eq(customers.companyId,u.companyId))]);const sales=os.filter(x=>x.status==="completed").reduce((n,x)=>n+Number(x.total),0);const collected=ps.filter(x=>x.status==="paid").reduce((n,x)=>n+Number(x.amount),0);return res.json({sales,collected,creditLimit:cs.reduce((n,x)=>n+Number(x.creditLimit),0),orders:os.length});}catch(e){return fail(res,e)}});

dataRouter.get("/reports/summary", async(req,res)=>{try{const u=await companyUser(req);const [o,p,i,t,v]=await Promise.all([db.select().from(orders).where(eq(orders.companyId,u.companyId)),db.select().from(products).where(eq(products.companyId,u.companyId)),db.select({quantity:inventory.quantity}).from(inventory).innerJoin(warehouses,eq(inventory.warehouseId,warehouses.id)).where(eq(warehouses.companyId,u.companyId)),db.select({status:tasks.status}).from(tasks).where(eq(tasks.companyId,u.companyId)),db.select({status:visits.status}).from(visits).where(eq(visits.companyId,u.companyId))]);return res.json({orders:o.length,products:p.length,stockUnits:i.reduce((n,x)=>n+Number(x.quantity),0),openTasks:t.filter(x=>x.status!=="completed").length,completedVisits:v.filter(x=>x.status==="completed").length});}catch(e){return fail(res,e)}});

dataRouter.post("/payments",async(req,res)=>{try{const u=await companyUser(req);const [row]=await db.insert(payments).values({companyId:u.companyId,orderId:req.body.orderId,customerId:req.body.customerId,amount:String(bodyNumber(req.body.amount)),method:req.body.method||"other",status:req.body.status||"paid",reference:bodyString(req.body.reference)||null,createdBy:u.id}).returning();return res.status(201).json(row)}catch(e){return fail(res,e)}});

dataRouter.post("/orders",async(req,res)=>{try{const u=await companyUser(req);const [branch]=await db.select().from(branches).where(eq(branches.companyId,u.companyId)).limit(1);const [warehouse]=await db.select().from(warehouses).where(eq(warehouses.companyId,u.companyId)).limit(1);if(!branch||!warehouse) return res.status(400).json({message:"Create a branch and warehouse first."});const existing=await db.select({orderNumber:orders.orderNumber}).from(orders).where(eq(orders.companyId,u.companyId)).orderBy(desc(orders.orderNumber)).limit(1);const n=(existing[0]?.orderNumber||0)+1;const items=Array.isArray(req.body.items)?req.body.items:[];const subtotal=items.reduce((s:any,x:any)=>s+bodyNumber(x.quantity)*bodyNumber(x.unitPrice),0);const discount=bodyNumber(req.body.discount);const [order]=await db.insert(orders).values({companyId:u.companyId,branchId:branch.id,warehouseId:warehouse.id,customerId:req.body.customerId,createdBy:u.id,orderNumber:n,status:req.body.status||"draft",subtotal:String(subtotal),discount:String(discount),total:String(Math.max(0,subtotal-discount)),notes:bodyString(req.body.notes)||null}).returning();if(items.length){await db.insert(orderItems).values(items.map((x:any)=>({orderId:order.id,productId:x.productId,quantity:String(bodyNumber(x.quantity)),unitPrice:String(bodyNumber(x.unitPrice)),discount:String(bodyNumber(x.discount)),total:String(bodyNumber(x.quantity)*bodyNumber(x.unitPrice)-bodyNumber(x.discount))})))}return res.status(201).json(order)}catch(e){return fail(res,e)}});
\nexport default dataRouter;
