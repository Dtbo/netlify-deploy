/**
 * 部门与用户层级工具
 */

function normalizeIdList(list = []) {
    return list.map(item => String(item)).filter(id => id && id !== 'null');
}

function getDeptLevel(user) {
    return normalizeIdList(user?.deptId).length;
}

function isAdmin(user) {
    return parseInt(user?.role) === 0;
}

/** 公司级管理员（如青阳子），可管理全公司 */
function isTopAdmin(user) {
    return isAdmin(user) && getDeptLevel(user) <= 1;
}

/** 是否为任一部门主管（含公司级） */
function isDeptSupervisor(user, allDepts = []) {
    if (!user?.userId) return false;
    if (isTopAdmin(user)) return true;
    const uid = String(user.userId);
    return allDepts.some(dept => dept.userId && String(dept.userId) === uid);
}

/** 普通员工默认菜单权限 ID */
const DEFAULT_EMPLOYEE_MENU_IDS = [
    '646b04e1135377c10e122932', // 待审批休假（原审批休假）
    '6a190d6c09b415ead5a9f830', // 打卡管理
    '6474164baba7691462e778b2', // 上传图片
    '6a1979c0ea59ff67b605938b'  // 行驶轨迹
];

const DEFAULT_EMPLOYEE_PARENT_MENU_IDS = [
    '646b04b1135377c10e12292c', // 审批管理
    '646ada5030ed84e32b91c640'  // 总体管理
];

function getDefaultEmployeePermissionList() {
    const halfCheckKeys = [...DEFAULT_EMPLOYEE_PARENT_MENU_IDS];
    const checkedKeys = [...DEFAULT_EMPLOYEE_MENU_IDS];
    return {
        checkedKeys,
        halfCheckKeys,
        checkKeys: checkedKeys,
        halfCheckedKeys: halfCheckKeys
    };
}

/** 公司级权限管理员：仅青阳子（顶级管理员），可管理全公司主管及员工权限 */
function isCompanyPermissionAdmin(user) {
    return isTopAdmin(user);
}

function canManageRolePermission(operator) {
    return isTopAdmin(operator);
}

/** 是否为部门主管账号（在 dept.userId 中登记，不含仅 role=0 的非主管管理员） */
function isSupervisorAccount(user, allDepts = []) {
    if (!user?.userId) return false;
    return getDeptSupervisorIds(allDepts).has(String(user.userId));
}

/** 获取员工所属的主管 userId（沿部门路径向上找最近有主管的部门） */
function getEmployeeSupervisorId(target, allDepts = []) {
    const targetPath = normalizeIdList(target?.deptId);
    if (!targetPath.length) return null;

    for (let i = targetPath.length - 1; i >= 0; i--) {
        const dept = allDepts.find(item => String(item._id) === targetPath[i]);
        if (dept?.userId) {
            return String(dept.userId);
        }
    }
    return null;
}

/** 获取主管负责的部门及其下级部门 ID */
function getSupervisedDeptIds(user, allDepts = []) {
    if (isTopAdmin(user)) return null;

    const uid = String(user.userId);
    const ids = new Set(
        allDepts
            .filter(dept => dept.userId && String(dept.userId) === uid)
            .map(dept => String(dept._id))
    );

    if (!ids.size) return [];

    let changed = true;
    while (changed) {
        changed = false;
        allDepts.forEach(dept => {
            const deptId = String(dept._id);
            if (ids.has(deptId)) return;
            const parentPath = normalizeIdList(dept.parentId);
            if (parentPath.some(pid => ids.has(pid))) {
                ids.add(deptId);
                changed = true;
            }
        });
    }

    return [...ids];
}

/** 目标用户是否为该主管直属管理的普通员工 */
function isEmployeeUnderSupervisor(operator, target, allDepts = []) {
    if (!operator || !target) return false;
    if (isSupervisorAccount(target, allDepts)) return false;
    if (isTopAdmin(target)) return false;

    const supervisorId = getEmployeeSupervisorId(target, allDepts);
    return supervisorId === String(operator.userId);
}

/**
 * 是否可配置目标用户的操作权限
 * - 青阳子：可配置全公司人员（含 admin 等各部门主管）
 * - 其他部门主管（含 admin）：仅可配置自己直属部门的普通员工，不可改上级/其他主管
 */
function canManageEmployeePermission(operator, target, allDepts = []) {
    if (!operator || !target) return false;
    if (isTopAdmin(operator)) return true;
    if (!isDeptSupervisor(operator, allDepts)) return false;
    if (isTopAdmin(target) || isSupervisorAccount(target, allDepts)) return false;
    return isEmployeeUnderSupervisor(operator, target, allDepts);
}

