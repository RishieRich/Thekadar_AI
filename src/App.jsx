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

const ATTENDANCE_CYCLE = ["P", "A", "HD", "OT", "WO"];

function emptySiteForm() {
  return { name: "", clientName: "", location: "" };
}

function emptyWorkerForm() {
  return { name: "", role: "", dailyWage: "", uan: "", esiNumber: "", siteId: "", active: true };
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

// ---------------------------------------------------------------------------
// Simple CSV parser (handles quoted fields with commas)
// ---------------------------------------------------------------------------
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().split("\n");
  if (lines.length < 2) return [];

  function parseLine(line) {
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    values.push(current.trim());
    return values;
  }

  const headers = parseLine(lines[0]).map((h) => h.replace(/^"|"$/g, ""));
  return lines.slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const values = parseLine(line);
      return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
    });
}

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------
function Field({ label, children, full = false }) {
  return (
    <div className={`field${full ? " full" : ""}`}>
      <label>{label}</label>
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

// ---------------------------------------------------------------------------
// Login page
// ---------------------------------------------------------------------------
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
    } catch (err) {
      setError(err.message || "Galat PIN — dobara try karo");
      setShake(true);
      setPins(["", "", "", ""]);
      inputRefs[0].current?.focus();
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  }

  function handleDigit(index, value) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newPins = [...pins];
    newPins[index] = digit;
    setPins(newPins);
    if (digit && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
    if (digit && index === 3) {
      const fullPin = [...newPins.slice(0, 3), digit].join("");
      if (fullPin.length === 4) handlePinSubmit(fullPin);
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === "Backspace" && !pins[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  }

  return (
    <div className="login-page">
      <div className={`login-card surface${shake ? " shake" : ""}`}>
        <div className="brand-badge" style={{ margin: "0 auto 18px" }}>⚡</div>
        <h1 className="login-title">Thekedar AI</h1>
        <p className="login-sub">Apna PIN daalo</p>
        <div className={`pin-inputs${shake ? " shake" : ""}`}>
          {pins.map((digit, i) => (
            <input
              key={i}
              ref={inputRefs[i]}
              className={`pin-box${digit ? " filled" : ""}`}
              type="tel"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigit(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              autoFocus={i === 0}
              disabled={loading}
            />
          ))}
        </div>
        {error && <div className="status-pill error" style={{ justifyContent: "center" }}>{error}</div>}
        {loading && <p className="login-sub">Checking...</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main app
// ---------------------------------------------------------------------------
function App() {
  const [authenticated, setAuthenticated] = useState(() => Boolean(getToken()));
  const [tab, setTab] = useState("dashboard");
  const [moreOpen, setMoreOpen] = useState(false);
  const [month, setMonth] = useState(monthKeyFromDate());
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
  const [editingSiteId, setEditingSiteId] = useState("");
  const [editingWorkerId, setEditingWorkerId] = useState("");
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      content:
        "Thekedar AI is ready. Ask about attendance, payroll, invoice totals, or worker issues for the selected month.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // CSV import state
  const [importSitesText, setImportSitesText] = useState("");
  const [importWorkersText, setImportWorkersText] = useState("");
  const [importPreview, setImportPreview] = useState(null);
  const [importBusy, setImportBusy] = useState(false);

  function handleLogin(token) {
    setToken(token);
    setAuthenticated(true);
  }

  async function handleLogout() {
    await logout();
    clearToken();
    setAuthenticated(false);
  }

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
      if (siteFilter !== "all" && !data.sites.some((s) => s.id === siteFilter)) {
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
  }, [month, authenticated]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  const monthModel = calculateMonthModel({
    company,
    sites,
    workers,
    attendanceByWorker: attendance,
    monthKey: month,
    siteId: siteFilter,
  });

  const selectedSite = siteFilter === "all" ? null : sites.find((s) => s.id === siteFilter);

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

  function updateCompanyField(name, value) {
    setCompanyForm((c) => ({ ...c, [name]: value }));
  }

  function updateSiteField(name, value) {
    setSiteForm((c) => ({ ...c, [name]: value }));
  }

  function updateWorkerField(name, value) {
    setWorkerForm((c) => ({ ...c, [name]: value }));
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
    if (!window.confirm("Delete this worker and all stored attendance for them?")) return;
    await withBusy(async () => {
      await deleteWorker(workerId);
      announce("Worker deleted.");
      await loadBootstrap(month);
    });
  }

  async function handleToggleAttendance(workerId, day) {
    const currentAttendance = attendance[workerId] || createDefaultAttendanceMap(month, {});
    const currentStatus = currentAttendance[String(day)];
    const nextStatus =
      ATTENDANCE_CYCLE[(ATTENDANCE_CYCLE.indexOf(currentStatus) + 1) % ATTENDANCE_CYCLE.length];

    setAttendance((current) => ({
      ...current,
      [workerId]: { ...currentAttendance, [day]: nextStatus },
    }));

    try {
      const response = await updateAttendance({ month, workerId, day, status: nextStatus });
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
        { role: "assistant", content: `AI assistant abhi available nahi hai. Internet aur GROQ_API_KEY check karo. (${chatError.message})` },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // CSV import helpers
  // ---------------------------------------------------------------------------

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

    const mappedSites = parsedSites.map((row) => ({
      name: row["Site Name"] || row.name || "",
      clientName: row["Client Name"] || row.clientName || "",
      location: row["Location"] || row.location || "",
    }));

    const mappedWorkers = parsedWorkers.map((row) => ({
      name: row["Name"] || row.name || "",
      role: row["Role"] || row.role || "",
      dailyWage: row["Daily Wage"] || row.dailyWage || 0,
      uan: row["UAN"] || row.uan || "",
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
      const result = await importBatch(importPreview);
      announce(
        `Import complete. Total sites: ${result.imported.sites}, total workers: ${result.imported.workers}.`,
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

  // ---------------------------------------------------------------------------
  // Tab renderers
  // ---------------------------------------------------------------------------

  function renderDashboard() {
    return (
      <div className="stack">
        <div className="grid metrics-grid">
          <MetricCard
            label="Workers"
            value={String(monthModel.rows.length)}
            sub={selectedSite ? `${selectedSite.name} only` : "Across all sites"}
          />
          <MetricCard
            label="Gross Wages"
            value={formatCurrency(monthModel.totals.gross)}
            sub={`${monthModel.totals.present} present days logged`}
          />
          <MetricCard
            label="Net Payable"
            value={formatCurrency(monthModel.totals.net)}
            sub={`PF ${formatCurrency(monthModel.totals.pfEmployee)} and ESI ${formatCurrency(monthModel.totals.esiEmployee)}`}
          />
          <MetricCard
            label="Invoice Total"
            value={formatCurrency(monthModel.totals.invoiceTotal)}
            sub={`GST ${formatCurrency(monthModel.totals.gstAmount)}`}
          />
        </div>

        <div className="split">
          <div className="surface panel">
            <h3 className="section-title">Site Performance</h3>
            <div className="stack">
              {monthModel.siteSummaries.map((site) => (
                <div className="list-card" key={site.id}>
                  <div className="list-header">
                    <div>
                      <h4>{site.name}</h4>
                      <p>{site.clientName || "No client name yet"}</p>
                    </div>
                    <div className="mono">{site.workerCount} workers</div>
                  </div>
                  <p className="muted" style={{ marginTop: 12 }}>
                    Gross {formatCurrency(site.gross)}. Net {formatCurrency(site.net)}.
                  </p>
                </div>
              ))}
              {!monthModel.siteSummaries.length && (
                <div className="empty-state">Koi site nahi hai. Setup mein site add karo.</div>
              )}
            </div>
          </div>

          <div className="surface panel">
            <h3 className="section-title">Compliance Snapshot</h3>
            <div className="stack">
              <div className="mini-card">
                <h4>{company.businessName || "Business name pending"}</h4>
                <p>{company.address || "Add address and registrations in Setup."}</p>
              </div>
              <div className="mini-card">
                <h4>Registrations</h4>
                <p>GSTIN: {company.gstin || "Not set"}</p>
                <p>PF: {company.pfRegistration || "Not set"}</p>
                <p>ESI: {company.esiRegistration || "Not set"}</p>
                <p>CLRA: {company.clraLicense || "Not set"}</p>
              </div>
              <div className="mini-card">
                <h4>Current Rules</h4>
                <p>Service charge: {monthModel.rules.serviceChargeRate}%</p>
                <p>GST: {monthModel.rules.gstRate}%</p>
                <p>PF cap: {formatCurrency(monthModel.rules.pfCap)}</p>
                <p>OT multiplier: {monthModel.rules.overtimeMultiplier}x</p>
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
          <h3 className="section-title">Company Profile And Rules</h3>
          <div className="field-grid">
            <Field label="Business Name">
              <input
                value={companyForm.businessName}
                onChange={(e) => updateCompanyField("businessName", e.target.value)}
                placeholder="Shree Ganesh Labour Contractor"
              />
            </Field>
            <Field label="Owner Name">
              <input value={companyForm.ownerName} onChange={(e) => updateCompanyField("ownerName", e.target.value)} />
            </Field>
            <Field label="Phone">
              <input value={companyForm.phone} onChange={(e) => updateCompanyField("phone", e.target.value)} />
            </Field>
            <Field label="Email">
              <input value={companyForm.email} onChange={(e) => updateCompanyField("email", e.target.value)} />
            </Field>
            <Field label="Address" full>
              <textarea value={companyForm.address} onChange={(e) => updateCompanyField("address", e.target.value)} />
            </Field>
            <Field label="GSTIN">
              <input value={companyForm.gstin} onChange={(e) => updateCompanyField("gstin", e.target.value)} />
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
          <div className="button-row" style={{ marginTop: 16 }}>
            <button className="btn" type="submit" disabled={busy}>Save company settings</button>
          </div>
        </form>

        <div className="split">
          <div className="surface panel">
            <h3 className="section-title">Sites</h3>
            <form className="stack" onSubmit={handleSaveSite}>
              <div className="field-grid">
                <Field label="Site Name">
                  <input value={siteForm.name} onChange={(e) => updateSiteField("name", e.target.value)} placeholder="Tema India" />
                </Field>
                <Field label="Client Name">
                  <input value={siteForm.clientName} onChange={(e) => updateSiteField("clientName", e.target.value)} placeholder="Tema India" />
                </Field>
                <Field label="Location" full>
                  <input value={siteForm.location} onChange={(e) => updateSiteField("location", e.target.value)} placeholder="Achhad, Talasari" />
                </Field>
              </div>
              <div className="button-row">
                <button className="btn" type="submit" disabled={busy}>
                  {editingSiteId ? "Update site" : "Add site"}
                </button>
                {editingSiteId && (
                  <button
                    className="btn-ghost"
                    type="button"
                    onClick={() => { setEditingSiteId(""); setSiteForm(emptySiteForm()); }}
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            </form>

            <div className="stack" style={{ marginTop: 18 }}>
              {sites.map((site) => (
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
                          setSiteForm({ name: site.name, clientName: site.clientName, location: site.location });
                        }}
                      >
                        Edit
                      </button>
                      <button className="btn-ghost btn-danger" type="button" onClick={() => handleDeleteSite(site.id)}>Delete</button>
                    </div>
                  </div>
                  <p className="muted" style={{ marginTop: 12 }}>{site.location || "No location set"}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="surface panel">
            <h3 className="section-title">Workers</h3>
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
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>{site.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="UAN">
                  <input value={workerForm.uan} onChange={(e) => updateWorkerField("uan", e.target.value)} />
                </Field>
                <Field label="ESI Number">
                  <input value={workerForm.esiNumber} onChange={(e) => updateWorkerField("esiNumber", e.target.value)} />
                </Field>
                <Field label="Status">
                  <select
                    value={workerForm.active ? "active" : "inactive"}
                    onChange={(e) => updateWorkerField("active", e.target.value === "active")}
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
                {editingWorkerId && (
                  <button
                    className="btn-ghost"
                    type="button"
                    onClick={() => { setEditingWorkerId(""); setWorkerForm(emptyWorkerForm()); }}
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            </form>

            <div className="stack" style={{ marginTop: 18 }}>
              {workers.map((worker) => {
                const workerSite = sites.find((s) => s.id === worker.siteId);
                return (
                  <div className="list-card" key={worker.id}>
                    <div className="list-header">
                      <div>
                        <h4>{worker.name}</h4>
                        <p>{worker.role || "No role"} - {workerSite?.name || "Unassigned"}</p>
                      </div>
                      <div className="button-row">
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
                          }}
                        >
                          Edit
                        </button>
                        <button className="btn-ghost btn-danger" type="button" onClick={() => handleDeleteWorker(worker.id)}>Delete</button>
                      </div>
                    </div>
                    <p className="muted" style={{ marginTop: 12 }}>
                      {formatCurrency(worker.dailyWage)} per day - {worker.active ? "Active" : "Inactive"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* CSV Import Section */}
        <div className="surface panel">
          <h3 className="section-title">Bulk Import from CSV</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            One-time setup: upload CSV files to populate sites and workers. Existing entries with
            the same name are skipped. Download the sample templates below.
          </p>

          <div className="import-templates" style={{ marginTop: 12 }}>
            <a
              className="btn-ghost"
              href="data:text/csv;charset=utf-8,Site Name,Client Name,Location%0ATema India,Tema India Pvt Ltd,Achhad Talasari"
              download="sites_template.csv"
            >
              Download Sites Template
            </a>
            <a
              className="btn-ghost"
              href="data:text/csv;charset=utf-8,Name,Role,Daily Wage,UAN,ESI Number,Site Name%0ARamesh Patel,Fitter,650,100123456789,3112345678,Tema India"
              download="workers_template.csv"
            >
              Download Workers Template
            </a>
          </div>

          <div className="split" style={{ marginTop: 16 }}>
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
              Preview Import
            </button>
          </div>

          {importPreview && (
            <div className="import-preview stack" style={{ marginTop: 16 }}>
              <p>
                <strong>{importPreview.sites.length}</strong> sites and{" "}
                <strong>{importPreview.workers.length}</strong> workers ready to import.
              </p>
              {importPreview.sites.length > 0 && (
                <div className="mini-card">
                  <h4>Sites</h4>
                  {importPreview.sites.map((s, i) => (
                    <p key={i}>{s.name} - {s.clientName || "no client"}</p>
                  ))}
                </div>
              )}
              {importPreview.workers.length > 0 && (
                <div className="mini-card">
                  <h4>Workers</h4>
                  {importPreview.workers.slice(0, 10).map((w, i) => (
                    <p key={i}>{w.name} ({w.role}) - {w.siteName || "unassigned"} - {w.dailyWage}/day</p>
                  ))}
                  {importPreview.workers.length > 10 && (
                    <p className="muted">...and {importPreview.workers.length - 10} more</p>
                  )}
                </div>
              )}
              <div className="button-row">
                <button className="btn" type="button" onClick={handleRunImport} disabled={importBusy}>
                  {importBusy ? "Importing..." : "Confirm Import"}
                </button>
                <button className="btn-ghost" type="button" onClick={() => setImportPreview(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderAttendance() {
    const totalDays = Object.keys(monthModel.rows[0]?.attendance || createDefaultAttendanceMap(month, {}));

    return (
      <div className="surface panel">
        <h3 className="section-title">Attendance Register</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Click any cell to cycle through P, A, HD, OT, and WO. Data is saved immediately.
        </p>
        {monthModel.rows.length ? (
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Site</th>
                  {totalDays.map((day) => (
                    <th className="attendance-cell" key={day}>{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthModel.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div>{row.name}</div>
                      <div className="muted" style={{ marginTop: 4 }}>{row.role || "No role"}</div>
                    </td>
                    <td>{row.siteName}</td>
                    {totalDays.map((day) => (
                      <td className="attendance-cell" key={`${row.id}-${day}`}>
                        <button
                          className={`attendance-chip status-${row.attendance[day]}`}
                          onClick={() => handleToggleAttendance(row.id, day)}
                          type="button"
                        >
                          {row.attendance[day]}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state" style={{ marginTop: 16 }}>
            Koi worker nahi hai. Pehle Setup tab mein workers add karo.
          </div>
        )}
      </div>
    );
  }

  function renderPayroll() {
    return (
      <div className="surface panel">
        <h3 className="section-title">Payroll Breakdown</h3>
        {monthModel.rows.length ? (
          <div className="table-wrap" style={{ marginTop: 16 }}>
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
                      <div className="muted" style={{ marginTop: 4 }}>{formatCurrency(row.dailyWage)}/day</div>
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
            Is filter ke liye koi worker nahi hai.
          </div>
        )}
        <div className="button-row" style={{ marginTop: 16 }}>
          <button className="btn-ghost" type="button" onClick={() => downloadWages(month)}>⬇ Download Excel</button>
        </div>
      </div>
    );
  }

  function renderInvoice() {
    return (
      <div className="split">
        <div className="surface panel">
          <h3 className="section-title">Invoice Summary</h3>
          <div className="stack">
            <div className="mini-card">
              <h4>{company.businessName || "Business name pending"}</h4>
              <p>{company.address || "Add the company address in Setup."}</p>
              <p style={{ marginTop: 10 }}>Client: {selectedSite?.clientName || "All active clients"}</p>
            </div>
            <div className="mini-card">
              <h4>Line Items</h4>
              <p>Gross wages: {formatCurrency(monthModel.totals.gross)}</p>
              <p>Employer PF: {formatCurrency(monthModel.totals.pfEmployer)}</p>
              <p>Employer ESI: {formatCurrency(monthModel.totals.esiEmployer)}</p>
              <p>Service charge ({monthModel.rules.serviceChargeRate}%): {formatCurrency(monthModel.totals.serviceCharge)}</p>
              <p>Sub-total: {formatCurrency(monthModel.totals.subTotal)}</p>
              <p>GST ({monthModel.rules.gstRate}%): {formatCurrency(monthModel.totals.gstAmount)}</p>
            </div>
          </div>
        </div>

        <div className="surface panel">
          <h3 className="section-title">Total Payable</h3>
          <p className="metric-value" style={{ marginTop: 12 }}>
            {formatCurrency(monthModel.totals.invoiceTotal)}
          </p>
          <p className="muted">Driven by actual workers, attendance, and rules in your account.</p>
          <div className="stack" style={{ marginTop: 18 }}>
            <div className="mini-card">
              <h4>Registrations To Print On Invoice</h4>
              <p>GSTIN: {company.gstin || "Not set"}</p>
              <p>PF: {company.pfRegistration || "Not set"}</p>
              <p>ESI: {company.esiRegistration || "Not set"}</p>
              <p>CLRA: {company.clraLicense || "Not set"}</p>
            </div>
            <div className="mini-card">
              <h4>Current Month</h4>
              <p>{monthLabel(month)}</p>
              <p>{monthModel.rows.length} workers in scope</p>
              <p>{selectedSite ? `Filtered to ${selectedSite.name}` : "All sites included"}</p>
            </div>
          </div>
          <div className="button-row" style={{ marginTop: 16 }}>
            <button className="btn" type="button" onClick={() => downloadInvoice(month, siteFilter)}>⬇ Download PDF</button>
            <button className="btn-ghost" type="button" onClick={() => {
              const msg = encodeURIComponent(`${company.businessName || "Thekedar AI"} ka invoice for ${monthLabel(month)}: Total Rs.${monthModel.totals.invoiceTotal.toLocaleString("en-IN")}`);
              window.open(`https://wa.me/?text=${msg}`, "_blank");
            }}>WhatsApp Share</button>
          </div>
        </div>
      </div>
    );
  }

  function renderChat() {
    return (
      <div className="split">
        <div className="surface panel">
          <h3 className="section-title">Grok Operations Assistant</h3>
          <div className="chat-stack">
            {chatMessages.map((message, index) => (
              <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
                <small>{message.role === "assistant" ? "Assistant" : "You"}</small>
                <p>{message.content}</p>
              </div>
            ))}
            {chatLoading && (
              <div className="chat-message assistant">
                <small>Assistant</small>
                <p>Thinking with current contractor data...</p>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          {!chatLoading && chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === "assistant" && (
            <div className="chat-chips">
              {["Tankhwah dikhao", "PF kitna hai?", "Invoice total batao"].map((chip) => (
                <button key={chip} className="chat-chip" type="button" onClick={() => setChatInput(chip)}>{chip}</button>
              ))}
            </div>
          )}
          <form className="stack" onSubmit={handleSendChat} style={{ marginTop: 16 }}>
            <Field label="Kuch bhi pucho" full>
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Aaj kitne log aaye? Ramesh ki tankhwah kitni hai?"
              />
            </Field>
            <div className="button-row">
              <button className="btn" type="submit" disabled={chatLoading}>Bhejo</button>
            </div>
          </form>
        </div>

        <div className="surface panel">
          <h3 className="section-title">Chat Context</h3>
          <div className="stack">
            <div className="mini-card">
              <h4>Scope</h4>
              <p>Month: {monthLabel(month)}</p>
              <p>Filter: {selectedSite ? selectedSite.name : "All sites"}</p>
              <p>Workers in context: {monthModel.rows.length}</p>
            </div>
            <div className="mini-card">
              <h4>AI ko milta hai</h4>
              <p>Company profile</p>
              <p>Sites aur workers</p>
              <p>Attendance summary aur payroll totals</p>
              <p>Invoice totals aur current rules</p>
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

  const renderActiveTab = () => {
    if (tab === "setup") return renderSetup();
    if (tab === "attendance") return renderAttendance();
    if (tab === "payroll") return renderPayroll();
    if (tab === "invoice") return renderInvoice();
    if (tab === "chat") return renderChat();
    return renderDashboard();
  };

  // Show login page if not authenticated
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
              onClick={() => setTab(item.id)}
              type="button"
            >
              <span className="mono">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <div className="sidebar-footer">
          <button className="btn-ghost logout-btn" type="button" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="page-header">
          <div>
            <h2>{tab === "dashboard" ? "Live Operations" : NAV_ITEMS.find((item) => item.id === tab)?.label}</h2>
            <p>{company.businessName || "Configure your business in Setup"}</p>
          </div>
          <div className="toolbar">
            <div className="month-nav">
              <button type="button" className="btn-ghost month-arrow" onClick={() => { const d = new Date(month + "-01"); d.setMonth(d.getMonth() - 1); setMonth(d.toISOString().slice(0, 7)); }}>←</button>
              <span className="month-label">{monthLabel(month)}</span>
              <button type="button" className="btn-ghost month-arrow" onClick={() => { const d = new Date(month + "-01"); d.setMonth(d.getMonth() + 1); setMonth(d.toISOString().slice(0, 7)); }}>→</button>
            </div>
            <div className="pill-row">
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
            <button className="btn-ghost" onClick={() => loadBootstrap(month)} type="button">Reload</button>
          </div>
        </div>

        {error && <div className="status-pill error">{error}</div>}
        {!error && notice && <div className="status-pill">{notice}</div>}
        {loading ? (
          <div className="loading-center">
            <div className="loading-spinner" />
            <p>Loading...</p>
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>{renderActiveTab()}</div>
        )}
      </main>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav">
        {[
          { id: "dashboard", label: "Dashboard", icon: "📊" },
          { id: "chat", label: "Chat", icon: "💬" },
          { id: "attendance", label: "Haziri", icon: "📋" },
          { id: "payroll", label: "Tankhwah", icon: "💰" },
        ].map((item) => (
          <button key={item.id} className={`bottom-tab${tab === item.id ? " active" : ""}`} onClick={() => { setTab(item.id); setMoreOpen(false); }} type="button">
            <span className="tab-icon">{item.icon}</span>
            <span className="tab-label">{item.label}</span>
          </button>
        ))}
        <button className={`bottom-tab${moreOpen ? " active" : ""}`} onClick={() => setMoreOpen((o) => !o)} type="button">
          <span className="tab-icon">⋯</span>
          <span className="tab-label">More</span>
        </button>
      </nav>
      {moreOpen && (
        <div className="more-sheet" onClick={() => setMoreOpen(false)}>
          <div className="more-sheet-content" onClick={(e) => e.stopPropagation()}>
            <button className="more-item" onClick={() => { setTab("invoice"); setMoreOpen(false); }} type="button">🧾 Invoice</button>
            <button className="more-item" onClick={() => { setTab("setup"); setMoreOpen(false); }} type="button">⚙️ Setup</button>
            <button className="more-item danger" onClick={() => { handleLogout(); setMoreOpen(false); }} type="button">🚪 Sign Out</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
