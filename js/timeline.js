let timelineTimer = null;

async function loadTimelineData() {
  const response = await fetch("data/timelines.json");
  if (!response.ok) throw new Error(`timelines.json: HTTP ${response.status}`);
  const kvks = (await response.json()).kvks || {};

  const exact = kvks[String(kvkContext.kvkNumber)];
  if (exact) return exact;
  if (!kvks.latest) return null;

  const list = await listKvks(kvkContext.kd);
  const current = (list || []).find((item) => Number(item.kvkNumber) === Number(kvkContext.kvkNumber));
  return current && current.isLatest ? kvks.latest : null;
}

async function initTimeline() {
  const root = document.getElementById("timeline");
  if (!root) return;
  try {
    const data = await loadTimelineData();
    if (data && Array.isArray(data.events) && data.events.length) renderTimeline(root, data);
  } catch (error) {
    console.error("Timeline not shown:", error);
  }
}

function renderTimeline(root, data) {
  const TIMELINE_TITLE = data.title || "";
  const EVENTS = data.events;
  const SERIES = Array.isArray(data.series) ? data.series : [];
  if (timelineTimer) clearInterval(timelineTimer);

  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (n) => String(n).padStart(2, "0");

  function formatUtc(ms) {
    const d = new Date(ms);
    return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} · ${d.getUTCHours()}:${pad(d.getUTCMinutes())} UTC`;
  }

  function formatCountdown(ms) {
    const totalMinutes = Math.max(0, Math.floor(ms / 60000));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  const groups = [];
  EVENTS.map((e) => ({ name: e.name, time: Date.parse(e.at) }))
    .sort((a, b) => a.time - b.time)
    .forEach((event) => {
      const last = groups[groups.length - 1];
      if (last && last.time === event.time) last.names.push(event.name);
      else groups.push({ time: event.time, names: [event.name] });
    });

  const start = groups[0].time;
  const end = groups[groups.length - 1].time;
  const span = Math.max(1, end - start);

  root.className = "timeline-card";
  root.innerHTML = `
    <div class="timeline-header">
      <h3 class="timeline-title">Timeline <span class="timeline-sub">${escapeHtml(TIMELINE_TITLE)}</span></h3>
      <div class="timeline-status" id="timelineStatus"></div>
    </div>
    <div class="timeline-scroll">
      <div class="timeline-inner" id="timelineInner">
        <div class="timeline-track" id="timelineTrack">
          <div class="timeline-fill" id="timelineFill"></div>
          <div class="timeline-now" id="timelineNow"></div>
        </div>
      </div>
    </div>
  `;
  const inner = root.querySelector("#timelineInner");

  const track = root.querySelector("#timelineTrack");
  const fill = root.querySelector("#timelineFill");
  const nowMarker = root.querySelector("#timelineNow");
  const status = root.querySelector("#timelineStatus");

  const markerEls = groups.map((group, index) => {
    const pct = ((group.time - start) / span) * 100;
    const el = document.createElement("div");
    el.className = `timeline-point ${index % 2 === 0 ? "tl-up" : "tl-down"}`;
    el.style.left = `${pct}%`;
    el.innerHTML = `
      <div class="timeline-label" title="${formatUtc(group.time)}">
        <div class="timeline-label-name">${group.names.map(escapeHtml).join("<br>")}</div>
        <div class="timeline-label-date">${formatUtc(group.time)}</div>
      </div>
      <div class="timeline-dot"></div>
    `;
    track.appendChild(el);
    return el;
  });

  function update() {
    const now = Date.now();
    const progress = Math.min(1, Math.max(0, (now - start) / span));
    fill.style.width = `${progress * 100}%`;

    const running = now >= start && now < end;
    nowMarker.style.left = `${progress * 100}%`;
    nowMarker.style.display = running ? "block" : "none";

    let nextIndex = groups.findIndex((group) => group.time > now);
    markerEls.forEach((el, index) => {
      el.classList.toggle("is-done", groups[index].time <= now);
      el.classList.toggle("is-next", index === nextIndex);
    });

    if (now < start) {
      status.textContent = `Starts in ${formatCountdown(start - now)}`;
    } else if (nextIndex === -1) {
      status.textContent = "Schedule complete";
    } else {
      const day = Math.floor((now - start) / 86400000) + 1;
      const totalDays = Math.ceil(span / 86400000) + 1;
      const next = groups[nextIndex];
      status.innerHTML = `Day ${day} of ${totalDays} · <strong>${Math.round(progress * 100)}%</strong> · Next: <strong>${next.names.map(escapeHtml).join(" / ")}</strong> in ${formatCountdown(next.time - now)}`;
    }
  }

  const seriesUpdaters = SERIES.map((series) => {
    const first = Date.parse(series.first);
    const times = Array.from({ length: series.count }, (_, i) => first + i * series.everyHours * 3600000);
    const sStart = times[0];
    const sSpan = Math.max(1, times[times.length - 1] - sStart);

    const block = document.createElement("div");
    block.className = "timeline-series";
    block.innerHTML = `
      <div class="timeline-header">
        <h3 class="timeline-title">${escapeHtml(series.name)}
          <span class="timeline-sub">every ${series.everyHours}h · ${series.count} times</span></h3>
        <div class="timeline-status"></div>
      </div>
      <div class="timeline-track timeline-track-series">
        <div class="timeline-fill"></div>
        <div class="timeline-now"></div>
        <div class="timeline-end tl-end-start">${formatUtc(times[0])}</div>
        <div class="timeline-end tl-end-last">${formatUtc(times[times.length - 1])}</div>
      </div>
    `;
    inner.appendChild(block);

    const sTrack = block.querySelector(".timeline-track");
    const sFill = block.querySelector(".timeline-fill");
    const sNow = block.querySelector(".timeline-now");
    const sStatus = block.querySelector(".timeline-status");

    const dots = times.map((time, index) => {
      const el = document.createElement("div");
      el.className = "timeline-point timeline-point-num";
      el.style.left = `${((time - sStart) / sSpan) * 100}%`;
      el.innerHTML = `<div class="timeline-dot" title="#${index + 1} · ${formatUtc(time)}"><span>${index + 1}</span></div>`;
      sTrack.appendChild(el);
      return el;
    });

    return () => {
      const now = Date.now();
      const progress = Math.min(1, Math.max(0, (now - sStart) / sSpan));
      sFill.style.width = `${progress * 100}%`;
      sNow.style.left = `${progress * 100}%`;
      sNow.style.display = now >= sStart && now < sStart + sSpan ? "block" : "none";

      const nextIndex = times.findIndex((time) => time > now);
      dots.forEach((el, index) => {
        el.classList.toggle("is-done", times[index] <= now);
        el.classList.toggle("is-next", index === nextIndex);
      });

      if (nextIndex === -1) {
        sStatus.textContent = "All done";
      } else {
        const done = nextIndex;
        const lead = now < sStart ? "Starts in" : "in";
        sStatus.innerHTML = `${done}/${series.count} done · Next: <strong>#${nextIndex + 1}</strong> ${formatUtc(times[nextIndex])} (${lead} ${formatCountdown(times[nextIndex] - now)})`;
      }
    };
  });

  function updateAll() {
    update();
    seriesUpdaters.forEach((fn) => fn());
  }

  updateAll();
  timelineTimer = setInterval(updateAll, 60000);
}
