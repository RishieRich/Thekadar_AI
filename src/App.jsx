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
  { id: "dashboard", label: "Dashboard", icon: "01" },
  { id: "setup", label: "Setup", icon: "02" },
  { id: "attendance", label: "Attendance", icon: "03" },
  { id: "payroll", label: "Payroll", icon: "04" },
  { id: "invoice", label: "Invoice", icon: "05" },
  { id: "chat", label: "AI Chat", icon: "06" },
];

const MOBILE_NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "DB" },
  { id: "attendance", label: "Haziri", icon: "AT" },
  { id: "payroll", label: "Payroll", icon: "PY" },
  { id: "chat", label: "Chat", icon: "AI" },
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

const TAB_HELP = {
  dashboard:
    "This is the month-to-date view. Keep it open for a quick read on active workers, wages, invoice value, and site performance.",
  setup:
    "Use this area for business settings, sites, and workers. The quick add box is the fastest way to load a large crew.",
  attendance:
    "Daily use should happen from the Today board. The full month register is visible, but past dates stay locked until correction mode is enabled.",
  payroll:
    "Payroll shows month-to-date wages for the current month only. Future dates are excluded until that day arrives.",
  invoice:
    "Invoice numbers are live estimates for the current month. They update as attendance, workers, and rates change.",
  chat:
    "The AI assistant sees the current month, selected site filter, workers, attendance summaries, payroll numbers, and invoice totals.",
};

const DEMO_SITE_BLUEPRINTS = [
  { name: "Harbor Green Tower", clientName: "Harbor Green Developers", location: "Vasai East" },
  { name: "Metro Fabrication Yard", clientName: "Metro Infra Works", location: "Taloja MIDC" },
  { name: "Seabird Logistics Hub", clientName: "Seabird Logistics", location: "Bhiwandi" },
];

const DEMO_FIRST_NAMES = [
  "Aakash",
  "Amit",
  "Anil",
  "Arjun",
  "Bhavesh",
  "Chandan",
  "Deepak",
  "Dilip",
  "Ganesh",
  "Imran",
  "Jitendra",
  "Karan",
  "Mahesh",
  "Mukesh",
  "Nilesh",
  "Pankaj",
  "Prakash",
  "Rahul",
  "Rajesh",
  "Rakesh",
  "Rohit",
  "Sanjay",
  "Shivam",
  "Suresh",
];

const DEMO_LAST_NAMES = [
  "Chaudhary",
  "Gaikwad",
  "Jadhav",
  "Kamble",
  "Khan",
  "Kumar",
  "Mishra",
  "Patel",
  "Pawar",
  "Rathod",
  "Sharma",
  "Singh",
];

const DEMO_ROLE_BLUEPRINTS = [
  { role: "Helper", wage: 480 },
  { role: "Welder", wage: 760 },
  { role: "Fitter", wage: 700 },
  { role: "Electrician", wage: 780 },
  { role: "Scaffolder", wage: 620 },
  { role: "Mason", wage: 680 },
];

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

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"') {
        if (inQuotes && line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  }

  const headers = parseLine(lines[0]).map((header) => header.replace(/^"|"$/g, ""));
  return lines
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => {
      const values = parseLine(line);
      return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    });
}

function matchesSearch(values, query) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return true;
  return values.join(" ").toLowerCase().includes(needle);
}

