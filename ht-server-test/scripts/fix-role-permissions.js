/**
 * 1. 对调「审批休假」与「待审批管理」菜单名称
 * 2. 创建/更新「普通员工」默认角色权限
 */
const mongoose = require('mongoose');
const { getDefaultEmployeePermissionList } = require('../utils/deptUser');

async function main() {
    await mongoose.connect('mongodb://127.0.0.1:27017/web2525shop');
    const Menu = require('../model/menuSchema');
    const Role = require('../model/roleSchema');

    const leaveMenu = await Menu.findOne({ path: '/leave' });
    const approveMenu = await Menu.findOne({ path: '/approve' });

    if (leaveMenu && approveMenu) {
        await Menu.updateOne({ _id: leaveMenu._id }, { $set: { menuName: '待审批休假', updateTime: new Date() } });
        await Menu.updateOne({ _id: approveMenu._id }, { $set: { menuName: '审批休假', updateTime: new Date() } });
        console.log('已对调菜单名称：/leave -> 待审批休假，/approve -> 审批休假');
    }

    const permissionList = getDefaultEmployeePermissionList();
    let employeeRole = await Role.findOne({ roleName: '普通员工' });

    if (employeeRole) {
        await Role.updateOne({ _id: employeeRole._id }, { $set: { permissionList, updateTime: new Date() } });
        console.log('已更新「普通员工」角色默认权限');
    } else {
        employeeRole = await Role.create({
            roleName: '普通员工',
            remark: '员工默认权限：待审批休假、打卡管理、上传图片、行驶轨迹',
            permissionList
        });
        console.log('已创建「普通员工」角色');
    }

    await mongoose.disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
