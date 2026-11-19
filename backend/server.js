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

const starterProjects = [
  { slug: "url-shortener", title: "URL Shortener", description: "Custom short links, optional aliases, seven-day expiry and a hosted Node.js API.", url: "https://github.com/qaxxiss/Url-Shortener", status: "in-progress" },
  { slug: "mydrive", title: "MyDrive", description: "Personal cloud file manager using Google Drive storage and cross-device access.", url: "https://github.com/qaxxiss/My-drive", status: "in-progress" },
  { slug: "controldeck", title: "ControlDeck", description: "Personal productivity and developer workspace for projects, tasks, notes and links.", url: "https://github.com/qaxxiss/solid-disco", status: "in-progress" },
  { slug: "timetable-maker", title: "Timetable Maker", description: "Client-side school timetable generator with conflict handling and PDF export.", url: "", status: "planned" },
  { slug: "krishna-palace", title: "Krishna Palace Hotel Website", description: "Responsive hotel website with a gold visual theme, gallery and property information.", url: "", status: "in-progress" },
  { slug: "two-person-chat", title: "Two-Person Chat App", description: "A private two-user chat application with fixed user paths and persistent messages.", url: "", status: "planned" },
  { slug: "personal-api", title: "Personal Developer API", description: "Reusable public Node.js API intended to support personal tools and experiments.", url: "", status: "planned" },
  { slug: "roblox-account-runner", title: "Roblox Private-Server Runner", description: "Researching a free cloud-compatible way to run a second Roblox account for short sessions.", url: "", status: "planned" },
  { slug: "tell-us-move", title: "Tell-Us-Move", description: "Existing GitHub repository — project details to be filled in.", url: "https://github.com/qaxxiss/Tell-Us-Move", status: "planned" },
  { slug: "potential-octo-fiesta", title: "Potential Octo Fiesta", description: "Existing GitHub repository — project details to be filled in.", url: "https://github.com/qaxxiss/potential-octo-fiesta", status: "planned" }
];
async function seedStarterProjects() {
  for (const project of starterProjects) {
    await Item.updateOne({ type: "project", slug: project.slug }, { $setOnInsert: { ...project, type: "project", priority: "medium" } }, { upsert: true });
  }
  console.log("ControlDeck starter projects checked.");
}

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
    sameSite: isProduction ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 8
  }
}));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false });
const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false });
const requireSameOrigin = (req, res, next) => {
  if (req.get("origin") !== allowedOrigin) return res.status(403).json({ error: "Request origin not allowed." });
  next();
};
const requireAdmin = (req, res, next) => req.session?.admin ? next() : res.status(401).json({ error: "Admin login required." });

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.post("/api/auth/login", requireSameOrigin, loginLimiter, (req, res) => {
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
app.post("/api/auth/logout", requireSameOrigin, (req, res) => req.session.destroy(() => {
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

app.post("/api/items", requireSameOrigin, requireAdmin, writeLimiter, async (req, res, next) => {
  try {
    const { type, title, description = "", url = "", status = "active", priority = "medium", dueDate = null } = req.body || {};
    if (!["task", "project", "note", "link"].includes(type)) return res.status(400).json({ error: "Invalid item type." });
    if (typeof title !== "string" || !title.trim() || title.length > 120) return res.status(400).json({ error: "Title is required (maximum 120 characters)." });
    if (typeof description !== "string" || description.length > 1200) return res.status(400).json({ error: "Description is too long." });
    if (typeof url !== "string" || url.length > 500) return res.status(400).json({ error: "URL is too long." });
    if (!["active", "done", "planned", "in-progress"].includes(status)) return res.status(400).json({ error: "Invalid status." });
    if (!["low", "medium", "high", "urgent"].includes(priority)) return res.status(400).json({ error: "Invalid priority." });
    if (dueDate !== null && dueDate !== "" && Number.isNaN(Date.parse(dueDate))) return res.status(400).json({ error: "Invalid due date." });
    if (type === "link" && url) {
      let parsed;
      try { parsed = new URL(url); } catch { return res.status(400).json({ error: "Enter a valid link URL." }); }
      if (!["http:", "https:"].includes(parsed.protocol)) return res.status(400).json({ error: "Only HTTP and HTTPS links are allowed." });
    }
    const item = await Item.create({ type, title: title.trim(), description: description.trim(), url: url.trim(), status, priority, dueDate: dueDate || null });
    res.status(201).json(item);
  } catch (error) { next(error); }
});

app.patch("/api/items/:id", requireSameOrigin, requireAdmin, writeLimiter, async (req, res, next) => {
  try {
    const allowed = ["title", "description", "url", "status", "priority", "dueDate"];
    const updates = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
    if (!Object.keys(updates).length) return res.status(400).json({ error: "No valid fields supplied." });
    if (updates.title !== undefined && (typeof updates.title !== "string" || !updates.title.trim() || updates.title.length > 120)) return res.status(400).json({ error: "Invalid title." });
    if (updates.description !== undefined && (typeof updates.description !== "string" || updates.description.length > 1200)) return res.status(400).json({ error: "Invalid description." });
    if (updates.status !== undefined && !["active", "done", "planned", "in-progress"].includes(updates.status)) return res.status(400).json({ error: "Invalid status." });
    if (updates.priority !== undefined && !["low", "medium", "high", "urgent"].includes(updates.priority)) return res.status(400).json({ error: "Invalid priority." });
    if (updates.dueDate !== undefined && updates.dueDate !== null && updates.dueDate !== "" && Number.isNaN(Date.parse(updates.dueDate))) return res.status(400).json({ error: "Invalid due date." });
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

app.delete("/api/items/:id", requireSameOrigin, requireAdmin, writeLimiter, async (req, res, next) => {
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
await seedStarterProjects();
app.listen(PORT, () => console.log(`ControlDeck API listening on port ${PORT}`));
