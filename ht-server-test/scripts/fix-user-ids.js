/**
 * 1. 同步 userId 计数器到当前最大值
 * 2. 将个位数测试账号迁移为规范 10000xx ID
 */
const mongoose = require('mongoose');
const { syncUserIdCounter, getMaxUserIdInDb } = require('../utils/userId');

async function main() {
    await mongoose.connect('mongodb://127.0.0.1:27017/web2525shop');
    const User = require('../model/userSchema');

    const lowUsers = await User.find({ userId: { $lt: 1000 } }).sort({ userId: 1 }).lean();
    let nextId = await getMaxUserIdInDb();

    for (const user of lowUsers) {
        nextId += 1;
        await User.updateOne({ _id: user._id }, { $set: { userId: nextId } });
        console.log(`已迁移 ${user.userName}: ${user.userId} -> ${nextId}`);
    }

    const synced = await syncUserIdCounter();
    console.log(`计数器已同步为 ${synced}，下一个新用户 ID 为 ${synced + 1}`);
    await mongoose.disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
