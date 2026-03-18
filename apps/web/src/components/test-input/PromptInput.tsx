import { useState, useRef, useEffect } from 'react';
import { Send, ChevronDown, ChevronRight, Plus, X, Eye, EyeOff } from 'lucide-react';

interface ExtraField {
  id: number;
  label: string;
  value: string;
  secret: boolean;
}

interface Props {
  onSubmit: (prompt: string) => void;
  disabled?: boolean;
}

let fieldIdCounter = 0;

const presetFields = [
  { label: '아이디', secret: false },
  { label: '비밀번호', secret: true },
  { label: 'URL', secret: false },
  { label: 'OTP', secret: true },
];

export function PromptInput({ onSubmit, disabled }: Props) {
  const [value, setValue] = useState('');
  const [showExtra, setShowExtra] = useState(false);
  const [fields, setFields] = useState<ExtraField[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const addField = (label: string, secret: boolean) => {
    setFields((prev) => [...prev, { id: ++fieldIdCounter, label, value: '', secret }]);
    if (!showExtra) setShowExtra(true);
  };

  const addCustomField = () => {
    addField('', false);
  };

  const updateField = (id: number, update: Partial<ExtraField>) => {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...update } : f))
    );
  };

  const removeField = (id: number) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const buildPrompt = (): string => {
    let prompt = value.trim();
    const filledFields = fields.filter((f) => f.label.trim() && f.value.trim());
    if (filledFields.length > 0) {
      prompt += '\n\n추가 정보:';
      for (const f of filledFields) {
        prompt += `\n- ${f.label.trim()}: ${f.value.trim()}`;
      }
    }
    return prompt;
  };

  const handleSubmit = () => {
    const prompt = buildPrompt();
    if (!prompt || disabled) return;
    onSubmit(prompt);
    setValue('');
    setFields([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasPreset = (label: string) => fields.some((f) => f.label === label);

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-300">테스트 설명</label>
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='예: "https://example.com에 접속해서 로그인해줘"'
          rows={4}
          className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 resize-none focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50"
          disabled={disabled}
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="absolute right-3 bottom-3 p-2 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:hover:bg-primary-600 transition-colors"
        >
          <Send size={16} />
        </button>
      </div>

      {/* 추가 정보 토글 */}
      <div>
        <button
          onClick={() => setShowExtra(!showExtra)}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          {showExtra ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          추가 정보 (선택)
          {fields.filter((f) => f.value.trim()).length > 0 && (
            <span className="text-[10px] bg-primary-600/30 text-primary-400 px-1.5 py-0.5 rounded-full">
              {fields.filter((f) => f.value.trim()).length}
            </span>
          )}
        </button>

        {showExtra && (
          <div className="mt-3 space-y-3 p-4 rounded-lg border border-gray-800 bg-gray-900/50">
            {/* 프리셋 버튼 */}
            <div className="flex flex-wrap gap-2">
              {presetFields.map((pf) => (
                <button
                  key={pf.label}
                  onClick={() => addField(pf.label, pf.secret)}
                  disabled={hasPreset(pf.label)}
                  className="text-xs px-2.5 py-1 rounded-full border border-gray-700 text-gray-400 hover:border-primary-600/50 hover:text-primary-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  + {pf.label}
                </button>
              ))}
              <button
                onClick={addCustomField}
                className="text-xs px-2.5 py-1 rounded-full border border-dashed border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300 transition-colors"
              >
                <Plus size={10} className="inline mr-1" />
                직접 입력
              </button>
            </div>

            {/* 필드 목록 */}
            {fields.length > 0 && (
              <div className="space-y-2">
                {fields.map((field) => (
                  <FieldRow
                    key={field.id}
                    field={field}
                    onChange={(update) => updateField(field.id, update)}
                    onRemove={() => removeField(field.id)}
                  />
                ))}
              </div>
            )}

            {fields.length === 0 && (
              <p className="text-xs text-gray-600 text-center py-2">
                위 버튼을 눌러 로그인 정보 등을 추가하세요
              </p>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Enter로 제출, Shift+Enter로 줄바꿈
      </p>
    </div>
  );
}

function FieldRow({
  field,
  onChange,
  onRemove,
}: {
  field: ExtraField;
  onChange: (update: Partial<ExtraField>) => void;
  onRemove: () => void;
}) {
  const [showValue, setShowValue] = useState(!field.secret);

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={field.label}
        onChange={(e) => onChange({ label: e.target.value })}
        placeholder="항목 이름"
        className="w-28 px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-primary-500"
      />
      <div className="flex-1 relative">
        <input
          type={showValue ? 'text' : 'password'}
          value={field.value}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder="값 입력"
          className="w-full px-2.5 py-1.5 pr-8 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-primary-500"
        />
        <button
          onClick={() => setShowValue(!showValue)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          type="button"
        >
          {showValue ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>
      <button
        onClick={onRemove}
        className="p-1 text-gray-600 hover:text-red-400 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}