function parseBulkWorkerNames(text) {
  const seen = new Set();
  return String(text || "")
    .split(/\r?\n|,/)
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function nextAttendanceStatus(currentStatus) {
  const currentIndex = ATTENDANCE_CYCLE.indexOf(currentStatus);
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;
  return ATTENDANCE_CYCLE[(safeIndex + 1) % ATTENDANCE_CYCLE.length];
}

function isTypingTarget(target) {
  if (!target) return false;
  const tagName = target.tagName;
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || target.isContentEditable;
}

function handleScrollableKeyDown(event) {
  if (isTypingTarget(event.target)) return;
  const element = event.currentTarget;
  if (!element || typeof element.scrollBy !== "function") return;

  const horizontalStep = 96;
  const verticalStep = 72;

  if (event.key === "ArrowDown") {
    element.scrollBy({ top: verticalStep, behavior: "smooth" });
    event.preventDefault();
  } else if (event.key === "ArrowUp") {
    element.scrollBy({ top: -verticalStep, behavior: "smooth" });
    event.preventDefault();
  } else if (event.key === "PageDown") {
    element.scrollBy({ top: element.clientHeight * 0.9, behavior: "smooth" });
    event.preventDefault();
  } else if (event.key === "PageUp") {
    element.scrollBy({ top: -element.clientHeight * 0.9, behavior: "smooth" });
    event.preventDefault();
  } else if (event.key === "Home") {
    element.scrollTo({ top: 0, behavior: "smooth" });
    event.preventDefault();
  } else if (event.key === "End") {
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    event.preventDefault();
  } else if (event.key === "ArrowRight") {
    element.scrollBy({ left: horizontalStep, behavior: "smooth" });
    event.preventDefault();
  } else if (event.key === "ArrowLeft") {
    element.scrollBy({ left: -horizontalStep, behavior: "smooth" });
    event.preventDefault();
  }
}

function buildDemoImportPayload(existingSites, existingWorkersCount) {
  const existingNames = new Set(existingSites.map((site) => site.name.toLowerCase()));
  const extraSites = DEMO_SITE_BLUEPRINTS.filter((site) => !existingNames.has(site.name.toLowerCase()));
  const sitePool = [...existingSites.map((site) => site.name), ...extraSites.map((site) => site.name)];
  const workers = [];
  let sequence = existingWorkersCount + 1;

  for (const firstName of DEMO_FIRST_NAMES) {
    for (const lastName of DEMO_LAST_NAMES) {
      if (workers.length >= 72) break;
      const roleBlueprint = DEMO_ROLE_BLUEPRINTS[workers.length % DEMO_ROLE_BLUEPRINTS.length];
      workers.push({
        name: `${firstName} ${lastName}`,
        role: roleBlueprint.role,
        dailyWage: roleBlueprint.wage,
        uan: `100${String(sequence).padStart(9, "0")}`,
        esiNumber: `310${String(sequence).padStart(7, "0")}`,
        siteName: sitePool[workers.length % sitePool.length] || "",
        active: true,
      });
      sequence += 1;
    }
  }

  return { sites: extraSites, workers };
}

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

function MetricCard({ label, value, sub }) {
  return (
    <div className="surface metric-card">
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      <p className="metric-sub">{sub}</p>
    </div>
  );
}

function HelpHint({ text }) {
  return (
    <span className="help-wrap">
      <button className="help-button" type="button" aria-label="Help">
        i
      </button>
      <span className="help-popover">{text}</span>
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
      setError(loginError.message || "Galat PIN. Dobara try karo.");
      setShake(true);
      setPins(["", "", "", ""]);
      inputRefs[0].current?.focus();
      setTimeout(() => setShake(false), 450);
    } finally {
      setLoading(false);
    }
  }

  function handleDigit(index, value) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const nextPins = [...pins];
    nextPins[index] = digit;
    setPins(nextPins);

    if (digit && index < 3) inputRefs[index + 1].current?.focus();
    if (digit && index === 3) {
      const fullPin = [...nextPins.slice(0, 3), digit].join("");
      if (fullPin.length === 4) handlePinSubmit(fullPin);
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
          <p>
            Daily attendance, payroll, invoice totals, and worker setup are kept simple for
            contractor use on laptop and mobile.
          </p>
          <div className="login-points surface">
            <div className="login-point">
              <strong>Daily use</strong>
              <span>Open Attendance and mark today&apos;s crew first.</span>
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
          <h2 className="login-title">Enter your 4 digit PIN</h2>
          <p className="login-sub">Ask the admin for your contractor PIN and type it below.</p>

          <div className={`pin-inputs${shake ? " shake" : ""}`}>
            {pins.map((digit, index) => (
              <input
                key={index}
                ref={inputRefs[index]}
                className={`pin-box${digit ? " filled" : ""}`}
                type="tel"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(event) => handleDigit(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                autoFocus={index === 0}
                disabled={loading}
              />
            ))}
          </div>

          {error ? (
            <div className="status-pill error login-status">{error}</div>
          ) : (
            <div className="status-pill login-status">PIN stays active only in this browser tab.</div>
          )}

          {loading ? <p className="login-sub">Checking PIN...</p> : null}
        </div>
      </div>
    </div>
  );
}

function App() {
  const currentDate = new Date();
  const month = monthKeyFromDate(currentDate);
  const monthTitle = monthLabel(month);
  const todayDay = currentDate.getDate();
  const todayDayKey = String(todayDay);

  const pageRef = useRef(null);
  const chatEndRef = useRef(null);

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
  const [companyForm, setCompanyForm] = useState(companyFormFromCompany({}));
  const [siteForm, setSiteForm] = useState(emptySiteForm());
  const [workerForm, setWorkerForm] = useState(emptyWorkerForm());
  const [bulkWorkerForm, setBulkWorkerForm] = useState(emptyBulkWorkerForm());
  const [editingSiteId, setEditingSiteId] = useState("");
  const [editingWorkerId, setEditingWorkerId] = useState("");
  const [workerSearch, setWorkerSearch] = useState("");
  const [attendanceSearch, setAttendanceSearch] = useState("");
  const [correctionMode, setCorrectionMode] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      content:
        "Thekedar AI is ready. Ask about today attendance, payroll, invoice totals, or worker issues for the current month.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [importSitesText, setImportSitesText] = useState("");
  const [importWorkersText, setImportWorkersText] = useState("");
  const [importPreview, setImportPreview] = useState(null);
  const [importBusy, setImportBusy] = useState(false);

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
      if (siteFilter !== "all" && !data.sites.some((site) => site.id === siteFilter)) {
        setSiteFilter("all");
      }
    } catch (loadError) {
      setError(loadError.message);
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

  const selectedSite = siteFilter === "all" ? null : sites.find((site) => site.id === siteFilter);
  const siteMap = new Map(sites.map((site) => [site.id, site]));
  const monthModel = calculateMonthModel({
    company,
    sites,
    workers,
    attendanceByWorker: attendance,
    monthKey: month,
    siteId: siteFilter,
  });
  const dashboardSiteSummaries =
    siteFilter === "all"
      ? monthModel.siteSummaries
      : monthModel.siteSummaries.filter((site) => site.id === siteFilter);
  const allDays = Object.keys(createDefaultAttendanceMap(month, {}));
  const attendanceRows = monthModel.rows.filter((row) =>
    matchesSearch([row.name, row.role, row.siteName], attendanceSearch),
  );
  const visibleWorkers = workers.filter((worker) => {
    const siteName = siteMap.get(worker.siteId)?.name || "Unassigned";
    return (
      (siteFilter === "all" || worker.siteId === siteFilter) &&
      matchesSearch([worker.name, worker.role, siteName], workerSearch)
    );
  });
  const todaySummary = attendanceRows.reduce(
    (accumulator, row) => {
      const status = row.attendance[todayDayKey] || "A";
      accumulator[status] = (accumulator[status] || 0) + 1;
      return accumulator;
    },
    { P: 0, A: 0, HD: 0, OT: 0, WO: 0 },
  );
  const activeWorkers = workers.filter((worker) => worker.active).length;

  function clearMessages() {
    setError("");
    setNotice("");
  }

  function announce(message) {
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
    } finally {
      setBusy(false);
    }
  }

  function handleLogin(token) {
    setToken(token);
    setAuthenticated(true);
  }

  async function handleLogout() {
    await logout();
    clearToken();
    setAuthenticated(false);
    setMoreOpen(false);
  }

  function updateCompanyField(name, value) {
    setCompanyForm((current) => ({ ...current, [name]: value }));
  }

  function updateSiteField(name, value) {
    setSiteForm((current) => ({ ...current, [name]: value }));
  }

  function updateWorkerField(name, value) {
    setWorkerForm((current) => ({ ...current, [name]: value }));
  }

  function updateBulkWorkerField(name, value) {
    setBulkWorkerForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSaveCompany(event) {
    event.preventDefault();
    await withBusy(async () => {
      const response = await saveCompany(companyForm);
      setCompany(response.company);
      setCompanyForm(companyFormFromCompany(response.company));
      announce("Company settings saved.");
    });
  }

  async function handleSaveSite(event) {
    event.preventDefault();
    await withBusy(async () => {
      if (editingSiteId) {
        await updateSite(editingSiteId, siteForm);
        announce("Site updated.");
      } else {
        await createSite(siteForm);
        announce("Site added.");
      }

      setSiteForm(emptySiteForm());
      setEditingSiteId("");
      await loadBootstrap(month);
    });
  }

  async function handleDeleteSite(siteId) {
    if (!window.confirm("Delete this site? Workers assigned to it must be moved or removed first.")) {
      return;
    }

    await withBusy(async () => {
      await deleteSite(siteId);
      if (siteFilter === siteId) setSiteFilter("all");
      announce("Site deleted.");
      await loadBootstrap(month);
    });
  }

  async function handleSaveWorker(event) {
    event.preventDefault();
    await withBusy(async () => {
      if (editingWorkerId) {
        await updateWorker(editingWorkerId, workerForm);
        announce("Worker updated.");
      } else {
        await createWorker(workerForm);
        announce("Worker added.");
      }

      setWorkerForm(emptyWorkerForm());
      setEditingWorkerId("");
      await loadBootstrap(month);
    });
  }

  async function handleDeleteWorker(workerId) {
    if (!window.confirm("Delete this worker and all saved attendance for them?")) return;

    await withBusy(async () => {
      await deleteWorker(workerId);
      announce("Worker deleted.");
      await loadBootstrap(month);
    });
  }

  async function handleBulkAddWorkers(event) {
    event.preventDefault();
    const names = parseBulkWorkerNames(bulkWorkerForm.names);
    if (!names.length) {
      setError("Paste at least one worker name to add a crew.");
      return;
    }

    const selectedSiteName = sites.find((site) => site.id === bulkWorkerForm.siteId)?.name || "";
    const beforeCount = workers.length;

    await withBusy(async () => {
      const response = await importBatch({
        sites: [],
        workers: names.map((name) => ({
          name,
          role: bulkWorkerForm.role || "Helper",
          dailyWage: bulkWorkerForm.dailyWage || 550,
          uan: "",
          esiNumber: "",
          siteName: selectedSiteName,
          active: bulkWorkerForm.active,
        })),
      });

      const addedCount = Math.max(response.workers.length - beforeCount, 0);
      setBulkWorkerForm(emptyBulkWorkerForm());
      announce(`${addedCount} workers added in one go.`);
      await loadBootstrap(month);
    });
  }

  async function handleLoadDemoCrew() {
    if (!window.confirm("Load a large demo crew with realistic worker names and sites?")) return;

    const beforeCount = workers.length;
    const payload = buildDemoImportPayload(sites, beforeCount);

    await withBusy(async () => {
      const response = await importBatch(payload);
      const addedCount = Math.max(response.workers.length - beforeCount, 0);
      announce(`${addedCount} demo workers loaded for testing.`);
      await loadBootstrap(month);
    });
  }

  function isFutureDay(day) {
    return Number(day) > todayDay;
  }

  function isPastDay(day) {
    return Number(day) < todayDay;
  }

  function isAttendanceEditable(day) {
    if (isFutureDay(day)) return false;
    if (Number(day) === todayDay) return true;
    return correctionMode;
  }

  async function handleToggleAttendance(workerId, day, options = {}) {
    const dayKey = String(day);
    const allowPastEdit = Boolean(options.overridePastEdit);
    const dayNumber = Number(dayKey);

    if (dayNumber > todayDay) {
      setError("Future dates cannot be updated yet.");
      return;
    }

    if (dayNumber < todayDay && !allowPastEdit) {
      setError("Past dates are locked. Enable correction mode to edit older attendance.");
      return;
    }

    clearMessages();
    const currentAttendance = attendance[workerId] || createDefaultAttendanceMap(month, {});
    const nextStatus = nextAttendanceStatus(currentAttendance[dayKey]);

    setAttendance((current) => ({
      ...current,
      [workerId]: { ...currentAttendance, [dayKey]: nextStatus },
    }));

    try {
      const response = await updateAttendance({
        month,
        workerId,
        day: dayKey,
        status: nextStatus,
        overridePastEdit: allowPastEdit,
      });
      setAttendance(response.attendance);
    } catch (attendanceError) {
      setError(attendanceError.message);
      await loadBootstrap(month);
    }
  }

  async function handleSendChat(event) {
    event.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || chatLoading) return;

    const userMessage = { role: "user", content: trimmed };
    const nextMessages = [...chatMessages, userMessage];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const response = await sendChat(nextMessages, month, siteFilter);
      setChatMessages((current) => [...current, { role: "assistant", content: response.text }]);
    } catch (chatError) {
      setChatMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `AI assistant abhi available nahi hai. Internet aur GROQ_API_KEY check karo. (${chatError.message})`,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  function handleSitesFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => setImportSitesText(loadEvent.target.result || "");
    reader.readAsText(file);
  }

  function handleWorkersFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => setImportWorkersText(loadEvent.target.result || "");
    reader.readAsText(file);
  }

  function handlePreviewImport() {
    const parsedSites = importSitesText.trim() ? parseCSV(importSitesText) : [];
    const parsedWorkers = importWorkersText.trim() ? parseCSV(importWorkersText) : [];

    const mappedSites = parsedSites.map((row) => ({
      name: row["Site Name"] || row.name || "",
      clientName: row["Client Name"] || row.clientName || "",
      location: row.Location || row.location || "",
    }));

    const mappedWorkers = parsedWorkers.map((row) => ({
      name: row.Name || row.name || "",
      role: row.Role || row.role || "",
      dailyWage: row["Daily Wage"] || row.dailyWage || 0,
      uan: row.UAN || row.uan || "",
      esiNumber: row["ESI Number"] || row.esiNumber || "",
      siteName: row["Site Name"] || row.siteName || "",
    }));

    setImportPreview({ sites: mappedSites, workers: mappedWorkers });
  }

  async function handleRunImport() {
    if (!importPreview) return;
    setImportBusy(true);
    clearMessages();

    try {
      const response = await importBatch(importPreview);
      announce(
        `${response.sites.length} sites and ${response.workers.length} workers are now in the account.`,
      );
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

  function renderDashboard() {
    return (
      <div className="stack">
        <div className="surface panel hero-panel">
          <SectionHeader
            eyebrow="Month locked for daily use"
            title={`Running live for ${monthTitle}`}
            sub="The shell is focused on the current month only. Mark today from Attendance, use correction mode only when a past date truly needs fixing, and track live payroll and invoice values from here."
            help={TAB_HELP.dashboard}
            actions={
              <div className="hero-tags">
                <span className="status-pill">{monthModel.rows.length} workers in view</span>
                <span className="status-pill">{selectedSite ? selectedSite.name : "All sites"}</span>
                <span className="status-pill">{todaySummary.P} present today</span>
              </div>
            }
          />
        </div>

        <div className="grid metrics-grid">
          <MetricCard
            label="Workers In Scope"
            value={String(monthModel.rows.length)}
            sub={`${activeWorkers} active across the account`}
          />
          <MetricCard
            label="Gross Wages"
            value={formatCurrency(monthModel.totals.gross)}
            sub="Month-to-date live wage total"
          />
          <MetricCard
            label="Net Payable"
            value={formatCurrency(monthModel.totals.net)}
            sub={`PF ${formatCurrency(monthModel.totals.pfEmployee)} and ESI ${formatCurrency(monthModel.totals.esiEmployee)}`}
          />
          <MetricCard
            label="Invoice Value"
            value={formatCurrency(monthModel.totals.invoiceTotal)}
            sub={`Service charge ${monthModel.rules.serviceChargeRate}% and GST ${monthModel.rules.gstRate}%`}
          />
        </div>

        <div className="split">
          <div className="surface panel">
            <SectionHeader
              title="Site Performance"
              sub="Use the site pills in the header to focus one client or one location."
              help="This section compares worker count and live wage values site by site for the current filter."
            />
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
                      <div>
                        <span>Gross</span>
                        <strong>{formatCurrency(site.gross)}</strong>
                      </div>
                      <div>
                        <span>Net</span>
                        <strong>{formatCurrency(site.net)}</strong>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">No site is available for this filter yet.</div>
              )}
            </div>
          </div>

          <div className="surface panel">
            <SectionHeader
              title="Quick Signals"
              sub="A short operational snapshot for owner review."
              help="These cards pull from company settings and today attendance so the main dashboard stays easy to scan."
            />
            <div className="stack">
              <div className="mini-card">
                <h4>Today Attendance</h4>
                <p>Present: {todaySummary.P}</p>
                <p>Absent: {todaySummary.A}</p>
                <p>Half day: {todaySummary.HD}</p>
                <p>Overtime: {todaySummary.OT}</p>
              </div>
              <div className="mini-card">
                <h4>Compliance Snapshot</h4>
                <p>GSTIN: {company.gstin || "Not set"}</p>
                <p>PF: {company.pfRegistration || "Not set"}</p>
                <p>ESI: {company.esiRegistration || "Not set"}</p>
                <p>CLRA: {company.clraLicense || "Not set"}</p>
              </div>
              <div className="mini-card">
                <h4>Current Rules</h4>
                <p>PF cap: {formatCurrency(monthModel.rules.pfCap)}</p>
                <p>ESI threshold: {formatCurrency(monthModel.rules.esiThreshold)}</p>
                <p>Overtime multiplier: {monthModel.rules.overtimeMultiplier}x</p>
                <p>Service charge: {monthModel.rules.serviceChargeRate}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderSetup() {
    return (
      <div className="stack">
        <form className="surface panel" onSubmit={handleSaveCompany}>
          <SectionHeader
            eyebrow="Base account setup"
            title="Company Profile And Rules"
            sub="These values drive payroll, invoice numbers, and document exports. Keep them clean before daily use starts."
            help="Save company details here once, then review only when rates or registrations change."
            actions={
              <div className="status-pill">
                {company.businessName || "Business profile not filled yet"}
              </div>
            }
          />

          <div className="field-grid">
            <Field label="Business Name">
              <input
                value={companyForm.businessName}
                onChange={(event) => updateCompanyField("businessName", event.target.value)}
                placeholder="Shree Ganesh Labour Contractor"
              />
            </Field>
            <Field label="Owner Name">
              <input
                value={companyForm.ownerName}
                onChange={(event) => updateCompanyField("ownerName", event.target.value)}
              />
            </Field>
            <Field label="Phone">
              <input
                value={companyForm.phone}
                onChange={(event) => updateCompanyField("phone", event.target.value)}
              />
            </Field>
            <Field label="Email">
              <input
                value={companyForm.email}
                onChange={(event) => updateCompanyField("email", event.target.value)}
              />
            </Field>
            <Field label="Address" full>
              <textarea
                value={companyForm.address}
                onChange={(event) => updateCompanyField("address", event.target.value)}
              />
            </Field>
            <Field label="GSTIN">
              <input
                value={companyForm.gstin}
                onChange={(event) => updateCompanyField("gstin", event.target.value)}
              />
            </Field>
            <Field label="CLRA License">
              <input
                value={companyForm.clraLicense}
                onChange={(event) => updateCompanyField("clraLicense", event.target.value)}
              />
            </Field>
            <Field label="PF Registration">
              <input
                value={companyForm.pfRegistration}
                onChange={(event) => updateCompanyField("pfRegistration", event.target.value)}
              />
            </Field>
            <Field label="ESI Registration">
              <input
                value={companyForm.esiRegistration}
                onChange={(event) => updateCompanyField("esiRegistration", event.target.value)}
              />
            </Field>
            <Field label="Service Charge %">
              <input
                type="number"
                step="0.01"
                value={companyForm.serviceChargeRate}
                onChange={(event) => updateCompanyField("serviceChargeRate", event.target.value)}
              />
            </Field>
            <Field label="GST %">
              <input
                type="number"
                step="0.01"
                value={companyForm.gstRate}
                onChange={(event) => updateCompanyField("gstRate", event.target.value)}
              />
            </Field>
            <Field label="PF Employee %">
              <input
                type="number"
                step="0.01"
                value={companyForm.pfEmployeeRate}
                onChange={(event) => updateCompanyField("pfEmployeeRate", event.target.value)}
              />
            </Field>
            <Field label="PF Employer %">
              <input
                type="number"
                step="0.01"
                value={companyForm.pfEmployerRate}
                onChange={(event) => updateCompanyField("pfEmployerRate", event.target.value)}
              />
            </Field>
            <Field label="PF Wage Cap">
              <input
                type="number"
                value={companyForm.pfCap}
                onChange={(event) => updateCompanyField("pfCap", event.target.value)}
              />
            </Field>
            <Field label="ESI Employee %">
              <input
                type="number"
                step="0.01"
                value={companyForm.esiEmployeeRate}
                onChange={(event) => updateCompanyField("esiEmployeeRate", event.target.value)}
              />
            </Field>
            <Field label="ESI Employer %">
              <input
                type="number"
                step="0.01"
                value={companyForm.esiEmployerRate}
                onChange={(event) => updateCompanyField("esiEmployerRate", event.target.value)}
              />
            </Field>
            <Field label="ESI Threshold">
              <input
                type="number"
                value={companyForm.esiThreshold}
                onChange={(event) => updateCompanyField("esiThreshold", event.target.value)}
              />
            </Field>
            <Field label="OT Multiplier">
              <input
                type="number"
                step="0.01"
                value={companyForm.overtimeMultiplier}
                onChange={(event) => updateCompanyField("overtimeMultiplier", event.target.value)}
              />
            </Field>
          </div>

          <div className="button-row" style={{ marginTop: 18 }}>
            <button className="btn" type="submit" disabled={busy}>
              Save company settings
            </button>
          </div>
        </form>

        <div className="split">
          <div className="surface panel">
            <SectionHeader
              title="Sites"
              sub="Create sites first so workers can be assigned cleanly."
              help="A site keeps worker, payroll, and invoice reporting grouped correctly."
            />

            <form className="stack" onSubmit={handleSaveSite}>
              <div className="field-grid">
                <Field label="Site Name">
                  <input
                    value={siteForm.name}
                    onChange={(event) => updateSiteField("name", event.target.value)}
                    placeholder="Tema India"
                  />
                </Field>
                <Field label="Client Name">
                  <input
                    value={siteForm.clientName}
                    onChange={(event) => updateSiteField("clientName", event.target.value)}
                    placeholder="Tema India Pvt Ltd"
                  />
                </Field>
                <Field label="Location" full>
                  <input
                    value={siteForm.location}
                    onChange={(event) => updateSiteField("location", event.target.value)}
                    placeholder="Achhad, Talasari"
                  />
                </Field>
              </div>

              <div className="button-row">
                <button className="btn" type="submit" disabled={busy}>
                  {editingSiteId ? "Update site" : "Add site"}
                </button>
                {editingSiteId ? (
                  <button
                    className="btn-ghost"
                    type="button"
                    onClick={() => {
                      setEditingSiteId("");
                      setSiteForm(emptySiteForm());
                    }}
                  >
                    Cancel edit
                  </button>
                ) : null}
              </div>
            </form>

            <div className="stack" style={{ marginTop: 18 }}>
              {sites.length ? (
                sites.map((site) => (
                  <div className="list-card" key={site.id}>
                    <div className="list-header">
                      <div>
                        <h4>{site.name}</h4>
                        <p>{site.clientName || "No client name"}</p>
                      </div>
                      <div className="button-row">
                        <button
                          className="btn-ghost"
                          type="button"
                          onClick={() => {
                            setEditingSiteId(site.id);
                            setSiteForm({
                              name: site.name,
                              clientName: site.clientName,
                              location: site.location,
                            });
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-ghost btn-danger"
                          type="button"
                          onClick={() => handleDeleteSite(site.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <p className="muted" style={{ marginTop: 12 }}>
                      {site.location || "No location set"}
                    </p>
                  </div>
                ))
              ) : (
                <div className="empty-state">Add your first site to start assigning workers.</div>
              )}
            </div>
          </div>

          <div className="surface panel">
            <SectionHeader
              title="Workers"
              sub="Use quick add for large crews, then use the form below only for single edits or one-off additions."
              help="For a 50 to 100 worker contractor, the fastest flow is: create sites, paste names in quick add, then use the search box when you need edits."
              actions={<div className="status-pill">{visibleWorkers.length} shown</div>}
            />

            <div className="mini-card quick-add-card">
              <SectionHeader
                title="Quick Add Crew"
                sub="Paste one worker name per line. Shared role, wage, and site are applied to all of them."
                help="This is the easiest way to load a real contractor crew without creating workers one by one."
              />

              <form className="stack" onSubmit={handleBulkAddWorkers}>
                <Field label="Worker Names" full hint="One name per line">
                  <textarea
                    value={bulkWorkerForm.names}
                    onChange={(event) => updateBulkWorkerField("names", event.target.value)}
                    placeholder={"Ramesh Patel\nSuresh Yadav\nDinesh Kumar"}
                  />
                </Field>

                <div className="field-grid">
                  <Field label="Common Role">
                    <input
                      value={bulkWorkerForm.role}
                      onChange={(event) => updateBulkWorkerField("role", event.target.value)}
                    />
                  </Field>
                  <Field label="Daily Wage">
                    <input
                      type="number"
                      value={bulkWorkerForm.dailyWage}
                      onChange={(event) => updateBulkWorkerField("dailyWage", event.target.value)}
                    />
                  </Field>
                  <Field label="Site">
                    <select
                      value={bulkWorkerForm.siteId}
                      onChange={(event) => updateBulkWorkerField("siteId", event.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {sites.map((site) => (
                        <option key={site.id} value={site.id}>
                          {site.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select
                      value={bulkWorkerForm.active ? "active" : "inactive"}
                      onChange={(event) =>
                        updateBulkWorkerField("active", event.target.value === "active")
                      }
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </Field>
                </div>

                <div className="button-row">
                  <button className="btn" type="submit" disabled={busy}>
                    Add pasted crew
                  </button>
                  <button className="btn-ghost" type="button" onClick={handleLoadDemoCrew} disabled={busy}>
                    Load 72 demo workers
                  </button>
                </div>
              </form>
            </div>

            <form className="stack" onSubmit={handleSaveWorker} style={{ marginTop: 18 }}>
              <SectionHeader
                title={editingWorkerId ? "Edit Single Worker" : "Add Single Worker"}
                sub="Use this form for one worker at a time."
                help="Single worker mode is best for quick corrections after the crew already exists."
              />

              <div className="field-grid">
                <Field label="Worker Name">
                  <input
                    value={workerForm.name}
                    onChange={(event) => updateWorkerField("name", event.target.value)}
                    placeholder="Ramesh Patel"
                  />
                </Field>
                <Field label="Role">
                  <input
                    value={workerForm.role}
                    onChange={(event) => updateWorkerField("role", event.target.value)}
                    placeholder="Fitter"
                  />
                </Field>
                <Field label="Daily Wage">
                  <input
                    type="number"
                    value={workerForm.dailyWage}
                    onChange={(event) => updateWorkerField("dailyWage", event.target.value)}
                    placeholder="650"
                  />
                </Field>
                <Field label="Site">
                  <select
                    value={workerForm.siteId}
                    onChange={(event) => updateWorkerField("siteId", event.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="UAN">
                  <input
                    value={workerForm.uan}
                    onChange={(event) => updateWorkerField("uan", event.target.value)}
                  />
                </Field>
                <Field label="ESI Number">
                  <input
                    value={workerForm.esiNumber}
                    onChange={(event) => updateWorkerField("esiNumber", event.target.value)}
                  />
                </Field>
                <Field label="Status">
                  <select
                    value={workerForm.active ? "active" : "inactive"}
                    onChange={(event) => updateWorkerField("active", event.target.value === "active")}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </Field>
              </div>

              <div className="button-row">
                <button className="btn" type="submit" disabled={busy}>
                  {editingWorkerId ? "Update worker" : "Add worker"}
                </button>
                {editingWorkerId ? (
                  <button
                    className="btn-ghost"
                    type="button"
                    onClick={() => {
                      setEditingWorkerId("");
                      setWorkerForm(emptyWorkerForm());
                    }}
                  >
                    Cancel edit
                  </button>
                ) : null}
              </div>
            </form>

            <div className="workers-toolbar">
              <Field label="Search Workers" full>
                <input
                  value={workerSearch}
                  onChange={(event) => setWorkerSearch(event.target.value)}
                  placeholder="Search by worker, role, or site"
                />
              </Field>
            </div>

            {visibleWorkers.length ? (
              <div
                className="table-wrap keyboard-scroll"
                tabIndex={0}
                onKeyDown={handleScrollableKeyDown}
                style={{ marginTop: 16 }}
              >
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
                      const workerSite = siteMap.get(worker.siteId);
                      return (
                        <tr key={worker.id}>
                          <td>
                            <div>{worker.name}</div>
                            <div className="muted table-subtext">
                              UAN {worker.uan || "not set"} and ESI {worker.esiNumber || "not set"}
                            </div>
                          </td>
                          <td>{worker.role || "No role"}</td>
                          <td>{workerSite?.name || "Unassigned"}</td>
                          <td className="mono">{formatCurrency(worker.dailyWage)}</td>
                          <td>{worker.active ? "Active" : "Inactive"}</td>
                          <td>
                            <div className="button-row tight">
                              <button
                                className="btn-ghost"
                                type="button"
                                onClick={() => {
                                  setEditingWorkerId(worker.id);
                                  setWorkerForm({
                                    name: worker.name,
                                    role: worker.role,
                                    dailyWage: worker.dailyWage,
                                    uan: worker.uan,
                                    esiNumber: worker.esiNumber,
                                    siteId: worker.siteId,
                                    active: worker.active,
                                  });
                                  pageRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="btn-ghost btn-danger"
                                type="button"
                                onClick={() => handleDeleteWorker(worker.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state" style={{ marginTop: 16 }}>
                No worker matches this search or site filter yet.
              </div>
            )}
          </div>
        </div>

        <div className="surface panel">
          <SectionHeader
            title="Bulk Import From CSV"
            sub="Use this once when you already have site and worker lists in Excel."
            help="CSV import is still useful for very large onboarding. The quick add box above is better for day-to-day use."
          />

          <div className="import-templates">
            <a
              className="btn-ghost"
              href="data:text/csv;charset=utf-8,Site Name,Client Name,Location%0ATema India,Tema India Pvt Ltd,Achhad Talasari"
              download="sites_template.csv"
            >
              Download sites template
            </a>
            <a
              className="btn-ghost"
              href="data:text/csv;charset=utf-8,Name,Role,Daily Wage,UAN,ESI Number,Site Name%0ARamesh Patel,Fitter,650,100123456789,3112345678,Tema India"
              download="workers_template.csv"
            >
              Download workers template
            </a>
          </div>

          <div className="split import-grid">
            <Field label="Sites CSV">
              <input type="file" accept=".csv,text/csv" onChange={handleSitesFileChange} />
            </Field>
            <Field label="Workers CSV">
              <input type="file" accept=".csv,text/csv" onChange={handleWorkersFileChange} />
            </Field>
          </div>

          <div className="button-row" style={{ marginTop: 12 }}>
            <button
              className="btn-ghost"
              type="button"
              onClick={handlePreviewImport}
              disabled={!importSitesText && !importWorkersText}
            >
              Preview import
            </button>
          </div>

          {importPreview ? (
            <div className="import-preview stack">
              <p>
                <strong>{importPreview.sites.length}</strong> sites and{" "}
                <strong>{importPreview.workers.length}</strong> workers are ready to import.
              </p>

              {importPreview.sites.length ? (
                <div className="mini-card">
                  <h4>Sites</h4>
                  {importPreview.sites.map((site, index) => (
                    <p key={`${site.name}-${index}`}>
                      {site.name} - {site.clientName || "No client"}
                    </p>
                  ))}
                </div>
              ) : null}

              {importPreview.workers.length ? (
                <div className="mini-card">
                  <h4>Workers</h4>
                  {importPreview.workers.slice(0, 10).map((worker, index) => (
                    <p key={`${worker.name}-${index}`}>
                      {worker.name} ({worker.role || "No role"}) - {worker.siteName || "Unassigned"} -
                      {" "}{worker.dailyWage}/day
                    </p>
                  ))}
                  {importPreview.workers.length > 10 ? (
                    <p className="muted">
                      ...and {importPreview.workers.length - 10} more workers
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="button-row">
                <button className="btn" type="button" onClick={handleRunImport} disabled={importBusy}>
                  {importBusy ? "Importing..." : "Confirm import"}
                </button>
                <button className="btn-ghost" type="button" onClick={() => setImportPreview(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  function renderAttendance() {
    return (
      <div className="stack">
        <div className="surface panel">
          <SectionHeader
            eyebrow="Daily attendance first"
            title="Today Board"
            sub="This is the fastest daily flow. Touch any status card to cycle through P, A, HD, OT, and WO for today only."
            help="Past dates stay locked in normal mode. Use the correction switch below only when you must fix an older entry."
            actions={
              <div className="hero-tags">
                <span className="status-pill">Today is day {todayDay}</span>
                <span className="status-pill">{todaySummary.P} present</span>
                <span className="status-pill">{todaySummary.OT} OT</span>
              </div>
            }
          />

          <div className="attendance-toolbar">
            <Field label="Find Worker" full>
              <input
                value={attendanceSearch}
                onChange={(event) => setAttendanceSearch(event.target.value)}
                placeholder="Search by worker, role, or site"
              />
            </Field>
          </div>

          <div className="legend-row">
            {ATTENDANCE_CYCLE.map((status) => (
              <span key={status} className={`legend-chip status-${status}`}>
                {status} - {STATUS_LABELS[status]}
              </span>
            ))}
          </div>

          {attendanceRows.length ? (
            <div className="today-board">
              {attendanceRows.map((row) => (
                <div className="today-card surface" key={`today-${row.id}`}>
                  <div className="today-card-copy">
                    <h4>{row.name}</h4>
                    <p>
                      {row.role || "No role"} and {row.siteName}
                    </p>
                  </div>
                  <button
                    className={`today-status-btn status-${row.attendance[todayDayKey]}`}
                    type="button"
                    onClick={() => handleToggleAttendance(row.id, todayDayKey)}
                  >
                    <span>{row.attendance[todayDayKey]}</span>
                    <small>{STATUS_LABELS[row.attendance[todayDayKey]]}</small>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ marginTop: 16 }}>
              No worker matches the current search or site filter.
            </div>
          )}
        </div>

        <div className="surface panel">
          <SectionHeader
            title="Month Register"
            sub={
              correctionMode
                ? "Correction mode is ON. Past dates in the current month can be edited. Future dates still stay locked."
                : "Only today's date is editable in normal mode. Past dates are visible but locked."
            }
            help="This full register stays visible for review, but safe editing is restricted so old entries are not changed by mistake."
            actions={
              <div className="button-row">
                <button
                  className={`btn-ghost${correctionMode ? " active-toggle" : ""}`}
                  type="button"
                  onClick={() => setCorrectionMode((current) => !current)}
                >
                  {correctionMode ? "Close correction mode" : "Enable past-date correction"}
                </button>
              </div>
            }
          />

          <div
            className="table-wrap keyboard-scroll"
            tabIndex={0}
            onKeyDown={handleScrollableKeyDown}
            style={{ marginTop: 16 }}
          >
            <table className="attendance-table">
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Site</th>
                  {allDays.map((day) => (
                    <th
                      className={`attendance-cell${Number(day) === todayDay ? " attendance-col-today" : ""}`}
                      key={day}
                    >
                      {day}
                    </th>
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
                        <td
                          className={`attendance-cell${Number(day) === todayDay ? " attendance-col-today" : ""}`}
                          key={`${row.id}-${day}`}
                        >
                          <button
                            className={`attendance-chip status-${displayStatus}${editable ? "" : " locked"}${future ? " future" : ""}`}
                            onClick={() =>
                              handleToggleAttendance(row.id, day, {
                                overridePastEdit: correctionMode && isPastDay(day),
                              })
                            }
                            type="button"
                            disabled={!editable}
                            title={
                              future
                                ? "Future date"
                                : editable
                                  ? STATUS_LABELS[displayStatus]
                                  : "Locked. Enable correction mode for older dates."
                            }
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
      </div>
    );
  }

  function renderPayroll() {
    return (
      <div className="surface panel">
        <SectionHeader
          eyebrow="Month-to-date payroll"
          title="Payroll Breakdown"
          sub="This report is locked to the current month and excludes future dates until they arrive."
          help={TAB_HELP.payroll}
          actions={<div className="status-pill">{monthTitle}</div>}
        />

        {monthModel.rows.length ? (
          <div
            className="table-wrap keyboard-scroll"
            tabIndex={0}
            onKeyDown={handleScrollableKeyDown}
            style={{ marginTop: 16 }}
          >
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
                {monthModel.rows.map((row) => (
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
                    <td className="mono">-{formatCurrency(row.payroll.pfEmployee)}</td>
                    <td className="mono">-{formatCurrency(row.payroll.esiEmployee)}</td>
                    <td className="mono">{formatCurrency(row.payroll.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state" style={{ marginTop: 16 }}>
            No worker is available for this site filter.
          </div>
        )}

        <div className="button-row" style={{ marginTop: 16 }}>
          <button className="btn-ghost" type="button" onClick={() => downloadWages(month)}>
            Download Excel
          </button>
        </div>
      </div>
    );
  }

  function renderInvoice() {
    return (
      <div className="split">
        <div className="surface panel">
          <SectionHeader
            eyebrow="Live billing snapshot"
            title="Invoice Summary"
            sub="These values move with attendance, worker count, and company rules during the current month."
            help={TAB_HELP.invoice}
          />
          <div className="stack">
            <div className="mini-card">
              <h4>{company.businessName || "Business name pending"}</h4>
              <p>{company.address || "Add the company address in Setup."}</p>
              <p style={{ marginTop: 10 }}>
                Client: {selectedSite?.clientName || "All active clients"}
              </p>
            </div>
            <div className="mini-card">
              <h4>Line Items</h4>
              <p>Gross wages: {formatCurrency(monthModel.totals.gross)}</p>
              <p>Employer PF: {formatCurrency(monthModel.totals.pfEmployer)}</p>
              <p>Employer ESI: {formatCurrency(monthModel.totals.esiEmployer)}</p>
              <p>
                Service charge ({monthModel.rules.serviceChargeRate}%):{" "}
                {formatCurrency(monthModel.totals.serviceCharge)}
              </p>
              <p>Sub-total: {formatCurrency(monthModel.totals.subTotal)}</p>
              <p>GST ({monthModel.rules.gstRate}%): {formatCurrency(monthModel.totals.gstAmount)}</p>
            </div>
          </div>
        </div>

        <div className="surface panel">
          <SectionHeader
            title="Total Payable"
            sub="This is the current month invoice estimate for the selected site scope."
            help="Use the site filter in the page header when you want one client instead of all active sites."
            actions={<div className="status-pill">{monthTitle}</div>}
          />

          <p className="metric-value" style={{ marginTop: 12 }}>
            {formatCurrency(monthModel.totals.invoiceTotal)}
          </p>
          <p className="muted">Driven by active workers, month-to-date attendance, and the rules saved in Setup.</p>

          <div className="stack" style={{ marginTop: 18 }}>
            <div className="mini-card">
              <h4>Registrations To Print</h4>
              <p>GSTIN: {company.gstin || "Not set"}</p>
              <p>PF: {company.pfRegistration || "Not set"}</p>
              <p>ESI: {company.esiRegistration || "Not set"}</p>
              <p>CLRA: {company.clraLicense || "Not set"}</p>
            </div>
            <div className="mini-card">
              <h4>Scope</h4>
              <p>{monthTitle}</p>
              <p>{monthModel.rows.length} workers in view</p>
              <p>{selectedSite ? `Filtered to ${selectedSite.name}` : "All sites included"}</p>
            </div>
          </div>

          <div className="button-row" style={{ marginTop: 16 }}>
            <button className="btn" type="button" onClick={() => downloadInvoice(month, siteFilter)}>
              Download PDF
            </button>
            <button
              className="btn-ghost"
              type="button"
              onClick={() => {
                const message = encodeURIComponent(
                  `${company.businessName || "Thekedar AI"} invoice for ${monthTitle}: Total Rs.${monthModel.totals.invoiceTotal.toLocaleString("en-IN")}`,
                );
                window.open(`https://wa.me/?text=${message}`, "_blank");
              }}
            >
              WhatsApp share
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderChat() {
    return (
      <div className="split">
        <div className="surface panel">
          <SectionHeader
            title="Operations Assistant"
            sub="Ask in Hindi or English about attendance, payroll, invoice totals, or worker planning."
            help={TAB_HELP.chat}
          />

          <div
            className="chat-stack keyboard-scroll"
            tabIndex={0}
            onKeyDown={handleScrollableKeyDown}
          >
            {chatMessages.map((message, index) => (
              <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
                <small>{message.role === "assistant" ? "Assistant" : "You"}</small>
                <p>{message.content}</p>
              </div>
            ))}
            {chatLoading ? (
              <div className="chat-message assistant">
                <small>Assistant</small>
                <p className="typing-dots">
                  <span />
                  <span />
                  <span />
                </p>
              </div>
            ) : null}
            <div ref={chatEndRef} />
          </div>

          {!chatLoading && chatMessages[chatMessages.length - 1]?.role === "assistant" ? (
            <div className="chat-chips">
              {["Aaj kitne log aaye?", "Payroll batao", "Invoice total kya hai?"].map((chip) => (
                <button
                  key={chip}
                  className="chat-chip"
                  type="button"
                  onClick={() => setChatInput(chip)}
                >
                  {chip}
                </button>
              ))}
            </div>
          ) : null}

          <form className="stack" onSubmit={handleSendChat} style={{ marginTop: 16 }}>
            <Field label="Ask Anything" full>
              <textarea
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Aaj kitne log aaye? Rajesh ki tankhwah kitni bani? Invoice total batao."
              />
            </Field>
            <div className="button-row">
              <button className="btn" type="submit" disabled={chatLoading}>
                Send
              </button>
            </div>
          </form>
        </div>

        <div className="surface panel">
          <SectionHeader
            title="Chat Context"
            sub="This is the data scope sent to the assistant."
            help="If a reply looks wrong, first check the selected site filter and whether today attendance is updated."
          />
          <div className="stack">
            <div className="mini-card">
              <h4>Scope</h4>
              <p>Month: {monthTitle}</p>
              <p>Filter: {selectedSite ? selectedSite.name : "All sites"}</p>
              <p>Workers in context: {monthModel.rows.length}</p>
            </div>
            <div className="mini-card">
              <h4>Assistant Can Use</h4>
              <p>Company profile and rules</p>
              <p>Sites and workers</p>
              <p>Attendance summaries and payroll totals</p>
              <p>Invoice totals for the current filter</p>
            </div>
            <div className="mini-card">
              <h4>Required Env</h4>
              <p className="mono">GROQ_API_KEY</p>
              <p className="mono">GROQ_MODEL (optional)</p>
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

  if (!authenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-badge">TK</div>
          <div>
            <h1>Thekedar AI</h1>
            <p>{company.businessName || "Your business"}</p>
          </div>
        </div>

        <div className="nav-list">
          {NAV_ITEMS.map((item) => (
            <button
              className={`nav-button${tab === item.id ? " active" : ""}`}
              key={item.id}
              onClick={() => {
                setTab(item.id);
                setMoreOpen(false);
              }}
              type="button"
            >
              <span className="mono">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-note">
          <strong>Daily recommended flow</strong>
          <p>1. Open Attendance and mark today.</p>
          <p>2. Check Dashboard or Payroll.</p>
          <p>3. Use correction mode only for older dates.</p>
        </div>

        <div className="sidebar-footer">
          <button className="btn-ghost logout-btn" type="button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <main
        className="main keyboard-scroll"
        ref={pageRef}
        tabIndex={0}
        onKeyDown={handleScrollableKeyDown}
      >
        <div className="page-header surface">
          <div className="page-header-copy">
            <p className="eyebrow">Current month only</p>
            <h2>{NAV_ITEMS.find((item) => item.id === tab)?.label || "Dashboard"}</h2>
            <p>
              {company.businessName || "Configure your business in Setup"} and use {monthTitle} as
              the live working month.
            </p>
          </div>

          <div className="toolbar">
            <div className="month-lock">
              <span className="field-hint">Month locked</span>
              <strong>{monthTitle}</strong>
            </div>

            <div className="pill-row keyboard-scroll" tabIndex={0} onKeyDown={handleScrollableKeyDown}>
              <button
                className={`pill${siteFilter === "all" ? " active" : ""}`}
                onClick={() => setSiteFilter("all")}
                type="button"
              >
                All sites
              </button>
              {sites.map((site) => (
                <button
                  className={`pill${siteFilter === site.id ? " active" : ""}`}
                  key={site.id}
                  onClick={() => setSiteFilter(site.id)}
                  type="button"
                >
                  {site.name}
                </button>
              ))}
            </div>

            <button className="btn-ghost" onClick={() => loadBootstrap(month)} type="button">
              Reload
            </button>
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

      <nav className="bottom-nav">
        {MOBILE_NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`bottom-tab${tab === item.id ? " active" : ""}`}
            onClick={() => {
              setTab(item.id);
              setMoreOpen(false);
            }}
            type="button"
          >
            <span className="tab-icon">{item.icon}</span>
            <span className="tab-label">{item.label}</span>
          </button>
        ))}
        <button
          className={`bottom-tab${moreOpen ? " active" : ""}`}
          onClick={() => setMoreOpen((current) => !current)}
          type="button"
        >
          <span className="tab-icon">...</span>
          <span className="tab-label">More</span>
        </button>
      </nav>

      {moreOpen ? (
        <div className="more-sheet" onClick={() => setMoreOpen(false)}>
          <div className="more-sheet-content" onClick={(event) => event.stopPropagation()}>
            <button
              className="more-item"
              onClick={() => {
                setTab("invoice");
                setMoreOpen(false);
              }}
              type="button"
            >
              Invoice
            </button>
            <button
              className="more-item"
              onClick={() => {
                setTab("setup");
                setMoreOpen(false);
              }}
              type="button"
            >
              Setup
            </button>
            <button className="more-item danger" onClick={handleLogout} type="button">
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
