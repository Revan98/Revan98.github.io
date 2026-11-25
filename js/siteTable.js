if (window.agGrid) {
  agGrid.ModuleRegistry.registerModules([agGrid.AllCommunityModule]);
}

const SITE_ROW_HEIGHT = 40;
const SITE_HEADER_HEIGHT = 44;

function createSiteTheme() {
  return agGrid.themeQuartz.withParams({
    browserColorScheme: "inherit",
    fontFamily: "inherit",
    fontSize: 14,
    backgroundColor: "var(--table-bg)",
    foregroundColor: "var(--text-color)",
    borderColor: "var(--table-border)",
    headerBackgroundColor: "var(--table-bg)",
    headerTextColor: "var(--text-color)",
    headerFontWeight: 700,
    oddRowBackgroundColor: "var(--table-stripe-even)",
    rowHoverColor: "var(--row-hover-bg)",
    rowBorder: { style: "solid", width: 1, color: "var(--table-border)" },
    headerRowBorder: { style: "solid", width: 2, color: "var(--table-border)" },
    columnBorder: false,
    wrapperBorder: { style: "solid", width: 1, color: "var(--table-border)" },
    wrapperBorderRadius: 10,
    cellHorizontalPadding: 12,
    headerColumnResizeHandleColor: "transparent",
    pinnedColumnBorder: { style: "solid", width: 1, color: "var(--table-border)" },
    iconSize: 14,
    tooltipBackgroundColor: "color-mix(in srgb, var(--text-color) 4%, var(--table-bg))",
    tooltipTextColor: "var(--text-color)",
    tooltipBorder: { style: "solid", width: 1, color: "var(--table-border)" },
  });
}

const siteTables = new WeakMap();

function destroySiteTable(container) {
  const entry = siteTables.get(container);
  if (entry) {
    try {
      entry.api.destroy();
    } catch (event) {
      console.warn("Could not destroy table:", event);
    }
    siteTables.delete(container);
  }
  container.replaceChildren();
}

function collectKeys(rows) {
  const keys = [];
  const seen = new Set();
  for (const row of rows)
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  return keys;
}

function objectsToRows(rows, keys = collectKeys(rows)) {
  return { keys, data: rows.map((row) => keys.map((key) => row[key] ?? null)) };
}

function buildSiteColumnDefinitions(columns, order) {
  return columns.map((column, index) => {
    const columnDefinition = {
      colId: `c${index}`,
      field: String(index), // rows are arrays, so the field is the index
      headerName: column.title ?? "",
      sortable: column.orderable !== false,
    };
    if (column.render) {
      columnDefinition.cellRenderer = (params) => column.render(params.value, "display", params.data) ?? "";
    }
    const orderPosition = order.findIndex(([orderedIndex]) => orderedIndex === index);
    if (orderPosition !== -1) {
      columnDefinition.sort = order[orderPosition][1] || "asc";
      columnDefinition.sortIndex = orderPosition;
    }
    return columnDefinition;
  });
}

function createSiteSearch(onInput) {
  const wrap = document.createElement("div");
  wrap.className = "grid-search";
  const input = document.createElement("input");
  input.type = "search";
  input.placeholder = "Search...";
  input.setAttribute("aria-label", "Search table");
  input.addEventListener("input", () => onInput(input.value));
  wrap.appendChild(input);
  return wrap;
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
  container.classList.add("grid-wrap");

  if (title) {
    const heading = document.createElement("div");
    heading.className = "grid-title";
    heading.textContent = title;
    container.appendChild(heading);
  }

  const host = document.createElement("div");
  host.className = "grid-host";
  const maxHeight = parseFloat(height);
  const contentHeight = data.length * SITE_ROW_HEIGHT + SITE_HEADER_HEIGHT + 2;
  const autoHeight = contentHeight <= maxHeight;
  if (!autoHeight) host.style.height = height;

  const gridOptions = {
    theme: createSiteTheme(),
    rowData: data,
    columnDefs: buildSiteColumnDefinitions(columns, order),
    defaultColDef: {
      resizable: false,
      suppressMovable: true,
      minWidth: 90,
      maxWidth: 700,
    },
    rowHeight: SITE_ROW_HEIGHT,
    headerHeight: SITE_HEADER_HEIGHT,
    domLayout: autoHeight ? "autoHeight" : "normal",
    autoSizeStrategy: {
      type: "fitCellContents",
      scaleUpToFitGridWidth: true,
      continuous: true,
      shouldAutoSizeColumns: () => true,
    },
    suppressCellFocus: true,
    enableCellTextSelection: true,
    tooltipShowDelay: 300,
    localeText: { noMatchingRows: "No matching rows", noRowsToShow: "No rows" },
    onModelUpdated: (event) =>
      host.classList.toggle("is-empty", event.api.getDisplayedRowCount() === 0),
  };

  let gridApi = null;
  if (!plain && search) {
    container.appendChild(
      createSiteSearch((value) => gridApi?.setGridOption("quickFilterText", value)),
    );
  }
  container.appendChild(host);

  gridApi = agGrid.createGrid(host, gridOptions);
  siteTables.set(container, { api: gridApi });

  return gridApi;
}
