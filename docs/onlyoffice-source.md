# ONLYOFFICE 10.0.0 来源、实际架构与集成

记录日期：2026-10-21。所有引擎结论依据本地实际签出的源码及自动测试；当前执行主机是 macOS ARM64，并非目标 Windows VM。

## 固定来源

首先执行 `git clone --depth 1 --branch v10.0.0 https://github.com/ONLYOFFICE/DesktopEditors.git third_party/ONLYOFFICE/DesktopEditors`，再执行 `git submodule update --init --depth 1 --jobs 4 core sdkjs web-apps`。未切换镜像、Fork 或各组件 master。首次沙箱 DNS 失败后使用获授权的网络权限访问同一官方地址。

| 模块                   | 官方 remote                                      | 实际 HEAD                                  |
| ---------------------- | ------------------------------------------------ | ------------------------------------------ |
| DesktopEditors v10.0.0 | https://github.com/ONLYOFFICE/DesktopEditors.git | `47522aa00c12940ee2c4e2cf1546044e4af8ee75` |
| core                   | https://github.com/ONLYOFFICE/core.git           | `3250a848ee4ef20c2fb8c38dc86350ec579124b8` |
| sdkjs                  | https://github.com/ONLYOFFICE/sdkjs.git          | `72b0421c0bbf9d01eed9cf14834ae47eb2df1b50` |
| web-apps               | https://github.com/ONLYOFFICE/web-apps-pro.git   | `9c0ca538c3b211052347df09d2a4d6781f023403` |

注意：此标签的 `.gitmodules` 为 web-apps 指定的真实官方地址是 **web-apps-pro**，没有擅自换成 web-apps。子模块 `git describe` 可能显示内部 v9.4.x 标签；版本依据父仓库 v10.0.0 的 gitlink 和官方 v10.0.0 编译包确定，没有自行拼接不同版本。`desktop-sdk` / `desktop-apps` / dictionaries 未初始化；Demo 不依赖它们。

机器可读固定记录：`engine/onlyoffice/upstream.lock.json`。准备脚本验证 HEAD、官方 remote 和跟踪文件无修改；对应源码归档中的无 .git 检出由 source-checkouts.json 逐文件 SHA256 校验（58,979 个文件），因此从归档构建不必重新克隆；使用原版 `sdkjs/build/build.py --product slide`，设置 `PRODUCT_VERSION=10.0.0`。未修改上游源码文件。

所有检出源码、发布包、原生组件均在被忽略的 `third_party/ONLYOFFICE/`、`runtime/onlyoffice/`；生成的 SDK 在被忽略的 `public/onlyoffice/runtime/`。主项目当前并无 `.git`，但已配置忽略策略，后续初始化仓库时可避免加入数 GB 的上游源码。

## 可追溯的官方原生发布包

官方发布页：https://github.com/ONLYOFFICE/DesktopEditors/releases/tag/v10.0.0

校验值来自其官方 expanded_assets 页面；下载仅使用 `github.com/ONLYOFFICE/DesktopEditors/releases/download/v10.0.0/`。

| 平台          | 文件                     | 官方 SHA256                                                        |
| ------------- | ------------------------ | ------------------------------------------------------------------ |
| macOS ARM64   | ONLYOFFICE-arm.dmg       | `9095cc8c46f1206237d690c7e146fada0d72dbf7f40c035cd5fd218b680c2deb` |
| Windows x64   | DesktopEditors_x64.zip   | `54979d04f1cdca56deb0c62e0356355a45f392cdb54f04f6b7e436b1f44c3605` |
| Windows ARM64 | DesktopEditors_arm64.zip | `02bb5cdf8458bbffac5c7d7c031cbbc98f839874babdb293cfee5aa32ede0e1e` |

macOS 从 SHA256 与上表一致的官方 DMG 只读挂载后复制 `Contents/Resources/converter/`，运行时不依赖已安装的 ONLYOFFICE 应用。保留完整 converter 目录及其 frameworks，不只复制 x2t 可执行文件。每个平台的 `provenance.json` 记录包来源与校验值。Windows 的提取脚本同样保留 converter 子树全部文件；实际准备和验证状态见 `onlyoffice-validation.md`。

