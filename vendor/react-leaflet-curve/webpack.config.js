/* eslint-disable */
module.exports = {
  output: {
    library: "ReactLeaflet",
    libraryTarget: "umd"
  },
  externals: [
    {
      leaflet: {
        amd: "leaflet",
        commonjs: "leaflet",
        commonjs2: "leaflet",
        root: "L"
      }
    },
    {
      jquery: {
        amd: "jquery",
        commonjs: "jquery",
        commonjs2: "jquery",
        root: "JQuery"
      }
    },
    {
      "react-leaflet": {
        amd: "react-leaflet",
        commonjs: "react-leaflet",
        commonjs2: "react-leaflet"
      }
    },
    {
      react: {
        amd: "react",
        commonjs: "react",
        commonjs2: "react",
        root: "React"
      }
    }
  ],
  module: {
    rules: [{ test: /\.js$/, exclude: /node_modules/, loader: "babel-loader" }]
  }
};
