const express = require("express");
const session = require("express-session");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const STORAGE_DIR = process.env.STORAGE_DIR || path.join(ROOT, "storage");
const DB_DIR = path.join(STORAGE_DIR, "data");
const UPLOAD_DIR = path.join(STORAGE_DIR, "uploads");
fs.mkdirSync(DB_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new Database(path.join(DB_DIR, "library.db"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('movie','series','anime','animation','book')),
    genre TEXT DEFAULT '',
    image TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

const adminPassword = process.env.ADMIN_PASSWORD || "ArslanM_86br";
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH || bcrypt.hashSync(adminPassword, 10);
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, "");
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext || ".jpg"}`);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error("Only image files are allowed."));
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "change-this-session-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", maxAge: 1000 * 60 * 60 * 8 }
}));
app.use("/uploads", express.static(UPLOAD_DIR));
app.use(express.static(path.join(ROOT, "public")));

function publicItem(row) {
  return { ...row, image: row.image ? `/uploads/${row.image}` : "" };
}

function requireAdmin(req, res, next) {
  if (req.session.admin) return next();
  res.status(401).json({ error: "Unauthorized" });
}

app.get("/api/items", (_req, res) => {
  const rows = db.prepare("SELECT * FROM items ORDER BY id DESC").all();
  res.json(rows.map(publicItem));
});

app.get("/api/counts", (_req, res) => {
  const rows = db.prepare("SELECT type, COUNT(*) count FROM items GROUP BY type").all();
  const counts = { all: 0, movie: 0, series: 0, anime: 0, animation: 0, book: 0 };
  for (const r of rows) counts[r.type] = r.count;
  counts.all = Object.values(counts).reduce((a, b) => a + b, 0) - counts.all;
  res.json(counts);
});

app.post("/api/login", (req, res) => {
  const password = String(req.body.password || "");
  if (bcrypt.compareSync(password, adminPasswordHash)) {
    req.session.admin = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: "رمز ورود اشتباه است." });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/me", (req, res) => res.json({ admin: !!req.session.admin }));

app.post("/api/items", requireAdmin, upload.single("image"), (req, res) => {
  const title = String(req.body.title || "").trim();
  const type = String(req.body.type || "");
  const genre = String(req.body.genre || "").trim();

  if (!title || !["movie","series","anime","animation","book"].includes(type)) {
    return res.status(400).json({ error: "عنوان و دسته‌بندی الزامی است." });
  }

  const image = req.file ? req.file.filename : "";
  const info = db.prepare(
    "INSERT INTO items (title, type, genre, image) VALUES (?, ?, ?, ?)"
  ).run(title, type, genre, image);

  res.json({ ok: true, id: info.lastInsertRowid });
});

app.delete("/api/items/:id", requireAdmin, (req, res) => {
  const row = db.prepare("SELECT image FROM items WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "یافت نشد." });
  if (row.image) {
    const file = path.join(UPLOAD_DIR, row.image);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  db.prepare("DELETE FROM items WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message || "خطا" });
});

app.listen(PORT, () => {
  console.log(`ArslanM_86br running at http://localhost:${PORT}`);
});