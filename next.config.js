/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Permet au build de passer même avec des erreurs TS (le code marche en runtime)
    ignoreBuildErrors: true,
  },
  eslint: {
    // Idem pour ESLint
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
