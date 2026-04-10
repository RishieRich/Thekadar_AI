import { useEffect, useRef, useState } from "react";
import "./app.css";
import {
  clearToken,
  createSite,
  createWorker,
  deleteSite,
  deleteWorker,
  downloadInvoice,
  downloadWages,
  getBootstrap,
  getToken,
  importBatch,
  login,
  logout,
  saveCompany,
  setToken,
  sendChat,
  updateAttendance,
  updateSite,
  updateWorker,
} from "./api.js";
import {
  calculateMonthModel,
  createDefaultAttendanceMap,
  formatCurrency,
  monthKeyFromDate,
  monthLabel,
} from "../shared/payroll.js";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "⊞" },
  { id: "setup", label: "Setup", icon: "⚙" },
  { id: "attendance", label: "Attendance", icon: "✔" },
  { id: "payroll", label: "Payroll", icon: "₹" },
  { id: "invoice", label: "Invoice", icon: "≡" },
  { id: "chat", label: "AI Chat", icon: "✉" },
];

const MOBILE_NAV_ITEMS = [
  { id: "dashboard", label: "Home", icon: "⊞" },
  { id: "attendance", label: "Haziri", icon: "✔" },
  { id: "payroll", label: "Tankhwah", icon: "₹" },
  { id: "chat", label: "Chat", icon: "✉" },
];

const ATTENDANCE_CYCLE = ["P", "A", "HD", "OT", "WO"];

const STATUS_LABELS = {
  P: "Present",
  A: "Absent",
  HD: "Half day",
  OT: "Overtime",
  WO: "Weekly off",
  "--": "Future date",
};

const STATUS_HINDI = {
  P: "Haazir",
  A: "Chutti",
  HD: "Aadha din",
  OT: "Overtime",
  WO: "Weekly off",
};

const TAB_HELP = {
  dashboard:
    "Month-to-date view. Present today, wages, invoice values — all live. Mark attendance first from the Haziri tab.",
  setup:
    "Add your business details, sites, and workers here. Quick add is the fastest way to load your full crew.",
  attendance:
    "Daily use: mark today's crew from the Today Board. Month Register shows the full calendar.",
  payroll:
    "Month-to-date wages only. Future dates are excluded until that day arrives.",
  invoice:
    "Live invoice estimate for the current month. Updates as attendance and workers change.",
  chat:
    "AI assistant sees current month, site filter, workers, attendance, payroll, and invoice. Ask in Hindi or English.",
};

const CHAT_SUGGESTIONS = {
  attendance: ["Aaj kitne log aaye?", "Kaun absent hai aaj?", "Sabki haziri dikhao"],
  payroll: ["Sabse zyada tankhwah kisko?", "PF total kitna hai?", "Net payable batao"],
  invoice: ["Invoice total kya hai?", "GST kitna laga?", "Service charge batao"],
  default: ["Aaj kitne log aaye?", "Is mahine ka PF total batao", "Invoice total kya hai?", "Absent workers ki list do", "ESI eligible kaun hain?", "Net payable kitna banega?"],
};

const DEMO_SITE_BLUEPRINTS = [
  { name: "Harbor Green Tower", clientName: "Harbor Green Developers", location: "Vasai East" },
  { name: "Metro Fabrication Yard", clientName: "Metro Infra Works", location: "Taloja MIDC" },
  { name: "Seabird Logistics Hub", clientName: "Seabird Logistics", location: "Bhiwandi" },
];

const DEMO_FIRST_NAMES = [
  "Aakash","Amit","Anil","Arjun","Bhavesh","Chandan","Deepak","Dilip",
  "Ganesh","Imran","Jitendra","Karan","Mahesh","Mukesh","Nilesh","Pankaj",
  "Prakash","Rahul","Rajesh","Rakesh","Rohit","Sanjay","Shivam","Suresh",
];

const DEMO_LAST_NAMES = [
  "Chaudhary","Gaikwad","Jadhav","Kamble","Khan","Kumar",
  "Mishra","Patel","Pawar","Rathod","Sharma","Singh",
];

const DEMO_ROLE_BLUEPRINTS = [
  { role: "Helper", wage: 480 },
  { role: "Welder", wage: 760 },
  { role: "Fitter", wage: 700 },
  { role: "Electrician", wage: 780 },
  { role: "Scaffolder", wage: 620 },
  { role: "Mason", wage: 680 },
];

/* ── Utility helpers ─────────────────────────────── */

function emptySiteForm() {
  return { name: "", clientName: "", location: "" };
}

function emptyWorkerForm() {
  return { name: "", role: "", dailyWage: "", uan: "", esiNumber: "", siteId: "", active: true };
}

function emptyBulkWorkerForm() {
  return { names: "", role: "Helper", dailyWage: "550", siteId: "", active: true };
}

