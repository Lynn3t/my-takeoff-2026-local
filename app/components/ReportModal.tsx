'use client';
import { useState, useEffect, useMemo } from 'react';
import { TAKEOFF_REPORT_SYSTEM_PROMPT, generateUserDataPrompt } from '@/app/lib/ai-prompts';
import {
  loadAIConfig,
  saveAIConfig,
  resetAIConfig,
  callAI,
  DEFAULT_AI_CONFIG,
  AI_PROVIDERS,
  type AIConfig
} from '@/app/lib/ai-config';

interface ReportModalProps {
  onClose: () => void;
  dataMap: Record<string, number>;
}

type PeriodType = 'week' | 'month' | 'year';

// 简易Markdown渲染
function renderMarkdown(text: string): string {
  return text
    // 标题
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-4 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
    // 粗体
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // 斜体
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // 列表
    .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4">$1. $2</li>')
    // 换行
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

export default function ReportModal({ onClose, dataMap }: ReportModalProps) {
  const [periodType, setPeriodType] = useState<PeriodType>('week');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [aiConfig, setAiConfig] = useState<AIConfig>(DEFAULT_AI_CONFIG);

  useEffect(() => {
    setAiConfig(loadAIConfig());
  }, []);

  // 获取今天日期
  const getTodayString = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - offset);
    return local.toISOString().split('T')[0];
  };

  // 计算统计数据
  const calculateStats = useMemo(() => {
    const today = getTodayString();
    const [year, month, day] = today.split('-').map(Number);

    let startDate: Date;
    let endDate = new Date(year, month - 1, day);
    let periodLabel = '';

    if (periodType === 'week') {
      // 本周（周一到今天）
      const dayOfWeek = endDate.getDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate = new Date(year, month - 1, day - mondayOffset);
      const weekNum = Math.ceil((day + new Date(year, month - 1, 1).getDay()) / 7);
      periodLabel = `${year}年${month}月第${weekNum}周`;
    } else if (periodType === 'month') {
      // 本月
      startDate = new Date(year, month - 1, 1);
      periodLabel = `${year}年${month}月`;
    } else {
      // 本年
      startDate = new Date(2026, 0, 1);
      periodLabel = '2026年';
    }

    // 收集日期范围内的数据
    const stats = {
      totalDays: 0,
      recordedDays: 0,
      totalCount: 0,
      successDays: 0,
      zeroDays: 0,
      avgPerDay: 0,
      maxCount: 0,
      maxCountDate: '',
      streakDays: 0,
      dayOfWeekStats: {} as Record<string, { count: number; days: number }>
    };

    // 初始化星期统计
    for (let i = 0; i < 7; i++) {
      stats.dayOfWeekStats[i.toString()] = { count: 0, days: 0 };
    }

    let currentStreak = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const dayOfWeek = currentDate.getDay();

      stats.totalDays++;

      const value = dataMap[dateKey];

      if (value !== undefined && value !== null) {
        stats.recordedDays++;
        stats.dayOfWeekStats[dayOfWeek.toString()].days++;

        if (value > 0) {
          stats.successDays++;
          stats.totalCount += value;
          stats.dayOfWeekStats[dayOfWeek.toString()].count += value;
          currentStreak++;

          if (value > stats.maxCount) {
            stats.maxCount = value;
            stats.maxCountDate = dateKey;
          }
        } else {
          stats.zeroDays++;
          currentStreak = 0;
        }
      } else if (dateKey <= today) {
        // 过去的日期无记录视为0
        stats.recordedDays++;
        stats.zeroDays++;
        stats.dayOfWeekStats[dayOfWeek.toString()].days++;
        currentStreak = 0;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    stats.streakDays = currentStreak;
    stats.avgPerDay = stats.recordedDays > 0 ? stats.totalCount / stats.recordedDays : 0;

    return { stats, periodLabel };
  }, [dataMap, periodType]);

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setReport('');

    try {
      const userPrompt = generateUserDataPrompt(
        periodType,
        calculateStats.periodLabel,
        calculateStats.stats,
        new Date().toISOString()
      );

      const result = await callAI(TAKEOFF_REPORT_SYSTEM_PROMPT, userPrompt, aiConfig);
      setReport(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成报告失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = () => {
    saveAIConfig(aiConfig);
    setShowSettings(false);
  };

  const handleResetConfig = () => {
    resetAIConfig();
    setAiConfig(DEFAULT_AI_CONFIG);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold text-gray-800">AI 起飞报告</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              title="AI设置"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-4">
          {showSettings ? (
            // 设置面板
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API URL</label>
                <input
                  type="text"
                  value={aiConfig.apiUrl}
                  onChange={(e) => setAiConfig({ ...aiConfig, apiUrl: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://api.example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <input
                  type="password"
                  value={aiConfig.apiKey}
                  onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="sk-..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">模型</label>
                <input
                  type="text"
                  value={aiConfig.model}
                  onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="gpt-4o-mini"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSaveConfig}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  保存配置
                </button>
                <button
                  onClick={handleResetConfig}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  重置默认
                </button>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-gray-600 mb-2">推荐的API提供商：</p>
                <div className="space-y-2">
                  {AI_PROVIDERS.map((provider) => (
                    <a
                      key={provider.name}
                      href={provider.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <div>
                        <div className="font-medium text-gray-800">{provider.name}</div>
                        <div className="text-xs text-gray-500">{provider.description}</div>
                      </div>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // 报告生成面板
            <div className="space-y-4">
              {/* 周期选择 */}
              <div className="flex gap-2">
                {(['week', 'month', 'year'] as PeriodType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setPeriodType(type)}
                    className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                      periodType === type
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {type === 'week' ? '本周' : type === 'month' ? '本月' : '本年'}
                  </button>
                ))}
              </div>

              {/* 统计预览 */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-sm text-gray-600 mb-2">{calculateStats.periodLabel}</div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-xl font-bold text-green-600">{calculateStats.stats.totalCount}</div>
                    <div className="text-xs text-gray-500">总次数</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-blue-600">{calculateStats.stats.successDays}</div>
                    <div className="text-xs text-gray-500">起飞天数</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-purple-600">{calculateStats.stats.avgPerDay.toFixed(1)}</div>
                    <div className="text-xs text-gray-500">日均</div>
                  </div>
                </div>
              </div>

              {/* 生成按钮 */}
              <button
                onClick={handleGenerate}
                disabled={loading}
                className={`w-full py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                  loading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                }`}
              >
                {loading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    生成中...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    生成AI报告
                  </>
                )}
              </button>

              {/* 错误提示 */}
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* 报告内容 */}
              {report && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div
                    className="prose prose-sm max-w-none text-gray-700"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(report) }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
