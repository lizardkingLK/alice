'use client';

import { useState } from 'react';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const uploadFile = async () => {
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/files`,
      {
        method: 'POST',
        body: formData,
      }
    );

    const data = (await response.json()) as { error?: string; path?: string };

    if (!response.ok) {
      setStatus(data.error ?? 'Upload failed');
      return;
    }

    setStatus(`Uploaded: ${data.path ?? 'ok'}`);
  };

  return (
    <div>
      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <button type="button" onClick={uploadFile}>
        Upload
      </button>
      {status ? <p>{status}</p> : null}
    </div>
  );
}
