const mongoose = require('mongoose');

async function main() {
    await mongoose.connect('mongodb://127.0.0.1:27017/web2525shop');
    const Menu = require('../model/menuSchema');
    const menus = await Menu.find({
        $or: [
            { component: 'RoleAd' },
            { menuName: /权限|角色/ }
        ]
    }).lean();
    menus.forEach(m => {
        console.log({ menuName: m.menuName, path: m.path, component: m.component, menuType: m.menuType, menuState: m.menuState });
    });
    await mongoose.disconnect();
}

main().catch(console.error);
