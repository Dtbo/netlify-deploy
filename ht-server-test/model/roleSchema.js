/**
 * 角色模型
 * 用于存储系统角色和权限配置
 * @author Lee
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const roleSchema = new Schema({
    roleName: String,
    remark: String,
    permissionList: {
        checkedKeys: [],
        halfCheckedKeys: [],
        checkKeys: [],
        halfCheckKeys: []
    },
    createTime: {
        type: Date,
        default: Date.now
    },
    updateTime: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('role', roleSchema);
