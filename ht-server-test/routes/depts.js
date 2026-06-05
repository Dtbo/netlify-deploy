/**
 * 部门管理路由模块
 */

const router = require('koa-router')();
const Dept = require('../model/deptSchema');
const User = require('../model/userSchema.js');
const utils = require('../utils/utils');
const {
    normalizeIdList,
    buildDeptPath,
    enrichDeptTree,
    filterDeptTreeByOperator,
    filterCascaderOptions,
    isTopAdmin,
    canManageUser,
    getDeptSupervisorIds,
    getEmployeeCandidates,
    findExistingUserForAssign,
    canAssignUserToDept
} = require('../utils/deptUser');

router.prefix('/depts');

function TreeDeptList(data) {
    const result = [];
    const map = {};

    data.forEach(item => {
        map[String(item._id)] = {
            ...item,
            children: []
        };
    });

    data.forEach(item => {
        const parentId = item.parentId ? item.parentId.slice().pop() : null;
        const parent = parentId ? map[String(parentId)] : null;

        if (parent) {
            parent.children.push(map[String(item._id)]);
        } else {
            result.push(map[String(item._id)]);
        }
    });

    return result;
}

async function syncEmployeeDept(userId2, deptDoc, parentId) {
    if (!userId2) return null;

    const userId = Number(userId2) || userId2;
    const deptPath = buildDeptPath(parentId || deptDoc.parentId || [], deptDoc._id);
    return User.findOneAndUpdate(
        { userId },
        { deptId: deptPath, state: 1 },
        { new: true }
    );
}

async function assignUserToDept(ctx, targetDeptId, user, operator) {
    const deptDoc = await Dept.findById(targetDeptId);
    if (!deptDoc) {
        ctx.body = utils.fail('', '部门不存在');
        return false;
    }

    const allDepts = await Dept.find({}).lean();
    if (operator && !isTopAdmin(operator)) {
        if (!canAssignUserToDept(operator, user, targetDeptId, allDepts)) {
            ctx.body = utils.fail('', '无权分配该员工');
            return false;
        }
    }

    const updated = await syncEmployeeDept(user.userId, deptDoc, deptDoc.parentId);
    if (!updated) {
        ctx.body = utils.fail('', '员工分配失败');
        return false;
    }
    ctx.body = utils.success('员工分配成功');
    return true;
}

router.get('/userOptions', async (ctx) => {
    const { scope, deptId, includeCurrent } = ctx.request.query;
    const authorization = ctx.request.header.authorization || ctx.request.headers.authorization;
    const operator = utils.decoded(authorization);

    try {
        const allUsers = await User.find({ state: 1 }, { userPwd: 0 }).lean();
        const allDepts = await Dept.find({}).lean();

        if (scope === 'supervisors') {
            const supervisorIds = getDeptSupervisorIds(allDepts);
            let list = allUsers.filter(u => supervisorIds.has(String(u.userId)));
            if (operator && !isTopAdmin(operator)) {
                list = list.filter(u => canManageUser(operator, u) || supervisorIds.has(String(u.userId)));
            }
            ctx.body = utils.success(list);
            return;
        }

        if (scope === 'employees' && deptId) {
            const deptDoc = allDepts.find(d => String(d._id) === String(deptId));
            const supervisorUserId = deptDoc?.userId || '';
            let list = getEmployeeCandidates(allUsers, deptId, allDepts, supervisorUserId, {
                includeCurrent: includeCurrent === '1' || includeCurrent === 'true'
            });
            if (operator && !isTopAdmin(operator)) {
                list = list.filter(u => canAssignUserToDept(operator, u, deptId, allDepts));
            }
            ctx.body = utils.success(list);
            return;
        }

        ctx.body = utils.fail('参数错误');
    } catch (error) {
        console.log('查询部门用户选项异常:', error);
        ctx.body = utils.fail('查询用户选项失败');
    }
});

