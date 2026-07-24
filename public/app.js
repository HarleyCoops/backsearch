const form = document.querySelector("#search-form");
const queryInput = document.querySelector("#query");
const asOfInput = document.querySelector("#as-of");
const laterAsOfInput = document.querySelector("#later-as-of");
const modeInput = document.querySelector("#search-mode");
const countInput = document.querySelector("#result-count");
const siteInput = document.querySelector("#site-filter");
const blockedInput = document.querySelector("#blocked-domains");
const runButton = document.querySelector("#run-button");
const runLabel = document.querySelector("#run-label");
const runCost = document.querySelector("#run-cost");
const results = document.querySelector("#results");
const emptyState = document.querySelector("#empty-state");
const resultPanel = document.querySelector(".result-panel");
const resultStatus = document.querySelector("#result-status");
const connectionPill = document.querySelector("#connection-pill");
const setupNotice = document.querySelector("#setup-notice");
const sourceGrid = document.querySelector("#source-grid");
const codeSample = document.querySelector("#code-sample");
const accessTokenField = document.querySelector("#access-token-field");
const accessTokenInput = document.querySelector("#access-token");
const dialog = document.querySelector("#snapshot-dialog");
const snapshotContent = document.querySelector("#snapshot-content");
const toast = document.querySelector("#toast");

const presets = {
  boj: {
    query: "Bank of Japan interest rate policy decision",
    date: "2026-01-15",
  },
  bitcoin: {
    query: "Bitcoin institutional demand ETF flows risk appetite",
    date: "2026-01-15",
  },
  chips: {
    query: "AI chip export controls semiconductor restrictions",
    date: "2026-05-15",
  },
};

let currentView = "search";
let currentCode = "curl";
let providerConnected = false;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
  } catch {
    return "#";
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 1800);
}

function accessHeaders() {
  const token = accessTokenInput.value.trim();
  return token ? { "x-access-token": token } : {};
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...accessHeaders(),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.message || `Request failed with HTTP ${response.status}`);
  }
  return body;
}

function queryPayload(asOf = asOfInput.value) {
  const blocked = blockedInput.value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return {
    query: queryInput.value.trim(),
    as_of: asOf,
    k: Number(countInput.value),
    mode: modeInput.value,
    ...(siteInput.value.trim() ? { site: siteInput.value.trim() } : {}),
    ...(blocked.length ? { blocked_domains: blocked } : {}),
  };
}

function setBusy(busy) {
  resultPanel.setAttribute("aria-busy", String(busy));
  runButton.disabled = busy;
  runLabel.textContent = busy
    ? "Searching frozen time…"
    : currentView === "compare"
      ? "Compare two dates"
      : "Search the archive";
}

function renderError(error) {
  emptyState.hidden = true;
  results.innerHTML = `
    <div class="empty-state">
      <div class="empty-glyph"><span></span></div>
      <strong>Request stopped.</strong>
      <p>${escapeHtml(error.message)}</p>
    </div>`;
  resultStatus.textContent = "Error";
}

function resultCard(hit, index, annotation = "") {
  const url = safeUrl(hit.url);
  return `
    <article class="result-card">
      <div class="result-meta">
        <span class="result-index">${String(index + 1).padStart(2, "0")}</span>
        <span>${escapeHtml(hit.host)}</span>
        <span>·</span>
        <span>archived ${escapeHtml(String(hit.crawl_date).slice(0, 10))}</span>
        ${annotation ? `<span class="delta-badge">${escapeHtml(annotation)}</span>` : ""}
      </div>
      <h3><a href="${url}" target="_blank" rel="noreferrer">${escapeHtml(hit.title)}</a></h3>
      <p>${escapeHtml(hit.snippet || "No snippet returned.")}</p>
      <div class="result-actions">
        <span class="result-url">${escapeHtml(hit.url)}</span>
        <button class="snapshot-button" type="button" data-snapshot="${escapeHtml(hit.url)}">Fetch snapshot · $0.002</button>
      </div>
    </article>`;
}

