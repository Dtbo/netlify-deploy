/**
 * 计数器模型
 * 用于生成唯一的用户ID等自增序列
 * @author Lee
 */

// 引入 mongoose 模块
const mongoose = require('mongoose');

// 从 mongoose 中解构 Schema
const { Schema } = mongoose;

/**
 * 计数器 Schema 定义
 * @property {string} _id - 计数器名称标识（如 'userId'）
 * @property {number} squence_value - 当前序列值
 */
const counterSchema = new Schema({
    _id: String,           // 计数器标识名称
    squence_value: Number  // 当前序列值
});

// 导出计数器模型
module.exports = mongoose.model('counter', counterSchema);