router.get('/list', async (ctx) => {
    const { deptName } = ctx.request.query;
    const authorization = ctx.request.header.authorization || ctx.request.headers.authorization;
    const operator = utils.decoded(authorization);

    try {
        const params = {};
        if (deptName) params.deptName = { $regex: deptName };

        const rootList = await Dept.find(params).lean();
        const allUsers = await User.find({ state: 1 }).lean();
        let tree = TreeDeptList(JSON.parse(JSON.stringify(rootList)));

        enrichDeptTree(tree, allUsers);
        const cascaderSource = JSON.parse(JSON.stringify(tree));
        tree = filterDeptTreeByOperator(tree, operator);

        ctx.body = utils.success({
            list: tree,
            cascaderOptions: filterCascaderOptions(cascaderSource, operator)
        }, '查询成功');
    } catch (error) {
        console.log('查询部门列表异常:', error);
        ctx.body = utils.fail('查询部门列表异常');
    }
});

router.post('/operate', async (ctx) => {
    const body = ctx.request.body;
    let { deptName, active, _id, deptId, userId2, userName2, userEmail2 } = body;
    const params = { ...body };
    const authorization = ctx.request.header.authorization || ctx.request.headers.authorization;
    const operator = utils.decoded(authorization);

    try {
        if (deptId && deptId.length) {
            params.parentId = deptId;
        }
        delete params.deptId;

        if (active === 'create') {
            delete params._id;
            if (!deptName) {
                ctx.body = utils.fail('参数错误：部门名称不能为空');
                return;
            }

            const dept = await Dept.create(params);
            if (userId2) {
                await syncEmployeeDept(userId2, dept, params.parentId);
            }

            ctx.body = utils.success('部门创建成功');
            return;
        }

        if (active === 'add') {
            const targetDeptId = body._id;
            const trimmedName = String(deptName || '').trim();
            const trimmedUserName = String(userName2 || '').trim();
            const trimmedUserEmail = String(userEmail2 || '').trim();
            const trimmedUserId = String(userId2 || '').trim();

            if (!trimmedName && targetDeptId && userId2) {
                active = 'assignEmployee';
                _id = targetDeptId;
            } else if (!trimmedName && targetDeptId && (trimmedUserId || trimmedUserName || trimmedUserEmail)) {
                active = 'assignEmployeeManual';
                _id = targetDeptId;
                userName2 = trimmedUserName;
                userEmail2 = trimmedUserEmail;
                userId2 = trimmedUserId;
            } else if (!trimmedName) {
                ctx.body = utils.fail('请填写小组名称，或选择/输入要添加的员工');
                return;
            } else {
                delete params._id;
                const dept = await Dept.create(params);
                if (userId2) {
                    await syncEmployeeDept(userId2, dept, params.parentId);
                }
                ctx.body = utils.success('部门新增成功');
                return;
            }
        }

        if (active === 'assignEmployee') {
            const targetDeptId = body._id || _id;
            if (!targetDeptId || !userId2) {
                ctx.body = utils.fail('', '请选择员工');
                return;
            }
            const user = await User.findOne({ userId: Number(userId2) || userId2 }).lean();
            if (!user) {
                ctx.body = utils.fail('', '该用户不存在，请先在用户管理中创建', utils.CODE.NEED_CREATE_USER);
                return;
            }
            await assignUserToDept(ctx, targetDeptId, user, operator);
            return;
        }

        if (active === 'assignEmployeeManual') {
            const targetDeptId = body._id || _id;
            const trimmedUserId = String(userId2 || '').trim();
            const trimmedUserName = String(userName2 || '').trim();
            const trimmedUserEmail = String(userEmail2 || '').trim();

            if (!targetDeptId || (!trimmedUserId && !trimmedUserName && !trimmedUserEmail)) {
                ctx.body = utils.fail('请至少填写用户ID、用户名或邮箱');
                return;
            }

            const user = await findExistingUserForAssign(User, {
                userId2: trimmedUserId,
                userName2: trimmedUserName,
                userEmail2: trimmedUserEmail
            });
            if (!user) {
                ctx.body = utils.fail('', '未找到该用户，请先在用户管理中创建', utils.CODE.NEED_CREATE_USER);
                return;
            }

            await assignUserToDept(ctx, targetDeptId, user, operator);
            return;
        }

        if (active === 'createAndAssignEmployee') {
            ctx.body = utils.fail('', '部门管理不支持直接创建用户，请先在用户管理中创建', utils.CODE.NEED_CREATE_USER);
            return;
        }

        if (active === 'edit') {
            const deptDoc = await Dept.findById(_id);
            if (!deptDoc) {
                ctx.body = utils.fail('', '部门不存在');
                return;
            }

            await Dept.findOneAndUpdate({ _id }, {
                ...params,
                updateTime: new Date()
            });

            if (userId2) {
                await syncEmployeeDept(userId2, deptDoc, params.parentId || deptDoc.parentId);
            }

            ctx.body = utils.success('更新成功');
            return;
        }

        ctx.body = utils.fail('无效的操作类型');
    } catch (error) {
        console.log('部门操作异常:', error);
        ctx.body = utils.fail('部门操作异常');
    }
});

