import { Tables } from '@repo/types';
import { supabase } from '../../../lib/supabase';

export type DbAttributes = Tables<'attributes'>;

export class AttributesRepository {
  async listAll(): Promise<DbAttributes[]> {
    const { data, error } = await supabase
      .from('attributes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('error. failed to list attributes:', error.message);
      throw new Error('Failed to list attributes');
    }

    return data as DbAttributes[];
  }
}

export const attributesRepository = new AttributesRepository();
