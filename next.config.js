/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Mark dockerode as external for webpack to prevent bundling native modules
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('dockerode', 'ssh2', 'ssh2-streams');
      }
    }

    // Exclude dockerode and related modules from client-side bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        path: false,
        os: false,
        child_process: false,
        dockerode: false,
        ssh2: false,
      };
    }

    // Ignore native .node files in webpack
    config.module = config.module || {};
    config.module.rules = config.module.rules || [];
    config.module.rules.push({
      test: /\.node$/,
      use: 'node-loader',
    });

    return config;
  },
  // Output standalone for better deployment
  output: 'standalone',
}

module.exports = nextConfig