## 格式转换：已经跑通的原版路径

以下路径均相对于 `third_party/ONLYOFFICE/DesktopEditors/`。

1. `core/X2tConverter/src/main.cpp::main()/wmain()`：读取 TaskQueueDataConvert XML。
2. `core/X2tConverter/src/cextracttools.h::InputParams::FromXml*()/getConversionDirection()`、`cextracttools.cpp::getConversionDirectionFromExt()`：识别输入与目标类型。
3. `core/Common/OfficeFileFormats.h`：`AVS_OFFICESTUDIO_FILE_CANVAS_PRESENTATION = 0x2003`（8195）。这是内部演示格式，非图片/PDF。
4. `core/X2tConverter/src/lib/pptx.h::pptx2pptt_bin()`：解压 PPTX，转入 `pptx_dir2pptt_bin()`。
5. `core/OOXML/PPTXFormat/DrawingConverter/ASCOfficePPTXFileRealization.cpp::CPPTXFile::OpenFileToPPTY()`：用 `PPTX::Document::read()` 读取包；调用 `PPTX2EditorAdvanced::Convert()` 写出模型及媒体。
6. 输出 `Editor.bin`（`PPTY;...`）与 `media/*`；适配层将其原样送给 SDKJS。

ListeningSlide 实现：`electron/onlyoffice.ts::convertPresentation()`。不经过 shell 拼接；在独立临时目录写参数、执行 x2t、读取 PPTY 和媒体，完成/失败后删除临时目录。检查 ZIP 签名、演示部件、路径、原始/解压/媒体体积；转换限时 120 秒。运行时无需 Office、WPS、ONLYOFFICE 桌面进程、Document Server 或互联网。

结论：**当前方案依赖独立本地 x2t 组件及其原生依赖**。它们可作为 Electron extraResources 提供，必须按架构匹配并同时履行源码、版权和依赖许可义务。Windows ZIP 的 converter 未包含 MSVCP140.dll / VCRUNTIME140.dll；实际 VM 已安装微软 14.51.36247.0 运行库。本项目没有将下载的微软运行库 DLL 并入可发布包：其 EULA 的再分发条件独立于 AGPL，发行 app-local CRT 需要相应 Visual Studio 再分发权利。当前 Windows Demo 依赖目标系统已有 VC++ v14 runtime。并未证明全部原生依赖可任意删减。

### 为何没有直接使用浏览器 PPTX 入口

`sdkjs/slide/api.js::openDocument()` 存在 `OpenDocumentFromZip()` 路径；但在父仓库固定的此 SDKJS 提交中，`OpenDocumentFromZipNoInit()` 调用的 `CPresentation.readTableStylesFromXml()` 没有实现，实际课件加载抛出 TypeError。仓库中也没有可供补入的该方法实现。本项目未补写解析器、未拉入其他版本代码，而使用已成功的官方 Core → PPTY 路径。

## 渲染和动画的真实调用关系

