/**
 * 用户管理路由模块
 * 处理用户登录、权限查询、用户列表等所有 API 请求
 * @author Lee
 */

// 引入 koa-router 模块
const router = require('koa-router')();

// 引入 jsonwebtoken 模块
var jwt = require('jsonwebtoken');

// 引入用户模型
const User = require('../model/userSchema.js');

// 引入菜单模型
const Menu = require('../model/menuSchema.js');

// 引入角色模型
const Role = require('../model/roleSchema.js');

const { getNextUserId } = require('../utils/userId');

// 引入工具函数模块
const utils = require('../utils/utils.js');

// 引入 Token 工具模块
const { setAccessToken, setRefreshToken, secret } = require('../utils/token');

// 引入验证码模块
var svgCaptcha = require('svg-captcha');

// 引入 Excel 导出模块
const excel = require("./../utils/excel");
const { isAdmin, isTopAdmin, canManageUser, isDeptSupervisor, canManageEmployeePermission, isSupervisorAccount, isCompanyPermissionAdmin, filterMenusForOperator, buildPermissionManageTree, getDefaultEmployeePermissionList, DEFAULT_EMPLOYEE_MENU_IDS, DEFAULT_EMPLOYEE_PARENT_MENU_IDS, canManageUserInUserAdmin, canManageDeptUsers, normalizeIdList, isInDeptSubtree } = require('../utils/deptUser');
const Dept = require('../model/deptSchema');

// 设置路由前缀
router.prefix('/users');

/**
 * 【用户登录接口】POST /api/users/login
 * 
 * 作用：验证用户身份，生成登录凭证（Token）
 * 
 * 流程：
 * 1. 接收前端传来的用户名(userName)、密码(userPwd)和验证码(captcha)
 * 2. 验证验证码是否正确（不区分大小写）
 * 3. 根据用户名和密码查询用户（不返回密码字段）
 * 4. 如果验证码正确且查询到用户：
 *    - 生成 AccessToken（有效期10小时）
 *    - 生成 RefreshToken（有效期20小时）
 *    - 将两个Token附加到用户数据中
 *    - 返回成功结果（包含用户信息和Token）
 * 5. 如果验证码错误或用户不存在：返回"账号密码或验证码错误"
 * 
 * @param {string} userName - 用户名
 * @param {string} userPwd - 密码
 * @param {string} captcha - 验证码
 * @returns {Object} - { data: 用户信息+Token | '账号密码或验证码错误', msg: 'ok', code: 200 }
 */
router.post('/login', async (ctx) => {
    var { userName, userPwd, captcha } = ctx.request.body;
    
    try {
        if (!userName || !userPwd) {
            ctx.body = utils.success({ data: '账号密码或验证码错误', msg: 'ok', code: 200 });
            return;
        }

        if (!captcha || !ctx.session?.picCode) {
            ctx.body = utils.success({ data: '账号密码或验证码错误', msg: 'ok', code: 200 });
            return;
        }

        if (captcha.toLowerCase() !== ctx.session.picCode.toLowerCase()) {
            ctx.body = utils.success({ data: '账号密码或验证码错误', msg: 'ok', code: 200 });
            return;
        }

        let res = await User.findOne({ userName });

        if (!res || !res.userPwd || res.userPwd !== userPwd) {
            ctx.body = utils.success({ data: '账号密码或验证码错误', msg: 'ok', code: 200 });
            return;
        }

        if (Number(res.state) !== 1) {
            ctx.body = utils.success({ data: '账号已停用，请联系管理员', msg: 'ok', code: 200 });
            return;
        }

        let data = res._doc;
        data.userPwd = undefined;

        let accessToken = setAccessToken(data);
        let refreshToken = setRefreshToken(data);

        data.token = accessToken;
        data.refreshToken = refreshToken;

        ctx.body = utils.success({ data: data, msg: 'ok', code: 200 });
    } catch (error) {
        console.log('登录异常:', error);
        ctx.body = utils.fail('登录失败，请稍后重试');
    }
});

