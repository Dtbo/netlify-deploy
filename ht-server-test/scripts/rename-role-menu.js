const mongoose = require('mongoose');

async function main() {
    await mongoose.connect('mongodb://127.0.0.1:27017/web2525shop');
    const Menu = require('../model/menuSchema');
    const res = await Menu.updateMany(
        { $or: [{ path: '/roles' }, { component: 'RoleAd' }] },
        { $set: { menuName: '员工权限', updateTime: new Date() } }
    );
    console.log(`已更新菜单名称为「员工权限」，匹配 ${res.matchedCount} 条`);
    await mongoose.disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
