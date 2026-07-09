import { AttributeListRow } from '@/app/attributes/_services/attribute.service';

interface AttributesTableProps {
  attributes: AttributeListRow[];
}

export default function AttributesTable({
  attributes,
}: Readonly<AttributesTableProps>) {
  return (
    <h1>
      Attributes Table with {JSON.stringify(attributes, null, 2)} attributes
    </h1>
  );
}
