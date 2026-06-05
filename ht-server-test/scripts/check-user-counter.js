const mongoose = require('mongoose');

async function main() {
    await mongoose.connect('mongodb://127.0.0.1:27017/web2525shop');
    const Counter = require('../model/counterSchema');
    const User = require('../model/userSchema');

    const counter = await Counter.findOne({ _id: 'userId' });
    const maxUser = await User.findOne({}).sort({ userId: -1 }).select('userId userName');
    const lowUsers = await User.find({ userId: { $lt: 1000 } }).select('userId userName userEmail').sort({ userId: 1 });

    console.log('counter:', counter);
    console.log('max userId:', maxUser);
    console.log('low id users:', lowUsers);
    await mongoose.disconnect();
}

main().catch(console.error);
