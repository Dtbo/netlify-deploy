/**
 * 修复部门数据：
 * 1. 清除青阳子根部门的员工字段
 * 2. 将技术部直属员工迁移到 java 小组
 */
const mongoose = require('mongoose');

const MONGO_URI = 'mongodb://127.0.0.1:27017/web2525shop';

async function main() {
    await mongoose.connect(MONGO_URI);
    const Dept = require('../model/deptSchema');
    const User = require('../model/userSchema');

    const qingyangziId = '64740eb5d4b625a97f61c721';
    const techDeptId = '6476b8fd0286fe192a1b40cb';
    const javaGroupId = '6a211c98ee9505120050add0';
    const adminUserId = '1000003';

    await Dept.updateOne(
        { _id: qingyangziId },
        { $set: { userName2: '', userEmail2: '', userId2: '' } }
    );
    console.log('已清除青阳子部门的员工字段');

    await Dept.updateOne(
        { _id: techDeptId },
        { $set: { userName2: '', userEmail2: '', userId2: '' } }
    );

    const javaPath = [qingyangziId, techDeptId, javaGroupId];
    const users = await User.find({ state: 1 }).lean();
    let moved = 0;

    for (const user of users) {
        const ids = (user.deptId || []).map(String).filter(id => id && id !== 'null');
        const lastId = ids[ids.length - 1];
        if (lastId === techDeptId && String(user.userId) !== adminUserId) {
            await User.updateOne({ userId: user.userId }, { deptId: javaPath });
            console.log(`  迁移 ${user.userName} -> java小组`);
            moved++;
        }
    }

    console.log(`共迁移 ${moved} 名技术部员工到 java小组`);
    await mongoose.disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
