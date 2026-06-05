const mongoose = require('mongoose');
const { getEmployeeSupervisorId, isEmployeeUnderSupervisor } = require('../utils/deptUser');

async function main() {
    await mongoose.connect('mongodb://127.0.0.1:27017/web2525shop');
    const User = require('../model/userSchema');
    const Dept = require('../model/deptSchema');
    const depts = await Dept.find({}).lean();
    const admin = await User.findOne({ userName: 'admin' }).lean();

    const users = await User.find({
        $or: [{ userName: '李四' }, { userName: '王五' }, { userId: 1000050 }, { userId: 1000051 }]
    }).lean();

    console.log('found', users.length);
    users.forEach(u => {
        console.log({
            userId: u.userId,
            userName: u.userName,
            state: u.state,
            deptId: u.deptId,
            supervisor: getEmployeeSupervisorId(u, depts),
            underAdmin: admin ? isEmployeeUnderSupervisor(admin, u, depts) : null
        });
    });

    const unassigned = await User.find({ $or: [{ deptId: [] }, { deptId: { $size: 0 } }] }).select('userId userName state').lean();
    console.log('no dept users:', unassigned.length, unassigned.slice(0, 10));

    await mongoose.disconnect();
}

main().catch(console.error);
