#! ts-node
/*
@file esbuild.js
@descripcion Script de build que bundlea JavaScript en index.js
@autor Miguel Alejandro
@fecha 2025-01-27
*/

const { build } = require("esbuild");

build({
  entryPoints: ["src/index.ts"],
  outfile: "build/index.js",
  sourcemap: true,
  bundle: true,
  minify: true,
  platform: "node",
  format: "cjs",
  external: ["@aws-sdk/*", "pluralize", "uuid"],
});
