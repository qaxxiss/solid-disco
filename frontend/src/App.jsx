import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, Check, CheckCircle2, Circle, Code2, ExternalLink,
  FolderKanban, Globe2, LayoutDashboard, LockKeyhole, LogOut, Plus, Search,
  StickyNote, Trash2, X, Pencil, Clock3, ListFilter, Sparkles, RefreshCw
} from "lucide-react";

const API = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");
const icons = { task: Check, project: FolderKanban, note: StickyNote, link: ExternalLink };
const labels = { task: "Tasks", project: "Projects", note: "Notes", link: "Quick links" };
const emptyForm = { type: "task", title: "", description: "", url: "", status: "active" };

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
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  async function refresh() {
    try {
      const [data, auth] = await Promise.all([request("/api/items"), request("/api/auth/me")]);
      setItems(data); setAuthenticated(auth.authenticated);
    } catch (error) { setNotice(error.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);

  const counts = useMemo(() => ({
    all: items.length,
    task: items.filter(x => x.type === "task" && x.status !== "done").length,
    project: items.filter(x => x.type === "project").length,
    note: items.filter(x => x.type === "note").length,
    link: items.filter(x => x.type === "link").length,
    done: items.filter(x => x.status === "done").length
  }), [items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(item =>
      (active === "all" || item.type === active) &&
      (statusFilter === "all" || item.status === statusFilter) &&
      (!q || `${item.title} ${item.description} ${item.type}`.toLowerCase().includes(q))
    ).sort((a, b) => sort === "oldest"
      ? new Date(a.createdAt) - new Date(b.createdAt)
      : sort === "alphabetical" ? a.title.localeCompare(b.title)
      : new Date(b.createdAt) - new Date(a.createdAt));
  }, [items, active, statusFilter, search, sort]);

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
  function openCreate() { setEditing(null); setForm(emptyForm); setFormOpen(true); }
  function openEdit(item) {
    setEditing(item); setForm({ type: item.type, title: item.title, description: item.description || "", url: item.url || "", status: item.status || "active" }); setFormOpen(true);
  }
  async function saveItem(event) {
    event.preventDefault(); setBusy(true);
    try {
      if (editing) {
        const updated = await request(`/api/items/${editing._id}`, { method: "PATCH", body: JSON.stringify({ title: form.title, description: form.description, url: form.url, status: form.status }) });
        setItems(old => old.map(x => x._id === editing._id ? updated : x)); setNotice("Changes saved.");
      } else {
        const created = await request("/api/items", { method: "POST", body: JSON.stringify(form) });
        setItems(old => [created, ...old]); setNotice("Item added.");
      }
      setForm(emptyForm); setEditing(null); setFormOpen(false);
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }
  async function updateItem(item, patch) {
    try { const updated = await request(`/api/items/${item._id}`, { method: "PATCH", body: JSON.stringify(patch) }); setItems(old => old.map(x => x._id === item._id ? updated : x)); setNotice("Task updated."); }
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
      <div className="sidebar-bottom"><div className="status-dot"></div><span>Workspace online</span><small>SYNCED</small></div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div className="breadcrumb">Workspace <span>/</span> <b>{active === "all" ? "Overview" : labels[active]}</b></div>
        <div className="top-actions">
          <div className="search-box"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search anything..." aria-label="Search workspace"/></div>
          <button className="icon-button refresh-button" onClick={refresh} title="Refresh workspace"><RefreshCw size={16}/></button>
          {authenticated ? <button className="admin-button" onClick={logout}><LogOut size={16}/> Sign out</button> : <button className="admin-button" onClick={() => setLoginOpen(true)}><LockKeyhole size={16}/> Admin</button>}
        </div>
      </header>

      <section className="welcome">
        <div className="welcome-copy"><div className="eyebrow"><span className="pulse"></span> YOUR DIGITAL WORKSPACE</div><h1>Make space for<br/><em>meaningful progress.</em></h1><p>Your projects, tasks, notes and useful destinations — organized in one clear view.</p><div className="welcome-meta"><span><Activity size={14}/> {counts.all} workspace items</span><span><CheckCircle2 size={14}/> {counts.done} completed</span></div></div>
        <div className="welcome-art"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="orbit-core"><Code2 size={35}/></div><div className="orbit-tag tag-one">BUILD</div><div className="orbit-tag tag-two">FOCUS</div><div className="spark spark-one"><Sparkles size={15}/></div></div>
      </section>

      <section className="stats-grid">
        <Stat icon={Check} label="OPEN TASKS" value={counts.task} detail="Ready for action" tone="mint"/>
        <Stat icon={FolderKanban} label="PROJECTS" value={counts.project} detail="Things in progress" tone="blue"/>
        <Stat icon={StickyNote} label="NOTES" value={counts.note} detail="Ideas captured" tone="amber"/>
        <Stat icon={Globe2} label="QUICK LINKS" value={counts.link} detail="Useful destinations" tone="violet"/>
      </section>

      <section className="content-head"><div><div className="eyebrow">YOUR CONTENT</div><h2>{active === "all" ? "Workspace overview" : labels[active]}</h2><p>Browse, update and keep everything moving.</p></div>{authenticated && <button className="primary-button" onClick={openCreate}><Plus size={17}/> Add new</button>}</section>

      <section className="filterbar">
        <div className="filter-title"><ListFilter size={15}/> <span>Filter</span></div>
        <div className="filter-pills">{[["all","All"],["active","Active"],["in-progress","In progress"],["planned","Planned"],["done","Done"]].map(([value,label])=><button key={value} className={statusFilter===value?"filter-pill active":"filter-pill"} onClick={()=>setStatusFilter(value)}>{label}{value==="all"&&<span>{items.length}</span>}</button>)}</div>
        <label className="sort-control">Sort <select value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="alphabetical">A to Z</option></select></label>
      </section>

      <div className="results-line"><span>{loading ? "Loading workspace..." : `Showing ${visible.length} of ${items.length} items`}</span><span>{authenticated ? "ADMIN MODE" : "PUBLIC VIEW"}</span></div>
      {loading ? <div className="loading-grid">{[1,2,3].map(n=><div className="skeleton-card" key={n}><i/><i/><i/></div>)}</div> :
      visible.length === 0 ? <div className="empty-state"><div className="empty-icon"><Activity size={25}/></div><h3>{items.length ? "Nothing matches this view" : "Your workspace is ready"}</h3><p>{items.length ? "Try changing your search or filters." : authenticated ? "Add your first task, project, note, or link." : "This public dashboard has no entries yet."}</p>{authenticated && <button className="primary-button" onClick={openCreate}><Plus size={16}/> Create first item</button>}</div> :
      <div className="items-grid">{visible.map(item => <article className="item-card" key={item._id}>
        <div className="card-top"><div className={`item-icon ${item.type}`}>{(() => { const Icon = icons[item.type] || Circle; return <Icon size={18}/>; })()}</div><div className="card-meta"><span className="type-label">{labels[item.type] || item.type}</span><span className={`status ${item.status}`}><i/> {item.status.replace("-", " ")}</span></div>{authenticated && <div className="card-actions"><button className="icon-button" title="Edit item" onClick={()=>openEdit(item)}><Pencil size={14}/></button><button className="icon-button delete-button" title="Delete item" onClick={() => deleteItem(item)}><Trash2 size={15}/></button></div>}</div>
        <h3>{item.title}</h3>{item.description && <p>{item.description}</p>}
        <div className="card-footer">{item.type === "link" && item.url ? <a href={item.url} target="_blank" rel="noreferrer">Visit destination <ArrowUpRight size={15}/></a> : <span><Clock3 size={12}/> {new Date(item.createdAt || item.updatedAt).toLocaleDateString()}</span>}{authenticated && item.type === "task" && <button className="complete-button" onClick={() => updateItem(item, { status: item.status === "done" ? "active" : "done" })}>{item.status === "done" ? "Reopen task" : "Mark complete"} <Check size={13}/></button>}</div>
      </article>)}</div>}

      <footer><span>CONTROLDECK <b>•</b> PERSONAL PRODUCTIVITY</span><span>One workspace. Clearer momentum.</span></footer>
    </main>

    {loginOpen && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setLoginOpen(false)}><form className="modal" onSubmit={login}><button type="button" className="modal-close" onClick={() => setLoginOpen(false)}><X size={18}/></button><div className="modal-symbol"><LockKeyhole size={22}/></div><div className="eyebrow">RESTRICTED ACCESS</div><h2>Welcome back</h2><p>Sign in to manage your ControlDeck workspace.</p><label>Admin password<input autoFocus type="password" value={password} onChange={e => setPassword(e.target.value)} required maxLength={200}/></label><button className="primary-button full" disabled={busy}>{busy ? "Signing in..." : "Unlock workspace"}</button></form></div>}

    {formOpen && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setFormOpen(false)}><form className="modal wide" onSubmit={saveItem}><button type="button" className="modal-close" onClick={() => setFormOpen(false)}><X size={18}/></button><div className="eyebrow">WORKSPACE EDITOR</div><h2>{editing ? "Edit item" : "Add to your workspace"}</h2><p className="modal-intro">{editing ? "Update the details and save your changes." : "Capture something useful and keep it organized."}</p>
      <label>Content type<select value={form.type} onChange={e => setForm({...form, type:e.target.value})} disabled={Boolean(editing)}>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Title<input value={form.title} onChange={e => setForm({...form, title:e.target.value})} required maxLength={120} placeholder="Give it a clear name"/></label>
      <label>Description<textarea value={form.description} onChange={e => setForm({...form, description:e.target.value})} maxLength={1200} rows={4} placeholder="Add useful context, details or next steps..."/></label>
      {form.type === "link" && <label>Destination URL<input type="url" value={form.url} onChange={e => setForm({...form, url:e.target.value})} placeholder="https://example.com" required/></label>}
      <label>Status<select value={form.status} onChange={e => setForm({...form, status:e.target.value})}><option value="active">Active</option><option value="planned">Planned</option><option value="in-progress">In progress</option><option value="done">Done</option></select></label>
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setFormOpen(false)}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Saving..." : editing ? "Save changes" : "Save item"}</button></div>
    </form></div>}
    {notice && <button className="toast" onClick={() => setNotice("")}>{notice}<X size={14}/></button>}
  </div>;
}

function Stat({ icon: Icon, label, value, detail, tone }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={18}/></div><div className="stat-label">{label}</div><strong>{value}</strong><span>{detail}</span></div>;
}
