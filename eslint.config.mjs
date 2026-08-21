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

/**
 * CLAUDE.md §2 size ratchet.
 *
 * Every entry is a file that predates the 350-line cap, pinned to its exact
 * current length. It may shrink; it may not grow. When you refactor one below
 * its number, lower the number in the same commit — that locks in the win.
 * Delete the entry entirely once the file is under 350.
 *
 * Do not add entries. New files land under the cap or they do not land.
 *
 * Paths use `**` rather than literal `[locale]` / `[id]` because square brackets
 * are character classes in the glob syntax ESLint matches with.
 */
const GRANDFATHERED_MAX_LINES = {
  "src/app/**/daily/DailyGameClient.tsx": 1105,
  "src/hooks/useGameLogic.ts": 1104,
  "src/components/game/ChatArea.tsx": 683,
  "src/components/game/InfoScreen.tsx": 589,
  "src/components/Lobby.tsx": 573,
  "src/app/api/game/**/action/route.ts": 572,
  "src/components/CipherText.tsx": 546,
  "src/components/game/GameHeader.tsx": 525,
  "src/components/game/GameInput.tsx": 516,
};

const sizeRatchet = Object.entries(GRANDFATHERED_MAX_LINES).map(([file, max]) => ({
  name: `associateapp/size-ratchet/${file}`,
  files: [file],
  rules: {
    "max-lines": ["error", { max, skipBlankLines: false, skipComments: false }],
  },
}));

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    name: "associateapp/standards",
    files: ["src/**/*.{ts,tsx}", "scripts/**/*.{ts,tsx}"],
    rules: {
      // CLAUDE.md §1 — no `any`. Use `unknown` and narrow, or write an interface.
      "@typescript-eslint/no-explicit-any": "error",

      // CLAUDE.md §2 — 350-line cap. Grandfathered files are pinned to their
      // current size in the ratchet block below, so they can shrink but not grow.
      "max-lines": ["error", { max: 350, skipBlankLines: false, skipComments: false }],

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

  {
    // Generated artifacts are regenerated wholesale, never hand-edited (§2).
    name: "associateapp/generated",
    files: ["src/types/database.types.ts"],
    rules: {
      "max-lines": "off",
    },
  },

  // Per-file size ceilings for the pre-cap files. Must come after the block that
  // sets the global 350 default so these win.
  ...sizeRatchet,

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
