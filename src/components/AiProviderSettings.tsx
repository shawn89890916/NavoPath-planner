import { useState } from "react";
import type { Language, Settings } from "../types";
import { AI_PROVIDER_MODELS, aiProviderPreset, readLocalAiProviderConfig, writeLocalAiProviderConfig, clearLocalAiProviderConfig, type LocalAiProviderConfig } from "../aiProviderConfig";

export default function AiProviderSettings({ lang, onSave }: { lang: Language; onSave: (patch: Partial<Settings>) => void }) {
  const [config, setConfig] = useState<LocalAiProviderConfig>(() => readLocalAiProviderConfig());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(readLocalAiProviderConfig(), null, 2));
  const save = (patch: Partial<LocalAiProviderConfig>) => {
    const next = writeLocalAiProviderConfig(patch);
    setConfig(next);
    setJsonText(JSON.stringify(next, null, 2));
    onSave({ model: next.model, baseUrl: next.baseUrl });
  };
  const modelOptions = AI_PROVIDER_MODELS[config.provider];
  const providerLabels: Record<LocalAiProviderConfig["provider"], string> = {
    deepseek: lang === "zh" ? "DeepSeek 官方" : "DeepSeek official",
    siliconflow: "SiliconFlow",
    openai: "OpenAI",
    anthropic: "Anthropic",
    zhipu: "GLM",
    qwen: lang === "zh" ? "通义千问" : "Qwen",
    "openai-compatible": lang === "zh" ? "其他 OpenAI 兼容服务" : "Other OpenAI-compatible",
  };
  return <div className="df-ai-provider-settings">
    <div className="df-ai-provider-grid">
      <label><span>{lang === "zh" ? "提供商" : "Provider"}</span><select value={config.provider} onChange={(event) => save(aiProviderPreset(event.target.value as LocalAiProviderConfig["provider"]))}>{Object.entries(providerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label><span>{lang === "zh" ? "API Key" : "API key"}</span><input type="password" value={config.apiKey} placeholder="sk-..." autoComplete="off" onChange={(event) => save({ apiKey: event.target.value })} /></label>
      <label><span>{lang === "zh" ? "API 地址" : "Base URL"}</span><input value={config.baseUrl} placeholder="https://provider.example/v1" inputMode="url" onChange={(event) => save({ baseUrl: event.target.value })} /></label>
      <label><span>{lang === "zh" ? "模型列表" : "Model list"}</span><select value={modelOptions.some((option) => option.id === config.model) ? config.model : "__custom__"} onChange={(event) => { if (event.target.value !== "__custom__") save({ model: event.target.value }); }}><option value="__custom__">{lang === "zh" ? "自定义模型 ID" : "Custom model ID"}</option>{modelOptions.map((option) => <option key={option.id} value={option.id}>{lang === "zh" ? option.zh : option.en}</option>)}</select></label>
      <label><span>{lang === "zh" ? "模型 ID" : "Model ID"}</span><input value={config.model} placeholder={lang === "zh" ? "输入供应商模型 ID" : "Enter the provider model ID"} onChange={(event) => save({ model: event.target.value })} /></label>
    </div>
    <small>{config.apiKey ? (lang === "zh" ? "Key 仅保存在本机浏览器/桌面应用中。" : "The key is stored only on this device.") : (lang === "zh" ? "请填写 API Key。" : "Enter an API key.")}</small>
    <button type="button" className="df-settings-disclosure" onClick={() => setAdvancedOpen((open) => !open)}>{advancedOpen ? "−" : "+"} {lang === "zh" ? "高级配置" : "Advanced configuration"}</button>
    {advancedOpen && <div className="df-ai-provider-advanced"><label><span>JSON</span><textarea value={jsonText} spellCheck={false} onChange={(event) => setJsonText(event.target.value)} onBlur={() => { try { save(JSON.parse(jsonText) as Partial<LocalAiProviderConfig>); } catch { /* Keep the draft visible until valid JSON is entered. */ } }} /></label><button type="button" onClick={() => { clearLocalAiProviderConfig(); const next = readLocalAiProviderConfig(); setConfig(next); setJsonText(JSON.stringify(next, null, 2)); onSave({ model: next.model, baseUrl: next.baseUrl }); }}>{lang === "zh" ? "清除本机 Key" : "Clear local key"}</button></div>}
  </div>;
}