/**
 * 【刷新Token接口】GET /api/users/refresh
 * 
 * 作用：当AccessToken快过期时，解析RefreshToken获取用户信息，用于获取新Token
 * 
 * 流程：
 * 1. 从请求头中获取Authorization字段（里面包含RefreshToken）
 * 2. 调用工具函数解析Token，提取用户信息
 * 3. 返回解析后的用户信息
 * 
 * 说明：前端会用这个接口获取新的AccessToken，避免用户重新登录
 * 
 * @param {string} Authorization - 请求头中的RefreshToken
 * @returns {Object} - { data: 用户信息对象, msg: 'ok', code: 200 }
 */
router.get('/refresh', (ctx) => {
    // 初始化变量
    let code, msg, data = null;
    
    // 获取请求头中的 Authorization 字段
    const authorization = ctx.request.header.authorization;
    
    // 解析 Token 获取用户信息
    let token = utils.decoded(authorization);
    
    // 返回解析结果
    ctx.body = utils.success(token);
});

/**
 * 【获取用户权限接口】GET /api/users/permissionlist
 * 
 * 作用：根据用户角色，返回该用户能访问的菜单和按钮权限
 * 
 * 流程：
 * 1. 从请求头中获取AccessToken
 * 2. 解析Token得到用户信息（包含角色类型和角色ID列表）
 * 3. 调用getMenuList()获取用户能看到的菜单列表
 * 4. 调用getActionList()从菜单中提取按钮权限列表
 * 5. 返回菜单列表和按钮权限列表
 * 
 * 说明：菜单列表用于渲染左侧导航，按钮权限用于控制页面上哪些按钮可以点击
 * 
 * @param {string} Authorization - 请求头中的AccessToken
 * @returns {Object} - { data: { menuList: 菜单列表, actionList: 按钮权限列表 }, msg: 'ok', code: 200 }
 */
router.get('/permissionlist', async (ctx) => {
    // 获取请求头中的 Authorization 字段
    const authorization = ctx.request.header.authorization;
    
    // 解析 Token 获取用户信息
    let data = utils.decoded(authorization);
    
    console.log('用户信息:', data);
    
    try {
        const allDepts = await Dept.find({}).lean();
        const operatorIsDeptSupervisor = isDeptSupervisor(data, allDepts);
        const userDoc = await User.findOne({ userId: data.userId }, { userPwd: 0 }).lean();

        let menuList = await getMenuList(data.role, data.roleList, userDoc || data, allDepts);
        let actionList = getActionList(JSON.parse(JSON.stringify(menuList)));

        ctx.body = utils.success({
            data: {
                menuList,
                actionList,
                isTopAdmin: isTopAdmin(data),
                isAdmin: isAdmin(data),
                isDeptSupervisor: operatorIsDeptSupervisor,
                canManageAllPermissions: isCompanyPermissionAdmin(data),
                canManageDeptUsers: canManageDeptUsers(data, allDepts)
            },
            msg: 'ok',
            code: 200
        });
    } catch (error) {
        // 捕获异常并输出日志
        console.log('获取权限列表异常:', error);
    }
});

/**
 * 【提取按钮权限】getActionList(menuList)
 * 
 * 作用：从树形菜单中找出所有按钮的权限编码，用于控制按钮是否可用
 * 
 * 流程：
 * 1. 创建一个空数组用于存放按钮权限码
 * 2. 使用深度优先遍历菜单树：
 *    - 如果是一级菜单（有子菜单且有action属性）：继续往下遍历子菜单
 *    - 如果是二级菜单（有子菜单但没有action属性）：收集子菜单的menuCode
 * 3. 返回收集到的所有按钮权限码数组
 * 
 * 说明：按钮权限码就是菜单中的menuCode字段，前端用它来判断用户是否有权限点击某个按钮
 * 
 * @param {Array} menuList - 树形结构的菜单列表
 * @returns {Array} - 按钮权限编码数组（如 ['btn_add', 'btn_edit', 'btn_delete']）
 */
function getActionList(menuList) {
    const actionSet = new Set();
    const walk = (nodes = []) => {
        nodes.forEach(item => {
            if (Number(item.menuType) === 2 && item.menuCode) {
                actionSet.add(item.menuCode);
            }
            if (item.children?.length) walk(item.children);
        });
    };
    walk(menuList);
    return [...actionSet];
}

