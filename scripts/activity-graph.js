const fs = require("fs");

const LOGIN = "SardarHussain65";
const OUT_DIR = "sardar-assets/activity";
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const query = `
query($login:String!,$from:DateTime!,$to:DateTime!){
  user(login:$login){
    contributionsCollection(from:$from,to:$to){
      contributionCalendar{ weeks{ contributionDays{ date contributionCount } } }
    }
  }
}`;

async function fetchDays() {
  const to = new Date();
  const from = new Date(to.getTime() - 364 * 86400000);
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${process.env.GH_PAT}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: { login: LOGIN, from: from.toISOString(), to: to.toISOString() },
    }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  const today = to.toISOString().slice(0, 10);
  return json.data.user.contributionsCollection.contributionCalendar.weeks
    .flatMap((w) => w.contributionDays)
    .map((d) => ({ date: d.date, count: d.contributionCount }))
    .filter((d) => d.date <= today);
}

function render(days, { title, range, labels }) {
  const W = 900, H = 300;
  const pad = { l: 50, r: 30, t: 60, b: 40 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const n = days.length;

  const max = Math.ceil(Math.max(4, ...days.map((d) => d.count)) / 4) * 4;
  const total = days.reduce((s, d) => s + d.count, 0);
  const x = (i) => pad.l + (n > 1 ? i / (n - 1) : 0.5) * iw;
  const y = (c) => pad.t + ih - (c / max) * ih;

  const pts = days.map((d, i) => [x(i), y(d.count)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts[n - 1][0].toFixed(1)},${pad.t + ih} L${pts[0][0].toFixed(1)},${pad.t + ih} Z`;

  const grid = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const gy = pad.t + ih - t * ih;
    return `<line x1="${pad.l}" x2="${W - pad.r}" y1="${gy}" y2="${gy}" stroke="#2d2a4a" stroke-dasharray="3 4"/>
    <text x="${pad.l - 10}" y="${gy + 4}" fill="#8b7fc7" font-size="11" text-anchor="end">${Math.round(t * max)}</text>`;
  }).join("");

  const step = Math.ceil(n / 6);
  const xLabels = days.map((d, i) => {
    const show = labels === "month" ? d.date.endsWith("-01") : i % step === 0;
    if (!show) return "";
    const text = labels === "month" ? MONTHS[+d.date.slice(5, 7) - 1] : d.date.slice(5);
    return `<text x="${pts[i][0].toFixed(1)}" y="${H - 14}" fill="#8b7fc7" font-size="11" text-anchor="middle">${text}</text>`;
  }).join("");

  const dots = n > 45 ? "" : pts.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.5" fill="#fff"/>`).join("");
  const right = `${total} contributions${range ? " · " + range : ""}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" font-family="Segoe UI, Arial, sans-serif">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.55"/>
    <stop offset="100%" stop-color="#7c3aed" stop-opacity="0"/>
  </linearGradient></defs>
  <rect width="${W}" height="${H}" rx="12" fill="#0d1117"/>
  <text x="${pad.l}" y="32" fill="#c084fc" font-size="18" font-weight="700">${title}</text>
  <text x="${W - pad.r}" y="32" fill="#8b7fc7" font-size="13" text-anchor="end">${right}</text>
  ${grid}
  <path d="${area}" fill="url(#g)"/>
  <path d="${line}" fill="none" stroke="#a855f7" stroke-width="${n > 60 ? 1.8 : 2.5}" stroke-linejoin="round"/>
  ${dots}
  ${xLabels}
</svg>`;
}

async function main() {
  const all = await fetchDays();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const write = (name, svg) => fs.writeFileSync(`${OUT_DIR}/${name}.svg`, svg);

  // Rolling windows
  write("last-30-days", render(all.slice(-30), { title: "Last 30 Days", range: "", labels: "step" }));
  write("last-90-days", render(all.slice(-90), { title: "Last 3 Months", range: "", labels: "step" }));
  write("last-year", render(all, { title: "Last Year", range: "", labels: "month" }));

  // Calendar months: month-0 = current, month-1 = previous, ...
  const byMonth = {};
  for (const d of all) (byMonth[d.date.slice(0, 7)] ||= []).push(d);
  const keys = Object.keys(byMonth).sort();
  for (let i = 0; i < 6; i++) {
    const key = keys.at(-1 - i);
    if (!key) break;
    const [yr, mo] = key.split("-");
    write(`month-${i}`, render(byMonth[key], {
      title: `${MONTH_FULL[+mo - 1]} ${yr}`,
      range: "",
      labels: "step",
    }));
  }

  // Raw data, handy if you build the Pages dashboard later
  fs.writeFileSync(`${OUT_DIR}/data.json`, JSON.stringify(all));
}

main().catch((e) => { console.error(e); process.exit(1); });
