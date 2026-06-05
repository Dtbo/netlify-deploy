/**
 * 修复用户登录相关数据
 */
const mongoose = require('mongoose');

async function fixUsers() {
  await mongoose.connect('mongodb://127.0.0.1:27017/web2525shop');
  const users = mongoose.connection.db.collection('users');

  const allUsers = await users.find({}).toArray();
  let fixedPwd = 0;
  let fixedEmail = 0;
  let fixedState = 0;

  for (const user of allUsers) {
    const update = {};

    if (!user.userPwd) {
      update.userPwd = '123456';
      fixedPwd++;
    }

    if (user.userEmail && /@qq\.com@/.test(user.userEmail)) {
      update.userEmail = user.userEmail.replace(/(@qq\.com)+$/g, '@qq.com');
      fixedEmail++;
    }

    if (Number(user.state) === 3) {
      update.state = 1;
      fixedState++;
    }

    if (Object.keys(update).length) {
      await users.updateOne({ _id: user._id }, { $set: update });
      console.log('修复用户:', user.userName, update);
    }
  }

  console.log(`完成：密码 ${fixedPwd}，邮箱 ${fixedEmail}，状态 ${fixedState}`);
  await mongoose.disconnect();
}

fixUsers().catch(err => {
  console.error(err);
  process.exit(1);
});