/**
 * 【获取用户菜单】getMenuList(userRole, roleKeys)
 * 
 * 作用：根据用户角色类型和角色ID列表，返回该用户能访问的菜单列表
 * 
 * 流程：
 * 1. 如果是管理员（userRole=0）：
 *    - 直接获取数据库中所有菜单
 * 2. 如果是普通用户：
 *    - 根据角色ID列表查询对应的角色信息
 *    - 从角色信息中提取所有权限ID（checkKeys和halfCheckKeys）
 *    - 去重权限ID
 *    - 根据权限ID查询对应的菜单
 * 3. 将扁平的菜单数据转换为树形结构
 * 4. 返回树形菜单列表
 * 
 * 说明：管理员拥有所有权限，普通用户只能看到自己角色对应的菜单
 * 
 * @param {number} userRole - 用户角色类型（0：管理员，1：普通用户）
 * @param {Array} roleKeys - 用户所属角色的ID数组
 * @returns {Array} - 树形结构的菜单列表（包含一级菜单和子菜单）
 */
async function getMenuList(userRole, roleKeys, user, allDepts = []) {
    let rootList = [];

    console.log('=== 获取菜单权限 ===');
    console.log('用户角色:', userRole, '类型:', typeof userRole);
    console.log('角色列表:', roleKeys);

    const roleNum = parseInt(userRole);
    const supervisor = isDeptSupervisor(user, allDepts);

    if (roleNum === 0 || supervisor) {
        rootList = await Menu.find({}).lean() || [];
        console.log('管理员/部门主管，获取所有菜单:', rootList.length, '条');
    } else {
        console.log('普通用户，根据角色列表查询权限');

        const userPerm = user?.permissionList;
        const checkKeys = userPerm?.checkKeys || userPerm?.checkedKeys || [];
        const halfCheckKeys = userPerm?.halfCheckKeys || userPerm?.halfCheckedKeys || [];
        const hasUserPerm = checkKeys.length > 0 || halfCheckKeys.length > 0;

        if (hasUserPerm) {
            const permissionList = [...new Set([...checkKeys, ...halfCheckKeys])];
            rootList = await Menu.find({ _id: { $in: permissionList } }).lean();
            console.log('使用用户个人权限，菜单:', rootList.length, '条');
        } else if (!roleKeys || roleKeys.length === 0) {
            console.log('警告：普通用户没有角色列表，使用默认员工权限');
            rootList = await Menu.find({
                _id: { $in: [...DEFAULT_EMPLOYEE_PARENT_MENU_IDS, ...DEFAULT_EMPLOYEE_MENU_IDS] }
            }).lean();
        } else {
            let roleList = await Role.find({ _id: { $in: roleKeys } });
            console.log('查询到角色:', roleList.length, '个');

            let permissionList = [];

            roleList.map(role => {
                const pl = role.permissionList || {};
                const checkKeys = pl.checkKeys || pl.checkedKeys || [];
                const halfCheckKeys = pl.halfCheckKeys || pl.halfCheckedKeys || [];
                permissionList = permissionList.concat([...checkKeys, ...halfCheckKeys]);
            });

            permissionList = [...new Set(permissionList)];
            console.log('合并去重后权限数量:', permissionList.length);

            if (permissionList.length === 0) {
                console.log('角色未配置权限，使用默认员工权限');
                rootList = await Menu.find({
                    _id: { $in: [...DEFAULT_EMPLOYEE_PARENT_MENU_IDS, ...DEFAULT_EMPLOYEE_MENU_IDS] }
                }).lean();
            } else {
                rootList = await Menu.find({ _id: { $in: permissionList } }).lean();
                console.log('查询到菜单:', rootList.length, '条');
            }
        }
    }

    const treeMenu = utils.TreeMenuList(rootList);
    const filtered = filterMenusForOperator(treeMenu, user, allDepts);
    console.log('转换为树形结构后:', filtered.length, '个一级菜单');

    return filtered;
}

