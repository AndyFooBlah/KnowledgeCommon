// Copyright 2026 Andrew Brook
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * Vite config for building the KnowledgeCommon npm library.
 *
 * Produces an ESM bundle in dist/ with type declarations alongside it.
 * Firebase and Gemini are externalized as peer dependencies.
 *
 * Run via: npm run build:lib
 */

import path from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      include: ['src/lib.ts', 'src/services/**/*.ts'],
      exclude: ['src/__tests__/**'],
      tsConfigFilePath: './tsconfig.lib.json',
    }),
  ],
  publicDir: false,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/lib.ts'),
      name: 'KnowledgeCommon',
      formats: ['es'],
      fileName: 'index',
    },
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      external: [
        /^firebase\//,
        '@google/genai',
      ],
    },
  },
});
