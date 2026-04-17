import { NOTE_FORMATS } from '../../services/aiNote';

interface FormatSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export function FormatSelector({ value, onChange }: FormatSelectorProps) {
  const handleToggle = (formatValue: string) => {
    if (value.includes(formatValue)) {
      onChange(value.filter((v) => v !== formatValue));
    } else {
      onChange([...value, formatValue]);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-300">输出格式</label>
      <div className="flex flex-wrap gap-2">
        {NOTE_FORMATS.map((format) => (
          <button
            key={format.value}
            type="button"
            onClick={() => handleToggle(format.value)}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              value.includes(format.value)
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {format.label}
          </button>
        ))}
      </div>
    </div>
  );
}