/**
 * 【用户列表查询】GET /api/users/list
 * 
 * 作用：查询用户列表，支持条件筛选和分页
 * 
 * 流程：
 * 1. 接收查询参数：userId、userName、state、type、currentPage、pageSize
 * 2. 解析分页参数（计算跳过的条数）
 * 3. 构建查询条件：
 *    - 如果有userId：按用户ID查询
 *    - 如果有userName：按用户名查询
 *    - 如果有state且不为0：按状态查询（1在职/2离职）
 * 4. 执行数据库查询（不返回_id和密码）
 * 5. 计算总数
 * 6. 返回分页结果（列表+总数）
 * 7. 特殊情况：如果type='dept'（部门管理页面调用），不分页返回在职用户
 * 
 * 说明：用户列表用于用户管理页面展示，支持搜索和分页功能
 * 
 * @param {number} userId - 用户ID（可选）
 * @param {string} userName - 用户名（可选）
 * @param {number} state - 用户状态（0：全部，1：在职，2：离职）
 * @param {string} type - 查询类型（'dept'：部门管理页面调用）
 * @param {number} currentPage - 当前页码
 * @param {number} pageSize - 每页条数
 * @returns {Object} - { data: { list: 用户列表, total: 总数 }, msg: 'ok', code: 200 }
 */
router.get('/list', async (ctx) => {
    var { userId, userName, state, type } = ctx.request.query;
    const authorization = ctx.request.header.authorization || ctx.request.headers.authorization;
    const operator = utils.decoded(authorization);

    const { page, skipIndex } = utils.pager(ctx.request.query);

    try {
        let params = {};
        if (userId) params.userId = userId;
        if (userName) params.userName = userName;
        if (state && state != 0) params.state = state;

        if (type == 'dept') {
            if (state && state == 1) {
                params.state = state;
                let res = await User.find(params, { userPwd: 0 }).lean();
                if (operator && !isTopAdmin(operator)) {
                    res = res.filter(user => canManageUser(operator, user) || String(user.userId) === String(operator.userId));
                }
                ctx.body = utils.success(res);
            } else {
                ctx.body = utils.fail('查询错误');
            }
            return;
        }

        let allUsers = await User.find(params, { userPwd: 0 }).lean();
        const allDepts = await Dept.find({}).lean();

        if (operator && isTopAdmin(operator)) {
            // 青阳子可见全部用户
        } else if (operator) {
            allUsers = allUsers.filter(user =>
                canManageUserInUserAdmin(operator, user, allDepts)
            );
        }

        const list = allUsers.slice(skipIndex, skipIndex + page.pagesize).map(user => ({
            ...user,
            isSupervisorAccount: isSupervisorAccount(user, allDepts)
        }));
        const total = allUsers.length;

        ctx.body = utils.success({ list, total });
    } catch (error) {
        console.log('查询用户列表异常:', error);
        ctx.body = utils.fail('查询用户列表失败');
    }
});

/**
 * 【用户新增/编辑】POST /api/users/operate
 * 
 * 作用：创建新用户或修改现有用户信息
 * 
 * 流程（新增 active='add'）：
 * 1. 验证必填项：用户名和手机号不能为空
 * 2. 检查手机号和邮箱是否已存在（防止重复）
 * 3. 获取自增的用户ID（从计数器中获取下一个ID）
 * 4. 创建用户对象（初始密码为123456）
 * 5. 保存到数据库
 * 6. 返回"新增成功"
 * 
 * 流程（编辑）：
 * 1. 根据用户ID查询用户
 * 2. 更新用户信息（用户名、邮箱、手机号、状态、职位、角色、部门）
 * 3. 保存到数据库
 * 4. 返回"更新成功"
 * 
 * 说明：新增用户时密码默认为123456，用户首次登录后应修改密码
 * 
 * @param {number} userId - 用户ID（编辑时必填）
 * @param {string} userName - 用户名（必填）
 * @param {string} userEmail - 用户邮箱
 * @param {number} mobile - 用户手机号（必填）
 * @param {number} state - 用户状态（1：在职，2：离职）
 * @param {string} job - 用户职位
 * @param {Array} roleList - 用户所属角色ID列表
 * @param {Array} deptId - 用户所属部门ID列表
 * @param {string} active - 操作类型（'add'：新增，其他：编辑）
 * @returns {Object} - { data: '新增成功' | '更新成功', msg: 'ok', code: 200 }
 */
