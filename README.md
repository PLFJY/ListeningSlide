# ListeningSlide

离线的 Electron PPTX 听力教学播放器，使用 **ONLYOFFICE DesktopEditors 10.0.0 官方固定源码**提供幻灯片绘制、排版和动画。无需安装 Office、WPS、ONLYOFFICE 桌面版或 Document Server。

采用简洁的系统字体、纯色背景与轻量磨砂浮层，支持答案动画、原生墨迹批注、独立音频播放器、音频裁剪、倍速、A–B 循环、多实例与跨页固定。界面跟随系统明暗主题，并适配减少动态效果、减少透明度与增强对比度偏好。

## 开发

需要 Node.js 22.12+、Python 3 和 `package.json` 指定的 pnpm 版本。

```sh
git clone https://github.com/PLFJY/ListeningSlide.git
cd ListeningSlide
pnpm install --frozen-lockfile
pnpm run onlyoffice:prepare -- --platform win32-x64
pnpm run dev
```

macOS Apple Silicon 将准备平台改为 `darwin-arm64`，Windows ARM64 原生版本使用 `win32-arm64`。准备脚本获取固定提交的官方源码和校验过的官方转换组件，同时生成本地浏览器引擎。可以通过 `--archive <路径>` 使用已下载的官方包，仍需通过 SHA256 校验。

`pnpm run dev:web` 只启动 Web 界面；正常打开 PPTX 需要 Electron 的本地转换 IPC。

## 使用

- 打开、拖入本地 PPTX，或打开内置演示课件。
- 键盘方向键、两侧按钮与左右滑动先推进或回退动画，步骤结束后再翻页；返回页面时重置动画。
- 滚轮向下推进、向上回退。连续滚动可完成当前动画，同一滚动与惯性不会继续跳过后续步骤。播放器、菜单与总览的滚动不触发放映。
- 普通单击、双击不推进动画；Home / End 跳到首尾页，F / Esc 控制全屏。
- 点击音频图标打开播放器，支持裁剪、进度、倍速、A–B、拖动缩放、折叠及跨页固定。
- 左下角依次为返回首页、笔与更多菜单；更多包含总览、全屏、透明度和播放设置。末页之后进入黑色结束画面。
- 点击笔启用批注，支持画笔、荧光笔、六种颜色、三档粗细、整笔橡皮擦及清空本页。书写时自动收起面板；笔按钮仅展开或收起工具，不退出书写。P 切换画笔 / 浏览，Esc 优先退出批注。
- 批注期间书写不触发音频，并屏蔽滑动、滚轮和键盘翻页；仅两侧按钮的轻点可推进动画及翻页。墨迹按页保留；返回首页、重新打开课件或关闭程序后丢弃，不保存到原始 PPTX。
- 画笔使用 SDK 已有的圆头/圆角参数；多指接触不会翻页，失焦或尺寸变化会结束当前笔画。小音频图标扩大手指命中范围，菜单、总览和音频内容支持触摸滚动；播放器拖动/缩放区独立于播放按钮。

主页右下角的信息按钮显示作者信息与 ONLYOFFICE 版权说明。编辑 [src/author.ts](src/author.ts) 中的 `authorInfo` 即可填写作者介绍，支持换行；可留空，无占位文案。完整上游许可可在同一弹窗展开查看。

## 验证与打包

```sh
pnpm test
pnpm run build
pnpm run dist:win          # Windows x64 绿色版
pnpm run dist:win:arm64    # Windows ARM64 原生绿色版
pnpm run dist:mac
pnpm run dist:source       # 与二进制共同分发的完整对应源码
```

Windows 产物位于 `release/onlyoffice/`。运行时随包提供官方 x2t 及其依赖，实际放映是 SDKJS Canvas 动画；总览截图仅用于缩略图。原生运行时、上游检出、生成引擎、私有课件和打包结果不提交到本仓库。

Windows converter 需要 Microsoft VC++ v14 runtime；当前包未附带微软 CRT。Windows 虚拟机应将绿色包复制到本地文件夹运行，UNC 共享目录启动在已测环境中出现过 GPU 子进程失败。已测 Windows x64 应用运行在 Windows 11 ARM64 仿真环境；不能视为原生 ARM64 Electron 验证。

界面与放映交互由人工验证，不运行会弹出浏览器或 Electron 窗口的自动测试。核心单元测试无需窗口。运行 `pnpm run dev` 后，人工检查作者弹窗、课件动画、批注、滚轮与手势、音频及全屏；范围见 [验证记录](docs/onlyoffice-validation.md)。开发与构建会同步自有播放器适配文件，修改 `engine/onlyoffice/` 后无需重编译上游 SDKJS。

`pnpm run demo:generate` 可重新生成主页使用的演示课件。私有课件不加入仓库。

## 源码与许可

- [架构](docs/architecture.md)
- [ONLYOFFICE 来源、固定提交、接口与适配修改](docs/onlyoffice-source.md)
- [原生运行时](docs/onlyoffice-native-runtime.md)
- [对应源码与构建](SOURCE.md)、[第三方声明](THIRD_PARTY_NOTICES.md)、[完整许可](LICENSE)

项目按 AGPL-3.0-only 标注，并保留 ONLYOFFICE 原许可证附加条款及其他素材和依赖的许可。发布可执行文件时，同时提供 `pnpm run dist:source` 生成的匹配源码包和必要声明。
