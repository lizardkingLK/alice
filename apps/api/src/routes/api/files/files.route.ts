import multer, { Multer } from 'multer';
import express, { type Router } from 'express';

import { supabase } from '../../../lib/supabase';

const filesRouter: Router = express.Router();

const upload: Multer = multer({
  storage: multer.memoryStorage(),
  limits: {
    // eslint-disable-next-line sonarjs/content-length
    fileSize: 10 * 1024 * 1024,
  },
});

filesRouter.post('/', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({
      error: 'error. no file uploaded',
    });
    return;
  }

  console.log(file);

  if (!process.env.STORAGE_BUCKET_NAME) {
    res.status(500).json({
      error: 'error. configuration erorr on server',
    });
    return;
  }

  const fileName = `${Date.now()}-${file.originalname}`;

  const { data, error } = await supabase.storage
    .from(process.env.STORAGE_BUCKET_NAME)
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
    });

  if (error) {
    console.error('error. file upload failed:', error.message);
    res.status(500).json({
      error: 'error. file uploading failed',
    });
    return;
  }

  res.json({
    success: true,
    path: data.path,
  });
});

export default filesRouter;
