import { NOTE_STYLES } from '../../services/aiNote';

interface StyleSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function StyleSelector({ value, onChange }: StyleSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-300">笔记风格</label>
      <div className="grid grid-cols-2 gap-2">
        {NOTE_STYLES.map((style) => (
          <button
            key={style.value}
            type="button"
            onClick={() => onChange(style.value)}
            className={`p-2 rounded-lg text-sm transition-colors ${
              value === style.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {style.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-1">
        {NOTE_STYLES.find((s) => s.value === value)?.description}
      </p>
    </div>
  );
}