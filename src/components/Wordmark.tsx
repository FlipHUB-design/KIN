/** The Many Hands logo: "many" in green and "hands" in ink, in Figtree. Reads as "Many Hands" to screen readers. */
export default function Wordmark() {
  return (
    <>
      <span className="wm" aria-hidden="true"><span className="wm-many">many</span>hands</span>
      <span className="sr-only">Many Hands</span>
    </>
  );
}
