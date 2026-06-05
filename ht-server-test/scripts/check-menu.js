const mongoose = require('mongoose');
const utils = require('../utils/utils');

async function getMenuList(userRole, roleKeys, useFixedKeys = false) {
  const Menu = mongoose.connection.db.collection('menus');
  let rootList = [];
  const roleNum = parseInt(userRole);

  if (roleNum === 0) {
    rootList = await Menu.find({}).toArray();
  } else if (!roleKeys || roleKeys.length === 0) {
    rootList = [];
  } else {
    const Role = mongoose.connection.db.collection('roles');
    const roleList = await Role.find({ _id: { $in: roleKeys.map(id => new mongoose.Types.ObjectId(id)) } }).toArray();
    let permissionList = [];
    roleList.forEach(role => {
      const pl = role.permissionList || {};
      if (useFixedKeys) {
        const checkKeys = pl.checkKeys || pl.checkedKeys || [];
        const halfCheckKeys = pl.halfCheckKeys || pl.halfCheckedKeys || [];
        permissionList = permissionList.concat([...checkKeys, ...halfCheckKeys]);
      } else {
        const { checkKeys, halfCheckKeys } = pl;
        permissionList = permissionList.concat([...(checkKeys || []), ...(halfCheckKeys || [])]);
      }
    });
    permissionList = [...new Set(permissionList)];
    if (permissionList.length === 0) {
      rootList = await Menu.find({ menuName: { $regex: '休假|审批' } }).toArray();
    } else {
      rootList = await Menu.find({ _id: { $in: permissionList.map(id => new mongoose.Types.ObjectId(id)) } }).toArray();
    }
  }
  return utils.TreeMenuList(rootList);
}

function analyzeTree(tree, label) {
  console.log('\n===', label, '===');
  tree.forEach(item => {
    const showSub = item.children?.length > 0 && item.children[0]?.menuType == 1;
    console.log({
      name: item.menuName,
      path: item.path,
      menuType: item.menuType,
      childCount: item.children?.length || 0,
      firstChildType: item.children?.[0]?.menuType,
      showSubMenu: showSub
    });
  });
}

mongoose.connect('mongodb://127.0.0.1:27017/web2525shop').then(async () => {
  const User = mongoose.connection.db.collection('users');
  const users = await User.find({ role: 1 }).limit(3).toArray();

  for (const user of users) {
    try {
      const treeBroken = await getMenuList(user.role, user.roleList, false);
      analyzeTree(treeBroken, `BROKEN ${user.userName}`);
    } catch (e) {
      console.log('BROKEN error for', user.userName, e.message);
    }
    const treeFixed = await getMenuList(user.role, user.roleList, true);
    analyzeTree(treeFixed, `FIXED ${user.userName}`);
  }

  const adminTree = await getMenuList(0, [], true);
  analyzeTree(adminTree, 'ADMIN');

  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
