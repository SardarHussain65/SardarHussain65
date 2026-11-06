const fs = require("fs");

const LOGIN = "SardarHussain65";
const DAYS = 365;
const OUT = "sardar-assets/activity-graph.svg";
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const query = `
query($login:String!,$from:DateTime!,$to:DateTime!){
  user(login:$login){
    contributionsCollection(from:$from,to:$to){
      contributionCalendar{ weeks{ contributionDays{ date contributionCount } } }
    }
  }
}`;

async function main() {
  const to = new Date();
  const from = new Date(to.getTime() - DAYS * 86400000);

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${process.env.GH_PAT}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: { login: LOGIN, from: from.toISOString(), to: to.toISOString() },
    }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));

  const days = json.data.user.contributionsCollection.contributionCalendar.weeks
    .flatMap((w) => w.contributionDays)
    .slice(-DAYS);

  const W = 900, H = 300;
  const pad = { l: 50, r: 30, t: 60, b: 40 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  const rawMax = Math.max(5, ...days.map((d) => d.contributionCount));
  const max = Math.ceil(rawMax / 4) * 4;
  const total = days.reduce((s, d) => s + d.contributionCount, 0);
  const long = DAYS > 60;

  const pts = days.map((d, i) => [
    pad.l + (i / (days.length - 1)) * iw,
    pad.t + ih - (d.contributionCount / max) * ih,
  ]);

  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts.at(-1)[0].toFixed(1)},${pad.t + ih} L${pts[0][0].toFixed(1)},${pad.t + ih} Z`;

  const grid = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const y = pad.t + ih - t * ih;
    return `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}" stroke="#2d2a4a" stroke-dasharray="3 4"/>
    <text x="${pad.l - 10}" y="${y + 4}" fill="#8b7fc7" font-size="11" text-anchor="end">${Math.round(t * max)}</text>`;
  }).join("");

  const labels = days.map((d, i) => {
    const show = long ? d.date.endsWith("-01") : i % Math.ceil(DAYS / 6) === 0;
    if (!show) return "";
    const text = long ? MONTHS[+d.date.slice(5, 7) - 1] : d.date.slice(5);
    return `<text x="${pts[i][0].toFixed(1)}" y="${H - 14}" fill="#8b7fc7" font-size="11" text-anchor="middle">${text}</text>`;
  }).join("");

  const dots = DAYS > 45 ? "" : pts.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.5" fill="#fff"/>`).join("");

  const rangeLabel = DAYS === 365 ? "last year" : `last ${DAYS} days`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" font-family="Segoe UI, Arial, sans-serif">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#7c3aed" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" rx="12" fill="#0d1117"/>
  <text x="${pad.l}" y="32" fill="#c084fc" font-size="18" font-weight="700">Contribution Graph</text>
  <text x="${W - pad.r}" y="32" fill="#8b7fc7" font-size="13" text-anchor="end">${total} contributions · ${rangeLabel}</text>
  ${grid}
  <path d="${area}" fill="url(#g)"/>
  <path d="${line}" fill="none" stroke="#a855f7" stroke-width="${long ? 1.8 : 2.5}" stroke-linejoin="round"/>
  ${dots}
  ${labels}
</svg>`;

  fs.mkdirSync("sardar-assets", { recursive: true });
  fs.writeFileSync(OUT, svg);
}

main().catch((e) => { console.error(e); process.exit(1); });
