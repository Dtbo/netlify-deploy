/**
 * 用户 ID 自增工具
 */
const Counter = require('../model/counterSchema');
const User = require('../model/userSchema');

const COUNTER_ID = 'userId';
const MIN_USER_ID = 1000001;

async function getMaxUserIdInDb() {
    const maxDoc = await User.findOne({ userId: { $exists: true, $ne: null } })
        .sort({ userId: -1 })
        .select('userId')
        .lean();
    return maxDoc?.userId || 0;
}

/** 将计数器同步到数据库中已有的最大 userId */
async function syncUserIdCounter() {
    const maxUserId = await getMaxUserIdInDb();
    const counter = await Counter.findOne({ _id: COUNTER_ID }).lean();
    const legacyValue = counter?.sequence_value || 0;
    const currentValue = counter?.squence_value || 0;
    const base = Math.max(maxUserId, currentValue, legacyValue, MIN_USER_ID - 1);

    await Counter.updateOne(
        { _id: COUNTER_ID },
        {
            $set: { squence_value: base },
            $unset: { sequence_value: '' }
        },
        { upsert: true }
    );

    return base;
}

/** 获取下一个可用的 userId（7 位自增，如 1000050） */
async function getNextUserId() {
    await syncUserIdCounter();
    const counter = await Counter.findOneAndUpdate(
        { _id: COUNTER_ID },
        { $inc: { squence_value: 1 } },
        { new: true, upsert: true }
    );
    return counter.squence_value;
}

module.exports = {
    getNextUserId,
    syncUserIdCounter,
    getMaxUserIdInDb
};
