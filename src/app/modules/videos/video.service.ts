import { exec } from "child_process";
import path from "path";
import fs from "fs/promises";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

import { VideoModel } from "./video.model";
import crypto from "crypto";
import config from "../../config";

export async function convertToHLS(inputFilePath: string, outputDir: string) {
  await fs.mkdir(outputDir, { recursive: true });

  return new Promise<void>((resolve, reject) => {
    // FFmpeg command for multi-bitrate adaptive HLS
    // 1080p, 720p, 480p, 360p quality with h264 + aac codecs
    const command = `
      ffmpeg -i "${inputFilePath}" -filter_complex "
        [0:v]split=4[v1][v2][v3][v4];
        [v1]scale=w=1920:h=1080:force_original_aspect_ratio=decrease[v1out];
        [v2]scale=w=1280:h=720:force_original_aspect_ratio=decrease[v2out];
        [v3]scale=w=854:h=480:force_original_aspect_ratio=decrease[v3out];
        [v4]scale=w=640:h=360:force_original_aspect_ratio=decrease[v4out]
      " \
      -map "[v1out]" -c:v:0 libx264 -preset veryfast -b:v:0 4000k -maxrate:v:0 4500k -bufsize:v:0 6000k -map a:0 -c:a:0 aac -b:a:0 128k \
      -map "[v2out]" -c:v:1 libx264 -preset veryfast -b:v:1 2500k -maxrate:v:1 2800k -bufsize:v:1 4000k -map a:0 -c:a:1 aac -b:a:1 128k \
      -map "[v3out]" -c:v:2 libx264 -preset veryfast -b:v:2 1200k -maxrate:v:2 1400k -bufsize:v:2 2000k -map a:0 -c:a:2 aac -b:a:2 96k \
      -map "[v4out]" -c:v:3 libx264 -preset veryfast -b:v:3 700k -maxrate:v:3 800k -bufsize:v:3 1000k -map a:0 -c:a:3 aac -b:a:3 64k \
      -f hls \
      -hls_time 6 \
      -hls_playlist_type vod \
      -hls_segment_filename "${outputDir}/%v/fileSequence%d.ts" \
      -master_pl_name "${outputDir}/master.m3u8" \
      -var_stream_map "v:0,a:0 v:1,a:1 v:2,a:2 v:3,a:3" \
      "${outputDir}/%v/prog_index.m3u8"
    `;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error("FFmpeg error:", error);
        return reject(error);
      }
      console.log("FFmpeg done:", stdout, stderr);
      resolve();
    });
  });
}
// @ts-ignore
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${config.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.R2_ACCESS_KEY_ID,
    secretAccessKey: config.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

export async function uploadFolderToR2(
  localFolder: string,
  r2FolderKey: string
) {
  const entries = await fs.readdir(localFolder, { withFileTypes: true });
  for (const entry of entries) {
    const localPath = path.join(localFolder, entry.name);
    const r2Key = `${r2FolderKey}/${entry.name}`;

    if (entry.isDirectory()) {
      await uploadFolderToR2(localPath, r2Key);
    } else if (entry.isFile()) {
      const fileContent = await fs.readFile(localPath);
      const putCommand = new PutObjectCommand({
        Bucket: config.R2_BUCKET_NAME,
        Key: r2Key,
        Body: fileContent,
        ContentType: getContentType(entry.name),
      });
      await s3.send(putCommand);
      console.log(`Uploaded ${r2Key}`);
    }
  }
}

function getContentType(filename: string): string {
  if (filename.endsWith(".m3u8")) return "application/x-mpegURL";
  if (filename.endsWith(".ts")) return "video/mp2t";
  return "application/octet-stream";
}

// src/services/video.service.ts

export async function saveVideoMetadata(
  videoId: string,
  r2Path: string,
  title?: string
) {
  const video = new VideoModel({ videoId, r2Path, title });
  await video.save();
  return video;
}

export async function getVideoById(videoId: string) {
  return VideoModel.findOne({ videoId });
}

//

// src/services/security.service.ts

const SECRET = process.env.SIGNED_URL_SECRET || "supersecret";

// Generate signed URL with expiry (e.g. 1 hour)
export function generateSignedUrl(baseUrl: string, expiresInSeconds = 3600) {
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const toSign = `${baseUrl}?expires=${expires}`;
  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(toSign)
    .digest("hex");
  return `${toSign}&signature=${signature}`;
}

// Validate signed URL (used inside Cloudflare Worker or backend)
export function validateSignedUrl(url: URL) {
  const signature = url.searchParams.get("signature");
  const expires = Number(url.searchParams.get("expires"));
  if (!signature || !expires) return false;
  if (expires < Math.floor(Date.now() / 1000)) return false;

  const toSign = `${url.origin}${url.pathname}?expires=${expires}`;
  const expectedSignature = crypto
    .createHmac("sha256", SECRET)
    .update(toSign)
    .digest("hex");

  return signature === expectedSignature;
}
