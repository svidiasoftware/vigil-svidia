const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export function getAlertImageUrl(imagePath: string, width?: number) {
  const base = `${SUPABASE_URL}/storage/v1/object/public/alert-images/${imagePath}`;
  if (width) {
    return `${SUPABASE_URL}/storage/v1/render/image/public/alert-images/${imagePath}?width=${width}&resize=contain`;
  }
  return base;
}
