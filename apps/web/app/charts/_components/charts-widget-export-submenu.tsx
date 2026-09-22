'use client';

import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { Download } from '@repo/ui/lib/icons';
import {
  CHARTS_EXPORT_FORMATS,
  type ChartsExportFormatId,
} from '@/app/charts/_components/charts-sample.data';

type ChartsWidgetExportSubmenuProps = {
  // eslint-disable-next-line no-unused-vars -- export stub
  readonly onExport?: (format: ChartsExportFormatId) => void;
};

export function ChartsWidgetExportSubmenu({
  onExport,
}: Readonly<ChartsWidgetExportSubmenuProps>) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="cursor-pointer gap-2">
        <Download className="size-4" />
        Export
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-44">
        {CHARTS_EXPORT_FORMATS.map((format) => (
          <DropdownMenuItem
            key={format.id}
            className="cursor-pointer"
            onSelect={() => onExport?.(format.id)}
          >
            {format.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
