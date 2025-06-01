// src/controllers/video.controller.ts
import express from "express";
import path from "path";
import fs from "fs/promises";

import { v4 as uuidv4 } from "uuid";
import { uploadVideo } from "../../middleware/multer.middleware";
import {
  convertToHLS,
  saveVideoMetadata,
  uploadFolderToR2,
} from "./video.service";

const router = express.Router();

router.post("/upload", uploadVideo.single("video"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No video uploaded" });

    const videoId = uuidv4();
    const rawVideoPath = req.file.path;
    const outputDir = path.resolve(`uploads/processed/${videoId}`);

    // 1. FFmpeg convert to HLS adaptive bitrate
    await convertToHLS(rawVideoPath, outputDir);

    // 2. Upload processed folder to R2
    await uploadFolderToR2(outputDir, `videos/${videoId}`);

    // 3. Save metadata in MongoDB
    await saveVideoMetadata(videoId, `videos/${videoId}`, req.body.title);

    // 4. Clean up local files (optional)
    await fs.unlink(rawVideoPath);
    await fs.rm(outputDir, { recursive: true, force: true });

    return res.json({ videoId, message: "Upload and processing complete" });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
