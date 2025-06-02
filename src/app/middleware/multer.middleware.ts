import multer from "multer";
import path from "path";
import fs from "fs";

const rawDir = "uploads/raw/";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure the directory exists
    fs.mkdirSync(rawDir, { recursive: true });
    cb(null, rawDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

export const uploadVideo = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("video/")) {
      return cb(new Error("Only video files allowed!"));
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 * 1024 }, // 5GB limit
});
