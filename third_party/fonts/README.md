# ListeningSlide 离线字体

只分发下面明确开放许可的字体；系统 Arial 等只在早期本机探测使用，已从当前运行时移除。

| 字体                                         | 原始来源                                                                                                                     | 许可                                                      |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Liberation 2.1.5，Sans/Serif/Mono 各四种样式 | https://github.com/liberationfonts/liberation-fonts/files/7261482/liberation-fonts-ttf-2.1.5.tar.gz                          | SIL Open Font License 1.1，见 liberation/LICENSE、AUTHORS |
| Noto Sans SC Regular，Sans2.004              | https://github.com/notofonts/noto-cjk/blob/523d033d6cb47f4a80c58a35753646f5c3608a78/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf | SIL Open Font License 1.1，见 noto-sc/LICENSE             |

Liberation 官方归档 SHA256：`7191c669bf38899f73a2094ed00f7b800553364f90e2637010a69c0e268f25d0`。
Noto OTF SHA256：`faa6c9df652116dde789d351359f3d7e5d2285a2b2a1f04a2d7244df706d5ea9`。

`web/AllFonts.js` 与编号字体由官方 ONLYOFFICE Core `3250a848ee4ef20c2fb8c38dc86350ec579124b8` 的 `DesktopEditor/AllFontsGen/main.cpp` 生成。编号文件是原始字体字节的副本，文件名供原版 CFontFileLoader 使用。字体未修改；元数据和回退范围由官方生成器提供，生成代码适用引擎的 AGPL 条款。每个文件 SHA256 记录于 checksums.json。

`pnpm run onlyoffice:fonts` 可在本次 macOS ARM64 开发平台重新生成。Windows 启动和构建使用本目录的跨平台结果，不依赖字体生成器、macOS 或系统已安装字体。字体替代由原版 ONLYOFFICE 匹配器处理，界面会提示缺失字体；需要精确排版时须提供有使用权的对应字体并重新生成字体包。
