module.exports = {
  output: "standalone",
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: ["firebasestorage.googleapis.com", "storage.googleapis.com"],
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.md$/,
      use: "raw-loader",
    });

    return config;
  },
  async redirects() {
    return [
      {
        source: "/SkillsFuture/:id*",
        destination: "/",
        permanent: false,
      },
      {
        source: "/signup",
        destination: "/signin",
        permanent: true,
      },
      /* {
        source: "/landing/:path*",
        destination: "/",
        permanent: true,
      }, */
    ];
  },
};
