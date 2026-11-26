import React, { useState, useEffect } from 'react';
import {
  Server,
  Lock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { AISettings, AIProvider } from 'admitpilot-shared';
import { api } from '../api';
import { VerificationStamp } from './ui/Primitives';

interface AISettingsProps {
  settings: AISettings;
  onSave: (settings: Partial<AISettings>) => Promise<void>;
}

const MODEL_PRESETS: Record<AIProvider, Array<{ id: string; label: string; note: string }>> = {
  gemini: [
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', note: 'Default · Fast structured JSON & vision' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', note: 'Extended reasoning' },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', note: 'High throughput' },
  ],
  openrouter: [
    { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini', note: 'openai/gpt-4o-mini · Fast & vision' },
    { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', note: 'google/gemini-2.5-flash · Vision & JSON' },
    { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3', note: 'deepseek/deepseek-chat · Low cost' },
    { id: 'anthropic/claude-3.5-haiku', label: 'Claude 3.5 Haiku', note: 'anthropic/claude-3.5-haiku' },
    { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (Free)', note: 'OpenRouter free tier' },
  ],
  deepseek: [
    { id: 'deepseek-chat', label: 'DeepSeek-V3', note: 'deepseek-chat · Structured JSON' },
    { id: 'deepseek-reasoner', label: 'DeepSeek-R1', note: 'deepseek-reasoner · Chain of thought' },
  ],
  ollama: [
    { id: 'llama3', label: 'Llama 3', note: 'Local general model' },
    { id: 'qwen2.5', label: 'Qwen 2.5', note: 'Local structured output' },
    { id: 'mistral', label: 'Mistral', note: 'Compact local model' },
  ],
  openai_compatible: [
    { id: 'gpt-4o-mini', label: 'gpt-4o-mini', note: 'Direct OpenAI low latency' },
    { id: 'gpt-4o', label: 'gpt-4o', note: 'Direct OpenAI full capability' },
  ],
};

export const AISettingsView: React.FC<AISettingsProps> = ({ settings, onSave }) => {
  const [provider, setProvider] = useState<AIProvider>(settings.provider || 'gemini');
  const [model, setModel] = useState<string>(settings.model || 'gemini-2.5-flash');
  const [apiKey, setApiKey] = useState<string>('');
  const [endpoint, setEndpoint] = useState<string>(settings.endpoint || '');
  const [privacyMode, setPrivacyMode] = useState<boolean>(settings.privacyMode || false);
  const [temperature, setTemperature] = useState<number>(settings.temperature ?? 0.1);

  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setProvider(settings.provider);
    setModel(settings.model);
    setEndpoint(settings.endpoint || '');
    setPrivacyMode(settings.privacyMode);
    setTemperature(settings.temperature ?? 0.1);
  }, [settings]);

  const handleProviderChange = (p: AIProvider) => {
    setProvider(p);
    setTestResult(null);
    setApiKey('');
    if (p === 'gemini') {
      setModel('gemini-2.5-flash');
      setEndpoint('');
    } else if (p === 'openrouter') {
      setModel('openai/gpt-4o-mini');
      setEndpoint('https://openrouter.ai/api/v1');
    } else if (p === 'deepseek') {
      setModel('deepseek-chat');
      setEndpoint('https://api.deepseek.com/v1');
    } else if (p === 'ollama') {
      setModel('llama3');
      setEndpoint('http://localhost:11434');
    } else if (p === 'openai_compatible') {
      setModel('gpt-4o-mini');
      setEndpoint('https://api.openai.com/v1');
    }
  };

  const handleApiKeyChange = (val: string) => {
    setApiKey(val);
    // Automatically switch OpenRouter keys (sk-or-v1-...) to OpenRouter endpoint & vendor-prefixed model
    if (val.trim().startsWith('sk-or-') && provider === 'openai_compatible') {
      setProvider('openrouter');
      setEndpoint('https://openrouter.ai/api/v1');
      if (!model.includes('/')) {
        setModel('openai/gpt-4o-mini');
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTestResult(null);
    try {
      await onSave({
        provider,
        model: model.trim(),
        apiKey: apiKey.trim() || undefined,
        endpoint: endpoint.trim(),
        privacyMode,
        temperature: Number(temperature),
      });
      setApiKey('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3500);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testAIConnection({
        provider,
        model: model.trim(),
        apiKey: apiKey.trim() || undefined,
        endpoint: endpoint.trim(),
        temperature: Number(temperature),
      });
      setTestResult({
        ok: Boolean(res.ok),
        message: res.message || (res.ok ? 'Provider responded' : 'Connection failed'),
      });
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: `Connection error: ${err.message}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const isCurrentSavedProvider = provider === settings.provider;
  const hasSavedKeyForSelected = isCurrentSavedProvider && Boolean(settings.hasConfiguredKey || settings.apiKey);

  const keyStatusMeta =
    settings.keySource === 'env'
      ? 'from .env'
      : settings.keySource === 'dashboard'
      ? 'key saved'
      : settings.provider === 'ollama'
      ? 'local server'
      : 'key required';

  const envVarName =
    provider === 'gemini'
      ? 'GEMINI_API_KEY'
      : provider === 'openrouter'
      ? 'OPENROUTER_API_KEY'
      : provider === 'deepseek'
      ? 'DEEPSEEK_API_KEY'
      : 'OPENAI_API_KEY';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-[1.15] font-medium text-ink-primary tracking-[-0.015em]">
            Model providers
          </h1>
          <p className="text-sm text-ink-secondary mt-1.5">
            Configure Google Gemini, OpenRouter, DeepSeek, local Ollama, or custom OpenAI-compatible gateways
          </p>
        </div>

        <div className="shrink-0">
          <VerificationStamp
            tone={settings.hasConfiguredKey || settings.provider === 'ollama' ? 'positive' : 'brass'}
            label={`${settings.provider} · ${settings.model}`}
            meta={keyStatusMeta}
          />
        </div>
      </div>

      {/* 5 Provider Selection Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {[
          {
            id: 'gemini' as AIProvider,
            name: 'Google Gemini',
            meta: 'Direct API',
            desc: 'Gemini 2.5 Flash & Pro with native vision and JSON',
          },
          {
            id: 'openrouter' as AIProvider,
            name: 'OpenRouter',
            meta: 'sk-or-v1 keys',
            desc: 'Unified router for GPT-4o, Gemini, Claude, DeepSeek & free models',
          },
          {
            id: 'deepseek' as AIProvider,
            name: 'DeepSeek API',
            meta: 'V3 & R1',
            desc: 'Direct DeepSeek-V3 chat and DeepSeek-R1 reasoning',
          },
          {
            id: 'ollama' as AIProvider,
            name: 'Ollama local',
            meta: 'On-device',
            desc: 'Self-hosted workstation inference with zero external traffic',
          },
          {
            id: 'openai_compatible' as AIProvider,
            name: 'OpenAI / Custom',
            meta: 'Custom URL',
            desc: 'Direct OpenAI platform, Groq, vLLM, or internal proxies',
          },
        ].map((p) => {
          const selected = provider === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handleProviderChange(p.id)}
              className={`p-4 rounded-xl border text-left transition-colors duration-150 ease-quart flex flex-col justify-between ${
                selected
                  ? 'bg-surface-raised border-brass shadow-[inset_0_1px_0_rgba(212,168,83,0.16)]'
                  : 'bg-surface-card border-hairline hover:border-hairline-strong'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-mono text-xs text-ink-muted">{p.meta}</span>
                {selected && <span className="w-2 h-2 rounded-full bg-brass" />}
              </div>
              <div className="mt-3.5">
                <h3 className="text-sm font-medium text-ink-primary">{p.name}</h3>
                <p className="text-xs text-ink-secondary mt-1 leading-relaxed">{p.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Configuration Form */}
      <form
        onSubmit={handleSave}
        className="p-6 rounded-xl bg-surface-card border border-hairline space-y-6 text-sm"
      >
        {/* Preset Model Selector */}
        <div>
          <label className="block text-xs text-ink-secondary mb-2">Preset models</label>
          <div className="flex flex-wrap gap-2.5">
            {(MODEL_PRESETS[provider] || MODEL_PRESETS.gemini).map((preset) => {
              const active = model === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setModel(preset.id)}
                  className={`px-3.5 py-2 rounded-lg border text-left transition-colors duration-150 ease-quart ${
                    active
                      ? 'bg-surface-raised border-brass text-ink-primary'
                      : 'bg-surface-deep border-hairline text-ink-secondary hover:text-ink-primary hover:border-hairline-strong'
                  }`}
                >
                  <span className="block text-sm font-medium">{preset.label}</span>
                  <span className="block text-xs text-ink-muted mt-0.5">{preset.note}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs text-ink-secondary mb-1.5">Model identifier *</label>
            <input
              required
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gemini-2.5-flash'}
              className="field-input font-mono"
            />
            <p className="text-xs text-ink-muted mt-1.5">
              Choose a preset above or enter any model ID supported by {provider}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-ink-secondary">
                {provider === 'ollama' ? 'Ollama server URL' : 'API key'}
              </label>

              {provider === 'gemini' && (
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-brass hover:underline inline-flex items-center gap-1"
                >
                  <span>Google AI Studio</span>
                  <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
                </a>
              )}
              {provider === 'openrouter' && (
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-brass hover:underline inline-flex items-center gap-1"
                >
                  <span>OpenRouter keys</span>
                  <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
                </a>
              )}
              {provider === 'deepseek' && (
                <a
                  href="https://platform.deepseek.com/api_keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-brass hover:underline inline-flex items-center gap-1"
                >
                  <span>DeepSeek console</span>
                  <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
                </a>
              )}
            </div>

            {provider === 'ollama' ? (
              <input
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="http://localhost:11434"
                className="field-input font-mono"
              />
            ) : (
              <input
                type="password"
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder={
                  hasSavedKeyForSelected
                    ? `Key active (${settings.keySource === 'env' ? 'from .env' : 'saved in Supabase'}) — enter new key to replace`
                    : `Paste ${
                        provider === 'gemini'
                          ? 'AIza...'
                          : provider === 'openrouter'
                          ? 'sk-or-v1-...'
                          : 'sk-...'
                      } key`
                }
                className="field-input font-mono"
              />
            )}
            {provider !== 'ollama' && (
              <p className="text-xs text-ink-muted mt-1.5">
                Encrypted in Supabase PostgreSQL or read from{' '}
                <code className="font-mono text-ink-secondary">{envVarName}</code> in{' '}
                <code className="font-mono text-ink-secondary">admitpilot/.env</code>
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {provider !== 'gemini' && provider !== 'ollama' && (
            <div>
              <label className="block text-xs text-ink-secondary mb-1.5">Endpoint base URL</label>
              <input
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder={
                  provider === 'openrouter'
                    ? 'https://openrouter.ai/api/v1'
                    : provider === 'deepseek'
                    ? 'https://api.deepseek.com/v1'
                    : 'https://api.openai.com/v1'
                }
                className="field-input font-mono"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-ink-secondary">Sampling temperature</label>
              <span className="font-mono text-xs tabular-nums text-ink-primary">
                {temperature.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-[#d4a853] cursor-pointer"
            />
            <p className="text-xs text-ink-muted mt-1">
              0.00 to 0.20 keeps field extraction and mapping deterministic
            </p>
          </div>
        </div>

        {/* Strict Local Privacy Toggle */}
        <div className="p-4 rounded-xl bg-surface-deep border border-hairline flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Lock className="w-4 h-4 text-ink-muted shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <p className="text-sm font-medium text-ink-primary">Strict local privacy mode</p>
              <p className="text-xs text-ink-secondary mt-0.5">
                Blocks external cloud requests so only local OCR, MRZ/regex rules, and local Ollama run
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={privacyMode}
            onClick={() => setPrivacyMode(!privacyMode)}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors duration-150 ease-quart ${
              privacyMode
                ? 'bg-brass border-brass'
                : 'bg-surface-raised border-hairline-strong'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full mt-0.5 transition-transform duration-150 ease-quart ${
                privacyMode
                  ? 'translate-x-5 bg-[#141415]'
                  : 'translate-x-1 bg-ink-secondary'
              }`}
            />
          </button>
        </div>

        {/* Action Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-hairline">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="btn-secondary"
          >
            {testing ? (
              <RefreshCw className="w-4 h-4 text-ink-muted animate-spin" strokeWidth={1.5} />
            ) : (
              <Server className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
            )}
            <span>{testing ? 'Testing connection...' : 'Test live connection'}</span>
          </button>

          <div className="flex items-center gap-3">
            {saved && <VerificationStamp tone="positive" label="Configuration saved" />}
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Save configuration'}
            </button>
          </div>
        </div>

        {testResult && (
          <div
            className={`p-3.5 rounded-lg bg-surface-deep border text-xs flex items-center gap-2.5 ${
              testResult.ok
                ? 'border-tone-positive/40 text-tone-positive'
                : 'border-tone-negative/40 text-tone-negative'
            }`}
          >
            {testResult.ok ? (
              <CheckCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            )}
            <span className="text-ink-primary">{testResult.message}</span>
          </div>
        )}
      </form>
    </div>
  );
};