function companyFormFromCompany(company) {
  return {
    businessName: company.businessName || "",
    ownerName: company.ownerName || "",
    phone: company.phone || "",
    email: company.email || "",
    address: company.address || "",
    gstin: company.gstin || "",
    clraLicense: company.clraLicense || "",
    pfRegistration: company.pfRegistration || "",
    esiRegistration: company.esiRegistration || "",
    serviceChargeRate: company.serviceChargeRate ?? 10,
    gstRate: company.gstRate ?? 18,
    pfEmployeeRate: company.pfEmployeeRate ?? 12,
    pfEmployerRate: company.pfEmployerRate ?? 12,
    pfCap: company.pfCap ?? 15000,
    esiEmployeeRate: company.esiEmployeeRate ?? 0.75,
    esiEmployerRate: company.esiEmployerRate ?? 3.25,
    esiThreshold: company.esiThreshold ?? 21000,
    overtimeMultiplier: company.overtimeMultiplier ?? 2,
  };
}

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().split("\n");
  if (lines.length < 2) return [];

  function parseLine(line) {
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (char === "," && !inQuotes) {
        values.push(current.trim()); current = "";
      } else { current += char; }
    }
    values.push(current.trim());
    return values;
  }

  const headers = parseLine(lines[0]).map((h) => h.replace(/^"|"$/g, ""));
  return lines.slice(1).filter((l) => l.trim()).map((line) => {
    const values = parseLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

function matchesSearch(values, query) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return true;
  return values.join(" ").toLowerCase().includes(needle);
}

function parseBulkWorkerNames(text) {
  const seen = new Set();
  return String(text || "").split(/\r?\n|,/).map((n) => n.trim()).filter(Boolean).filter((n) => {
    const key = n.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function nextAttendanceStatus(currentStatus) {
  const idx = ATTENDANCE_CYCLE.indexOf(currentStatus);
  const safe = idx === -1 ? 0 : idx;
  return ATTENDANCE_CYCLE[(safe + 1) % ATTENDANCE_CYCLE.length];
}

function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function handleScrollableKeyDown(event) {
  if (isTypingTarget(event.target)) return;
  const el = event.currentTarget;
  if (!el || typeof el.scrollBy !== "function") return;
  const hStep = 96;
  const vStep = 72;
  if (event.key === "ArrowDown") { el.scrollBy({ top: vStep, behavior: "smooth" }); event.preventDefault(); }
  else if (event.key === "ArrowUp") { el.scrollBy({ top: -vStep, behavior: "smooth" }); event.preventDefault(); }
  else if (event.key === "PageDown") { el.scrollBy({ top: el.clientHeight * 0.9, behavior: "smooth" }); event.preventDefault(); }
  else if (event.key === "PageUp") { el.scrollBy({ top: -el.clientHeight * 0.9, behavior: "smooth" }); event.preventDefault(); }
  else if (event.key === "Home") { el.scrollTo({ top: 0, behavior: "smooth" }); event.preventDefault(); }
  else if (event.key === "End") { el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }); event.preventDefault(); }
  else if (event.key === "ArrowRight") { el.scrollBy({ left: hStep, behavior: "smooth" }); event.preventDefault(); }
  else if (event.key === "ArrowLeft") { el.scrollBy({ left: -hStep, behavior: "smooth" }); event.preventDefault(); }
}

function buildDemoImportPayload(existingSites, existingWorkersCount) {
  const existing = new Set(existingSites.map((s) => s.name.toLowerCase()));
  const extra = DEMO_SITE_BLUEPRINTS.filter((s) => !existing.has(s.name.toLowerCase()));
  const pool = [...existingSites.map((s) => s.name), ...extra.map((s) => s.name)];
  const workers = [];
  let seq = existingWorkersCount + 1;
  for (const fn of DEMO_FIRST_NAMES) {
    for (const ln of DEMO_LAST_NAMES) {
      if (workers.length >= 72) break;
      const rb = DEMO_ROLE_BLUEPRINTS[workers.length % DEMO_ROLE_BLUEPRINTS.length];
      workers.push({ name: `${fn} ${ln}`, role: rb.role, dailyWage: rb.wage,
        uan: `100${String(seq).padStart(9, "0")}`, esiNumber: `310${String(seq).padStart(7, "0")}`,
        siteName: pool[workers.length % pool.length] || "", active: true });
      seq++;
    }
  }
  return { sites: extra, workers };
}

function formatTimeAgo(date) {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min === 1) return "1 minute ago";
  if (min < 60) return `${min} minutes ago`;
  return "a while ago";
}

function formatTime(date) {
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

/* ── Reusable Components ─────────────────────────── */

function Field({ label, children, full = false, hint = "" }) {
  return (
    <div className={`field${full ? " full" : ""}`}>
      <div className="field-label-row">
        <label>{label}</label>
        {hint ? <span className="field-hint">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function MetricCard({ label, value, sub, colorClass = "" }) {
  return (
    <div className={`surface metric-card ${colorClass}`}>
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      <p className="metric-sub">{sub}</p>
    </div>
  );
}

function HelpHint({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <span className={`help-wrap${open ? " help-open" : ""}`}>
      <button className="help-button" type="button" aria-label="Help" onClick={() => setOpen((o) => !o)}>?</button>
      <span className="help-popover">{text}</span>
      {open && <span className="help-backdrop" onClick={() => setOpen(false)} />}
    </span>
  );
}

function SectionHeader({ title, sub, help, actions, eyebrow }) {
  return (
    <div className="section-heading">
      <div className="section-heading-copy">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <div className="section-heading-row">
          <h3 className="section-title">{title}</h3>
          {help ? <HelpHint text={help} /> : null}
        </div>
        {sub ? <p className="section-copy">{sub}</p> : null}
      </div>
      {actions ? <div className="section-actions">{actions}</div> : null}
    </div>
  );
}

function CollapsibleSection({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="collapsible-section">
      <button type="button" className="collapsible-header" onClick={() => setOpen((o) => !o)}>
        <span>{title}</span>
        <span className={`collapsible-chevron${open ? " open" : ""}`}>▼</span>
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}

function ToastContainer({ toasts }) {
  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>{t.message}</div>
      ))}
    </div>
  );
}

/* ── Login Page ─────────────────────────────────── */

function LoginPage({ onLogin }) {
  const [pins, setPins] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  async function handlePinSubmit(fullPin) {
    setLoading(true);
    setError("");
    try {
      const data = await login(fullPin);
      onLogin(data.token);
    } catch (loginError) {
      setError(loginError.message || "Galat PIN. Wrong PIN -- dobara try karo.");
      setShake(true);
      setPins(["", "", "", ""]);
      inputRefs[0].current?.focus();
      if (navigator.vibrate) navigator.vibrate(200);
      setTimeout(() => setShake(false), 450);
    } finally {
      setLoading(false);
    }
  }

  function handleDigit(index, value) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...pins];
    next[index] = digit;
    setPins(next);
    if (digit && index < 3) inputRefs[index + 1].current?.focus();
    if (digit && index === 3) {
      const full = [...next.slice(0, 3), digit].join("");
      if (full.length === 4) handlePinSubmit(full);
    }
  }

  function handleKeyDown(index, event) {
    if (event.key === "Backspace" && !pins[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  }

  return (
    <div className="login-page">
      <div className="login-layout">
        <div className="login-copy">
          <p className="eyebrow">Simple contractor login</p>
          <h1>Thekedar AI</h1>
          <p>Daily attendance, payroll, invoice totals, and worker setup — kept simple for contractor use on laptop and mobile.</p>
          <div className="login-points surface">
            <div className="login-point">
              <strong>Daily use</strong>
              <span>Open Haziri and mark today&apos;s crew first.</span>
            </div>
            <div className="login-point">
              <strong>Past change safety</strong>
              <span>Older dates stay locked until correction mode is opened.</span>
            </div>
            <div className="login-point">
              <strong>Fast worker setup</strong>
              <span>Add one worker, paste a full crew, or load a demo crew.</span>
            </div>
          </div>
        </div>

        <div className={`login-card surface${shake ? " shake" : ""}`}>
          <div className="brand-badge login-badge">TK</div>
          <h2 className="login-title">Enter your 4-digit PIN</h2>
          <p className="login-sub">Ask the admin for your contractor PIN and type it below.</p>
          <p className="login-sub-hindi">Apna 4-digit PIN dalein</p>

          <div className={`pin-inputs${shake ? " shake" : ""}`}>
            {pins.map((digit, index) => (
              <input
                key={index}
                ref={inputRefs[index]}
                className={`pin-box${digit ? " filled" : ""}${shake ? " error-flash" : ""}`}
                type="tel"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigit(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                autoFocus={index === 0}
                disabled={loading}
                enterKeyHint={index === 3 ? "done" : "next"}
              />
            ))}
          </div>

          {error ? (
            <div className="status-pill error login-status">{error}</div>
          ) : (
            <div className="status-pill login-status">PIN stays active only in this browser tab.</div>
          )}

          {loading ? <p className="login-sub">Checking PIN...</p> : null}
          <p className="login-forgot">PIN yaad nahi? Apne admin se contact karein.</p>
        </div>
      </div>
    </div>
  );
}

/* ── Main App ─────────────────────────────────────── */

function App() {
  const currentDate = new Date();
  const month = monthKeyFromDate(currentDate);
  const monthTitle = monthLabel(month);
  const todayDay = currentDate.getDate();
  const todayDayKey = String(todayDay);

  const pageRef = useRef(null);
  const chatEndRef = useRef(null);

  // Core state
  const [authenticated, setAuthenticated] = useState(() => Boolean(getToken()));
  const [tab, setTab] = useState("dashboard");
  const [moreOpen, setMoreOpen] = useState(false);
  const [siteFilter, setSiteFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [company, setCompany] = useState({});
  const [sites, setSites] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [lastSynced, setLastSynced] = useState(null);

  // Forms
  const [companyForm, setCompanyForm] = useState(companyFormFromCompany({}));
  const [siteForm, setSiteForm] = useState(emptySiteForm());
  const [workerForm, setWorkerForm] = useState(emptyWorkerForm());
  const [bulkWorkerForm, setBulkWorkerForm] = useState(emptyBulkWorkerForm());
  const [editingSiteId, setEditingSiteId] = useState("");
  const [editingWorkerId, setEditingWorkerId] = useState("");

  // Search
  const [workerSearch, setWorkerSearch] = useState("");
  const [attendanceSearch, setAttendanceSearch] = useState("");
  const [payrollSearch, setPayrollSearch] = useState("");

  // Inline confirmations
  const [deletingSiteId, setDeletingSiteId] = useState("");
  const [deletingWorkerId, setDeletingWorkerId] = useState("");
  const [logoutConfirming, setLogoutConfirming] = useState(false);
  const [loadDemoConfirming, setLoadDemoConfirming] = useState(false);

  // Attendance UI
  const [attendanceView, setAttendanceView] = useState("today");
  const [correctionMode, setCorrectionMode] = useState(false);
  const [markAllConfirming, setMarkAllConfirming] = useState(false);
  const [savingCells, setSavingCells] = useState(new Set());
  const [savedCells, setSavedCells] = useState(new Set());

  // Chat
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      content: "Thekedar AI ready hai! Haziri, payroll, invoice, ya workers ke baare mein kuch bhi pucho — Hindi ya English mein.",
      timestamp: new Date(),
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Import
  const [importSitesText, setImportSitesText] = useState("");
  const [importWorkersText, setImportWorkersText] = useState("");
  const [importPreview, setImportPreview] = useState(null);
  const [importBusy, setImportBusy] = useState(false);

  // Toast
  const [toasts, setToasts] = useState([]);

  /* ── Toast system ─────────────────────────────── */
  function showToast(message, type = "success") {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }

  /* ── Data loading ─────────────────────────────── */
  async function loadBootstrap(targetMonth = month) {
    setLoading(true);
    setError("");
    try {
      const data = await getBootstrap(targetMonth);
      setCompany(data.company);
      setSites(data.sites);
      setWorkers(data.workers);
      setAttendance(data.attendance);
      setCompanyForm(companyFormFromCompany(data.company));
      setLastSynced(new Date());
      if (siteFilter !== "all" && !data.sites.some((s) => s.id === siteFilter)) {
        setSiteFilter("all");
      }
    } catch (loadError) {
      setError(loadError.message);
      showToast(loadError.message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authenticated) loadBootstrap(month);
  }, [authenticated, month]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  /* ── Derived data ─────────────────────────────── */
  const selectedSite = siteFilter === "all" ? null : sites.find((s) => s.id === siteFilter);
  const siteMap = new Map(sites.map((s) => [s.id, s]));
  const monthModel = calculateMonthModel({
    company, sites, workers, attendanceByWorker: attendance, monthKey: month, siteId: siteFilter,
  });
  const dashboardSiteSummaries =
    siteFilter === "all" ? monthModel.siteSummaries : monthModel.siteSummaries.filter((s) => s.id === siteFilter);
  const allDays = Object.keys(createDefaultAttendanceMap(month, {}));
  const attendanceRows = monthModel.rows.filter((row) =>
    matchesSearch([row.name, row.role, row.siteName], attendanceSearch),
  );
  const visibleWorkers = workers.filter((w) => {
    const siteName = siteMap.get(w.siteId)?.name || "Unassigned";
    return (
      (siteFilter === "all" || w.siteId === siteFilter) &&
      matchesSearch([w.name, w.role, siteName], workerSearch)
    );
  });
  const payrollRows = monthModel.rows.filter((row) =>
    matchesSearch([row.name, row.role, row.siteName], payrollSearch),
  );
  const todaySummary = attendanceRows.reduce(
    (acc, row) => { const s = row.attendance[todayDayKey] || "A"; acc[s] = (acc[s] || 0) + 1; return acc; },
    { P: 0, A: 0, HD: 0, OT: 0, WO: 0 },
  );
  const activeWorkers = workers.filter((w) => w.active).length;

  /* ── Site groups for Today Board ─────────────── */
  const siteGroups = [];
  const seenSites = new Set();
  for (const row of attendanceRows) {
    const key = row.siteId || "unassigned";
    if (!seenSites.has(key)) {
      seenSites.add(key);
      siteGroups.push({ siteKey: key, siteName: row.siteName || "Unassigned", rows: [] });
    }
    const g = siteGroups.find((g) => g.siteKey === key);
    if (g) g.rows.push(row);
  }

  /* ── Invoice helpers ──────────────────────────── */
  const invoiceNumber = `INV-${month.replace("-", "")}-${(company.businessName || "TK").substring(0, 3).toUpperCase().replace(/[^A-Z]/g, "X")}`;
  const missingRegs = [];
  if (!company.gstin) missingRegs.push("GSTIN");
  if (!company.pfRegistration) missingRegs.push("PF Registration");
  if (!company.esiRegistration) missingRegs.push("ESI Registration");

  /* ── Helpers ──────────────────────────────────── */
  function clearMessages() { setError(""); setNotice(""); }

  function announce(message) {
    showToast(message, "success");
    setNotice(message);
    setError("");
  }

  async function withBusy(work) {
    setBusy(true);
    clearMessages();
    try {
      await work();
    } catch (actionError) {
      setError(actionError.message);
      showToast(actionError.message, "error");
    } finally {
      setBusy(false);
    }
  }

  function handleLogin(token) { setToken(token); setAuthenticated(true); }

  async function handleLogout() {
    await logout();
    clearToken();
    setAuthenticated(false);
    setMoreOpen(false);
    setLogoutConfirming(false);
  }

  /* ── Form field updaters ──────────────────────── */
  function updateCompanyField(name, value) { setCompanyForm((c) => ({ ...c, [name]: value })); }
  function updateSiteField(name, value) { setSiteForm((c) => ({ ...c, [name]: value })); }
  function updateWorkerField(name, value) { setWorkerForm((c) => ({ ...c, [name]: value })); }
  function updateBulkWorkerField(name, value) { setBulkWorkerForm((c) => ({ ...c, [name]: value })); }

  /* ── Company / Site / Worker handlers ────────── */
  async function handleSaveCompany(event) {
    event.preventDefault();
    await withBusy(async () => {
      const response = await saveCompany(companyForm);
      setCompany(response.company);
      setCompanyForm(companyFormFromCompany(response.company));
      announce("Settings save ho gaye!");
    });
  }

  async function handleSaveSite(event) {
    event.preventDefault();
    if (!siteForm.name.trim()) { setError("Site ka naam daalein."); return; }
    await withBusy(async () => {
      if (editingSiteId) { await updateSite(editingSiteId, siteForm); announce("Site update ho gaya."); }
      else { await createSite(siteForm); announce("Site jod diya!"); }
      setSiteForm(emptySiteForm());
      setEditingSiteId("");
      await loadBootstrap(month);
    });
  }

  async function handleDeleteSite(siteId) {
    if (deletingSiteId !== siteId) {
      setDeletingSiteId(siteId);
      setTimeout(() => setDeletingSiteId((d) => (d === siteId ? "" : d)), 8000);
      return;
    }
    setDeletingSiteId("");
    await withBusy(async () => {
      await deleteSite(siteId);
      if (siteFilter === siteId) setSiteFilter("all");
      announce("Site delete ho gaya.");
      await loadBootstrap(month);
    });
  }

  async function handleSaveWorker(event) {
    event.preventDefault();
    if (!workerForm.name.trim()) { setError("Worker ka naam daalein."); return; }
    if (!workerForm.dailyWage || Number(workerForm.dailyWage) <= 0) { setError("Daily wage 0 se zyada honi chahiye."); return; }
    await withBusy(async () => {
      if (editingWorkerId) { await updateWorker(editingWorkerId, workerForm); announce("Worker update ho gaya."); }
      else { await createWorker(workerForm); announce("Worker jod diya!"); }
      setWorkerForm(emptyWorkerForm());
      setEditingWorkerId("");
      await loadBootstrap(month);
    });
  }

  async function handleDeleteWorker(workerId) {
    if (deletingWorkerId !== workerId) {
      setDeletingWorkerId(workerId);
      setTimeout(() => setDeletingWorkerId((d) => (d === workerId ? "" : d)), 8000);
      return;
    }
    setDeletingWorkerId("");
    await withBusy(async () => {
      await deleteWorker(workerId);
      announce("Worker delete ho gaya.");
      await loadBootstrap(month);
    });
  }

  async function handleBulkAddWorkers(event) {
    event.preventDefault();
    const names = parseBulkWorkerNames(bulkWorkerForm.names);
    if (!names.length) { setError("Kam se kam ek worker ka naam paste karo."); return; }
    if (!bulkWorkerForm.dailyWage || Number(bulkWorkerForm.dailyWage) <= 0) { setError("Daily wage 0 se zyada honi chahiye."); return; }
    const selectedSiteName = sites.find((s) => s.id === bulkWorkerForm.siteId)?.name || "";
    const beforeCount = workers.length;
    await withBusy(async () => {
      const response = await importBatch({
        sites: [],
        workers: names.map((name) => ({
          name, role: bulkWorkerForm.role || "Helper",
          dailyWage: bulkWorkerForm.dailyWage || 550,
          uan: "", esiNumber: "", siteName: selectedSiteName, active: bulkWorkerForm.active,
        })),
      });
      const added = Math.max(response.workers.length - beforeCount, 0);
      setBulkWorkerForm(emptyBulkWorkerForm());
      announce(`${added} workers jod diye!`);
      await loadBootstrap(month);
    });
  }

  async function handleLoadDemoCrew() {
    if (!loadDemoConfirming) {
      setLoadDemoConfirming(true);
      setTimeout(() => setLoadDemoConfirming(false), 8000);
      return;
    }
    setLoadDemoConfirming(false);
    const beforeCount = workers.length;
    const payload = buildDemoImportPayload(sites, beforeCount);
    await withBusy(async () => {
      const response = await importBatch(payload);
      const added = Math.max(response.workers.length - beforeCount, 0);
      announce(`${added} demo workers load ho gaye!`);
      await loadBootstrap(month);
    });
  }

  /* ── Attendance handlers ──────────────────────── */
  function isFutureDay(day) { return Number(day) > todayDay; }
  function isPastDay(day) { return Number(day) < todayDay; }
  function isAttendanceEditable(day) {
    if (isFutureDay(day)) return false;
    if (Number(day) === todayDay) return true;
    return correctionMode;
  }

  async function handleToggleAttendance(workerId, day, options = {}) {
    const dayKey = String(day);
    const allowPastEdit = Boolean(options.overridePastEdit);
    const dayNum = Number(dayKey);
    if (dayNum > todayDay) { setError("Future dates cannot be updated yet."); return; }
    if (dayNum < todayDay && !allowPastEdit) { setError("Past dates are locked. Enable correction mode for older dates."); return; }
    clearMessages();
    const cellKey = `${workerId}-${dayKey}`;
    const curAtt = attendance[workerId] || createDefaultAttendanceMap(month, {});
    const nextStatus = nextAttendanceStatus(curAtt[dayKey]);
    setAttendance((cur) => ({ ...cur, [workerId]: { ...curAtt, [dayKey]: nextStatus } }));
    setSavingCells((prev) => { const n = new Set(prev); n.add(cellKey); return n; });
    try {
      const response = await updateAttendance({ month, workerId, day: dayKey, status: nextStatus, overridePastEdit: allowPastEdit });
      setAttendance(response.attendance);
      setSavedCells((prev) => { const n = new Set(prev); n.add(cellKey); return n; });
      setTimeout(() => setSavedCells((prev) => { const n = new Set(prev); n.delete(cellKey); return n; }), 1500);
    } catch (attError) {
      setError(attError.message);
      await loadBootstrap(month);
    } finally {
      setSavingCells((prev) => { const n = new Set(prev); n.delete(cellKey); return n; });
    }
  }

  async function handleMarkAllPresent() {
    setMarkAllConfirming(false);
    const rows = attendanceRows;
    let changed = 0;
    for (const row of rows) {
      if (row.attendance[todayDayKey] !== "P") {
        const curAtt = attendance[row.id] || createDefaultAttendanceMap(month, {});
        setAttendance((cur) => ({ ...cur, [row.id]: { ...curAtt, [todayDayKey]: "P" } }));
        changed++;
        try {
          const response = await updateAttendance({ month, workerId: row.id, day: todayDayKey, status: "P", overridePastEdit: false });
          setAttendance(response.attendance);
        } catch (_) { /* silent */ }
      }
    }
    showToast(`${rows.length} workers ko present mark kiya!`, "success");
  }

  /* ── Chat handler ─────────────────────────────── */
  async function handleSendChat(event) {
    if (event) event.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || chatLoading) return;
    const userMessage = { role: "user", content: trimmed, timestamp: new Date() };
    const nextMessages = [...chatMessages, userMessage];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);
    try {
      const response = await sendChat(nextMessages, month, siteFilter);
      setChatMessages((cur) => [...cur, { role: "assistant", content: response.text, timestamp: new Date() }]);
    } catch (chatError) {
      setChatMessages((cur) => [
        ...cur,
        { role: "assistant", content: "AI assistant abhi available nahi hai. Internet connection check karo aur thodi der baad try karo.", timestamp: new Date() },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  /* ── CSV Import ───────────────────────────────── */
  function handleSitesFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setImportSitesText(e.target.result || "");
    reader.readAsText(file);
  }

  function handleWorkersFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setImportWorkersText(e.target.result || "");
    reader.readAsText(file);
  }

  function handlePreviewImport() {
    const parsedSites = importSitesText.trim() ? parseCSV(importSitesText) : [];
    const parsedWorkers = importWorkersText.trim() ? parseCSV(importWorkersText) : [];
    setImportPreview({
      sites: parsedSites.map((r) => ({ name: r["Site Name"] || r.name || "", clientName: r["Client Name"] || r.clientName || "", location: r.Location || r.location || "" })),
      workers: parsedWorkers.map((r) => ({ name: r.Name || r.name || "", role: r.Role || r.role || "", dailyWage: r["Daily Wage"] || r.dailyWage || 0, uan: r.UAN || r.uan || "", esiNumber: r["ESI Number"] || r.esiNumber || "", siteName: r["Site Name"] || r.siteName || "" })),
    });
  }

  async function handleRunImport() {
    if (!importPreview) return;
    setImportBusy(true);
    clearMessages();
    try {
      const response = await importBatch(importPreview);
      announce(`${response.sites.length} sites aur ${response.workers.length} workers import ho gaye!`);
      setImportPreview(null);
      setImportSitesText("");
      setImportWorkersText("");
      await loadBootstrap(month);
    } catch (importError) {
      setError(importError.message);
    } finally {
      setImportBusy(false);
    }
  }

  /* ════════════════════════════════════════════════
     RENDER FUNCTIONS
  ════════════════════════════════════════════════ */

  function renderDashboard() {
    return (
      <div className="stack">
        <div className="surface panel hero-panel">
          <SectionHeader
            eyebrow={`Month locked: ${monthTitle}`}
            title="Today's Overview"
            sub="Mark today's haziri from the Attendance tab. All numbers below update in real time."
            help={TAB_HELP.dashboard}
            actions={
              <div className="hero-tags">
                <span className="status-pill">{monthModel.rows.length} workers</span>
                <span className="status-pill">{selectedSite ? selectedSite.name : "All sites"}</span>
                <span className="status-pill">{todaySummary.P} present today</span>
              </div>
            }
          />
          <button className="btn cta-attendance" type="button" onClick={() => setTab("attendance")}>
            ✔ Aaj ki haziri lagao →
          </button>
          {lastSynced && <p className="last-synced">Last synced: {formatTimeAgo(lastSynced)}</p>}
        </div>

        <div className="grid metrics-grid">
          <MetricCard
            label="Present Today"
            value={String(todaySummary.P)}
            sub={`Absent: ${todaySummary.A} | HD: ${todaySummary.HD} | OT: ${todaySummary.OT}`}
            colorClass="metric-card-present"
          />
          <MetricCard
            label="Net Payable"
            value={formatCurrency(monthModel.totals.net)}
            sub={`PF ${formatCurrency(monthModel.totals.pfEmployee)} + ESI ${formatCurrency(monthModel.totals.esiEmployee)}`}
            colorClass="metric-card-net"
          />
          <MetricCard
            label="Gross Wages"
            value={formatCurrency(monthModel.totals.gross)}
            sub="Month-to-date live total"
            colorClass="metric-card-gross"
          />
          <MetricCard
            label="Invoice Value"
            value={formatCurrency(monthModel.totals.invoiceTotal)}
            sub={`SC ${monthModel.rules.serviceChargeRate}% + GST ${monthModel.rules.gstRate}%`}
            colorClass="metric-card-invoice"
          />
        </div>

        <div className="split">
          <div className="surface panel">
            <SectionHeader title="Site Performance" sub="Live wages per site for the current filter." help="Compare worker count and wages site by site." />
            <div className="stack">
              {dashboardSiteSummaries.length ? (
                dashboardSiteSummaries.map((site) => (
                  <div className="list-card" key={site.id}>
                    <div className="list-header">
                      <div>
                        <h4>{site.name}</h4>
                        <p>{site.clientName || "Client name pending"}</p>
                      </div>
                      <div className="status-pill">{site.workerCount} workers</div>
                    </div>
                    <div className="list-summary">
                      <div><span>Gross</span><strong>{formatCurrency(site.gross)}</strong></div>
                      <div><span>Net</span><strong>{formatCurrency(site.net)}</strong></div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">🏗</div>
                  <h4>Koi site nahi hai</h4>
                  <p>Setup mein jaake pehle site add karo.</p>
                  <button className="btn" type="button" onClick={() => setTab("setup")}>Setup kholein</button>
                </div>
              )}
            </div>
          </div>

          <div className="surface panel">
            <SectionHeader title="Quick Signals" sub="Today's snapshot at a glance." help="Pulled from company settings and today's attendance." />
            <div className="stack">
              <div className="mini-card">
                <h4>Aaj ki haziri</h4>
                <p>Present: <strong>{todaySummary.P}</strong></p>
                <p>Absent: <strong>{todaySummary.A}</strong></p>
                <p>Half day: <strong>{todaySummary.HD}</strong></p>
                <p>Overtime: <strong>{todaySummary.OT}</strong></p>
              </div>
              <div className="mini-card">
                <h4>Compliance</h4>
                <p>GSTIN: {company.gstin || "Not set"}</p>
                <p>PF: {company.pfRegistration || "Not set"}</p>
                <p>ESI: {company.esiRegistration || "Not set"}</p>
                <p>CLRA: {company.clraLicense || "Not set"}</p>
              </div>
              <div className="mini-card">
                <h4>Current Rules</h4>
                <p>PF cap: {formatCurrency(monthModel.rules.pfCap)}</p>
                <p>ESI threshold: {formatCurrency(monthModel.rules.esiThreshold)}</p>
                <p>OT multiplier: {monthModel.rules.overtimeMultiplier}x</p>
                <p>Service charge: {monthModel.rules.serviceChargeRate}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderSetup() {
    const activeCount = workers.filter((w) => w.active).length;
    const inactiveCount = workers.length - activeCount;
    const siteCountMap = {};
    workers.forEach((w) => {
      const sn = siteMap.get(w.siteId)?.name || "Unassigned";
      siteCountMap[sn] = (siteCountMap[sn] || 0) + 1;
    });

    const isFirstTime = sites.length === 0 && workers.length === 0;

    return (
      <div className="stack">
        {/* ── First-time onboarding ── */}
        {isFirstTime && (
          <div className="surface panel onboarding-card">
            <div className="onboarding-icon">🚀</div>
            <h3 className="onboarding-title">Setup shuru karein!</h3>
            <p className="onboarding-sub">Pehle apna site add karo, phir workers. Bas 2 step mein sab ready.</p>
            <div className="onboarding-steps">
              <div className="onboarding-step">
                <span className="onboarding-step-num">1</span>
                <div>
                  <strong>Site add karo</strong>
                  <p>Jahan kaam chal raha hai — site ka naam aur client daalein.</p>
                </div>
              </div>
              <div className="onboarding-step">
                <span className="onboarding-step-num">2</span>
                <div>
                  <strong>Workers add karo</strong>
                  <p>Quick Add se ek baar mein poori crew paste karo.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Company Settings (collapsed) ── */}
        <div className="surface panel">
          <CollapsibleSection title={`⚙ Company Settings — ${company.businessName || "Not set"}`} defaultOpen={isFirstTime && !company.businessName}>
            <form onSubmit={handleSaveCompany}>
              <CollapsibleSection title="Business Info" defaultOpen={true}>
                <div className="field-grid">
                  <Field label="Business Name">
                    <input value={companyForm.businessName} onChange={(e) => updateCompanyField("businessName", e.target.value)} placeholder="Shree Ganesh Labour Contractor" />
                  </Field>
                  <Field label="Owner Name">
                    <input value={companyForm.ownerName} onChange={(e) => updateCompanyField("ownerName", e.target.value)} />
                  </Field>
                  <Field label="Phone">
                    <input value={companyForm.phone} onChange={(e) => updateCompanyField("phone", e.target.value)} inputMode="tel" />
                  </Field>
                  <Field label="Email">
                    <input value={companyForm.email} onChange={(e) => updateCompanyField("email", e.target.value)} inputMode="email" />
                  </Field>
                  <Field label="Address" full>
                    <textarea value={companyForm.address} onChange={(e) => updateCompanyField("address", e.target.value)} />
                  </Field>
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="Registration Numbers">
                <div className="field-grid">
                  <Field label="GSTIN">
                    <input value={companyForm.gstin} onChange={(e) => updateCompanyField("gstin", e.target.value)} placeholder="27XXXXX..." />
                  </Field>
                  <Field label="CLRA License">
                    <input value={companyForm.clraLicense} onChange={(e) => updateCompanyField("clraLicense", e.target.value)} />
                  </Field>
                  <Field label="PF Registration">
                    <input value={companyForm.pfRegistration} onChange={(e) => updateCompanyField("pfRegistration", e.target.value)} />
                  </Field>
                  <Field label="ESI Registration">
                    <input value={companyForm.esiRegistration} onChange={(e) => updateCompanyField("esiRegistration", e.target.value)} />
                  </Field>
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="Rate Settings (change mat karo bina zaroorat ke)">
                <div className="field-grid">
                  <Field label="Service Charge %">
                    <input type="number" step="0.01" value={companyForm.serviceChargeRate} onChange={(e) => updateCompanyField("serviceChargeRate", e.target.value)} />
                  </Field>
                  <Field label="GST %">
                    <input type="number" step="0.01" value={companyForm.gstRate} onChange={(e) => updateCompanyField("gstRate", e.target.value)} />
                  </Field>
                  <Field label="PF Employee %">
                    <input type="number" step="0.01" value={companyForm.pfEmployeeRate} onChange={(e) => updateCompanyField("pfEmployeeRate", e.target.value)} />
                  </Field>
                  <Field label="PF Employer %">
                    <input type="number" step="0.01" value={companyForm.pfEmployerRate} onChange={(e) => updateCompanyField("pfEmployerRate", e.target.value)} />
                  </Field>
                  <Field label="PF Wage Cap">
                    <input type="number" value={companyForm.pfCap} onChange={(e) => updateCompanyField("pfCap", e.target.value)} />
                  </Field>
                  <Field label="ESI Employee %">
                    <input type="number" step="0.01" value={companyForm.esiEmployeeRate} onChange={(e) => updateCompanyField("esiEmployeeRate", e.target.value)} />
                  </Field>
                  <Field label="ESI Employer %">
                    <input type="number" step="0.01" value={companyForm.esiEmployerRate} onChange={(e) => updateCompanyField("esiEmployerRate", e.target.value)} />
                  </Field>
                  <Field label="ESI Threshold">
                    <input type="number" value={companyForm.esiThreshold} onChange={(e) => updateCompanyField("esiThreshold", e.target.value)} />
                  </Field>
                  <Field label="OT Multiplier">
                    <input type="number" step="0.01" value={companyForm.overtimeMultiplier} onChange={(e) => updateCompanyField("overtimeMultiplier", e.target.value)} />
                  </Field>
                </div>
              </CollapsibleSection>

              <div className="button-row mt-18">
                <button className="btn" type="submit" disabled={busy}>
                  {busy ? "Saving..." : "Save company settings"}
                </button>
              </div>
            </form>
          </CollapsibleSection>
        </div>

        {/* ── Sites & Workers ── */}
        <div className="split">
          {/* Sites */}
          <div className="surface panel">
            <SectionHeader title="Sites" sub="Create sites first, then assign workers." help="A site keeps workers, payroll, and invoices grouped correctly." />
            <form className="stack" onSubmit={handleSaveSite}>
              <div className="field-grid">
                <Field label="Site Name">
                  <input value={siteForm.name} onChange={(e) => updateSiteField("name", e.target.value)} placeholder="Tema India" />
                </Field>
                <Field label="Client Name">
                  <input value={siteForm.clientName} onChange={(e) => updateSiteField("clientName", e.target.value)} placeholder="Tema India Pvt Ltd" />
                </Field>
                <Field label="Location" full>
                  <input value={siteForm.location} onChange={(e) => updateSiteField("location", e.target.value)} placeholder="Achhad, Talasari" />
                </Field>
              </div>
              <div className="button-row">
                <button className="btn" type="submit" disabled={busy}>{editingSiteId ? "Update site" : "Add site"}</button>
                {editingSiteId ? (
                  <button className="btn-ghost" type="button" onClick={() => { setEditingSiteId(""); setSiteForm(emptySiteForm()); }}>Cancel</button>
                ) : null}
              </div>
            </form>

            <div className="stack mt-18">
              {sites.length ? sites.map((site) => (
                <div className="list-card" key={site.id}>
                  <div className="list-header">
                    <div>
                      <h4>{site.name}</h4>
                      <p>{site.clientName || "No client name"}</p>
                    </div>
                    {deletingSiteId === site.id ? (
                      <div className="confirm-inline-cell">
                        <span>Delete karein?</span>
                        <button className="btn-ghost btn-danger btn-sm" type="button" onClick={() => handleDeleteSite(site.id)}>Haan</button>
                        <button className="btn-ghost btn-sm" type="button" onClick={() => setDeletingSiteId("")}>Nahi</button>
                      </div>
                    ) : (
                      <div className="button-row">
                        <button className="btn-ghost" type="button" onClick={() => { setEditingSiteId(site.id); setSiteForm({ name: site.name, clientName: site.clientName, location: site.location }); }}>Edit</button>
                        <button className="btn-ghost btn-danger" type="button" onClick={() => handleDeleteSite(site.id)}>Delete</button>
                      </div>
                    )}
                  </div>
                  <p className="muted mt-10">{site.location || "No location set"}</p>
                </div>
              )) : (
                <div className="empty-state">
                  <div className="empty-state-icon">📍</div>
                  <h4>Koi site nahi hai</h4>
                  <p>Pehla site add karein taaki workers assign ho sakein.</p>
                </div>
              )}
            </div>
          </div>

          {/* Workers */}
          <div className="surface panel">
            <SectionHeader
              title="Workers"
              sub="Quick add fastest hai bade crews ke liye."
              help="For 50-100 workers: create sites, paste names in quick add, then use search for edits."
              actions={<div className="status-pill">{visibleWorkers.length} shown</div>}
            />

            {workers.length > 0 && (
              <div className="workers-count-summary">
                <span><strong>{workers.length}</strong> total workers</span>
                <span>(<strong>{activeCount}</strong> active, <strong>{inactiveCount}</strong> inactive)</span>
                {Object.entries(siteCountMap).map(([sn, cnt]) => (
                  <span key={sn} className="site-count-chip">{sn}: {cnt}</span>
                ))}
              </div>
            )}

            {/* Quick Add */}
            <div className="mini-card quick-add-card">
              <SectionHeader title="Quick Add Crew" sub="Paste one name per line. Same role, wage, and site applied to all." help="Fastest way to load a real contractor crew." />
              <form className="stack" onSubmit={handleBulkAddWorkers}>
                <Field label="Worker Names" full hint="Ek naam per line">
                  <textarea
                    value={bulkWorkerForm.names}
                    onChange={(e) => updateBulkWorkerField("names", e.target.value)}
                    placeholder={"Ramesh Patel\nSuresh Yadav\nDinesh Kumar"}
                  />
                </Field>
                {bulkWorkerForm.names.trim() && (
                  <p className="field-hint field-hint-count">
                    {parseBulkWorkerNames(bulkWorkerForm.names).length} names entered
                  </p>
                )}
                <div className="field-grid">
                  <Field label="Common Role">
                    <input value={bulkWorkerForm.role} onChange={(e) => updateBulkWorkerField("role", e.target.value)} />
                  </Field>
                  <Field label="Daily Wage">
                    <input type="number" value={bulkWorkerForm.dailyWage} onChange={(e) => updateBulkWorkerField("dailyWage", e.target.value)} />
                  </Field>
                  <Field label="Site">
                    <select value={bulkWorkerForm.siteId} onChange={(e) => updateBulkWorkerField("siteId", e.target.value)}>
                      <option value="">Unassigned</option>
                      {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select value={bulkWorkerForm.active ? "active" : "inactive"} onChange={(e) => updateBulkWorkerField("active", e.target.value === "active")}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </Field>
                </div>
                <div className="button-row">
                  <button className="btn" type="submit" disabled={busy}>Add pasted crew</button>
                </div>
              </form>
            </div>

            {/* Single Worker Form */}
            <div className="mt-18">
              <CollapsibleSection title={editingWorkerId ? "✏ Edit Worker" : "Ek worker add karo (single)"} defaultOpen={Boolean(editingWorkerId)}>
                <form className="stack" onSubmit={handleSaveWorker}>
                  <div className="field-grid">
                    <Field label="Worker Name">
                      <input value={workerForm.name} onChange={(e) => updateWorkerField("name", e.target.value)} placeholder="Ramesh Patel" />
                    </Field>
                    <Field label="Role">
                      <input value={workerForm.role} onChange={(e) => updateWorkerField("role", e.target.value)} placeholder="Fitter" />
                    </Field>
                    <Field label="Daily Wage">
                      <input type="number" value={workerForm.dailyWage} onChange={(e) => updateWorkerField("dailyWage", e.target.value)} placeholder="650" />
                    </Field>
                    <Field label="Site">
                      <select value={workerForm.siteId} onChange={(e) => updateWorkerField("siteId", e.target.value)}>
                        <option value="">Unassigned</option>
                        {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </Field>
                    <Field label="UAN">
                      <input value={workerForm.uan} onChange={(e) => updateWorkerField("uan", e.target.value)} />
                    </Field>
                    <Field label="ESI Number">
                      <input value={workerForm.esiNumber} onChange={(e) => updateWorkerField("esiNumber", e.target.value)} />
                    </Field>
                    <Field label="Status">
                      <select value={workerForm.active ? "active" : "inactive"} onChange={(e) => updateWorkerField("active", e.target.value === "active")}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </Field>
                  </div>
                  <div className="button-row">
                    <button className="btn" type="submit" disabled={busy}>{editingWorkerId ? "Update worker" : "Add worker"}</button>
                    {editingWorkerId ? (
                      <button className="btn-ghost" type="button" onClick={() => { setEditingWorkerId(""); setWorkerForm(emptyWorkerForm()); }}>Cancel</button>
                    ) : null}
                  </div>
                </form>
              </CollapsibleSection>
            </div>
            </form>

            {/* Worker Search */}
            <div className="workers-toolbar">
              <Field label="Search Workers" full>
                <input value={workerSearch} onChange={(e) => setWorkerSearch(e.target.value)} placeholder="Naam, role, ya site se dhundo..." />
              </Field>
            </div>

            {/* Workers Table (desktop) */}
            {visibleWorkers.length ? (
              <div className="table-wrap keyboard-scroll workers-table-wrap mt-16" tabIndex={0} onKeyDown={handleScrollableKeyDown}>
                <table className="compact-table">
                  <thead>
                    <tr>
                      <th>Worker</th>
                      <th>Role</th>
                      <th>Site</th>
                      <th>Daily Wage</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleWorkers.map((worker) => {
                      const ws = siteMap.get(worker.siteId);
                      const isDeleting = deletingWorkerId === worker.id;
                      return (
                        <tr key={worker.id} className={isDeleting ? "confirm-row" : ""}>
                          <td>
                            <div>{worker.name}</div>
                            <div className="muted table-subtext">UAN {worker.uan || "not set"} | ESI {worker.esiNumber || "not set"}</div>
                          </td>
                          <td>{worker.role || "No role"}</td>
                          <td>{ws?.name || "Unassigned"}</td>
                          <td className="mono">{formatCurrency(worker.dailyWage)}</td>
                          <td>{worker.active ? "Active" : "Inactive"}</td>
                          <td>
                            {isDeleting ? (
                              <div className="confirm-inline-cell">
                                <span>Delete?</span>
                                <button className="btn-ghost btn-danger btn-sm" type="button" onClick={() => handleDeleteWorker(worker.id)}>Haan</button>
                                <button className="btn-ghost btn-sm" type="button" onClick={() => setDeletingWorkerId("")}>Nahi</button>
                              </div>
                            ) : (
                              <div className="button-row tight">
                                <button className="btn-ghost" type="button" onClick={() => { setEditingWorkerId(worker.id); setWorkerForm({ name: worker.name, role: worker.role, dailyWage: worker.dailyWage, uan: worker.uan, esiNumber: worker.esiNumber, siteId: worker.siteId, active: worker.active }); pageRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>
                                <button className="btn-ghost btn-danger" type="button" onClick={() => handleDeleteWorker(worker.id)}>Delete</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state mt-16">
                <div className="empty-state-icon">👷</div>
                <h4>Koi worker nahi mila</h4>
                <p>Search ya site filter change karein, ya upar se worker add karein.</p>
              </div>
            )}

            {/* Workers Cards (mobile) */}
            {visibleWorkers.length > 0 && (
              <div className="workers-cards">
                {visibleWorkers.map((worker) => {
                  const ws = siteMap.get(worker.siteId);
                  const isDeleting = deletingWorkerId === worker.id;
                  return (
                    <div className="worker-card" key={`wc-${worker.id}`}>
                      <div className="worker-card-top">
                        <div>
                          <p className="worker-card-name">{worker.name}</p>
                          <span className="worker-card-role">{worker.role || "No role"}</span>
                        </div>
                        <span className="worker-card-wage">{formatCurrency(worker.dailyWage)}/day</span>
                      </div>
                      <div className="worker-card-details">
                        <span>Site: {ws?.name || "Unassigned"}</span>
                        <span>Status: {worker.active ? "Active" : "Inactive"}</span>
                        <span>UAN: {worker.uan || "—"}</span>
                        <span>ESI: {worker.esiNumber || "—"}</span>
                      </div>
                      {isDeleting ? (
                        <div className="worker-card-confirm mt-10">
                          <span>Delete karein?</span>
                          <button className="btn-ghost btn-danger btn-sm" type="button" onClick={() => handleDeleteWorker(worker.id)}>Haan</button>
                          <button className="btn-ghost btn-sm" type="button" onClick={() => setDeletingWorkerId("")}>Nahi</button>
                        </div>
                      ) : (
                        <div className="worker-card-actions">
                          <button className="btn-ghost" type="button" onClick={() => { setEditingWorkerId(worker.id); setWorkerForm({ name: worker.name, role: worker.role, dailyWage: worker.dailyWage, uan: worker.uan, esiNumber: worker.esiNumber, siteId: worker.siteId, active: worker.active }); pageRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>
                          <button className="btn-ghost btn-danger" type="button" onClick={() => handleDeleteWorker(worker.id)}>Delete</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── CSV Import (collapsed by default) ── */}
        <div className="surface panel">
          <CollapsibleSection title="CSV se workers load karo (advanced)">
            <div className="import-templates">
              <a className="btn-ghost" href="data:text/csv;charset=utf-8,Site Name,Client Name,Location%0ATema India,Tema India Pvt Ltd,Achhad Talasari" download="sites_template.csv">Download sites template</a>
              <a className="btn-ghost" href="data:text/csv;charset=utf-8,Name,Role,Daily Wage,UAN,ESI Number,Site Name%0ARamesh Patel,Fitter,650,100123456789,3112345678,Tema India" download="workers_template.csv">Download workers template</a>
            </div>
            <div className="split import-grid">
              <Field label="Sites CSV"><input type="file" accept=".csv,text/csv" onChange={handleSitesFileChange} /></Field>
              <Field label="Workers CSV"><input type="file" accept=".csv,text/csv" onChange={handleWorkersFileChange} /></Field>
            </div>
            <div className="button-row mt-12">
              <button className="btn-ghost" type="button" onClick={handlePreviewImport} disabled={!importSitesText && !importWorkersText}>Preview import</button>
            </div>
            {importPreview ? (
              <div className="import-preview stack">
                <p><strong>{importPreview.sites.length}</strong> sites aur <strong>{importPreview.workers.length}</strong> workers import ke liye ready hain.</p>
                {importPreview.workers.length ? (
                  <div className="mini-card">
                    <h4>Workers</h4>
                    {importPreview.workers.slice(0, 10).map((w, i) => (
                      <p key={`${w.name}-${i}`}>{w.name} ({w.role || "No role"}) — {w.siteName || "Unassigned"} — {w.dailyWage}/day</p>
                    ))}
                    {importPreview.workers.length > 10 ? <p className="muted">...aur {importPreview.workers.length - 10} workers</p> : null}
                  </div>
                ) : null}
                <div className="button-row">
                  <button className="btn" type="button" onClick={handleRunImport} disabled={importBusy}>{importBusy ? "Importing..." : "Confirm import"}</button>
                  <button className="btn-ghost" type="button" onClick={() => setImportPreview(null)}>Cancel</button>
                </div>
              </div>
            ) : null}
          </CollapsibleSection>
        </div>

        {/* Demo Data — for testing only */}
        <div className="surface panel demo-section">
          <CollapsibleSection title="Demo data load karo (testing ke liye)">
            <p className="demo-section-note">Yeh sirf testing ke liye hai. 72 demo workers aur 3 sites load honge.</p>
            {loadDemoConfirming ? (
              <div className="demo-confirm-row">
                <span>72 demo workers load karein?</span>
                <button className="btn btn-sm" type="button" onClick={handleLoadDemoCrew} disabled={busy}>Haan, load karo</button>
                <button className="btn-ghost btn-sm" type="button" onClick={() => setLoadDemoConfirming(false)}>Nahi</button>
              </div>
            ) : (
              <button className="btn-ghost" type="button" onClick={handleLoadDemoCrew} disabled={busy}>Load 72 demo workers</button>
            )}
          </CollapsibleSection>
        </div>
      </div>
    );
  }

  function renderAttendance() {
    const suggestions = CHAT_SUGGESTIONS.attendance;

    return (
      <div className="stack">
        {/* View Toggle */}
        <div className="attendance-view-header">
          <div className="attendance-view-tabs">
            <button className={`attendance-view-tab${attendanceView === "today" ? " active" : ""}`} type="button" onClick={() => setAttendanceView("today")}>
              ✔ Aaj ki haziri
            </button>
            <button className={`attendance-view-tab${attendanceView === "month" ? " active" : ""}`} type="button" onClick={() => setAttendanceView("month")}>
              📅 Poora mahina
            </button>
          </div>
          <div className="hero-tags">
            <span className="status-pill">Day {todayDay}</span>
            <span className="status-pill">{todaySummary.P} present</span>
            <span className="status-pill">{todaySummary.OT} OT</span>
          </div>
        </div>

        {/* TODAY BOARD */}
        {attendanceView === "today" && (
          <div className="surface panel">
            <SectionHeader
              eyebrow="Daily attendance first"
              title="Aaj ki haziri"
              sub="Har worker ka status tap karke change karein — P, A, HD, OT, ya WO."
              help="Past dates locked hain normal mode mein. Purani dates ke liye correction mode use karein."
            />

            {/* Summary Bar */}
            <div className="att-summary-bar">
              {["P", "A", "HD", "OT", "WO"].map((s) => (
                <span key={s} className={`att-chip att-chip-${s}`}>
                  {s}: {todaySummary[s] || 0}
                </span>
              ))}
              <span className="att-chip att-chip-total">
                Total: {attendanceRows.length}
              </span>
            </div>

            {/* Mark All Present */}
            <div className="mark-all-bar">
              <span>Sabko present mark karein — ek tap mein!</span>
              {markAllConfirming ? (
                <div className="mark-all-confirm-inline">
                  <span>{attendanceRows.length} workers ko present mark karein?</span>
                  <button className="btn btn-sm" type="button" onClick={handleMarkAllPresent}>Haan, karo</button>
                  <button className="btn-ghost btn-sm" type="button" onClick={() => setMarkAllConfirming(false)}>Nahi</button>
                </div>
              ) : (
                <button className="btn btn-sm" type="button" onClick={() => setMarkAllConfirming(true)}>
                  Sabko Present ✔
                </button>
              )}
            </div>

            {/* Search */}
            <div className="attendance-toolbar">
              <Field label="Worker dhundo" full>
                <input value={attendanceSearch} onChange={(e) => setAttendanceSearch(e.target.value)} placeholder="Naam, role, ya site..." />
              </Field>
            </div>

            {/* Legend */}
            <div className="legend-row">
              {ATTENDANCE_CYCLE.map((s) => (
                <span key={s} className={`legend-chip status-${s}`}>{s} — {STATUS_HINDI[s]}</span>
              ))}
            </div>

            {/* Today Cards grouped by site */}
            {attendanceRows.length ? (
              <div className="mt-16">
                {siteGroups.map((group) => (
                  <div key={group.siteKey}>
                    <div className="site-group-header">
                      <span className="site-group-title">{group.siteName}</span>
                      <span className="site-group-count">{group.rows.length} workers</span>
                    </div>
                    <div className="today-board">
                      {group.rows.map((row) => {
                        const cellKey = `${row.id}-${todayDayKey}`;
                        const isSaving = savingCells.has(cellKey);
                        const isSaved = savedCells.has(cellKey);
                        const status = row.attendance[todayDayKey] || "A";
                        return (
                          <div className="today-card surface" key={`today-${row.id}`}>
                            {isSaving && <span className="save-dot saving" title="Saving..." />}
                            {!isSaving && isSaved && <span className="save-dot saved" title="Saved!" />}
                            <div className="today-card-copy">
                              <h4>{row.name}</h4>
                              <p>{row.role || "No role"}</p>
                            </div>
                            <button
                              className={`today-status-btn status-${status}`}
                              type="button"
                              onClick={() => handleToggleAttendance(row.id, todayDayKey)}
                            >
                              <span>{status}</span>
                              <small className="status-label-hindi">{STATUS_HINDI[status]}</small>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state mt-16">
                <div className="empty-state-icon">👷</div>
                <h4>Koi worker nahi mila</h4>
                <p>Search ya site filter change karein. Ya Setup mein jaake workers add karein.</p>
              </div>
            )}
          </div>
        )}

        {/* MONTH REGISTER */}
        {attendanceView === "month" && (
          <div className="surface panel">
            <p className="month-register-mobile-hint">Yeh table bade screen pe best dikhta hai. Left-right scroll karein.</p>
            <SectionHeader
              title="Month Register"
              sub={correctionMode ? "Correction mode ON hai. Purani dates edit ho sakti hain. Future dates locked rehenge." : "Sirf aaj ki date editable hai. Purani dates locked hain."}
              help="Full register review ke liye visible hai. Safe editing restricted hai taaki galti se purani entries change na hoon."
              actions={
                <div className="button-row">
                  <button className={`btn-ghost${correctionMode ? " active-toggle" : ""}`} type="button" onClick={() => setCorrectionMode((c) => !c)}>
                    {correctionMode ? "Close correction mode" : "Enable past-date correction"}
                  </button>
                </div>
              }
            />
            <div className="table-wrap keyboard-scroll mt-16" tabIndex={0} onKeyDown={handleScrollableKeyDown}>
              <table className="attendance-table">
                <thead>
                  <tr>
                    <th>Worker</th>
                    <th>Site</th>
                    {allDays.map((day) => (
                      <th className={`attendance-cell${Number(day) === todayDay ? " attendance-col-today" : ""}`} key={day}>{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attendanceRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div>{row.name}</div>
                        <div className="muted table-subtext">{row.role || "No role"}</div>
                      </td>
                      <td>{row.siteName}</td>
                      {allDays.map((day) => {
                        const editable = isAttendanceEditable(day);
                        const future = isFutureDay(day);
                        const displayStatus = future ? "--" : row.attendance[day];
                        return (
                          <td className={`attendance-cell${Number(day) === todayDay ? " attendance-col-today" : ""}`} key={`${row.id}-${day}`}>
                            <button
                              className={`attendance-chip status-${displayStatus}${editable ? "" : " locked"}${future ? " future" : ""}`}
                              onClick={() => handleToggleAttendance(row.id, day, { overridePastEdit: correctionMode && isPastDay(day) })}
                              type="button"
                              disabled={!editable}
                              title={future ? "Future date" : editable ? STATUS_LABELS[displayStatus] : "Locked. Correction mode enable karein."}
                            >
                              {displayStatus}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderPayroll() {
    return (
      <div className="surface panel">
        <SectionHeader
          eyebrow="Month-to-date payroll"
          title="Payroll Breakdown"
          sub="Current month only. Future dates excluded."
          help={TAB_HELP.payroll}
          actions={<div className="status-pill">{monthTitle}</div>}
        />

        {/* Totals Summary */}
        {monthModel.rows.length > 0 && (
          <div className="payroll-totals">
            <div className="payroll-total-card">
              <p className="pt-label">Total Workers</p>
              <p className="pt-value">{monthModel.rows.length}</p>
            </div>
            <div className="payroll-total-card">
              <p className="pt-label">Total Gross</p>
              <p className="pt-value mono">{formatCurrency(monthModel.totals.gross)}</p>
            </div>
            <div className="payroll-total-card">
              <p className="pt-label">Total Net Payable</p>
              <p className="pt-value mono text-accent">{formatCurrency(monthModel.totals.net)}</p>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mb-12">
          <Field label="Worker dhundo" full>
            <input value={payrollSearch} onChange={(e) => setPayrollSearch(e.target.value)} placeholder="Naam, role, ya site..." />
          </Field>
        </div>

        {payrollRows.length ? (
          <>
            {/* Desktop Table */}
            <div className="table-wrap keyboard-scroll payroll-table-wrap mt-4" tabIndex={0} onKeyDown={handleScrollableKeyDown}>
              <table>
                <thead>
                  <tr>
                    <th>Worker</th>
                    <th>Site</th>
                    <th>Present</th>
                    <th>Absent</th>
                    <th>HD</th>
                    <th>OT</th>
                    <th>Basic</th>
                    <th>Gross</th>
                    <th>PF</th>
                    <th>ESI</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div>{row.name}</div>
                        <div className="muted table-subtext">{formatCurrency(row.dailyWage)}/day</div>
                      </td>
                      <td>{row.siteName}</td>
                      <td>{row.payroll.present}</td>
                      <td>{row.payroll.absent}</td>
                      <td>{row.payroll.halfDay}</td>
                      <td>{row.payroll.overtimeDays}</td>
                      <td className="mono">{formatCurrency(row.payroll.basic)}</td>
                      <td className="mono">{formatCurrency(row.payroll.gross)}</td>
                      <td className="mono text-danger">-{formatCurrency(row.payroll.pfEmployee)}</td>
                      <td className="mono text-danger">-{formatCurrency(row.payroll.esiEmployee)}</td>
                      <td className="mono text-bold text-accent">{formatCurrency(row.payroll.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="payroll-cards">
              {payrollRows.map((row) => (
                <div className="payroll-card" key={`pc-${row.id}`}>
                  <div className="payroll-card-header">
                    <div>
                      <p className="payroll-card-name">{row.name}</p>
                      <p className="payroll-card-site">{row.siteName}</p>
                    </div>
                    <div className="payroll-card-wage">{row.role}<br />{formatCurrency(row.dailyWage)}/day</div>
                  </div>
                  <div className="payroll-card-grid">
                    <span className="p-label">Present</span><span className="p-value">{row.payroll.present} days</span>
                    <span className="p-label">Absent</span><span className="p-value">{row.payroll.absent} days</span>
                    <span className="p-label">Half day</span><span className="p-value">{row.payroll.halfDay}</span>
                    <span className="p-label">OT</span><span className="p-value">{row.payroll.overtimeDays}</span>
                    <span className="p-label">Gross</span><span className="p-value">{formatCurrency(row.payroll.gross)}</span>
                    <span className="p-label">PF</span><span className="p-deduction">-{formatCurrency(row.payroll.pfEmployee)}</span>
                    <span className="p-label">ESI</span><span className="p-deduction">-{formatCurrency(row.payroll.esiEmployee)}</span>
                  </div>
                  <div className="payroll-card-net">
                    <span className="payroll-card-net-label">NET</span>
                    <span className="payroll-card-net-value">{formatCurrency(row.payroll.net)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state mt-16">
            <div className="empty-state-icon">💰</div>
            <h4>Koi worker nahi mila</h4>
            <p>Site filter ya search change karein.</p>
          </div>
        )}

        <div className="button-row mt-16">
          <button className="btn-download" type="button" onClick={() => { downloadWages(month); showToast("Excel download shuru ho gaya!", "success"); }}>
            ⬇ Excel Download karo
          </button>
        </div>
      </div>
    );
  }

  function renderInvoice() {
    return (
      <div className="stack">
        {/* Registration warnings */}
        {missingRegs.length > 0 && (
          <div className="reg-warning">
            <div className="reg-warning-text">
              <strong>⚠ Registration missing hai</strong>
              {missingRegs.join(", ")} set nahi hai. Invoice mein blank aayega.
            </div>
            <button className="btn-ghost btn-sm" type="button" onClick={() => setTab("setup")}>
              Setup kholein →
            </button>
          </div>
        )}

        {/* Professional Invoice Document */}
        <div className="invoice-doc surface">
          {/* Header */}
          <div className="invoice-doc-header">
            <div className="invoice-doc-brand">
              <div className="invoice-doc-brand-badge">TK</div>
              <div className="invoice-doc-brand-info">
                <h3>{company.businessName || "Business Name Pending"}</h3>
                <p>{company.address || "Address not set"}</p>
                {company.ownerName && <p>{company.ownerName}</p>}
              </div>
            </div>
            <div className="invoice-doc-meta">
              <div className="inv-num">{invoiceNumber}</div>
              <div className="inv-date">{monthTitle}</div>
              {company.phone && <div className="inv-date">{company.phone}</div>}
            </div>
          </div>

          {/* From / To */}
          <div className="invoice-from-to">
            <div className="invoice-party-box">
              <h5>From</h5>
              <p><strong>{company.businessName || "Your business"}</strong></p>
              <p>{company.address || "—"}</p>
            </div>
            <div className="invoice-party-box">
              <h5>To</h5>
              <p><strong>{selectedSite?.clientName || "All active clients"}</strong></p>
              <p>{selectedSite?.name || "All sites"}</p>
            </div>
          </div>

          {/* Line Items */}
          <table className="invoice-line-items">
            <thead>
              <tr>
                <th>Description</th>
                <th className="amount">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Gross Wages ({monthModel.rows.length} workers, {monthTitle})</td>
                <td className="amount">{formatCurrency(monthModel.totals.gross)}</td>
              </tr>
              <tr>
                <td>Employer PF Contribution</td>
                <td className="amount">{formatCurrency(monthModel.totals.pfEmployer)}</td>
              </tr>
              <tr>
                <td>Employer ESI Contribution</td>
                <td className="amount">{formatCurrency(monthModel.totals.esiEmployer)}</td>
              </tr>
              <tr>
                <td>Service Charge ({monthModel.rules.serviceChargeRate}%)</td>
                <td className="amount">{formatCurrency(monthModel.totals.serviceCharge)}</td>
              </tr>
              <tr className="invoice-subtotal-row">
                <td>Sub-Total</td>
                <td className="amount">{formatCurrency(monthModel.totals.subTotal)}</td>
              </tr>
              <tr>
                <td>GST ({monthModel.rules.gstRate}%)</td>
                <td className="amount">{formatCurrency(monthModel.totals.gstAmount)}</td>
              </tr>
              <tr className="invoice-total-row">
                <td className="desc-col">TOTAL PAYABLE</td>
                <td className="amount">{formatCurrency(monthModel.totals.invoiceTotal)}</td>
              </tr>
            </tbody>
          </table>

          {/* Registrations Footer */}
          <div className="invoice-footer">
            {company.gstin && <span className="invoice-reg-item">GSTIN: {company.gstin}</span>}
            {company.pfRegistration && <span className="invoice-reg-item">PF: {company.pfRegistration}</span>}
            {company.esiRegistration && <span className="invoice-reg-item">ESI: {company.esiRegistration}</span>}
            {company.clraLicense && <span className="invoice-reg-item">CLRA: {company.clraLicense}</span>}
            <span className="invoice-reg-item">Scope: {monthModel.rows.length} workers</span>
          </div>

          {/* Actions */}
          <div className="invoice-actions">
            <button className="btn" type="button" onClick={() => { downloadInvoice(month, siteFilter); showToast("PDF download shuru ho gaya!", "success"); }}>
              ⬇ PDF Download karo
            </button>
            <button
              className="btn-whatsapp"
              type="button"
              onClick={() => {
                const msg = encodeURIComponent(`${company.businessName || "Thekedar AI"} — ${monthTitle} Invoice\nTotal: ${formatCurrency(monthModel.totals.invoiceTotal)}\nRef: ${invoiceNumber}`);
                window.open(`https://wa.me/?text=${msg}`, "_blank");
              }}
            >
              📲 WhatsApp pe bhejo
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderChat() {
    const suggestions = CHAT_SUGGESTIONS.default;
    const lastMsg = chatMessages[chatMessages.length - 1];

    return (
      <div className="chat-layout">
        {/* Chat Main Panel */}
        <div className="surface panel">
          <SectionHeader title="AI Assistant" sub="Hindi ya English mein pucho — attendance, payroll, ya invoice." help={TAB_HELP.chat} />

          {/* Bubbles */}
          <div className="chat-stack-bubbles keyboard-scroll" tabIndex={0} onKeyDown={handleScrollableKeyDown}>
            {chatMessages.map((message, index) => (
              <div className={`chat-bubble ${message.role}`} key={`${message.role}-${index}`}>
                <div className="chat-bubble-body">
                  {message.content}
                </div>
                {message.timestamp && (
                  <div className="chat-bubble-time">
                    {message.role === "user" ? "You" : "AI"} · {formatTime(message.timestamp)}
                  </div>
                )}
              </div>
            ))}
            {chatLoading ? (
              <div className="chat-bubble assistant">
                <div className="chat-bubble-body">
                  <p className="typing-dots"><span /><span /><span /></p>
                </div>
              </div>
            ) : null}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          {!chatLoading && lastMsg?.role === "assistant" && (
            <div className="chat-chips">
              {suggestions.slice(0, 4).map((chip) => (
                <button key={chip} className="chat-chip" type="button" onClick={() => setChatInput(chip)}>{chip}</button>
              ))}
            </div>
          )}

          {/* Input Row */}
          <form onSubmit={handleSendChat}>
            <div className="chat-input-row">
              <textarea
                className="chat-input-field"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(null); } }}
                placeholder="Kuch bhi pucho — Hindi ya English mein..."
                rows={1}
              />
              <button className="chat-send-btn" type="submit" disabled={chatLoading} aria-label="Send message">
                ▶
              </button>
            </div>
          </form>
        </div>

        {/* Context Panel (desktop only) */}
        <div className="surface panel chat-context-panel">
          <SectionHeader title="Chat Info" sub="AI ko yeh data dikh raha hai." />
          <div className="stack">
            <div className="mini-card">
              <h4>Scope</h4>
              <p>Month: {monthTitle}</p>
              <p>Filter: {selectedSite ? selectedSite.name : "All sites"}</p>
              <p>Workers: {monthModel.rows.length}</p>
            </div>
            <div className="mini-card">
              <h4>Quick Suggestions</h4>
              {CHAT_SUGGESTIONS.default.map((s) => (
                <button key={s} className="chat-chip chat-chip-context" type="button" onClick={() => setChatInput(s)}>{s}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderActiveTab() {
    if (tab === "setup") return renderSetup();
    if (tab === "attendance") return renderAttendance();
    if (tab === "payroll") return renderPayroll();
    if (tab === "invoice") return renderInvoice();
    if (tab === "chat") return renderChat();
    return renderDashboard();
  }

  /* ── Not authenticated ───────────────────────── */
  if (!authenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  /* ── Main App Shell ───────────────────────────── */
  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-badge">TK</div>
          <div className="brand-text">
            <h1>Thekedar AI</h1>
            <p>{company.businessName || "Your business"}</p>
            {company.ownerName && <p className="brand-owner">{company.ownerName}</p>}
          </div>
        </div>

        <div className="nav-list">
          {NAV_ITEMS.map((item) => (
            <button
              className={`nav-button${tab === item.id ? " active" : ""}`}
              key={item.id}
              onClick={() => { setTab(item.id); setMoreOpen(false); }}
              type="button"
            >
              <span className="nav-button-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-note">
          <strong>Roz ka kaam</strong>
          <p>1. Haziri lagao (Attendance)</p>
          <p>2. Payroll check karo</p>
          <p>3. Invoice download karo</p>
        </div>

        <div className="sidebar-footer">
          {logoutConfirming ? (
            <div className="logout-confirm-row">
              <span className="logout-confirm-text">Sign out karein?</span>
              <div className="logout-confirm-btns">
                <button className="btn-danger-solid" type="button" onClick={handleLogout}>Haan</button>
                <button className="btn-ghost" type="button" onClick={() => setLogoutConfirming(false)}>Nahi</button>
              </div>
            </div>
          ) : (
            <button className="btn-ghost logout-btn" type="button" onClick={() => setLogoutConfirming(true)}>
              Sign out
            </button>
          )}
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="main keyboard-scroll" ref={pageRef} tabIndex={0} onKeyDown={handleScrollableKeyDown}>
        <div className="page-header surface">
          <div className="page-header-copy">
            <div className="page-header-eyebrow">
              <p className="eyebrow">Current month only</p>
              <span className="month-lock-inline">{monthTitle}</span>
            </div>
            <h2>{NAV_ITEMS.find((i) => i.id === tab)?.label || "Dashboard"}</h2>
            <p>{company.businessName || "Configure your business in Setup"}</p>
          </div>

          <div className="toolbar">
            {/* Desktop site filter pills */}
            <div className="pill-row keyboard-scroll site-filter-desktop" tabIndex={0} onKeyDown={handleScrollableKeyDown}>
              <button className={`pill${siteFilter === "all" ? " active" : ""}`} onClick={() => setSiteFilter("all")} type="button">All sites</button>
              {sites.map((site) => (
                <button className={`pill${siteFilter === site.id ? " active" : ""}`} key={site.id} onClick={() => setSiteFilter(site.id)} type="button">{site.name}</button>
              ))}
            </div>

            {/* Mobile site filter dropdown */}
            <div className="site-filter-mobile">
              <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
                <option value="all">All sites</option>
                {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
              </select>
            </div>

            <button className="btn-ghost" onClick={() => loadBootstrap(month)} type="button" aria-label="Reload data">↺ Reload</button>
            <HelpHint text={TAB_HELP[tab]} />
          </div>
        </div>

        <div className="status-row">
          {error ? <div className="status-pill error">{error}</div> : null}
          {!error && notice ? <div className="status-pill">{notice}</div> : null}
        </div>

        {loading ? (
          <div className="loading-center">
            <div className="loading-spinner" />
            <p>Loading current month data...</p>
          </div>
        ) : (
          <div className="tab-stage">{renderActiveTab()}</div>
        )}
      </main>

      {/* ── Bottom Nav ── */}
      <nav className="bottom-nav" aria-label="Main navigation">
        {MOBILE_NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`bottom-tab${tab === item.id ? " active" : ""}`}
            onClick={() => { setTab(item.id); setMoreOpen(false); }}
            type="button"
            aria-label={item.label}
          >
            <span className="tab-icon">{item.icon}</span>
            <span className="tab-label">{item.label}</span>
            {tab === item.id && <span className="tab-active-dot" />}
          </button>
        ))}
        <button
          className={`bottom-tab${moreOpen ? " active" : ""}`}
          onClick={() => setMoreOpen((c) => !c)}
          type="button"
          aria-label="More options"
        >
          <span className="tab-icon">⋯</span>
          <span className="tab-label">More</span>
        </button>
      </nav>

      {/* ── More Sheet ── */}
      {moreOpen ? (
        <div className="more-sheet" onClick={() => setMoreOpen(false)}>
          <div className="more-sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="more-sheet-handle" />
            <div className="more-sheet-business">
              {company.businessName || "Thekedar AI"}
              {company.ownerName && <span>{company.ownerName}</span>}
            </div>
            <button className="more-item" onClick={() => { setTab("invoice"); setMoreOpen(false); }} type="button">
              <span className="more-item-icon">≡</span> Invoice
            </button>
            <button className="more-item" onClick={() => { setTab("setup"); setMoreOpen(false); }} type="button">
              <span className="more-item-icon">⚙</span> Setup
            </button>
            <div className="more-separator" />
            <button className="more-item danger" onClick={handleLogout} type="button">
              <span className="more-item-icon">⏏</span> Sign out
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Toast Notifications ── */}
      <ToastContainer toasts={toasts} />
    </div>
  );
}

export default App;
