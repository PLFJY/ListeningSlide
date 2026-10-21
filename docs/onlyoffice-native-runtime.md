# Windows 原生依赖实测

2026-10-21，通过本机 Parallels `prlctl exec` 对已运行的 Windows 11 ARM64 VM 执行 CLI，没有操作人工 GUI，也没有安装软件。

官方 ARM64 converter 的 PE import table 除包内 ONLYOFFICE / ICU DLL 外，还引用 Windows 系统 DLL、Universal CRT API 集，以及 `MSVCP140.dll` / `VCRUNTIME140.dll`。官方 DesktopEditors_arm64.zip 内没有后两者。VM 实际已有微软运行库 `14.51.36247.0`。

执行 `scripts/verify-windows-converter.ps1 -Architecture arm64` 的实测结果：x2t 版本 `10.0.0.169`，退出码 0，输出 PPTY 22,894 bytes 和 6 个媒体资源。此前使用带动画的演示课件验证；当前 CLI 检查工具使用附带的 `public/demo.pptx`。同一 VM 的 x64 仿真环境也执行通过同一测试，版本和输出大小一致；x64 PE 还引用 VCRUNTIME140_1.dll。此检查仅证明格式转换成功，不能代替放映 GUI、动画和字体验收。

为调查 app-local 部署，读取了微软官方运行时包及 EULA，未运行安装器，也未把其中 DLL 并入 ListeningSlide 发行包。微软资料明确将再分发权与 Visual Studio 许可关联；该权利不能由 ONLYOFFICE 的 AGPL 推导。

微软资料：

- https://learn.microsoft.com/en-us/cpp/windows/redistributing-visual-cpp-files
- https://learn.microsoft.com/en-us/cpp/windows/walkthrough-deploying-a-visual-cpp-application-to-an-application-local-folder
- https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist

调查包来自官方 `aka.ms/vc14/`，解析到微软发布服务器：

| 架构  | 完整官方来源                                                                                                                                                                      | SHA256                                                             |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| ARM64 | https://download.visualstudio.microsoft.com/download/pr/6ad63323-a427-4c58-8464-9f1f19f62359/B70EF586669A620A0A30A1156969C05C6A3831DC8F8BC992DA75779D2A92F944/VC_redist.arm64.exe | `b70ef586669a620a0a30a1156969c05c6a3831dc8f8bc992da75779d2a92f944` |
| x64   | https://download.visualstudio.microsoft.com/download/pr/ebdab8e5-1d7b-4d9f-a11b-cbb1720c3b12/843068991DAAA1F73AD9F6239BCE4D0F6A07A51F18C37EA2A867E9BECA71295C/VC_redist.x64.exe   | `843068991daaa1f73ad9f6239bce4d0f6a07a51f18c37ea2a867e9beca71295c` |

`third_party/Microsoft/` 仅为被忽略的本地调查下载，独立于 ONLYOFFICE 来源。`scripts/check-windows-imports.mjs` 可列出 converter 的 PE 依赖，避免误以为完整 converter 目录已经包含微软 C++ runtime。当前 Windows Demo 需要系统已有 VC++ v14 runtime；不能把它标记为“干净 Windows 无任何前置运行库已验证”。

Windows x64 打包应用本地副本也通过完整的 9 组生产放映自动检查，包括首帧答案隐藏、点击后显示、翻页、Overlay、全屏与关闭。测试运行在 Windows 11 ARM64 的 x64 仿真层。UNC 共享目录启动发生 GPU 子进程错误，本地复制后通过；必须区分此自动测试与后续人工教学课件验收。
