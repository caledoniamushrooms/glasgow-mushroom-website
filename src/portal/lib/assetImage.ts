const PUBLIC_BASE = `${import.meta.env.PUBLIC_SUPABASE_URL}/storage/v1/object/public/asset-images`;

export function assetImageUrl(storagePath: string): string {
  return `${PUBLIC_BASE}/${storagePath}`;
}