| 作用            | 实际源码及对象/函数                                                                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SDK 初始化      | `sdkjs/common/apiBase.js::baseEditorsApi._init()/_onEndLoadSdk()`；`sdkjs/slide/api.js::asc_docs_api._onEndLoadSdk()`                                                                  |
| 演示模型        | `sdkjs/slide/Editor/Format/Presentation.js::CPresentation`、`Slide.js::Slide`；页面内容位于 `Slides[i].cSld.spTree`                                                                    |
| PPTY 加载       | `sdkjs/slide/api.js::OpenDocumentFromBin()` → `sdkjs/common/Shapes/Serialize.js::BinaryPPTYLoader.Load()`                                                                              |
| 排版、模型计算  | `CPresentation.Recalculate()` 与 `sdkjs/common/Drawings/Format/*`、`sdkjs/word/Editor/*` 的共享文字/表格/字体系统                                                                      |
| Canvas 编辑内核 | `sdkjs/slide/Drawing/HtmlPage.js::CEditorPage`、`DrawingDocument.js`；保留它们供内部模型初始化，隐藏其编辑器 DOM                                                                       |
| 放映入口        | `sdkjs/slide/api.js::StartDemonstration(divId, slideIndex)` → `sdkjs/slide/Drawing/Transitions.js::CDemonstrationManager.Start()`                                                      |
| 放映绘制        | `CDemonstrationManager.CacheSlide()/OnPaintSlide()/OnRecalculateAnimationFrame()` 调用 `CAnimationPlayer.drawFrame()`；Canvas 内绘制原始模型                                           |
| 动画模型/调度   | `sdkjs/slide/Editor/Format/Timing.js::CAnimationPlayer`、`CTimeNodeBase.getStartTrigger()`、`CEventsProcessor`、`CAnimationScheduler.handleEvents()`                                   |
| 进入动画前隐藏  | `CAnimationDrawer.isDrawingHidden()/isDrawingVisible()`、`CAnimSandwich`；由原版引擎控制，不由 React 重建 DOM                                                                          |
| 点击推进        | `asc_docs_api.DemonstrationNextSlide()` → `CDemonstrationManager.OnNextSlide()` → `OnNextSlideAnimPlayer()` → `CAnimationPlayer.onNextSlide()`；仍有步骤时消费事件，否则 `NextSlide()` |
| 跳页            | `asc_docs_api.DemonstrationGoToSlide()` → `CDemonstrationManager.GoToSlide()`；总览使用跳页；fix2 的按钮和滑动使用动画步骤接口                                                         |
| 原始鼠标命中    | 上游提供 `CDemonstrationManager.onMouseDown()/onMouseUp()`；集成由原 Stage 捕获指针，普通点击保持原来的不推进行为                                                                      |
| 放映结束        | `asc_docs_api.EndDemonstration()`、`CDemonstrationManager.End()`；整个 iframe 移除回收全局对象、定时器和 WASM 内存                                                                     |
| 等比与黑边      | `CTransitionAnimation.CalculateRectDemonstration()` 按 Canvas 尺寸及 `GetWidthMM()/GetHeightMM()` 计算 `Transition.Rect`                                                               |

### 三种调度

`Timing.js::CTimeNodeBase.getStartTrigger()` 的实际分支：

- `NODE_TYPE_CLICKEFFECT`：建立外部 `COND_EVNT_ON_CLICK` 触发器。
- `NODE_TYPE_WITHEFFECT`：沿 `getPreviousNode()` 找前一个非 With/After 效果，等待它 active 或 atEnd。
- `NODE_TYPE_AFTEREFFECT`：等待直接前一时间节点 `isAtEnd()`。

`CCondLst.createComplexTrigger()` 等提供事件与 delay 条件，`CAnimationScheduler.handleEvents()` 逐帧消费满足条件的事件。`CAnimationPlayer.onNextSlide()` 首先提交 ON_NEXT，再尝试 ON_CLICK。本项目没有实现自己的动画队列，也没有把 PPTX 转为静态截图。

方向键、两侧按钮和水平滑动触发上述引擎事件，普通点击不推进动画。动画顺序与进入对象的初始隐藏状态由官方时间线决定，界面交互采用人工验证。

返回页面和重置菜单均恢复本页初始动画状态，沿用 ListeningSlide 原来的操作逻辑。进入对象在对应动画前保持隐藏。

## 字体、图片、主题和共享资源

