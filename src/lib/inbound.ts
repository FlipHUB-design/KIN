/** The domain that receives forwarded emails, e.g. "inbound.yourdomain.co.uk". Set KIN_INBOUND_DOMAIN to switch it on. */
export const inboundDomain = () => (process.env.KIN_INBOUND_DOMAIN || "").trim().toLowerCase() || null;
