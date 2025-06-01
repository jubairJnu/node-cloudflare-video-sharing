// src/app.ts

import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import { VideoRoutes } from "./app/modules/videos/video.controller";

// Load env variables
dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/videos", VideoRoutes);

// Health check route
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

export default app;
