import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import MongoStore from "connect-mongo";
import rateLimit from "express-rate-limit";
import Item from "./models/Item.js";

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === "production";
const allowedOrigin = process.env.CLIENT_ORIGIN;

for (const key of ["MONGODB_URI", "ADMIN_PASSWORD", "SESSION_SECRET", "CLIENT_ORIGIN"]) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}
if (process.env.SESSION_SECRET.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters.");
if (isProduction) app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || origin === allowedOrigin) return callback(null, true);
    return callback(new Error("Origin not allowed by CORS"));
  },
  credentials: true
}));
app.use(express.json({ limit: "20kb" }));
app.use(session({
  name: "controldeck.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI, collectionName: "sessions" }),
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 8
  }
}));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false });
const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false });
const requireAdmin = (req, res, next) => req.session?.admin ? next() : res.status(401).json({ error: "Admin login required." });

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.post("/api/auth/login", loginLimiter, (req, res) => {
  const { password } = req.body || {};
  if (typeof password !== "string" || password.length > 200 || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Incorrect password." });
  }
  req.session.admin = true;
  return req.session.save(err => {
    if (err) return res.status(500).json({ error: "Could not start admin session." });
    res.json({ authenticated: true });
  });
});

app.get("/api/auth/me", (req, res) => res.json({ authenticated: Boolean(req.session?.admin) }));
app.post("/api/auth/logout", (req, res) => req.session.destroy(() => {
  res.clearCookie("controldeck.sid", { httpOnly: true, secure: isProduction, sameSite: "lax" });
  res.json({ authenticated: false });
}));

app.get("/api/items", async (req, res, next) => {
  try {
    const filter = req.query.type ? { type: req.query.type } : {};
    const items = await Item.find(filter).sort({ createdAt: -1 }).lean();
    res.json(items);
  } catch (error) { next(error); }
});

app.post("/api/items", requireAdmin, writeLimiter, async (req, res, next) => {
  try {
    const { type, title, description = "", url = "", status = "active" } = req.body || {};
    if (!["task", "project", "note", "link"].includes(type)) return res.status(400).json({ error: "Invalid item type." });
    if (typeof title !== "string" || !title.trim() || title.length > 120) return res.status(400).json({ error: "Title is required (maximum 120 characters)." });
    if (typeof description !== "string" || description.length > 1200) return res.status(400).json({ error: "Description is too long." });
    if (typeof url !== "string" || url.length > 500) return res.status(400).json({ error: "URL is too long." });
    if (!["active", "done", "planned", "in-progress"].includes(status)) return res.status(400).json({ error: "Invalid status." });
    if (type === "link" && url) {
      let parsed;
      try { parsed = new URL(url); } catch { return res.status(400).json({ error: "Enter a valid link URL." }); }
      if (!["http:", "https:"].includes(parsed.protocol)) return res.status(400).json({ error: "Only HTTP and HTTPS links are allowed." });
    }
    const item = await Item.create({ type, title: title.trim(), description: description.trim(), url: url.trim(), status });
    res.status(201).json(item);
  } catch (error) { next(error); }
});

app.patch("/api/items/:id", requireAdmin, writeLimiter, async (req, res, next) => {
  try {
    const allowed = ["title", "description", "url", "status"];
    const updates = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
    if (!Object.keys(updates).length) return res.status(400).json({ error: "No valid fields supplied." });
    if (updates.title !== undefined && (typeof updates.title !== "string" || !updates.title.trim() || updates.title.length > 120)) return res.status(400).json({ error: "Invalid title." });
    if (updates.description !== undefined && (typeof updates.description !== "string" || updates.description.length > 1200)) return res.status(400).json({ error: "Invalid description." });
    if (updates.status !== undefined && !["active", "done", "planned", "in-progress"].includes(updates.status)) return res.status(400).json({ error: "Invalid status." });
    if (updates.url !== undefined) {
      if (typeof updates.url !== "string" || updates.url.length > 500) return res.status(400).json({ error: "Invalid URL." });
      if (updates.url) {
        try { if (!["http:", "https:"].includes(new URL(updates.url).protocol)) throw new Error(); }
        catch { return res.status(400).json({ error: "Only valid HTTP and HTTPS URLs are allowed." }); }
      }
    }
    if (updates.title) updates.title = updates.title.trim();
    const item = await Item.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ error: "Item not found." });
    res.json(item);
  } catch (error) { next(error); }
});

app.delete("/api/items/:id", requireAdmin, writeLimiter, async (req, res, next) => {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: "Item not found." });
    res.json({ deleted: true });
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (res.headersSent) return;
  res.status(error.status || 500).json({ error: isProduction ? "Server error." : error.message });
});

await mongoose.connect(process.env.MONGODB_URI);
app.listen(PORT, () => console.log(`ControlDeck API listening on port ${PORT}`));
