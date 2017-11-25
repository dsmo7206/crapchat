const webpack = require('webpack');
const config = {
    entry: __dirname + '/js/index.jsx',
    module: {
        rules: [
            {   
                test: /\.jsx?/,
                exclude: /node_modules/,
                use: 'babel-loader'
            },
            {
                test: /\.scss$/,
                use: ['style-loader', 'css-loader', 'sass-loader']
            }
        ]
    },
    output: {
        path: __dirname + '/dist',
        filename: 'bundle.js',
    },
    resolve: {
        extensions: ['.js', '.jsx']
    },
};
module.exports = config;