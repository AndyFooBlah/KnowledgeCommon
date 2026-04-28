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

import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: './tsconfig.json' },
      globals: { ...globals.node },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-unsafe-function-type': 'error',
      // Hard rule: a library must not reach for env-supplied credentials.
      // Anything VITE_*-prefixed gets baked into a consumer's bundle;
      // anything process.env.*_API_KEY/SECRET/TOKEN/GEMINI* would imply the
      // library is reading a key it should never own. All Gemini access is
      // via the consumer-supplied broker (gemini.invokeGemini /
      // gemini.embedContent passed to initializeKnowledgeCommon).
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "MemberExpression[object.object.type='MetaProperty'][object.property.name='env']",
          message:
            'A library must not read import.meta.env.* — anything bundled here forces the value into every consumer. Configuration belongs in initializeKnowledgeCommon(...) at runtime.',
        },
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env'][property.name=/(GEMINI|API_KEY|SECRET|TOKEN)/i]",
          message:
            'A library must not read process.env.GEMINI_* / *_API_KEY / *_SECRET / *_TOKEN. Consumers pass the gemini broker at init time; the library never holds keys.',
        },
      ],
    },
  },
  {
    files: ['src/__tests__/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'error',
    },
  },
  {
    ignores: ['dist/', 'node_modules/'],
  },
];
