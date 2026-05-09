import { supabase } from '@/lib/supabase';

export type PackageRow = {
  id: string;
  name: string;
  description: string | null;
  scroll_points: number;
  price: number | string;
  is_popular: boolean;
  sort_order: number | null;
  status: string;
};

/** Active packages from admin (`public.packages`), ordered for display. */
export async function fetchActivePackages(): Promise<PackageRow[]> {
  const { data, error } = await supabase
    .from('packages')
    .select('id,name,description,scroll_points,price,is_popular,sort_order,status')
    .eq('status', 'active')
    .order('sort_order', { ascending: true });

  if (error) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[packages]', error.message);
    }
    return [];
  }
  return (data ?? []) as PackageRow[];
}
