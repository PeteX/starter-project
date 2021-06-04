const path = require('path');

const webpack = require('webpack');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { InjectManifest } = require('workbox-webpack-plugin');

const environment = {};

function HtmlEdit(options) {}
HtmlEdit.prototype.apply = function (compiler) {
  compiler.hooks.compilation.tap('HtmlEdit', (compilation) => {
    HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tapAsync('HtmlEdit', (data, cb) => {
      data.html = data.html.replace(/<link href=("[^"]*")[^>]*>/gm, '  <link rel=stylesheet href=$1>\n');
      data.html = data.html.replace(/(<script defer src=['"]static\/[^>]*><\/script>)/gm, '  $1\n');
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
    new MiniCssExtractPlugin({
      filename: 'static/[name].[contenthash].css'
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
        test: /\.css$/,
        use: [
          'raw-loader'
        ]
      }, {
        test: /\.less$/,
        exclude: /\/document\.less$/,
        use: [
          'raw-loader',
          'less-loader'
        ]
      }, {
        test: /\/document\.less$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              publicPath: '/'
            },
          },

          'css-loader',
          'less-loader'
        ]
      }, {
        test: /\.(jpe?g|gif|png|svg|webp|woff|ttf|wav|mp3|mp4)$/,

        use: [
          {
            loader: 'file-loader',

            options: {
              name: 'static/[name].[contenthash:hex:10].[ext]'
            }
          }
        ]
      }
    ]
  },
  resolve: {
    extensions: [
      '.js',
      '.jsx',
      '.ts',
      '.tsx'
    ]
  },
  devServer: {
    contentBase: './dist',
    https: true,
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
    filename: 'static/[name].[contenthash].js',
    hashDigestLength: 10,
    publicPath: ''
  },
}

module.exports = (env, argv) => {
  let debug = argv.mode === 'development';
  if(debug) {
    config.devtool = 'eval-source-map';

    for(let rule of config.module.rules) {
      for(let use of rule.use) {
        if(use.loader === 'ts-loader') {
          use.options.compilerOptions = {
            target: 'ESNext'
          };
        }
      }
    }
  }

  environment['process.env.NODE_ENV'] = JSON.stringify(argv.mode || 'production');

  if(argv.env?.WEBPACK_SERVE) {
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
