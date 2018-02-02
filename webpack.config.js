const path = require('path');
const CopyWebpackPlugin = require("copy-webpack-plugin"); // eslint-disable-line

module.exports = {
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
    new CopyWebpackPlugin([{ from: 'assets' }]),
  ],
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /(node_modules)/,
        loader: 'babel-loader',
      },
    ],
  },
};
