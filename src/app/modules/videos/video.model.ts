// src/models/video.model.ts
import { Schema, model } from "mongoose";

const VideoSchema = new Schema({
  videoId: { type: String, required: true, unique: true },
  title: { type: String },
  r2Path: { type: String, required: true }, // ex: videos/{videoId}
  createdAt: { type: Date, default: Date.now },
});

export const VideoModel = model("Video", VideoSchema);
