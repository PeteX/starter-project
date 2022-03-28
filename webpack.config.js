const path = require('path');

const webpack = require('webpack');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { InjectManifest } = require('workbox-webpack-plugin');

const environment = {};

function HtmlEdit(options) { }
HtmlEdit.prototype.apply = function (compiler) {
  compiler.hooks.compilation.tap('HtmlEdit', (compilation) => {
    HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tapAsync('HtmlEdit', (data, cb) => {
      data.html = data.html.replace(/(<script defer src=['"][^>]*><\/script>)/gm, '  $1\n');
      data.html = data.html.replace(/"/g, '\'');
      cb(null, data);
    });
  });
}

const config = {
  entry: './src/app.ts',
  plugins: [
    new webpack.DefinePlugin(environment),
    new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
      template: 'resources/index.html',
      minify: false
    }),
    new HtmlEdit
  ],
  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)?$/,
        use: [
          {
            loader: 'ts-loader',
            options: {}
          }
        ],
        exclude: /node_modules/
      }, {
        test: /\.(jpe?g|gif|png|svg|webp|woff|ttf|wav|mp3|mp4)$/,

        use: [
          {
            loader: 'file-loader',

            options: {
              name: 'static/[name].[contenthash:base62:6].[ext]'
            }
          }
        ]
      }
    ]
  },
  resolve: {
    fallback: {
      fs: false,
      path: false
    },
    extensions: [
      '.js',
      '.jsx',
      '.ts',
      '.tsx'
    ]
  },
  devServer: {
    static: './dist',
    allowedHosts: 'all',
    server: {
      type: 'https'
    },
    historyApiFallback: {
      rewrites: [
        { from: /^\/oidc\.html$/, to: '/' }
      ]
    },
  },
  performance: {
    hints: false
  },
  optimization: {
    splitChunks: {
      cacheGroups: {
        vendor: {
          name: 'vendor',
          test: /\/node_modules\//,
          chunks: 'all',
          enforce: true,
        },
      },
    },
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash:6].js',
    hashDigest: 'base64url',
    hashDigestLength: 10,
    publicPath: '',
    devtoolModuleFilenameTemplate: (info) => {
      if (info.resourcePath.match(/^\.\/.*\.ts$/)) {
        return info.resourcePath.replace(/^\.\/src\//, 'src/');
      }

      return `resources:///${info.resourcePath}`;
    }
  },
  experiments: {
    topLevelAwait: true
  }
}

module.exports = (env, argv) => {
  let debug = argv.mode === 'development';
  if (debug)
    config.devtool = 'source-map';

  environment['process.env.NODE_ENV'] = JSON.stringify(argv.mode || 'production');
  if (argv.env?.WEBPACK_SERVE) {
    environment['process.env.SERVICE_WORKER'] = JSON.stringify('no');
  } else {
    environment['process.env.SERVICE_WORKER'] = JSON.stringify('yes');

    config.plugins.push(
      new InjectManifest({
        swSrc: './src/sw.js',
        exclude: ['index.html'],
        maximumFileSizeToCacheInBytes: 10000000
      })
    );
  }

  return config;
};
