/**
 * A plain, multi-page A4 PDF report (no dependencies). Text is set in Helvetica
 * with WinAnsi encoding, so £ and accented letters print correctly.
 */
export type ReportBlock =
  | { type: "heading"; text: string }
  | { type: "para"; text: string; muted?: boolean }
  | { type: "row"; cells: string[]; widths: number[]; bold?: boolean }
  | { type: "space"; h?: number };

const W = 595, H = 842, M = 56;

// Approximate Helvetica widths (per 1000 em) for wrapping
const WIDE = "MWmw@%", NARROW = "iljtfI.,;:'!|()[] ";
const charW = (c: string, bold: boolean) => (WIDE.includes(c) ? 0.83 : NARROW.includes(c) ? 0.28 : /[A-Z0-9£]/.test(c) ? 0.64 : 0.53) * (bold ? 1.05 : 1);
const textW = (s: string, size: number, bold = false) => [...s].reduce((n, c) => n + charW(c, bold), 0) * size;

function wrap(s: string, size: number, width: number, bold = false) {
  const out: string[] = [];
  for (const para of s.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const t = line ? line + " " + word : word;
      if (textW(t, size, bold) <= width || !line) line = t;
      else { out.push(line); line = word; }
    }
    out.push(line);
  }
  return out;
}

const clean = (s: string) => s
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...").replace(/→/g, "->")
  .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
const esc = (s: string) => clean(s).replace(/[\\()]/g, (c) => "\\" + c);

export function makeReport(title: string, subtitle: string, blocks: ReportBlock[], footer: string) {
  const pages: string[][] = [];
  let ops: string[] = [], y = H - M;
  const newPage = () => { if (ops.length) pages.push(ops); ops = []; y = H - M; };
  const need = (h: number) => { if (y - h < M + 24) newPage(); };
  const put = (x: number, yy: number, s: string, size: number, bold = false, grey = false) =>
    ops.push(`${grey ? "0.35 0.39 0.36 rg" : "0.09 0.13 0.11 rg"} BT /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(1)} ${yy.toFixed(1)} Td (${esc(s)}) Tj ET`);

  put(M, y - 20, title, 20, true); y -= 32;
  for (const l of wrap(subtitle, 10, W - 2 * M)) { put(M, y - 10, l, 10, false, true); y -= 14; }
  y -= 10;
  ops.push(`0.17 0.42 0.33 RG 1.5 w ${M} ${y} m ${W - M} ${y} l S`); y -= 16;

  for (const b of blocks) {
    if (b.type === "space") { y -= b.h ?? 8; continue; }
    if (b.type === "heading") {
      need(40); y -= 8; put(M, y - 13, b.text, 13, true); y -= 22;
      continue;
    }
    if (b.type === "para") {
      for (const l of wrap(b.text, 10, W - 2 * M)) { need(14); put(M, y - 10, l, 10, false, b.muted); y -= 14; }
      y -= 4;
      continue;
    }
    const total = b.widths.reduce((a, c) => a + c, 0);
    const cols = b.widths.map((w) => (w / total) * (W - 2 * M));
    const lines = b.cells.map((c, i) => wrap(c, 9, cols[i] - 6, b.bold));
    const h = Math.max(...lines.map((l) => l.length)) * 12 + 6;
    need(h);
    let x = M;
    lines.forEach((ls, i) => { ls.forEach((l, j) => put(x, y - 10 - j * 12, l, 9, b.bold)); x += cols[i]; });
    y -= h;
    ops.push(`0.84 0.86 0.83 RG 0.5 w ${M} ${y + 2} m ${W - M} ${y + 2} l S`);
  }
  newPage();

  // Assemble the file
  const objs: string[] = [];
  const add = (o: string) => { objs.push(o); return objs.length; };
  const catalog = add(""), pagesObj = add(""), f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const kids: number[] = [];
  pages.forEach((p, i) => {
    const content = [...p, `0.35 0.39 0.36 rg BT /F1 8 Tf ${M} 30 Td (${esc(footer)}) Tj ET`, `0.35 0.39 0.36 rg BT /F1 8 Tf ${W - M - 60} 30 Td (Page ${i + 1} of ${pages.length}) Tj ET`].join("\n");
    const c = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${W} ${H}] /Contents ${c} 0 R /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> >>`));
  });
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  let out = "%PDF-1.4\n";
  const offs: number[] = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  // One byte per character (Latin-1), so lengths and offsets above are exact
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}
