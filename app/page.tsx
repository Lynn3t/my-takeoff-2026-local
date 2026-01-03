'use client';
import { useState, useEffect, useMemo, memo, useCallback } from 'react';

// 骨架屏组件 - 日历月份
const CalendarSkeleton = memo(function CalendarSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full max-w-6xl">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="h-6 bg-gray-200 rounded w-16 mx-auto mb-2 animate-pulse" />
          <div className="grid grid-cols-7 gap-1 mb-2">
            {Array.from({ length: 7 }).map((_, j) => (
              <div key={j} className="h-3 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, j) => (
              <div key={j} className="aspect-square bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});

// 安装提示组件 - 根据设备类型显示不同内容
type InstallPromptType = 'none' | 'android' | 'ios';

const InstallPrompt = memo(function InstallPrompt() {
  const [promptType, setPromptType] = useState<InstallPromptType>('none');

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const isAndroid = /android/.test(ua);
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isMobile = isAndroid || isIOS;

    // 检测是否在 standalone 模式（已安装的 APK）
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    // 电脑或已安装的应用：不显示
    if (!isMobile || isStandalone) {
      setPromptType('none');
      return;
    }

    if (isAndroid) {
      setPromptType('android');
    } else if (isIOS) {
      setPromptType('ios');
    }
  }, []);

  if (promptType === 'none') return null;

  if (promptType === 'android') {
    return (
      <a
        href="/Takeoff2026.apk"
        download="Takeoff2026.apk"
        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-full transition-all"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        安装 App
      </a>
    );
  }

  if (promptType === 'ios') {
    return (
      <button
        onClick={() => alert('点击底部分享按钮 → 选择"添加到主屏幕"')}
        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-full transition-all"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v12m0-12L8 8m4-4l4 4M6 20h12" />
        </svg>
        添加到主屏幕
      </button>
    );
  }

  return null;
});

// 日期单元格组件 - 使用 memo 避免不必要的重渲染
interface DayCellProps {
  dateKey: string;
  dayOfYear: number;
  day: number;
  text: string;
  className: string;
  onToggle: (dateKey: string) => void;
}

const DayCell = memo(function DayCell({ dateKey, dayOfYear, day, text, className, onToggle }: DayCellProps) {
  return (
    <div
      onClick={() => onToggle(dateKey)}
      className={`aspect-square flex flex-col items-center justify-center text-sm rounded cursor-pointer transition-all hover:scale-105 select-none ${className}`}
    >
      <span className="text-[8px] opacity-60 leading-none">{dayOfYear}</span>
      <span className="leading-none">{text || day}</span>
    </div>
  );
});

// 月份名称常量 - 避免每次渲染重新创建
const MONTHS = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"] as const;

// 本地存储 key
const LOCAL_STORAGE_KEY = 'takeoff_local_data';

// 定义数据类型：key是日期字符串，value是数字状态
type DataMap = Record<string, number>;

// 本地存储工具函数
const loadLocalData = (): DataMap => {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

const saveLocalData = (data: DataMap) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('本地存储失败', e);
  }
};

export default function Home() {
  const [dataMap, setDataMap] = useState<DataMap>({});
  const [loading, setLoading] = useState(true);
  const [todayKey, setTodayKey] = useState<string>('');
  const year = 2026;

  const getTodayString = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - offset);
    return local.toISOString().split('T')[0];
  };

  // 在客户端加载数据
  useEffect(() => {
    setTodayKey(getTodayString());
    const localData = loadLocalData();
    setDataMap(localData);
    setLoading(false);
  }, []);

  const toggleDay = useCallback((dateKey: string) => {
    const todayStr = getTodayString();

    setDataMap(prevData => {
      const currentStatus = prevData[dateKey];
      let nextStatus: number | null;

      // 未来日期：将数据置为空而非提交数值
      if (dateKey > todayStr) {
        nextStatus = null;
      }
      // 逻辑: undefined -> 1 -> 2 -> 3 -> 4 -> 5 -> 0(红) -> undefined
      else if (currentStatus === undefined || currentStatus === null) {
        nextStatus = 1;
      } else if (currentStatus >= 1 && currentStatus < 5) {
        nextStatus = currentStatus + 1;
      } else if (currentStatus === 5) {
        nextStatus = 0;
      } else {
        nextStatus = null;
      }

      const newData = { ...prevData };
      if (nextStatus === null) {
        delete newData[dateKey];
      } else {
        newData[dateKey] = nextStatus;
      }

      // 保存到本地存储
      saveLocalData(newData);
      return newData;
    });
  }, []);

  // 获取显示逻辑（复用于 UI 和 CSV 导出）
  const getDayStatus = useCallback((dateKey: string) => {
    const dbValue = dataMap[dateKey];

    // 1. 数据库有记录
    if (dbValue !== undefined && dbValue !== null) {
      if (dbValue === 0) return { val: 0, text: "0", label: "未起飞", className: "bg-red-500 text-white" };
      return { val: dbValue, text: dbValue.toString(), label: "起飞", className: "bg-green-500 text-white font-bold" };
    }

    // 2. 过期自动补零
    if (dateKey < todayKey) {
      return { val: 0, text: "0", label: "未起飞(自动)", className: "bg-red-500 text-white opacity-60" };
    }

    // 3. 待定
    return { val: null, text: "", label: "待定", className: "bg-gray-200" };
  }, [dataMap, todayKey]);

  // === 导出 CSV 功能 ===
  const downloadCSV = useCallback(() => {
    // 表头
    const rows = [["日期", "次数", "状态"]];
    const todayStr = getTodayString();

    // 遍历 2026 全年
    for (let m = 0; m < 12; m++) {
      const daysInMonth = new Date(year, m + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dateKey = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dbValue = dataMap[dateKey];

        let countStr = "";
        let label = "待定";

        if (dbValue !== undefined && dbValue !== null) {
          countStr = dbValue.toString();
          label = dbValue === 0 ? "未起飞" : "起飞";
        } else if (dateKey < todayStr) {
          countStr = "0";
          label = "未起飞(自动)";
        }

        rows.push([dateKey, countStr, label]);
      }
    }

    // 加上 BOM (\uFEFF) 解决 Excel 打开中文乱码问题
    const csvContent = "\uFEFF" + rows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", `2026起飞记录_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [dataMap, year]);

  // 预计算日历数据 - 避免每次渲染重复计算
  const calendarData = useMemo(() => {
    const startOfYear = new Date(year, 0, 1);

    return MONTHS.map((name, index) => {
      const daysInMonth = new Date(year, index + 1, 0).getDate();
      const firstDay = new Date(year, index, 1).getDay();

      const days = Array.from({ length: daysInMonth }).map((_, i) => {
        const d = i + 1;
        const dateKey = `${year}-${String(index + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const currentDate = new Date(year, index, d);
        const dayOfYear = Math.floor((currentDate.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        return { d, dateKey, dayOfYear };
      });

      return { name, index, firstDay, days };
    });
  }, [year]);

  const renderCalendar = () => {
    return calendarData.map(({ name, firstDay, days }) => {
      return (
        <div key={name} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-center font-bold mb-2 border-b pb-2 text-gray-700">
            {name}
          </h3>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-2">
            <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
            {days.map(({ d, dateKey, dayOfYear }) => {
              const { text, className } = getDayStatus(dateKey);
              return (
                <DayCell
                  key={dateKey}
                  dateKey={dateKey}
                  dayOfYear={dayOfYear}
                  day={d}
                  text={text}
                  className={className}
                  onToggle={toggleDay}
                />
              );
            })}
          </div>
        </div>
      );
    });
  };

  const dbValues = Object.values(dataMap);
  const totalCount = dbValues.reduce((acc, v) => (v > 0 ? acc + v : acc), 0);
  const successDays = dbValues.filter(v => v > 0).length;

  // 计算2026年已过天数
  const getPassedDays = () => {
    if (!todayKey) return 0;
    const [y, m, d] = todayKey.split('-').map(Number);
    if (y < year) return 0;
    if (y > year) return 365;
    const today = new Date(y, m - 1, d);
    const startOfYear = new Date(year, 0, 1);
    return Math.floor((today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };
  const recordedDays = getPassedDays();

  const successRate = recordedDays > 0 ? ((successDays / recordedDays) * 100).toFixed(1) : '0';
  const avgPerDay = recordedDays > 0 ? (totalCount / recordedDays).toFixed(2) : '0';

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8 flex flex-col items-center">
      {/* 顶部栏 - 安装提示 */}
      <div className="w-full max-w-6xl flex justify-end items-center gap-4 mb-4 min-h-[24px]">
        <InstallPrompt />
      </div>

      <h1 className="text-2xl font-bold mb-4 text-gray-800">2026 起飞记录仪</h1>

      <div className="flex flex-wrap items-center justify-center gap-4 mb-8 bg-white p-3 rounded-xl shadow-sm px-6">
        <div className="flex gap-4 text-sm font-medium border-r pr-4 mr-2">
            <span className="text-green-600">起飞天数: {successDays}天 / {recordedDays}天 - {successRate}%</span>
            <span className="text-blue-600">起飞次数: {totalCount}</span>
            <span className="text-purple-600">平均每天: {avgPerDay}次</span>
        </div>

        {/* 导出按钮 */}
        <button
            onClick={downloadCSV}
            className="px-4 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs rounded-full transition-all font-medium flex items-center gap-1 btn-press"
        >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            导出 CSV
        </button>
      </div>

      {loading ? (
        <CalendarSkeleton />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full max-w-6xl">
          {renderCalendar()}
        </div>
      )}

    </main>
  );
}
