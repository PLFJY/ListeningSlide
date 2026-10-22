import { Check, Eraser, Highlighter, MousePointer2, PenLine, Trash2 } from 'lucide-react';
import type { AnnotationSettings } from '../slideshow/types';

const colors = [
  ['#FF3B30', '红色'],
  ['#FF9500', '橙色'],
  ['#FFCC00', '黄色'],
  ['#007AFF', '蓝色'],
  ['#1C1C1E', '黑色'],
  ['#FFFFFF', '白色'],
] as const;

export function AnnotationTools({
  value,
  onChange,
  onClear,
  onClose,
}: {
  value: AnnotationSettings;
  onChange: (value: AnnotationSettings) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <aside
      data-overlay
      id="annotation-tools"
      className="annotation-tools liquid-glass-menu"
      role="toolbar"
      aria-label="批注工具"
    >
      <header>
        <div>
          <strong>随手批注</strong>
          <span>仅保留在本次放映中</span>
        </div>
        <button aria-label="收起批注工具" onClick={onClose}>
          <Check size={20} />
        </button>
      </header>
      <div className="annotation-modes">
        {(
          [
            ['none', MousePointer2, '浏览'],
            ['pen', PenLine, '画笔'],
            ['highlighter', Highlighter, '荧光笔'],
            ['eraser', Eraser, '橡皮擦'],
          ] as const
        ).map(([tool, Icon, label]) => (
          <button
            key={tool}
            aria-label={label}
            aria-pressed={value.tool === tool}
            onClick={() => onChange({ ...value, tool, width: tool === 'highlighter' ? 6 : 2 })}
          >
            <Icon size={22} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="annotation-colors" aria-label="墨迹颜色">
        {colors.map(([color, label]) => (
          <button
            key={color}
            aria-label={label}
            aria-pressed={value.color === color}
            disabled={value.tool === 'eraser' || value.tool === 'none'}
            onClick={() => onChange({ ...value, color })}
          >
            <span style={{ background: color }}>
              {value.color === color && (
                <Check
                  size={16}
                  style={{
                    color: color === '#1C1C1E' || color === '#007AFF' ? '#FFFFFF' : '#1C1C1E',
                  }}
                />
              )}
            </span>
          </button>
        ))}
      </div>
      <div className="annotation-width">
        <span>笔画粗细</span>
        {(value.tool === 'highlighter' ? [6, 9, 12] : [1, 2, 4]).map((width, i) => (
          <button
            key={width}
            aria-label={['细', '中', '粗'][i]}
            aria-pressed={value.width === width}
            disabled={value.tool === 'eraser' || value.tool === 'none'}
            onClick={() => onChange({ ...value, width })}
          >
            <span style={{ height: i * 2 + 2 }} />
          </button>
        ))}
      </div>
      <button className="clear-annotations" onClick={onClear}>
        <Trash2 size={18} />
        清空本页批注
      </button>
    </aside>
  );
}
