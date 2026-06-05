/**
 * 修复菜单和角色权限数据库数据
 */
const mongoose = require('mongoose');

async function fixDatabase() {
  await mongoose.connect('mongodb://127.0.0.1:27017/web2525shop');
  const db = mongoose.connection.db;
  const menus = db.collection('menus');
  const roles = db.collection('roles');

  // 1. 修复一级目录的错误路由，避免点击后跳转异常
  await menus.updateOne(
    { menuName: '审批管理' },
    { $set: { path: 'menu-approve', updateTime: new Date() } }
  );
  await menus.updateOne(
    { menuName: '总体管理' },
    { $set: { path: 'menu-system', updateTime: new Date() } }
  );

  // 2. 补全缺失 menuType 和 component 的菜单
  const menuFixes = [
    { menuName: '图表管理', menuType: 1, component: 'EchartAd', path: '/echarts' },
    { menuName: '打卡管理', menuType: 1, component: 'TogtherAd', path: '/togther' },
    { menuName: '行驶轨迹', menuType: 1, component: 'TrackAd', path: '/track' }
  ];

  for (const fix of menuFixes) {
    const { menuName, ...fields } = fix;
    await menus.updateOne({ menuName }, { $set: { ...fields, updateTime: new Date() } });
  }

  // 3. 统一角色权限字段命名（兼容 Element Plus 树组件）
  const allRoles = await roles.find({}).toArray();
  for (const role of allRoles) {
    const pl = role.permissionList || {};
    const checkedKeys = pl.checkedKeys || pl.checkKeys || [];
    const halfCheckedKeys = pl.halfCheckedKeys || pl.halfCheckKeys || [];

    await roles.updateOne(
      { _id: role._id },
      {
        $set: {
          permissionList: {
            checkedKeys,
            halfCheckedKeys
          },
          updateTime: new Date()
        }
      }
    );
  }

  console.log('数据库修复完成');
  await mongoose.disconnect();
}

fixDatabase().catch((err) => {
  console.error('修复失败:', err);
  process.exit(1);
});
