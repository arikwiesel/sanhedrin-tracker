import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

const startDate = new Date("2026-03-10");
const targetDate = new Date("2026-11-02");
const EDIT_QUERY_PARAM = "editKey";
const RESET_HASH = "#danger-reset";
const LAST_COMMIT_AT = typeof __APP_LAST_COMMIT_AT__ === "string" ? __APP_LAST_COMMIT_AT__ : "";
const LAST_COMMIT_HASH = typeof __APP_LAST_COMMIT_HASH__ === "string" ? __APP_LAST_COMMIT_HASH__ : "";

const partLabels = [
  { key: "a-top", label: "עמוד א - חצי עליון", short: "א↑", offset: 0 },
  { key: "a-bottom", label: "עמוד א - חצי תחתון", short: "א↓", offset: 1 },
  { key: "b-top", label: "עמוד ב - חצי עליון", short: "ב↑", offset: 2 },
  { key: "b-bottom", label: "עמוד ב - חצי תחתון", short: "ב↓", offset: 3 },
];

function toIndex(daf, part) {
  const offset = partLabels.find((p) => p.key === part)?.offset ?? 0;
  return (daf - 42) * 4 + offset;
}

function daysBetween(a, b) {
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

function formatDayLabel(day) {
  const d = new Date(startDate);
  d.setDate(d.getDate() + day);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function formatHebrewDaf(num) {
  const map = {
    42: "מב", 43: "מג", 44: "מד", 45: "מה", 46: "מו", 47: "מז", 48: "מח", 49: "מט", 50: "נ", 51: "נא", 52: "נב", 53: "נג",
    54: "נד", 55: "נה", 56: "נו", 57: "נז", 58: "נח", 59: "נט", 60: "ס", 61: "סא", 62: "סב", 63: "סג",
    64: "סד", 65: "סה", 66: "סו", 67: "סז", 68: "סח", 69: "סט", 70: "ע", 71: "עא", 72: "עב", 73: "עג",
    74: "עד", 75: "עה", 76: "עו", 77: "עז", 78: "עח", 79: "עט", 80: "פ", 81: "פא", 82: "פב", 83: "פג",
    84: "פד", 85: "פה", 86: "פו", 87: "פז", 88: "פח", 89: "פט", 90: "צ", 91: "צא", 92: "צב", 93: "צג",
    94: "צד", 95: "צה", 96: "צו", 97: "צז", 98: "צח", 99: "צט", 100: "ק", 101: "קא", 102: "קב", 103: "קג",
    104: "קד", 105: "קה", 106: "קו", 107: "קז", 108: "קח", 109: "קט", 110: "קי", 111: "קיא", 112: "קיב", 113: "קיג",
  };
  return map[num] || String(num);
}

function getLastKnownValue(history, day) {
  const relevant = history.filter((h) => h.day <= day);
  if (relevant.length === 0) return null;
  return relevant[relevant.length - 1].value;
}

function toPages(parts) {
  return parts / 4;
}

function formatPages(parts, fractionDigits = 1) {
  return `${toPages(parts).toFixed(fractionDigits)} דפים`;
}

function getDateForDay(day) {
  const d = new Date(startDate);
  d.setDate(d.getDate() + day);
  return d;
}

function formatFullDate(day) {
  return getDateForDay(day).toLocaleDateString("he-IL");
}

function getProgressLabel(value) {
  const safeValue = Math.max(0, Math.round(value));
  const dafNumber = 42 + Math.floor(safeValue / 4);
  const partIndex = Math.min(3, Math.max(0, safeValue % 4));
  return `דף ${formatHebrewDaf(dafNumber)} ${partLabels[partIndex].short}`;
}

function getEditKeyFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get(EDIT_QUERY_PARAM) || "";
}

function formatLastCodeChange() {
  if (!LAST_COMMIT_AT) return "";

  const date = new Date(LAST_COMMIT_AT);
  if (Number.isNaN(date.getTime())) return "";

  const formatted = date.toLocaleString("he-IL");
  return LAST_COMMIT_HASH ? `${formatted} · ${LAST_COMMIT_HASH}` : formatted;
}

export default function Tracker() {
  const [daf, setDaf] = useState("42");
  const [part, setPart] = useState("b-top");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [editKey, setEditKey] = useState("");
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [hoveredStudyDay, setHoveredStudyDay] = useState(null);

  const isEditMode = Boolean(editKey);
  const lastCodeChange = formatLastCodeChange();
  const isNarrowScreen = viewportWidth < 900;
  const isVeryNarrowScreen = viewportWidth < 640;

  useEffect(() => {
    setEditKey(getEditKeyFromUrl());
    setShowDangerZone(window.location.hash === RESET_HASH);

    const onHashChange = () => setShowDangerZone(window.location.hash === RESET_HASH);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    async function loadHistory() {
      setIsLoading(true);
      setError("");
      try {
        const response = await fetch("/api/progress", { method: "GET" });
        if (!response.ok) {
          throw new Error("טעינת הנתונים נכשלה");
        }
        const data = await response.json();
        setHistory(Array.isArray(data.history) ? data.history : []);
      } catch (err) {
        setError(err.message || "אירעה שגיאה בטעינה");
      } finally {
        setIsLoading(false);
      }
    }

    loadHistory();
  }, []);

  const totalDays = daysBetween(startDate, targetDate);
  const totalParts = toIndex(113, "b-bottom");
  const todayDay = Math.max(0, daysBetween(startDate, new Date()));

  const save = async () => {
    if (!isEditMode) {
      setError("הלינק הזה הוא לקריאה בלבד. כדי לערוך יש להיכנס עם editKey.");
      return;
    }

    const d = new Date(date);
    const day = daysBetween(startDate, d);
    const value = toIndex(Number(daf), part);

    setIsSaving(true);
    setError("");
    setStatusMessage("");

    try {
      const response = await fetch("/api/progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-edit-key": editKey,
        },
        body: JSON.stringify({ day, value }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "שמירת העדכון נכשלה");
      }

      const data = await response.json();
      setHistory(Array.isArray(data.history) ? data.history : []);
      setStatusMessage("העדכון נשמר בענן.");
    } catch (err) {
      setError(err.message || "אירעה שגיאה בשמירה");
    } finally {
      setIsSaving(false);
    }
  };

  const reset = async () => {
    if (!isEditMode) return;

    const confirmation = window.prompt('לאיפוס מלא הקלד בדיוק: מחק הכל');
    if (confirmation !== 'מחק הכל') {
      setStatusMessage("האיפוס בוטל.");
      return;
    }

    setIsSaving(true);
    setError("");
    setStatusMessage("");

    try {
      const response = await fetch("/api/progress", {
        method: "DELETE",
        headers: {
          "x-edit-key": editKey,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "האיפוס נכשל");
      }

      const data = await response.json();
      setHistory(Array.isArray(data.history) ? data.history : []);
      setDaf("42");
      setPart("b-top");
      setDate(new Date().toISOString().slice(0, 10));
      setStatusMessage("כל הנתונים נמחקו מהענן.");
    } catch (err) {
      setError(err.message || "אירעה שגיאה באיפוס");
    } finally {
      setIsSaving(false);
    }
  };

  const latestProgress = history.length ? history[history.length - 1] : null;
  const completedParts = latestProgress ? latestProgress.value : 0;
  const remainingParts = Math.max(0, totalParts - completedParts);
  const percent = (completedParts / totalParts) * 100;
  const expectedToday = (Math.min(todayDay, totalDays) / totalDays) * totalParts;
  const gap = latestProgress ? latestProgress.value - expectedToday : 0;

  const forecast = useMemo(() => {
    if (history.length < 2) return null;
    const first = history[0];
    const last = history[history.length - 1];
    const learned = last.value - first.value;
    const elapsed = last.day - first.day;
    if (elapsed <= 0 || learned <= 0) return null;
    const perDay = learned / elapsed;
    const remaining = totalParts - last.value;
    const daysNeeded = Math.ceil(remaining / perDay);
    const finish = new Date(startDate);
    finish.setDate(startDate.getDate() + last.day + daysNeeded);
    return {
      perWeek: perDay * 7,
      perDay,
      finishDay: last.day + daysNeeded,
      finishDate: finish,
    };
  }, [history, totalParts]);

  const chartData = useMemo(() => {
    return Array.from({ length: totalDays + 1 }, (_, day) => ({
      day,
      xLabel: formatDayLabel(day),
      planned: Number(toPages((day / totalDays) * totalParts).toFixed(2)),
      actual: latestProgress && day <= latestProgress.day ? Number(toPages(getLastKnownValue(history, day) ?? 0).toFixed(2)) : null,
      forecast: forecast && latestProgress && day >= latestProgress.day
        ? Number(toPages(Math.min(totalParts, latestProgress.value + ((day - latestProgress.day) * forecast.perDay))).toFixed(2))
        : null,
    }));
  }, [forecast, history, latestProgress, totalDays, totalParts]);

  const studyMonths = useMemo(() => {
    const cells = Array.from({ length: totalDays + 1 }, (_, day) => {
      const dateObj = getDateForDay(day);
      const hasEntry = history.some((h) => h.day === day);
      return {
        day,
        hasEntry,
        label: formatDayLabel(day),
        fullDate: formatFullDate(day),
        monthKey: `${dateObj.getFullYear()}-${dateObj.getMonth()}`,
        monthLabel: dateObj.toLocaleDateString("he-IL", { month: "long", year: "numeric" }),
      };
    });

    const months = [];
    for (const cell of cells) {
      const lastMonth = months[months.length - 1];
      if (!lastMonth || lastMonth.key !== cell.monthKey) {
        months.push({ key: cell.monthKey, label: cell.monthLabel, cells: [cell] });
      } else {
        lastMonth.cells.push(cell);
      }
    }
    return months;
  }, [history, totalDays]);

  const milestones = useMemo(() => {
    const points = [
      { title: "תחילת התכנית", value: 0 },
      { title: "25%", value: totalParts * 0.25 },
      { title: "50%", value: totalParts * 0.5 },
      { title: "75%", value: totalParts * 0.75 },
      { title: "סיום", value: totalParts },
    ];

    return points.map((m) => {
      const dafNumber = 42 + Math.floor(m.value / 4);
      const partIndex = Math.min(3, Math.max(0, Math.round(m.value) % 4));
      return {
        ...m,
        label: `דף ${formatHebrewDaf(dafNumber)} ${partLabels[partIndex].short}`,
      };
    });
  }, [totalParts]);

  return (
    <div dir="rtl" style={{ background: "#f8fafc", minHeight: "100vh", padding: isVeryNarrowScreen ? 12 : 24, fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: isVeryNarrowScreen ? 16 : 24 }}>
        <div style={{ background: "white", borderRadius: 16, padding: isVeryNarrowScreen ? 16 : 20, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
          <h1 style={{ marginTop: 0 }}>מעקב התקדמות במסכת סנהדרין</h1>
          <p style={{ color: "#475569" }}>תחילת התכנית: 10/03/2026, מנקודת התחלה דף מ״ב עמוד ב חצי עליון. יעד סיום: 02/11/2026.</p>
          {lastCodeChange && (
            <p style={{ color: "#64748b", fontSize: 14 }}>
              עדכון קוד אחרון: {lastCodeChange}
            </p>
          )}
          {error && <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, background: "#fef2f2", color: "#b91c1c" }}>{error}</div>}
          {statusMessage && <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, background: "#f0fdf4", color: "#166534" }}>{statusMessage}</div>}
          {isLoading && <div style={{ marginBottom: 12, color: "#475569" }}>טוען נתונים מהענן...</div>}
        </div>

        <div style={{ background: "white", borderRadius: 16, padding: isVeryNarrowScreen ? 16 : 20, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
          <h2 style={{ marginTop: 0 }}>גרף התקדמות מול התכנית</h2>
          <div style={{ overflowX: "hidden" }}>
            <div style={{ height: isVeryNarrowScreen ? 260 : isNarrowScreen ? 320 : 420, minWidth: "auto" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="xLabel"
                    interval={isVeryNarrowScreen ? 34 : isNarrowScreen ? 24 : 20}
                    tick={{ fontSize: isVeryNarrowScreen ? 11 : 12 }}
                    label={isVeryNarrowScreen ? undefined : { value: "תאריך", position: "insideBottom", offset: -10 }}
                  />
                  <YAxis
                    tick={{ fontSize: isVeryNarrowScreen ? 11 : 12 }}
                    width={isVeryNarrowScreen ? 34 : 48}
                    label={isVeryNarrowScreen ? undefined : { value: "דפים מצטברים", angle: -90, position: "insideLeft" }}
                  />
                  <Tooltip formatter={(value) => [typeof value === "number" ? `${value.toFixed(2)} דפים` : value, ""]} />
                  {!isVeryNarrowScreen && <Legend />}
                  <Line type="monotone" dataKey="planned" name="תכנון" stroke="#2563eb" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="actual" name="בפועל" stroke="#16a34a" strokeWidth={3} dot={false} connectNulls />
                  <Line type="monotone" dataKey="forecast" name="תחזית" stroke="#94a3b8" strokeWidth={1.5} dot={false} strokeDasharray="4 4" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <p style={{ color: "#475569", marginTop: 12, marginBottom: 0 }}>ציר X מציג תאריכים לאורך התכנית. ציר Y מציג דפים מצטברים מנקודת ההתחלה. הקו הכחול הוא התכנון, הירוק הוא ההתקדמות בפועל, והאפור הוא התחזית.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isVeryNarrowScreen ? "1fr" : "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <div style={{ background: "white", borderRadius: 16, padding: isVeryNarrowScreen ? 16 : 20, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
            <div style={{ color: "#64748b", marginBottom: 8 }}>אחוז התקדמות</div>
            <div style={{ height: 14, background: "#e2e8f0", borderRadius: 999 }}>
              <div style={{ width: `${Math.max(0, Math.min(100, percent))}%`, height: 14, borderRadius: 999, background: "#22c55e" }} />
            </div>
            <div style={{ marginTop: 10, fontWeight: 700 }}>{percent.toFixed(1)}%</div>
            <div style={{ marginTop: 8, color: "#475569", lineHeight: 1.6 }}>
              {`${formatPages(completedParts, 2)} מתוך ${formatPages(totalParts, 2)}`}
            </div>
            <div style={{ color: "#64748b", fontSize: 14 }}>
              {`${formatPages(remainingParts, 2)} נותרו`}
            </div>
          </div>

          <div style={{ background: "white", borderRadius: 16, padding: isVeryNarrowScreen ? 16 : 20, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
            <div style={{ color: "#64748b", marginBottom: 8 }}>פער מול התכנית היום</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{formatPages(Math.abs(gap), 1)}</div>
            <div style={{ marginTop: 8, color: gap >= 0 ? "#15803d" : "#b45309" }}>{gap >= 0 ? "אתה לפני היעד" : "אתה מאחורי היעד"}</div>
          </div>

          <div style={{ background: "white", borderRadius: 16, padding: isVeryNarrowScreen ? 16 : 20, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
            <div style={{ color: "#64748b", marginBottom: 8 }}>העדכון האחרון</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>
              {latestProgress ? `${formatPages(latestProgress.value, 2)} · ${getProgressLabel(latestProgress.value)}` : "עדיין אין נתונים"}
            </div>
            {latestProgress && <div style={{ marginTop: 8, color: "#64748b" }}>{formatFullDate(latestProgress.day)}</div>}
          </div>

          <div style={{ background: "white", borderRadius: 16, padding: isVeryNarrowScreen ? 16 : 20, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
            <div style={{ color: "#64748b", marginBottom: 8 }}>תחזית לפי הקצב שלך</div>
            {forecast ? (
              <>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{formatPages(forecast.perWeek, 2)} לשבוע</div>
                <div style={{ marginTop: 8 }}>סיום משוער: {forecast.finishDate.toLocaleDateString("he-IL")}</div>
              </>
            ) : (
              <div>צריך לפחות שני עדכונים כדי לחשב תחזית.</div>
            )}
          </div>
        </div>

        {isEditMode && (
          <div style={{ background: "white", borderRadius: 16, padding: isVeryNarrowScreen ? 16 : 20, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
            <div style={{ display: "grid", gridTemplateColumns: isVeryNarrowScreen ? "1fr" : "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, alignItems: "end" }}>
              <label style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <div style={{ marginBottom: 6 }}>תאריך העדכון</div>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={isSaving} style={{ width: "100%", boxSizing: "border-box", padding: 10, borderRadius: 10, border: "1px solid #cbd5e1", direction: "ltr", background: "white" }} />
              </label>

              <label style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <div style={{ marginBottom: 6 }}>דף</div>
                <select value={daf} onChange={(e) => setDaf(e.target.value)} disabled={isSaving} style={{ width: "100%", boxSizing: "border-box", padding: 10, borderRadius: 10, border: "1px solid #cbd5e1", background: "white" }}>
                  {Array.from({ length: 72 }, (_, i) => 42 + i).map((d) => (
                    <option key={d} value={String(d)}>דף {formatHebrewDaf(d)}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <div style={{ marginBottom: 6 }}>חלק בדף</div>
                <select value={part} onChange={(e) => setPart(e.target.value)} disabled={isSaving} style={{ width: "100%", boxSizing: "border-box", padding: 10, borderRadius: 10, border: "1px solid #cbd5e1", background: "white" }}>
                  {partLabels.map((p) => (
                    <option key={p.key} value={p.key}>{p.label}</option>
                  ))}
                </select>
              </label>

              <button onClick={save} disabled={isSaving} style={{ width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 10, border: 0, background: "#2563eb", color: "white", cursor: "pointer", minHeight: 42, opacity: isSaving ? 0.7 : 1 }}>
                {isSaving ? "שומר..." : "שמור עדכון"}
              </button>
            </div>

            {showDangerZone && (
              <div style={{ marginTop: 18, padding: 16, borderRadius: 12, border: "1px dashed #ef4444", background: "#fff7ed" }}>
                <div style={{ marginBottom: 10, fontWeight: 700, color: "#9a3412" }}>אזור איפוס מוסתר</div>
                <div style={{ marginBottom: 10, color: "#9a3412" }}>האיפוס לא מופיע בלינק הרגיל. כדי להגיע אליו צריך גם לינק עריכה וגם להוסיף לכתובת את {RESET_HASH}.</div>
                <button onClick={reset} disabled={isSaving} style={{ padding: 12, borderRadius: 10, border: 0, background: "#dc2626", color: "white", cursor: "pointer", minHeight: 42, opacity: isSaving ? 0.7 : 1 }}>
                  {isSaving ? "מאפס..." : "איפוס מלא"}
                </button>
              </div>
            )}
          </div>
        )}

        <div style={{ background: "white", borderRadius: 16, padding: isVeryNarrowScreen ? 16 : 20, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
          <div style={{ padding: 12, borderRadius: 12, background: isEditMode ? "#ecfdf5" : "#eff6ff", color: isEditMode ? "#166534" : "#1d4ed8" }}>
            {isEditMode
              ? "מצב עריכה פעיל. הלינק הרגיל מתאים לשיתוף לקריאה בלבד."
              : "מצב קריאה בלבד. כדי לערוך, היכנס עם לינק העריכה הפרטי שלך."}
          </div>
        </div>

        <div style={{ background: "white", borderRadius: 16, padding: isVeryNarrowScreen ? 16 : 20, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", position: "relative" }}>
          <h2 style={{ marginTop: 0 }}>ימי לימוד</h2>
          <p style={{ color: "#475569" }}>כל ריבוע ירוק הוא יום שבו נשמר עדכון. אפור אומר שלא נשמר עדכון באותו יום.</p>
          <div style={{ display: "grid", gap: 14 }}>
            {studyMonths.map((month) => (
              <div key={month.key} style={{ display: "grid", gridTemplateColumns: isVeryNarrowScreen ? "88px 1fr" : "140px 1fr", gap: 8, alignItems: "start" }}>
                <div style={{ color: "#334155", fontWeight: 700, paddingTop: 2, fontSize: isVeryNarrowScreen ? 13 : 16 }}>{month.label}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {month.cells.map((cell) => (
                    <button
                      key={cell.day}
                      type="button"
                      onMouseEnter={() => setHoveredStudyDay(cell)}
                      onMouseMove={() => setHoveredStudyDay(cell)}
                      onMouseLeave={() => setHoveredStudyDay(null)}
                      onFocus={() => setHoveredStudyDay(cell)}
                      onBlur={() => setHoveredStudyDay(null)}
                      style={{
                        width: isVeryNarrowScreen ? 16 : 18,
                        height: isVeryNarrowScreen ? 16 : 18,
                        borderRadius: 4,
                        background: cell.hasEntry ? "#22c55e" : "#e2e8f0",
                        border: "1px solid #cbd5e1",
                        padding: 0,
                        cursor: "default",
                      }}
                      aria-label={`${cell.fullDate} - ${cell.hasEntry ? "יש עדכון" : "ללא עדכון"}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {hoveredStudyDay && (
            <div style={{ position: "absolute", top: 16, left: 16, padding: "8px 10px", borderRadius: 10, background: "#0f172a", color: "white", fontSize: 13, pointerEvents: "none", boxShadow: "0 10px 25px rgba(15,23,42,0.2)" }}>
              {hoveredStudyDay.fullDate} · {hoveredStudyDay.hasEntry ? "נשמר עדכון" : "אין עדכון"}
            </div>
          )}
        </div>

        <div style={{ background: "white", borderRadius: 16, padding: isVeryNarrowScreen ? 16 : 20, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
          <h2 style={{ marginTop: 0 }}>אבני דרך</h2>
          <div style={{ display: "grid", gridTemplateColumns: isVeryNarrowScreen ? "1fr 1fr" : "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {milestones.map((m) => (
              <div key={m.title} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                <div style={{ color: "#64748b" }}>{m.title}</div>
                <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700 }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {isNarrowScreen && (
          <div style={{ background: "white", borderRadius: 16, padding: isVeryNarrowScreen ? 16 : 20, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
            <div style={{ padding: 12, borderRadius: 12, background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0" }}>
              המסך מותאם גם לאורך. לרוחב יהיה מעט נוח יותר לגרף, אבל לא חובה.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