/**
 * 【用户新增/编辑接口】POST /api/users/operate
 * @description 处理用户的新增和编辑操作
 * @param {Object} ctx - Koa 上下文对象，包含请求和响应信息
 */
router.post('/operate', async (ctx) => {
    let { userId, userName, userEmail, mobile, state, job, roleList, deptId, active } = ctx.request.body;
    const authorization = ctx.request.header.authorization || ctx.request.headers.authorization;
    const operator = utils.decoded(authorization);
    
    try {
        const allDepts = await Dept.find({}).lean();

        if (active === 'add') {
            if (operator && !canManageDeptUsers(operator, allDepts)) {
                ctx.body = utils.fail('无权新增用户');
                return;
            }

            // 3. 必填参数校验：用户名和手机号不能为空
            if (!userName || !mobile) {
                ctx.body = utils.fail('参数错误：用户名和手机号不能为空');
                return;  // 终止后续执行
            }

            if (operator && isDeptSupervisor(operator, allDepts) && !isTopAdmin(operator)) {
                if (deptId && deptId.length && !isInDeptSubtree(operator, deptId)) {
                    ctx.body = utils.fail('只能在本部门及下级部门创建用户');
                    return;
                }
                if (!deptId || !deptId.length) {
                    deptId = normalizeIdList(operator.deptId);
                }
                const defaultRole = await Role.findOne({ roleName: '普通员工' });
                roleList = defaultRole ? [String(defaultRole._id)] : [];
            }
            
            // 4. 重复数据检查：防止相同手机号或邮箱重复注册
            // 构建查询条件数组，先添加手机号检查
            let query = [{ mobile }];
            // 如果邮箱不为空，添加邮箱检查（空邮箱不参与重复校验）
            if (userEmail && userEmail.trim()) {
                query.push({ userEmail });
            }
            // 使用 $or 操作符查询是否存在重复记录
            let existUser = await User.findOne({ $or: query }, '_id userName userEmail mobile');
            
            // 5. 如果存在重复记录，返回错误信息
            if (existUser) {
                // 精确判断是手机号重复还是邮箱重复
                let errMsg = existUser.mobile == mobile 
                    ? `手机号 ${mobile} 已被使用` 
                    : `邮箱 ${userEmail} 已被使用`;
                ctx.body = utils.fail(errMsg);
                return;  // 终止后续执行
            }
            
            const newUserId = await getNextUserId();

            let finalRoleList = roleList || [];
            if (!finalRoleList.length) {
                const defaultRole = await Role.findOne({ roleName: '普通员工' });
                if (defaultRole) {
                    finalRoleList = [String(defaultRole._id)];
                }
            }

            let newUser = new User({
                userId: newUserId,
                userName: userName,
                userPwd: '123456',
                userEmail: userEmail || '',
                mobile: mobile,
                state: 1,
                role: 1,
                roleList: finalRoleList,
                job: job || '',
                deptId: deptId || [],
                permissionList: getDefaultEmployeePermissionList()
            });
            
            // 9. 保存用户到数据库
            await newUser.save();
            
            ctx.body = utils.success('新增成功');
        } 
        else {
            const targetUser = await User.findOne({ userId });
            if (!targetUser) {
                ctx.body = utils.fail('用户不存在');
                return;
            }

            const allDepts = await Dept.find({}).lean();

            if (operator && !canManageUserInUserAdmin(operator, targetUser, allDepts)) {
                ctx.body = utils.fail('无权修改该用户信息');
                return;
            }

            if (operator && !isTopAdmin(operator) && isSupervisorAccount(targetUser, allDepts)
                && String(operator.userId) !== String(targetUser.userId)) {
                ctx.body = utils.fail('无权修改部门主管信息，请联系青阳子');
                return;
            }

            const updateData = { userName, userEmail, mobile, state, job };

            if (isCompanyPermissionAdmin(operator)) {
                updateData.roleList = roleList;
                updateData.deptId = deptId;
            }

            await User.findOneAndUpdate({ userId }, updateData);
            
            ctx.body = utils.success('更新成功');
        }
    } 
    // 14. 异常处理：捕获数据库操作或其他运行时错误
    catch (error) {
        // 输出错误日志（生产环境可配置日志级别）
        console.error('用户操作异常:', error);
        // 返回统一错误响应
        ctx.body = utils.fail('操作失败，服务器内部错误');
    }
});

