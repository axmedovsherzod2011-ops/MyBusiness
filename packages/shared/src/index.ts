export interface PlatformInfo {
  name: "Marketplace API";
  version: string;
  release: string;
  status: string;
}

export type SiteRole = "seller" | "customer";

export interface Product {
  id: number;
  name: string;
  sku: string;
  description: string;
  price: number;
  imageUrl: string;
  imageUrls?: string[];
  stock: number;
  createdAt: string;
  promoDiscountPercent?: number | null;
  promoPrice?: number | null;
}

export interface CreateProductInput {
  name: string;
  sku: string;
  description: string;
  price: number;
  imageUrl: string;
  imageUrls?: string[];
  stock: number;
}

export interface ProductsResponse {
  products: Product[];
}
