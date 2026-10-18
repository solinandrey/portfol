import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // в корне репозитория пока лежит старый сайт со своим lock-файлом
  turbopack: { root: __dirname },
};

export default nextConfig;
