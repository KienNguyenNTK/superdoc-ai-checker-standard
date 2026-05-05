import { createSuperDocClient, type SuperDocDocument } from "@superdoc-dev/sdk";
import { SUPERDOC_USER } from "../../config.js";

export async function withSuperDocDocument<T>(
  filePath: string,
  task: (doc: SuperDocDocument) => Promise<T>
) {
  const client = createSuperDocClient({
    user: SUPERDOC_USER,
  });

  await client.connect();
  const doc = await client.open({ doc: filePath });

  try {
    return await task(doc);
  } finally {
    await doc.close().catch(() => undefined);
    await client.dispose().catch(() => undefined);
  }
}
