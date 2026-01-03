// AI 配置管理

export interface AIConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
}

// 内置免费API配置
export const DEFAULT_AI_CONFIG: AIConfig = {
  apiUrl: 'https://free.v36.cm',
  apiKey: 'sk-ObREHL2ZnRu3HKhfD696032294Cd4384B2738d03FfFf46B6',
  model: 'gpt-4o-mini'
};

// 推荐的第三方API提供商
export const AI_PROVIDERS = [
  {
    name: 'DeepSeek',
    url: 'https://platform.deepseek.com/',
    description: '国产大模型，性价比高'
  },
  {
    name: 'SiliconFlow',
    url: 'https://siliconflow.cn/',
    description: '硅基流动，多模型聚合'
  }
];

const AI_CONFIG_KEY = 'takeoff_ai_config';

// 加载AI配置
export function loadAIConfig(): AIConfig {
  if (typeof window === 'undefined') return DEFAULT_AI_CONFIG;
  try {
    const saved = localStorage.getItem(AI_CONFIG_KEY);
    if (saved) {
      const config = JSON.parse(saved);
      // 确保所有字段都存在
      return {
        apiUrl: config.apiUrl || DEFAULT_AI_CONFIG.apiUrl,
        apiKey: config.apiKey || DEFAULT_AI_CONFIG.apiKey,
        model: config.model || DEFAULT_AI_CONFIG.model
      };
    }
  } catch {
    // 忽略解析错误
  }
  return DEFAULT_AI_CONFIG;
}

// 保存AI配置
export function saveAIConfig(config: AIConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('保存AI配置失败', e);
  }
}

// 重置为默认配置
export function resetAIConfig(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AI_CONFIG_KEY);
}

// 检查是否使用自定义配置
export function isCustomConfig(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(AI_CONFIG_KEY) !== null;
}

// 调用AI API
export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  config?: AIConfig
): Promise<string> {
  const cfg = config || loadAIConfig();

  const response = await fetch(`${cfg.apiUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI请求失败: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '生成报告失败';
}