/** 部门主管使用的菜单中需隐藏的全局权限管理项（角色页已改为员工权限，不再隐藏） */
const COMPANY_ONLY_MENU_PATHS = [];
const COMPANY_ONLY_MENU_COMPONENTS = [];

function filterMenusForOperator(menuList, user, allDepts = []) {
    if (isCompanyPermissionAdmin(user)) return menuList;

    const supervisor = isDeptSupervisor(user, allDepts);
    if (!supervisor) return menuList;

    const shouldHide = (item) => {
        const path = item.path || '';
        const component = item.component || '';
        return COMPANY_ONLY_MENU_PATHS.includes(path)
            || COMPANY_ONLY_MENU_COMPONENTS.includes(component);
    };

    const deepFilter = (nodes = []) => nodes.reduce((acc, item) => {
        if (shouldHide(item)) return acc;
        const children = item.children?.length ? deepFilter(item.children) : item.children;
        acc.push({ ...item, children });
        return acc;
    }, []);

    return deepFilter(menuList);
}

function toPermissionUserRow(user, allDepts = []) {
    return {
        userId: user.userId,
        userName: user.userName,
        userEmail: user.userEmail || '',
        job: user.job || '',
        permissionList: user.permissionList || {},
        isSupervisorAccount: isSupervisorAccount(user, allDepts)
    };
}

function matchUserQuery(user, userName, userId) {
    if (userId && String(user.userId) !== String(userId)) return false;
    if (userName && !(user.userName || '').includes(userName)) return false;
    return true;
}

/**
 * 构建员工权限管理树
 * - 青阳子：按部门主管分组下拉，可设置各主管及其下属员工
 * - 其他部门主管（含 admin）：平铺本部门员工（不含自己），不可见上级青阳子
 */
function buildPermissionManageTree(operator, allUsers, allDepts = [], filters = {}) {
    const { userName = '', userId = '' } = filters;
    const activeUsers = allUsers.filter(user => Number(user.state) === 1);

    if (isTopAdmin(operator)) {
        const supervisorIds = getDeptSupervisorIds(allDepts);
        const userMap = Object.fromEntries(
            activeUsers.map(user => [String(user.userId), user])
        );

        const supervisorDeptNames = {};
        allDepts.forEach(dept => {
            if (!dept.userId) return;
            const uid = String(dept.userId);
            if (!supervisorDeptNames[uid]) supervisorDeptNames[uid] = [];
            if (dept.deptName) supervisorDeptNames[uid].push(dept.deptName);
        });

        const groups = [];

        supervisorIds.forEach(supervisorId => {
            const supervisor = userMap[supervisorId];
            if (!supervisor) return;

            const employees = activeUsers
                .filter(user => {
                    if (String(user.userId) === supervisorId) return false;
                    if (isSupervisorAccount(user, allDepts)) return false;
                    if (isTopAdmin(user)) return false;
                    return getEmployeeSupervisorId(user, allDepts) === supervisorId;
                })
                .map(user => toPermissionUserRow(user, allDepts));

            const supervisorMatch = matchUserQuery(supervisor, userName, userId);
            let displayEmployees = employees;

            if (userName || userId) {
                const matchedEmployees = employees.filter(user =>
                    matchUserQuery(user, userName, userId)
                );
                if (!supervisorMatch && !matchedEmployees.length) return;
                displayEmployees = supervisorMatch ? employees : matchedEmployees;
            }

            groups.push({
                ...toPermissionUserRow(supervisor, allDepts),
                isSupervisorAccount: true,
                deptNames: supervisorDeptNames[supervisorId] || [],
                deptLabel: (supervisorDeptNames[supervisorId] || []).join('、') || '未分配部门',
                employees: displayEmployees
            });
        });

        groups.sort((a, b) => String(a.userName).localeCompare(String(b.userName), 'zh-CN'));

        return {
            mode: 'supervisor',
            groups
        };
    }

    if (!isDeptSupervisor(operator, allDepts)) {
        return { mode: 'flat', employees: [] };
    }

    const employees = activeUsers
        .filter(user => String(user.userId) !== String(operator.userId))
        .filter(user => isEmployeeUnderSupervisor(operator, user, allDepts))
        .filter(user => matchUserQuery(user, userName, userId))
        .map(user => toPermissionUserRow(user, allDepts));

    return {
        mode: 'flat',
        employees
    };
}

function isInDeptSubtree(operator, targetDeptPath) {
    const opPath = normalizeIdList(operator?.deptId);
    const targetPath = normalizeIdList(targetDeptPath);
    if (!opPath.length || !targetPath.length) return false;
    return targetPath.length >= opPath.length && opPath.every((id, index) => id === targetPath[index]);
}

