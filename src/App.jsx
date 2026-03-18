import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

const startDate = new Date("2026-03-10");
const targetDate = new Date("2026-11-02");

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

export default function Tracker() {
  const [daf, setDaf] = useState("42");
  const [part, setPart] = useState("b-top");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem("tracker-v4");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch {
        setHistory([]);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("tracker-v4", JSON.stringify(history));
  }, [history]);

  const totalDays = daysBetween(startDate, targetDate);
  const totalParts = toIndex(113, "b-bottom");
  const todayDay = Math.max(0, daysBetween(startDate, new Date()));

  const save = () => {
    const d = new Date(date);
    const day = daysBetween(startDate, d);
    const value = toIndex(Number(daf), part);

    setHistory((prev) => {
      const filtered = prev.filter((h) => h.day !== day);
      return [...filtered, { day, value }].sort((a, b) => a.day - b.day);
    });
  };

  const reset = () => {
    setHistory([]);
    setDaf("42");
    setPart("b-top");
    setDate(new Date().toISOString().slice(0, 10));
  };

  const latestProgress = history.length ? history[history.length - 1] : null;
  const percent = latestProgress ? (latestProgress.value / totalParts) * 100 : 0;
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
      finishDate: finish,
    };
  }, [history, totalParts]);

  const chartData = useMemo(() => {
    return Array.from({ length: totalDays + 1 }, (_, day) => ({
      day,
      xLabel: formatDayLabel(day),
      planned: Number(((day / totalDays) * totalParts).toFixed(1)),
      actual: getLastKnownValue(history, day),
    }));
  }, [history, totalDays, totalParts]);

  const heatmapWeeks = useMemo(() => {
    const cells = Array.from({ length: totalDays + 1 }, (_, day) => {
      const hasEntry = history.some((h) => h.day === day);
      return { day, hasEntry, label: formatDayLabel(day) };
    });

    const rows = [];
    for (let i = 0; i < cells.length; i += 14) {
      rows.push(cells.slice(i, i + 14));
    }
    return rows;
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
    <div dir="rtl" style={{ background: "#f8fafc", minHeight: "100vh", padding: 24, fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 24 }}>
        <div style={{ background: "white", borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
          <h1 style={{ marginTop: 0 }}>מעקב סיום מסכת סנהדרין</h1>
          <p style={{ color: "#475569" }}>תחילת התכנית: 10/03/2026, מנקודת התחלה דף מ״ב עמוד ב חצי עליון. יעד סיום: 02/11/2026.</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, alignItems: "end" }}>
            <label style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div style={{ marginBottom: 6 }}>תאריך העדכון</div>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: 10, borderRadius: 10, border: "1px solid #cbd5e1", direction: "ltr" }} />
            </label>

            <label style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div style={{ marginBottom: 6 }}>דף</div>
              <select value={daf} onChange={(e) => setDaf(e.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: 10, borderRadius: 10, border: "1px solid #cbd5e1" }}>
                {Array.from({ length: 72 }, (_, i) => 42 + i).map((d) => (
                  <option key={d} value={String(d)}>דף {formatHebrewDaf(d)}</option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div style={{ marginBottom: 6 }}>חלק בדף</div>
              <select value={part} onChange={(e) => setPart(e.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: 10, borderRadius: 10, border: "1px solid #cbd5e1" }}>
                {partLabels.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </label>

            <button onClick={save} style={{ width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 10, border: 0, background: "#2563eb", color: "white", cursor: "pointer", minHeight: 42 }}>שמור עדכון</button>
            <button onClick={reset} style={{ width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 10, border: "1px solid #cbd5e1", background: "white", cursor: "pointer", minHeight: 42 }}>איפוס</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <div style={{ background: "white", borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
            <div style={{ color: "#64748b", marginBottom: 8 }}>אחוז התקדמות</div>
            <div style={{ height: 14, background: "#e2e8f0", borderRadius: 999 }}>
              <div style={{ width: `${Math.max(0, Math.min(100, percent))}%`, height: 14, borderRadius: 999, background: "#22c55e" }} />
            </div>
            <div style={{ marginTop: 10, fontWeight: 700 }}>{percent.toFixed(1)}%</div>
          </div>

          <div style={{ background: "white", borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
            <div style={{ color: "#64748b", marginBottom: 8 }}>פער מול התכנית היום</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{gap.toFixed(1)} רבעים</div>
            <div style={{ marginTop: 8, color: gap >= 0 ? "#15803d" : "#b45309" }}>{gap >= 0 ? "אתה לפני היעד" : "אתה מאחורי היעד"}</div>
          </div>

          <div style={{ background: "white", borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
            <div style={{ color: "#64748b", marginBottom: 8 }}>העדכון האחרון</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>
              {latestProgress ? `יום ${latestProgress.day} · ${latestProgress.value} רבעים` : "עדיין אין נתונים"}
            </div>
          </div>

          <div style={{ background: "white", borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
            <div style={{ color: "#64748b", marginBottom: 8 }}>תחזית לפי הקצב שלך</div>
            {forecast ? (
              <>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{forecast.perWeek.toFixed(2)} רבעים לשבוע</div>
                <div style={{ marginTop: 8 }}>סיום משוער: {forecast.finishDate.toLocaleDateString("he-IL")}</div>
              </>
            ) : (
              <div>צריך לפחות שני עדכונים כדי לחשב תחזית.</div>
            )}
          </div>
        </div>

        <div style={{ background: "white", borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
          <h2 style={{ marginTop: 0 }}>גרף התקדמות מול התכנית</h2>
          <p style={{ color: "#475569" }}>ציר X מציג תאריכים לאורך התכנית. ציר Y מציג רבעי דף מצטברים מנקודת ההתחלה. הקו הכחול הוא התכנון, והקו הירוק הוא ההתקדמות בפועל.</p>
          <div style={{ height: 420 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="xLabel" interval={20} label={{ value: "תאריך", position: "insideBottom", offset: -10 }} />
                <YAxis label={{ value: "רבעי דף מצטברים", angle: -90, position: "insideLeft" }} />
                <Tooltip formatter={(value) => [`${value} רבעים`, ""]} />
                <Legend />
                <Line type="monotone" dataKey="planned" name="תכנון" stroke="#2563eb" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="actual" name="בפועל" stroke="#16a34a" strokeWidth={3} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ background: "white", borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
          <h2 style={{ marginTop: 0 }}>ימי לימוד</h2>
          <p style={{ color: "#475569" }}>כל ריבוע ירוק הוא יום שבו שמרת עדכון. אפור אומר שלא נשמר עדכון באותו יום.</p>
          <div style={{ display: "grid", gap: 8 }}>
            {heatmapWeeks.map((row, rowIndex) => (
              <div key={rowIndex} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {row.map((cell) => (
                  <div
                    key={cell.day}
                    title={cell.label}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      background: cell.hasEntry ? "#22c55e" : "#e2e8f0",
                      border: "1px solid #cbd5e1",
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "white", borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
          <h2 style={{ marginTop: 0 }}>אבני דרך</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {milestones.map((m) => (
              <div key={m.title} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                <div style={{ color: "#64748b" }}>{m.title}</div>
                <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700 }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