/**
 * 【用户删除】POST /api/users/delete
 * 
 * 作用：批量删除用户（软删除，标记为离职状态）
 * 
 * 流程：
 * 1. 接收要删除的用户ID数组
 * 2. 执行批量更新操作，将这些用户的状态改为离职（state=2）
 * 3. 获取实际修改的记录数
 * 4. 返回删除结果（如"删除成功3条"）
 * 
 * 说明：这是软删除，用户数据不会真正删除，只是标记为离职状态，便于后续恢复或审计
 * 
 * @param {Array} userIds - 要删除的用户ID数组
 * @returns {Object} - { data: '删除成功N条', msg: 'ok', code: 200 }
 */
router.post('/delete', async (ctx) => {
    var { userIds } = ctx.request.body;
    const authorization = ctx.request.header.authorization || ctx.request.headers.authorization;
    const operator = utils.decoded(authorization);

    try {
        const ids = Array.isArray(userIds) ? userIds : [userIds];
        const allDepts = await Dept.find({}).lean();
        const targets = await User.find({ userId: { $in: ids } }).lean();

        if (operator) {
            for (const target of targets) {
                if (!canManageUserInUserAdmin(operator, target, allDepts)) {
                    ctx.body = utils.fail('无权删除该用户');
                    return;
                }
            }
        }

        let { modifiedCount } = await User.updateMany(
            { userId: { $in: ids } },
            { state: 2 }
        );
        
        console.log('删除数量:', modifiedCount);
        
        // 返回删除结果
        ctx.body = utils.success(`删除成功${modifiedCount}条`);
    } catch (error) {
        // 捕获异常并输出日志
        console.log('删除用户异常:', error);
    }
});

/**
 * 【Excel导出接口】POST /api/users/excel
 * 
 * 作用：导出所有用户数据为 Excel 文件
 * 
 * 流程：
 * 1. 查询数据库中所有用户（不返回 _id 和密码）
 * 2. 将查询结果转换为 JSON 格式
 * 3. 调用 excel.exportExcel() 生成 Excel 文件的 Buffer
 * 4. 返回 Excel 文件的 Buffer 数据
 * 
 * 说明：前端收到数据后可以下载为 Excel 文件
 * 
 * @returns {Object} - { data: Excel文件Buffer, msg: 'ok', code: 200 }
 */
/**
 * 格式化用户数据为 Excel 导出行
 */
function formatUserExportRow(user) {
    const stateMap = { 1: '在职', 2: '离职', 3: '试用期' };
    const roleMap = { 0: '管理员', 1: '普通用户' };
    const fmtDate = (val) => {
        if (!val) return '';
        const d = new Date(val);
        return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('zh-CN', { hour12: false });
    };

    return {
        '用户ID': user.userId ?? '',
        '用户名称': user.userName || '',
        '邮箱': user.userEmail || '',
        '手机号': user.mobile ?? '',
        '岗位': user.job || '',
        '角色': roleMap[user.role] ?? user.role ?? '',
        '状态': stateMap[user.state] ?? user.state ?? '',
        '注册时间': fmtDate(user.createTime),
        '最后登录时间': fmtDate(user.lastLoginTime)
    };
}

router.post('/excel', async (ctx) => {
    const authorization = ctx.request.header.authorization || ctx.request.headers.authorization;
    const operator = utils.decoded(authorization);
    const { userId, userName, state } = ctx.request.body || {};

    try {
        const allDepts = await Dept.find({}).lean();

        if (operator && !canManageDeptUsers(operator, allDepts)) {
            ctx.status = 403;
            ctx.body = utils.fail('', '无权导出用户数据');
            return;
        }

        let params = {};
        if (userId) params.userId = userId;
        if (userName) params.userName = userName;
        if (state && state != 0) params.state = state;

        let users = await User.find(params, { _id: 0, userPwd: 0 }).lean();

        if (operator && !isTopAdmin(operator)) {
            users = users.filter(user => canManageUserInUserAdmin(operator, user, allDepts));
        }

        const rows = users.map(formatUserExportRow);
        const buffer = excel.exportExcel(rows);
        const fileName = encodeURIComponent(`用户数据_${Date.now()}.xlsx`);

        ctx.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        ctx.set('Content-Disposition', `attachment; filename*=UTF-8''${fileName}`);
        ctx.body = buffer;
    } catch (error) {
        console.log('导出用户 Excel 异常:', error);
        ctx.status = 500;
        ctx.body = utils.fail('', '导出失败');
    }
});