function canManageUser(operator, target) {
    if (!operator || !target) return false;
    if (isTopAdmin(operator)) return true;

    if (isAdmin(operator)) {
        return isInDeptSubtree(operator, target.deptId);
    }

    const opPath = normalizeIdList(operator.deptId);
    const targetPath = normalizeIdList(target.deptId);

    if (!opPath.length || !targetPath.length) return false;
    if (targetPath.length <= opPath.length) return false;

    return opPath.every((id, index) => id === targetPath[index]);
}

function buildDeptPath(parentId = [], deptId) {
    const path = normalizeIdList(parentId);
    if (deptId) {
        path.push(String(deptId));
    }
    return path;
}

/** 仅获取直属本部门的人员（deptId 路径最后一级等于当前部门） */
function getUsersInDept(allUsers, deptId, supervisorUserId) {
    const deptIdStr = String(deptId);
    const members = allUsers.filter(user => {
        const ids = normalizeIdList(user.deptId);
        return ids.length > 0 && ids[ids.length - 1] === deptIdStr;
    });

    const employees = members.filter(user => String(user.userId) !== String(supervisorUserId));

    return {
        members,
        employees,
        employeeNames: employees.map(item => item.userName).filter(Boolean).join('、'),
        employeeEmails: employees.map(item => item.userEmail).filter(Boolean).join('、')
    };
}

function isRootDeptNode(dept) {
    const parentIds = normalizeIdList(dept.parentId);
    return parentIds.length === 0;
}

function stripEmployeeNodes(tree) {
    return tree
        .filter(node => !node.isEmployee)
        .map(node => ({
            ...node,
            children: node.children?.length ? stripEmployeeNodes(node.children.filter(child => !child.isEmployee)) : []
        }));
}

