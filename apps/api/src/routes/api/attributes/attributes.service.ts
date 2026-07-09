import { attributesRepository, DbAttributes } from './attributes.repository';

export class AttributesService {
  async listAttributes(): Promise<DbAttributes[]> {
    return await attributesRepository.listAll();
  }
}

export const attributesService = new AttributesService();
