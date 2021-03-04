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

// Ref: https://github.com/grafana/grafana/blob/master/packages/grafana-toolkit/README.md
