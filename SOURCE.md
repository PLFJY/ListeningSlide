# Corresponding source and build instructions

This ListeningSlide integration is based on ONLYOFFICE DesktopEditors v10.0.0 by Ascensio System SIA. All application source, integration changes, build/test scripts, dependency lockfiles and font licenses must accompany distributed binaries. The integration date is 2026-10-21; upstream tracked code is unmodified.

1. Use the ListeningSlide source archive supplied alongside the executable. Run `pnpm install --frozen-lockfile` with the packageManager version in package.json; Node.js 22.12+ and Python 3 are required for building.
2. `engine/onlyoffice/upstream.lock.json` contains the complete parent and submodule commit pins. `pnpm run onlyoffice:prepare -- --platform win32-x64` retrieves exactly those official sources and a SHA256-verified official v10.0.0 converter archive. Use win32-arm64 or darwin-arm64 for those targets. No other mirror or fork is used.
3. Build SDKJS with the unmodified `sdkjs/build/build.py --product slide` (performed by the prepare script). The source archive includes its shared sources, resources and dependency licenses, plus the complete core/web-apps checkouts. Archived trees do not include .git; the preparation script verifies all 58,979 tracked upstream files against the supplied source-checkouts.json rather than recloning them.
4. Fonts are bundled with their OFL notices, checksums and generated cross-platform font data. Optional native font-data regeneration is explained in third_party/fonts/README.md. Ordinary Windows builds do not need to compile Core.
5. Run `pnpm test` and `pnpm run build`; verify UI and slideshow behavior manually with `pnpm run dev`. `pnpm run dist:win` creates x64 portable output; `pnpm run dist:win:arm64` creates native ARM64 output.
6. `pnpm run dist:source` creates `release/ListeningSlide-<version>-source.tar.gz` containing the project and the complete fixed upstream sources, excluding .git/downloads/build output. Supply it beside each corresponding executable. Preserve the release's dependency manifests, licenses and this document. Do not publish a binary without its matching corresponding source being available under the applicable license.

Native converter rebuild entry points: core/X2tConverter/ and core/DesktopEditor/AllFontsGen/ in the included fixed core source. Upstream build instructions are preserved in the included DesktopEditors/README.md and core build/project files; official build tooling: https://github.com/ONLYOFFICE/build_tools . The first Demo uses unmodified official binaries rather than claiming that the complete C++ toolchain was rebuilt locally.

Original repositories: https://github.com/ONLYOFFICE/DesktopEditors , https://github.com/ONLYOFFICE/core , https://github.com/ONLYOFFICE/sdkjs , https://github.com/ONLYOFFICE/web-apps-pro . Exact commits and release hashes: docs/onlyoffice-source.md.

AGPL-3.0 and the original additional terms are in LICENSE. Native binary and non-code dependency conditions also apply; keep THIRD_PARTY_NOTICES.md and packaged license directories with the executable.

Windows converter PE imports require Microsoft VC++ v14 runtime. The tested VM has version 14.51.36247.0. The official ONLYOFFICE ZIP does not bundle those CRT DLLs; this preview does not redistribute extracted Microsoft DLLs. Any future app-local CRT distribution must comply with the independent Microsoft/Visual Studio redistribution terms. Reference: https://learn.microsoft.com/en-us/cpp/windows/redistributing-visual-cpp-files .
