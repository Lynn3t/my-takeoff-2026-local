import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 静态导出，用于 Capacitor 打包
  output: 'export',
  // 生产环境移除 console.log
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // 压缩优化
  compress: true,
  // 生产环境 source map 优化
  productionBrowserSourceMaps: false,
  // 优化图片 - 静态导出需要禁用图片优化
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
