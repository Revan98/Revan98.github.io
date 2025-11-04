    let file1Data = [];
    let file2Data = [];
    let mergedResults = null;
    const progressEl = document.getElementById("progress");
    const resultsWrap = document.getElementById("merge-results-wrap");
    const resultsInfo = document.getElementById("merge-results-info");

    async function readExcel(file) {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    }

    async function handleFiles() {
      const file1 = document.getElementById("file1").files[0];
      const file2 = document.getElementById("file2").files[0];
      const selectors = document.getElementById("columnSelectors");

      if (!file1 || !file2) return;

      file1Data = await readExcel(file1);
      file2Data = await readExcel(file2);

      if (!file1Data.length || !file2Data.length) return;

      const idSelect = document.getElementById("idColumn");
      const mergeSelect = document.getElementById("mergeColumn");
      idSelect.innerHTML = "";
      mergeSelect.innerHTML = "";

      Object.keys(file1Data[0]).forEach(col => {
        idSelect.innerHTML += `<option value="${col}">${col}</option>`;
      });
      Object.keys(file2Data[0]).forEach(col => {
        mergeSelect.innerHTML += `<option value="${col}">${col}</option>`;
      });

      selectors.style.display = "block";
      document.getElementById("mergeBtn").disabled = false;
    }

    function mergeData(file1Data, file2Data, idColumn, mergeColumn) {
      const map = {};
      for (const row of file2Data) {
        map[row[idColumn]] = row[mergeColumn];
      }

      return file1Data.map(row => {
        const id = row[idColumn];
        if (map[id] !== undefined) {
          return { ...row, [mergeColumn]: map[id] };
        }
        return row;
      });
    }

    function renderResultsTable(rows) {
      resultsWrap.innerHTML = "";
      if (!rows || rows.length === 0) {
        resultsInfo.textContent = "No results.";
        return;
      }
    
      const max = Math.min(rows.length, 15);
      const table = document.createElement("table");
      const columns = Object.keys(rows[0]);
    
      const thead = document.createElement("thead");
      thead.innerHTML = "<tr>" + columns.map(c => `<th>${c}</th>`).join("") + "</tr>";
      table.appendChild(thead);
    
      const tbody = document.createElement("tbody");
      for (let i = 0; i < max; i++) {
        const r = rows[i];
        const tr = document.createElement("tr");
        tr.innerHTML = columns.map(c => `<td>${String(r[c] ?? "")}</td>`).join("");
        tbody.appendChild(tr);
      }
    
      table.appendChild(tbody);
      resultsWrap.appendChild(table);
    }

    // -------------------------
    // Export: XLSX / CSV / JSON
    // -------------------------
    function exportToXlsx(rows) {
      if (!rows) return alert("No results to export.");
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "DKP");
      XLSX.writeFile(wb, `merge_output_${new Date().toISOString().replace(/[:.]/g,"-")}.xlsx`);
    }
    function exportToCsv(rows) {
      if (!rows) return alert("No results to export.");
      const ws = XLSX.utils.json_to_sheet(rows);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `merge_output_${new Date().toISOString().replace(/[:.]/g,"-")}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    }
    function exportToJson(rows) {
      if (!rows) return alert("No results to export.");
      const txt = JSON.stringify(rows, null, 2);
      const blob = new Blob([txt], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `merge_output_${new Date().toISOString().replace(/[:.]/g,"-")}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    }
    
    async function doMerge() {
      const idColumn = document.getElementById("idColumn").value;
      const mergeColumn = document.getElementById("mergeColumn").value;
    
      if (!idColumn || !mergeColumn) return alert("Please select columns first.");
    
      progressEl.value = 10;
    
      // Build a lookup map from file2
      const map = {};
      for (const row of file2Data) {
        map[row[idColumn]] = row[mergeColumn];
      }
    
      progressEl.value = 40;
    
      // Merge into file1Data
      const merged = file1Data.map(row => {
        const id = row[idColumn];
        const newVal = map[id];
        if (newVal !== undefined) {
          return { ...row, [mergeColumn]: newVal };
        }
        return row;
      });
    
      progressEl.value = 80;
    
      mergedResults = merged;
      renderResultsTable(merged);
      progressEl.value = 100;
      resultsInfo.textContent = `Merged ${merged.length} rows using ID "${idColumn}" and column "${mergeColumn}" from File 2.`;
    }

    // Theme toggle
    const toggleTheme = document.getElementById("toggle-theme");
    function applyTheme(isDark) {
      document.body.classList.toggle("dark", isDark);
      localStorage.setItem("dkp_darkmode", isDark ? "1" : "0");
      toggleTheme.checked = isDark;
    }
    toggleTheme.addEventListener("change", (e) => applyTheme(e.target.checked));
    applyTheme(localStorage.getItem("dkp_darkmode") === "1");
    
    // Hamburger menu
    const hamburger = document.getElementById("hamburger");
    const navLinks = document.getElementById("nav-links");
    hamburger.addEventListener("click", () => navLinks.classList.toggle("show"));

    document.getElementById("file1").addEventListener("change", handleFiles);
    document.getElementById("file2").addEventListener("change", handleFiles);
    document.getElementById("mergeBtn").addEventListener("click", doMerge);

    document.getElementById("export-xlsx").addEventListener("click", () => exportToXlsx(mergedResults));
    document.getElementById("export-csv").addEventListener("click", () => exportToCsv(mergedResults));
    document.getElementById("export-json").addEventListener("click", () => exportToJson(mergedResults));
