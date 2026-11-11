import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // в корне репозитория пока лежит старый сайт со своим lock-файлом
  turbopack: { root: __dirname },
  // аналитика ходит через наш домен: /ingest/* уходит в PostHog (облако ЕС). Правила для static и
  // array стоят раньше общего. Без skipTrailingSlashRedirect каждый запрос получал бы лишний редирект
  skipTrailingSlashRedirect: true,
  // адреса старого сайта: их помнят поисковики и чужие ссылки. /about позже станет разделом
  // с фотографиями, поэтому его перенаправление временное
  async redirects() {
    return [
      { source: "/experience", destination: "/", permanent: true },
      { source: "/projects", destination: "/", permanent: true },
      { source: "/about", destination: "/", permanent: false },
    ];
  },
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: "https://eu-assets.i.posthog.com/static/:path*" },
      { source: "/ingest/array/:path*", destination: "https://eu-assets.i.posthog.com/array/:path*" },
      { source: "/ingest/:path*", destination: "https://eu.i.posthog.com/:path*" },
    ];
  },
};

export default nextConfig;
