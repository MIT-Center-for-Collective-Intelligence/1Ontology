module.exports = {
  output: "standalone",
  reactStrictMode: false,
  images: {
    domains: ["storage.googleapis.com"],
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.md$/,
      use: "raw-loader",
    });

    return config;
  },
};
