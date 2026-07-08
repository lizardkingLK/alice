import AttributesTable from '@/app/attributes/_components/attributes-table';
import { AttributeListRow } from '@/app/attributes/_services/attribute.service';

interface AttributesWorkspaceProps {
  attributes: AttributeListRow[];
}

export default function AttributesWorkspace({
  attributes,
}: Readonly<AttributesWorkspaceProps>) {
  return (
    <>
      <div className="w-full">
        <AttributesTable />
      </div>

      <div className='space-y-6'>
        Attributes Table with {JSON.stringify(attributes, null, 2)} attributes
      </div>
    </>
  );
}
