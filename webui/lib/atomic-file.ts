import { randomUUID } from "crypto";
import { basename, dirname, join } from "path";
import { renameSync, unlinkSync, writeFileSync } from "fs";

export function writePrivateFileAtomicSync(filePath: string, contents: string): void {
  const dir = dirname(filePath);
  const tempPath = join(dir, `.${basename(filePath)}-${randomUUID()}.tmp`);
  let failed = false;
  try {
    writeFileSync(tempPath, contents, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
      flush: true,
    });
    renameSync(tempPath, filePath);
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    try {
      unlinkSync(tempPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !failed) throw error;
    }
  }
}
