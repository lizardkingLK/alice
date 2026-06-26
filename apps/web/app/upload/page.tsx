'use client';

import { useState } from 'react';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);

  const uploadFile = async () => {
    console.log('file----->', file);
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('http://localhost:3001/api/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    console.log(data);
  };
  return (
    <div>
      {' '}
      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <button onClick={uploadFile}> Upload</button>
    </div>
  );
}