- 保留原版 `common/libfont/engine/fonts.js` / `fonts.wasm`、文字测量、FreeType/Harfbuzz 相关共享代码。未用浏览器 CSS 文字替代 Canvas 排版。
- `common/Drawings/Externals.js::checkAllFonts()` 读取生成的 `AllFonts.js`；`common/GlobalLoaders.js::CGlobalFontLoader` 加载字体字节，`AscFonts.g_fontApplication` 做字体匹配与回退。
- 随项目带有 OFL 字体 Liberation 2.1.5、Noto Sans SC 2.004，来源、许可证、原始字体与 SHA256 见 `third_party/fonts/README.md` / `checksums.json`。无授权不分发系统 Arial 等字体。缺字体会在界面提示，不能保证任意课件与原机字体完全一致。
- web 字体数据由本次固定 Core 的 `DesktopEditor/AllFontsGen/main.cpp` 原样编译，链接已校验官方 ARM64 frameworks 后生成；不必完整编译 C++。`pnpm run onlyoffice:fonts` 可在此 macOS ARM64 主机再生成；Windows 普通准备直接使用架构无关的已生成数据。
- 图片通过 `AscCommon.g_oDocumentUrls.init(mapping)` 把转换后的 `media/*` 对应到 Blob URL；`CGlobalImageLoader` 原样加载。文件关闭后 iframe 销毁，Blob 全部释放。
- `OpenDocumentFromBin()` 读取 PPTY 内的主题、母版、布局；保留 SDKJS themes/共享资源。未调用编辑器主题库 `SetThemesPath()` 去请求未生成的 themes.js，已有课件的主题仍来自文档。
- `web-apps/vendor/xregexp/xregexp-all-min.js` 是必要外部 JS 依赖（来自同一固定子模块）。不依赖 Ribbon、Backbone 应用、评论或云网关。

### 最小依赖的边界

转换依赖是 x2t 的完整平台 converter 目录。渲染依赖是 SDKJS 的 slide 产品加其 build.py 生成的共享模块和资源、字体 WASM/字体、XRegExp。虽然代码包含部分可编辑模型，贸然删除会破坏字体、表格、动画和排版，故保留。完整 web-apps 编辑器 UI、协同、服务器、桌面 CEF 桥无需运行。

## Adapter 与媒体接管

自有接口：`src/slideshow/types.ts::ISlideshowEngine`；实现：`OnlyOfficeEngine.ts`。React 只持有 load/start/nextStep/previousSlide/nextSlide/goToSlide、状态订阅与媒体对象，不接触 SDK 内部类。所有 SDK 专有调用收敛在 `engine/onlyoffice/bridge.js`，每次打开使用新的 iframe realm。

媒体数据依据 `common/Drawings/Format/GraphicObjectBase.js::getUniMedia()/getCNvProps()/getFormatId()`、`Image.js::CImageShape.getMediaFileName()`。`CUniMedia.type === 8` 为音频、7 为视频；原始 OOXML ID 是 cNvPr.id，不能用 SDK 的运行期 Id 代替，且 ID 需与页索引组合。

Overlay 将 `getTransformMatrix()`（含组合/旋转）四角、`CAnimationPlayer.getDrawingParams()` 中当前动画纹理矩阵，映射至 `DemonstrationManager.Transition.Rect`；使用实际 Canvas CSS/物理像素比例，避免高 DPI 双倍偏移。`screenBounds` 与 `screenPolygon` 单位为相对于全尺寸 host 的 CSS px。逐帧同步隐藏状态和坐标；悬浮层不参与舞台尺寸计算。

模型媒体方法无法提供的 trim 返回 null；ListeningSlide 继续使用原有 `extractAudio()` 解析原始 p14:trim、媒体关系和同源音轨。透明区域使用原始 Shape ID 连接原版 AudioPlayerInstance，保留倍速、A–B、进度、裁剪和跨页固定。BinaryPPTYLoader 会改写内部 CNvPr.id，适配层在 ReadCNvPr 阶段用 WeakMap 保存原始 ID；没有修改上游源码。

没有创建 `AscDesktopEditor`；`apiBase.js::callMediaPlayerCommand()` 原本只把媒体命令送给该原生桥。集成额外将此方法路由到 host，并用 iframe CSP `media-src 'none'` 和 autoplay 禁止策略阻止原生音频，避免将来双重发声。

## 许可证与修改

DesktopEditors、Core、SDKJS、web-apps 的 LICENSE 是 **AGPL-3.0 加上该版本明确附加条款**；非代码素材另有 CC BY-SA 4.0。不能只把 package.json 保留 MIT 视为整个集成的许可。项目现在按 AGPL-3.0-only 标注，保留完整原版 LICENSE，随包保留完整许可、来源和对应源码说明；原版界面没有新增许可按钮。XRegExp、字体及原生组件依赖保留各自许可。

