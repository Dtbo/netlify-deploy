const mongoose = require('mongoose');
const User = require('../model/userSchema');
const Role = require('../model/roleSchema');

async function main() {
    await mongoose.connect('mongodb://127.0.0.1:27017/web2525shop');
    const defaultRole = await Role.findOne({ roleName: '普通员工' });
    if (!defaultRole) {
        console.log('未找到「普通员工」角色');
        process.exit(1);
    }
    const roleId = String(defaultRole._id);
    const res = await User.updateMany(
        { role: 1, $or: [{ roleList: { $exists: false } }, { roleList: { $size: 0 } }] },
        { $set: { roleList: [roleId] } }
    );
    console.log(`已为 ${res.modifiedCount} 名员工分配「普通员工」角色`);
    await mongoose.disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
