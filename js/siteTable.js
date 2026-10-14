const siteTables = new WeakMap();

function destroySiteTable(container) {
  const dt = siteTables.get(container);
  if (dt) {
    try {
      dt.destroy();
    } catch (e) {
      console.warn("Could not destroy table:", e);
    }
    siteTables.delete(container);
  }
  container.replaceChildren();
}

function refreshSiteTable(container) {
  const dt = siteTables.get(container);
  if (!dt) return;
  try {
    dt.columns.adjust();
    dt.scroller?.measure?.();
  } catch (e) {
    console.warn("Could not refresh table:", e);
  }
}

function collectKeys(rows) {
  const keys = [];
  const seen = new Set();
  for (const row of rows)
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  return keys;
}

function objectsToRows(rows, keys = collectKeys(rows)) {
  return { keys, data: rows.map((r) => keys.map((k) => r[k] ?? null)) };
}

function createSiteTable(container, options) {
  const {
    columns,
    data,
    title = "",
    height = "520px",
    order = [],
    search = true,
    plain = false,
  } = options;

  destroySiteTable(container);
  container.classList.add("dt-wrap");

  if (title) {
    const heading = document.createElement("div");
    heading.className = "dt-title";
    heading.textContent = title;
    container.appendChild(heading);
  }

  const host = document.createElement("div");
  if (plain) host.className = "dt-plain-box";
  const tableEl = document.createElement("table");
  tableEl.className = "display";
  tableEl.style.width = "100%";
  host.appendChild(tableEl);
  container.appendChild(host);

  const config = {
    data,
    columns: columns.map((c) => ({
      title: c.titleHtml ?? escapeHtml(c.title),
      render: c.render ?? DataTable.render.text(),
      className: c.className,
      orderable: c.orderable,
      defaultContent: "",
    })),
    order,
    stripeClasses: [],
    rowCallback: (row, _data, _num, displayIndexFull) => {
      row.classList.toggle("row-alt", displayIndexFull % 2 === 1);
    },
    language: {
      search: "",
      searchPlaceholder: "Search...",
      zeroRecords: "No matching rows",
    },
  };

  if (plain) {
    Object.assign(config, {
      paging: false,
      searching: false,
      info: false,
      layout: { topStart: null, topEnd: null, bottomStart: null, bottomEnd: null },
    });
  } else {
    Object.assign(config, {
      scroller: true,
      scrollY: height,
      scrollX: true,
      scrollCollapse: true,
      layout: {
        topStart: null,
        topEnd: search ? "search" : null,
        bottomStart: null,
        bottomEnd: null,
      },
    });
  }

  const dt = new DataTable(tableEl, config);
  siteTables.set(container, dt);
  return dt;
}
