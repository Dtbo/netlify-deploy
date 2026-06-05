/**
 * 为各页面菜单初始化按钮权限（menuType=2），并添加「角色管理」菜单
 */
const mongoose = require('mongoose');
const Menu = require('../model/menuSchema');

const PAGE_IDS = {
    user: '646adb750bc1863e6590fe4e',
    dept: '646b047f135377c10e12291b',
    menu: '646b044e135377c10e122913',
    leave: '646b04e1135377c10e122932',
    approve: '646c18e6b170f7b10befe2f5',
    empPerm: '646b046c135377c10e122919',
    echarts: '6a1699ecad114c9cd7e86727',
    togther: '6a190d6c09b415ead5a9f830',
    track: '6a1979c0ea59ff67b605938b',
    systemGroup: '646ada5030ed84e32b91c640'
};

const BUTTON_DEFS = [
    { pageKey: 'user', parentId: [PAGE_IDS.systemGroup, PAGE_IDS.user], buttons: [
        { menuName: '新增', menuCode: 'user-add' },
        { menuName: '编辑', menuCode: 'user-edit' },
        { menuName: '删除', menuCode: 'user-delete' },
        { menuName: '批量删除', menuCode: 'user-deleteAll' },
        { menuName: '导出数据', menuCode: 'user-export' }
    ]},
    { pageKey: 'dept', parentId: [PAGE_IDS.systemGroup, PAGE_IDS.dept], buttons: [
        { menuName: '创建部门', menuCode: 'dept-create' },
        { menuName: '新增', menuCode: 'dept-add' },
        { menuName: '编辑', menuCode: 'dept-edit' },
        { menuName: '删除', menuCode: 'dept-delete' }
    ]},
    { pageKey: 'menu', parentId: [PAGE_IDS.systemGroup, PAGE_IDS.menu], buttons: [
        { menuName: '创建', menuCode: 'menu-create' },
        { menuName: '新增', menuCode: 'menu-add' },
        { menuName: '编辑', menuCode: 'menu-edit' },
        { menuName: '删除', menuCode: 'menu-delete' }
    ]},
    { pageKey: 'leave', parentId: ['646b04b1135377c10e12292c', PAGE_IDS.leave], buttons: [
        { menuName: '审批休假', menuCode: 'leave-add' },
        { menuName: '查看', menuCode: 'leave-view' },
        { menuName: '作废', menuCode: 'leave-cancel' }
    ]},
    { pageKey: 'approve', parentId: ['646b04b1135377c10e12292c', PAGE_IDS.approve], buttons: [
        { menuName: '审核', menuCode: 'approve-audit' },
        { menuName: '删除', menuCode: 'approve-delete' },
        { menuName: '审核通过', menuCode: 'approve-pass' },
        { menuName: '驳回', menuCode: 'approve-refuse' },
        { menuName: '保存备注', menuCode: 'approve-remark' }
    ]},
    { pageKey: 'empPerm', parentId: [PAGE_IDS.systemGroup, PAGE_IDS.empPerm], buttons: [
        { menuName: '设置权限', menuCode: 'emp-permission' }
    ]},
    { pageKey: 'track', parentId: [PAGE_IDS.systemGroup, PAGE_IDS.track], buttons: [
        { menuName: '开始动画', menuCode: 'track-start' },
        { menuName: '暂停动画', menuCode: 'track-pause' },
        { menuName: '继续动画', menuCode: 'track-resume' },
        { menuName: '停止动画', menuCode: 'track-stop' }
    ]}
];

async function upsertButton(parentId, btn) {
    const exists = await Menu.findOne({ menuCode: btn.menuCode, menuType: 2 }).lean();
    if (exists) {
        await Menu.updateOne({ _id: exists._id }, {
            $set: {
                menuName: btn.menuName,
                parentId,
                menuState: 1,
                updateTime: new Date()
            }
        });
        return { action: 'updated', _id: exists._id, menuCode: btn.menuCode };
    }
    const doc = await Menu.create({
        parentId,
        menuType: 2,
        menuName: btn.menuName,
        menuCode: btn.menuCode,
        menuState: 1,
        icon: '',
        path: '',
        component: ''
    });
    return { action: 'created', _id: doc._id, menuCode: btn.menuCode };
}

async function ensureRoleManageMenu() {
    let roleMenu = await Menu.findOne({ path: '/roles', component: 'RoleManageAd' }).lean();
    if (roleMenu) {
        return roleMenu;
    }

    const empMenu = await Menu.findById(PAGE_IDS.empPerm).lean();
    if (empMenu && empMenu.menuName === '角色管理') {
        await Menu.updateOne({ _id: PAGE_IDS.empPerm }, {
            $set: { menuName: '员工权限', updateTime: new Date() }
        });
        console.log('已将原「角色管理」更名为「员工权限」');
    }

    roleMenu = await Menu.create({
        parentId: [PAGE_IDS.systemGroup],
        menuType: 1,
        menuName: '角色管理',
        path: '/roles',
        component: 'RoleManageAd',
        menuCode: 'role-manage',
        menuState: 1,
        icon: 'UserFilled'
    });
    console.log('已创建「角色管理」菜单 -> RoleManageAd /roles');
    return roleMenu;
}

async function seedRoleManageButtons(roleMenuId) {
    const parentId = [PAGE_IDS.systemGroup, roleMenuId.toString()];
    const buttons = [
        { menuName: '创建', menuCode: 'role-create' },
        { menuName: '编辑', menuCode: 'role-edit' },
        { menuName: '删除', menuCode: 'role-delete' },
        { menuName: '设置权限', menuCode: 'role-permission' }
    ];
    const results = [];
    for (const btn of buttons) {
        results.push(await upsertButton(parentId, btn));
    }
    return results;
}

async function main() {
    await mongoose.connect('mongodb://127.0.0.1:27017/web2525shop');
    console.log('开始初始化按钮权限...\n');

    const allResults = [];
    for (const group of BUTTON_DEFS) {
        for (const btn of group.buttons) {
            const res = await upsertButton(group.parentId, btn);
            allResults.push(res);
            console.log(`[${res.action}] ${btn.menuCode} (${btn.menuName})`);
        }
    }

    const roleMenu = await ensureRoleManageMenu();
    const roleBtnResults = await seedRoleManageButtons(roleMenu._id);
    roleBtnResults.forEach(r => console.log(`[${r.action}] ${r.menuCode}`));

    console.log(`\n完成：页面按钮 ${allResults.length} 个，角色管理按钮 ${roleBtnResults.length} 个`);
    await mongoose.disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
