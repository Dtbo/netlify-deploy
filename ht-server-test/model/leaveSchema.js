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
 * 休假模型 
 * 用于存储系统休假信息
 * @param {String} orderNo - 订单号
 * @param {Array<String>} allTime - 休假时间
 * @param {String} leaveTime - 休假时长
 * @param {Number} applyType - 休假类型
 * @param {Number} applyState - 审批类型
 * @param {String} reasons - 休假原因
 * @param {Date} createTime - 申请时间
 * @author Lee
 */
const leaveSchema = new Schema({
    orderNo: String,//订单号
    allTime: [String],//休假时间
    leaveTime: String,//休假时长
    applyType: {//休假类型
        default: 1,
        type: Number
    },
    applyState: {//审批类型
        default: 1,
        type: Number
    },
    reasons: String,//休假原因
    createTime: {//申请时间
        type: Date, default: Date.now
    },
    applyUser: {//提交人
        userId: String,
        userName: String,
        userEmail: String
    },
    auditUsers: String,//审批人 分为三个 当前审批人 人事主管 财务主管
    curAuditUserName: String,//当前审批人
    //审批流
    auditFlows: [{
        userId: String,
        userName: String,
        userEmail: String
    }],
    //审批日志
    auditLogs: [{
        userId: String,
        userName: String,
        action: String,//审批通过或者拒绝
        remark: String,//备注
        signImg: String,//电子签名图片路径
        createTime: {//申请时间
            type: Date, default: Date.now
        },
    }]
});

// 导出用户模型
module.exports = mongoose.model('leave', leaveSchema);