import { useEffect, useRef, useState } from "react";
import "./app.css";
import {
  createSite,
  createWorker,
  deleteSite,
  deleteWorker,
  getBootstrap,
  saveCompany,
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
  return {
    name: "",
    role: "",
    dailyWage: "",
    uan: "",
    esiNumber: "",
    siteId: "",
    active: true,
  };
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

function App() {
  const [tab, setTab] = useState("dashboard");
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
    loadBootstrap(month);
  }, [month]);

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

  const selectedSite = siteFilter === "all" ? null : sites.find((site) => site.id === siteFilter);

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
    setCompanyForm((current) => ({ ...current, [name]: value }));
  }

  function updateSiteField(name, value) {
    setSiteForm((current) => ({ ...current, [name]: value }));
  }

  function updateWorkerField(name, value) {
    setWorkerForm((current) => ({ ...current, [name]: value }));
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
      if (siteFilter === siteId) {
        setSiteFilter("all");
      }
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
    if (!window.confirm("Delete this worker and all stored attendance for them?")) {
      return;
    }

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
      [workerId]: {
        ...currentAttendance,
        [day]: nextStatus,
      },
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
    if (!trimmed || chatLoading) {
      return;
    }

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
        { role: "assistant", content: `Chat error: ${chatError.message}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

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
                <div className="empty-state">Add a site to start tracking real operations.</div>
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
          <div className="button-row" style={{ marginTop: 16 }}>
            <button className="btn" type="submit" disabled={busy}>
              Save company settings
            </button>
          </div>
        </form>

        <div className="split">
          <div className="surface panel">
            <h3 className="section-title">Sites</h3>
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
                    placeholder="Tema India"
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
                {editingSiteId && (
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
              ))}
            </div>
          </div>

          <div className="surface panel">
            <h3 className="section-title">Workers</h3>
            <form className="stack" onSubmit={handleSaveWorker}>
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
                {editingWorkerId && (
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
                )}
              </div>
            </form>

            <div className="stack" style={{ marginTop: 18 }}>
              {workers.map((worker) => {
                const workerSite = sites.find((site) => site.id === worker.siteId);
                return (
                  <div className="list-card" key={worker.id}>
                    <div className="list-header">
                      <div>
                        <h4>{worker.name}</h4>
                        <p>
                          {worker.role || "No role"} - {workerSite?.name || "Unassigned"}
                        </p>
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
                        <button
                          className="btn-ghost btn-danger"
                          type="button"
                          onClick={() => handleDeleteWorker(worker.id)}
                        >
                          Delete
                        </button>
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
                    <th className="attendance-cell" key={day}>
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthModel.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div>{row.name}</div>
                      <div className="muted" style={{ marginTop: 4 }}>
                        {row.role || "No role"}
                      </div>
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
            Add workers first, then attendance can be captured for any month.
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
                      <div className="muted" style={{ marginTop: 4 }}>
                        {formatCurrency(row.dailyWage)}/day
                      </div>
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
            No workers available for the selected filter.
          </div>
        )}
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
          <h3 className="section-title">Total Payable</h3>
          <p className="metric-value" style={{ marginTop: 12 }}>
            {formatCurrency(monthModel.totals.invoiceTotal)}
          </p>
          <p className="muted">
            This is driven by the actual workers, attendance, and rules in the local store.
          </p>
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
          <form className="stack" onSubmit={handleSendChat} style={{ marginTop: 16 }}>
            <Field label="Ask About Current Operations" full>
              <textarea
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Who has the highest net pay this month? Which site has the biggest wage bill?"
              />
            </Field>
            <div className="button-row">
              <button className="btn" type="submit" disabled={chatLoading}>
                Send to Grok
              </button>
            </div>
          </form>
        </div>

        <div className="surface panel">
          <h3 className="section-title">Context Sent To Chat</h3>
          <div className="stack">
            <div className="mini-card">
              <h4>Scope</h4>
              <p>Month: {monthLabel(month)}</p>
              <p>Filter: {selectedSite ? selectedSite.name : "All sites"}</p>
              <p>Workers in context: {monthModel.rows.length}</p>
            </div>
            <div className="mini-card">
              <h4>What Grok Receives</h4>
              <p>Company profile</p>
              <p>Sites and workers</p>
              <p>Attendance summary and payroll totals</p>
              <p>Invoice totals and current rules</p>
            </div>
            <div className="mini-card">
              <h4>Required Env</h4>
              <p className="mono">XAI_API_KEY</p>
              <p className="mono">XAI_MODEL (optional)</p>
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

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-badge">TK</div>
          <div>
            <h1>Thekedar AI</h1>
            <p>Real contractor operations MVP</p>
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
        <div className="sidebar-note">
          This version stores contractor data on the server side and removes the hard-coded demo state.
        </div>
      </aside>

      <main className="main">
        <div className="page-header">
          <div>
            <h2>{tab === "dashboard" ? "Live Operations" : NAV_ITEMS.find((item) => item.id === tab)?.label}</h2>
            <p>{company.businessName || "Configure your business in Setup"} - {monthLabel(month)}</p>
          </div>
          <div className="toolbar">
            <div className="field" style={{ minWidth: 170 }}>
              <label>Month</label>
              <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
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
            <button className="btn-ghost" onClick={() => loadBootstrap(month)} type="button">
              Reload
            </button>
          </div>
        </div>

        {error && <div className="status-pill error">{error}</div>}
        {!error && notice && <div className="status-pill">{notice}</div>}
        {loading ? (
          <div className="surface panel" style={{ marginTop: 16 }}>
            Loading contractor data...
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>{renderActiveTab()}</div>
        )}
      </main>
    </div>
  );
}

export default App;
