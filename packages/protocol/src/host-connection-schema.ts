import { z } from "zod";

export const DirectTcpHostConnectionSchema = z.object({
  id: z.string(),
  type: z.literal("directTcp"),
  endpoint: z.string(),
  useTls: z.boolean().optional().default(false),
  password: z.string().optional(),
  // Fork: Cloudflare Access service-token headers (CF-Access-Client-Id /
  // CF-Access-Client-Secret) sent on the WebSocket upgrade request. Additive
  // optional field; headerless connections are unaffected.
  headers: z.record(z.string(), z.string()).optional(),
});

export type DirectTcpHostConnection = z.input<typeof DirectTcpHostConnectionSchema>;
export type NormalizedDirectTcpHostConnection = z.output<typeof DirectTcpHostConnectionSchema>;
