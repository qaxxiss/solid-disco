import mongoose from "mongoose";

const itemSchema = new mongoose.Schema({
  type: { type: String, enum: ["task", "project", "note", "link"], required: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 1200, default: "" },
  url: { type: String, trim: true, maxlength: 500, default: "" },
  status: { type: String, enum: ["active", "done", "planned", "in-progress"], default: "active" },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model("Item", itemSchema);
