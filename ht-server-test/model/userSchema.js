/**
 * 用户模型
 * 用于存储系统用户信息
 * @author Lee
 */

// 引入 mongoose 模块
const mongoose = require('mongoose');

// 从 mongoose 中解构 Schema
const { Schema } = mongoose;

/**
 * 用户 Schema 定义
 * @property {string} userName - 用户名称
 * @property {number} userId - 用户唯一标识（自增）
 * @property {string} userPwd - 用户密码
 * @property {string} userEmail - 用户邮箱
 * @property {number} state - 用户状态（1：在职，2：离职）
 * @property {number} mobile - 用户手机号
 * @property {string} role - 用户角色（0：管理员，1：普通用户）
 * @property {string} job - 用户职位
 * @property {string} sex - 用户性别
 * @property {Array} roleList - 用户所属角色ID列表
 * @property {Array} deptId - 用户所属部门ID列表
 * @property {Date} createTime - 创建时间
 * @property {Date} lastLoginTime - 最后登录时间
 */
const userSchema = new Schema({
    userName: String,           // 用户名称
    userId: Number,             // 用户唯一标识（自增）
    userPwd: String,            // 用户密码
    userEmail: String,          // 用户邮箱
    state: Number,              // 用户状态（1：在职，2：离职）
    mobile: Number,             // 用户手机号
    role: String,               // 用户角色（0：管理员，1：普通用户）
    job: String,                // 用户职位
    sex: String,                // 用户性别
    roleList: [],               // 用户所属角色ID列表
    deptId: [],                 // 用户所属部门ID列表
    permissionList: {           // 用户个人操作权限（优先于角色权限）
        checkedKeys: [],
        halfCheckedKeys: [],
        checkKeys: [],
        halfCheckKeys: []
    },
    createTime: {               // 创建时间
        type: Date, 
        default: Date.now 
    },
    lastLoginTime: {            // 最后登录时间
        type: Date, 
        default: Date.now 
    }
});

// 导出用户模型
module.exports = mongoose.model('user', userSchema);