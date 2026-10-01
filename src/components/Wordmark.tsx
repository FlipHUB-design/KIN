/** The KIN logo: "kin" in Figtree with a plum dot on the i. Reads as "KIN" to screen readers. */
export default function Wordmark() {
  return (
    <>
      <span className="wm" aria-hidden="true">k<span className="wm-i">ı</span>n</span>
      <span className="sr-only">KIN</span>
    </>
  );
}
