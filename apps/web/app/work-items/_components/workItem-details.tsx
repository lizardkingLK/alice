'use client';

export default function WorkItemDetails({
  workItemId,
}: Readonly<{ workItemId: string }>) {
  return <h1>{workItemId}</h1>;
}