/**
 * 【验证码接口】GET /api/users/captcha
 * 
 * 作用：生成图形验证码，用于登录验证
 * 
 * 流程：
 * 1. 使用 svg-captcha 生成验证码图片
 * 2. 将验证码图片转换为 Base64 格式
 * 3. 将验证码文字（小写）保存到 session 中
 * 4. 返回验证码图片的 Base64 数据
 * 
 * 说明：验证码有效期为 session 生命周期，登录时需要验证
 * 
 * @returns {Object} - { data: { imgurl: Base64图片地址 }, msg: 'ok', code: 200 }
 */
router.get('/captcha', async (ctx) => {
    // 生成验证码配置
    var cap = svgCaptcha.create({
        size: 4,                // 验证码长度（4位）
        width: 120,             // 验证码图片宽度
        height: 40,             // 验证码图片高度
        fontSize: 45,           // 验证码字体大小
        ignoreChars: "0oO1ilI", // 排除容易混淆的字符
        noise: 2,               // 干扰线条数量
        color: true,            // 字符是否有颜色
        background: "#ddd",     // 图片背景颜色
    });
    
    // 将验证码图片转换为 Base64 格式
    let img = new Buffer.from(cap.data).toString("base64");
    let base64Img = "data:image/svg+xml;base64," + img;
    
    // 将验证码文字（小写）保存到 session
    let text = cap.text.toLowerCase();
    ctx.session.picCode = text;
    
    // 返回验证码图片
    ctx.body = utils.success({ code: 200, data: { imgurl: `${base64Img}` }, msg: 'ok' });
});

/**
 * 员工权限管理树
 * GET /api/users/permissionTree
 */
router.get('/permissionTree', async (ctx) => {
    const { userName, userId } = ctx.request.query;
    const authorization = ctx.request.header.authorization || ctx.request.headers.authorization;
    const operator = utils.decoded(authorization);

    if (!operator) {
        ctx.body = utils.fail('', '未登录');
        return;
    }

    try {
        const allDepts = await Dept.find({}).lean();
        const allUsers = await User.find({}, { userPwd: 0 }).lean();
        const tree = buildPermissionManageTree(operator, allUsers, allDepts, { userName, userId });

        ctx.body = utils.success({
            ...tree,
            canManageAllPermissions: isCompanyPermissionAdmin(operator)
        });
    } catch (error) {
        console.log('获取权限管理树异常:', error);
        ctx.body = utils.fail('获取权限管理树失败');
    }
});

/**
 * 设置用户个人操作权限
 * POST /api/users/permission
 */
router.post('/permission', async (ctx) => {
    const { userId, permissionList } = ctx.request.body;
    const authorization = ctx.request.header.authorization || ctx.request.headers.authorization;
    const operator = utils.decoded(authorization);

    if (!userId || !permissionList) {
        ctx.body = utils.fail('参数错误');
        return;
    }

    try {
        const allDepts = await Dept.find({}).lean();
        const targetUser = await User.findOne({ userId }).lean();

        if (!targetUser) {
            ctx.body = utils.fail('用户不存在');
            return;
        }

        if (!operator || !canManageEmployeePermission(operator, targetUser, allDepts)) {
            ctx.body = utils.fail('无权配置该用户的操作权限');
            return;
        }

        await User.findOneAndUpdate({ userId }, { permissionList });

        ctx.body = utils.success('设置成功');
    } catch (error) {
        console.log('设置用户权限异常:', error);
        ctx.body = utils.fail('设置用户权限异常');
    }
});

// 导出路由模块
module.exports = router;
