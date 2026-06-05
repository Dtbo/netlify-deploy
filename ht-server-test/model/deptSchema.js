/**
 * 部门模型
 * 用于存储系统部门信息
 * @author Lee
 */

// 引入 mongoose 模块
const mongoose = require('mongoose');

// 从 mongoose 中解构 Schema
const { Schema } = mongoose;

/**
 * 部门 Schema 定义
 * @property {Array} parentId - 父级部门ID数组
 * @property {string} deptName - 部门名称
 * @property {string} userId - 部门负责人ID
 * @property {string} userName - 部门负责人姓名
 * @property {string} userEmail - 部门负责人邮箱
 * @property {string} userName2 - 副负责人姓名
 * @property {string} userEmail2 - 副负责人邮箱
 * @property {Date} createTime - 创建时间
 * @property {Date} updateTime - 更新时间
 * @property {string} remark - 部门备注
 */
const deptSchema = new Schema({
    parentId: [mongoose.Types.ObjectId], // 父级部门ID数组
    deptName: String,                   // 部门名称
    userId: String,                     // 部门负责人ID
    userName: String,                   // 部门负责人姓名
    userEmail: String,                  // 部门负责人邮箱
    userId2: String,                  // 员工ID
    userName2: String,                  // 员工姓名
    userEmail2: String,                 // 员工邮箱
    createTime: {                       // 创建时间
        type: Date, 
        default: Date.now 
    },
    updateTime: {                       // 更新时间
        type: Date, 
        default: Date.now 
    },
    remark: String                      // 部门备注
});

// 导出部门模型
module.exports = mongoose.model('dept', deptSchema);