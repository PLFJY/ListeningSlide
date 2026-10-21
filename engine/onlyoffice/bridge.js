/* ListeningSlide integration, 2026-10-21. Upstream SDKJS remains unmodified.
 * Based on ONLYOFFICE 10.0.0 by Ascensio System SIA; see THIRD_PARTY_NOTICES.md. */
'use strict';
window.AscNotLoadAllScript = true;
window.flat_desine = true;
const notify = (type, data = {}) =>
  parent.postMessage({ source: 'listening-slide-engine', type, ...data }, location.origin);
const fail = (error) =>
  notify('error', { message: error instanceof Error ? error.message : String(error) });
window.addEventListener('error', (event) => fail(event.error || event.message));
window.addEventListener('unhandledrejection', (event) => fail(event.reason));
let api,
  loaded = false,
  frameId = 0,
  lastGeometry = '',
  urls = [];
const warnings = new Set();
// DesktopEditors 10.0.0 build 169 writes audio/video trim attributes 2/3 as
// doubles. The pinned SDKJS ReadPic only understands attributes 0/1. Keep its
// renderer/loader, but consume those two fields as the official desktop reader
// does, so they cannot be mistaken for subsequent drawing records.
function installMediaTrimReader(loader) {
  const readPic = loader.ReadPic;
  loader.ReadPic = function (type) {
    if (type !== 7 && type !== 8) return readPic.call(this, type);
    const stream = this.stream;
    const view = new DataView(stream.data.buffer, stream.data.byteOffset, stream.data.byteLength);
    const start = stream.cur;
    const end = start + 4 + view.getUint32(start, true);
    if (end > stream.size) throw new Error('媒体对象记录不完整');
    const skipped = new Map();
    const trim = {};
    for (let record = start + 4; record < end;) {
      const tag = view.getUint8(record);
      const next = record + 5 + view.getUint32(record + 1, true);
      if (next > end || next <= record) throw new Error('媒体对象记录边界无效');
      if (tag === 5) {
        let offset = record + 5;
        if (view.getUint8(offset++) !== 250) throw new Error('媒体属性起始标记无效');
        let terminated = false;
        while (offset < next) {
          const field = offset;
          const attribute = view.getUint8(offset++);
          if (attribute === 251) {
            terminated = true;
            break;
          }
          if (attribute === 0) {
            const length = view.getUint32(offset, true);
            offset += 4 + length * 2;
          } else if (attribute === 1) offset++;
          else if (attribute === 2 || attribute === 3) {
            if (offset + 8 > next) throw new Error('媒体裁剪属性不完整');
            trim[attribute === 2 ? 'start' : 'end'] = view.getFloat64(offset, true);
            offset += 8;
            skipped.set(field, offset);
          } else throw new Error(`不支持的媒体属性 ${attribute}`);
          if (offset > next) throw new Error('媒体属性越过记录边界');
        }
        if (!terminated) throw new Error('媒体属性结束标记缺失');
      }
      record = next;
    }
    const getByte = stream.GetUChar;
    stream.GetUChar = function () {
      while (skipped.has(this.cur)) this.Seek2(skipped.get(this.cur));
      return getByte.call(this);
    };
    let picture;
    try {
      picture = readPic.call(this, type);
    } finally {
      stream.GetUChar = getByte;
    }
    const media = picture.getUniMedia?.();
    if (media) Object.assign(media, trim);
    return picture;
  };
}
// BinaryPPTYLoader.ReadSpTreeElement may replace CNvPr.id with a durable ID.
// Capture the original binary/OOXML ID at ReadCNvPr, before that replacement.
// This hook belongs to our adapter; the pinned upstream files stay untouched.
const originalShapeIds = new WeakMap();
const BinaryPPTYLoader = AscCommon.BinaryPPTYLoader;
AscCommon.BinaryPPTYLoader = function (...args) {
  const loader = new BinaryPPTYLoader(...args);
  const read = loader.ReadCNvPr;
  loader.ReadCNvPr = function (properties) {
    const result = read.call(this, properties);
    originalShapeIds.set(properties, String(properties.id));
    return result;
  };
  installMediaTrimReader(loader);
  return loader;
};
AscCommon.BinaryPPTYLoader.prototype = BinaryPPTYLoader.prototype;
let stepIndex = 0;
const thumbnails = {};
let thumbnailsRequested = false;
function currentPlayer() {
  return api.WordControl.DemonstrationManager.GetCurrentAnimPlayer();
}
function animationBusy() {
  const player = currentPlayer();
  if (!player?.isStarted()) return false;
  return player.timings.some((timing) =>
    timing
      .getTimingRootNode()
      ?.traverseTimeNodes(
        (node) =>
          node.isActive() &&
          (node.isAnimEffect() ||
            (!node.isTimingContainer() && !node.isAudio() && !node.isVideo())),
      ),
  );
}
function finishStep() {
  const player = currentPlayer();
  // Same upstream timer mechanism as CAnimationPlayer.goToEnd, without sending
  // another click event: finish this group, including With/After Previous only.
  for (let i = 0; i < 100 && animationBusy(); i++) {
    player.timer.elapsed += 1000000;
    player.onFrame();
  }
}
function resetSlide(index) {
  const dm = api.WordControl.DemonstrationManager;
  dm.StopAllAnimations();
  if (dm.SlideNum === index) dm.StartSlide(true, false);
  else api.DemonstrationGoToSlide(index);
  dm.IsPlayMode = false; // Original host owns page changes; no automatic page timer.
  stepIndex = 0;
}
function nextStep() {
  const player = currentPlayer();
  if (animationBusy()) finishStep();
  else if (player?.onNextSlide()) stepIndex++;
  else notify('advance');
  publishState();
}
function previousStep() {
  if (!stepIndex) {
    notify('previous');
    return;
  }
  const target = stepIndex - 1;
  resetSlide(api.WordControl.DemonstrationManager.SlideNum);
  const player = currentPlayer();
  player.onFrame();
  finishStep();
  // Replay through the official scheduler so rewind also works when a PPTX
  // omits prevCondLst. Never reconstruct animation effects in the React layer.
  for (let i = 0; i < target; i++) {
    if (!player.onNextSlide()) break;
    stepIndex++;
    finishStep();
  }
  api.WordControl.DemonstrationManager.OnRecalculateAnimationFrame(player);
  publishState();
}
async function makeThumbnails() {
  if (thumbnailsRequested) return;
  thumbnailsRequested = true;
  const slides = api.WordControl.m_oLogicDocument.Slides;
  for (let index = 0; index < slides.length; index++) {
    thumbnails[index] = slides[index].getBase64Img();
    publishState();
    await new Promise(requestAnimationFrame);
  }
}
function mediaObjects() {
  const doc = api.WordControl.m_oLogicDocument;
  const dm = api.WordControl.DemonstrationManager;
  const result = [];
  if (!doc || !dm.Mode || dm.SlideNum >= doc.Slides.length) return result;
  const slide = doc.Slides[dm.SlideNum];
  const rect = dm.Transition.Rect;
  const scaleX = dm.Canvas.clientWidth / dm.Canvas.width;
  const scaleY = dm.Canvas.clientHeight / dm.Canvas.height;
  const player = dm.GetCurrentAnimPlayer();
  function visit(shapes, ancestors = []) {
    for (const shape of shapes) {
      if (shape.spTree) visit(shape.spTree, [shape, ...ancestors]);
      const media = shape.getUniMedia?.();
      if (media?.type !== 8) continue; // CUniMedia: 7 video, 8 audio.
      const nv = shape.getCNvProps();
      const matrix = shape.getTransformMatrix();
      let points = [
        [0, 0],
        [shape.extX, 0],
        [shape.extX, shape.extY],
        [0, shape.extY],
      ].map(([x, y]) => ({ x: matrix.TransformPointX(x, y), y: matrix.TransformPointY(x, y) }));
      let visible = !nv.isHidden;
      for (const drawing of [shape, ...ancestors]) {
        const animation = player?.getDrawingParams(drawing.Id);
        visible =
          visible &&
          !player?.isDrawingHidden(drawing.Id) &&
          animation?.isVisible !== false &&
          !(typeof animation?.opacity === 'number' && animation.opacity >= 1);
        if (animation?.transform) {
          // CAnimSandwich transforms the cached drawing texture, whose origin is
          // getBoundsByDrawing(), rather than the original shape-local origin.
          const original = drawing.getBoundsByDrawing();
          points = points.map((point) => ({
            x: animation.transform.TransformPointX(point.x - original.x, point.y - original.y),
            y: animation.transform.TransformPointY(point.x - original.x, point.y - original.y),
          }));
        }
      }
      const bounds = (points) => ({
        x: Math.min(...points.map((p) => p.x)),
        y: Math.min(...points.map((p) => p.y)),
        width: Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x)),
        height: Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y)),
      });
      const screenPolygon = points.map((p) => ({
        x: (rect.x + (p.x / doc.GetWidthMM()) * rect.w) * scaleX,
        y: (rect.y + (p.y / doc.GetHeightMM()) * rect.h) * scaleY,
      }));
      result.push({
        slideIndex: dm.SlideNum,
        shapeId: originalShapeIds.get(nv) || String(nv.id),
        name: nv.name || '音频',
        mediaPath: `media/${shape.getMediaFileName()}`,
        bounds: bounds(points),
        screenBounds: bounds(screenPolygon),
        screenPolygon,
        visible,
        trimStartMs: Number.isFinite(media.start) ? media.start : shape.getMediaStartTime(),
        trimEndMs: Number.isFinite(media.end) ? media.end : shape.getMediaEndTime(),
      });
    }
  }
  visit(slide.cSld.spTree);
  return result;
}
function publishState() {
  const dm = api.WordControl.DemonstrationManager;
  const state = {
    slideIndex: Math.max(0, dm.SlideNum),
    slideCount: api.getCountPages(),
    media: mediaObjects(),
    stepIndex,
    busy: animationBusy(),
    thumbnails,
    warnings: [...warnings],
  };
  const json = JSON.stringify({ ...state, thumbnails: Object.keys(thumbnails) });
  if (json !== lastGeometry) {
    lastGeometry = json;
    notify('state', { state });
  }
}
function tick() {
  if (loaded) publishState();
  frameId = requestAnimationFrame(tick);
}
const ready = new Promise((resolve, reject) => {
  api = new Asc.asc_docs_api({ 'id-view': 'editor_sdk', embedded: false });
  api.asc_registerCallback('asc_onError', (code, level) =>
    fail(new Error(`ONLYOFFICE error ${code} (${level})`)),
  );
  api.asc_registerCallback('asc_onDocumentContentReady', () => {
    loaded = true;
    const fonts = api.WordControl.m_oLogicDocument.Fonts || [];
    const missing = fonts
      .filter((font) => AscFonts.g_map_font_index[font.name] === undefined)
      .map((font) => font.name);
    if (missing.length)
      warnings.add(`字体替代：${[...new Set(missing)].join('、')}。请核对实际排版。`);
    publishState();
    notify('loaded');
  });
  api.asc_registerCallback('asc_onDemonstrationSlideChanged', () => {
    if (loaded) publishState();
  });
  // Do not create the ONLYOFFICE desktop bridge. All native media commands go to the host.
  // CSP also denies HTML media playback in this frame; the future controller owns audio.
  api.callMediaPlayerCommand = (_command, mediaData) => {
    api.mediaData = mediaData;
  };
  const timer = setInterval(() => {
    if (api.isLoadFullApi && AscFonts.isEngineReady) {
      clearInterval(timer);
      clearTimeout(timeout);
      resolve();
    }
  }, 20);
  const timeout = setTimeout(() => {
    clearInterval(timer);
    reject(new Error('ONLYOFFICE 初始化超时'));
  }, 30000);
});
ready
  .then(() => {
    frameId = requestAnimationFrame(tick);
    notify('ready');
  })
  .catch(fail);
