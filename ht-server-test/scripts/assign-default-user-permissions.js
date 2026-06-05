const mongoose = require('mongoose');
const User = require('../model/userSchema');
const { getDefaultEmployeePermissionList, isSupervisorAccount } = require('../utils/deptUser');
const Dept = require('../model/deptSchema');

async function main() {
    await mongoose.connect('mongodb://127.0.0.1:27017/web2525shop');
    const allDepts = await Dept.find({}).lean();
    const defaultPerm = getDefaultEmployeePermissionList();

    const users = await User.find({ role: 1 }).lean();
    let updated = 0;

    for (const user of users) {
        if (isSupervisorAccount(user, allDepts)) continue;

        const pl = user.permissionList || {};
        const hasPerm = (pl.checkedKeys || pl.checkKeys || []).length
            || (pl.halfCheckKeys || pl.halfCheckedKeys || []).length;

        if (!hasPerm) {
            await User.updateOne({ _id: user._id }, { $set: { permissionList: defaultPerm } });
            updated += 1;
        }
    }

    console.log(`已为 ${updated} 名普通员工补全默认个人权限`);
    await mongoose.disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
