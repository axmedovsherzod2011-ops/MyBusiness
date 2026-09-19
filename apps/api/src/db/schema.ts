import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userStatus = pgEnum("user_status", ["active", "invited", "suspended"]);
export const orderStatus = pgEnum("order_status", ["draft", "confirmed", "cancelled", "completed"]);
export const paymentMethod = pgEnum("payment_method", ["cash", "card", "transfer", "other"]);
export const paymentStatus = pgEnum("payment_status", ["pending", "paid", "voided"]);

const id = () => uuid("id").defaultRandom().primaryKey();
const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();

export const companies = pgTable("companies", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  legalName: text("legal_name"),
  phone: text("phone"),
  email: text("email"),
  currency: text("currency").notNull().default("UZS"),
  timezone: text("timezone").notNull().default("Asia/Tashkent"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [uniqueIndex("companies_slug_uq").on(table.slug)]);

export const roles = pgTable("roles", {
  id: id(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: createdAt(),
}, (table) => [uniqueIndex("roles_company_name_uq").on(table.companyId, table.name)]);

export const users = pgTable("users", {
  id: id(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  authSubject: text("auth_subject").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  status: userStatus("status").notNull().default("active"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("users_company_auth_subject_uq").on(table.companyId, table.authSubject),
  index("users_company_status_idx").on(table.companyId, table.status),
]);

export const userRoles = pgTable("user_roles", {
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  roleId: uuid("role_id").references(() => roles.id, { onDelete: "cascade" }).notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.roleId] })]);

export const branches = pgTable("branches", {
  id: id(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  address: text("address"),
  phone: text("phone"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("branches_company_code_uq").on(table.companyId, table.code),
  index("branches_company_active_idx").on(table.companyId, table.isActive),
]);

export const warehouses = pgTable("warehouses", {
  id: id(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "restrict" }).notNull(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("warehouses_company_code_uq").on(table.companyId, table.code),
  index("warehouses_branch_idx").on(table.branchId),
]);

export const customers = pgTable("customers", {
  id: id(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  address: text("address"),
  notes: text("notes"),
  creditLimit: numeric("credit_limit", { precision: 18, scale: 2 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("customers_company_code_uq").on(table.companyId, table.code),
  index("customers_company_name_idx").on(table.companyId, table.name),
  index("customers_company_phone_idx").on(table.companyId, table.phone),
]);

export const categories = pgTable("categories", {
  id: id(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  parentId: uuid("parent_id"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [index("categories_company_idx").on(table.companyId)]);

export const products = pgTable("products", {
  id: id(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  sku: text("sku").notNull(),
  barcode: text("barcode"),
  name: text("name").notNull(),
  unit: text("unit").notNull().default("pcs"),
  costPrice: numeric("cost_price", { precision: 18, scale: 2 }).notNull().default("0"),
  salePrice: numeric("sale_price", { precision: 18, scale: 2 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("products_company_sku_uq").on(table.companyId, table.sku),
  index("products_company_name_idx").on(table.companyId, table.name),
  index("products_company_barcode_idx").on(table.companyId, table.barcode),
]);

export const inventory = pgTable("inventory", {
  warehouseId: uuid("warehouse_id").references(() => warehouses.id, { onDelete: "cascade" }).notNull(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "restrict" }).notNull(),
  quantity: numeric("quantity", { precision: 18, scale: 3 }).notNull().default("0"),
  updatedAt: updatedAt(),
}, (table) => [primaryKey({ columns: [table.warehouseId, table.productId] })]);

export const orders = pgTable("orders", {
  id: id(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "restrict" }).notNull(),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id, { onDelete: "restrict" }).notNull(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "restrict" }).notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "restrict" }).notNull(),
  orderNumber: integer("order_number").notNull(),
  status: orderStatus("status").notNull().default("draft"),
  subtotal: numeric("subtotal", { precision: 18, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 18, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 18, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("orders_company_number_uq").on(table.companyId, table.orderNumber),
  index("orders_company_created_idx").on(table.companyId, table.createdAt),
  index("orders_company_customer_idx").on(table.companyId, table.customerId, table.createdAt),
  index("orders_company_status_idx").on(table.companyId, table.status, table.createdAt),
]);

export const orderItems = pgTable("order_items", {
  id: id(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "restrict" }).notNull(),
  quantity: numeric("quantity", { precision: 18, scale: 3 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 18, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 18, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 18, scale: 2 }).notNull(),
}, (table) => [index("order_items_order_idx").on(table.orderId)]);

export const payments = pgTable("payments", {
  id: id(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "restrict" }).notNull(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "restrict" }).notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  method: paymentMethod("method").notNull(),
  status: paymentStatus("status").notNull().default("paid"),
  reference: text("reference"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "restrict" }).notNull(),
  createdAt: createdAt(),
}, (table) => [
  index("payments_company_created_idx").on(table.companyId, table.createdAt),
  index("payments_customer_idx").on(table.customerId, table.createdAt),
]);

export const auditLogs = pgTable("audit_logs", {
  id: id(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  metadata: text("metadata"),
  createdAt: createdAt(),
}, (table) => [
  index("audit_logs_company_created_idx").on(table.companyId, table.createdAt),
  index("audit_logs_entity_idx").on(table.entityType, table.entityId),
]);

export const companyRelations = relations(companies, ({ many }) => ({
  users: many(users),
  roles: many(roles),
  branches: many(branches),
  warehouses: many(warehouses),
  customers: many(customers),
  products: many(products),
  orders: many(orders),
}));

export const orderRelations = relations(orders, ({ one, many }) => ({
  company: one(companies, { fields: [orders.companyId], references: [companies.id] }),
  customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
  branch: one(branches, { fields: [orders.branchId], references: [branches.id] }),
  warehouse: one(warehouses, { fields: [orders.warehouseId], references: [warehouses.id] }),
  creator: one(users, { fields: [orders.createdBy], references: [users.id] }),
  items: many(orderItems),
}));

export const orderItemRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));

export const inventoryRelations = relations(inventory, ({ one }) => ({
  warehouse: one(warehouses, { fields: [inventory.warehouseId], references: [warehouses.id] }),
  product: one(products, { fields: [inventory.productId], references: [products.id] }),
}));

export const databaseHealth = sql`select 1`;