router.post('/delete', async (ctx) => {
    const { _id } = ctx.request.body;

    try {
        if (String(_id).startsWith('emp-')) {
            ctx.body = utils.fail('请使用移除员工接口');
            return;
        }

        await Dept.findByIdAndDelete(_id);
        await Dept.deleteMany({ parentId: { $all: [_id] } });
        ctx.body = utils.success('删除成功');
    } catch (error) {
        console.log('删除部门异常:', error);
        ctx.body = utils.fail('删除部门异常');
    }
});

router.post('/removeEmployee', async (ctx) => {
    const { userId, deptId } = ctx.request.body;
    const authorization = ctx.request.header.authorization || ctx.request.headers.authorization;
    const operator = utils.decoded(authorization);

    try {
        const user = await User.findOne({ userId });
        if (!user) {
            ctx.body = utils.fail('员工不存在');
            return;
        }

        if (operator && !isTopAdmin(operator)) {
            if (!canManageUser(operator, user)) {
                ctx.body = utils.fail('无权移除该员工');
                return;
            }
        }

        const deptDoc = await Dept.findById(deptId);
        if (!deptDoc) {
            ctx.body = utils.fail('', '部门不存在');
            return;
        }

        const userPath = normalizeIdList(user.deptId);
        const targetDeptStr = String(deptId);
        const parentPath = normalizeIdList(deptDoc.parentId);
        const idx = userPath.lastIndexOf(targetDeptStr);
        let newPath;
        if (idx >= 0) {
            newPath = userPath.slice(0, idx);
        } else {
            newPath = [...userPath];
        }
        if (parentPath.length && newPath.length < parentPath.length) {
            newPath = parentPath;
        }
        await User.findOneAndUpdate({ userId }, { deptId: newPath.length ? newPath : [] });
        ctx.body = utils.success('移除成功');
    } catch (error) {
        console.log('移除员工异常:', error);
        ctx.body = utils.fail('', '移除员工失败');
    }
});

router.post('/updateEmployee', async (ctx) => {
    const { userId, deptId, newUserId } = ctx.request.body;
    const authorization = ctx.request.header.authorization || ctx.request.headers.authorization;
    const operator = utils.decoded(authorization);

    try {
        const deptDoc = await Dept.findById(deptId);
        if (!deptDoc) {
            ctx.body = utils.fail('', '部门不存在');
            return;
        }

        const deptPath = buildDeptPath(deptDoc.parentId || [], deptDoc._id);
        const oldUser = await User.findOne({ userId });
        const newUser = await User.findOne({ userId: newUserId });

        if (!newUser) {
            ctx.body = utils.fail('新员工不存在');
            return;
        }

        if (operator && !isTopAdmin(operator)) {
            if (!canManageUser(operator, newUser) || (oldUser && !canManageUser(operator, oldUser))) {
                ctx.body = utils.fail('无权修改该员工');
                return;
            }
        }

        if (oldUser) {
            const parentPath = normalizeIdList(deptDoc.parentId);
            await User.findOneAndUpdate({ userId }, { deptId: parentPath.length ? parentPath : [] });
        }

        await User.findOneAndUpdate({ userId: newUserId }, { deptId: deptPath, state: 1 });
        ctx.body = utils.success('更新成功');
    } catch (error) {
        console.log('更新员工异常:', error);
        ctx.body = utils.fail('更新员工失败');
    }
});

module.exports = router;
