/**
 * 数据库连接配置模块
 * 使用 Mongoose 连接 MongoDB 数据库
 * @author Lee
 */

// 引入 Mongoose 模块
const mongoose = require('mongoose');

// 引入数据库配置
const config = require('./index');

/**
 * 连接 MongoDB 数据库
 * 使用配置文件中定义的数据库连接 URL
 */
mongoose.connect(config.URL);

/**
 * 监听数据库连接错误事件
 * @param {Error} err - 错误对象
 */
mongoose.connection.on('error', err => {
    console.error('数据库连接失败:', err);
});

/**
 * 监听数据库连接成功事件
 */
mongoose.connection.on('open', () => {
    console.log('******** 数据库连接成功 ********');
});