function renderSearch(response) {
  emptyState.hidden = true;
  resultStatus.textContent = `${response.hits.length} hits · ${Math.round(response.timing?.total_ms || 0)} ms`;
  results.innerHTML = response.hits.length
    ? response.hits.map((hit, index) => resultCard(hit, index)).join("")
    : `<div class="empty-state"><strong>No archive hits.</strong><p>Try a broader query or a different cutoff inside the covered window.</p></div>`;
}

function renderCompare(earlier, later) {
  const earlierUrls = new Set(earlier.hits.map((hit) => hit.url));
  const added = later.hits.filter((hit) => !earlierUrls.has(hit.url));
  const persisted = later.hits.filter((hit) => earlierUrls.has(hit.url));
  emptyState.hidden = true;
  resultStatus.textContent = `${added.length} newly visible · ${persisted.length} persisted`;
  results.innerHTML = `
    <div class="compare-header">
      <div><span>Earlier cutoff</span><strong>${escapeHtml(asOfInput.value)} · ${earlier.hits.length}</strong></div>
      <div><span>Later cutoff</span><strong>${escapeHtml(laterAsOfInput.value)} · ${later.hits.length}</strong></div>
    </div>
    ${[
      ...added.map((hit) => ({ hit, annotation: "new at later cutoff" })),
      ...persisted.map((hit) => ({ hit, annotation: "present at both" })),
    ]
      .map((item, index) => resultCard(item.hit, index, item.annotation))
      .join("")}`;
}

async function runSearch() {
  if (!providerConnected) {
    setupNotice.hidden = false;
    throw new Error("Add OPENREWARD_API_KEY to .env before making a billed request.");
  }
  if (currentView === "compare" && asOfInput.value >= laterAsOfInput.value) {
    throw new Error("The later cutoff must come after the earlier cutoff.");
  }
  setBusy(true);
  try {
    if (currentView === "search") {
      const response = await api("/api/search", {
        method: "POST",
        body: JSON.stringify(queryPayload()),
      });
      renderSearch(response);
    } else {
      const [earlier, later] = await Promise.all([
        api("/api/search", {
          method: "POST",
          body: JSON.stringify(queryPayload(asOfInput.value)),
        }),
        api("/api/search", {
          method: "POST",
          body: JSON.stringify(queryPayload(laterAsOfInput.value)),
        }),
      ]);
      renderCompare(earlier, later);
    }
  } finally {
    setBusy(false);
  }
}

async function fetchSnapshot(url) {
  snapshotContent.innerHTML =
    '<div class="empty-state"><strong>Fetching archived page…</strong></div>';
  dialog.showModal();
  try {
    const page = await api("/api/fetch", {
      method: "POST",
      body: JSON.stringify({
        url,
        as_of: currentView === "compare" ? laterAsOfInput.value : asOfInput.value,
      }),
    });
    snapshotContent.innerHTML = `
      <h2>${escapeHtml(page.title)}</h2>
      <div class="snapshot-meta">${escapeHtml(page.host)} · archived ${escapeHtml(page.crawl_date)} · <a href="${safeUrl(page.url)}" target="_blank" rel="noreferrer">source ↗</a></div>
      <div class="snapshot-text">${escapeHtml(page.text || page.summary || "No extracted text returned.")}</div>`;
  } catch (error) {
    snapshotContent.innerHTML = `<div class="empty-state"><strong>Snapshot unavailable.</strong><p>${escapeHtml(error.message)}</p></div>`;
  }
}

function updateCode() {
  const payload = queryPayload();
  const json = JSON.stringify(payload, null, 2);
  const samples = {
    curl: `curl -X POST https://search.openreward.ai/search \\
  -H "x-api-key: $OPENREWARD_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${json}'`,
    typescript: `import { BacksearchClient } from "./src/client.js";

const backsearch = new BacksearchClient();
const results = await backsearch.search(${json});

for (const hit of results.hits) {
  console.log(hit.crawl_date, hit.title, hit.url);
}`,
    python: `import os, requests

response = requests.post(
    "https://search.openreward.ai/search",
    headers={"x-api-key": os.environ["OPENREWARD_API_KEY"]},
    json=${json.replaceAll("true", "True").replaceAll("false", "False").replaceAll("null", "None")},
)
response.raise_for_status()
print(response.json()["hits"])`,
  };
  codeSample.textContent = samples[currentCode];
}

