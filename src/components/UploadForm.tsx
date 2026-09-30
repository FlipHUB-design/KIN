"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DOC_CATEGORIES } from "@/lib/kin";

const MAX = 15 * 1024 * 1024;
const TYPES = /^(application\/pdf|image\/(jpeg|png|heic|heif|webp))$/;

// Uploads straight from the browser to private storage (the database checks the
// user may upload to this circle), then records the document on the server.
export default function UploadForm({ circle, admin, register }: { circle: string; admin: boolean; register: (f: FormData) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size) return setError("Choose a file to upload.");
    if (file.size > MAX) return setError("Files can be up to 15 MB.");
    if (!TYPES.test(file.type)) return setError("Upload a PDF or a photo (JPG, PNG, HEIC or WebP).");
    setBusy(true);
    const safe = file.name.replace(/[^\w.\- ]+/g, "_").slice(-80);
    const path = `${circle}/${crypto.randomUUID()}-${safe}`;
    const { error: upErr } = await createClient().storage.from("documents").upload(path, file, { contentType: file.type });
    if (upErr) { setBusy(false); return setError("Upload failed. Only family members can add documents."); }
    fd.delete("file");
    fd.set("path", path);
    if (!fd.get("name")) fd.set("name", file.name);
    await register(fd);
  }
  return (
    <form onSubmit={onSubmit} className="card pad form">
      <input type="hidden" name="circle" value={circle} />
      <h2>Add a document</h2>
      {error && <p className="error" role="alert">{error}</p>}
      <label className="fl">File (PDF or photo, up to 15 MB)<input type="file" name="file" accept="application/pdf,image/*" required /></label>
      <label className="fl">Name<input name="name" placeholder="e.g. Home insurance schedule 2026" /></label>
      <div className="two">
        <label className="fl">Category<select name="category">{DOC_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="fl">Expires (optional)<input type="date" name="expiry_date" /></label>
      </div>
      {admin && <label className="fl">Who can see it?<select name="access"><option value="family">Family and the supported person</option><option value="admins">Administrators only</option></select></label>}
      <label className="fl">Notes<input name="notes" /></label>
      <button className="btn primary" disabled={busy}>{busy ? "Uploading…" : "Upload"}</button>
    </form>
  );
}
