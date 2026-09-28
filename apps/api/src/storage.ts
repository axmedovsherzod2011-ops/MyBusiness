import { createHash, createHmac, randomUUID } from "node:crypto";

const endpoint = process.env.AWS_ENDPOINT_URL_S3?.replace(/\/$/, "");
const region = process.env.AWS_REGION || "us-east-2";
const accessKey = process.env.AWS_ACCESS_KEY_ID;
const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
const bucket = process.env.PRODUCT_IMAGE_BUCKET || "product-images";

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function signingKey(date: string): Buffer {
  const kDate = hmac("AWS4" + secretKey, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

async function s3Request(method: "PUT" | "DELETE", key: string, body?: Buffer, contentType?: string) {
  if (!endpoint || !accessKey || !secretKey) throw new Error("Object storage is not configured.");
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const shortDate = amzDate.slice(0, 8);
  const payloadHash = sha256(body ?? Buffer.alloc(0));
  const host = new URL(endpoint).host;
  const canonicalUri = "/" + bucket + "/" + encodeKey(key);
  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (contentType) headers["content-type"] = contentType;
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers).sort().map(k => k + ":" + headers[k].trim() + "\n").join("");
  const canonicalRequest = [method, canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = shortDate + "/" + region + "/s3/aws4_request";
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");
  const signature = createHmac("sha256", signingKey(shortDate)).update(stringToSign).digest("hex");
  const authorization = "AWS4-HMAC-SHA256 Credential=" + accessKey + "/" + scope + ", SignedHeaders=" + signedHeaders + ", Signature=" + signature;
  const response = await fetch(endpoint + canonicalUri, {
    method,
    headers: {...headers, Authorization: authorization},
    body: body ? new Uint8Array(body) : undefined,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error("Object storage request failed (" + response.status + ")" + (text ? ": " + text.slice(0, 200) : "."));
  }
}

export function publicProductImageUrl(key: string): string {
  if (!endpoint) throw new Error("Object storage is not configured.");
  return endpoint + "/" + bucket + "/" + encodeKey(key);
}

export async function uploadProductImage(body: Buffer, contentType: string): Promise<{key:string;url:string}> {
  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const key = "products/" + randomUUID() + "." + extension;
  await s3Request("PUT", key, body, contentType);
  return {key, url:publicProductImageUrl(key)};
}

export async function deleteProductImageByUrl(url: string): Promise<void> {
  if (!endpoint) return;
  const prefix = endpoint + "/" + bucket + "/";
  if (!url.startsWith(prefix)) return;
  const key = decodeURIComponent(url.slice(prefix.length));
  if (key) await s3Request("DELETE", key);
}
