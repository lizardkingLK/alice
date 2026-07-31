-- Add Issue as a leaf work-item type under Task (Epic → Story → Task → Issue).

ALTER TYPE "WorkItemType" ADD VALUE IF NOT EXISTS 'Issue';
