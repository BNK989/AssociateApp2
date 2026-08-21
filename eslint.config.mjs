import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Physical (left/right) Tailwind utilities. CLAUDE.md §7 requires CSS logical
 * properties so the same markup serves LTR (en/de/es/fr/ro) and RTL (he/ar).
 */
const PHYSICAL_DIRECTION_PATTERN = [
  String.raw`(^|[\s"'\`:])(ml|mr|pl|pr)-(\d|px|auto|\[)`,
  String.raw`(^|[\s"'\`:])(left|right)-(\d|px|auto|full|\[)`,
  String.raw`(^|[\s"'\`:])text-(left|right)(\s|$|"|'|\`)`,
  String.raw`(^|[\s"'\`:])border-(l|r)(-|\s|$|"|'|\`)`,
  String.raw`(^|[\s"'\`:])rounded-(tl|tr|bl|br|l|r)-`,
].join("|");

const RTL_MESSAGE =
  "Use CSS logical properties (ms-*, me-*, ps-*, pe-*, start-*, end-*, text-start, text-end, border-s, border-e, rounded-s-*, rounded-e-*) instead of physical left/right utilities. See CLAUDE.md §7.";

const rtlRestrictedSyntax = [
  {
    selector: `Literal[value=/${PHYSICAL_DIRECTION_PATTERN}/]`,
    message: RTL_MESSAGE,
  },
  {
    selector: `TemplateElement[value.raw=/${PHYSICAL_DIRECTION_PATTERN}/]`,
    message: RTL_MESSAGE,
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    name: "associateapp/standards",
    files: ["src/**/*.{ts,tsx}", "scripts/**/*.{ts,tsx}"],
    rules: {
      // CLAUDE.md §1 — no `any`. Use `unknown` and narrow, or write an interface.
      "@typescript-eslint/no-explicit-any": "error",

      // CLAUDE.md §7 — RTL safety.
      "no-restricted-syntax": ["error", ...rtlRestrictedSyntax],

      // CLAUDE.md §8 — route logging through src/lib/logger.ts.
      "no-console": "error",

      // React 19's compiler lint flags every setState reachable from an effect.
      // The 6 current sites are all legitimate external-system synchronisation —
      // reading localStorage on mount, waiting on the PostHog SDK, kicking off a
      // fetch/realtime subscription — which is what effects are for. Eliminating
      // them means restructuring to derive during render, which for CipherText's
      // animation state machine is a rewrite rather than a fix. Kept visible as a
      // warning; see CLAUDE.md Known Debt.
      "react-hooks/set-state-in-effect": "warn",
    },
  },

  {
    // Vendored shadcn/ui primitives keep upstream physical properties so they
    // survive `npx shadcn add`. Exempt under CLAUDE.md §7.
    name: "associateapp/vendored-ui",
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },

  {
    // The single sanctioned console transport.
    name: "associateapp/logger",
    files: ["src/lib/logger.ts"],
    rules: {
      "no-console": "off",
    },
  },

  {
    // CLI scripts write to stdout by design, and test output is not shipped.
    name: "associateapp/console-exempt",
    files: ["scripts/**/*.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    rules: {
      "no-console": "off",
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "supabase/**",
    // Agent tooling (Antigravity / Claude Code skill scripts), not app source.
    ".agent/**",
    ".agents/**",
  ]),
]);

export default eslintConfig;
