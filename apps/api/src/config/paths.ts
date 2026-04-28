import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

export const rootDir = path.resolve(currentDir, "../../../..");
export const dataDir = path.join(rootDir, "data");
export const seedsPath = path.join(dataDir, "seeds.json");
