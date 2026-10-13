import type { ActivityAction, Json } from '@repo/types';
import { Prisma } from '@repo/types/prisma';
import { prisma } from '../../../lib/prisma';

export type InsertActivityInput = {
  workItemId: string;
  actorId: string | null;
  action: ActivityAction;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  meta?: Json | null;
};

export class ActivitiesRepository {
  async insertMany(rows: InsertActivityInput[]): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    await prisma.activities.createMany({
      data: rows.map((row) => ({
        work_item_id: row.workItemId,
        actor_id: row.actorId,
        action: row.action,
        field: row.field ?? null,
        old_value: row.oldValue ?? null,
        new_value: row.newValue ?? null,
        ...(row.meta == null
          ? {}
          : { meta: row.meta as Prisma.InputJsonValue }),
      })),
    });
  }
}