function filterCascaderOptions(tree, operator) {
    const deptTree = stripEmployeeNodes(JSON.parse(JSON.stringify(tree)));

    if (!operator || isTopAdmin(operator)) {
        return deptTree;
    }

    const opPath = normalizeIdList(operator.deptId);
    if (!opPath.length) {
        return deptTree;
    }

    const targetId = opPath[opPath.length - 1];

    const findNode = (nodes) => {
        for (const node of nodes) {
            if (String(node._id) === targetId) {
                return [{ ...node }];
            }
            if (node.children?.length) {
                const found = findNode(node.children);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    };

    return findNode(deptTree) || [];
}

function enrichDeptTree(tree, allUsers) {
    tree.forEach(dept => {
        const deptChildren = (dept.children || []).filter(child => !child.isEmployee);
        if (deptChildren.length) {
            enrichDeptTree(deptChildren, allUsers);
        }

        const rootDept = isRootDeptNode(dept);
        const hasChildDepts = deptChildren.length > 0;
        const { employees } = hasChildDepts && !rootDept
            ? { employees: [] }
            : getUsersInDept(allUsers, dept._id, dept.userId);

        if (!rootDept && employees.length) {
            dept.userName2 = `${employees.length}人`;
            dept.userEmail2 = '展开查看';

            const employeeNodes = employees.map(emp => ({
                _id: `emp-${emp.userId}-${dept._id}`,
                deptName: '',
                userName: '',
                userEmail: '',
                userName2: emp.userName,
                userEmail2: emp.userEmail || '',
                userId: emp.userId,
                parentDeptId: String(dept._id),
                parentId: buildDeptPath(dept.parentId || [], dept._id),
                isEmployee: true,
                children: []
            }));

            dept.children = [...deptChildren, ...employeeNodes];
        } else {
            dept.userName2 = '';
            dept.userEmail2 = '';
            dept.userId2 = '';
            dept.children = deptChildren;
        }
    });
}

function filterDeptTreeByOperator(tree, operator) {
    if (!operator || isTopAdmin(operator)) {
        return tree;
    }

    const opPath = normalizeIdList(operator.deptId);
    if (!opPath.length) {
        return tree;
    }

    const targetId = opPath[opPath.length - 1];

    const findNode = (nodes) => {
        for (const node of nodes) {
            if (String(node._id) === targetId) {
                return [node];
            }
            if (node.children?.length) {
                const deptChildren = node.children.filter(child => !child.isEmployee);
                const found = findNode(deptChildren);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    };

    return findNode(tree) || [];
}

function canAssignUserToDept(operator, targetUser, targetDeptId, allDepts) {
    if (!operator || !targetUser || !targetDeptId) return false;
    if (isTopAdmin(operator)) return true;

    const targetDept = allDepts.find(d => String(d._id) === String(targetDeptId));
    if (!targetDept) return false;

    const deptPath = buildDeptPath(targetDept.parentId || [], targetDept._id);
    if (!isInDeptSubtree(operator, deptPath)) return false;

    const supervisorUserId = targetDept.userId || '';
    const eligible = getEmployeeCandidates([targetUser], targetDeptId, allDepts, supervisorUserId, {
        includeCurrent: true
    });
    return eligible.length > 0;
}

/**
 * 用户管理页：是否可对该用户增删改
 * - 青阳子：全公司
 * - 部门主管（含 admin）：本部门及下级部门的非主管员工
 */
function canManageUserInUserAdmin(operator, target, allDepts = []) {
    if (!operator || !target) return false;
    if (isTopAdmin(operator)) return true;
    if (String(operator.userId) === String(target.userId)) return true;
    if (isTopAdmin(target)) return false;
    if (isSupervisorAccount(target, allDepts)) return false;

    if (isDeptSupervisor(operator, allDepts)) {
        const targetPath = normalizeIdList(target.deptId);
        if (!targetPath.length) return false;
        return isInDeptSubtree(operator, target.deptId);
    }

    return canManageUser(operator, target);
}

/** 是否可在用户管理页新增/管理本部门人员（含 admin 等技术部主管） */
function canManageDeptUsers(operator, allDepts = []) {
    return isTopAdmin(operator) || isDeptSupervisor(operator, allDepts);
}

function getDeptSupervisorIds(allDepts) {
    return new Set(
        allDepts
            .map(dept => dept.userId)
            .filter(Boolean)
            .map(id => String(id))
    );
}

/** 获取可分配为员工的候选用户（含从本部门移除后、位于上级或未分配的人员） */
function getEmployeeCandidates(allUsers, targetDeptId, allDepts, supervisorUserId, options = {}) {
    const { includeCurrent = false } = options;
    const targetDept = allDepts.find(d => String(d._id) === String(targetDeptId));
    if (!targetDept) return [];

    const targetPath = buildDeptPath(targetDept.parentId || [], targetDept._id);
    const targetIdStr = String(targetDeptId);
    const supervisorIds = getDeptSupervisorIds(allDepts);

    return allUsers.filter(user => {
        if (supervisorUserId && String(user.userId) === String(supervisorUserId)) return false;
        if (supervisorIds.has(String(user.userId))) return false;

        const userPath = normalizeIdList(user.deptId);

        if (userPath.length && userPath[userPath.length - 1] === targetIdStr) {
            return includeCurrent;
        }

        if (userPath.length > targetPath.length
            && targetPath.every((id, index) => userPath[index] === id)) {
            return false;
        }

        if (!userPath.length) return true;
        if (userPath.length < targetPath.length
            && userPath.every((id, index) => targetPath[index] === id)) {
            return true;
        }

        return false;
    });
}

/** 按 userId / 用户名 / 邮箱查找已有用户（部门分配用，不创建新用户） */
async function findExistingUserForAssign(User, { userId2, userName2, userEmail2 }) {
    const idStr = String(userId2 || '').trim();
    const nameStr = String(userName2 || '').trim();
    const emailStr = String(userEmail2 || '').trim();

    let user = null;
    if (idStr) {
        user = await User.findOne({ userId: Number(idStr) || idStr }).lean();
    }
    if (!user && emailStr) {
        user = await User.findOne({ userEmail: emailStr }).lean();
    }
    if (!user && nameStr) {
        user = await User.findOne({ userName: nameStr }).lean();
    }
    if (!user) return null;

    if (idStr && String(user.userId) !== idStr) return null;
    if (emailStr && user.userEmail !== emailStr) return null;
    if (nameStr && user.userName !== nameStr) return null;

    return user;
}

module.exports = {
    normalizeIdList,
    getDeptLevel,
    isAdmin,
    isTopAdmin,
    isDeptSupervisor,
    isCompanyPermissionAdmin,
    canManageRolePermission,
    isSupervisorAccount,
    getEmployeeSupervisorId,
    getSupervisedDeptIds,
    isEmployeeUnderSupervisor,
    canManageEmployeePermission,
    filterMenusForOperator,
    buildPermissionManageTree,
    toPermissionUserRow,
    getDefaultEmployeePermissionList,
    DEFAULT_EMPLOYEE_MENU_IDS,
    DEFAULT_EMPLOYEE_PARENT_MENU_IDS,
    isRootDeptNode,
    isInDeptSubtree,
    canManageUser,
    buildDeptPath,
    getUsersInDept,
    enrichDeptTree,
    filterDeptTreeByOperator,
    stripEmployeeNodes,
    filterCascaderOptions,
    getDeptSupervisorIds,
    getEmployeeCandidates,
    findExistingUserForAssign,
    canAssignUserToDept,
    canManageUserInUserAdmin,
    canManageDeptUsers
};
