import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootPackagePath = path.join(rootDir, 'package.json');
const childPackagePaths = [
  'apps/api/package.json',
  'apps/web/package.json',
  'packages/shared/package.json',
];

const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'));

const writeJson = async (filePath, data) => {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
};

const rootPackage = await readJson(rootPackagePath);
const rootVersion = rootPackage.version;

if (!rootVersion) {
  throw new Error('Root package.json must define a version.');
}

for (const relativePath of childPackagePaths) {
  const packagePath = path.join(rootDir, relativePath);
  const packageJson = await readJson(packagePath);

  if (packageJson.version === rootVersion) {
    continue;
  }

  packageJson.version = rootVersion;
  await writeJson(packagePath, packageJson);
  console.log(`${relativePath} -> ${rootVersion}`);
}
