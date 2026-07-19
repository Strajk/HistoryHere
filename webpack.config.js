const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin'); // eslint-disable-line

module.exports = {
  mode: 'production',
  entry: {
    popup: './src/popup',
    background: './src/background',
  },
  devtool: 'source-map',
  output: {
    path: path.resolve(__dirname, 'extension'),
    filename: '[name].js',
  },
  plugins: [
    new CopyWebpackPlugin({ patterns: [{ from: 'assets' }] }),
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules)/,
        loader: 'babel-loader',
      },
    ],
  },
};
