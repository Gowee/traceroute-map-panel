const RemarkHTML = require("remark-html");
const remark2react = require("remark-react");

module.exports.getWebpackConfig = (config, options) => ({
    ...config,
    module: {
        ...config.module,
        rules: [
            ...config.module.rules,
            {
                test: /\.mdx?$/,
                use: [
                    {
                        loader: 'babel-loader',
                        options: {
                            presets: [['@babel/preset-env', { modules: false }]],
                            plugins: ['angularjs-annotate', '@babel/plugin-transform-react-jsx'],
                            sourceMaps: true,
                        },
                    },
                    {
                        loader: "@mdx-js/loader",
                        
                    },
                ],
            }
        ]
    }
})
