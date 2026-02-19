window.db = null;

async function loadDatabase() {
  if (window.db) return;

  const SQL = await initSqlJs({
    locateFile: file =>
      `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${file}`
  });

  const res = await fetch("kvk.db");
  const buffer = await res.arrayBuffer();
  window.db = new SQL.Database(new Uint8Array(buffer));
}
