import multer from 'multer';
import { supabase } from '../../../lib/supabase';
import express, { type Router } from 'express';

const filesRouter: Router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Infinity,
  },
});

filesRouter.post('/', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        error: 'error. no file uploaded',
      });
    }

    const fileName = `${Date.now()}-${file.originalname}`;

    const { data, error } = await supabase.storage
      .from('jira-files')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
      });

    if (error) {
      return res.status(500).json(error);
    }

    return res.json({
      success: true,
      path: data.path,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'error. file uploading failed',
    });
  }
});

export default filesRouter;
