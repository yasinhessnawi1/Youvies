const webpack = require('webpack');

module.exports = function override(config, env) {
    config.resolve.fallback = {
        ...config.resolve.fallback,
        "path": require.resolve("path-browserify"),
        "os": require.resolve("os-browserify/browser"),
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify"),
        "vm": require.resolve("vm-browserify"),
        "process": require.resolve("process/browser.js"),
        "http": require.resolve("stream-http"),
        "https": require.resolve("https-browserify"),
        "querystring": require.resolve("querystring-es3"),
        "buffer": require.resolve("buffer"),
        "dgram": false,
        "net": false,
        "dns": false,
        "fs": false,
        "global": require.resolve("global"),  // Add global polyfill

    };
    config.plugins = (config.plugins || []).concat([
        new webpack.ProvidePlugin({
            process: 'process/browser.js',
            Buffer: ['buffer', 'Buffer'],
            global: 'global'  // Provide global variable
        }),
    ]);
    return config;
}
