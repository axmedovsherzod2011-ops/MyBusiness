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
  description: string;
  price: number;
  imageUrl: string;
  stock: number;
  createdAt: string;
}

export interface CreateProductInput {
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  stock: number;
}

export interface ProductsResponse {
  products: Product[];
}
