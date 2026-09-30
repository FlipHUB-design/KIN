"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MAX_PDF = 10 * 1024 * 1024;

async function shrinkImage(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("resize"))), "image/jpeg", 0.85));
}

// Photographs are shrunk in the browser, uploaded to private storage, then read on the server.
export default function LetterUpload({ circle, scan }: { circle: string; scan: (f: FormData) => Promise<void> }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    try {
      let blob: Blob = file, type = file.type, ext = "jpg";
      if (file.type === "application/pdf") {
        if (file.size > MAX_PDF) return setError("PDFs can be up to 10 MB.");
        ext = "pdf";
      } else if (file.type.startsWith("image/")) {
        setBusy("Preparing photo…");
        blob = await shrinkImage(file);
        type = "image/jpeg";
      } else return setError("Choose a photo or a PDF.");
      setBusy("Uploading…");
      const path = `${circle}/${crypto.randomUUID()}-letter.${ext}`;
      const { error: upErr } = await createClient().storage.from("documents").upload(path, blob, { contentType: type });
      if (upErr) { setBusy(""); return setError("Upload failed. Only family members can add letters."); }
      setBusy("Reading the letter… this takes a few seconds");
      const fd = new FormData();
      fd.set("circle", circle); fd.set("path", path); fd.set("type", type);
      fd.set("name", file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Letter");
      await scan(fd);
    } catch {
      setBusy("");
      setError("Something went wrong. If it's a HEIC photo, try taking it again or saving it as a JPEG.");
    }
  }
  return (
    <div className="stack">
      {error && <p className="error" role="alert">{error}</p>}
      {busy ? <p className="callout" role="status">{busy}</p> : (
        <label className="btn primary block" style={{ cursor: "pointer" }}>
          Photograph or upload a letter
          <input type="file" accept="image/*,application/pdf" capture="environment" onChange={onChange} className="sr-only" />
        </label>
      )}
    </div>
  );
}