2026-10-21：仅新增/修改自有适配、初始化桥、Electron 转换调用、资源准备、测试课件和界面；上游跟踪源码无修改。相应源码构建与获取办法见 `SOURCE.md`；`pnpm run dist:source` 打包本项目和完整固定检出源码，必须与可执行文件一起交付。此文档不是免除 AGPL 或字体许可条件的授权书。

## 保留原有 UI 的接入方式

入口为 `App.tsx`，只使用 ONLYOFFICE 放映路径。导入时由官方 x2t 转换，原 XML 仅提供页顺序、尺寸与音频，不再调用第三方 HTML 渲染器。`Stage` 的原有 JSX、样式和音频实例管理保留；其显示 host 内部放置禁止原生指针输入的 ONLYOFFICE iframe，手势和键盘仍走原 Stage。

`CAnimationPlayer.onNextSlide()` 消费方向键、前进按钮和左划的动画事件；无剩余动画时通知原 Stage 翻页或进入原结束画面。动画中再按前进仅完成当前组，使用与上游 `goToEnd()` 相同的 timer.elapsed / onFrame 机制，不发送额外点击。回退通过 StopAllAnimations、StartSlide 和官方调度器重放到前一步，兼容缺少 prevCondLst 的文件；每次翻页返回或原菜单重置均重新开始本页动画。禁用自动翻页模式，避免改变原来由手势/按键控制页面的规则。

总览保持原来的布局，图片由官方 `Slide.getBase64Img()` 生成，仅用于缩略图；实际放映始终为原版 Canvas 动画。保留播放器布局与交互；App.tsx 过滤过时进度并提供主页作者信息入口，styles.css 修正紧凑回退数字居中并提供信息弹窗样式。

## fix1：真实 Office 媒体裁剪兼容

真实课件暴露了固定 Gitlink 的 SDKJS 与官方 10.0.0 build 169 转换产物之间的字段差异。`Serialize.js::BinaryPPTYLoader.ReadPic(type)` 的媒体子记录 5 只处理 0（文件名）和 1（外链标记）。官方桌面版随包的 SDKJS 对应函数还处理 2/3 两个 double，并赋给 `UniMedia.start/end`。官方 x2t 的真实输出包含这两个字段；旧读取器未消费它们，后续对象记录错位，最后在 ReadHyperlink 的无界循环中卡住，整个同进程 iframe/React 界面无响应。

本项目 `bridge.js::installMediaTrimReader()` 保留上游 ReadPic，预检媒体记录边界，按小端 Float64 读取 2/3 并在原读取器经过这些位置时消费对应字节，将 start/end 写回媒体模型。所有绘制、排版和动画继续使用固定 SDKJS，没有切换第三方引擎、降低课件复杂度或删除音频/答案。上游检出文件未改动。未修改用户 PPTX。

`electron/conversionQueue.ts` 对相同内容的在途请求共享转换，不同课件顺序转换，失败后队列继续；不再用单个 busy 布尔值拒绝下一次打开。App 的进度回调按加载序号过滤，避免过时请求覆盖当前加载状态。

同一课件的重复媒体引用现在共享一个不可变 Blob URL，每个音频对象仍保留独立 Audio 元素和裁剪状态。避免在数十页反复引用大 MP3 时重复解压、复制相同字节。

## fix2：统一导航输入

用户确认实体键盘能正确逐步显示第 16 页内容，要求按钮与滑动同样遵循动画顺序。`Stage.tsx` 的右侧按钮及左划改为 `nextStep()`，左侧按钮及右划改为 `previousStep()`；不再调用直接翻页路径。第一页只有在没有已播放步骤时禁用后退按钮。普通点击、音频手势隔离、菜单、总览、样式和文案不变。未修改上游源码、转换器或用户课件。

真实课件第 16 页在 OOXML 中先以单击触发文本框 7 的 barn(inVertical) 进入动画，再单击触发文本框 2（答案 C）。底部文字初始隐藏是课件的动画状态；原按钮和滑动绕过该时间线，导致用户无法通过这两种输入显示它。现在复用键盘已验证的官方调度器执行这两步，不强制提前显示答案。
