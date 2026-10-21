# Third-party notices

ListeningSlide integrates ONLYOFFICE 10.0.0, originally developed by Ascensio System SIA, Copyright 2009–2026. ListeningSlide is an independent integration with its own initialization bridge, application UI and native conversion adapter, modified/integrated on 2026-10-21. The pinned upstream tracked sources are unmodified.

ONLYOFFICE source components use GNU AGPL version 3 with the additional terms in their full LICENSE files. Non-code product content is separately licensed under CC BY-SA 4.0 where specified. The complete SDKJS license is included in LICENSE and public/onlyoffice/LICENSE.txt, available in the application notice dialog. No trademark license or endorsement is claimed.

See docs/onlyoffice-source.md and engine/onlyoffice/upstream.lock.json for every source commit and official archive SHA256. SOURCE.md documents corresponding-source access and reproducible preparation. Distribute the generated corresponding-source archive alongside every executable, retaining the upstream dependency license files within it.

The converter is the unmodified converter directory from verified official DesktopEditors v10.0.0 archives. Its native dependencies include the graphics, kernel, UnicodeConverter and format modules and their transitive third-party dependencies. Original packaged license material is retained in the runtime licenses directory; dependency source/licenses are preserved in the corresponding core source tree. This integration does not claim that the standalone x2t executable alone contains all required dependencies or notices.

XRegExp is loaded from the pinned official web-apps vendor directory. Its retained file header identifies XRegExp 3.2.0 by Steven Levithan, MIT license. Other shared libraries included by SDKJS retain their source headers and licenses in the upstream source archive.

Liberation Fonts 2.1.5 and Noto Sans SC 2.004 are distributed under SIL OFL 1.1, with complete notices in third_party/fonts/ and packaged licenses/fonts/. Font provenance and SHA256 are recorded there. System proprietary fonts are not shipped.

Electron (MIT), React (MIT), Vite (MIT), JSZip (MIT or GPL-3.0) and other project dependencies retain their respective licenses in their packages. The application contains no alternate PPTX-to-HTML renderer. @fefeding/ppt-parser is a development-only tool for generating the bundled demonstration presentation and is not included in production dependencies.

This Program is provided without warranty. Consult LICENSE and the individual dependency licenses for their complete conditions.

Windows preview prerequisite: Microsoft Visual C++ v14 runtime on the target OS. Microsoft CRT DLLs extracted for dependency investigation are not included in the application packages. Microsoft redistribution rights are separate from ONLYOFFICE AGPL; see https://learn.microsoft.com/en-us/cpp/windows/redistributing-visual-cpp-files .