function renderSources(items) {
  const colors = {
    lime: "var(--lime)",
    coral: "var(--coral)",
    violet: "var(--violet)",
    cyan: "var(--cyan)",
  };
  sourceGrid.innerHTML = items
    .map(
      (source) => `
        <article class="source-card" style="--accent:${colors[source.accent] || "var(--lime)"}">
          <div class="source-top">
            <span class="source-owner">${escapeHtml(source.owner)}</span>
            <span class="access-badge ${source.access === "open" ? "open" : ""}">${escapeHtml(source.access.replace("-", " "))}</span>
          </div>
          <h3>${escapeHtml(source.name)}</h3>
          <p class="source-scenario">${escapeHtml(source.scenario)}</p>
          <p class="source-clock"><span>evidence clock</span><code>${escapeHtml(source.timestampField)}</code></p>
          <p class="source-caveat">${escapeHtml(source.caveat)}</p>
          <a href="${safeUrl(source.docsUrl)}" target="_blank" rel="noreferrer">endpoint docs ↗</a>
        </article>`,
    )
    .join("");
}

async function initialize() {
  updateCode();
  try {
    const [status, sources] = await Promise.all([
      api("/api/status"),
      api("/api/sources"),
    ]);
    providerConnected = status.connected;
    connectionPill.classList.toggle("connected", status.connected);
    connectionPill.innerHTML = `<span></span>${status.connected ? "OpenReward connected" : "API key not configured"}`;
    setupNotice.hidden = status.connected;
    accessTokenField.hidden = !status.requiresAccessToken;
    renderSources(sources.sources);
  } catch (error) {
    connectionPill.innerHTML = "<span></span>Local server unavailable";
    sourceGrid.innerHTML = `<div class="source-card"><h3>Could not load the source registry.</h3><p class="source-scenario">${escapeHtml(error.message)}</p></div>`;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await runSearch();
  } catch (error) {
    renderError(error);
  }
});

document.querySelectorAll(".mode-button").forEach((button) => {
  button.addEventListener("click", () => {
    currentView = button.dataset.view;
    document.querySelectorAll(".mode-button").forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll(".compare-only").forEach((item) => {
      item.hidden = currentView !== "compare";
    });
    document.querySelector("#date-label").textContent =
      currentView === "compare" ? "Earlier cutoff" : "Knowledge cutoff";
    runLabel.textContent =
      currentView === "compare" ? "Compare two dates" : "Search the archive";
    runCost.textContent = currentView === "compare" ? "$0.02" : "$0.01";
  });
});

document.querySelectorAll("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => {
    const preset = presets[button.dataset.preset];
    queryInput.value = preset.query;
    asOfInput.value = preset.date;
    updateCode();
  });
});

document.querySelectorAll(".code-tab").forEach((button) => {
  button.addEventListener("click", () => {
    currentCode = button.dataset.code;
    document
      .querySelectorAll(".code-tab")
      .forEach((item) => item.classList.toggle("active", item === button));
    updateCode();
  });
});

[queryInput, asOfInput, modeInput, countInput, siteInput, blockedInput].forEach(
  (input) => input.addEventListener("input", updateCode),
);

results.addEventListener("click", (event) => {
  const button = event.target.closest("[data-snapshot]");
  if (button) fetchSnapshot(button.dataset.snapshot);
});

document.querySelector("#clear-results").addEventListener("click", () => {
  results.innerHTML = "";
  emptyState.hidden = false;
  resultStatus.textContent = "Ready";
});

document.querySelector("#close-dialog").addEventListener("click", () => dialog.close());

document.querySelector("#copy-code").addEventListener("click", async () => {
  await navigator.clipboard.writeText(codeSample.textContent);
  showToast("Code copied");
});

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    await navigator.clipboard.writeText(button.dataset.copy);
    showToast("Command copied");
  });
});

initialize();
