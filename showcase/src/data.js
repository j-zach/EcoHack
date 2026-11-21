// Prefer data embedded in the page (single-file package), else fetch alongside it.
export async function loadData(key) {
  const el = document.getElementById(`data-${key}`);
  return el ? JSON.parse(el.textContent) : (await fetch(`data/${key}.json`)).json();
}
