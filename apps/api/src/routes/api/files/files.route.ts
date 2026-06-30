import multer from 'multer';
import express, { type Router } from 'express';

import { supabase } from '../../../lib/supabase';

const filesRouter: Router = express.Router();

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES!,
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

  const fileName = `${Date.now()}-${file.originalname}`;

  const { data, error } = await supabase.storage
    .from('jira-files')
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