window.addEventListener('message', async (event) => {
  if (
    event.source !== parent ||
    event.origin !== location.origin ||
    event.data?.source !== 'listening-slide-host'
  )
    return;
  try {
    const { type, data } = event.data;
    if (type === 'load') {
      const mapping = {};
      for (const resource of data.media) {
        const blob = URL.createObjectURL(new Blob([resource.data]));
        urls.push(blob);
        mapping[resource.name] = blob;
      }
      AscCommon.g_oDocumentUrls.init(mapping);
      // Offline loader state: no coauthoring/auth handshake, no saved changes to apply.
      api.DocInfo = new Asc.asc_CDocInfo();
      api.DocInfo.put_OfflineApp(false); // Preserve blob mappings (offline=true rebuilds URL paths).
      api.ServerIdWaitComplete = true;
      api.isApplyChangesOnOpenEnabled = false;
      api.disableAutostartMacros = true;
      api.asc_setViewMode(true);
      api.OpenDocumentFromBin('', new Uint8Array(data.binary));
    } else if (type === 'start') {
      if (!loaded || !api.getCountPages()) throw new Error('课件没有可放映的幻灯片');
      api.StartDemonstration('slideshow', 0);
      api.WordControl.DemonstrationManager.IsPlayMode = false;
      requestAnimationFrame(() => {
        publishState();
        notify('started');
      });
    } else if (type === 'step') nextStep();
    else if (type === 'finish-step') {
      // A repeated wheel event may finish this page's active group only.
      // Never consume the next click or finish an animation on a new page.
      if (api.WordControl.DemonstrationManager.SlideNum === data) {
        currentPlayer()?.onFrame();
        if (animationBusy()) finishStep();
        publishState();
      }
    } else if (type === 'previous-step') previousStep();
    else if (type === 'goto') resetSlide(data);
    else if (type === 'thumbnails') void makeThumbnails().catch(fail);
  } catch (error) {
    fail(error);
  }
});
window.addEventListener('resize', () => {
  api?.Resize();
  if (loaded) publishState();
});
window.addEventListener('beforeunload', () => {
  cancelAnimationFrame(frameId);
  urls.forEach((url) => URL.revokeObjectURL(url));
});
