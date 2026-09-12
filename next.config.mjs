/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**"
      }
    ]
  },
  experimental: {
    serverComponentsExternalPackages: [
      "grammy",
      "@prisma/client",
      "bcryptjs",
      "@prisma/adapter-libsql",
      "@libsql/client"
    ]
  }
};

export default nextConfig;