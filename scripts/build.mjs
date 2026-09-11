// @ts-check
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = new URL('../', import.meta.url);

try {
  const result = await build({
    absWorkingDir: fileURLToPath(root),
    entryPoints: ['src/main.ts'],
    outfile: 'dist/main.js',
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20.19',
    minify: true,
    treeShaking: true,
    sourcemap: false,
    write: false,
    logLevel: 'info',
  });

  if (!result.outputFiles) {
    throw new Error('esbuild produced no output files');
  }

  const staging = new URL('dist.tmp/', root);
  const destination = new URL('dist/', root);

  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });

  for (const file of result.outputFiles) {
    const relative = file.path.slice(`${fileURLToPath(root)}dist/`.length);

    await writeFile(new URL(`dist.tmp/${relative}`, root), file.contents);
  }

  await rm(destination, { recursive: true, force: true });
  await rename(new URL('dist.tmp/', root), destination);
} catch (error) {
  console.error('Build failed', error);
  process.exitCode = 1;
}
