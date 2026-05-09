import React from 'react';

const MODELS = [
  {
    group: 'Anthropic',
    options: [
      { value: 'anthropic/claude-haiku-4-5', label: 'Claude Haiku 4.5' },
      { value: 'anthropic/claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
      { value: 'anthropic/claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { value: 'anthropic/claude-opus-4-6', label: 'Claude Opus 4.6' },
    ],
  },
  {
    group: 'OpenAI',
    options: [
      { value: 'openai/gpt-4o', label: 'GPT-4o' },
      { value: 'openai/gpt-4o-mini', label: 'GPT-4o mini' },
    ],
  },
  {
    group: 'Ollama',
    options: [
      { value: 'ollama/llama3', label: 'Llama 3' },
      { value: 'ollama/mistral', label: 'Mistral' },
    ],
  },
];

function ModelSelect({ value, onChange, id }) {
  return (
    <select
      id={id}
      className="form-input form-select"
      value={value}
      onChange={onChange}
    >
      <option value="" disabled>Select a model...</option>
      {MODELS.map((group) => (
        <optgroup key={group.group} label={group.group}>
          {group.options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export default ModelSelect;
