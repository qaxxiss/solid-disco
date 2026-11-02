import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowUpRight, Check, Circle, Code2, ExternalLink, FolderKanban, Globe2, LayoutDashboard, LockKeyhole, LogOut, Plus, Search, StickyNote, Trash2, X } from "lucide-react";

const API = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");
const icons = { task: Check, project: FolderKanban, note: StickyNote, link: ExternalLink };
const labels = { task: "Tasks", project: "Projects", note: "Notes", link: "Quick links" };

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

export default function App() {
  const [items, setItems] = useState([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [active, setActive] = useState("all");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ type: "task", title: "", description: "", url: "", status: "active" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function refresh() {
    try {
      const [data, auth] = await Promise.all([request("/api/items"), request("/api/auth/me")]);
      setItems(data); setAuthenticated(auth.authenticated);
    } catch (error) { setNotice(error.message); }
  }
  useEffect(() => { refresh(); }, []);
  const visible = useMemo(() => items.filter(item => (active === "all" || item.type === active) && `${item.title} ${item.description}`.toLowerCase().includes(search.toLowerCase())), [items, active, search]);
  const counts = useMemo(() => ({
    all: items.length,
    task: items.filter(x => x.type === "task" && x.status !== "done").length,
    project: items.filter(x => x.type === "project").length,
    note: items.filter(x => x.type === "note").length,
    link: items.filter(x => x.type === "link").length
  }), [items]);

  async function login(event) {
    event.preventDefault(); setBusy(true);
    try { await request("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) }); setAuthenticated(true); setLoginOpen(false); setPassword(""); setNotice("Admin mode enabled."); }
    catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }
  async function logout() {
    try { await request("/api/auth/logout", { method: "POST" }); setAuthenticated(false); setNotice("Signed out."); }
    catch (error) { setNotice(error.message); }
  }
  async function addItem(event) {
    event.preventDefault(); setBusy(true);
    try {
      const created = await request("/api/items", { method: "POST", body: JSON.stringify(form) });
      setItems(old => [created, ...old]); setForm({ type: "task", title: "", description: "", url: "", status: "active" }); setFormOpen(false); setNotice("Item added.");
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }
  async function updateItem(item, patch) {
    try { const updated = await request(`/api/items/${item._id}`, { method: "PATCH", body: JSON.stringify(patch) }); setItems(old => old.map(x => x._id === item._id ? updated : x)); }
    catch (error) { setNotice(error.message); }
  }
  async function deleteItem(item) {
    if (!confirm(`Delete "${item.title}"?`)) return;
    try { await request(`/api/items/${item._id}`, { method: "DELETE" }); setItems(old => old.filter(x => x._id !== item._id)); setNotice("Item deleted."); }
    catch (error) { setNotice(error.message); }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><LayoutDashboard size={21}/></div><div><strong>ControlDeck</strong><span>PERSONAL WORKSPACE</span></div></div>
      <div className="side-label">WORKSPACE</div>
      <button className={active === "all" ? "nav-item selected" : "nav-item"} onClick={() => setActive("all")}><LayoutDashboard size={18}/> Overview <span>{counts.all}</span></button>
      {Object.entries(labels).map(([key, label]) => { const Icon = icons[key]; return <button key={key} className={active === key ? "nav-item selected" : "nav-item"} onClick={() => setActive(key)}><Icon size={18}/>{label}<span>{counts[key]}</span></button>; })}
      <div className="sidebar-bottom"><div className="status-dot"></div><span>Workspace online</span><small>PUBLIC VIEW</small></div>
    </aside>

    <main className="main">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <b>{active === "all" ? "Overview" : labels[active]}</b></div><div className="top-actions"><div className="search-box"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search workspace..."/></div>{authenticated ? <button className="admin-button" onClick={logout}><LogOut size={16}/> Sign out</button> : <button className="admin-button" onClick={() => setLoginOpen(true)}><LockKeyhole size={16}/> Admin</button>}</div></header>

      <section className="welcome"><div><div className="eyebrow"><span className="pulse"></span> YOUR DIGITAL WORKSPACE</div><h1>Good work starts<br/><em>with a clear view.</em></h1><p>A central place to track projects, capture ideas, and keep your work moving.</p></div><div className="welcome-art"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="orbit-core"><Code2 size={35}/></div><div className="orbit-tag tag-one">BUILD</div><div className="orbit-tag tag-two">FOCUS</div></div></section>

      <section className="stats-grid">
        <Stat icon={Check} label="OPEN TASKS" value={counts.task} detail="Items to complete"/>
        <Stat icon={FolderKanban} label="PROJECTS" value={counts.project} detail="In your workspace"/>
        <Stat icon={StickyNote} label="NOTES" value={counts.note} detail="Ideas captured"/>
        <Stat icon={Globe2} label="QUICK LINKS" value={counts.link} detail="Useful destinations"/>
      </section>

      <section className="content-head"><div><div className="eyebrow">YOUR CONTENT</div><h2>{active === "all" ? "Workspace overview" : labels[active]}</h2><p>Keep the important things within reach.</p></div>{authenticated && <button className="primary-button" onClick={() => setFormOpen(true)}><Plus size={17}/> Add new</button>}</section>

      {visible.length === 0 ? <div className="empty-state"><div className="empty-icon"><Activity size={25}/></div><h3>{items.length ? "Nothing matches this view" : "Your workspace is ready"}</h3><p>{items.length ? "Try another search or section." : authenticated ? "Add your first task, project, note, or link." : "This public dashboard has no entries yet."}</p>{authenticated && <button className="primary-button" onClick={() => setFormOpen(true)}><Plus size={16}/> Create first item</button>}</div> :
      <div className="items-grid">{visible.map(item => <article className="item-card" key={item._id}><div className="card-top"><div className={`item-icon ${item.type}`}>{(() => { const Icon = icons[item.type] || Circle; return <Icon size={18}/>; })()}</div><div className="card-meta"><span className="type-label">{item.type}</span><span className={`status ${item.status}`}>{item.status.replace("-", " ")}</span></div>{authenticated && <button className="icon-button delete-button" title="Delete item" onClick={() => deleteItem(item)}><Trash2 size={16}/></button>}</div><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}<div className="card-footer">{item.type === "link" && item.url ? <a href={item.url} target="_blank" rel="noreferrer">Open link <ArrowUpRight size={15}/></a> : <span>{new Date(item.createdAt).toLocaleDateString()}</span>}{authenticated && item.type === "task" && <button className="complete-button" onClick={() => updateItem(item, { status: item.status === "done" ? "active" : "done" })}>{item.status === "done" ? "Reopen" : "Mark done"}</button>}</div></article>)}</div>}

      <footer><span>CONTROLDECK <b>•</b> PERSONAL PRODUCTIVITY</span><span>Built to keep your work in motion.</span></footer>
    </main>

    {loginOpen && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setLoginOpen(false)}><form className="modal" onSubmit={login}><button type="button" className="modal-close" onClick={() => setLoginOpen(false)}><X size={18}/></button><div className="modal-symbol"><LockKeyhole size={22}/></div><div className="eyebrow">RESTRICTED ACCESS</div><h2>Admin sign in</h2><p>Sign in to manage the public workspace.</p><label>Admin password<input autoFocus type="password" value={password} onChange={e => setPassword(e.target.value)} required maxLength={200}/></label><button className="primary-button full" disabled={busy}>{busy ? "Signing in..." : "Continue"}</button></form></div>}

    {formOpen && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setFormOpen(false)}><form className="modal wide" onSubmit={addItem}><button type="button" className="modal-close" onClick={() => setFormOpen(false)}><X size={18}/></button><div className="eyebrow">WORKSPACE EDITOR</div><h2>Add to your workspace</h2><label>Content type<select value={form.type} onChange={e => setForm({...form, type:e.target.value})}>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Title<input value={form.title} onChange={e => setForm({...form, title:e.target.value})} required maxLength={120} placeholder="Give it a clear name"/></label><label>Description<textarea value={form.description} onChange={e => setForm({...form, description:e.target.value})} maxLength={1200} rows={3} placeholder="Add useful context (optional)"/></label>{form.type === "link" && <label>URL<input type="url" value={form.url} onChange={e => setForm({...form, url:e.target.value})} placeholder="https://example.com"/></label>}<label>Status<select value={form.status} onChange={e => setForm({...form, status:e.target.value})}><option value="active">Active</option><option value="planned">Planned</option><option value="in-progress">In progress</option><option value="done">Done</option></select></label><button className="primary-button full" disabled={busy}>{busy ? "Saving..." : "Save item"}</button></form></div>}
    {notice && <button className="toast" onClick={() => setNotice("")}>{notice}<X size={14}/></button>}
  </div>;
}

function Stat({ icon: Icon, label, value, detail }) {
  return <div className="stat-card"><div className="stat-icon"><Icon size={18}/></div><div className="stat-label">{label}</div><strong>{value}</strong><span>{detail}</span></div>;
}
