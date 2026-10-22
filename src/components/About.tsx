import { useRef } from 'react';
import { Info, X } from 'lucide-react';
import { authorInfo } from '../author';
import onlyOfficeLicense from '../../LICENSE?raw';

export function About() {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        className="about-button liquid-glass-chip"
        aria-label="作者信息"
        title="作者信息"
        onClick={() => dialog.current?.showModal()}
      >
        <Info size={19} />
      </button>
      <dialog
        ref={dialog}
        className="about-dialog liquid-glass liquid-glass--modal"
        aria-labelledby="about-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="about-content">
          <header>
            <h2 id="about-title">作者信息</h2>
            <button aria-label="关闭作者信息" onClick={() => dialog.current?.close()}>
              <X size={18} />
            </button>
          </header>
          <p className="author-copy">{authorInfo}</p>
          <section className="onlyoffice-notice" aria-label="ONLYOFFICE 版权说明">
            <p>本软件使用 ONLYOFFICE DesktopEditors 10.0.0 的幻灯片渲染与动画引擎。</p>
            <p>© 2009–2026 Ascensio System SIA。依据 GNU AGPL v3 及原许可证附加条款使用。</p>
            <details>
              <summary>完整许可</summary>
              <pre>{onlyOfficeLicense}</pre>
            </details>
          </section>
        </div>
      </dialog>
    </>
  );
}
