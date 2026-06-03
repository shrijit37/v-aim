import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const config = {
  entryPoints: ['src/main.js'],
  outfile: 'dist/bundle.js',
  bundle: true,
  minify: !watch,
  sourcemap: watch,
  target: ['es2020'],
  format: 'esm',
};

if (watch) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  console.log('[esbuild] watching for changes...');
} else {
  await esbuild.build(config);
  console.log('[esbuild] build complete → dist/bundle.js');
}
